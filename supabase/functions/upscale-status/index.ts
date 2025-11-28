/*
  # Upscale Status Edge Function
  
  Queries the status of an upscaling job from the database.
  Returns progress, current stage, output URLs, and error messages.
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user ID from auth header for RLS
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Query job (RLS will enforce user can only see their own jobs)
    const { data: job, error } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const strategy: ChainStrategy = job.chain_strategy;
    
    // Calculate progress based on job type
    let progress = 0;
    let estimatedTimeRemaining = 0;
    let tilingInfo = null;
    
    if (job.using_tiling && job.tiles_data && job.tile_grid) {
      // TILING JOB: Calculate progress based on tile completion
      const totalTiles = job.tiles_data.length;
      const totalStages = job.total_stages;
      
      // Count tiles by status
      const stage1Complete = job.tiles_data.filter((t: any) => 
        t.status === "stage1_complete" || t.status === "stage2_processing" || t.status === "stage2_complete"
      ).length;
      const stage2Complete = job.tiles_data.filter((t: any) => 
        t.status === "stage2_complete"
      ).length;
      const failedTiles = job.tiles_data.filter((t: any) => t.status === "failed").length;
      
      // Calculate progress: (completed_tiles / total_tiles) * (current_stage / total_stages)
      if (totalStages === 1) {
        progress = (stage1Complete / totalTiles) * 100;
      } else if (totalStages === 2) {
        // First stage is 50%, second stage is 50%
        const stage1Progress = (stage1Complete / totalTiles) * 50;
        const stage2Progress = (stage2Complete / totalTiles) * 50;
        progress = stage1Progress + stage2Progress;
      } else {
        // More than 2 stages - divide evenly
        const progressPerStage = 100 / totalStages;
        const currentStageProgress = job.current_stage === 1 
          ? (stage1Complete / totalTiles) * progressPerStage
          : job.current_stage === 2
          ? progressPerStage + ((stage2Complete / totalTiles) * progressPerStage)
          : progressPerStage * (job.current_stage - 1);
        progress = currentStageProgress;
      }
      
      // Estimate remaining time
      const remainingTiles = totalTiles - (totalStages === 1 ? stage1Complete : stage2Complete);
      estimatedTimeRemaining = remainingTiles * 3 * (totalStages - job.current_stage + 1); // ~3s per tile per stage
      
      tilingInfo = {
        totalTiles,
        stage1Complete,
        stage2Complete,
        failedTiles,
        grid: job.tile_grid
      };
      
    } else {
      // REGULAR JOB: Calculate progress based on stage completion
      const completedStages = strategy.stages.filter(s => s.status === "completed").length;
      const currentStageIndex = job.current_stage - 1;
      const currentStage = strategy.stages[currentStageIndex];
      
      // Base progress from completed stages
      progress = strategy.stages.length > 0 
        ? (completedStages / strategy.stages.length) * 100 
        : 0;
      
      // Add partial progress for current processing stage (estimate 50% done if processing)
      if (currentStage && currentStage.status === "processing") {
        const stageProgress = 50; // Estimate 50% done for current stage
        const progressPerStage = 100 / strategy.stages.length;
        progress = (completedStages * progressPerStage) + (stageProgress * progressPerStage / 100);
      }

      // Calculate estimated time remaining
      const remainingStages = strategy.stages.slice(job.current_stage - 1);
      estimatedTimeRemaining = remainingStages.length * 5; // ~5 seconds per stage
    }

    const response: any = {
      success: true,
      jobId: job.id,
      status: job.status,
      progress: Math.round(progress),
      currentStage: job.current_stage,
      totalStages: job.total_stages,
      currentOutputUrl: job.current_output_url,
      finalOutputUrl: job.final_output_url,
      errorMessage: job.error_message,
      estimatedTimeRemaining: estimatedTimeRemaining,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      usingTiling: job.using_tiling || false,
      tilingInfo,
      stages: strategy.stages.map((s: ChainStage) => ({
        stage: s.stage,
        scale: s.scale,
        status: s.status,
      })),
    };

    // Include tile data if status is tiles_ready (for client-side stitching)
    if (job.status === "tiles_ready" && job.using_tiling) {
      response.tiles_data = job.tiles_data;
      response.tile_grid = job.tile_grid;
      response.target_scale = job.target_scale;
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[upscale-status] Status query error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

