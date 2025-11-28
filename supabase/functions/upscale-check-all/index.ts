/*
  # Upscale Check All Edge Function
  
  Actively polls Replicate for ALL processing jobs to handle webhook failures.
  This runs independently to catch stuck jobs where webhooks didn't arrive.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Helper function to directly update tile status in the database
async function updateTileStatusDirectly(
  supabase: any,
  jobId: string,
  tileId: number,
  stage: number,
  prediction: any
) {
  console.log(`[Check-All] 🔧 Directly updating tile ${tileId} stage ${stage} to complete`);
  
  // Fetch current job data
  const { data: job, error: fetchError } = await supabase
    .from("upscale_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  
  if (fetchError || !job) {
    console.error(`[Check-All] ❌ Failed to fetch job ${jobId}:`, fetchError);
    return false;
  }
  
  const tilesData = [...job.tiles_data];
  const tile = tilesData.find((t: any) => t.tile_id === tileId);
  
  if (!tile) {
    console.error(`[Check-All] ❌ Tile ${tileId} not found in job ${jobId}`);
    return false;
  }
  
  // Check if tile is already in the target complete status or beyond
  const targetStatus = stage < job.total_stages 
    ? `stage${stage + 1}_processing`
    : `stage${stage}_complete`;
  
  // Check if already at target or completed a later stage
  for (let s = stage; s <= job.total_stages; s++) {
    if (tile.status === `stage${s}_complete` || (s > stage && tile.status === `stage${s}_processing`)) {
      console.log(`[Check-All] ℹ️ Tile ${tileId} already at status ${tile.status}, skipping`);
      return false; // Already processed
    }
  }
  
  // Update tile based on stage dynamically
  if (prediction.status === "succeeded") {
    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    
    // Store output URL
    if (stage === 1) {
      tile.stage1_url = outputUrl;
    } else if (stage === 2) {
      tile.stage2_url = outputUrl;
    } else {
      tile[`stage${stage}_url`] = outputUrl;
    }
    
    // Set status
    if (stage < job.total_stages) {
      tile.status = `stage${stage + 1}_processing`;
    } else {
      tile.status = `stage${stage}_complete`;
    }
  } else {
    tile.status = `stage${stage}_failed`;
    tile.error = prediction.error || `Stage ${stage} failed`;
  }
  
  // Update job in database
  const { error: updateError } = await supabase
    .from("upscale_jobs")
    .update({
      tiles_data: tilesData,
      last_webhook_at: new Date().toISOString()
    })
    .eq("id", jobId);
  
  if (updateError) {
    console.error(`[Check-All] ❌ Failed to update job ${jobId}:`, updateError);
    return false;
  }
  
  console.log(`[Check-All] ✅ Successfully updated tile ${tileId} stage ${stage} to ${tile.status}`);
  return true;
}

// Helper function to get model version from slug
function getModelVersion(slug: string): string {
  return slug.split(":")[1];
}

// Helper function to select the right model for content type and scale
function selectModelFor(contentType: string, scale: number): { slug: string; input: Record<string, unknown> } {
  const PHOTO_MODEL = {
    slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
    input: { 
      face_enhance: scale <= 4,
      tile: 256,
      tile_pad: 16
    },
  };

  const ART_TEXT_MODEL = {
    slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
    input: { task: scale >= 4 ? "Real-World Image Super-Resolution-Large" : "Real-World Image Super-Resolution-Medium" },
  };

  const ANIME_MODEL = {
    slug: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
    input: { 
      anime: true,
      tile: 256,
      tile_pad: 16
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
      if (scale > 4) {
        return { ...PHOTO_MODEL, input: { face_enhance: false } };
      }
      return ART_TEXT_MODEL;
    case "anime":
      return ANIME_MODEL;
    case "clarity":
      return CLARITY_MODEL;
    default:
      return PHOTO_MODEL;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[Check-All] Starting check for stuck jobs");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all processing jobs that:
    // 1. Regular jobs: Have a prediction_id (actively processing on Replicate)
    // 2. Tiling jobs: Have using_tiling=true (may have multiple tile predictions)
    // 3. Either haven't received a webhook yet OR last webhook was >10s ago (3x faster recovery!)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    
    const { data: jobs, error: jobError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("status", "processing")
      .or(`last_webhook_at.is.null,last_webhook_at.lt.${tenSecondsAgo}`);

    if (jobError) {
      console.error("[Check-All] Error fetching jobs:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch jobs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log("[Check-All] No stuck jobs found");
      return new Response(
        JSON.stringify({ message: "No stuck jobs", checked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Check-All] Found ${jobs.length} processing jobs to check`);

    const results = [];
    
    for (const job of jobs) {
      try {
        // Handle tiling jobs
        if (job.using_tiling && job.tiles_data) {
          console.log(`[Check-All] Checking tiling job ${job.id} with ${job.tiles_data.length} tiles`);
          
          // 🔥 RECOVERY MECHANISM: Check if all tiles are complete but job is stuck at "processing"
          const finalStatus = `stage${job.total_stages}_complete`;
          const allCompleted = job.tiles_data.every((t: any) => t.status === finalStatus);
          
          if (allCompleted && job.status === "processing") {
            console.log(`[Check-All] 🔧 RECOVERING stuck job ${job.id} - all ${job.tiles_data.length} tiles complete but status still "processing"`);
            
            const { data: updated, error: fixError } = await supabase
              .from("upscale_jobs")
              .update({
                status: "tiles_ready",
                last_webhook_at: new Date().toISOString()
              })
              .eq("id", job.id)
              .eq("status", "processing")
              .select();
            
            if (fixError) {
              console.error(`[Check-All] ❌ Failed to recover job ${job.id}:`, fixError);
            } else if (updated && updated.length > 0) {
              console.log(`[Check-All] ✅ Successfully recovered job ${job.id} - marked as tiles_ready!`);
              results.push({
                jobId: job.id,
                type: "tiling_recovery",
                action: "recovered_stuck_job",
                totalTiles: job.tiles_data.length,
                status: "success"
              });
            } else {
              console.log(`[Check-All] ℹ️ Job ${job.id} already recovered by another process`);
            }
            
            continue; // Skip tile-by-tile checking
          }
          
          let completedTiles = 0;
          let triggeredWebhooks = 0;
          
          // Log tile statuses for debugging
          console.log(`[Check-All] Tile statuses:`, job.tiles_data.map((t: any) => ({
            tile_id: t.tile_id,
            status: t.status,
            stage1_id: t.stage1_prediction_id ? 'set' : 'null',
            stage2_id: t.stage2_prediction_id ? 'set' : 'null'
          })));
          
          for (const tile of job.tiles_data) {
            // Find active prediction ID for this tile (check all stages dynamically)
            let predictionId: string | null = null;
            let currentStage = 0;
            
            // Check stages in order
            for (let s = 1; s <= job.total_stages; s++) {
              if (tile.status === `stage${s}_processing`) {
                if (s === 1) {
                  predictionId = tile.stage1_prediction_id;
                } else if (s === 2) {
                  predictionId = tile.stage2_prediction_id;
                } else {
                  predictionId = tile[`stage${s}_prediction_id`];
                }
                currentStage = s;
                break;
              }
            }
            
            if (!predictionId || !currentStage) {
              console.log(`[Check-All] Skipping tile ${tile.tile_id} - status: ${tile.status}, no active prediction_id`);
              continue;
            }
            
            console.log(`[Check-All] Checking tile ${tile.tile_id} - status: ${tile.status}, stage ${currentStage}, prediction: ${predictionId}`);
            
            // Query Replicate for this tile's prediction
            const replicateResponse = await fetch(
              `https://api.replicate.com/v1/predictions/${predictionId}`,
              {
                headers: {
                  "Authorization": `Bearer ${Deno.env.get("REPLICATE_API_TOKEN")}`,
                  "Content-Type": "application/json"
                }
              }
            );
            
            if (!replicateResponse.ok) {
              console.error(`[Check-All] Replicate API error for tile ${tile.tile_id} prediction ${predictionId}`);
              continue;
            }
            
            const prediction = await replicateResponse.json();
            console.log(`[Check-All] Tile ${tile.tile_id} prediction ${predictionId} status: ${prediction.status}`);
            
            // If prediction complete, update database directly (bypass webhook)
            if (prediction.status === "succeeded" || prediction.status === "failed") {
              completedTiles++;
              
              console.log(`[Check-All] Tile ${tile.tile_id} stage ${currentStage} complete on Replicate! Updating database directly...`);
              
              const updated = await updateTileStatusDirectly(
                supabase,
                job.id,
                tile.tile_id,
                currentStage,
                prediction
              );
              
              if (updated) {
                triggeredWebhooks++;
                console.log(`[Check-All] ✅ Successfully updated tile ${tile.tile_id}`);
              } else {
                console.log(`[Check-All] ℹ️ Tile ${tile.tile_id} already updated or failed to update`);
              }
            }
          }
          
          // 🔥 MULTI-STAGE LAUNCH FAILURE DETECTION & DIRECT FIX
          // Detect if a stage completed but the next stage was never launched
          if (job.total_stages > 1 && job.chain_strategy && triggeredWebhooks > 0) {
            // Refetch job to get latest tile statuses
            const { data: updatedJob, error: refetchError } = await supabase
              .from("upscale_jobs")
              .select("*")
              .eq("id", job.id)
              .single();
            
            if (!refetchError && updatedJob) {
              // Check each stage to see if next stage needs launching
              for (let stageNum = 1; stageNum < job.total_stages; stageNum++) {
                const nextStage = stageNum + 1;
                const nextStageStatus = `stage${nextStage}_processing`;
                const prevStageOutputField = stageNum === 1 ? 'stage1_url' : stageNum === 2 ? 'stage2_url' : `stage${stageNum}_url`;
                const nextStagePredictionField = nextStage === 2 ? 'stage2_prediction_id' : `stage${nextStage}_prediction_id`;
                
                // Find tiles that have previous stage output but no next stage prediction
                const tilesNeedingNextStage = updatedJob.tiles_data.filter((t: any) => {
                  const hasPrevStageOutput = t[prevStageOutputField];
                  const hasNextStagePrediction = t[nextStagePredictionField];
                  const isReadyForNextStage = t.status === nextStageStatus || t.status === `stage${stageNum}_complete`;
                  
                  return hasPrevStageOutput && !hasNextStagePrediction && isReadyForNextStage;
                });
                
                if (tilesNeedingNextStage.length > 0) {
                  console.log(`[Check-All] 🚀 STAGE ${nextStage} LAUNCH FAILURE: ${tilesNeedingNextStage.length}/${updatedJob.tiles_data.length} tiles need stage ${nextStage} launched`);
                  console.log(`[Check-All] Bypassing webhook handler - launching Replicate predictions directly...`);
                  
                  // Get next stage configuration
                  const stageConfig = job.chain_strategy.stages[stageNum]; // 0-indexed
                  const model = selectModelFor(job.content_type, stageConfig.scale);
                  const version = getModelVersion(model.slug);
                  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
                  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
                  
                  if (!replicateToken) {
                    console.error(`[Check-All] ❌ REPLICATE_API_TOKEN not configured`);
                  } else {
                    let launchedCount = 0;
                    
                    // Launch next stage prediction for each tile
                    for (const tile of tilesNeedingNextStage) {
                      const inputUrl = tile[prevStageOutputField];
                      
                      if (!inputUrl) {
                        console.error(`[Check-All] ⚠️ Tile ${tile.tile_id} has no ${prevStageOutputField}, skipping`);
                        continue;
                      }
                      
                      const input: Record<string, unknown> = {
                        ...model.input,
                        image: inputUrl,
                      };
                      
                      const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
                      if (!isSwinIR) {
                        input.scale = stageConfig.scale;
                      }
                      
                      try {
                        console.log(`[Check-All] Launching stage ${nextStage} for tile ${tile.tile_id}...`);
                        
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
                          tile[nextStagePredictionField] = prediction.id;
                          tile.status = nextStageStatus;
                          launchedCount++;
                          console.log(`[Check-All] ✅ Launched stage ${nextStage} for tile ${tile.tile_id}: ${prediction.id}`);
                        } else {
                          const errText = await predictionRes.text();
                          console.error(`[Check-All] ❌ Failed to launch stage ${nextStage} for tile ${tile.tile_id}:`, errText);
                          tile.error = `Stage ${nextStage} launch failed: ${errText}`;
                        }
                      } catch (error) {
                        console.error(`[Check-All] ❌ Exception launching stage ${nextStage} for tile ${tile.tile_id}:`, error);
                        tile.error = `Stage ${nextStage} launch error: ${error}`;
                      }
                    }
                    
                    if (launchedCount > 0) {
                      // Update database with new prediction IDs and statuses
                      const { error: updateError } = await supabase
                        .from("upscale_jobs")
                        .update({ 
                          tiles_data: updatedJob.tiles_data,
                          current_stage: nextStage
                        })
                        .eq("id", job.id);
                      
                      if (updateError) {
                        console.error(`[Check-All] ❌ Failed to update job with stage ${nextStage} predictions:`, updateError);
                      } else {
                        console.log(`[Check-All] 🚀 Successfully launched stage ${nextStage} for ${launchedCount}/${tilesNeedingNextStage.length} tiles`);
                      }
                    }
                  }
                  
                  break; // Only fix one stage at a time, will catch others on next run
                }
              }
            }
          }
          
          results.push({
            jobId: job.id,
            type: "tiling",
            totalTiles: job.tiles_data.length,
            completedTiles,
            webhookTriggered: triggeredWebhooks > 0
          });
          
          continue;
        }
        
        // Handle regular (non-tiling) jobs
        if (!job.prediction_id) {
          console.log(`[Check-All] Job ${job.id} has no prediction_id, skipping`);
          continue;
        }

        console.log(`[Check-All] Checking job ${job.id} with prediction ${job.prediction_id}`);

        // Query Replicate API directly
        const replicateResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${job.prediction_id}`,
          {
            headers: {
              "Authorization": `Bearer ${Deno.env.get("REPLICATE_API_TOKEN")}`,
              "Content-Type": "application/json"
            }
          }
        );

        if (!replicateResponse.ok) {
          console.error(`[Check-All] Replicate API error for ${job.prediction_id}:`, replicateResponse.status);
          continue;
        }

        const prediction = await replicateResponse.json();
        
        console.log(`[Check-All] Prediction ${prediction.id} status: ${prediction.status}`);

        // If prediction is complete, trigger webhook processing
        if (prediction.status === "succeeded" || prediction.status === "failed") {
          console.log(`[Check-All] Prediction complete! Simulating webhook for job ${job.id}`);

          // Call webhook function directly
          const webhookResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
              },
              body: JSON.stringify(prediction)
            }
          );

          const webhookResult = await webhookResponse.text();
          console.log(`[Check-All] Webhook simulation result:`, webhookResult);

          results.push({
            jobId: job.id,
            type: "regular",
            predictionId: job.prediction_id,
            status: prediction.status,
            webhookTriggered: true
          });
        } else {
          results.push({
            jobId: job.id,
            type: "regular",
            predictionId: job.prediction_id,
            status: prediction.status,
            webhookTriggered: false
          });
        }
      } catch (error) {
        console.error(`[Check-All] Error checking job ${job.id}:`, error);
        results.push({
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        checked: jobs.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Check-All] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

