/*
  # Upscale Init Edge Function
  
  Initializes multi-stage upscaling job and starts first prediction.
  Uses webhook-based async processing to avoid memory issues.
*/

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.2";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Plan scale limits - updated for new tier structure
// Free tier handled separately (max 4x)
const PLAN_MAX_SCALE: Record<string, number> = {
  free: 4,        // Free: 2x, 4x only
  starter: 8,     // Starter: up to 8x
  basic: 8,       // Legacy basic = starter
  pro: 16,        // Pro: up to 16x
  power: 24,      // Power: up to 24x
  enterprise: 24, // Legacy enterprise = power
  unlimited: 24,  // Unlimited: up to 24x
  mega: 24,       // Legacy mega = unlimited (capped at 24x now)
};

// Maximum allowed output dimension (pixels) to keep browser + GPU safe
const DIMENSION_LIMIT = 65536;

type Quality = "photo" | "art" | "text" | "anime";
type PlanTier = keyof typeof PLAN_MAX_SCALE;

interface RequestPayload {
  imageBase64: string;
  scale: number;
  quality?: Quality;
  maxDetail?: boolean;
  plan?: PlanTier;
  selectedModel?: string;
  userId?: string;
  qualityMode?: 'speed' | 'quality'; // NEW: Speed vs Quality mode
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
  qualityMode: 'speed' | 'quality'; // NEW: Track processing mode
}

interface ReplicateModelInfo {
  slug: string;
  input: Record<string, unknown>;
  nativeScales: number[];
}

const PHOTO_MODEL: ReplicateModelInfo = {
  slug: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
  input: { 
    face_enhance: true
    // tile and tile_pad will be added conditionally when tiling is needed
  },
  nativeScales: [2, 4],
};

const ART_TEXT_MODEL: ReplicateModelInfo = {
  slug: "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
  input: {},  // No tiling at native scales
  nativeScales: [2, 4],
};

const ANIME_MODEL: ReplicateModelInfo = {
  slug: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
  input: { 
    anime: true  // No tiling at native scales
  },
  nativeScales: [2, 4],
};

const CLARITY_MODEL: ReplicateModelInfo = {
  slug: "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
  input: {
    creativity: 0.35,  // Conservative creativity for balanced results
    resemblance: 0.6,  // High resemblance to preserve original
    scale_factor: 2,   // Will be overridden per stage
  },
  nativeScales: [2], // Only use for 2x passes
};

function getSwinIRModel(scale: number): ReplicateModelInfo {
  let task: string;
  if (scale === 4) {
    task = "Real-World Image Super-Resolution-Large";  // 4x
    console.log(`[getSwinIRModel] Scale ${scale} → Using Large task (4x)`);
  } else if (scale === 2) {
    task = "Real-World Image Super-Resolution-Medium"; // 2x
    console.log(`[getSwinIRModel] Scale ${scale} → Using Medium task (2x)`);
  } else {
    // For other scales (3x, 5x, etc.), default to Medium but log warning
    task = "Real-World Image Super-Resolution-Medium";
    console.warn(`[getSwinIRModel] ⚠️ Unexpected scale ${scale} for SwinIR, defaulting to Medium (2x). Consider using Real-ESRGAN instead.`);
  }
  return {
    ...ART_TEXT_MODEL,
    input: { ...ART_TEXT_MODEL.input, task },  // Merge task with existing input
  };
}

function selectModelFor(category: Quality, scale: number, options: { maxDetail?: boolean; userSelectedModel?: string } = {}): ReplicateModelInfo {
  if (options.userSelectedModel && options.userSelectedModel !== 'auto') {
    return getModelById(options.userSelectedModel, scale);
  }
  
  switch (category) {
    case "photo":
      return {
        ...PHOTO_MODEL,
        input: { ...PHOTO_MODEL.input, face_enhance: scale <= 4 },
      };
    case "art":
    case "text":
      // Use SwinIR 4x for stage 1 only, Real-ESRGAN for all other stages (supports tiling)
      if (scale === 4) {
        console.log(`[selectModelFor] Art/Text at 4x → Using SwinIR 4x`);
        return getSwinIRModel(4);
      } else {
        // Use Real-ESRGAN for 2x and 3x (supports tiling for large intermediate images)
        console.log(`[selectModelFor] Art/Text at ${scale}x → Using Real-ESRGAN (supports tiling)`);
        return {
          ...PHOTO_MODEL,
          input: { ...PHOTO_MODEL.input, face_enhance: false },
        };
      }
    case "anime":
      // Use ANIME_MODEL for native scales (2x, 4x), Real-ESRGAN for higher
      if (scale <= 4) {
        return ANIME_MODEL;
      }
      return {
        ...PHOTO_MODEL,
        input: { ...PHOTO_MODEL.input, face_enhance: false },
      };
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
      return getSwinIRModel(scale);
    case 'anime-real-esrgan':
      return ANIME_MODEL;
    case 'clarity-upscaler':
      return {
        ...CLARITY_MODEL,
        input: { ...CLARITY_MODEL.input, scale_factor: Math.min(scale, 2) }
      };
    default:
      return PHOTO_MODEL;
  }
}

function buildScaleChain(target: number): number[] {
  // Speed-optimized chains using research recommendations
  // Larger steps = fewer API calls = faster & cheaper
  if (target <= 8 && Number.isInteger(target)) {
    return [target]; // Single pass for 2x-8x
  }

  // Optimized chains to minimize max intermediate image size (GPU memory)
  // Strategy: Use 2-stage chains max to ensure reliability
  // Max supported scale: 24x (28x/32x removed - require 3-stage which has issues)
  const chains: Record<number, number[]> = {
    10: [2, 5],         // 10x: 2-stage
    12: [3, 4],         // 12x: 2-stage exact
    16: [4, 4],         // 16x: 2-stage exact
    20: [4, 5],         // 20x: 2-stage exact
    24: [4, 6],         // 24x: 2-stage exact (Real-ESRGAN supports up to 10x)
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  };

  if (chains[target]) {
    return chains[target];
  }

  // Fallback: break down into 2x steps
  const chain: number[] = [];
  let remaining = target;
  while (remaining > 10) {
    chain.push(2);
    remaining /= 2;
  }
  if (remaining >= 2 && remaining <= 10) {
    chain.push(Math.floor(remaining));
  }
  return chain;
}

