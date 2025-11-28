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
  stage3_url?: string | null;
  stage3_prediction_id?: string | null;
  status: string;
  error: string | null;
  // Sub-tile fields for dynamic re-tiling between stages
  parent_tile_id?: number;      // Reference to original tile (if this is a sub-tile)
  sub_tile_index?: number;      // Position within parent (0, 1, 2, 3 for 2x2)
  sub_tile_grid?: { cols: number; rows: number };  // How the parent was split
  is_sub_tile?: boolean;        // True if this tile was created by re-tiling
  [key: string]: unknown;
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
  original_width: number | null;
  original_height: number | null;
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
      // Use SwinIR 4x for stage 1 only, Real-ESRGAN for all other stages (supports tiling)
      if (scale === 4) {
        console.log(`[selectModelFor] Art/Text at 4x → Using SwinIR 4x`);
        return {
          slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
          input: { 
            task: "Real-World Image Super-Resolution-Large"  // 4x
          },
        };
      } else {
        // Use Real-ESRGAN for 2x and 3x (supports tiling for large intermediate images)
        console.log(`[selectModelFor] Art/Text at ${scale}x → Using Real-ESRGAN (supports tiling)`);
        return {
          ...PHOTO_MODEL,
          input: { ...PHOTO_MODEL.input, face_enhance: false },
        };
      }
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
    // Reduced from 512 to 256 to prevent CUDA OOM errors on large intermediate images
    input.tile = 256;
    input.tile_pad = 16;
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
  console.log(`[Tile Webhook] 📥 ========== NEW WEBHOOK ==========`);
  console.log(`[Tile Webhook] 📥 Prediction: ${webhook.id}`);
  console.log(`[Tile Webhook] 📥 Job: ${job.id}`);
  console.log(`[Tile Webhook] 📥 Status: ${webhook.status}`);
  console.log(`[Tile Webhook] 📥 Current job stage: ${job.current_stage}/${job.total_stages}`);
  console.log(`[Tile Webhook] 📥 Job status: ${job.status}`);
  
  if (!job.tiles_data || !job.tile_grid) {
    console.error(`[Tile Webhook] ❌ Job ${job.id} missing tile data`);
    return;
  }
  
  console.log(`[Tile Webhook] 📊 Total tiles: ${job.tiles_data.length} (grid: ${job.tile_grid.tilesX}×${job.tile_grid.tilesY})`);
  console.log(`[Tile Webhook] 🔍 Searching for prediction ${webhook.id} in ${job.tiles_data.length} tiles...`);
  
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
    console.error(`[Tile Webhook] ❌ ========== PREDICTION NOT FOUND ==========`);
    console.error(`[Tile Webhook] ❌ Prediction ${webhook.id} not found in job ${job.id} tiles`);
    console.error(`[Tile Webhook] ❌ Available tile prediction IDs:`);
    for (let i = 0; i < job.tiles_data.length; i++) {
      const t = job.tiles_data[i];
      console.error(`[Tile Webhook]   - Tile ${t.tile_id}: stage1=${t.stage1_prediction_id}, stage2=${t.stage2_prediction_id}, stage3=${(t as any).stage3_prediction_id}, status=${t.status}`);
    }
    console.error(`[Tile Webhook] ❌ ==========================================`);
    return;
  }
  
  console.log(`[Tile Webhook] ✅ Found matching tile at index ${tileIndex}, tile_id: ${job.tiles_data[tileIndex].tile_id}, stage: ${detectedStage}`);

  
  const tile = job.tiles_data[tileIndex];
  const isStage1 = detectedStage === 1;
  const currentStage = detectedStage;
  
  console.log(`[Tile Webhook] Tile ${tile.tile_id} stage ${currentStage} status: ${webhook.status}`);
  
  // Handle tile failure
  if (webhook.status === "failed") {
    // Use atomic RPC update to prevent race conditions
    console.log(`[Tile Webhook] ⚠️ Tile ${tile.tile_id} failed, using atomic update...`);
    await supabase.rpc('update_tile_data', {
      p_job_id: job.id,
      p_tile_id: tile.tile_id,
      p_status: 'failed'
    });
    
    console.error(`[Tile Webhook] Tile ${tile.tile_id} stage ${currentStage} failed: ${webhook.error}`);
    
    // Refetch to check failed count with fresh data
    const { data: refreshedForFail } = await supabase
      .from("upscale_jobs")
      .select("tiles_data")
      .eq("id", job.id)
      .single();
    
    if (refreshedForFail) {
      const failedCount = refreshedForFail.tiles_data.filter((t: TileData) => t.status === "failed").length;
      if (failedCount > refreshedForFail.tiles_data.length / 2) {
        await supabase
          .from("upscale_jobs")
          .update({
            status: "failed",
            error_message: `Too many tiles failed: ${failedCount}/${refreshedForFail.tiles_data.length}`,
            completed_at: new Date().toISOString()
          })
          .eq("id", job.id);
      }
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
    
    // 🔥 ATOMIC: Update tile AND check if all tiles completed in ONE transaction
    // This prevents race conditions where separate update/check calls see inconsistent data
    const newStatus = `stage${currentStage}_complete`;
    console.log(`[Tile Webhook] 🔄 Atomic update+check for tile ${tile.tile_id} -> ${newStatus}`);
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_tile_and_check_stage', {
      p_job_id: job.id,
      p_tile_id: tile.tile_id,
      p_status: newStatus,
      p_stage_url: outputUrl,
      p_stage: currentStage
    });
    
    if (rpcError) {
      console.error(`[Tile Webhook] ❌ Atomic RPC failed for tile ${tile.tile_id}:`, rpcError);
      // Fallback to direct update if RPC fails
      if (currentStage === 1) {
        tile.stage1_url = outputUrl;
      } else if (currentStage === 2) {
        tile.stage2_url = outputUrl;
      } else if (currentStage === 3) {
        (tile as any).stage3_url = outputUrl;
      }
      tile.status = newStatus;
      await supabase
        .from("upscale_jobs")
        .update({ tiles_data: job.tiles_data })
        .eq("id", job.id);
      return;
    }
    
    if (!rpcResult || rpcResult.length === 0) {
      console.error(`[Tile Webhook] ❌ No result from atomic RPC`);
      return;
    }
    
    const result = rpcResult[0];
    console.log(`[Tile Webhook] 📊 Tile ${tile.tile_id} stage ${currentStage} complete`);
    console.log(`[Tile Webhook] 📊 All tiles complete: ${result.all_complete}`);
    
    // Build refreshedJob from RPC result
    // Note: RPC returns job_* prefixed columns to avoid SQL ambiguity
    const refreshedJob: UpscaleJob = {
      ...job,
      tiles_data: result.job_tiles_data,
      total_stages: result.job_total_stages,
      current_stage: result.job_current_stage,
      chain_strategy: result.job_chain_strategy,
      content_type: result.job_content_type,
      using_tiling: result.job_using_tiling,
      tile_grid: result.job_tile_grid
    };
    
    // Log tile statuses for debugging
    const targetStatus = `stage${currentStage}_complete`;
    const completedTiles = refreshedJob.tiles_data.filter((t: TileData) => t.status === targetStatus);
    const failedTiles = refreshedJob.tiles_data.filter((t: TileData) => t.status === "failed");
    const effectiveTotal = refreshedJob.tiles_data.length - failedTiles.length;
    
    console.log(`[Tile Webhook] 📊 ========== STAGE PROGRESS ==========`);
    console.log(`[Tile Webhook] 📊 Target status: ${targetStatus}`);
    console.log(`[Tile Webhook] 📊 Completed tiles: ${completedTiles.length}/${effectiveTotal} (${failedTiles.length} failed)`);
    console.log(`[Tile Webhook] 📊 Progress: ${Math.round((completedTiles.length / effectiveTotal) * 100)}%`);
    console.log(`[Tile Webhook] 📊 Tile statuses:`);
    for (let i = 0; i < refreshedJob.tiles_data.length; i++) {
      const t = refreshedJob.tiles_data[i];
      console.log(`[Tile Webhook] 📊   - Tile ${t.tile_id}: ${t.status}`);
    }
    console.log(`[Tile Webhook] 📊 ====================================`);
    
    // Check if all tiles completed (from the atomic RPC result)
    if (result.all_complete) {
      const currentJobStage = detectedStage;
      const isLastStage = currentJobStage >= refreshedJob.total_stages;
      const strategy = refreshedJob.chain_strategy;
      if (strategy?.stages?.[currentJobStage - 1]) {
        strategy.stages[currentJobStage - 1].status = "completed";
        console.log(`[Tile Webhook] 📈 Marked chain stage ${currentJobStage} as completed`);
      }
      
      console.log(`[Tile Webhook] 🎯 ========== ALL TILES COMPLETE ==========`);
      console.log(`[Tile Webhook] 🎯 Stage ${currentJobStage}/${refreshedJob.total_stages} complete for all tiles`);
      console.log(`[Tile Webhook] 🎯 Is last stage: ${isLastStage}`);
      console.log(`[Tile Webhook] 🎯 ============================================`);
      
      if (!isLastStage) {
        // More stages remain - check template for split requirement
        const nextStage = currentJobStage + 1;
        console.log(`[Tile Webhook] 🔍 Checking template for stage ${nextStage} split requirement...`);
        
        // Check if template specifies splitting for next stage
        // The template's stageConfig has splitFromPrevious > 1 if splitting is needed
        const templateConfig = refreshedJob.template_config;
        const nextStageConfig = templateConfig?.stages?.[nextStage - 1];
        let splitFromPrevious = nextStageConfig?.splitFromPrevious || 1;
        
        console.log(`[Tile Webhook] Template config:`, templateConfig);
        console.log(`[Tile Webhook] Template config for stage ${nextStage}:`, nextStageConfig);
        console.log(`[Tile Webhook] Split factor from template: ${splitFromPrevious}`);
        
        // FALLBACK: If template_config is missing, check actual tile sizes
        if (!templateConfig || !nextStageConfig) {
          console.log(`[Tile Webhook] ⚠️ Template config missing, checking tile sizes as fallback...`);
          const tilesData = refreshedJob.tiles_data || [];
          const GPU_MAX_PIXELS = 2000000;
          let needsSplit = false;
          
          for (const tile of tilesData) {
            // Get output URL from completed stage
            const stageUrl = currentJobStage === 1 
              ? tile.stage1_url 
              : currentJobStage === 2 
                ? tile.stage2_url 
                : (tile as any)[`stage${currentJobStage}_url`];
            
            if (!stageUrl) continue;
            
            // Estimate size: tile dimensions * cumulative scale
            const cumulativeScale = Math.pow(4, currentJobStage); // Assuming 4x per stage
            const estimatedWidth = (tile.width || 0) * cumulativeScale;
            const estimatedHeight = (tile.height || 0) * cumulativeScale;
            const estimatedPixels = estimatedWidth * estimatedHeight;
            
            if (estimatedPixels > GPU_MAX_PIXELS) {
              needsSplit = true;
              break;
            }
          }
          
          if (needsSplit) {
            splitFromPrevious = 4; // Default to 2x2 split
            console.log(`[Tile Webhook] 🔄 Fallback: Tiles exceed GPU limit, using split factor 4`);
          }
        }
        
        if (splitFromPrevious > 1) {
          // Template requires splitting - pause for client-side splitting
          const tilesData = refreshedJob.tiles_data || [];
          const expectedNewTiles = tilesData.length * splitFromPrevious;
          
          console.log(`[Tile Webhook] 🔄 Template requires ${splitFromPrevious}x split`);
          console.log(`[Tile Webhook] Current tiles: ${tilesData.length} → Expected after split: ${expectedNewTiles}`);
          console.log(`[Tile Webhook] Setting status to 'needs_split' for client-side tile splitting`);
          
          await supabase
            .from("upscale_jobs")
            .update({ 
              status: "needs_split",
              current_stage: currentJobStage, // Stay on current stage (completed)
              chain_strategy: strategy,
              split_info: {
                completedStage: currentJobStage,
                nextStage: nextStage,
                splitFactor: splitFromPrevious,
                currentTileCount: tilesData.length,
                expectedTileCount: expectedNewTiles
              },
              last_webhook_at: new Date().toISOString()
            })
            .eq("id", refreshedJob.id);
          
          console.log(`[Tile Webhook] ✅ Job ${refreshedJob.id} paused for client-side splitting`);
        } else {
          // No split needed - proceed to next stage directly
          console.log(`[Tile Webhook] ✅ No split needed (splitFromPrevious = 1), launching stage ${nextStage}...`);
          
          // Update current_stage in the database BEFORE launching
          await supabase
            .from("upscale_jobs")
            .update({ 
              current_stage: nextStage,
              chain_strategy: strategy,
              last_webhook_at: new Date().toISOString()
            })
            .eq("id", refreshedJob.id);
          
          console.log(`[Tile Webhook] 📈 Updated job current_stage to ${nextStage}`);
          
          // Now launch all tiles for the next stage
          refreshedJob.current_stage = nextStage;
          await launchTileStage(refreshedJob, nextStage, supabase);
        }
      } else {
        // This is the final stage - mark as tiles_ready for client-side stitching
        console.log(`[Tile Webhook] 🎯 ALL STAGES COMPLETE! Attempting status update: processing → tiles_ready...`);
        
        // 🔥 IDEMPOTENT UPDATE: Only update if status is still "processing"
        const { data: updated, error: updateError } = await supabase
          .from("upscale_jobs")
          .update({
            status: "tiles_ready",
            last_webhook_at: new Date().toISOString(),
            chain_strategy: refreshedJob.chain_strategy
          })
          .eq("id", refreshedJob.id)
          .eq("status", "processing")
          .select();
        
        if (updateError) {
          console.error(`[Tile Webhook] ❌ FAILED to update job status:`, updateError);
        } else if (!updated || updated.length === 0) {
          console.log(`[Tile Webhook] ℹ️ Status already updated by another webhook (no rows affected)`);
        } else {
          console.log(`[Tile Webhook] ✅ Job ${refreshedJob.id} marked as tiles_ready! Rows updated: ${updated.length}`);
        }
      }
    } else {
      console.log(`[Tile Webhook] ⏳ Waiting for ${effectiveTotal - completedTiles.length} more tiles to complete stage ${currentStage}`);
    }
  }
}

