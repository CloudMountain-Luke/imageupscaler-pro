/*
  # AI Image Upscaler Edge Function - Supabase Storage Integration

  This serverless function handles AI-powered image upscaling using Replicate API.
  It downloads the upscaled image, compresses it to JPEG, uploads it to Supabase Storage,
  and then returns the public URL of the stored image.
  
  ## Features
  - Accepts image uploads via base64 encoding
  - Integrates with Replicate API for AI upscaling
  - Compresses upscaled image to JPEG to optimize storage size
  - Uploads both original and upscaled images to Supabase Storage
  - Returns public URLs for both images
  - Comprehensive error handling and validation
  - CORS support for web applications
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";
// Import image processing functions for Deno
import { decode, encode } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const requestData = await req.json();
    if (!requestData.imageBase64 || !requestData.scale) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: imageBase64, scale" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting upscale process: scale=${requestData.scale}, quality=${requestData.quality || 'default'}`);

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
    
    console.log("Creating Replicate prediction...");
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
      console.error("Replicate API failed:", errorText);
      return new Response(JSON.stringify({ success: false, error: `Replicate API failed: ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    let prediction = await predictionRes.json();
    console.log(`Prediction created: ${prediction.id}, status: ${prediction.status}`);

    // Poll until complete
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
      
      if (pollAttempt % 10 === 0) {
        console.log(`Polling attempt ${pollAttempt}, status: ${prediction.status}`);
      }
    }

    if (pollAttempt >= maxPollAttempts) {
      console.error("Replicate processing timed out");
      return new Response(JSON.stringify({ success: false, error: "Replicate processing timed out." }), {
        status: 504, // Gateway Timeout
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (prediction.status !== "succeeded" || !prediction.output) {
      const err = prediction.error ?? "Replicate processing failed";
      console.error("Replicate processing failed:", err);
      return new Response(JSON.stringify({ success: false, error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Replicate processing completed successfully, downloading upscaled image...");

    // Download the upscaled image from Replicate's CDN
    const upscaledRes = await fetch(prediction.output);
    if (!upscaledRes.ok) {
      throw new Error(`Failed to download upscaled image from Replicate: ${upscaledRes.statusText}`);
    }
    const upscaledBuffer = await upscaledRes.arrayBuffer();
    
    console.log(`Downloaded upscaled image: ${upscaledBuffer.byteLength} bytes (${(upscaledBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    
    // Decode and re-encode as JPEG for storage optimization
    try {
      const image = decode(new Uint8Array(upscaledBuffer));
      console.log(`Decoded image: ${image.width}x${image.height}`);

      // Encode the image as JPEG with a quality of 80 (adjust quality as needed, 0-100)
      const jpegBuffer = image.encodeJPEG(80);
      console.log(`JPEG compressed: ${jpegBuffer.byteLength} bytes (${(jpegBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
      
      // Use the JPEG buffer for upload
      const outputBuf = jpegBuffer;

      // Convert original image base64 to buffer for storage
      const inputBuf = Uint8Array.from(atob(requestData.imageBase64.split(",")[1]), (c) => c.charCodeAt(0));

      // Upload both images to Supabase Storage
      const timestamp = Date.now();
      const inputFileName = `input_${timestamp}.png`; // Keep input as PNG
      const outputFileName = `output_${timestamp}.jpeg`; // Change output to JPEG extension

      console.log("Uploading images to Supabase Storage...");

      // Upload original image
      const { error: inputUploadError } = await supabase.storage.from("images").upload(`images/${inputFileName}`, inputBuf, {
        contentType: "image/png",
        upsert: false,
      });
      if (inputUploadError) {
        console.error("Error uploading input image:", inputUploadError);
        throw new Error(`Failed to upload original image: ${inputUploadError.message}`);
      }

      // Upload upscaled image (now JPEG)
      const { error: outputUploadError } = await supabase.storage.from("images").upload(`images/${outputFileName}`, outputBuf, {
        contentType: "image/jpeg", // Change content type to JPEG
        upsert: false,
      });
      if (outputUploadError) {
        console.error("Error uploading upscaled image:", outputUploadError);
        throw new Error(`Failed to upload upscaled image: ${outputUploadError.message}`);
      }

      console.log("Images uploaded successfully, generating public URLs...");

      // Get public URLs for both images
      const { data: inUrlData } = supabase.storage.from("images").getPublicUrl(`images/${inputFileName}`);
      const { data: outUrlData } = supabase.storage.from("images").getPublicUrl(`images/${outputFileName}`);

      const processingTime = Date.now() - startTime;
      console.log(`Processing completed in ${processingTime}ms`);
      
      const response = {
        success: true,
        inputUrl: inUrlData.publicUrl,
        outputUrl: outUrlData.publicUrl, // Return the public URL of the stored image
        processingTime,
      };
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } catch (imageProcessingError) {
      console.error("Image processing error:", imageProcessingError);
      throw new Error(`Failed to process upscaled image: ${imageProcessingError.message}`);
    }

  } catch (err: any) {
    console.error("Upscaler function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});