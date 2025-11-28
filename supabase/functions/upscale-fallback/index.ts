// supabase/functions/upscale-fallback/index.ts
// Fallback function to manually check Replicate when webhooks fail

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[Fallback] Received request");
    
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Fallback] Checking job:", jobId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("[Fallback] Job not found:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (job.using_tiling && job.tiles_data && job.tiles_data.length > 0) {
      console.log(`[Fallback] Tiling job detected - ${job.tiles_data.length} tiles, stage ${job.current_stage}/${job.total_stages}`);

      const statusCounts: Record<string, number> = {};
      const tilesMissingPrediction: number[] = [];
      const tileSummaries: Array<Record<string, unknown>> = [];
      const replicateChecks: Array<Record<string, unknown>> = [];
      const triggeredWebhooks: string[] = [];

      const getPredictionKey = (stage: number) => {
        if (stage === 1) return "stage1_prediction_id";
        if (stage === 2) return "stage2_prediction_id";
        return `stage${stage}_prediction_id`;
      };

      for (const tile of job.tiles_data) {
        const tileStatus = tile.status || "unknown";
        statusCounts[tileStatus] = (statusCounts[tileStatus] || 0) + 1;

        const processingMatch = typeof tileStatus === "string" ? tileStatus.match(/stage(\d+)_processing/) : null;
        if (processingMatch) {
          const stageNum = parseInt(processingMatch[1]);
          const predictionKey = getPredictionKey(stageNum);
          if (!tile[predictionKey]) {
            tilesMissingPrediction.push(tile.tile_id ?? -1);
          }
        }

        tileSummaries.push({
          tile_id: tile.tile_id,
          status: tile.status,
          stage1_prediction_id: tile.stage1_prediction_id ?? null,
          stage2_prediction_id: tile.stage2_prediction_id ?? null,
          stage3_prediction_id: (tile as any).stage3_prediction_id ?? null,
        });
      }

      if (replicateToken && supabaseUrl && serviceRoleKey) {
        for (const tile of job.tiles_data) {
          const status = tile.status ?? "";
          const processingMatch = typeof status === "string" ? status.match(/stage(\d+)_processing/) : null;
          if (!processingMatch) continue;

          const stageNum = parseInt(processingMatch[1]);
          const predictionKey = getPredictionKey(stageNum);
          const predictionId = tile[predictionKey];
          if (!predictionId) continue;

          try {
            const replicateResponse = await fetch(
              `https://api.replicate.com/v1/predictions/${predictionId}`,
              {
                headers: {
                  "Authorization": `Token ${replicateToken}`,
                  "Content-Type": "application/json",
                },
              },
            );

            if (!replicateResponse.ok) {
              console.error("[Fallback] Replicate API error for tile prediction:", predictionId, replicateResponse.status);
              replicateChecks.push({
                tile_id: tile.tile_id,
                stage: stageNum,
                prediction_id: predictionId,
                status: "error",
                httpStatus: replicateResponse.status,
              });
              continue;
            }

            const prediction = await replicateResponse.json();
            replicateChecks.push({
              tile_id: tile.tile_id,
              stage: stageNum,
              prediction_id: prediction.id,
              status: prediction.status,
            });

            if (prediction.status === "succeeded" || prediction.status === "failed") {
              console.log("[Fallback] Tile prediction complete! Simulating webhook for", prediction.id);
              const webhookResponse = await fetch(
                `${supabaseUrl}/functions/v1/upscale-webhook`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify(prediction),
                },
              );

              const webhookResult = await webhookResponse.text();
              console.log("[Fallback] Tile webhook simulation result:", webhookResult);
              triggeredWebhooks.push(prediction.id);
            }
          } catch (error) {
            console.error("[Fallback] Error checking tile prediction:", error);
            replicateChecks.push({
              tile_id: tile.tile_id,
              stage: stageNum,
              prediction_id: predictionId,
              status: "error",
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else {
        console.warn("[Fallback] Missing tokens for Replicate or Supabase webhook simulation");
      }

      return new Response(
        JSON.stringify({
          success: true,
          usingTiling: true,
          jobStatus: job.status,
          currentStage: job.current_stage,
          totalStages: job.total_stages,
          totalTiles: job.tiles_data.length,
          statusCounts,
          tilesMissingPrediction,
          replicateChecks,
          triggeredWebhooks,
          tileSummaries,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!job.prediction_id) {
      console.error("[Fallback] No prediction_id in job");
      return new Response(
        JSON.stringify({ success: false, error: "No prediction_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Fallback] Checking Replicate prediction:", job.prediction_id);

    if (!replicateToken) {
      return new Response(
        JSON.stringify({ success: false, error: "REPLICATE_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Replicate API directly
    const replicateResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${job.prediction_id}`,
      {
        headers: {
          "Authorization": `Token ${replicateToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!replicateResponse.ok) {
      console.error("[Fallback] Replicate API error:", replicateResponse.status);
      const errorText = await replicateResponse.text();
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to fetch from Replicate",
          status: replicateResponse.status,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await replicateResponse.json();

    console.log("[Fallback] Replicate prediction status:", {
      id: prediction.id,
      status: prediction.status,
      hasOutput: !!prediction.output
    });

    // If prediction is complete, simulate the webhook
    if (prediction.status === "succeeded" || prediction.status === "failed") {
      console.log("[Fallback] Prediction complete! Simulating webhook...");

      // Call webhook function directly with prediction data
      const webhookResponse = await fetch(
        `${supabaseUrl}/functions/v1/upscale-webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify(prediction)
        }
      );

      const webhookResult = await webhookResponse.text();
      console.log("[Fallback] Webhook simulation result:", webhookResult);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Webhook simulated successfully",
          predictionStatus: prediction.status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prediction still processing
    console.log("[Fallback] Prediction still processing");
    
    return new Response(
      JSON.stringify({ 
        success: false,
        message: "Prediction still processing",
        predictionStatus: prediction.status
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Fallback] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

