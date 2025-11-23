/*
  # Upscale Webhook Edge Function
  
  Handles Replicate webhook callbacks and orchestrates multi-stage upscaling chains.
  Never downloads images into memory - only passes URLs between stages.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface ReplicateWebhook {
  id: string;
  status: "succeeded" | "failed" | "canceled";
  output: string[] | null;
  error: string | null;
  input: Record<string, unknown>;
  metrics?: {
    predict_time: number;
  };
}

interface ChainStage {
  stage: number;
  model: string;
  scale: number;
  input_url: string;
  output_url: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  prediction_id: string | null;
}

interface ChainStrategy {
  targetScale: number;
  stages: ChainStage[];
  estimatedTime: number;
  estimatedCost: number;
}

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
}

interface TilingGrid {
  tilesX: number;
  tilesY: number;
  tileWidth: number;
  tileHeight: number;
  overlap: number;
  totalTiles: number;
}

interface UpscaleJob {
  id: string;
  user_id: string;
  input_url: string;
  current_output_url: string | null;
  final_output_url: string | null;
  content_type: string;
  target_scale: number;
  current_stage: number;
  total_stages: number;
  prediction_id: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  chain_strategy: ChainStrategy;
  created_at: string;
  completed_at: string | null;
  using_tiling: boolean | null;
  tile_grid: TilingGrid | null;
  tiles_data: TileData[] | null;
}

function getModelVersion(slug: string): string {
  return slug.split(":")[1];
}

function selectModelFor(contentType: string, scale: number): { slug: string; input: Record<string, unknown> } {
  const PHOTO_MODEL = {
    slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
    input: { 
      face_enhance: scale <= 4
      // tile and tile_pad will be added conditionally when needed
    },
  };

  const ART_TEXT_MODEL = {
    slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
    input: { 
      task: scale === 4 
        ? "Real-World Image Super-Resolution-Large"   // 4x
        : "Real-World Image Super-Resolution-Medium"  // 2x
    },
  };

  const ANIME_MODEL = {
    slug: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
    input: { 
      anime: true  // No tiling at native scales
    },
  };

  const CLARITY_MODEL = {
    slug: "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
    input: {
      creativity: 0.35,
      resemblance: 0.6,
      scale_factor: Math.min(scale, 2),
    },
  };

  switch (contentType) {
    case "photo":
      return PHOTO_MODEL;
    case "art":
    case "text":
      // Always use SwinIR 4x for Art in all stages
      console.log(`[selectModelFor] Art/Text stage → Using SwinIR 4x`);
      return {
        slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
        input: { 
          task: "Real-World Image Super-Resolution-Large"  // Always 4x
        },
      };
    case "anime":
      return ANIME_MODEL;
    case "clarity":
      return CLARITY_MODEL;
    default:
      return PHOTO_MODEL;
  }
}

async function continueChain(
  supabase: any,
  job: UpscaleJob,
  currentOutputUrl: string,
  strategy: ChainStrategy
) {
  const nextStageIndex = job.current_stage; // current_stage is 1-indexed, next is at index
  if (nextStageIndex >= strategy.stages.length) {
    console.error("[upscale-webhook] No next stage found");
    return;
  }

  const nextStage = strategy.stages[nextStageIndex];
  nextStage.input_url = currentOutputUrl;
  nextStage.status = "processing";

  console.log(`[upscale-webhook] Starting stage ${nextStageIndex + 1}/${strategy.stages.length}`);

  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
  if (!replicateToken) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const model = selectModelFor(job.content_type, nextStage.scale);
  
  // 🔥 CRITICAL: Replicate has GPU memory limits
  // Max pixels that fit in memory: ~2,096,704 (1448x1448)
  // If we're processing a large intermediate image, we need to warn
  const input: Record<string, unknown> = {
    ...model.input,
    image: currentOutputUrl, // PASS URL, NOT BINARY DATA
  };
  
  console.log(`[upscale-webhook] ⚠️ Note: Replicate GPU memory limit is ~2.1M pixels (1448×1448)`);
  console.log(`[upscale-webhook] If stage fails, image may be too large for GPU memory`);

  const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
  if (!isSwinIR) {
    input.scale = nextStage.scale;
  }
  
  // Add tiling parameters for Real-ESRGAN in multi-stage chains for safety
  // Multi-stage chains produce larger intermediate images that may exceed GPU limits
  const isRealESRGAN = model.slug.includes('real-esrgan');
  if (isRealESRGAN && job.current_stage > 1) {
    // For stages after the first, use tiling to handle larger intermediate images
    input.tile = 512;
    input.tile_pad = 10;
    console.log(`[upscale-webhook] Adding tile parameters for stage ${job.current_stage + 1} (intermediate image may be large)`);
  }

  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
  const version = getModelVersion(model.slug);

  const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${replicateToken}`,
    },
    body: JSON.stringify({
      version,
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    }),
  });

  if (!predictionRes.ok) {
    const errText = await predictionRes.text();
    throw new Error(`Failed to create next prediction: ${errText}`);
  }

  const prediction = await predictionRes.json();

  // Update job with new stage and prediction_id
  console.log(`[upscale-webhook] 🔄 Updating job ${job.id} to stage ${job.current_stage + 1} with prediction ${prediction.id}`);
  
  const { error: updateError } = await supabase
    .from("upscale_jobs")
    .update({
      current_stage: job.current_stage + 1,
      current_output_url: currentOutputUrl,
      prediction_id: prediction.id,
      last_webhook_at: new Date().toISOString(), // 🔥 Reset timestamp for new stage
      chain_strategy: strategy,
    })
    .eq("id", job.id);

  if (updateError) {
    console.error(`[upscale-webhook] ❌ Failed to update job ${job.id}:`, updateError);
    throw new Error(`Database update failed: ${updateError.message}`);
  }
  
  console.log(`[upscale-webhook] ✅ Successfully updated job ${job.id} to stage ${job.current_stage + 1}`);

  // Update stage in strategy
  nextStage.prediction_id = prediction.id;
  await supabase
    .from("upscale_jobs")
    .update({ chain_strategy: strategy })
    .eq("id", job.id);
}

async function finalizeJob(
  supabase: any,
  job: UpscaleJob,
  finalOutputUrl: string,
  strategy: ChainStrategy
) {
  console.log(`[upscale-webhook] Job ${job.id} complete. Final output: ${finalOutputUrl}`);

  // Copy to permanent storage
  let permanentUrl = finalOutputUrl;
  
  try {
    const filename = `${job.id}_${job.target_scale}x_final.png`;
    
    // Fetch and upload in one stream (memory efficient)
    const response = await fetch(finalOutputUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch final output: ${response.statusText}`);
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("images")
      .upload(`images/${filename}`, response.body, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(`images/${filename}`);
    
    permanentUrl = urlData.publicUrl;
  } catch (error) {
    console.error("[upscale-webhook] Error copying to storage:", error);
    // Continue with temporary URL
  }

  // Mark job as completed
  await supabase
    .from("upscale_jobs")
    .update({
      final_output_url: permanentUrl,
      current_output_url: permanentUrl,
      status: "completed",
      completed_at: new Date().toISOString(),
      chain_strategy: strategy,
    })
    .eq("id", job.id);
}

async function handleFailedPrediction(
  supabase: any,
  job: UpscaleJob,
  error: string | null
) {
  console.error(`[upscale-webhook] Prediction failed for job ${job.id}:`, error);

  // 🔥 Check if error is due to GPU memory limits
  const isMemoryError = error && (
    error.includes("greater than the max size that fits in GPU memory") ||
    error.includes("out of memory") ||
    error.includes("CUDA out of memory")
  );

  if (isMemoryError) {
    console.error(`[upscale-webhook] 🚨 GPU MEMORY ERROR: Image too large for Replicate GPU`);
    
    // Check if we have a usable intermediate output from previous stage
    if (job.current_output_url && job.current_stage > 1) {
      console.log(`[upscale-webhook] Delivering partial result from stage ${job.current_stage - 1}/${job.total_stages}`);
      await supabase
        .from("upscale_jobs")
        .update({
          status: "partial_success",
          final_output_url: job.current_output_url,
          completed_at: new Date().toISOString(),
          error_message: `Completed ${job.current_stage - 1}/${job.total_stages} stages. GPU memory limit exceeded for further processing. Error: ${error}`,
        })
        .eq("id", job.id);
      return;
    }
  }

  const MAX_RETRIES = 3;
  
  if (job.retry_count < MAX_RETRIES && !isMemoryError) {
    // Retry the same stage (but not for memory errors - they'll always fail)
    console.log(`[upscale-webhook] Retrying stage ${job.current_stage} (attempt ${job.retry_count + 1}/${MAX_RETRIES})`);
    
    await supabase
      .from("upscale_jobs")
      .update({
        retry_count: job.retry_count + 1,
        prediction_id: null,
        error_message: error,
        status: "processing", // Keep as processing for retry
      })
      .eq("id", job.id);
    
    // TODO: Could trigger retry here, but for now just mark for manual retry
  } else {
    // Max retries exceeded or memory error
    const strategy: ChainStrategy = job.chain_strategy;
    
    // Check if we have a usable intermediate output
    if (job.current_output_url && job.current_stage > 1) {
      // Partial success - deliver what we have
      console.log(`[upscale-webhook] Delivering partial result from stage ${job.current_stage - 1}/${job.total_stages}`);
      await supabase
        .from("upscale_jobs")
        .update({
          status: "partial_success",
          final_output_url: job.current_output_url,
          completed_at: new Date().toISOString(),
          error_message: `Completed ${job.current_stage - 1}/${job.total_stages} stages. Error: ${error}`,
        })
        .eq("id", job.id);
    } else {
      // Complete failure
      console.log(`[upscale-webhook] Marking job as failed`);
      await supabase
        .from("upscale_jobs")
        .update({
          status: "failed",
          error_message: error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
}

/**
 * Handle webhook for tiling jobs - update tile status and coordinate stage transitions
 */