function buildChainStrategy(
  targetScale: number,
  contentType: Quality,
  options: { maxDetail?: boolean; userSelectedModel?: string; qualityMode?: 'speed' | 'quality' } = {}
): ChainStrategy {
  const qualityMode = options.qualityMode || 'speed';
  
  // Special handling for Art/Text: Use 4x SwinIR for stage 1, Real-ESRGAN for stage 2+
  // Optimized to reach exact target scales without unnecessary downscaling
  let scaleChain: number[];
  if (contentType === 'art' || contentType === 'text') {
    // Art/Text chains - MAX 24x (2-stage only for reliability)
    // 28x/32x/64x REMOVED - require 3-stage which causes GPU memory issues
    const artChains: Record<number, number[]> = {
      2: [4],           // 4x → downscale to 2x
      4: [4],           // 4x native
      8: [4, 2],        // 8x exact (4x SwinIR, 2x Real-ESRGAN)
      10: [4, 4],       // 16x → downscale to 10x
      12: [4, 3],       // 12x exact (4x SwinIR, 3x Real-ESRGAN)
      16: [4, 4],       // 16x exact
      20: [4, 5],       // 20x exact (4x SwinIR, 5x Real-ESRGAN)
      24: [4, 6],       // 24x exact (4x SwinIR, 6x Real-ESRGAN)
    };
    
    scaleChain = artChains[targetScale] || [4];
    const chainProduct = scaleChain.reduce((a, b) => a * b, 1);
    console.log(`[Chain] Art/Text ${targetScale}x → Chain: ${scaleChain.join('×')}× = ${chainProduct}x${chainProduct !== targetScale ? ` → client downscale to ${targetScale}x` : ' (exact match!)'}`);
  } else {
    scaleChain = buildScaleChain(targetScale);
  }
  
  const stages: ChainStage[] = scaleChain.map((scale, index) => {
    let model: ReplicateModelInfo;
    
    if (qualityMode === 'quality') {
      // Quality mode: Mix models for best results
      if (index === 0) {
        // First pass: Real-ESRGAN for fast artifact removal
        model = {
          ...PHOTO_MODEL,
          input: { ...PHOTO_MODEL.input, face_enhance: false }
        };
      } else if (index < scaleChain.length - 1) {
        // Middle passes: SwinIR for texture enhancement
        model = getSwinIRModel(scale);
      } else {
        // Final pass: Best quality model for content type
        model = selectModelFor(contentType, scale, options);
      }
    } else {
      // Speed mode: Single model type optimized for speed
      // CRITICAL FIX: For art/text multi-stage chains, only use SwinIR for stage 1
      // Stages 2+ must use Real-ESRGAN because SwinIR cannot handle large intermediate images
      if ((contentType === 'art' || contentType === 'text') && index > 0 && scaleChain.length > 1) {
        // Force Real-ESRGAN for stages 2+ in multi-stage art/text chains
        console.log(`[Chain] Stage ${index + 1}: Forcing Real-ESRGAN for ${scale}x (large intermediate image)`);
        model = {
          ...PHOTO_MODEL,
          input: { ...PHOTO_MODEL.input, face_enhance: false }
        };
      } else {
        model = selectModelFor(contentType, scale, options);
      }
    }
    
    return {
      stage: index + 1,
      model: model.slug,
      scale: scale,
      input_url: "",
      output_url: null,
      status: "pending",
      prediction_id: null,
    };
  });

  // Calculate costs and time based on mode
  const estimatedTime = qualityMode === 'quality' 
    ? stages.length * 20  // ~20s per stage in quality mode (SwinIR/Clarity are slower)
    : stages.length * 3;   // ~3s per stage in speed mode (Real-ESRGAN is fast)
    
  const estimatedCost = qualityMode === 'quality'
    ? stages.length * 0.005  // Higher cost for quality mode
    : stages.length * 0.0025; // Standard cost for speed mode

  return {
    targetScale,
    stages,
    estimatedTime,
    estimatedCost,
    qualityMode,
  };
}

function getModelVersion(slug: string): string {
  return slug.split(":")[1];
}

/**
 * Build template configuration for multi-stage splitting
 * This defines exactly how many tiles at each stage and when splitting is needed
 * 
 * Key insight: We need to check the OUTPUT of the previous stage against GPU limit
 * - Stage 1 output = tile * stage1Scale (e.g., 362 * 4 = 1448px)
 * - Stage 2 output = Stage 1 output * stage2Scale (e.g., 1448 * 4 = 5792px)
 * - If Stage 2 output > GPU limit, we need to split BEFORE Stage 3
 */
function buildTemplateConfig(
  targetScale: number,
  tilingGrid: { tilesX: number; tilesY: number; tileWidth: number; tileHeight: number; overlap: number; totalTiles: number },
  chainStrategy: ChainStrategy
): { stages: Array<{ stageNumber: number; scaleMultiplier: number; tileCount: number; splitFromPrevious: number }> } {
  const stages: Array<{ stageNumber: number; scaleMultiplier: number; tileCount: number; splitFromPrevious: number }> = [];
  
  const GPU_MAX_PIXELS = 2096704; // ~1448×1448
  const GPU_MAX_DIM = 1448;
  
  let currentTileCount = tilingGrid.totalTiles;
  
  // Track cumulative tile size through the chain
  // Start with the actual tile dimensions (including overlap)
  let currentTileWidth = tilingGrid.tileWidth + tilingGrid.overlap;
  let currentTileHeight = tilingGrid.tileHeight + tilingGrid.overlap;
  
  console.log(`[TemplateConfig] Initial tile size: ${currentTileWidth}×${currentTileHeight}`);
  console.log(`[TemplateConfig] GPU limit: ${GPU_MAX_DIM}px (${(GPU_MAX_PIXELS/1000000).toFixed(1)}M pixels)`);
  
  for (let i = 0; i < chainStrategy.stages.length; i++) {
    const stage = chainStrategy.stages[i];
    const stageNumber = i + 1;
    
    // Calculate what the INPUT to this stage would be
    // (which is the OUTPUT from the previous stage)
    const inputWidth = currentTileWidth;
    const inputHeight = currentTileHeight;
    const inputPixels = inputWidth * inputHeight;
    
    // Determine if splitting is needed BEFORE this stage
    let splitFromPrevious = 1;
    
    if (stageNumber > 1 && inputPixels > GPU_MAX_PIXELS) {
      // Input exceeds GPU limit - need to split
      // Calculate how many splits needed (2x2 = 4, 3x3 = 9, etc.)
      const maxDim = Math.max(inputWidth, inputHeight);
      const splitFactor = Math.ceil(maxDim / GPU_MAX_DIM);
      splitFromPrevious = splitFactor * splitFactor; // 2x2=4, 3x3=9, 4x4=16
      
      // After splitting, each sub-tile is smaller
      currentTileWidth = Math.ceil(inputWidth / splitFactor);
      currentTileHeight = Math.ceil(inputHeight / splitFactor);
      currentTileCount = currentTileCount * splitFromPrevious;
      
      console.log(`[TemplateConfig] Stage ${stageNumber}: Split required!`);
      console.log(`[TemplateConfig]   Input would be: ${inputWidth}×${inputHeight} = ${(inputPixels/1000000).toFixed(1)}M pixels`);
      console.log(`[TemplateConfig]   GPU limit: ${(GPU_MAX_PIXELS/1000000).toFixed(1)}M pixels`);
      console.log(`[TemplateConfig]   Split factor: ${splitFactor}×${splitFactor} = ${splitFromPrevious}`);
      console.log(`[TemplateConfig]   After split: ${currentTileWidth}×${currentTileHeight} per sub-tile`);
      console.log(`[TemplateConfig]   Tile count: ${currentTileCount}`);
    }
    
    stages.push({
      stageNumber,
      scaleMultiplier: stage.scale,
      tileCount: currentTileCount,
      splitFromPrevious
    });
    
    console.log(`[TemplateConfig] Stage ${stageNumber}: ${stage.scale}x, ${currentTileCount} tiles, splitFromPrevious=${splitFromPrevious}`);
    
    // Update tile size for next stage (output = input * scale)
    currentTileWidth = currentTileWidth * stage.scale;
    currentTileHeight = currentTileHeight * stage.scale;
    
    console.log(`[TemplateConfig] Stage ${stageNumber} output: ${currentTileWidth}×${currentTileHeight}`);
  }
  
  return { stages };
}

function extractBase64Data(dataUrl: string): { buffer: Uint8Array; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 data URL");
  }
  const mimeType = match[1];
  const base64Data = match[2];
  const binaryString = atob(base64Data);
  const buffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  return { buffer, mimeType };
}

function normalizePlan(plan?: string): PlanTier {
  const normalized = (plan || "basic").toLowerCase();
  if (normalized in PLAN_MAX_SCALE) {
    return normalized as PlanTier;
  }
  return "basic";
}

// ============================================================================
// ADAPTIVE TILING SYSTEM
// ============================================================================

