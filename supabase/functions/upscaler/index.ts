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
  slug: "cjwbw/controlnet-tile-resize:ba56d5417f3f2cfb8647dd0a1059159f061d7abf6c88c88cba41c4d1aba2fe66",
  input: {
    model: "ControlNetTile",
    prompt: "high quality detailed upscale with preserved structure",
    negative_prompt: "blurry, artifacts, distortions",
    tile_size: 512,
  },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
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
  
  // Otherwise, use the existing automatic selection logic
  const preferExtreme = scale >= 16 && !!options.maxDetail;

  switch (category) {
    case "photo":
      if (preferExtreme) {
        return CONTROLNET_TILE_MODEL;
      }
      return {
        ...PHOTO_MODEL,
        input: { ...PHOTO_MODEL.input, face_enhance: scale <= 4 },
      };
    case "art":
    case "text":
      if (preferExtreme) {
        return CONTROLNET_TILE_MODEL;
      }
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
      if (preferExtreme) {
        return CONTROLNET_TILE_MODEL;
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
    'photo': { max: 8, model: PHOTO_MODEL },
    'anime': { max: 8, model: ANIME_MODEL },
    'art': { max: 4, model: ART_TEXT_MODEL },
    'text': { max: 4, model: ART_TEXT_MODEL },
  };

  const range = modelRanges[category];
  if (!range) return null;

  // If scale is within primary model's optimal range, use primary model
  if (scale <= range.max) {
    return {
      ...range.model,
      input: { 
        ...range.model.input, 
        face_enhance: category === 'photo' && scale <= 4 
      }
    };
  }

  // For higher scales, use ControlNet
  return CONTROLNET_TILE_MODEL;
}

function buildScaleChain(target: number): number[] {
  const chain: number[] = [];
  let remaining = target;

  while (remaining > 4) {
    chain.push(4);
    remaining /= 4;
  }

  if (remaining > 1) {
    chain.push(remaining);
  }

  return chain;
}

function createOrchestrationSteps(
  category: Quality,
  targetScale: number,
  options: { maxDetail?: boolean; userSelectedModel?: string } = {}
): OrchestrationStep[] {
  const chain = buildScaleChain(targetScale);
  const steps: OrchestrationStep[] = [];

  for (const segment of chain) {
    if (segment <= 1) {
      continue;
    }

    const model = selectModelFor(category, segment, options);

    if (model.nativeScales.includes(segment)) {
      steps.push({ slug: model.slug, scale: segment, input: model.input });
      continue;
    }

    if (model.supportsOutscale && model.nativeScales.length) {
      const base = Math.max(...model.nativeScales.filter((ns) => ns <= segment));
      const outscale = segment / base;
      const maxOutscale = model.maxOutscale ?? outscale;
      steps.push({
        slug: model.slug,
        scale: base,
        outscale: Math.min(outscale, maxOutscale),
        input: model.input,
      });
      continue;
    }

    throw new Error("Unable to create orchestration steps with available models.");
  }

  const product = steps.reduce((acc, step) => acc * step.scale * (step.outscale ?? 1), 1);
  if (Math.abs(product - targetScale) > 0.05) {
    throw new Error("Orchestration steps failed to match requested scale.");
  }

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
  imageDataUrl: string
): Promise<Uint8Array> {
  const version = step.slug.split(":")[1];
  const input: Record<string, unknown> = {
    ...step.input,
    image: imageDataUrl,
    scale: step.scale,
  };
  if (step.outscale) {
    input.outscale = step.outscale;
  }

  const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers,
    body: JSON.stringify({ version, input }),
  });

  if (!predictionRes.ok) {
    const errText = await predictionRes.text();
    throw new Error(`Replicate prediction failed: ${errText}`);
  }

  let prediction = await predictionRes.json();
  const maxPoll = 120;
  let attempts = 0;

  while ((prediction.status === "starting" || prediction.status === "processing") && attempts < maxPoll) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers,
    });
    if (!statusRes.ok) {
      throw new Error("Failed to poll Replicate prediction status");
    }
    prediction = await statusRes.json();
    attempts += 1;
  }

  if (prediction.status !== "succeeded" || !prediction.output) {
    const err = prediction.error ?? "Replicate step failed";
    throw new Error(err);
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const outputRes = await fetch(outputUrl);
  if (!outputRes.ok) {
    throw new Error(`Failed to download Replicate output: ${outputRes.statusText}`);
  }

  const arrayBuffer = await outputRes.arrayBuffer();
  const pngBuffer = await ensurePng(new Uint8Array(arrayBuffer));
  return pngBuffer;
}

async function ensurePng(buffer: Uint8Array): Promise<Uint8Array> {
  const image = await decode(buffer);
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
    const originalInput = extractBase64Data(payload.imageBase64);
    const originalImage = await decode(originalInput.buffer);
    const originalWidth = originalImage.width;
    const originalHeight = originalImage.height;

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

    const steps = createOrchestrationSteps(quality, effectiveTarget, {
      maxDetail: payload.maxDetail ?? false,
      userSelectedModel: payload.selectedModel,
    });

    if (!steps.length) {
      throw new Error("Failed to determine upscaling plan for requested settings.");
    }

    console.log(
      `Executing ${steps.length} upscale step(s) to achieve ~${effectiveTarget}x for ${quality}`
    );

    let workingBuffer = originalInput.buffer;
    let workingMime = originalInput.mimeType;
    let workingDataUrl = uint8ToDataUrl(workingBuffer, workingMime);

    for (const step of steps) {
      const stepBuffer = await runReplicateStep(headers, step, workingDataUrl);
      workingBuffer = stepBuffer;
      workingMime = "image/png";
      workingDataUrl = uint8ToDataUrl(workingBuffer, workingMime);
    }

    const finalImagePrep = await prepareImageForUpload(workingBuffer);

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
    console.error("Upscaler function error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
