/*
  # AI Image Upscaler Edge Function - URL Storage Only

  This serverless function handles AI-powered image upscaling using Replicate API
  and stores only the URLs (not the actual files) to avoid storage size limits.
  
  ## Features
  - Accepts image uploads via base64 encoding
  - Integrates with Replicate API for AI upscaling
  - Returns Replicate CDN URLs directly (no local storage)
  - Avoids file size limits by not re-uploading large upscaled images
  - Comprehensive error handling and validation
  - CORS support for web applications
  - Dynamic model selection based on quality preset
  - Dynamic model selection based on quality preset
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";
// Note: The original prompt included `type { Database } from "../_shared/database.types.ts";`
// This import is commented out as the `database.types.ts` file is not provided in the current context.
// If you have a `database.types.ts` file, you can uncomment this line and ensure the path is correct.
// import type { Database } from "../_shared/database.types.ts";

// Real-ESRGAN model versions for different use cases
const MODELS = {
  photo: 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b', // Real-ESRGAN x4 for photos
  art: 'jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a', // SwinIR for art/illustrations
// Real-ESRGAN model versions for different use cases
const MODELS = {
  photo: 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b', // Real-ESRGAN x4 for photos
  art: 'jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a', // SwinIR for art/illustrations
// CORS headers for browser fetch requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key for elevated permissions
  // (e.g., for storage uploads, which might bypass RLS if not configured for anon key)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    // If you have a `database.types.ts` file, you can add `<Database>` here:
    // createClient<Database>(...)
  );

  try {
    const requestData = await req.json();
    if (!requestData.imageBase64 || !requestData.scale) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: imageBase64, scale" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    const replicateApiToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateApiToken) {
      return new Response(JSON.stringify({ success: false, error: "Replicate API token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create prediction on Replicate
    const replicateHeaders = {
      "Content-Type": "application/json",
      Authorization: `Token ${replicateApiToken}`,
    };
    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: replicateHeaders,
      body: JSON.stringify({
        version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa", // Real-ESRGAN model
        input: { image: requestData.imageBase64, scale: requestData.scale },
      }),
    });
    if (!predictionRes.ok) {
      const errorText = await predictionRes.text();
      return new Response(JSON.stringify({ success: false, error: `Replicate API failed: ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let prediction = await predictionRes.json();

    // Poll until complete
    // Added a timeout to prevent infinite loops in case of stuck predictions
    const maxPollAttempts = 120; // 120 attempts * 1 second = 120 seconds (2 minutes)
    let pollAttempt = 0;
    while ((prediction.status === "starting" || prediction.status === "processing") && pollAttempt < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: replicateHeaders,
      });
      if (!statusRes.ok) throw new Error("Failed to check prediction status");
      prediction = await statusRes.json();
      pollAttempt++;
    }

    if (pollAttempt >= maxPollAttempts) {
      return new Response(JSON.stringify({ success: false, error: "Replicate processing timed out." }), {
        status: 504, // Gateway Timeout
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (prediction.status !== "succeeded" || !prediction.output) {
      const err = prediction.error ?? "Replicate processing failed";
      return new Response(JSON.stringify({ success: false, error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the upscaled image from Replicate's CDN
    const upscaledRes = await fetch(prediction.output);
    if (!upscaledRes.ok) {
      throw new Error(`Failed to download upscaled image from Replicate: ${upscaledRes.statusText}`);
    }
    const upscaledBuffer = await upscaledRes.arrayBuffer();
    
    // Convert original image base64 to buffer for storage
    const inputBuf = Uint8Array.from(atob(requestData.imageBase64.split(",")[1]), (c) => c.charCodeAt(0));
    const outputBuf = new Uint8Array(upscaledBuffer);

    // Upload both images to Supabase Storage
    const timestamp = Date.now();
    const inputFileName = `input_${timestamp}.png`;
    const outputFileName = `output_${timestamp}.png`;

    // Upload original image
    const { error: inputUploadError } = await supabase.storage.from("images").upload(`images/${inputFileName}`, inputBuf, {
      contentType: "image/png",
      upsert: false,
    });
    if (inputUploadError) {
      console.error("Error uploading input image:", inputUploadError);
      throw new Error(`Failed to upload original image: ${inputUploadError.message}`);
    }

    // Get public URL for input image and use Replicate CDN URL for output
    const { data: inUrlData } = supabase.storage.from("images").getPublicUrl(`images/${inputFileName}`);

    const processingTime = Date.now() - startTime;
    const response = {
      success: true,
      inputUrl: inUrlData.publicUrl,
      outputUrl: prediction.output, // Use Replicate CDN URL directly
      processingTime,
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Upscaler function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});