interface TileInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: Uint8Array;
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
  status: "pending" | "stage1_processing" | "stage1_complete" | "stage2_processing" | "stage2_complete" | "failed";
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

/**
 * Calculate optimal tiling grid based on image size, target scale, and GPU constraints
 * 
 * Constraints:
 * 1. GPU Limit: tile × largestScaleInChain ≤ 1448px (Replicate's ~2.1M pixel limit)
 * 2. Quality: tile ≥ 200px (preserve detail in original image)
 * 3. Efficiency: minimize total tiles while meeting above constraints
 */
function calculateOptimalTiling(
  width: number,
  height: number,
  chainStrategy: ChainStrategy,
  targetScale: number,
  contentType: Quality
): TilingGrid | null {
  // ============================================================================
  // NATIVE SCALE BYPASS: Skip tiling for models that support native scaling
  // ============================================================================
  
  // SwinIR and ANIME models can handle larger images natively at their native scales
  // without needing Replicate's tile-based processing. Only use our tiling for:
  // 1. Multi-stage chains (6x+)
  // 2. Very large images that exceed safe processing limits
  
  const isSingleStage = chainStrategy.stages.length === 1;
  const firstStageModel = chainStrategy.stages[0]?.model || '';
  
  // Check if using SwinIR (for art/text) or ANIME model
  const isSwinIR = firstStageModel.includes('swinir');
  const isAnime = firstStageModel.includes('real-esrgan') && contentType === 'anime';
  const isRealESRGAN = firstStageModel.includes('real-esrgan') && !isAnime;
  const isArtContent = contentType === 'art' || contentType === 'text';
  
  // For single-stage native scales, check if image is within safe processing limits
  // SwinIR and ANIME can handle ~1400×1400 images natively without issues
  const NATIVE_SAFE_DIMENSION = 1400;
  const isWithinNativeLimits = width <= NATIVE_SAFE_DIMENSION && height <= NATIVE_SAFE_DIMENSION;
  
  // Skip tiling for Real-ESRGAN at 2x if image is small enough
  // Real-ESRGAN can handle up to ~1400px at 2x without tiling
  if (isSingleStage && isRealESRGAN && targetScale === 2 && isWithinNativeLimits) {
    console.log(`[Tiling] ✅ Skipping tiling - Real-ESRGAN can handle ${width}×${height} natively at 2×`);
    return null;
  }
  
  // For Art/Text with SwinIR: Skip tiling only for small images
  // Large images need tiling even with SwinIR to handle 4x processing
  if (isSingleStage && isSwinIR && isArtContent && isWithinNativeLimits) {
    console.log(`[Tiling] ✅ Skipping tiling - Image ${width}×${height} small enough for whole-image SwinIR 4x processing`);
    return null;
  }
  
  // For larger Art images, proceed with tiling
  if (isSwinIR && isArtContent && !isWithinNativeLimits) {
    console.log(`[Tiling] ⚠️ Image ${width}×${height} exceeds limit - will tile for SwinIR 4x processing`);
  }
  
  // For ANIME model
  if (isSingleStage && isAnime && isWithinNativeLimits) {
    console.log(`[Tiling] ✅ Skipping tiling - ANIME can handle ${width}×${height} natively at ${targetScale}×`);
    return null;
  }
  
  // For larger images or multi-stage chains, proceed with tiling
  if (isSingleStage && (isSwinIR || isAnime)) {
    console.log(`[Tiling] ⚠️ Image ${width}×${height} exceeds native limit (${NATIVE_SAFE_DIMENSION}px), will use tiling for safety`);
  }
  
  const GPU_MEMORY_LIMIT_PIXELS = 2096704; // ~2.1M pixels (Replicate GPU limit)
  const GPU_SAFE_MARGIN = 0.80; // Use 80% of limit for safety (conservative for multi-stage)
  const BASE_OVERLAP = 64; // Base overlap for blending
  
  // ============================================================================
  // SMART MIN_TILE_SIZE: Calculate based on actual chain strategy
  // ============================================================================
  // Instead of using arbitrary values based on target scale, calculate the
  // minimum tile size needed to stay within GPU limits at each stage.
  // This dramatically reduces unnecessary tiling!
  //
  // Formula: MIN_TILE_SIZE = GPU_LIMIT / (max_input_scale_in_chain)
  //
  // Example for Art 16x (chain: [4, 4]):
  //   - Stage 1 receives: 1× (original)
  //   - Stage 2 receives: 4× (output of stage 1) ← GPU bottleneck!
  //   - MIN_TILE_SIZE = 1448 / 4 = 362px minimum
  //   - Add 2.8× safety margin for quality: 362 × 2.8 = ~1014px
  //   - Result: 720×540 needs 1×1 = 1 tile (not 20!)
  
  // Calculate tile size based on GPU INPUT limits at EACH stage
  // Each tile is processed independently, so GPU is freed between tiles.
  // The constraint is the INPUT dimension to each stage's model.
  //
  // For 16× Art (chain: [4×, 4×]) with original tile size T:
  //   Stage 1 INPUT: T (must fit in GPU) → Stage 1 OUTPUT: T×4
  //   Stage 2 INPUT: T×4 (must fit in GPU) → Stage 2 OUTPUT: T×16
  //
  // For 32× Art (chain: [4×, 4×, 2×]) with original tile size T:
  //   Stage 1 INPUT: T → Stage 1 OUTPUT: T×4
  //   Stage 2 INPUT: T×4 → Stage 2 OUTPUT: T×16
  //   Stage 3 INPUT: T×16 (must fit in GPU!) → Stage 3 OUTPUT: T×32
  //
  // GPU limit: input_dimension ≤ 1448px (√2.1M pixels)
  // For 3-stage: T×16 ≤ 1448 → max tile = 90px ← Bottleneck!
  //
  // Calculate MIN_TILE_SIZE dynamically based on GPU limit and CUMULATIVE scale
  // Principle: The input to the LAST stage must fit within GPU limit
  // Last stage input = tileSize × (product of all previous stage scales)
  // Therefore: MIN_TILE_SIZE = maxInputDimension / cumulativeScaleBeforeLastStage
  //
  // This ensures the calculation works for ANY number of stages.
  
  const maxInputDimension = Math.sqrt(GPU_MEMORY_LIMIT_PIXELS); // ~1448px (no artificial margin)
  const firstStageScale = chainStrategy.stages[0].scale;
  const finalScale = chainStrategy.stages.reduce((acc, s) => acc * s.scale, 1);
  
  // Calculate tile size based on Stage 2 input constraint only
  // Client-side splitting will handle larger tiles for Stage 3+
  // This gives us ~12 tiles instead of ~130 tiles
  const numStages = chainStrategy.stages.length;
  
  // For initial tiling, only consider Stage 1 → Stage 2 transition
  // Stage 2 input must fit in GPU: tile * firstStageScale <= maxInputDimension
  // Therefore: MIN_TILE_SIZE = maxInputDimension / firstStageScale
  // 
  // For 2-stage (4x→4x): MIN_TILE = 1448/4 = 362px (Stage 2 input = 362*4 = 1448px ✓)
  // For 3-stage (4x→4x→2x): MIN_TILE = 1448/4 = 362px (Stage 2 input = 1448px ✓)
  //   Stage 3 will need client-side splitting since Stage 2 output = 1448*4 = 5792px > GPU limit
  //
  // This approach:
  // - Starts with ~12 manageable tiles
  // - Client splits tiles between Stage 2 and Stage 3 when needed
  const MIN_TILE_SIZE = Math.floor(maxInputDimension / firstStageScale);
  
  console.log(`[Tiling] Image: ${width}×${height}, Chain: ${chainStrategy.stages.map(s => s.scale).join('×→')}× = ${finalScale}×`);
  console.log(`[Tiling] Number of stages: ${numStages}`);
  console.log(`[Tiling] First stage scale: ${firstStageScale}×`);
  console.log(`[Tiling] MIN_TILE_SIZE: ${MIN_TILE_SIZE}px (${Math.floor(maxInputDimension)}px / ${firstStageScale}x)`);
  console.log(`[Tiling] Stage 2 input per tile: ${MIN_TILE_SIZE * firstStageScale}px`);
  if (numStages > 2) {
    console.log(`[Tiling] ℹ️ Client-side splitting will handle Stage 3+ GPU limits`);
  }
  
  let baseTileSize = MIN_TILE_SIZE;
  
  // For 3+ stage chains, the calculated MIN_TILE_SIZE may be very small (e.g., 90px)
  // Ensure a minimum tile size for quality, but not so large it breaks GPU limits
  const ABSOLUTE_MIN_TILE = 64; // Minimum for any reasonable quality
  if (baseTileSize < ABSOLUTE_MIN_TILE) {
    console.log(`[Tiling] ⚠️ Calculated tile size ${baseTileSize}px is below minimum ${ABSOLUTE_MIN_TILE}px`);
    baseTileSize = ABSOLUTE_MIN_TILE;
  }
  
  // SwinIR-specific safety adjustment (only if we have headroom)
  if (isSwinIR && isArtContent && numStages <= 2) {
    // Only apply SwinIR safety reduction for 1-2 stage chains
    // For 3+ stages, we're already at minimum tile sizes
    const SWINIR_SAFETY_MULTIPLIER = 0.75;
    const SWINIR_MIN_TILE = 224;
    const adjustedTile = Math.max(SWINIR_MIN_TILE, Math.floor(baseTileSize * SWINIR_SAFETY_MULTIPLIER));
    if (adjustedTile < baseTileSize) {
      console.log(`[Tiling] 🔧 SwinIR safety: reducing base tile from ${baseTileSize}px to ${adjustedTile}px to avoid GPU OOM`);
      baseTileSize = adjustedTile;
    }
  }
  
  console.log(`[Tiling] 🎯 Final baseTileSize: ${baseTileSize}px (for ${numStages}-stage chain)`);
  
  // Validate Stage 1 and Stage 2 inputs will fit in GPU memory
  // Stage 3+ will be handled by client-side splitting
  const stagesToValidate = Math.min(numStages, 2);
  let cumulativeScale = 1;
  for (let i = 0; i < stagesToValidate; i++) {
    const stageInputSize = baseTileSize * cumulativeScale;
    if (stageInputSize > maxInputDimension) {
      console.error(`[Tiling] ERROR: Stage ${i + 1} input ${stageInputSize}px exceeds GPU limit ${Math.floor(maxInputDimension)}px`);
      throw new Error(`Tiling calculation error: stage ${i + 1} input would exceed GPU memory`);
    }
    console.log(`[Tiling] ✅ Stage ${i + 1} input: ${stageInputSize}px ≤ ${Math.floor(maxInputDimension)}px`);
    cumulativeScale *= chainStrategy.stages[i].scale;
  }
  if (numStages > 2) {
    console.log(`[Tiling] ℹ️ Stage 3+ inputs will be validated after client-side splitting`);
  } else {
    console.log(`[Tiling] ✅ All ${numStages} stages validated for GPU memory limits`);
  }
  
  // Adaptive overlap: reduce for very high scales to prevent negative tile sizes
  const OVERLAP = finalScale > 16 
    ? Math.max(32, Math.floor(BASE_OVERLAP * (16 / finalScale)))
    : BASE_OVERLAP;
  
  console.log(`[Tiling] Using overlap: ${OVERLAP}px (adaptive for ${finalScale}× final scale)`);
  
  console.log(`[Tiling] ✅ Using baseTileSize: ${baseTileSize}px`)
  
  // Check if tiling is needed
  if (width <= baseTileSize && height <= baseTileSize) {
    console.log(`[Tiling] No tiling needed - image fits within tile size limits`);
    return null; // No tiling needed
  }
  
  // Calculate tiles needed for each dimension
  let tilesX = Math.ceil(width / baseTileSize);
  let tilesY = Math.ceil(height / baseTileSize);
  
  // Calculate actual tile dimensions (distribute pixels evenly)
  // CRITICAL: Account for overlap when calculating tile size
  // The actual extracted tile will be: tileWidth + overlap (on edges)
  // So we must ensure: tileWidth + overlap ≤ MIN_TILE_SIZE * firstStageScale ≤ GPU_LIMIT
  // Therefore: tileWidth ≤ MIN_TILE_SIZE - overlap
  const maxBaseTileSize = baseTileSize - OVERLAP;
  
  let tileWidth = Math.min(Math.ceil(width / tilesX), maxBaseTileSize);
  let tileHeight = Math.min(Math.ceil(height / tilesY), maxBaseTileSize);
  
  // Recalculate grid if tiles were clamped
  if (Math.ceil(width / tilesX) > maxBaseTileSize) {
    tilesX = Math.ceil(width / maxBaseTileSize);
  }
  if (Math.ceil(height / tilesY) > maxBaseTileSize) {
    tilesY = Math.ceil(height / maxBaseTileSize);
  }
  
  console.log(`[Tiling] Max base tile size (accounting for overlap): ${maxBaseTileSize}px`);
  console.log(`[Tiling] Calculated tile dimensions: ${tileWidth}×${tileHeight}px`);
  console.log(`[Tiling] Max actual tile size with overlap: ${tileWidth + OVERLAP}×${tileHeight + OVERLAP}px`);
  
  // Validate tile dimensions are positive (safety check)
  if (tileWidth <= 0 || tileHeight <= 0) {
    console.error(`[Tiling] ❌ Invalid tile dimensions: ${tileWidth}×${tileHeight}`);
    throw new Error(`Cannot tile image: calculated tile size is invalid (${tileWidth}×${tileHeight}). Image may require different scale chain.`);
  }
  
  if (tilesX <= 0 || tilesY <= 0) {
    console.error(`[Tiling] ❌ Invalid grid dimensions: ${tilesX}×${tilesY}`);
    throw new Error(`Cannot tile image: calculated grid is invalid (${tilesX}×${tilesY})`);
  }
  
  const grid: TilingGrid = {
    tilesX,
    tilesY,
    tileWidth,
    tileHeight,
    overlap: OVERLAP,
    totalTiles: tilesX * tilesY
  };
  
  console.log(`[Tiling] Grid: ${tilesX}×${tilesY} (${grid.totalTiles} tiles), Tile size: ${tileWidth}×${tileHeight}, Overlap: ${OVERLAP}px`);
  
  // Validate stage 1 output size (critical constraint)
  const stage1OutputDimension = tileWidth * firstStageScale;
  const stage1OutputPixels = stage1OutputDimension * stage1OutputDimension;
  
  console.log(`[Tiling] Stage 1 output: ${stage1OutputDimension}×${stage1OutputDimension} (${(stage1OutputPixels / 1000000).toFixed(1)}M pixels)`);
  
  if (stage1OutputPixels > GPU_MEMORY_LIMIT_PIXELS) {
    console.error(`[Tiling] ❌ Stage 1 output ${stage1OutputDimension}px exceeds GPU limit ${Math.sqrt(GPU_MEMORY_LIMIT_PIXELS).toFixed(0)}px!`);
  } else {
    console.log(`[Tiling] ✅ Stage 1 output within GPU limit`);
  }
  
  // Log subsequent stages (will use Real-ESRGAN internal tiling)
  if (chainStrategy.stages.length > 1) {
    console.log(`[Tiling] Stage 2+ will use Real-ESRGAN internal tiling (tile: 256) to handle larger inputs`);
    
    let stageCumulative = firstStageScale;
    for (let stageIdx = 1; stageIdx < chainStrategy.stages.length; stageIdx++) {
      stageCumulative *= chainStrategy.stages[stageIdx].scale;
      const stageOutputDimension = tileWidth * stageCumulative;
      const stageOutputPixels = stageOutputDimension * stageOutputDimension;
      
      console.log(`[Tiling] Stage ${stageIdx + 1} (${chainStrategy.stages[stageIdx].scale}×): output ${stageOutputDimension}×${stageOutputDimension} (${(stageOutputPixels / 1000000).toFixed(1)}M pixels) - handled by internal tiling`);
    }
  }
  
  return grid;
}

