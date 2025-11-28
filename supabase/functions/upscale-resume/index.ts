/*
  # Upscale Resume Edge Function
  
  Resumes a paused upscaling job after client-side tile splitting.
  Updates the job's tiles_data with the new split tiles and launches the next stage.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TileData {
  tile_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  input_url: string;
  stage1_url: string | null;
  stage2_url: string | null;
  stage1_prediction_id: string | null;
  stage2_prediction_id: string | null;
  status: string;
  error: string | null;
  parent_tile_id?: number;
  is_sub_tile?: boolean;
  sub_tile_index?: number;
  sub_tile_grid?: { cols: number; rows: number };
  [key: string]: unknown;
}

interface ResumeRequest {
  jobId: string;
  tilesData: TileData[];
  nextStage: number;
  splitDetails?: {
    tileId: number;
    splitInto: number;
    subTileIds: number[];
  }[];
}

serve(async (req: Request) => {
  console.log("🔵🔵🔵 RESUME VERSION: 2024-11-25-v1 🔵🔵🔵");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ResumeRequest = await req.json();
    const { jobId, tilesData, nextStage, splitDetails } = body;

    console.log(`[Resume] Resuming job ${jobId} with ${tilesData.length} tiles for stage ${nextStage}`);
    
    if (splitDetails) {
      console.log(`[Resume] Split details: ${splitDetails.length} tiles were split`);
      for (const detail of splitDetails) {
        console.log(`[Resume]   - Tile ${detail.tileId} → ${detail.splitInto} sub-tiles (IDs: ${detail.subTileIds.join(', ')})`);
      }
    }

    // Get the current job to verify state
    const { data: job, error: jobError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`[Resume] Job not found:`, jobError);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status !== "needs_split") {
      console.warn(`[Resume] Job ${jobId} is not in needs_split status (current: ${job.status})`);
      return new Response(
        JSON.stringify({ success: false, error: `Job is in ${job.status} status, not needs_split` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job with new tiles_data and advance to next stage
    const { error: updateError } = await supabase
      .from("upscale_jobs")
      .update({
        tiles_data: tilesData,
        current_stage: nextStage,
        status: "processing",
        last_webhook_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateError) {
      console.error(`[Resume] Failed to update job:`, updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Resume] Job ${jobId} updated with ${tilesData.length} tiles, advancing to stage ${nextStage}`);

    // Now launch all tiles for the next stage
    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      console.error(`[Resume] Missing REPLICATE_API_TOKEN`);
      return new Response(
        JSON.stringify({ success: false, error: "Missing Replicate API token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
    
    // Determine model based on chain strategy
    const chainStrategy = job.chain_strategy;
    const stageConfig = chainStrategy?.stages?.[nextStage - 1];
    
    if (!stageConfig) {
      console.error(`[Resume] No stage config for stage ${nextStage}`);
      return new Response(
        JSON.stringify({ success: false, error: `No config for stage ${nextStage}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Resume] Stage ${nextStage} config:`, stageConfig);

    // Get the model version for this stage
    const modelVersion = stageConfig.model_version || getDefaultModelVersion(stageConfig.model, stageConfig.scale);
    
    let launchedCount = 0;
    let failedCount = 0;

    // Launch each tile for the next stage
    for (const tile of tilesData) {
      // Get the input URL for this stage (output from previous stage, or the split tile URL)
      const prevStage = nextStage - 1;
      let inputUrl: string | null = null;
      
      if (tile.is_sub_tile) {
        // Sub-tile: use its input_url which was set during splitting
        inputUrl = tile.input_url;
      } else if (prevStage === 1) {
        inputUrl = tile.stage1_url;
      } else if (prevStage === 2) {
        inputUrl = tile.stage2_url;
      } else {
        inputUrl = (tile as any)[`stage${prevStage}_url`];
      }

      if (!inputUrl) {
        console.warn(`[Resume] Tile ${tile.tile_id} missing input URL for stage ${nextStage}, skipping`);
        failedCount++;
        continue;
      }

      // Build input for Replicate
      const input: Record<string, unknown> = {
        image: inputUrl,
        scale: stageConfig.scale,
      };

      // Add model-specific parameters
      if (stageConfig.model === "real-esrgan" || stageConfig.model?.includes("esrgan")) {
        input.tile = 256;
        input.tile_pad = 16;
        input.face_enhance = false;
      }

      console.log(`[Resume] Launching tile ${tile.tile_id} for stage ${nextStage}`);

      try {
        const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${replicateToken}`,
          },
          body: JSON.stringify({
            version: modelVersion,
            input,
            webhook: webhookUrl,
            webhook_events_filter: ["completed"],
          }),
        });

        if (!predictionRes.ok) {
          const errorText = await predictionRes.text();
          console.error(`[Resume] Failed to launch tile ${tile.tile_id}:`, errorText);
          failedCount++;
          continue;
        }

        const prediction = await predictionRes.json();
        console.log(`[Resume] Tile ${tile.tile_id} launched: ${prediction.id}`);

        // Update tile with prediction ID using atomic RPC
        const { error: rpcError } = await supabase.rpc('set_tile_processing', {
          p_job_id: jobId,
          p_tile_id: tile.tile_id,
          p_stage: nextStage,
          p_prediction_id: prediction.id
        });

        if (rpcError) {
          console.warn(`[Resume] RPC failed for tile ${tile.tile_id}:`, rpcError);
        }

        launchedCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[Resume] Error launching tile ${tile.tile_id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Resume] Launch complete: ${launchedCount} succeeded, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        nextStage,
        tilesLaunched: launchedCount,
        tilesFailed: failedCount,
        totalTiles: tilesData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[Resume] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get default model version based on model name and scale
 */
function getDefaultModelVersion(model: string, scale: number): string {
  // Real-ESRGAN 4x
  if (model === "real-esrgan" || model?.includes("esrgan")) {
    return "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";
  }
  
  // SwinIR (default for art content)
  if (model === "swinir" || model?.includes("swinir")) {
    return "660d922d33153019e8c263a3bba265de882e7f4f70396571f8b3b1c687c8e3d9";
  }
  
  // Default to Real-ESRGAN
  return "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";
}








