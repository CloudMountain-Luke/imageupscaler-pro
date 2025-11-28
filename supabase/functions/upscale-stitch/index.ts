/*
  # Upscale Stitch Edge Function
  
  Stitches completed tiles into final image.
  Called when all tiles for a job have completed upscaling.
  Runs independently with its own timeout to avoid webhook timeouts.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
}

interface TilingGrid {
  tilesX: number;
  tilesY: number;
  tileWidth: number;
  tileHeight: number;
  overlap: number;
  totalTiles: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Stitch] Starting stitch for job ${jobId}`);

    // Fetch job from database
    const { data: job, error: jobError } = await supabase
      .from("upscale_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`[Stitch] Job not found: ${jobId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!job.tiles_data || !job.tile_grid) {
      console.error(`[Stitch] Missing tile data or grid`);
      return new Response(
        JSON.stringify({ success: false, error: "Missing tile data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tiles: TileData[] = job.tiles_data;
    const grid: TilingGrid = job.tile_grid;

    // Calculate final dimensions
    const finalWidth = job.chain_strategy.targetScale * grid.tileWidth * grid.tilesX;
    const finalHeight = job.chain_strategy.targetScale * grid.tileHeight * grid.tilesY;
    
    console.log(`[Stitch] Final size target: ${finalWidth}×${finalHeight}`);
    console.log(`[Stitch] Processing ${tiles.length} tiles...`);

    // Create canvas
    let output = new Image(finalWidth, finalHeight);
    output.fill(0xFFFFFFFF); // White background

    // Download and composite tiles ONE AT A TIME (memory safe)
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const tileUrl = tile.stage2_url || tile.stage1_url;
      
      if (!tileUrl) {
        console.error(`[Stitch] Tile ${tile.tile_id} missing output URL`);
        continue;
      }
      
      console.log(`[Stitch] Downloading tile ${tile.tile_id} (${i + 1}/${tiles.length})...`);
      
      try {
        const response = await fetch(tileUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const tileImage = await decode(new Uint8Array(buffer));
        
        // Calculate position (scaled)
        const x = tile.x * job.target_scale;
        const y = tile.y * job.target_scale;
        
        console.log(`[Stitch] Compositing tile ${tile.tile_id} at (${x},${y}), size: ${tileImage.width}×${tileImage.height}`);
        
        // Composite tile onto canvas
        output.composite(tileImage, x, y);
        
        console.log(`[Stitch] Tile ${tile.tile_id} composited successfully`);
      } catch (tileError) {
        console.error(`[Stitch] Error processing tile ${tile.tile_id}:`, tileError);
        // Continue with other tiles even if one fails
      }
    }
    
    console.log(`[Stitch] All tiles composited! Encoding final image...`);
    
    // Encode final image
    const finalBuffer = await output.encode();
    console.log(`[Stitch] Encoded ${finalBuffer.length} bytes`);
    
    // Upload to storage
    const timestamp = Date.now();
    const fileName = `final_${jobId}_${timestamp}.png`;
    
    console.log(`[Stitch] Uploading to storage: ${fileName}`);
    
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
    
    console.log(`[Stitch] ✅ Complete! Final URL: ${finalUrl}`);
    
    // Update job as completed
    const { error: updateError } = await supabase
      .from("upscale_jobs")
      .update({
        status: "completed",
        final_output_url: finalUrl,
        current_output_url: finalUrl,
        completed_at: new Date().toISOString()
      })
      .eq("id", jobId);
    
    if (updateError) {
      console.error(`[Stitch] Failed to update job:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }
    
    console.log(`[Stitch] 🎉 Job ${jobId} finalized successfully!`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        finalUrl,
        dimensions: { width: finalWidth, height: finalHeight }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[Stitch] Error:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