/**
 * Split an image into overlapping tiles based on the calculated grid
 */
async function splitImageIntoTiles(
  imageBuffer: Uint8Array,
  grid: TilingGrid
): Promise<TileInfo[]> {
  const image = await decode(imageBuffer);
  const tiles: TileInfo[] = [];
  
  // Store original dimensions (image.crop() mutates the image object!)
  const originalWidth = image.width;
  const originalHeight = image.height;
  
  console.log(`[Tiling] Splitting ${originalWidth}×${originalHeight} into ${grid.totalTiles} tiles...`);
  console.log(`[Tiling] Grid: ${grid.tilesX}×${grid.tilesY}, Tile size: ${grid.tileWidth}×${grid.tileHeight}, Overlap: ${grid.overlap}`);
  
  for (let ty = 0; ty < grid.tilesY; ty++) {
    for (let tx = 0; tx < grid.tilesX; tx++) {
      // Calculate tile position
      // Tiles overlap by grid.overlap pixels, so each tile advances by (tileWidth - overlap)
      // This ensures proper coverage with consistent overlap between adjacent tiles
      const x = tx * (grid.tileWidth - grid.overlap);
      const y = ty * (grid.tileHeight - grid.overlap);
      
      console.log(`[Tiling Debug] Grid (${tx},${ty}): calculated x=${x}, y=${y} (tileWidth=${grid.tileWidth}, tileHeight=${grid.tileHeight}, overlap=${grid.overlap})`);
      
      // Calculate tile dimensions  
      let width = grid.tileWidth;
      let height = grid.tileHeight;
      
      // Add overlap on right (unless last column)
      if (tx < grid.tilesX - 1) {
        width += grid.overlap;
      } else {
        // Last column: extend to image edge
        width = originalWidth - x;
      }
      
      // Add overlap on bottom (unless last row)
      if (ty < grid.tilesY - 1) {
        height += grid.overlap;
      } else {
        // Last row: extend to image edge
        height = originalHeight - y;
      }
      
      console.log(`[Tiling Debug] Calculated width=${width}, height=${height} (original: ${originalWidth}×${originalHeight})`);
      
      // Clamp to image boundaries (safety check)
      const finalX = Math.max(0, Math.min(x, originalWidth - 1));
      const finalY = Math.max(0, Math.min(y, originalHeight - 1));
      const finalWidth = Math.max(10, Math.min(width, originalWidth - finalX));  // Min 10px
      const finalHeight = Math.max(10, Math.min(height, originalHeight - finalY)); // Min 10px
      
      console.log(`[Tiling] Tile ${tiles.length + 1}/${grid.totalTiles}: pos(${finalX},${finalY}) size(${finalWidth}×${finalHeight}) [before clamp: pos(${x},${y}) size(${width}×${height})]`);
      
      // Validate tile is reasonable size
      if (finalWidth < 10 || finalHeight < 10) {
        console.warn(`[Tiling] ⚠️ Tile ${tiles.length + 1} is very small (${finalWidth}×${finalHeight}), quality may suffer`);
      }
      
      // Crop tile from original image
      // Note: image.crop() mutates the image object, so we need to decode fresh for each tile
      const freshImage = await decode(imageBuffer);
      const tileImage = freshImage.crop(finalX, finalY, finalWidth, finalHeight);
      const tileBuffer = await tileImage.encode();
      
      tiles.push({
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        imageData: tileBuffer
      });
    }
  }
  
  return tiles;
}

