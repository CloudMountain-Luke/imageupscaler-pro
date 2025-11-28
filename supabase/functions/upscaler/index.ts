/*
  # AI Image Upscaler Edge Function - Orchestrated Replicate Pipeline

  This implementation handles plan-aware, multi-pass image upscaling completely on the server.
  It chains Replicate models (including optional ControlNet tiling) to reach the requested scale,
  enforces subscription guardrails, clamps results to the 12k px output limit, and stores both
  the original and final images in Supabase Storage.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";
import { decode } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PLAN_MAX_SCALE: Record<string, number> = {
  basic: 8,
  pro: 12,
  enterprise: 16,
  mega: 32,
};

const DIMENSION_LIMIT = 12000;
const SUPABASE_UPLOAD_LIMIT = 45 * 1024 * 1024; // 45MB safety buffer under Storage cap
const ALLOWED_SCALES = [2, 4, 8, 10, 12, 16, 32];

type Quality = "photo" | "art" | "text" | "anime";
type PlanTier = keyof typeof PLAN_MAX_SCALE;

interface RequestPayload {
  imageBase64: string;
  scale: number;
  quality?: Quality;
  maxDetail?: boolean;
  plan?: PlanTier;
  selectedModel?: string;
}

interface ReplicateModelInfo {
  slug: string;
  input: Record<string, unknown>;
  supportsOutscale: boolean;
  nativeScales: number[];
  maxOutscale?: number;
}

interface OrchestrationStep {
  slug: string;
  scale: number;
  outscale?: number;
  input: Record<string, unknown>;
}

const PHOTO_MODEL: ReplicateModelInfo = {
  slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
  input: { face_enhance: true },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
};

const ART_TEXT_MODEL: ReplicateModelInfo = {
  slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
  input: {},
  supportsOutscale: false,
  nativeScales: [2, 4],
};

// Helper function to get SwinIR model with appropriate task parameter
function getSwinIRModel(scale: number): ReplicateModelInfo {
  // SwinIR uses task parameter to specify upscaling mode
  // "Real-World Image Super-Resolution-Large" for 4x
  // "Real-World Image Super-Resolution-Medium" for 2x
  let task: string;
  if (scale >= 4) {
    task = "Real-World Image Super-Resolution-Large"; // 4x upscaling
  } else {
    task = "Real-World Image Super-Resolution-Medium"; // 2x upscaling
  }
  
  return {
    ...ART_TEXT_MODEL,
    input: { task },
  };
}

const ANIME_MODEL: ReplicateModelInfo = {
  slug: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
  input: { anime: true },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
};

const ANIME_SMALL_MODEL: ReplicateModelInfo = {
  slug: "shreejalmaharjan-27/waifu2x:8cd6c1cee46a1ceebce8f3d4e4d1f1a6e296f4d3d1d3a0e6319c8c9b1b2c2a9",
  input: {},
  supportsOutscale: false,
  nativeScales: [2],
};

const CONTROLNET_TILE_MODEL: ReplicateModelInfo = {
  slug: "fermatresearch/high-resolution-controlnet-tile:8e6a54d7b2848c48dc741a109d3fb0ea2a7f554eb4becd39a25cc532536ea975",
  input: {
    prompt: "high quality detailed upscale with preserved structure",
    creativity: 0.4,
    negative_prompt: "blurry, artifacts, distortions, low quality, worst quality",
    lora_details_strength: -0.25,
    lora_sharpness_strength: 0.75,
  },
  supportsOutscale: false,
  nativeScales: [2, 4, 8],
  maxOutscale: undefined,
};

function selectModelFor(category: Quality, scale: number, options: { maxDetail?: boolean; userSelectedModel?: string } = {}): ReplicateModelInfo {
  // If user selected a specific model, use it
  if (options.userSelectedModel && options.userSelectedModel !== 'auto') {
    return getModelById(options.userSelectedModel, scale);
  }
  
  // Smart model selection based on image type and scale
  const smartModel = getSmartModelForScale(category, scale);
  if (smartModel) {
    return smartModel;
  }
  
  // Fallback: use primary models (all support outscale for high scales)
  // ControlNet is not used as it doesn't support scale parameters
  switch (category) {
    case "photo":
      return {
        ...PHOTO_MODEL,
        input: { ...PHOTO_MODEL.input, face_enhance: scale <= 4 },
      };
    case "art":
    case "text":
      if (scale > 4) {
        return {
          ...PHOTO_MODEL,
          input: { ...PHOTO_MODEL.input, face_enhance: false },
        };
      }
      return ART_TEXT_MODEL;
    case "anime":
      if (scale <= 2) {
        return ANIME_SMALL_MODEL;
      }
      return ANIME_MODEL;
    default:
      return PHOTO_MODEL;
  }
}

function getModelById(modelId: string, scale: number): ReplicateModelInfo {
  switch (modelId) {
    case 'photo-real-esrgan':
      return {
        ...PHOTO_MODEL,
        input: { ...PHOTO_MODEL.input, face_enhance: scale <= 4 }
      };
    case 'art-swinir':
      return ART_TEXT_MODEL;
    case 'anime-real-esrgan':
      return ANIME_MODEL;
    case 'anime-waifu2x':
      return ANIME_SMALL_MODEL;
    case 'controlnet-tile':
      return CONTROLNET_TILE_MODEL;
    default:
      return PHOTO_MODEL;
  }
}

// Smart model selection based on image type and scale
function getSmartModelForScale(category: Quality, scale: number): ReplicateModelInfo | null {
  // Define optimal scale ranges for each primary model
  const modelRanges = {
    'photo': { model: PHOTO_MODEL },
    'anime': { model: ANIME_MODEL },
    'art': { model: ART_TEXT_MODEL },
    'text': { model: ART_TEXT_MODEL },
  };

  const range = modelRanges[category];
  if (!range) return null;

  // For all scales, use the primary model (Real-ESRGAN supports outscale for high scales)
  // ControlNet is not used in orchestration as it doesn't support scale parameters
  return {
    ...range.model,
    input: { 
      ...range.model.input, 
      face_enhance: category === 'photo' && scale <= 4 
    }
  };
}

function buildScaleChain(target: number): number[] {
  // Replicate documentation recommendation: For 12x, "chain 2x six times"
  // Real-ESRGAN only supports integer scale parameter (max 10)
  // Strategy: use 2x steps primarily to minimize intermediate image sizes and memory usage
  
  // If target is <= 10, use it directly (single step, most efficient)
  if (target <= 10 && Number.isInteger(target)) {
    return [target];
  }

  // For targets > 10, break down into 2x steps (most memory-efficient)
  // This follows Replicate's recommendation to "chain 2x" for high scales
  const chain: number[] = [];
  let remaining = target;
  
  // Keep adding 2x steps until remaining is <= 10
  while (remaining > 10) {
    chain.push(2);
    remaining /= 2;
  }
  
  // Now remaining is <= 10
  // Real-ESRGAN supports scales 2-10, so we can use remaining directly if it's >= 2
  if (remaining >= 2 && remaining <= 10) {
    // For remaining values that are integers and within Real-ESRGAN's supported range
    if (Number.isInteger(remaining)) {
      chain.push(remaining);
    } else {
      // If remaining is not an integer (shouldn't happen with integer targets, but handle it)
      // Round down and add a final 2x step if needed
      const floorRemaining = Math.floor(remaining);
      if (floorRemaining >= 2) {
        chain.push(floorRemaining);
      }
      // If there's a fractional part, we'd need another step, but this shouldn't happen
      // with integer target scales
    }
  } else if (remaining > 1 && remaining < 2) {
    // This case shouldn't happen with integer targets, but handle it
    chain.push(2);
  }

  // Verify the chain multiplies to the target
  const product = chain.reduce((acc, val) => acc * val, 1);
  if (Math.abs(product - target) > 0.01) {
    console.warn(`[buildScaleChain] Chain [${chain.join(', ')}] = ${product}, target = ${target}. Adjusting...`);
    // If product is less than target, add more 2x steps
    let adjustedRemaining = target / product;
    while (adjustedRemaining > 1.01) {
      if (adjustedRemaining >= 2) {
        chain.push(2);
        adjustedRemaining /= 2;
      } else {
        // Can't add fractional steps, so we'll be slightly under
        break;
      }
    }
  }

  return chain;
}

function createOrchestrationSteps(
  category: Quality,
  targetScale: number,
  options: { maxDetail?: boolean; userSelectedModel?: string } = {}
): OrchestrationStep[] {
  console.log(`[createOrchestrationSteps] Creating steps for targetScale: ${targetScale}, category: ${category}`);
  
  const chain = buildScaleChain(targetScale);
  console.log(`[createOrchestrationSteps] Scale chain breakdown: [${chain.join(', ')}]`);
  
  const steps: OrchestrationStep[] = [];

  // For 12x, we now use [2, 2, 3] chain (conservative approach)
  // No special SwinIR handling needed - use Real-ESRGAN for all steps

  for (let i = 0; i < chain.length; i++) {
    const segment = chain[i];
    if (segment <= 1) {
      console.log(`[createOrchestrationSteps] Skipping segment ${segment} (<= 1)`);
      continue;
    }

    console.log(`[createOrchestrationSteps] Processing segment ${i + 1}/${chain.length}: ${segment}`);

    // Use normal model selection (Real-ESRGAN, SwinIR, etc.)
    const model = selectModelFor(category, segment, options);
    console.log(`[createOrchestrationSteps] Selected model: ${model.slug}, nativeScales: [${model.nativeScales.join(', ')}]`);

    // Real-ESRGAN only supports scale parameter (max 10), not outscale
    // If segment is a native scale (2 or 4), use it directly
    if (model.nativeScales.includes(segment)) {
      console.log(`[createOrchestrationSteps] Using native scale ${segment} for model ${model.slug}`);
      steps.push({ slug: model.slug, scale: segment, input: model.input });
      continue;
    }

    // If segment is <= 10 and model supports it, use it directly
    // Real-ESRGAN supports scale up to 10
    if (segment <= 10 && (model.slug.includes('real-esrgan') || model.slug.includes('nightmareai'))) {
      console.log(`[createOrchestrationSteps] Using direct scale ${segment} for Real-ESRGAN model`);
      steps.push({ slug: model.slug, scale: segment, input: model.input });
      continue;
    }

    // For segments > 10, break down using native scales
    // This shouldn't happen with our buildScaleChain, but handle it just in case
    if (segment > 10) {
      console.log(`[createOrchestrationSteps] Breaking down segment ${segment} > 10 into native scales`);
      // Break down into 4x and 2x steps
      let remaining = segment;
      while (remaining > 4) {
        steps.push({ slug: model.slug, scale: 4, input: model.input });
        remaining /= 4;
      }
      while (remaining > 2) {
        steps.push({ slug: model.slug, scale: 2, input: model.input });
        remaining /= 2;
      }
      if (remaining > 1 && remaining <= 10) {
        steps.push({ slug: model.slug, scale: remaining, input: model.input });
      }
      continue;
    }

    console.error(`[createOrchestrationSteps] Unable to create orchestration steps for segment ${segment} with model ${model.slug}`);
    throw new Error(`Unable to create orchestration steps for segment ${segment} with available models.`);
  }

  // Calculate total scale (no outscale since Real-ESRGAN doesn't support it)
  const product = steps.reduce((acc, step) => acc * step.scale, 1);
  console.log(`[createOrchestrationSteps] Total steps: ${steps.length}, calculated scale: ${product}, target: ${targetScale}`);
  
  if (Math.abs(product - targetScale) > 0.05) {
    const errorMsg = `Orchestration steps failed to match requested scale. Expected ${targetScale}, got ${product}. Steps: ${JSON.stringify(steps.map(s => ({ slug: s.slug, scale: s.scale })))}`;
    console.error(`[createOrchestrationSteps] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`[createOrchestrationSteps] Successfully created ${steps.length} orchestration step(s)`);
  return steps;
}

function extractBase64Data(imageBase64: string): { buffer: Uint8Array; mimeType: string } {
  const [prefix, data] = imageBase64.includes(",") ? imageBase64.split(",", 2) : ["", imageBase64];
  const mimeMatch = prefix.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(data);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return { buffer, mimeType };
}

function uint8ToDataUrl(buffer: Uint8Array, mimeType: string): string {
  const base64 = base64Encode(buffer);
  return `data:${mimeType};base64,${base64}`;
}

async function prepareImageForUpload(
  buffer: Uint8Array
): Promise<{
  uploadBuffer: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  quality: number;
  resized: boolean;
}> {
  const image = await decode(buffer);
  const width = image.width;
  const height = image.height;

  let quality = 95;
  let workingImage = image;
  let jpegBuffer = await workingImage.encodeJPEG(quality);
  let resized = false;

  // Step down JPEG quality until we fall under the storage limit.
  while (jpegBuffer.byteLength > SUPABASE_UPLOAD_LIMIT && quality > 15) {
    quality -= 5;
    jpegBuffer = await workingImage.encodeJPEG(quality);
  }

  // If the file is still too large, gradually reduce the dimensions and retry compression.
  while (jpegBuffer.byteLength > SUPABASE_UPLOAD_LIMIT) {
    const scaleFactor = Math.sqrt(SUPABASE_UPLOAD_LIMIT / jpegBuffer.byteLength);
    const nextWidth = Math.max(512, Math.floor(workingImage.width * scaleFactor));
    const nextHeight = Math.max(512, Math.floor(workingImage.height * scaleFactor));

    if (nextWidth === workingImage.width && nextHeight === workingImage.height) {
      // Cannot shrink further; break to avoid infinite loop
      break;
    }

    resized = true;
    workingImage = workingImage.resize(nextWidth, nextHeight);
    // After resizing, reset quality slightly higher and walk it down again if needed.
    quality = Math.min(quality + 10, 90);
    jpegBuffer = await workingImage.encodeJPEG(quality);

    while (jpegBuffer.byteLength > SUPABASE_UPLOAD_LIMIT && quality > 15) {
      quality -= 5;
      jpegBuffer = await workingImage.encodeJPEG(quality);
    }
  }

  return {
    uploadBuffer: jpegBuffer,
    mimeType: "image/jpeg",
    width: workingImage.width,
    height: workingImage.height,
    quality,
    resized,
  };
}

function normalizePlan(plan?: string): PlanTier {
  const fallback: PlanTier = "basic";
  if (!plan) return fallback;
  const normalized = plan.toLowerCase();
  if (normalized in PLAN_MAX_SCALE) {
    return normalized as PlanTier;
  }
  return fallback;
}

function clampScaleToAllowed(target: number): number {
  let selected = ALLOWED_SCALES[0];
  for (const scale of ALLOWED_SCALES) {
    if (scale <= target) {
      selected = scale;
    }
  }
  return selected;
}

async function runReplicateStep(
  headers: Headers,
  step: OrchestrationStep,
  imageDataUrl: string,
  currentImageWidth?: number,
  currentImageHeight?: number
): Promise<Uint8Array> {
  const stepStartTime = Date.now();
  console.log(`[runReplicateStep] Starting step: model=${step.slug}, scale=${step.scale}, imageSize=${currentImageWidth}x${currentImageHeight || 'unknown'}`);
  
  const input: Record<string, unknown> = {
    ...step.input,
    image: imageDataUrl,
  };
  
  // SwinIR uses task parameter instead of scale parameter
  // Real-ESRGAN uses scale parameter (max 10)
  // Only add scale parameter if the model is not SwinIR (which uses task)
  const isSwinIR = step.slug.includes('swinir') || step.slug.includes('jingyunliang');
  if (!isSwinIR) {
    input.scale = step.scale;
  }
  // SwinIR's task parameter is already in step.input from getSwinIRModel()

  // Replicate API accepts either full slug (owner/model:version) or just version hash
  const version = step.slug.split(":")[1];
  const requestBody = { version, input };

  console.log(`[runReplicateStep] Creating prediction with scale: ${step.scale}, model version: ${version}`);

  const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!predictionRes.ok) {
    const errText = await predictionRes.text();
    console.error(`[runReplicateStep] Prediction request failed: ${predictionRes.status} ${errText}`);
    throw new Error(`Replicate prediction failed: ${errText}`);
  }

  let prediction = await predictionRes.json();
  console.log(`[runReplicateStep] Prediction created: id=${prediction.id}, status=${prediction.status}`);
  
  // Reduce maxPoll to prevent function timeout
  // Each step should complete within reasonable time to allow for multiple steps
  const maxPoll = 120; // 4 minutes max per step (120 * 2 seconds) to allow for multiple steps
  const stepTimeout = 240000; // 4 minutes total timeout for this step
  let attempts = 0;
  const startTime = Date.now();

  while ((prediction.status === "starting" || prediction.status === "processing") && attempts < maxPoll) {
    // Check for overall timeout
    if (Date.now() - startTime > stepTimeout) {
      console.error(`[runReplicateStep] Step timeout after ${(Date.now() - startTime) / 1000}s`);
      throw new Error(`Replicate step timed out after ${stepTimeout / 1000} seconds`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds
    
    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers,
    });
    
    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error(`[runReplicateStep] Status check failed: ${statusRes.status} ${errText}`);
      throw new Error(`Failed to poll Replicate prediction status: ${errText}`);
    }
    
    prediction = await statusRes.json();
    attempts += 1;
    
    if (attempts % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`[runReplicateStep] Still processing... attempt ${attempts}/${maxPoll}, elapsed: ${elapsed.toFixed(1)}s, status: ${prediction.status}`);
    }
  }

  if (attempts >= maxPoll) {
    console.error(`[runReplicateStep] Max polling attempts reached: ${attempts}/${maxPoll}, final status: ${prediction.status}`);
    throw new Error(`Replicate prediction timed out after ${maxPoll} polling attempts (${maxPoll * 2} seconds). Final status: ${prediction.status}`);
  }

  if (prediction.status === "failed") {
    const err = prediction.error ?? "Replicate step failed";
    console.error(`[runReplicateStep] Prediction failed: ${JSON.stringify(prediction.error)}`);
    throw new Error(`Replicate prediction failed: ${err}`);
  }

  if (prediction.status !== "succeeded" || !prediction.output) {
    const err = prediction.error ?? `Unexpected status: ${prediction.status}`;
    console.error(`[runReplicateStep] Prediction did not succeed: status=${prediction.status}, error=${err}`);
    throw new Error(`Replicate step failed: ${err}`);
  }
  
  const elapsed = ((Date.now() - stepStartTime) / 1000).toFixed(1);
  console.log(`[runReplicateStep] Prediction succeeded after ${attempts} attempts (${elapsed}s)`);

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  console.log(`[runReplicateStep] Downloading output from: ${outputUrl}`);
  
  const outputRes = await fetch(outputUrl);
  if (!outputRes.ok) {
    console.error(`[runReplicateStep] Failed to download output: ${outputRes.status} ${outputRes.statusText}`);
    throw new Error(`Failed to download Replicate output: ${outputRes.statusText}`);
  }

  const arrayBuffer = await outputRes.arrayBuffer();
  const downloadSizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`[runReplicateStep] Output downloaded: ${downloadSizeMB}MB`);
  
  // For memory efficiency with large images, we need to be more aggressive
  // Decode and immediately compress to reduce memory footprint
  const buffer = new Uint8Array(arrayBuffer);
  
  // Micro plan: Use moderate compression (70-75% quality)
  // For large images (>10MB), use more aggressive compression
  // For smaller images, use higher quality
  const isLargeImage = arrayBuffer.byteLength > 10 * 1024 * 1024; // > 10MB
  const jpegQuality = isLargeImage ? 70 : 75; // Moderate compression for Micro plan
  
  const image = await decode(buffer);
  const imageDimensions = `${image.width}x${image.height}`;
  
  // Immediately compress to JPEG to reduce memory usage
  // Clear the original buffer reference to help GC
  const compressedBuffer = await image.encodeJPEG(jpegQuality);
  const compressedSizeMB = (compressedBuffer.byteLength / 1024 / 1024).toFixed(2);
  const savedMB = (parseFloat(downloadSizeMB) - parseFloat(compressedSizeMB)).toFixed(2);
  const estimatedMemoryMB = (parseFloat(compressedSizeMB) * 3).toFixed(2); // Estimate decoded memory (3x compressed size)
  console.log(`[runReplicateStep] Compressed to JPEG (quality ${jpegQuality}): ${compressedSizeMB}MB (saved ${savedMB}MB), dimensions: ${imageDimensions}, estimated memory: ~${estimatedMemoryMB}MB`);
  
  // Warn if memory usage is getting high (20% of 1GB = 200MB)
  if (parseFloat(compressedSizeMB) * 3 > 200) {
    console.warn(`[runReplicateStep] WARNING: High memory usage detected (~${estimatedMemoryMB}MB). Consider reducing input size or using smaller scale steps.`);
  }
  
  // Try to help GC by clearing large references
  // Note: In Deno/JS we can't force GC, but clearing references helps
  
  console.log(`[runReplicateStep] Step completed successfully in ${((Date.now() - stepStartTime) / 1000).toFixed(1)}s`);
  
  // Return compressed JPEG buffer - much smaller than original PNG
  return compressedBuffer;
}

async function ensurePng(buffer: Uint8Array): Promise<Uint8Array> {
  // Decode the buffer (could be PNG or JPEG from previous step)
  const image = await decode(buffer);
  // Return as PNG for final step
  return image.encode("png");
}

function enforceDimensionLimit(width: number, height: number): number {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= DIMENSION_LIMIT) {
    return 1;
  }
  return DIMENSION_LIMIT / maxEdge;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Set a timeout for the entire function execution
  // Supabase Pro plan allows up to 300 seconds, but we'll set a safety margin
  const FUNCTION_TIMEOUT = 280000; // 280 seconds (4m 40s) to leave margin for response
  const functionStartTime = Date.now();

  try {
    const payload = (await req.json()) as RequestPayload;
    if (!payload.imageBase64 || !payload.scale) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: imageBase64, scale" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Replicate API token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${replicateToken}`,
    });

    const quality = payload.quality ?? "photo";
    const plan = normalizePlan(payload.plan);
    const requestedScale = Number(payload.scale);
    
    // Extract and decode input image
    const originalInput = extractBase64Data(payload.imageBase64);
    let workingImage = await decode(originalInput.buffer);
    let originalWidth = workingImage.width;
    let originalHeight = workingImage.height;
    
    console.log(`[upscaler] Input image: ${originalWidth}x${originalHeight} (${originalInput.mimeType}), target scale: ${requestedScale}x`);
    
    // Supabase Edge Functions have 256MB memory limit (not 1GB)
    // For 12x upscaling with [2, 2, 2, 2, 2, 2] chain, limit to 768px max
    // This ensures: 768px → 1536px → 3072px → 6144px → 12288px → 24576px → 49152px
    // But we'll clamp final output to 12k dimension limit
    // Very conservative for 256MB Edge Function limit
    const MAX_INPUT_DIMENSION = requestedScale === 12 
      ? 512  // Very conservative limit for 12x with 6-step chain (256MB Edge Function)
      : Math.min(2048, Math.floor(1536 / Math.ceil(Math.sqrt(requestedScale / 4))));
    const maxInputEdge = Math.max(originalWidth, originalHeight);
    
    if (maxInputEdge > MAX_INPUT_DIMENSION) {
      const scaleFactor = MAX_INPUT_DIMENSION / maxInputEdge;
      const newWidth = Math.floor(originalWidth * scaleFactor);
      const newHeight = Math.floor(originalHeight * scaleFactor);
      console.log(`[upscaler] Resizing input from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight} (scale: ${scaleFactor.toFixed(3)}) to fit Micro plan limits`);
      workingImage = workingImage.resize(newWidth, newHeight);
      originalWidth = newWidth;
      originalHeight = newHeight;
    }
    
    const inputBufferSizeMB = (originalInput.buffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[upscaler] Input image ready: ${originalWidth}x${originalHeight}, buffer: ${inputBufferSizeMB}MB`);

    // Replicate documentation: "Use HTTP URLs for files exceeding 256KB or reusable content"
    // Upload input image to Supabase Storage and use HTTP URL to reduce Edge Function memory usage
    // This is especially important for 12x upscaling with 6 steps
    let inputImageUrl: string;
    const inputImageSizeKB = originalInput.buffer.byteLength / 1024;
    let workingBuffer = await workingImage.encode("png");
    
    if (inputImageSizeKB > 256 || requestedScale >= 12) {
      // Upload to storage for large images or high-scale upscaling
      const timestamp = Date.now();
      const inputFileName = `temp_input_${timestamp}_${Math.random().toString(36).substring(7)}.png`;
      
      const { error: uploadError } = await supabase.storage.from("images").upload(
        `temp/${inputFileName}`,
        workingBuffer,
        {
          contentType: "image/png",
          upsert: false,
        },
      );
      
      if (uploadError) {
        console.warn(`[upscaler] Failed to upload input to storage, using data URL: ${uploadError.message}`);
        // Fallback to data URL if upload fails
        inputImageUrl = `data:image/png;base64,${btoa(String.fromCharCode(...workingBuffer))}`;
      } else {
        const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${inputFileName}`);
        inputImageUrl = urlData.publicUrl;
        console.log(`[upscaler] Input image uploaded to storage: ${inputImageUrl} (saves memory in Edge Function)`);
      }
    } else {
      // Use data URL for small images
      inputImageUrl = `data:image/png;base64,${btoa(String.fromCharCode(...workingBuffer))}`;
    }

    const planMax = PLAN_MAX_SCALE[plan];
    const animeCap = quality === "anime" ? 8 : planMax;
    if (requestedScale > animeCap) {
      return new Response(
        JSON.stringify({ success: false, error: "Your current plan does not support this scale." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const guardScale = DIMENSION_LIMIT / Math.max(originalWidth, originalHeight);
    const maxByGuard = Math.min(requestedScale, guardScale);
    const effectiveTarget = clampScaleToAllowed(Math.min(animeCap, Math.max(2, maxByGuard)));

    console.log(`[upscaler] Creating orchestration steps for scale: ${effectiveTarget}x, quality: ${quality}, original size: ${originalWidth}x${originalHeight}`);
    

    
    const steps = createOrchestrationSteps(quality, effectiveTarget, {
      maxDetail: payload.maxDetail ?? false,
      userSelectedModel: payload.selectedModel,
    });

    if (!steps.length) {
      const error = "Failed to determine upscaling plan for requested settings.";
      console.error(`[upscaler] ${error}`);
      throw new Error(error);
    }

    console.log(
      `[upscaler] Executing ${steps.length} upscale step(s) to achieve ~${effectiveTarget}x for ${quality}. Steps: ${JSON.stringify(steps.map(s => ({ slug: s.slug, scale: s.scale })))}`
    );

    // Use the preprocessed image (workingBuffer already created above for storage upload)
    // workingBuffer is already defined above when we uploaded to storage
    let workingMime = "image/png";
    let currentWidth = originalWidth;
    let currentHeight = originalHeight;

    for (let i = 0; i < steps.length; i++) {
      // Check function timeout before each step
      const elapsed = Date.now() - functionStartTime;
      if (elapsed > FUNCTION_TIMEOUT) {
        const timeoutMsg = `Function timeout: ${(elapsed / 1000).toFixed(1)}s elapsed, limit is ${FUNCTION_TIMEOUT / 1000}s. The upscaling operation is taking too long. Consider using a smaller scale or breaking it into multiple requests.`;
        console.error(`[upscaler] ${timeoutMsg}`);
        throw new Error(timeoutMsg);
      }

      const step = steps[i];
      const remainingTime = ((FUNCTION_TIMEOUT - elapsed) / 1000).toFixed(0);
      const bufferSizeMB = (workingBuffer.byteLength / 1024 / 1024).toFixed(2);
      const estimatedMemoryMB = (parseFloat(bufferSizeMB) * 3).toFixed(2);
      console.log(`[upscaler] Executing step ${i + 1}/${steps.length}: scale=${step.scale}, model=${step.slug}, remaining time: ~${remainingTime}s`);
      console.log(`[upscaler] Step ${i + 1} input: ${currentWidth}x${currentHeight}, buffer: ${bufferSizeMB}MB, estimated memory: ~${estimatedMemoryMB}MB`);
      
      try {
        // For intermediate steps, convert JPEG to PNG for Replicate API
        // Do this conversion efficiently to minimize memory usage
        let stepDataUrl: string;
        
        if (i === 0 && inputImageUrl.startsWith('http')) {
          // First step: use HTTP URL from storage if available (reduces memory)
          stepDataUrl = inputImageUrl;
          console.log(`[upscaler] Step ${i + 1} using HTTP URL from storage to reduce memory usage`);
        } else if (workingMime === "image/jpeg") {
          // Decode JPEG and encode to PNG for API
          // We'll keep the PNG buffer only during the API call
          const tempImage = await decode(workingBuffer);
          const tempPngBuffer = await tempImage.encode("png");
          stepDataUrl = uint8ToDataUrl(tempPngBuffer, "image/png");
          // tempImage and tempPngBuffer will be garbage collected after this block
        } else {
          // First step: use PNG directly (fallback if HTTP URL not available)
          stepDataUrl = uint8ToDataUrl(workingBuffer, workingMime);
        }
        
        const stepBuffer = await runReplicateStep(
          headers, 
          step, 
          stepDataUrl,
          currentWidth,
          currentHeight
        );
        
        // Replace working buffer with compressed JPEG from step
        workingBuffer = stepBuffer;
        workingMime = "image/jpeg";
        
        // Update dimensions for next step
        // Decode only to get dimensions - this is necessary but temporary
        const stepImage = await decode(workingBuffer);
        const prevWidth = currentWidth;
        const prevHeight = currentHeight;
        currentWidth = stepImage.width;
        currentHeight = stepImage.height;
        // stepImage will be garbage collected
        
        const stepElapsed = ((Date.now() - functionStartTime) / 1000).toFixed(1);
        const newBufferSizeMB = (workingBuffer.byteLength / 1024 / 1024).toFixed(2);
        const newEstimatedMemoryMB = (parseFloat(newBufferSizeMB) * 3).toFixed(2);
        console.log(`[upscaler] Step ${i + 1}/${steps.length} completed: ${prevWidth}x${prevHeight} -> ${currentWidth}x${currentHeight}`);
        console.log(`[upscaler] Step ${i + 1} output: buffer: ${newBufferSizeMB}MB, estimated memory: ~${newEstimatedMemoryMB}MB, elapsed: ${stepElapsed}s`);
        
        // Warn if memory usage is getting high
        if (parseFloat(newBufferSizeMB) * 3 > 200) {
          console.warn(`[upscaler] WARNING: High memory usage after step ${i + 1} (~${newEstimatedMemoryMB}MB).`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[upscaler] Step ${i + 1}/${steps.length} failed: ${errorMsg}`);
        throw new Error(`Upscaling step ${i + 1} failed: ${errorMsg}`);
      }
    }
    
    const totalElapsed = ((Date.now() - functionStartTime) / 1000).toFixed(1);
    const finalBufferSizeMB = (workingBuffer.byteLength / 1024 / 1024).toFixed(2);
    const finalEstimatedMemoryMB = (parseFloat(finalBufferSizeMB) * 3).toFixed(2);
    console.log(`[upscaler] All ${steps.length} step(s) completed successfully in ${totalElapsed}s`);
    console.log(`[upscaler] Final result: ${currentWidth}x${currentHeight}, buffer: ${finalBufferSizeMB}MB, estimated memory: ~${finalEstimatedMemoryMB}MB`);
    
    // For final image, decode and prepare for upload
    // If it's JPEG from intermediate step, decode it first
    let finalBuffer = workingBuffer;
    if (workingMime === "image/jpeg") {
      console.log(`[upscaler] Converting final JPEG to PNG for processing...`);
      const finalImage = await decode(workingBuffer);
      finalBuffer = await finalImage.encode("png");
      const pngSizeMB = (finalBuffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`[upscaler] Converted to PNG: ${pngSizeMB}MB`);
    }

    const finalImagePrep = await prepareImageForUpload(finalBuffer);

    if (finalImagePrep.uploadBuffer.byteLength > SUPABASE_UPLOAD_LIMIT) {
      throw new Error(
        `Unable to reduce final image under storage limit (final size ${(
          finalImagePrep.uploadBuffer.byteLength /
          (1024 * 1024)
        ).toFixed(2)}MB)`
      );
    }

    const timestamp = Date.now();
    const inputFileName = `input_${timestamp}.png`;
    const outputFileName = `output_${timestamp}.jpeg`;

    const { error: inputUploadError } = await supabase.storage.from("images").upload(
      `images/${inputFileName}`,
      originalInput.buffer,
      {
        contentType: originalInput.mimeType,
        upsert: false,
      },
    );
    if (inputUploadError) {
      throw new Error(`Failed to upload original image: ${inputUploadError.message}`);
    }

    const { error: outputUploadError } = await supabase.storage.from("images").upload(
      `images/${outputFileName}`,
      finalImagePrep.uploadBuffer,
      {
        contentType: finalImagePrep.mimeType,
        upsert: false,
      },
    );
    if (outputUploadError) {
      throw new Error(`Failed to upload upscaled image: ${outputUploadError.message}`);
    }

    const { data: inUrlData } = supabase.storage.from("images").getPublicUrl(`images/${inputFileName}`);
    const { data: outUrlData } = supabase.storage.from("images").getPublicUrl(`images/${outputFileName}`);

    const responseBody = {
      success: true,
      appliedScale: Number((finalImagePrep.width / originalWidth).toFixed(2)),
      originalDimensions: { width: originalWidth, height: originalHeight },
      upscaledDimensions: { width: finalImagePrep.width, height: finalImagePrep.height },
      inputUrl: inUrlData.publicUrl,
      outputUrl: outUrlData.publicUrl,
      compressionQuality: finalImagePrep.quality,
      wasResizedDuringCompression: finalImagePrep.resized,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    console.error("[upscaler] Function error:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
