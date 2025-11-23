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

const PLAN_MAX_SCALE: Record<string, number> = {
  basic: 8,
  pro: 12,
  enterprise: 16,
  mega: 32,
};

const DIMENSION_LIMIT = 20000;

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
      // Always use SwinIR 4x for Art - downscaling will handle other scales
      console.log(`[selectModelFor] Art/Text at ${scale}x → Using SwinIR 4x (will downscale if needed)`);
      return getSwinIRModel(4);  // Always 4x
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
  // Strategy: Start with smaller scales (2×, 3×) to keep intermediate sizes manageable
  const chains: Record<number, number[]> = {
    10: [2, 5],         // 10x: max input 2× (stage 2)
    12: [3, 4],         // 12x: max input 3× (stage 2) - optimized from [4,3]
    16: [2, 2, 4],      // 16x: max input 4× (stage 3) - optimized from [4,4]
    20: [2, 2, 5],      // 20x: max input 4× (stage 3) - optimized from [4,5]
    24: [2, 3, 4],      // 24x: max input 6× (stage 3) - optimized from [4,2,3]
    28: [2, 2, 7],      // 28x: max input 4× (stage 3) - optimized from [4,2,2,1.75]
    32: [2, 4, 4],      // 32x: max input 8× (stage 3) - optimized from [4,4,2]
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
  
  // Special handling for Art/Text: Always use 4x SwinIR (SwinIR 2x is unreliable)
  // Chain to next higher power of 4, then downscale to exact target
  let scaleChain: number[];
  if (contentType === 'art' || contentType === 'text') {
    const artChains: Record<number, number[]> = {
      2: [4],           // 4x → downscale to 2x
      4: [4],           // 4x native
      8: [4, 4],        // 16x → downscale to 8x
      10: [4, 4],       // 16x → downscale to 10x
      12: [4, 4],       // 16x → downscale to 12x
      16: [4, 4],       // 16x native
      20: [4, 4, 4],    // 64x → downscale to 20x
      24: [4, 4, 4],    // 64x → downscale to 24x
      28: [4, 4, 4],    // 64x → downscale to 28x
      32: [4, 4, 4],    // 64x → downscale to 32x
      64: [4, 4, 4],    // 64x native
    };
    
    scaleChain = artChains[targetScale] || [4];
    const chainProduct = scaleChain.reduce((a, b) => a * b, 1);
    console.log(`[Chain] Art/Text ${targetScale}x → Pure SwinIR 4x chain: ${scaleChain.join('×')}× = ${chainProduct}x${chainProduct !== targetScale ? ` → downscale to ${targetScale}x` : ''}`);
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
      model = selectModelFor(contentType, scale, options);
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
  
  // Dynamic MIN_TILE_SIZE based on target scale
  // Higher scales need smaller tiles to fit in GPU memory at intermediate stages
  let MIN_TILE_SIZE: number;
  if (targetScale <= 12) {
    MIN_TILE_SIZE = 200;  // Full quality for low scales
  } else if (targetScale <= 20) {
    MIN_TILE_SIZE = 150;  // Balanced for medium scales
  } else {
    MIN_TILE_SIZE = 100;  // Minimum for high scales (24×+)
  }
  
  console.log(`[Tiling] Dynamic MIN_TILE_SIZE for ${targetScale}×: ${MIN_TILE_SIZE}px`);
  
  // Calculate cumulative scale to find the largest INPUT any stage will receive
  // For 24× (2×→3×→4×):
  //   Stage 1 receives: 1× (original)
  //   Stage 2 receives: 2× (output of stage 1)
  //   Stage 3 receives: 6× (output of stage 2) ← This is the GPU bottleneck!
  // GPU limit applies to INPUT size, so we track max INPUT across all stages
  let cumulativeScale = 1;
  let maxInputScale = 1; // Tracks largest input to any stage
  
  for (const stage of chainStrategy.stages) {
    // Check cumulative BEFORE multiplying (this is what the current stage receives)
    maxInputScale = Math.max(maxInputScale, cumulativeScale);
    cumulativeScale *= stage.scale;
  }
  
  console.log(`[Tiling] Image: ${width}×${height}, Chain scales: ${chainStrategy.stages.map(s => s.scale).join('×→')}×`);
  console.log(`[Tiling] Max INPUT scale (GPU bottleneck): ${maxInputScale}× (final output: ${cumulativeScale}×)`);
  
  // Adaptive overlap: reduce for very high scales to prevent negative tile sizes
  // For scales >16×, reduce overlap proportionally
  const OVERLAP = maxInputScale > 16 
    ? Math.max(32, Math.floor(BASE_OVERLAP * (16 / maxInputScale)))
    : BASE_OVERLAP;
  
  console.log(`[Tiling] Using overlap: ${OVERLAP}px (adaptive for ${maxInputScale}× input scale)`);
  
  // Calculate max tile size INCLUDING overlap from the start
  // Strategy: Find largest tile where (tile + overlap) × max_input_scale stays under GPU limit
  const maxSafePixels = GPU_MEMORY_LIMIT_PIXELS * GPU_SAFE_MARGIN;
  const maxIntermediateDimension = Math.sqrt(maxSafePixels);
  
  // Reserve space for overlap in the calculation
  const maxTileSizeWithOverlap = Math.floor(maxIntermediateDimension / maxInputScale);
  const maxTileSizeAllowed = Math.max(50, maxTileSizeWithOverlap - OVERLAP); // Never go below 50px
  
  console.log(`[Tiling] GPU allows max tile: ${maxTileSizeAllowed}px (with ${OVERLAP}px overlap = ${maxTileSizeWithOverlap}px total)`);
  console.log(`[Tiling] At peak input scale (${maxInputScale}×): ${maxTileSizeWithOverlap * maxInputScale}×${maxTileSizeWithOverlap * maxInputScale} = ${((maxTileSizeWithOverlap * maxInputScale) ** 2 / 1000000).toFixed(1)}M pixels`);
  
  // Determine actual tile size: prefer MIN_TILE_SIZE but respect GPU limit
  let baseTileSize: number;
  if (maxTileSizeAllowed >= MIN_TILE_SIZE) {
    baseTileSize = MIN_TILE_SIZE;
    console.log(`[Tiling] Using MIN_TILE_SIZE: ${baseTileSize}px (GPU allows up to ${maxTileSizeAllowed}px)`);
  } else {
    baseTileSize = maxTileSizeAllowed;
    console.warn(`[Tiling] GPU constraints require tiles smaller than MIN_TILE_SIZE (${MIN_TILE_SIZE}px). Using ${baseTileSize}px for ${targetScale}× upscale.`);
  }
  
  // Check if tiling is needed
  if (width <= baseTileSize && height <= baseTileSize) {
    console.log(`[Tiling] No tiling needed - image fits within tile size limits`);
    return null; // No tiling needed
  }
  
  // Calculate tiles needed for each dimension
  let tilesX = Math.ceil(width / baseTileSize);
  let tilesY = Math.ceil(height / baseTileSize);
  
  // Calculate actual tile dimensions (distribute pixels evenly)
  let tileWidth = Math.ceil(width / tilesX);
  let tileHeight = Math.ceil(height / tilesY);
  
  // Ensure tiles don't exceed maxTileSizeAllowed (critical for GPU memory)
  if (tileWidth > maxTileSizeAllowed) {
    tileWidth = maxTileSizeAllowed;
    tilesX = Math.ceil(width / tileWidth);
  }
  if (tileHeight > maxTileSizeAllowed) {
    tileHeight = maxTileSizeAllowed;
    tilesY = Math.ceil(height / tileHeight);
  }
  
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
  
  // Validate that all intermediate images will fit in GPU memory
  let stageCumulative = 1;
  for (let stageIdx = 0; stageIdx < chainStrategy.stages.length; stageIdx++) {
    stageCumulative *= chainStrategy.stages[stageIdx].scale;
    
    const maxIntermediateDimension = tileWidth * stageCumulative;
    const maxIntermediatePixels = maxIntermediateDimension * maxIntermediateDimension;
    
    console.log(`[Tiling] Stage ${stageIdx + 1} (${chainStrategy.stages[stageIdx].scale}×): max tile ${maxIntermediateDimension}×${maxIntermediateDimension} (${(maxIntermediatePixels / 1000000).toFixed(1)}M pixels)`);
    
    if (maxIntermediatePixels > GPU_MEMORY_LIMIT_PIXELS) {
      console.warn(`[Tiling] ⚠️ Stage ${stageIdx + 1} may exceed GPU limit (${(GPU_MEMORY_LIMIT_PIXELS / 1000000).toFixed(1)}M pixels)!`);
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
      // Each tile starts at (tx * tileWidth, ty * tileHeight)
      // The overlap is handled by extending the tile's WIDTH/HEIGHT, not by moving the position
      const x = tx * grid.tileWidth;
      const y = ty * grid.tileHeight;
      
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

    // Resize if needed to fit dimension limits
    const guardScale = DIMENSION_LIMIT / Math.max(originalWidth, originalHeight);
    const maxByGuard = Math.min(requestedScale, guardScale);
    const effectiveTarget = Math.min(planMax, Math.max(2, maxByGuard));

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
            stage1_prediction_id: null,
            stage2_prediction_id: null,
            status: "pending",
            error: null
          });
          
          // Clear tile data from memory
          tiles[i].imageData = new Uint8Array(0);
        }
        
        console.log(`[upscale-init] All tiles uploaded to storage`);
        
        // Step 3: Create job with tile metadata
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
        console.log(`[upscale-init] Launching ${tilesData.length} tile predictions for stage 1...`);
        
        for (let i = 0; i < tilesData.length; i++) {
          const tileData = tilesData[i];
          
          const input: Record<string, unknown> = {
            ...model.input,
            image: tileData.input_url,
          };
          
          const isSwinIR = model.slug.includes('swinir') || model.slug.includes('jingyunliang');
          if (!isSwinIR) {
            input.scale = strategy.stages[0].scale;
          }
          
          console.log(`[upscale-init] Tile ${i + 1}: Sending to Replicate with webhook=${webhookUrl}`);
          
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
            console.error(`[upscale-init] ❌ Failed to start prediction for tile ${i + 1}: ${errText}`);
            continue; // Don't fail entire job if one tile fails to start
          }
          
          const prediction = await predictionRes.json();
          tilesData[i].stage1_prediction_id = prediction.id;
          tilesData[i].status = "stage1_processing";
          
          console.log(`[upscale-init] ✅ Tile ${i + 1} prediction started: ${prediction.id}, webhook configured: ${!!prediction.urls?.webhook}`);
        }
        
        // Update job with prediction IDs
        await supabase
          .from("upscale_jobs")
          .update({ tiles_data: tilesData })
          .eq("id", job.id);
        
        console.log(`[upscale-init] 🚀 All ${tilesData.length} tiles launched for async processing`);
        
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
      input.tile = 512;
      input.tile_pad = 10;
      console.log(`[upscale-init] Adding tile parameters (512x512) for large image or high scale`);
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