/**
 * Stitch upscaled tiles back together with blending in overlapping regions
 */
async function stitchTiles(
  tiles: TileInfo[],
  grid: TilingGrid,
  originalWidth: number,
  originalHeight: number,
  scale: number,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  console.log(`[Stitching] Combining ${tiles.length} upscaled tiles (simplified composite method)...`);
  
  // Calculate final dimensions
  const outputWidth = originalWidth * scale;
  const outputHeight = originalHeight * scale;
  
  // Load first tile as base
  let output = await decode(tiles[0].imageData);
  console.log(`[Stitching] Base tile loaded: ${output.width}×${output.height}`);
  
  // Create a canvas if needed (first tile might not be full size)
  if (tiles.length > 1) {
    // Create blank canvas at final size
    const canvas = new Image(outputWidth, outputHeight);
    canvas.fill(0xFFFFFFFF); // White background
    
    // Composite first tile
    canvas.composite(output, 0, 0);
    output = canvas;
    console.log(`[Stitching] Canvas created: ${outputWidth}×${outputHeight}`);
  }
  
  // Composite remaining tiles
  for (let i = 1; i < tiles.length; i++) {
    const tile = tiles[i];
    console.log(`[Stitching] Compositing tile ${i + 1}/${tiles.length}...`);
    
    const tileImage = await decode(tile.imageData);
    const x = tile.x * scale;
    const y = tile.y * scale;
    
    console.log(`[Stitching] Tile ${i + 1}: ${tileImage.width}×${tileImage.height} at (${x},${y})`);
    
    // Composite onto output
    output.composite(tileImage, x, y);
  }
  
  console.log(`[Stitching] Complete! Final size: ${output.width}×${output.height}`);
  
  // Encode and upload
  const stitchedBuffer = await output.encode();
  const timestamp = Date.now();
  const fileName = `stitched_${timestamp}_${Math.random().toString(36).substring(7)}.png`;
  
  const { error: uploadError } = await supabase.storage.from("images").upload(
    `temp/${fileName}`,
    stitchedBuffer,
    { contentType: "image/png", upsert: false }
  );
  
  if (uploadError) {
    throw new Error(`Failed to upload stitched image: ${uploadError.message}`);
  }
  
  const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${fileName}`);
  console.log(`[Stitching] Uploaded to: ${urlData.publicUrl}`);
  
  return urlData.publicUrl;
}

/**
 * Launch a tile prediction with automatic retry on rate limiting
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
      if (attempt > 0) {
        console.log(`[upscale-init] Tile ${tileNum}: Retry attempt ${attempt}/${maxRetries}`);
      }
      
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
        const errorText = await predictionRes.text();
        let errorData: any;
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        
        // Check if it's a rate limit error (429)
        if (predictionRes.status === 429 || errorData?.status === 429) {
          const retryAfter = errorData?.retry_after || 10;
          console.log(`[upscale-init] ⏳ Tile ${tileNum} rate limited (attempt ${attempt + 1}/${maxRetries}). Waiting ${retryAfter}s before retry...`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          attempt++;
          continue;
        } else {
          // Non-rate-limit error
          console.error(`[upscale-init] ❌ Tile ${tileNum} failed with non-rate-limit error:`, errorData);
          return { success: false, error: errorData };
        }
      }
      
      const prediction = await predictionRes.json();
      console.log(`[upscale-init] ✅ Tile ${tileNum} launched successfully: ${prediction.id}`);
      return { success: true, predictionId: prediction.id };
      
    } catch (error: any) {
      console.error(`[upscale-init] ❌ Tile ${tileNum} network error (attempt ${attempt + 1}/${maxRetries}):`, error.message);
      
      // Retry on network errors
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay on network errors
        attempt++;
        continue;
      } else {
        return { success: false, error: error.message };
      }
    }
  }
  
  console.error(`[upscale-init] ❌ Tile ${tileNum} failed after ${maxRetries} retries`);
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Process a single tile through the complete upscale chain synchronously
 */
async function processTileThroughChain(
  tileBuffer: Uint8Array,
  tileIndex: number,
  strategy: ChainStrategy,
  quality: Quality,
  replicateToken: string,
  supabase: ReturnType<typeof createClient>
): Promise<Uint8Array> {
  console.log(`[Tile ${tileIndex}] Starting upscale chain (${strategy.stages.length} stages)`);
  
  // Upload tile
  const timestamp = Date.now();
  const tileName = `tile_${timestamp}_${tileIndex}_input.png`;
  const { error: uploadError } = await supabase.storage.from("images").upload(
    `temp/${tileName}`,
    tileBuffer,
    { contentType: "image/png", upsert: false }
  );
  
  if (uploadError) {
    throw new Error(`Failed to upload tile ${tileIndex}: ${uploadError.message}`);
  }
  
  const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${tileName}`);
  let currentUrl = urlData.publicUrl;
  
  // Process through each stage
  for (let stageIdx = 0; stageIdx < strategy.stages.length; stageIdx++) {
    const stage = strategy.stages[stageIdx];
    console.log(`[Tile ${tileIndex}] Stage ${stageIdx + 1}/${strategy.stages.length}: ${stage.scale}×`);
    
    const model = selectModelFor(quality, stage.scale, {});
    const input: Record<string, unknown> = {
      ...model.input,
      image: currentUrl,
    };
    
    const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
    if (!isSwinIR) {
      input.scale = stage.scale;
    }
    
    const version = getModelVersion(model.slug);
    
    // Create prediction
    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${replicateToken}`,
      },
      body: JSON.stringify({ version, input }),
    });
    
    if (!predictionRes.ok) {
      const errText = await predictionRes.text();
      throw new Error(`Tile ${tileIndex} stage ${stageIdx + 1} prediction failed: ${errText}`);
    }
    
    const prediction = await predictionRes.json();
    console.log(`[Tile ${tileIndex}] Prediction created: ${prediction.id}`);
    
    // Poll for completion
    let outputUrl: string | null = null;
    const maxAttempts = 120; // 4 minutes max per stage
    let attempts = 0;
    
    while (!outputUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
      
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${replicateToken}` }
      });
      
      if (!statusRes.ok) {
        throw new Error(`Failed to check tile ${tileIndex} status: ${statusRes.statusText}`);
      }
      
      const status = await statusRes.json();
      
      if (status.status === "succeeded") {
        outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;
        console.log(`[Tile ${tileIndex}] Stage ${stageIdx + 1} complete (${attempts * 2}s)`);
      } else if (status.status === "failed" || status.status === "canceled") {
        throw new Error(`Tile ${tileIndex} stage ${stageIdx + 1} failed: ${status.error}`);
      }
      
      if (attempts % 15 === 0) {
        console.log(`[Tile ${tileIndex}] Still processing... (${attempts * 2}s elapsed)`);
      }
    }
    
    if (!outputUrl) {
      throw new Error(`Tile ${tileIndex} stage ${stageIdx + 1} timed out after ${maxAttempts * 2}s`);
    }
    
    currentUrl = outputUrl;
  }
  
  console.log(`[Tile ${tileIndex}] All stages complete! Downloading final result...`);
  
  // Download final upscaled tile
  const finalRes = await fetch(currentUrl);
  if (!finalRes.ok) {
    throw new Error(`Failed to download tile ${tileIndex} final result`);
  }
  
  const finalBuffer = await finalRes.arrayBuffer();
  return new Uint8Array(finalBuffer);
}