/**
 * Launch a single tile with retry logic for rate limits
 */
async function launchTileWithRetry(
  replicateToken: string,
  version: string,
  input: Record<string, unknown>,
  webhookUrl: string,
  tileNum: number,
  maxRetries: number = 5
): Promise<{ success: boolean; predictionId?: string; error?: any }> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      console.log(`[Launch Retry] Tile ${tileNum}: Attempt ${attempt + 1}/${maxRetries}`);
      
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
      
      if (predictionRes.ok) {
        const prediction = await predictionRes.json();
        console.log(`[Launch Retry] ✅ Tile ${tileNum} launched: ${prediction.id}`);
        return { success: true, predictionId: prediction.id };
      }
      
      // Handle rate limiting (429)
      if (predictionRes.status === 429) {
        const errorBody = await predictionRes.json().catch(() => ({}));
        const retryAfter = errorBody.retry_after || 5;
        
        console.log(`[Launch Retry] ⏳ Tile ${tileNum} rate limited (attempt ${attempt + 1}/${maxRetries}). Waiting ${retryAfter}s before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempt++;
        continue;
      }
      
      // Other error
      const errText = await predictionRes.text();
      console.error(`[Launch Retry] ❌ Tile ${tileNum} failed (status ${predictionRes.status}):`, errText);
      return { success: false, error: errText };
      
    } catch (error: any) {
      console.error(`[Launch Retry] ❌ Tile ${tileNum} exception:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }
  
  console.error(`[Launch Retry] ❌ Tile ${tileNum} failed after ${maxRetries} retries`);
  return { success: false, error: 'Max retries exceeded' };
}