async function handleTileWebhook(webhook: ReplicateWebhook, job: UpscaleJob, supabase: any) {
  console.log(`[Tile Webhook] 📥 Received webhook for prediction ${webhook.id}, job ${job.id}, status: ${webhook.status}`);
  
  if (!job.tiles_data || !job.tile_grid) {
    console.error(`[Tile Webhook] ❌ Job ${job.id} missing tile data`);
    return;
  }
  
  console.log(`[Tile Webhook] Searching for prediction ${webhook.id} in ${job.tiles_data.length} tiles...`);
  
  // Find which tile this prediction belongs to (check all possible stages)
  let tileIndex = -1;
  let detectedStage = 0;
  
  for (let i = 0; i < job.tiles_data.length; i++) {
    const t = job.tiles_data[i];
    if (t.stage1_prediction_id === webhook.id) {
      tileIndex = i;
      detectedStage = 1;
      break;
    } else if (t.stage2_prediction_id === webhook.id) {
      tileIndex = i;
      detectedStage = 2;
      break;
    } else if ((t as any).stage3_prediction_id === webhook.id) {
      tileIndex = i;
      detectedStage = 3;
      break;
    }
    // Check stage 4+ dynamically
    for (let stage = 4; stage <= job.total_stages; stage++) {
      if ((t as any)[`stage${stage}_prediction_id`] === webhook.id) {
        tileIndex = i;
        detectedStage = stage;
        break;
      }
    }
    if (tileIndex !== -1) break;
  }
  
  if (tileIndex === -1) {
    console.error(`[Tile Webhook] ❌ Prediction ${webhook.id} not found in job ${job.id} tiles`);
    console.error(`[Tile Webhook] Available tile prediction IDs:`, job.tiles_data.map((t: TileData) => ({
      tile_id: t.tile_id,
      stage1: t.stage1_prediction_id,
      stage2: t.stage2_prediction_id,
      stage3: (t as any).stage3_prediction_id
    })));
    return;
  }
  
  console.log(`[Tile Webhook] ✅ Found matching tile at index ${tileIndex}, tile_id: ${job.tiles_data[tileIndex].tile_id}`);

  
  const tile = job.tiles_data[tileIndex];
  const isStage1 = detectedStage === 1;
  const currentStage = detectedStage;
  
  console.log(`[Tile Webhook] Tile ${tile.tile_id} stage ${currentStage} status: ${webhook.status}`);
  
  // Handle tile failure
  if (webhook.status === "failed") {
    tile.status = "failed";
    tile.error = webhook.error;
    
    await supabase
      .from("upscale_jobs")
      .update({ tiles_data: job.tiles_data })
      .eq("id", job.id);
    
    console.error(`[Tile Webhook] Tile ${tile.tile_id} stage ${currentStage} failed: ${webhook.error}`);
    
    // Check if too many tiles failed
    const failedCount = job.tiles_data.filter((t: TileData) => t.status === "failed").length;
    if (failedCount > job.tiles_data.length / 2) {
      await supabase
        .from("upscale_jobs")
        .update({
          status: "failed",
          error_message: `Too many tiles failed: ${failedCount}/${job.tiles_data.length}`,
          completed_at: new Date().toISOString()
        })
        .eq("id", job.id);
    }
    
    return;
  }
  
  // Handle successful tile completion
  if (webhook.status === "succeeded") {
    const outputUrl = Array.isArray(webhook.output) ? webhook.output[0] : webhook.output;
    
    if (!outputUrl) {
      console.error(`[Tile Webhook] No output URL for tile ${tile.tile_id}`);
      return;
    }
    
    // Update tile data dynamically for any stage
    if (currentStage === 1) {
      tile.stage1_url = outputUrl;
      tile.status = "stage1_complete";
    } else if (currentStage === 2) {
      tile.stage2_url = outputUrl;
      tile.status = "stage2_complete";
    } else if (currentStage === 3) {
      (tile as any).stage3_url = outputUrl;
      tile.status = "stage3_complete";
    } else {
      // Stage 4+
      (tile as any)[`stage${currentStage}_url`] = outputUrl;
      tile.status = `stage${currentStage}_complete`;
    }
    
    await supabase
      .from("upscale_jobs")
      .update({ tiles_data: job.tiles_data })
      .eq("id", job.id);
    
    console.log(`[Tile Webhook] 📊 Tile ${tile.tile_id} stage ${currentStage} complete`);
    
    // 🔥 CRITICAL: Refetch job to get latest tiles_data (avoid race conditions)
    const { data: refreshedJob, error: refreshError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("id", job.id)
      .single();
    
    if (refreshError || !refreshedJob) {
      console.error(`[Tile Webhook] ❌ Failed to refetch job ${job.id}:`, refreshError);
      return;
    }
    
    // Check if all tiles completed this stage (using FRESH data)
    const targetStatus = `stage${currentStage}_complete`;
    const completedTiles = refreshedJob.tiles_data.filter((t: TileData) => {
      // Count tiles that have completed this stage or beyond
      const status = t.status;
      if (status === targetStatus) return true;
      
      // Also count tiles that have moved to later stages
      for (let s = currentStage + 1; s <= refreshedJob.total_stages; s++) {
        if (status === `stage${s}_complete` || status === `stage${s}_processing`) return true;
      }
      
      return false;
    });
    
    console.log(`[Tile Webhook] 📊 Progress: ${completedTiles.length}/${refreshedJob.tiles_data.length} tiles at ${targetStatus}`);
    
    if (completedTiles.length === refreshedJob.tiles_data.length) {
      // Determine current stage number
      const currentStage = isStage1 ? 1 : 2;
      const isLastStage = currentStage >= refreshedJob.total_stages;
      
      console.log(`[Tile Webhook] Stage ${currentStage}/${refreshedJob.total_stages} complete for all tiles`);
      
      if (!isLastStage) {
        // More stages remain - launch next stage
        const nextStage = currentStage + 1;
        console.log(`[Tile Webhook] Launching stage ${nextStage}...`);
        await launchTileStage(refreshedJob, nextStage, supabase);
      } else {
        // This is the final stage - mark as tiles_ready for client-side stitching
        console.log(`[Tile Webhook] 🎯 All stages complete! Attempting status update: processing → tiles_ready...`);
        
        // 🔥 IDEMPOTENT UPDATE: Only update if status is still "processing"
        const { data: updated, error: updateError } = await supabase
          .from("upscale_jobs")
          .update({
            status: "tiles_ready",
            last_webhook_at: new Date().toISOString()
          })
          .eq("id", refreshedJob.id)
          .eq("status", "processing")  // Only update if still processing (prevents duplicate updates)
          .select();
        
        if (updateError) {
          console.error(`[Tile Webhook] ❌ FAILED to update job status:`, updateError);
        } else if (!updated || updated.length === 0) {
          console.log(`[Tile Webhook] ℹ️ Status already updated by another webhook (no rows affected)`);
        } else {
          console.log(`[Tile Webhook] ✅ Job ${refreshedJob.id} marked as tiles_ready! Rows updated: ${updated.length}`);
        }
      }
    }
  }
}

/**
 * Launch all tiles for a specific stage
 */
async function launchTileStage(job: UpscaleJob, stageNumber: number, supabase: any) {
  console.log(`[Launch Stage] Starting stage ${stageNumber} for ${job.tiles_data?.length} tiles`);
  
  if (!job.tiles_data || !job.chain_strategy) return;
  
  const stage = job.chain_strategy.stages[stageNumber - 1];
  const model = selectModelFor(job.content_type, stage.scale);
  const version = getModelVersion(model.slug);
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
  
  for (let i = 0; i < job.tiles_data.length; i++) {
    const tile = job.tiles_data[i];
    
    // Skip failed tiles
    if (tile.status === "failed") continue;
    
    // Get input URL from previous stage (dynamically support any stage)
    let inputUrl: string | null = null;
    if (stageNumber === 1) {
      inputUrl = tile.input_url;
    } else if (stageNumber === 2) {
      inputUrl = tile.stage1_url;
    } else if (stageNumber === 3) {
      inputUrl = tile.stage2_url;
    } else {
      // For stage 4+, use generic field naming
      inputUrl = (tile as any)[`stage${stageNumber - 1}_url`];
    }
    
    if (!inputUrl) {
      console.error(`[Launch Stage] Tile ${tile.tile_id} missing input for stage ${stageNumber}`);
      continue;
    }
    
    const input: Record<string, unknown> = {
      ...model.input,
      image: inputUrl,
    };
    
    const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
    if (!isSwinIR) {
      input.scale = stage.scale;
    }
    
    console.log(`[Launch Stage] 🔍 Tile ${tile.tile_id} stage ${stageNumber}: Calling Replicate with model: ${model.slug.split('/')[1]}`);
    console.log(`[Launch Stage] 🔍 Input parameters:`, JSON.stringify(input, null, 2));
    
    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${replicateToken}`,
      },
      body: JSON.stringify({
        version,
        input,
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      }),
    });
    
    if (!predictionRes.ok) {
      console.error(`[Launch Stage] Failed to start stage ${stageNumber} for tile ${tile.tile_id}`);
      continue;
    }
    
    const prediction = await predictionRes.json();
    
    // Store prediction ID dynamically for any stage
    if (stageNumber === 2) {
      tile.stage2_prediction_id = prediction.id;
      tile.status = "stage2_processing";
    } else if (stageNumber === 3) {
      (tile as any).stage3_prediction_id = prediction.id;
      tile.status = "stage3_processing";
    } else if (stageNumber > 3) {
      (tile as any)[`stage${stageNumber}_prediction_id`] = prediction.id;
      tile.status = `stage${stageNumber}_processing`;
    }
    
    console.log(`[Launch Stage] Tile ${tile.tile_id} stage ${stageNumber} launched: ${prediction.id}`);
  }
  
  // Update job with new prediction IDs
  await supabase
    .from("upscale_jobs")
    .update({ 
      tiles_data: job.tiles_data,
      current_stage: stageNumber
    })
    .eq("id", job.id);
  
  console.log(`[Launch Stage] All tiles launched for stage ${stageNumber}`);
}

/**
 * Stitch completed tiles and finalize job
 */
async function stitchAndFinalize(job: UpscaleJob, supabase: any) {
  console.log(`[Stitch] Starting stitch for job ${job.id}`);
  
  if (!job.tiles_data || !job.tile_grid) {
    console.error(`[Stitch] Missing tile data or grid`);
    return;
  }
  
  try {
    // Import Image for stitching
    const { decode, Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");
    
    // Calculate final dimensions
    const outputWidth = job.tile_grid.tileWidth * job.tile_grid.tilesX * job.target_scale;
    const outputHeight = job.tile_grid.tileHeight * job.tile_grid.tilesY * job.target_scale;
    
    console.log(`[Stitch] Final size: ${outputWidth}×${outputHeight}`);
    
    // Download and composite tiles ONE AT A TIME (memory safe)
    let output: any = null;
    
    for (let i = 0; i < job.tiles_data.length; i++) {
      const tile = job.tiles_data[i];
      
      // Get the final stage URL (work backwards from total_stages to find the last completed stage)
      let tileUrl: string | null = null;
      for (let stage = job.total_stages; stage >= 1; stage--) {
        if (stage === 1) {
          tileUrl = tile.stage1_url;
        } else if (stage === 2) {
          tileUrl = tile.stage2_url;
        } else {
          tileUrl = (tile as any)[`stage${stage}_url`];
        }
        
        if (tileUrl) break;
      }
      
      if (!tileUrl) {
        console.error(`[Stitch] Tile ${tile.tile_id} missing output URL`);
        continue;
      }
      
      console.log(`[Stitch] Downloading tile ${tile.tile_id}...`);
      
      const response = await fetch(tileUrl);
      const buffer = await response.arrayBuffer();
      const tileImage = await decode(new Uint8Array(buffer));
      
      if (!output) {
        // First tile - create canvas
        output = new Image(outputWidth, outputHeight);
        output.fill(0xFFFFFFFF);
      }
      
      // Composite tile
      const x = tile.x * job.target_scale;
      const y = tile.y * job.target_scale;
      
      console.log(`[Stitch] Compositing tile ${tile.tile_id} at (${x},${y})`);
      output.composite(tileImage, x, y);
    }
    
    if (!output) {
      throw new Error("No tiles were stitched");
    }
    
    console.log(`[Stitch] Encoding final image...`);
    
    // Encode and upload final result
    const finalBuffer = await output.encode();
    const timestamp = Date.now();
    const fileName = `final_${timestamp}.png`;
    
    const { error: uploadError } = await supabase.storage.from("images").upload(
      `temp/${fileName}`,
      finalBuffer,
      { contentType: "image/png", upsert: false }
    );
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${fileName}`);
    const finalUrl = urlData.publicUrl;
    
    console.log(`[Stitch] Complete! Final URL: ${finalUrl}`);
    
    // Update job as completed
    await supabase
      .from("upscale_jobs")
      .update({
        status: "completed",
        final_output_url: finalUrl,
        current_output_url: finalUrl,
        completed_at: new Date().toISOString()
      })
      .eq("id", job.id);
    
    console.log(`[Stitch] Job ${job.id} finalized`);
    
  } catch (stitchError) {
    console.error(`[Stitch] Error:`, stitchError);
    
    await supabase
      .from("upscale_jobs")
      .update({
        status: "failed",
        error_message: `Stitching failed: ${stitchError instanceof Error ? stitchError.message : String(stitchError)}`,
        completed_at: new Date().toISOString()
      })
      .eq("id", job.id);
  }
}