serve(async (req: Request) => {
  console.log("🟢🟢🟢 INIT VERSION: 2024-11-25-REAL-ESRGAN-FIX-v4 🟢🟢🟢");
  
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

    // Get user ID from auth header or payload
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    if (!userId && payload.userId) {
      userId = payload.userId;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const quality = payload.quality ?? "photo";
    const plan = normalizePlan(payload.plan);
    const requestedScale = Number(payload.scale);

    // Validate scale is a valid integer from the hardcoded list
    // MAX SCALE: 24x (28x/32x/64x removed - require 3-stage processing which is unreliable)
    const VALID_SCALES = [2, 4, 8, 10, 12, 16, 20, 24];
    const MAX_SUPPORTED_SCALE = 24;
    
    // Check if scale is an integer
    if (!Number.isInteger(requestedScale)) {
      console.error(`[upscale-init] ❌ INVALID SCALE: Received fractional value ${payload.scale}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid scale factor',
          message: `Scale must be an integer, received: ${payload.scale}`,
          validScales: VALID_SCALES
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if scale exceeds maximum supported (24x)
    if (requestedScale > MAX_SUPPORTED_SCALE) {
      console.error(`[upscale-init] ❌ SCALE EXCEEDS MAX: ${requestedScale}x > ${MAX_SUPPORTED_SCALE}x`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Scale factor too high',
          message: `Maximum supported scale is ${MAX_SUPPORTED_SCALE}x. Requested: ${requestedScale}x`,
          maxScale: MAX_SUPPORTED_SCALE,
          validScales: VALID_SCALES
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if scale is in valid list
    if (!VALID_SCALES.includes(requestedScale)) {
      console.error(`[upscale-init] ❌ INVALID SCALE: ${requestedScale}x not in valid scales`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid scale factor',
          message: `Scale ${requestedScale}x is not supported. Valid scales: ${VALID_SCALES.join(', ')}`,
          validScales: VALID_SCALES
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[upscale-init] ✅ Scale validation passed: ${requestedScale}x (max: ${MAX_SUPPORTED_SCALE}x)`);

    // Check plan limits
    const planMax = PLAN_MAX_SCALE[plan];
    // All content types support full plan scale limits
    if (requestedScale > planMax) {
      return new Response(
        JSON.stringify({ success: false, error: "Your current plan does not support this scale." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract and decode input image
    const originalInput = extractBase64Data(payload.imageBase64);
    const workingImage = await decode(originalInput.buffer);
    const originalWidth = workingImage.width;
    const originalHeight = workingImage.height;

    // ============================================================================
    // SCALE TEMPLATE VALIDATION
    // Check if requested scale is safe for this image size
    // ============================================================================
    const GPU_LIMIT_PIXELS = 2096704; // ~2.1M pixels
    const GPU_MAX_DIM = Math.floor(Math.sqrt(GPU_LIMIT_PIXELS)); // ~1448px
    const MAX_SAFE_TILES = 60; // ~10 min at 10s/tile
    
    // Calculate max safe scale based on image size and constraints
    const calculateMaxSafeScale = (w: number, h: number): number => {
      // For each scale, check if it would require more tiles than we can process
      const scales = [32, 28, 24, 20, 16, 12, 10, 8, 4, 2];
      
      for (const scale of scales) {
        // Calculate tile size needed for this scale
        // Tile after first 4x stage must fit in GPU: tile * 4 <= 1448
        const maxTileSize = Math.floor(GPU_MAX_DIM / 4); // ~362px
        
        // Calculate tiles needed
        const tilesX = Math.ceil(w / maxTileSize);
        const tilesY = Math.ceil(h / maxTileSize);
        const totalTiles = tilesX * tilesY;
        
        // For 3-stage scales (28x, 32x), tiles multiply further
        let effectiveTiles = totalTiles;
        if (scale >= 28) {
          // Each tile splits into 4 for stage 3
          effectiveTiles = totalTiles * 4;
        }
        
        if (effectiveTiles <= MAX_SAFE_TILES) {
          return scale;
        }
      }
      
      return 2; // Minimum
    };
    
    const maxSafeScale = calculateMaxSafeScale(originalWidth, originalHeight);
    
    console.log(`[upscale-init] Image: ${originalWidth}×${originalHeight}, Max safe scale: ${maxSafeScale}x`);
    
    // Check if requested scale exceeds safe limit for high scales (28x, 32x)
    if (requestedScale > maxSafeScale && requestedScale >= 28) {
      // Calculate what size the image would need to be downscaled to for this scale
      const scaleRatio = maxSafeScale / requestedScale;
      const suggestedWidth = Math.floor(originalWidth * Math.sqrt(scaleRatio));
      const suggestedHeight = Math.floor(originalHeight * Math.sqrt(scaleRatio));
      
      console.warn(`[upscale-init] ⚠️ Scale ${requestedScale}x exceeds safe limit ${maxSafeScale}x for ${originalWidth}×${originalHeight}`);
      console.log(`[upscale-init] Suggested downscale: ${suggestedWidth}×${suggestedHeight} for ${requestedScale}x`);
      
      // Return informative error with suggestions
      return new Response(
        JSON.stringify({
          success: false,
          error: 'scale_exceeds_safe_limit',
          message: `${requestedScale}x upscale would require too many tiles for your ${originalWidth}×${originalHeight} image.`,
          maxSafeScale,
          suggestions: [
            {
              option: 'reduce_scale',
              description: `Use ${maxSafeScale}x instead (final: ${originalWidth * maxSafeScale}×${originalHeight * maxSafeScale}px)`,
              scale: maxSafeScale
            },
            {
              option: 'downscale_input',
              description: `Resize input to ~${suggestedWidth}×${suggestedHeight} for ${requestedScale}x`,
              inputWidth: suggestedWidth,
              inputHeight: suggestedHeight,
              finalWidth: suggestedWidth * requestedScale,
              finalHeight: suggestedHeight * requestedScale
            }
          ]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cap scale to avoid exceeding configured dimension limit
    const guardScale = DIMENSION_LIMIT / Math.max(originalWidth, originalHeight);
    const maxPlanRequest = Math.min(planMax, requestedScale);
    const safeCandidates = VALID_SCALES.filter((scale) => scale <= maxPlanRequest && scale <= guardScale);

    let effectiveTarget: number;

    if (safeCandidates.length === 0) {
      const guardCandidates = VALID_SCALES.filter((scale) => scale <= planMax && scale <= guardScale);

      if (guardCandidates.length === 0) {
        console.error(
          `[upscale-init] ❌ Dimension limit ${DIMENSION_LIMIT}px prevents even minimum scale for ${originalWidth}×${originalHeight}`,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: `Requested upscale would exceed the maximum supported output dimension of ${DIMENSION_LIMIT}px`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      effectiveTarget = Math.max(...guardCandidates);
      if (effectiveTarget !== requestedScale) {
        console.warn(
          `[upscale-init] ⚠️ Requested ${requestedScale}x exceeds guard limit for ${originalWidth}×${originalHeight}. Falling back to ${effectiveTarget}x.`,
        );
      }
    } else {
      effectiveTarget = Math.max(...safeCandidates);
      if (effectiveTarget !== requestedScale) {
        console.warn(
          `[upscale-init] ⚠️ Guard constraint reduced target from ${requestedScale}x to ${effectiveTarget}x for ${originalWidth}×${originalHeight}.`,
        );
      }
    }

    if (effectiveTarget < 2) {
      effectiveTarget = 2;
    }

    console.log(
      `[upscale-init] 🎯 Effective target scale: ${effectiveTarget}x (requested ${requestedScale}x, guardScale ${guardScale.toFixed(2)}x)`,
    );

    // Upload input image to storage and get URL
    const timestamp = Date.now();
    const inputFileName = `temp_input_${timestamp}_${Math.random().toString(36).substring(7)}.png`;
    const inputBuffer = await workingImage.encode("png");

    const { error: uploadError } = await supabase.storage.from("images").upload(
      `temp/${inputFileName}`,
      inputBuffer,
      {
        contentType: "image/png",
        upsert: false,
      },
    );

    if (uploadError) {
      console.error("[upscale-init] Upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to upload input image: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(`temp/${inputFileName}`);
    const inputUrl = urlData.publicUrl;

    // Build chain strategy
    const strategy = buildChainStrategy(effectiveTarget, quality, {
      maxDetail: payload.maxDetail ?? false,
      userSelectedModel: payload.selectedModel,
      qualityMode: payload.qualityMode || 'speed',
    });

    // ============================================================================
    // ADAPTIVE TILING CHECK
    // ============================================================================
    
    console.log(`[upscale-init] Checking if tiling is needed for ${originalWidth}×${originalHeight} at ${effectiveTarget}×`);
    
    const tilingGrid = calculateOptimalTiling(originalWidth, originalHeight, strategy, effectiveTarget, quality);
    
    console.log(`[upscale-init] Tiling grid result:`, tilingGrid);
    
    if (tilingGrid) {
      // 🔥 ASYNC TILING MODE: Split tiles, upload, launch async processing
      console.log(`[upscale-init] 🎯 ASYNC TILING MODE - Processing ${tilingGrid.totalTiles} tiles asynchronously`);
      
      try {
        // Step 1: Split image into tiles
        const tiles = await splitImageIntoTiles(inputBuffer, tilingGrid);
        console.log(`[upscale-init] Split complete - ${tiles.length} tiles ready`);
        
        // Step 2: Upload each tile to storage and build tile metadata (MEMORY SAFE - process one at a time)
        const tilesData: TileData[] = [];
        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          const tileFileName = `tile_${Date.now()}_${i}.png`;
          
          console.log(`[upscale-init] Uploading tile ${i + 1}/${tiles.length} (${tile.width}×${tile.height})...`);
          
          const { error: tileUploadError } = await supabase.storage.from("images").upload(
            `temp/${tileFileName}`,
            tile.imageData,
            { contentType: "image/png", upsert: false }
          );
          
          if (tileUploadError) {
            throw new Error(`Failed to upload tile ${i + 1}: ${tileUploadError.message}`);
          }
          
          const { data: tileUrlData } = supabase.storage.from("images").getPublicUrl(`temp/${tileFileName}`);
          
          tilesData.push({
            tile_id: i,
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height,
            input_url: tileUrlData.publicUrl,
            stage1_url: null,
            stage2_url: null,
            stage3_url: null,
            stage1_prediction_id: null,
            stage2_prediction_id: null,
            stage3_prediction_id: null,
            status: "pending",
            error: null
          });
          
          // Clear tile data from memory
          tiles[i].imageData = new Uint8Array(0);
        }
        
        console.log(`[upscale-init] All tiles uploaded to storage`);
        
        // Step 3: Create job with tile metadata
        // Build template config for multi-stage splitting
        // This tells the webhook when to pause for client-side splitting
        const templateConfig = buildTemplateConfig(effectiveTarget, tilingGrid, strategy);
        
        const { data: job, error: jobError } = await supabase
          .from("upscale_jobs")
          .insert({
            user_id: userId,
            input_url: inputUrl,
            content_type: quality,
            target_scale: Math.round(effectiveTarget),
            original_width: originalWidth,
            original_height: originalHeight,
            current_stage: 1,
            total_stages: strategy.stages.length,
            status: "processing",
            chain_strategy: strategy,
            template_config: templateConfig,
            using_tiling: true,
            tile_grid: tilingGrid,
            tiles_data: tilesData,
            webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`,
          })
          .select()
          .single();
        
        if (jobError) {
          console.error("[upscale-init] Job creation error:", jobError);
          throw new Error(`Failed to create job: ${jobError.message}`);
        }
        
        console.log(`[upscale-init] Job created: ${job.id}`);
        
        // Step 4: Launch async processing for stage 1 of all tiles
        const model = selectModelFor(quality, strategy.stages[0].scale, {});
        const version = getModelVersion(model.slug);
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`;
        
        console.log(`[upscale-init] 🔗 Webhook URL for tiles: ${webhookUrl}`);
        console.log(`[upscale-init] Launching ${tilesData.length} tile predictions for stage 1 with retry logic...`);
        
        // Launch tiles with retry logic and staggered timing
        const launchResults = [];
        for (let i = 0; i < tilesData.length; i++) {
          const tileData = tilesData[i];
          const tileNum = i + 1;
          
          const input: Record<string, unknown> = {
            ...model.input,
            image: tileData.input_url,
          };
          
          const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
          if (!isSwinIR) {
            input.scale = strategy.stages[0].scale;
          }
          
          console.log(`[upscale-init] Tile ${tileNum}: Sending to Replicate with webhook=${webhookUrl}`);
          
          // Launch with retry logic
          const result = await launchTileWithRetry(
            replicateToken,
            version,
            input,
            webhookUrl,
            tileNum,
            5 // max 5 retries
          );
          
          if (result.success && result.predictionId) {
            tilesData[i].stage1_prediction_id = result.predictionId;
            tilesData[i].status = "stage1_processing";
            launchResults.push({ tileNum, success: true, predictionId: result.predictionId });
          } else {
            console.error(`[upscale-init] ❌ Tile ${tileNum} failed to launch after retries:`, result.error);
            launchResults.push({ tileNum, success: false, error: result.error });
          }
          
          // Add small delay between launches to avoid burst limit (except for last tile)
          if (i < tilesData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms stagger
          }
        }
        
        // Check results and report
        const successfulTiles = launchResults.filter(r => r.success);
        const failedTiles = launchResults.filter(r => !r.success);
        
        console.log(`[upscale-init] Launch summary: ${successfulTiles.length}/${tilesData.length} tiles launched successfully`);
        
        if (failedTiles.length > 0) {
          console.error(`[upscale-init] ❌ Failed to launch ${failedTiles.length} tiles:`, failedTiles);
          
          // Update job status to failed
          await supabase
            .from("upscale_jobs")
            .update({
              status: "failed",
              error_message: `Failed to launch ${failedTiles.length}/${tilesData.length} tiles after retries`,
              tiles_data: tilesData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to launch ${failedTiles.length}/${tilesData.length} tiles`,
              failedTiles: failedTiles,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`[upscale-init] 🚀 All ${tilesData.length} tiles launched successfully!`);
        
        // Update job with prediction IDs
        await supabase
          .from("upscale_jobs")
          .update({ tiles_data: tilesData })
          .eq("id", job.id);
        
        // Return immediately - tiles will process asynchronously
        return new Response(
          JSON.stringify({
            success: true,
            jobId: job.id,
            estimatedTime: strategy.estimatedTime * strategy.stages.length,
            estimatedCost: strategy.estimatedCost * tilingGrid.totalTiles,
            totalStages: strategy.stages.length,
            totalTiles: tilingGrid.totalTiles,
            originalDimensions: { width: originalWidth, height: originalHeight },
            targetScale: effectiveTarget,
            message: `Processing ${tilingGrid.totalTiles} tiles asynchronously`
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
        
      } catch (tilingError) {
        console.error("[upscale-init] Tiling error:", tilingError);
        console.error("[upscale-init] Error stack:", tilingError instanceof Error ? tilingError.stack : 'No stack trace');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Tiling failed: ${tilingError instanceof Error ? tilingError.message : String(tilingError)}`,
            stack: tilingError instanceof Error ? tilingError.stack : undefined
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // ============================================================================
    // NORMAL WEBHOOK MODE (no tiling needed)
    // ============================================================================
    
    console.log(`[upscale-init] Normal mode - using webhook-based async processing`);

    // Set first stage input URL
    strategy.stages[0].input_url = inputUrl;

    // Start first prediction
    const firstStage = strategy.stages[0];
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // 🔥 CRITICAL FIX: Use full absolute URL for webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/upscale-webhook`;
    
    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("upscale_jobs")
      .insert({
        user_id: userId,
        input_url: inputUrl,
        content_type: quality,
        target_scale: Math.round(effectiveTarget),
        original_width: originalWidth,
        original_height: originalHeight,
        current_stage: 1,
        total_stages: strategy.stages.length,
        status: "processing",
        chain_strategy: strategy,
        webhook_url: webhookUrl,
      })
      .select()
      .single();

    if (jobError) {
      console.error("[upscale-init] Job creation error:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create job: ${jobError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    
    console.log(`[upscale-init] Starting prediction with webhook URL: ${webhookUrl}`);
    console.log(`[upscale-init] Webhook URL verification: ${webhookUrl.startsWith('http') ? '✅ Absolute URL' : '❌ Relative URL'}`);
    
    const model = selectModelFor(quality, firstStage.scale, {
      maxDetail: payload.maxDetail ?? false,
      userSelectedModel: payload.selectedModel,
    });

    const input: Record<string, unknown> = {
      ...model.input,
      image: inputUrl,
    };

    const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
    if (!isSwinIR) {
      input.scale = firstStage.scale;
    }
    
    // Add tiling parameters only if tiling was needed (tilingGrid would be non-null)
    // Since we're in the non-tiling branch, we only add tiling if the model requires it
    // for GPU memory reasons even without our custom tiling grid
    const isRealESRGAN = model.slug.includes('real-esrgan');
    if (isRealESRGAN && (originalWidth > 1400 || originalHeight > 1400 || firstStage.scale > 2)) {
      // For larger images or higher scales, use Replicate's built-in tiling
      // Reduced from 512 to 256 to prevent CUDA OOM errors on large intermediate images
      input.tile = 256;
      input.tile_pad = 16;
      console.log(`[upscale-init] Adding tile parameters (256x256) for large image or high scale`);
    }

    console.log(`[upscale-init] 🔍 Calling Replicate with model: ${model.slug.split('/')[1]}`);
    console.log(`[upscale-init] 🔍 Input parameters:`, JSON.stringify(input, null, 2));

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
      console.error("[upscale-init] Prediction creation failed:", errText);
      
      // Update job status to failed
      await supabase
        .from("upscale_jobs")
        .update({ status: "failed", error_message: `Failed to create prediction: ${errText}` })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({ success: false, error: `Failed to start prediction: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prediction = await predictionRes.json();

    // Update job with prediction ID
    await supabase
      .from("upscale_jobs")
      .update({ prediction_id: prediction.id })
      .eq("id", job.id);

    // Update first stage
    strategy.stages[0].prediction_id = prediction.id;
    strategy.stages[0].status = "processing";
    await supabase
      .from("upscale_jobs")
      .update({ chain_strategy: strategy })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        predictionId: prediction.id,
        estimatedTime: strategy.estimatedTime,
        estimatedCost: strategy.estimatedCost,
        totalStages: strategy.stages.length,
        originalDimensions: { width: originalWidth, height: originalHeight },
        targetScale: effectiveTarget,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : 'No stack trace';
    console.error("[upscale-init] FATAL ERROR:", errorMessage);
    console.error("[upscale-init] Stack trace:", errorStack);
    console.error("[upscale-init] Error object:", err);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack,
        errorType: err instanceof Error ? err.constructor.name : typeof err
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

