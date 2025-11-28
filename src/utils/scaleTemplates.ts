/**
 * Scale Templates System
 * 
 * Pre-defined tiling configurations for each aspect ratio and scale factor.
 * Templates define EXACT tile counts for EACH STAGE, ensuring predictable
 * processing that stays within GPU memory and timeout limits.
 * 
 * Key principle: Templates pre-calculate the entire pipeline so there are
 * no surprises - every stage's tile count is known upfront.
 */

// ============================================================================
// HARD CONSTRAINTS
// ============================================================================

export const CONSTRAINTS = {
  GPU_MAX_PIXELS: 2096704,           // Replicate GPU limit
  GPU_MAX_DIMENSION: 1448,           // sqrt(2096704) ≈ 1448
  MAX_TILE_INPUT_4X: 362,            // 1448 / 4 = 362
  CLIENT_TIMEOUT_MS: 600000,         // 10 minutes
  TIME_PER_TILE_MS: 10000,           // ~10 seconds per tile
  MAX_SAFE_TILES_PER_STAGE: 60,      // 600s / 10s = 60
  TILE_OVERLAP: 32,                  // Overlap for seamless stitching
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface StageConfig {
  stageNumber: number;
  scaleMultiplier: number;           // e.g., 4 for 4x
  grid: [number, number];            // [cols, rows] for this stage
  tileCount: number;                 // Total tiles at this stage
  splitFromPrevious: number;         // How many sub-tiles each previous tile becomes (1 = no split, 4 = 2x2 split)
}

export interface ScaleConfig {
  scale: number;
  stages: StageConfig[];             // Full stage-by-stage configuration
  totalTiles: number;                // Max tiles at any stage
  estimatedTimeMin: number;          // Total estimated time
  requiresDownscale: boolean;        // True if input must be downscaled
  maxInputWidth: number;             // Max input width for this scale
  maxInputHeight: number;            // Max input height for this scale
}

export interface AspectRatioTemplate {
  name: string;
  ratio: [number, number];           // e.g., [4, 3]
  baseWidth: number;
  baseHeight: number;
  maxWidth: number;                  // Max flex size
  maxHeight: number;
  scales: Record<number, ScaleConfig>;
}

export interface ScaleOption {
  scale: number;
  available: boolean;
  estimatedTimeMin: number;
  finalWidth: number;
  finalHeight: number;
  warning?: string;
  requiresDownscale: boolean;
  downscaledWidth?: number;
  downscaledHeight?: number;
  tileCount: number;
  stageCount: number;
  stages: StageConfig[];
}

export interface TemplateMatch {
  template: AspectRatioTemplate;
  adjustedWidth: number;
  adjustedHeight: number;
  scaleOptions: ScaleOption[];
  maxSafeScale: number;
}

// ============================================================================
// HELPER: Create stage configurations
// ============================================================================

/**
 * Create a single-stage config (no splitting needed)
 */
function singleStage(scale: number, grid: [number, number]): StageConfig[] {
  return [{
    stageNumber: 1,
    scaleMultiplier: scale,
    grid,
    tileCount: grid[0] * grid[1],
    splitFromPrevious: 1
  }];
}

/**
 * Create a two-stage config
 * Stage 1: Initial tiles
 * Stage 2: Same tiles (no split) or split if needed
 */
function twoStage(
  scale1: number, grid1: [number, number],
  scale2: number, grid2: [number, number],
  splitFactor: number = 1
): StageConfig[] {
  const stage1Tiles = grid1[0] * grid1[1];
  const stage2Tiles = grid2[0] * grid2[1];
  
  return [
    {
      stageNumber: 1,
      scaleMultiplier: scale1,
      grid: grid1,
      tileCount: stage1Tiles,
      splitFromPrevious: 1
    },
    {
      stageNumber: 2,
      scaleMultiplier: scale2,
      grid: grid2,
      tileCount: stage2Tiles,
      splitFromPrevious: splitFactor
    }
  ];
}

// Note: threeStage function removed - 28x/32x scales disabled for launch
// All scales now use 2-stage max for reliability

// ============================================================================
// ASPECT RATIO TEMPLATES
// ============================================================================

/**
 * Templates for 4:3 aspect ratio (most common)
 * 
 * For 720×540 image:
 * - Stage 1 tiles: ~180×135 each (fits in GPU after 4x = 720×540)
 * - Stage 2 tiles: Split each into 4 → ~180×135 each (fits in GPU after 4x = 720×540)
 * - Stage 3 tiles: Same count, output ~1440×1080 each
 */
const TEMPLATE_4_3: AspectRatioTemplate = {
  name: "Standard (4:3)",
  ratio: [4, 3],
  baseWidth: 640,
  baseHeight: 480,
  maxWidth: 800,
  maxHeight: 600,
  scales: {
    2: {
      scale: 2,
      stages: singleStage(2, [1, 1]),
      totalTiles: 1,
      estimatedTimeMin: 0.5,
      requiresDownscale: false,
      maxInputWidth: 1024,
      maxInputHeight: 768
    },
    4: {
      scale: 4,
      stages: singleStage(4, [2, 2]),
      totalTiles: 4,
      estimatedTimeMin: 1,
      requiresDownscale: false,
      maxInputWidth: 800,
      maxInputHeight: 600
    },
    8: {
      scale: 8,
      stages: twoStage(4, [2, 2], 2, [2, 2]),
      totalTiles: 4,
      estimatedTimeMin: 2,
      requiresDownscale: false,
      maxInputWidth: 800,
      maxInputHeight: 600
    },
    12: {
      scale: 12,
      stages: twoStage(4, [3, 3], 3, [3, 3]),
      totalTiles: 9,
      estimatedTimeMin: 3,
      requiresDownscale: false,
      maxInputWidth: 720,
      maxInputHeight: 540
    },
    16: {
      scale: 16,
      // Stage 1: 12 tiles (4×3), each ~180×135 → 4x → 720×540
      // Stage 2: 12 tiles (same), each 720×540 → 4x → 2880×2160 (too big!)
      // Need to split: 12 tiles → 48 tiles (4 sub-tiles each)
      stages: twoStage(4, [4, 3], 4, [8, 6], 4),
      totalTiles: 48,
      estimatedTimeMin: 5,
      requiresDownscale: false,
      maxInputWidth: 640,
      maxInputHeight: 480
    },
    20: {
      scale: 20,
      stages: twoStage(4, [4, 3], 5, [8, 6], 4),
      totalTiles: 48,
      estimatedTimeMin: 6,
      requiresDownscale: false,
      maxInputWidth: 560,
      maxInputHeight: 420
    },
    24: {
      scale: 24,
      // 2-stage: 4x → 6x (Real-ESRGAN supports up to 10x)
      stages: twoStage(4, [4, 3], 6, [8, 6], 4),
      totalTiles: 48,
      estimatedTimeMin: 7,
      requiresDownscale: false,
      maxInputWidth: 480,
      maxInputHeight: 360
    }
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  }
};

/**
 * Templates for 3:4 aspect ratio (portrait)
 */
const TEMPLATE_3_4: AspectRatioTemplate = {
  name: "Portrait Standard (3:4)",
  ratio: [3, 4],
  baseWidth: 480,
  baseHeight: 640,
  maxWidth: 600,
  maxHeight: 800,
  scales: {
    2: { scale: 2, stages: singleStage(2, [1, 1]), totalTiles: 1, estimatedTimeMin: 0.5, requiresDownscale: false, maxInputWidth: 768, maxInputHeight: 1024 },
    4: { scale: 4, stages: singleStage(4, [2, 2]), totalTiles: 4, estimatedTimeMin: 1, requiresDownscale: false, maxInputWidth: 600, maxInputHeight: 800 },
    8: { scale: 8, stages: twoStage(4, [2, 2], 2, [2, 2]), totalTiles: 4, estimatedTimeMin: 2, requiresDownscale: false, maxInputWidth: 600, maxInputHeight: 800 },
    12: { scale: 12, stages: twoStage(4, [3, 3], 3, [3, 3]), totalTiles: 9, estimatedTimeMin: 3, requiresDownscale: false, maxInputWidth: 540, maxInputHeight: 720 },
    16: { scale: 16, stages: twoStage(4, [3, 4], 4, [6, 8], 4), totalTiles: 48, estimatedTimeMin: 5, requiresDownscale: false, maxInputWidth: 480, maxInputHeight: 640 },
    20: { scale: 20, stages: twoStage(4, [3, 4], 5, [6, 8], 4), totalTiles: 48, estimatedTimeMin: 6, requiresDownscale: false, maxInputWidth: 420, maxInputHeight: 560 },
    24: { scale: 24, stages: twoStage(4, [3, 4], 6, [6, 8], 4), totalTiles: 48, estimatedTimeMin: 7, requiresDownscale: false, maxInputWidth: 360, maxInputHeight: 480 }
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  }
};

/**
 * Templates for 16:9 aspect ratio (widescreen)
 */
const TEMPLATE_16_9: AspectRatioTemplate = {
  name: "Widescreen (16:9)",
  ratio: [16, 9],
  baseWidth: 854,
  baseHeight: 480,
  maxWidth: 1024,
  maxHeight: 576,
  scales: {
    2: { scale: 2, stages: singleStage(2, [2, 1]), totalTiles: 2, estimatedTimeMin: 0.5, requiresDownscale: false, maxInputWidth: 1280, maxInputHeight: 720 },
    4: { scale: 4, stages: singleStage(4, [3, 2]), totalTiles: 6, estimatedTimeMin: 1.5, requiresDownscale: false, maxInputWidth: 1024, maxInputHeight: 576 },
    8: { scale: 8, stages: twoStage(4, [4, 2], 2, [4, 2]), totalTiles: 8, estimatedTimeMin: 2.5, requiresDownscale: false, maxInputWidth: 854, maxInputHeight: 480 },
    12: { scale: 12, stages: twoStage(4, [4, 3], 3, [4, 3]), totalTiles: 12, estimatedTimeMin: 4, requiresDownscale: false, maxInputWidth: 768, maxInputHeight: 432 },
    16: { scale: 16, stages: twoStage(4, [5, 3], 4, [10, 6], 4), totalTiles: 60, estimatedTimeMin: 6, requiresDownscale: false, maxInputWidth: 640, maxInputHeight: 360 },
    20: { scale: 20, stages: twoStage(4, [5, 3], 5, [10, 6], 4), totalTiles: 60, estimatedTimeMin: 7, requiresDownscale: false, maxInputWidth: 576, maxInputHeight: 324 },
    24: { scale: 24, stages: twoStage(4, [5, 3], 6, [10, 6], 4), totalTiles: 60, estimatedTimeMin: 8, requiresDownscale: false, maxInputWidth: 512, maxInputHeight: 288 }
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  }
};

/**
 * Templates for 9:16 aspect ratio (portrait widescreen / mobile)
 */
const TEMPLATE_9_16: AspectRatioTemplate = {
  name: "Portrait Widescreen (9:16)",
  ratio: [9, 16],
  baseWidth: 480,
  baseHeight: 854,
  maxWidth: 576,
  maxHeight: 1024,
  scales: {
    2: { scale: 2, stages: singleStage(2, [1, 2]), totalTiles: 2, estimatedTimeMin: 0.5, requiresDownscale: false, maxInputWidth: 720, maxInputHeight: 1280 },
    4: { scale: 4, stages: singleStage(4, [2, 3]), totalTiles: 6, estimatedTimeMin: 1.5, requiresDownscale: false, maxInputWidth: 576, maxInputHeight: 1024 },
    8: { scale: 8, stages: twoStage(4, [2, 4], 2, [2, 4]), totalTiles: 8, estimatedTimeMin: 2.5, requiresDownscale: false, maxInputWidth: 480, maxInputHeight: 854 },
    12: { scale: 12, stages: twoStage(4, [3, 4], 3, [3, 4]), totalTiles: 12, estimatedTimeMin: 4, requiresDownscale: false, maxInputWidth: 432, maxInputHeight: 768 },
    16: { scale: 16, stages: twoStage(4, [3, 5], 4, [6, 10], 4), totalTiles: 60, estimatedTimeMin: 6, requiresDownscale: false, maxInputWidth: 360, maxInputHeight: 640 },
    20: { scale: 20, stages: twoStage(4, [3, 5], 5, [6, 10], 4), totalTiles: 60, estimatedTimeMin: 7, requiresDownscale: false, maxInputWidth: 324, maxInputHeight: 576 },
    24: { scale: 24, stages: twoStage(4, [3, 5], 6, [6, 10], 4), totalTiles: 60, estimatedTimeMin: 8, requiresDownscale: false, maxInputWidth: 288, maxInputHeight: 512 }
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  }
};

/**
 * Templates for 1:1 aspect ratio (square)
 */
const TEMPLATE_1_1: AspectRatioTemplate = {
  name: "Square (1:1)",
  ratio: [1, 1],
  baseWidth: 512,
  baseHeight: 512,
  maxWidth: 720,
  maxHeight: 720,
  scales: {
    2: { scale: 2, stages: singleStage(2, [1, 1]), totalTiles: 1, estimatedTimeMin: 0.5, requiresDownscale: false, maxInputWidth: 1024, maxInputHeight: 1024 },
    4: { scale: 4, stages: singleStage(4, [2, 2]), totalTiles: 4, estimatedTimeMin: 1, requiresDownscale: false, maxInputWidth: 800, maxInputHeight: 800 },
    8: { scale: 8, stages: twoStage(4, [2, 2], 2, [2, 2]), totalTiles: 4, estimatedTimeMin: 2, requiresDownscale: false, maxInputWidth: 800, maxInputHeight: 800 },
    12: { scale: 12, stages: twoStage(4, [3, 3], 3, [3, 3]), totalTiles: 9, estimatedTimeMin: 3, requiresDownscale: false, maxInputWidth: 600, maxInputHeight: 600 },
    16: { scale: 16, stages: twoStage(4, [3, 3], 4, [6, 6], 4), totalTiles: 36, estimatedTimeMin: 5, requiresDownscale: false, maxInputWidth: 600, maxInputHeight: 600 },
    20: { scale: 20, stages: twoStage(4, [4, 4], 5, [8, 8], 4), totalTiles: 64, estimatedTimeMin: 7, requiresDownscale: false, maxInputWidth: 500, maxInputHeight: 500 },
    24: { scale: 24, stages: twoStage(4, [4, 4], 6, [8, 8], 4), totalTiles: 64, estimatedTimeMin: 8, requiresDownscale: false, maxInputWidth: 480, maxInputHeight: 480 }
    // 28x and 32x REMOVED - require 3-stage processing which is unreliable
  }
};

/**
 * All available templates
 */
export const ASPECT_RATIO_TEMPLATES: AspectRatioTemplate[] = [
  TEMPLATE_1_1,
  TEMPLATE_4_3,
  TEMPLATE_3_4,
  TEMPLATE_16_9,
  TEMPLATE_9_16,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate aspect ratio similarity (0 = identical, higher = more different)
 */
function aspectRatioDifference(w1: number, h1: number, w2: number, h2: number): number {
  const ratio1 = w1 / h1;
  const ratio2 = w2 / h2;
  return Math.abs(ratio1 - ratio2);
}

/**
 * Find the best matching template for an image's aspect ratio
 */
export function findBestTemplate(width: number, height: number): AspectRatioTemplate {
  let bestTemplate = ASPECT_RATIO_TEMPLATES[0];
  let bestDiff = Infinity;
  
  for (const template of ASPECT_RATIO_TEMPLATES) {
    const diff = aspectRatioDifference(
      width, height,
      template.ratio[0], template.ratio[1]
    );
    
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTemplate = template;
    }
  }
  
  return bestTemplate;
}

/**
 * Calculate the maximum safe scale for a given image size
 */
export function calculateMaxSafeScale(width: number, height: number): number {
  const template = findBestTemplate(width, height);
  let maxScale = 2;
  
  for (const [scaleStr, config] of Object.entries(template.scales)) {
    const scale = parseInt(scaleStr);
    
    // Check if image fits within this scale's max input size
    if (width <= config.maxInputWidth && height <= config.maxInputHeight) {
      if (!config.requiresDownscale) {
        maxScale = Math.max(maxScale, scale);
      }
    }
  }
  
  return maxScale;
}

/**
 * Get all available scale options for an image with warnings and estimates
 */
export function getScaleOptions(width: number, height: number): ScaleOption[] {
  const template = findBestTemplate(width, height);
  const options: ScaleOption[] = [];
  
  for (const [scaleStr, config] of Object.entries(template.scales)) {
    const scale = parseInt(scaleStr);
    
    // Check if image fits directly
    const fitsDirectly = width <= config.maxInputWidth && height <= config.maxInputHeight;
    
    // Calculate downscaled dimensions if needed
    let downscaledWidth = width;
    let downscaledHeight = height;
    let requiresDownscale = false;
    
    if (!fitsDirectly) {
      // Calculate scale factor to fit within max dimensions
      const scaleFactorW = config.maxInputWidth / width;
      const scaleFactorH = config.maxInputHeight / height;
      const scaleFactor = Math.min(scaleFactorW, scaleFactorH);
      
      downscaledWidth = Math.floor(width * scaleFactor);
      downscaledHeight = Math.floor(height * scaleFactor);
      requiresDownscale = true;
    }
    
    // Calculate final dimensions
    const finalWidth = (requiresDownscale ? downscaledWidth : width) * scale;
    const finalHeight = (requiresDownscale ? downscaledHeight : height) * scale;
    
    // Build warning message
    let warning: string | undefined;
    if (requiresDownscale) {
      warning = `Image will be resized to ${downscaledWidth}×${downscaledHeight} first`;
    }
    
    options.push({
      scale,
      available: true,
      estimatedTimeMin: config.estimatedTimeMin,
      finalWidth,
      finalHeight,
      warning,
      requiresDownscale,
      downscaledWidth: requiresDownscale ? downscaledWidth : undefined,
      downscaledHeight: requiresDownscale ? downscaledHeight : undefined,
      tileCount: config.totalTiles,
      stageCount: config.stages.length,
      stages: config.stages,
    });
  }
  
  return options.sort((a, b) => a.scale - b.scale);
}

/**
 * Get the full template configuration for a specific scale
 */
export function getScaleConfig(width: number, height: number, scale: number): ScaleConfig | null {
  const template = findBestTemplate(width, height);
  return template.scales[scale] || null;
}

/**
 * Get complete template match with adjusted dimensions and all options
 */
export function getTemplateMatch(width: number, height: number): TemplateMatch {
  const template = findBestTemplate(width, height);
  const scaleOptions = getScaleOptions(width, height);
  const maxSafeScale = calculateMaxSafeScale(width, height);
  
  return {
    template,
    adjustedWidth: width,
    adjustedHeight: height,
    scaleOptions,
    maxSafeScale,
  };
}

/**
 * Format time estimate for display
 */
export function formatTimeEstimate(minutes: number): string {
  if (minutes < 1) {
    return "< 1 min";
  } else if (minutes < 2) {
    return "~1 min";
  } else {
    return `~${Math.round(minutes)} min`;
  }
}

/**
 * Format dimensions for display
 */
export function formatDimensions(width: number, height: number): string {
  return `${width.toLocaleString()} × ${height.toLocaleString()}`;
}