async function processWebhookData(webhook: ReplicateWebhook, supabase: any) {
  try {
    console.log(`[upscale-webhook] Processing webhook for prediction ${webhook.id}`);

    // First, try to find regular job by prediction ID
    let { data: job, error: jobError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("prediction_id", webhook.id)
      .single();

    // If not found, check if this is a tile prediction
    if (jobError || !job) {
      console.log(`[upscale-webhook] No regular job found, checking for tile jobs...`);
      
      // Query for jobs with tiles_data containing this prediction_id
      const { data: tilingJobs, error: tilingError } = await supabase
        .from("upscale_jobs")
        .select("*")
        .eq("using_tiling", true)
        .eq("status", "processing");
      
      if (!tilingError && tilingJobs) {
        for (const tilingJob of tilingJobs) {
          if (tilingJob.tiles_data) {
            const tileIndex = tilingJob.tiles_data.findIndex(
              (t: TileData) => t.stage1_prediction_id === webhook.id || t.stage2_prediction_id === webhook.id
            );
            
            if (tileIndex !== -1) {
              console.log(`[upscale-webhook] Found tile ${tileIndex} in job ${tilingJob.id}`);
              job = tilingJob;
              jobError = null;
              break;
            }
          }
        }
      }
    }

    if (jobError || !job) {
      console.log(`[upscale-webhook] No job found for prediction ${webhook.id}`);
      return;
    }

    // 🔥 CRITICAL: Update last_webhook_at immediately so check-all can track this job
    await supabase
      .from("upscale_jobs")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[upscale-webhook] Found job ${job.id}, using_tiling: ${job.using_tiling}`);

    // Route to tile handler if this is a tiling job
    if (job.using_tiling) {
      await handleTileWebhook(webhook, job as UpscaleJob, supabase);
      return;
    }

    // Regular (non-tiling) job handling
    console.log(`[upscale-webhook] Processing regular job, stage: ${job.current_stage}/${job.total_stages}`);

    // Handle failed prediction
    if (webhook.status === "failed") {
      await handleFailedPrediction(supabase, job as UpscaleJob, webhook.error);
      return;
    }

    // Handle successful prediction
    if (webhook.status === "succeeded") {
      const outputUrl = Array.isArray(webhook.output) ? webhook.output[0] : webhook.output;
      
      if (!outputUrl) {
        console.error("[upscale-webhook] No output URL in webhook");
        await supabase
          .from("upscale_jobs")
          .update({
            status: "failed",
            error_message: "No output URL in webhook response",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        return;
      }

      console.log(`[upscale-webhook] Stage ${job.current_stage}/${job.total_stages} completed`);
      
      // Update current stage in strategy
      const strategy: ChainStrategy = job.chain_strategy;
      strategy.stages[job.current_stage - 1].output_url = outputUrl;
      strategy.stages[job.current_stage - 1].status = "completed";
      
      // Process stage transition
      if (job.current_stage >= job.total_stages) {
        // Final stage complete
        console.log(`[upscale-webhook] Finalizing job ${job.id}`);
        await finalizeJob(supabase, job as UpscaleJob, outputUrl, strategy);
      } else {
        // Continue to next stage
        console.log(`[upscale-webhook] Continuing to next stage for job ${job.id}`);
        await continueChain(supabase, job as UpscaleJob, outputUrl, strategy);
      }
    }

    console.log(`[upscale-webhook] Successfully processed webhook for prediction ${webhook.id}`);
  } catch (error) {
    console.error("[upscale-webhook] Error processing webhook:", error);
    // Log error to database
    await supabase.from("processed_webhooks").update({
      status: "error"
    }).eq("prediction_id", webhook.id);
  }
}

serve(async (req: Request) => {
  // Webhooks don't need CORS preflight, but handle it anyway
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let webhook: ReplicateWebhook;
  let rawBody: string;
  
  try {
    // 🔥 CRITICAL: Comprehensive logging for debugging webhook issues
    console.log(`[upscale-webhook] Received ${req.method} request`);
    console.log(`[upscale-webhook] User-Agent: ${req.headers.get('user-agent')}`);
    console.log(`[upscale-webhook] Content-Type: ${req.headers.get('content-type')}`);
    
    rawBody = await req.text();
    console.log(`[upscale-webhook] Raw body length: ${rawBody.length} bytes`);
    
    if (!rawBody || rawBody.length === 0) {
      console.error(`[upscale-webhook] Empty request body received`);
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    webhook = JSON.parse(rawBody);
    
    if (!webhook.id || !webhook.status) {
      console.error(`[upscale-webhook] Invalid webhook format:`, webhook);
      return new Response(
        JSON.stringify({ error: "Invalid webhook format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[upscale-webhook] ✅ Webhook parsed successfully - prediction: ${webhook.id}, status: ${webhook.status}`);
    
  } catch (parseError) {
    console.error(`[upscale-webhook] ❌ JSON parse error:`, parseError);
    console.error(`[upscale-webhook] Failed to parse body:`, rawBody?.substring(0, 500));
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 🔥 CRITICAL: Check for duplicate webhooks (idempotency)
  const { data: existingWebhook } = await supabase
    .from("processed_webhooks")
    .select("id")
    .eq("prediction_id", webhook.id)
    .single();

  if (existingWebhook) {
    console.log(`[upscale-webhook] Duplicate webhook ignored for prediction ${webhook.id}`);
    return new Response(
      JSON.stringify({ ok: true, message: "Already processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mark webhook as received immediately
  await supabase
    .from("processed_webhooks")
    .insert({
      prediction_id: webhook.id,
      status: "processing"
    });

  // 🔥 CRITICAL FIX: Process webhook synchronously to ensure database updates complete
  // EdgeRuntime.waitUntil() is unreliable - database updates were failing
  try {
    await processWebhookData(webhook, supabase);
    console.log(`[upscale-webhook] ✅ Successfully processed webhook for ${webhook.id}`);
  } catch (error) {
    console.error(`[upscale-webhook] ❌ Error processing webhook:`, error);
    // Still return 200 OK to Replicate to prevent retries
  }

  // Return success after processing completes
  return new Response(
    JSON.stringify({ ok: true, received: webhook.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