// GPU memory limit for Replicate models (in pixels)
// Max ~2,096,704 pixels (~1448x1448) - use 2M with safety margin
const GPU_MAX_PIXELS = 2000000;

/**
 * Calculate how many splits are needed to keep tile under GPU limit
 */
function calculateSplitFactor(width: number, height: number): { cols: number; rows: number } {
  const pixels = width * height;
  if (pixels <= GPU_MAX_PIXELS) {
    return { cols: 1, rows: 1 }; // No split needed
  }
  
  // Calculate minimum splits needed, preferring square-ish splits
  let cols = 1;
  let rows = 1;
  while ((width / cols) * (height / rows) > GPU_MAX_PIXELS) {
    // Split the larger dimension first
    if (width / cols >= height / rows) {
      cols++;
    } else {
      rows++;
    }
  }
  
  return { cols, rows };
}

/**
 * Re-tile large tiles before a stage to stay under GPU memory limits
 * Downloads each tile, splits it into sub-tiles, uploads them, and updates tiles_data
 */
async function reTileForStage(
  job: UpscaleJob,
  stageNumber: number,
  supabase: any
): Promise<UpscaleJob> {
  console.log(`[Re-tile] ========== CHECKING RE-TILE FOR STAGE ${stageNumber} ==========`);
  
  if (!job.tiles_data) {
    console.log(`[Re-tile] No tiles_data, skipping`);
    return job;
  }
  
  const previousStage = stageNumber - 1;
  const urlKey = previousStage === 1 ? 'stage1_url' : previousStage === 2 ? 'stage2_url' : `stage${previousStage}_url`;
  
  // Check which tiles need splitting
  const tilesToSplit: { tile: TileData; splitFactor: { cols: number; rows: number } }[] = [];
  
  for (const tile of job.tiles_data) {
    if (tile.status === 'failed') continue;
    
    const tileUrl = tile[urlKey] as string | null;
    if (!tileUrl) continue;
    
    // Estimate tile dimensions after previous stage
    // Stage 1 output = original tile * stage1_scale (typically 4x)
    // Stage 2 output = stage1 output * stage2_scale (typically 4x)
    const stageScales = job.chain_strategy?.stages?.map(s => s.scale) || [4, 4, 2];
    let estimatedWidth = tile.width;
    let estimatedHeight = tile.height;
    
    for (let s = 0; s < previousStage; s++) {
      estimatedWidth *= stageScales[s] || 4;
      estimatedHeight *= stageScales[s] || 4;
    }
    
    console.log(`[Re-tile] Tile ${tile.tile_id}: estimated ${estimatedWidth}×${estimatedHeight} = ${estimatedWidth * estimatedHeight} pixels`);
    
    const splitFactor = calculateSplitFactor(estimatedWidth, estimatedHeight);
    if (splitFactor.cols > 1 || splitFactor.rows > 1) {
      console.log(`[Re-tile] 🔄 Tile ${tile.tile_id} needs ${splitFactor.cols}×${splitFactor.rows} split`);
      tilesToSplit.push({ tile, splitFactor });
    }
  }
  
  if (tilesToSplit.length === 0) {
    console.log(`[Re-tile] ✅ No tiles need splitting`);
    return job;
  }
  
  console.log(`[Re-tile] 🔄 ${tilesToSplit.length} tiles need splitting`);
  
  // Import image processing library
  const { decode, Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");
  
  const newTilesData: TileData[] = [];
  let nextTileId = Math.max(...job.tiles_data.map(t => t.tile_id)) + 1;
  
  for (const originalTile of job.tiles_data) {
    const splitInfo = tilesToSplit.find(t => t.tile.tile_id === originalTile.tile_id);
    
    if (!splitInfo || originalTile.status === 'failed') {
      // Keep original tile as-is
      newTilesData.push(originalTile);
      continue;
    }
    
    const { tile, splitFactor } = splitInfo;
    const tileUrl = tile[urlKey] as string;
    
    console.log(`[Re-tile] Downloading tile ${tile.tile_id} from ${tileUrl.substring(0, 60)}...`);
    
    try {
      // Download the tile image
      const response = await fetch(tileUrl);
      if (!response.ok) {
        console.error(`[Re-tile] Failed to download tile ${tile.tile_id}: ${response.status}`);
        newTilesData.push(originalTile);
        continue;
      }
      
      const buffer = await response.arrayBuffer();
      const tileImage = await decode(new Uint8Array(buffer));
      const actualWidth = tileImage.width;
      const actualHeight = tileImage.height;
      
      console.log(`[Re-tile] Tile ${tile.tile_id} actual size: ${actualWidth}×${actualHeight}`);
      
      // Recalculate split factor with actual dimensions
      const actualSplitFactor = calculateSplitFactor(actualWidth, actualHeight);
      const { cols, rows } = actualSplitFactor;
      
      if (cols === 1 && rows === 1) {
        console.log(`[Re-tile] Tile ${tile.tile_id} doesn't need splitting after all`);
        newTilesData.push(originalTile);
        continue;
      }
      
      console.log(`[Re-tile] Splitting tile ${tile.tile_id} into ${cols}×${rows} = ${cols * rows} sub-tiles`);
      
      const subTileWidth = Math.ceil(actualWidth / cols);
      const subTileHeight = Math.ceil(actualHeight / rows);
      
      // Calculate overlap for sub-tiles (use 32px scaled by stage)
      const overlap = 32;
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const subTileIndex = row * cols + col;
          const subTileId = nextTileId++;
          
          // Calculate sub-tile bounds with overlap
          const x = Math.max(0, col * subTileWidth - (col > 0 ? overlap : 0));
          const y = Math.max(0, row * subTileHeight - (row > 0 ? overlap : 0));
          const w = Math.min(subTileWidth + (col > 0 ? overlap : 0) + (col < cols - 1 ? overlap : 0), actualWidth - x);
          const h = Math.min(subTileHeight + (row > 0 ? overlap : 0) + (row < rows - 1 ? overlap : 0), actualHeight - y);
          
          console.log(`[Re-tile] Creating sub-tile ${subTileId} at (${x},${y}) size ${w}×${h}`);
          
          // Extract sub-tile
          const subImage = tileImage.clone().crop(x, y, w, h);
          const subBuffer = await subImage.encode();
          
          // Upload sub-tile
          const fileName = `tile_${job.id}_subtile_${subTileId}_stage${previousStage}.png`;
          const { error: uploadError } = await supabase.storage.from("images").upload(
            `temp/${fileName}`,
            subBuffer,
            { contentType: "image/png", upsert: true }
          );
          
          if (uploadError) {
            console.error(`[Re-tile] Failed to upload sub-tile ${subTileId}:`, uploadError);
            continue;
          }
          
          const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${fileName}`);
          const subTileUrl = urlData.publicUrl;
          
          // Create new tile entry
          const newTile: TileData = {
            tile_id: subTileId,
            // Position relative to the ORIGINAL image (parent tile position + sub-tile offset within parent)
            x: tile.x + Math.round(x / (actualWidth / tile.width)),
            y: tile.y + Math.round(y / (actualHeight / tile.height)),
            width: Math.round(w / (actualWidth / tile.width)),
            height: Math.round(h / (actualHeight / tile.height)),
            input_url: tile.input_url,
            stage1_url: tile.stage1_url,
            stage2_url: previousStage >= 2 ? subTileUrl : tile.stage2_url,
            stage1_prediction_id: tile.stage1_prediction_id,
            stage2_prediction_id: tile.stage2_prediction_id,
            status: `stage${previousStage}_complete`,
            error: null,
            // Sub-tile metadata
            parent_tile_id: tile.tile_id,
            sub_tile_index: subTileIndex,
            sub_tile_grid: { cols, rows },
            is_sub_tile: true,
            // Copy forward any stage URLs
            [`stage${previousStage}_url`]: subTileUrl,
          };
          
          newTilesData.push(newTile);
          console.log(`[Re-tile] ✅ Sub-tile ${subTileId} created and uploaded`);
        }
      }
      
      console.log(`[Re-tile] ✅ Tile ${tile.tile_id} split into ${cols * rows} sub-tiles`);
      
    } catch (error) {
      console.error(`[Re-tile] Error processing tile ${tile.tile_id}:`, error);
      newTilesData.push(originalTile);
    }
  }
  
  console.log(`[Re-tile] ========== RE-TILE COMPLETE ==========`);
  console.log(`[Re-tile] Original tiles: ${job.tiles_data.length}`);
  console.log(`[Re-tile] New tiles: ${newTilesData.length}`);
  
  // Update job with new tiles_data
  const updatedJob = {
    ...job,
    tiles_data: newTilesData,
    tile_grid: {
      ...job.tile_grid!,
      totalTiles: newTilesData.length,
    }
  };
  
  // Save to database
  await supabase
    .from("upscale_jobs")
    .update({
      tiles_data: newTilesData,
      tile_grid: updatedJob.tile_grid
    })
    .eq("id", job.id);
  
  return updatedJob;
}

/**
 * Launch all tiles for a specific stage
 */
async function launchTileStage(job: UpscaleJob, stageNumber: number, supabase: any) {
  console.log(`[Launch Stage] ========== LAUNCHING STAGE ${stageNumber} ==========`);
  console.log(`[Launch Stage] Job: ${job.id}`);
  console.log(`[Launch Stage] Total tiles: ${job.tiles_data?.length}`);
  console.log(`[Launch Stage] Stage: ${stageNumber}/${job.total_stages}`);
  
  const stageIndex = stageNumber - 1;
  if (job.chain_strategy?.stages?.[stageIndex]) {
    job.chain_strategy.stages[stageIndex].status = "processing";
    job.chain_strategy.stages[stageIndex].prediction_id = job.using_tiling
      ? `tiling:${stageNumber}`
      : stageNumber === 1
        ? job.prediction_id
        : null;
    console.log(`[Launch Stage] Marked chain stage ${stageNumber} as processing`);
  }
  
  if (!job.tiles_data || !job.chain_strategy) {
    console.error(`[Launch Stage] ❌ Missing tiles_data or chain_strategy`);
    return;
  }
  
  const stage = job.chain_strategy.stages[stageNumber - 1];
  let model = selectModelFor(job.content_type, stage.scale);
  
  // CRITICAL FIX: For art/text tiling jobs, stages 2+ must use Real-ESRGAN
  // SwinIR cannot handle large intermediate images (4336x4336+) even with A100 80GB GPU
  if (job.using_tiling && stageNumber > 1 && (job.content_type === 'art' || job.content_type === 'text')) {
    console.log(`[Launch Stage] ⚠️ Stage ${stageNumber}: Forcing Real-ESRGAN for art/text tiling (SwinIR cannot handle large intermediate images)`);
    model = {
      slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
      input: { face_enhance: false }
    };
  }
  
  const version = getModelVersion(model.slug);
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
  
  console.log(`[Launch Stage] Model: ${model.slug}`);
  console.log(`[Launch Stage] Scale: ${stage.scale}x`);
  console.log(`[Launch Stage] Webhook URL: ${webhookUrl}`);
  
  let launchedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const launchResults = [];
  
  for (let i = 0; i < job.tiles_data.length; i++) {
    const tile = job.tiles_data[i];
    
    // Skip failed tiles only - all other tiles MUST be launched
    // (We only call launchTileStage when ALL tiles have completed the previous stage)
    if (tile.status === "failed") {
      console.log(`[Launch Stage] ⏭️ Skipping tile ${tile.tile_id} (status: failed)`);
      skippedCount++;
      continue;
    }
    
    // Verify tile has completed the previous stage (safety check)
    const expectedPreviousStatus = stageNumber === 1 ? null : `stage${stageNumber - 1}_complete`;
    if (stageNumber > 1 && tile.status !== expectedPreviousStatus) {
      console.error(`[Launch Stage] ⚠️ Tile ${tile.tile_id} has unexpected status: ${tile.status} (expected: ${expectedPreviousStatus})`);
      // Still launch it - the "all tiles complete" check should have verified this
    }
    
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
      console.error(`[Launch Stage] ❌ Tile ${tile.tile_id} missing input for stage ${stageNumber} (previous stage URL not found)`);
      failedCount++;
      launchResults.push({ tileNum: tile.tile_id, success: false, error: 'Missing input URL' });
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

    const isRealESRGAN = model.slug.includes('real-esrgan');
    if (isRealESRGAN && stageNumber > 1) {
      // Reduced from 512 to 256 to prevent CUDA OOM errors on large intermediate images
      input.tile = 256;
      input.tile_pad = 16;
      console.log(`[Launch Stage] Adding tile parameters (256x256) for tile ${tile.tile_id} stage ${stageNumber}`);
    }
    
    console.log(`[Launch Stage] 🚀 Launching tile ${tile.tile_id} stage ${stageNumber}...`);
    console.log(`[Launch Stage]    - Input URL: ${inputUrl.substring(0, 80)}...`);
    console.log(`[Launch Stage]    - Model: ${model.slug.split('/')[1]}`);
    
    // Launch with retry logic
    const result = await launchTileWithRetry(
      replicateToken!,
      version,
      input,
      webhookUrl,
      tile.tile_id,
      5 // max 5 retries
    );
    
    if (result.success && result.predictionId) {
      // Use atomic RPC to set tile to processing status
      // This prevents race conditions if multiple launches happen simultaneously
      console.log(`[Launch Stage] 🔄 Atomic update: tile ${tile.tile_id} -> stage${stageNumber}_processing`);
      
      const { error: rpcError } = await supabase.rpc('set_tile_processing', {
        p_job_id: job.id,
        p_tile_id: tile.tile_id,
        p_stage: stageNumber,
        p_prediction_id: result.predictionId
      });
      
      if (rpcError) {
        console.warn(`[Launch Stage] ⚠️ RPC failed:`, rpcError);
      }
      
      // 🔥 CRITICAL FIX: ALWAYS update local tile object so bulk update at end has correct data
      // Previously this was only done in the RPC error fallback, causing prediction IDs to be lost
      if (stageNumber === 1) {
        tile.stage1_prediction_id = result.predictionId;
        tile.status = "stage1_processing";
      } else if (stageNumber === 2) {
        tile.stage2_prediction_id = result.predictionId;
        tile.status = "stage2_processing";
      } else if (stageNumber === 3) {
        (tile as any).stage3_prediction_id = result.predictionId;
        tile.status = "stage3_processing";
      } else if (stageNumber > 3) {
        (tile as any)[`stage${stageNumber}_prediction_id`] = result.predictionId;
        tile.status = `stage${stageNumber}_processing`;
      }
      
      console.log(`[Launch Stage] ✅ Tile ${tile.tile_id} stage ${stageNumber} launched successfully`);
      console.log(`[Launch Stage]    - Prediction ID: ${result.predictionId}`);
      if (stageNumber === 3) {
        console.log(`[Launch Stage] 🎯 Stage 3 tracking -> tile ${tile.tile_id} prediction ${result.predictionId}`);
      }
      launchedCount++;
      launchResults.push({ tileNum: tile.tile_id, success: true, predictionId: result.predictionId });
    } else {
      console.error(`[Launch Stage] ❌ Tile ${tile.tile_id} failed to launch after retries:`, result.error);
      failedCount++;
      launchResults.push({ tileNum: tile.tile_id, success: false, error: result.error });
    }
    
    // Add small delay between launches to avoid burst limit (except for last tile)
    if (i < job.tiles_data.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms stagger
    }
  }
  
  // Check results and report
  const successfulTiles = launchResults.filter(r => r.success);
  const failedTiles = launchResults.filter(r => !r.success);
  
  console.log(`[Launch Stage] ========== STAGE ${stageNumber} LAUNCH SUMMARY ==========`);
  console.log(`[Launch Stage] ✅ Launched: ${launchedCount}`);
  console.log(`[Launch Stage] ⏭️ Skipped: ${skippedCount}`);
  console.log(`[Launch Stage] ❌ Failed: ${failedCount}`);
  console.log(`[Launch Stage] 📊 Total: ${job.tiles_data.length}`);
  console.log(`[Launch Stage] Success rate: ${successfulTiles.length}/${launchResults.length}`);
  
  if (failedTiles.length > 0) {
    console.error(`[Launch Stage] ❌ Failed to launch ${failedTiles.length} tiles:`, failedTiles);
    
    // If more than half the tiles failed, mark job as failed
    if (failedTiles.length > job.tiles_data.length / 2) {
      await supabase
        .from("upscale_jobs")
        .update({
          status: "failed",
          error_message: `Failed to launch ${failedTiles.length}/${job.tiles_data.length} tiles for stage ${stageNumber} after retries`,
          tiles_data: job.tiles_data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      
      console.error(`[Launch Stage] ❌ Job ${job.id} marked as failed (too many tile launch failures)`);
      console.log(`[Launch Stage] ================================================`);
      return;
    }
  }
  
  console.log(`[Launch Stage] 🚀 All tiles launched successfully for stage ${stageNumber}!`);
  console.log(`[Launch Stage] ================================================`);
  
  // Update job with new prediction IDs
  await supabase
    .from("upscale_jobs")
    .update({ 
      tiles_data: job.tiles_data,
      current_stage: stageNumber,
      chain_strategy: job.chain_strategy
    })
    .eq("id", job.id);
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
  
  // Count sub-tiles vs original tiles
  const subTiles = job.tiles_data.filter((t: TileData) => t.is_sub_tile);
  const originalTiles = job.tiles_data.filter((t: TileData) => !t.is_sub_tile);
  console.log(`[Stitch] Total tiles: ${job.tiles_data.length} (${originalTiles.length} original, ${subTiles.length} sub-tiles from re-tiling)`);
  
  try {
    // Import Image for stitching
    const { decode, Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");
    
    // Calculate final dimensions from ORIGINAL tiles only (sub-tiles have relative positions)
    // For sub-tiles, we need to use the original image dimensions
    const computedOriginalWidth = job.tiles_data.reduce((max: number, tile: any) => {
      // Skip sub-tiles for dimension calculation - they're contained within parent tiles
      if (tile.is_sub_tile) return max;
      return Math.max(max, (tile.x ?? 0) + (tile.width ?? 0));
    }, 0);
    const computedOriginalHeight = job.tiles_data.reduce((max: number, tile: any) => {
      if (tile.is_sub_tile) return max;
      return Math.max(max, (tile.y ?? 0) + (tile.height ?? 0));
    }, 0);
    const baseOriginalWidth = job.original_width ?? computedOriginalWidth;
    const baseOriginalHeight = job.original_height ?? computedOriginalHeight;
    console.log(`[Stitch] Original size reference: ${baseOriginalWidth}×${baseOriginalHeight} (computed ${computedOriginalWidth}×${computedOriginalHeight})`);
    const outputWidth = Math.max(1, Math.round(baseOriginalWidth * job.target_scale));
    const outputHeight = Math.max(1, Math.round(baseOriginalHeight * job.target_scale));
    
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
      
      const isSubTile = (tile as TileData).is_sub_tile;
      console.log(`[Stitch] Downloading tile ${tile.tile_id}${isSubTile ? ` (sub-tile of ${(tile as TileData).parent_tile_id})` : ''}...`);
      
      const response = await fetch(tileUrl);
      const buffer = await response.arrayBuffer();
      const tileImage = await decode(new Uint8Array(buffer));
      
      if (!output) {
        // First tile - create canvas
        output = new Image(outputWidth, outputHeight);
        output.fill(0xFFFFFFFF);
      }
      
      // Composite tile - position is already in original image coordinates
      const x = tile.x * job.target_scale;
      const y = tile.y * job.target_scale;
      
      console.log(`[Stitch] Compositing tile ${tile.tile_id} at (${x},${y})${isSubTile ? ' [sub-tile]' : ''}`);
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
        outerLoop: for (const tilingJob of tilingJobs) {
          if (!tilingJob.tiles_data) continue;
          const totalStages = tilingJob.total_stages ?? 1;

          for (let i = 0; i < tilingJob.tiles_data.length; i++) {
            const tile = tilingJob.tiles_data[i] as TileData;
            let matchedStage = 0;

            if (tile.stage1_prediction_id === webhook.id) {
              matchedStage = 1;
            } else if (tile.stage2_prediction_id === webhook.id) {
              matchedStage = 2;
            } else {
              for (let stage = 3; stage <= totalStages; stage++) {
                const predictionKey = `stage${stage}_prediction_id`;
                if ((tile as any)[predictionKey] === webhook.id) {
                  matchedStage = stage;
                  break;
                }
              }
            }

            if (matchedStage > 0) {
              const tileId = typeof tile.tile_id === "number" ? tile.tile_id : i;
              console.log(`[upscale-webhook] Found tile ${tileId} stage ${matchedStage} in job ${tilingJob.id}`);
              job = tilingJob;
              jobError = null;
              break outerLoop;
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
  console.log("🔵🔵🔵 WEBHOOK VERSION: 2024-12-04-NO-AUTO-ADVANCE-v3 🔵🔵🔵");
  
  // Health check endpoint (GET request)
  if (req.method === "GET") {
    console.log(`[upscale-webhook] Health check received`);
    return new Response(
      JSON.stringify({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        version: "2024-11-25-ATOMIC-v1"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

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

