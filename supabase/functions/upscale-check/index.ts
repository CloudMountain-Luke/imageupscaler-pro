/*
  # Upscale Check Edge Function
  
  Fallback mechanism to poll Replicate API directly and process completed predictions
  when webhooks fail to arrive. This ensures jobs complete even if webhooks are unreliable.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
}

function getModelVersion(slug: string): string {
  return slug.split(":")[1];
}

function selectModelFor(contentType: string, scale: number): { slug: string; input: Record<string, unknown> } {
  const PHOTO_MODEL = {
    slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
    input: { face_enhance: scale <= 4 },
  };

  const ART_TEXT_MODEL = {
    slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
    input: { task: scale >= 4 ? "Real-World Image Super-Resolution-Large" : "Real-World Image Super-Resolution-Medium" },
  };

  const ANIME_MODEL = {
    slug: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
    input: { anime: true },
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
    default:
      return PHOTO_MODEL;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, predictionId } = await req.json();

    if (!jobId && !predictionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId or predictionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      return new Response(
        JSON.stringify({ success: false, error: "REPLICATE_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find job by ID or prediction ID
    let job: UpscaleJob | null = null;
    if (jobId) {
      const { data, error } = await supabase
        .from("upscale_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) {
        console.error(`[upscale-check] Error finding job by ID:`, error);
      } else {
        job = data as UpscaleJob;
      }
    }

    if (!job && predictionId) {
      const { data, error } = await supabase
        .from("upscale_jobs")
        .select("*")
        .eq("prediction_id", predictionId)
        .single();
      if (error) {
        console.error(`[upscale-check] Error finding job by prediction ID:`, error);
      } else {
        job = data as UpscaleJob;
      }
    }

    if (!job) {
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If job is already completed or failed, return early
    if (job.status === "completed" || job.status === "failed") {
      return new Response(
        JSON.stringify({ success: true, message: `Job already ${job.status}`, jobStatus: job.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the current prediction ID
    const currentPredictionId = job.prediction_id;
    if (!currentPredictionId) {
      return new Response(
        JSON.stringify({ success: false, error: "No prediction ID found for job" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[upscale-check] Checking Replicate prediction ${currentPredictionId} for job ${job.id}`);

    // Poll Replicate API for prediction status
    const replicateRes = await fetch(`https://api.replicate.com/v1/predictions/${currentPredictionId}`, {
      headers: {
        Authorization: `Token ${replicateToken}`,
      },
    });

    if (!replicateRes.ok) {
      const errorText = await replicateRes.text();
      console.error(`[upscale-check] Failed to check Replicate prediction: ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to check Replicate: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await replicateRes.json();
    console.log(`[upscale-check] Prediction ${currentPredictionId} status: ${prediction.status}`);

    // If prediction is still processing, return current status
    if (prediction.status === "starting" || prediction.status === "processing") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Prediction still processing",
          predictionStatus: prediction.status,
          jobStatus: job.status 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If prediction failed, update job
    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errorMsg = prediction.error || "Prediction failed";
      console.error(`[upscale-check] Prediction ${currentPredictionId} failed: ${errorMsg}`);
      
      await supabase
        .from("upscale_jobs")
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({ success: true, message: "Job marked as failed", jobStatus: "failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If prediction succeeded, process it like a webhook
    if (prediction.status === "succeeded") {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      
      if (!outputUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "No output URL in prediction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[upscale-check] Prediction ${currentPredictionId} succeeded, processing output...`);

      // Import webhook processing logic (we'll call it directly)
      const strategy: ChainStrategy = job.chain_strategy;
      strategy.stages[job.current_stage - 1].output_url = outputUrl;
      strategy.stages[job.current_stage - 1].status = "completed";

      // Check if chain is complete
      if (job.current_stage >= job.total_stages) {
        // Final stage complete - copy to permanent storage
        const filename = `${job.id}_${job.target_scale}x_final.png`;
        let permanentUrl = outputUrl;
        
        try {
          const response = await fetch(outputUrl);
          if (response.ok) {
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("images")
              .upload(`images/${filename}`, response.body, {
                contentType: "image/png",
                cacheControl: "3600",
                upsert: false,
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from("images")
                .getPublicUrl(`images/${filename}`);
              permanentUrl = urlData.publicUrl;
            }
          }
        } catch (error) {
          console.error("[upscale-check] Error copying to storage:", error);
        }

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

        return new Response(
          JSON.stringify({ success: true, message: "Job completed", jobStatus: "completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Continue to next stage - start the next prediction
        const nextStageIndex = job.current_stage;
        if (nextStageIndex >= strategy.stages.length) {
          return new Response(
            JSON.stringify({ success: false, error: "No next stage found" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const nextStage = strategy.stages[nextStageIndex];
        nextStage.input_url = outputUrl;
        nextStage.status = "processing";

        console.log(`[upscale-check] Starting stage ${nextStageIndex + 1}/${strategy.stages.length}`);

        const model = selectModelFor(job.content_type, nextStage.scale);
        const input: Record<string, unknown> = {
          ...model.input,
          image: outputUrl,
        };

        const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
        if (!isSwinIR) {
          input.scale = nextStage.scale;
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
          console.error(`[upscale-check] Failed to create next prediction: ${errText}`);
          throw new Error(`Failed to create next prediction: ${errText}`);
        }

        const nextPrediction = await predictionRes.json();

        // Update job
        await supabase
          .from("upscale_jobs")
          .update({
            current_stage: job.current_stage + 1,
            current_output_url: outputUrl,
            prediction_id: nextPrediction.id,
            chain_strategy: strategy,
          })
          .eq("id", job.id);

        nextStage.prediction_id = nextPrediction.id;
        await supabase
          .from("upscale_jobs")
          .update({ chain_strategy: strategy })
          .eq("id", job.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Stage completed, next stage started",
            jobStatus: "processing",
            currentStage: job.current_stage + 1,
            nextPredictionId: nextPrediction.id
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown prediction status: ${prediction.status}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[upscale-check] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

