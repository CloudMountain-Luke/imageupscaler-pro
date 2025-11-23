/**
 * Token Estimation Utility
 * 
 * Estimates the number of tokens required for an upscale job based on:
 * - Scale factor (2x-32x)
 * - Image dimensions
 * - Whether tiling is needed
 */

import type { Scale } from '../../shared/types';

interface TokenEstimate {
  tokens: number;
  requiresTiling: boolean;
  estimatedTiles?: number;
}

/**
 * Calculate if tiling is needed and estimate tile count
 * This is a simplified client-side version of the server's tiling logic
 */
function estimateTilingNeeds(
  width: number,
  height: number,
  targetScale: Scale
): { needsTiling: boolean; estimatedTiles: number } {
  // Dynamic MIN_TILE_SIZE based on target scale (matches server logic)
  let MIN_TILE_SIZE: number;
  if (targetScale <= 12) {
    MIN_TILE_SIZE = 200;
  } else if (targetScale <= 20) {
    MIN_TILE_SIZE = 150;
  } else {
    MIN_TILE_SIZE = 100; // For 24x-32x
  }

  // If image fits within MIN_TILE_SIZE, no tiling needed
  if (width <= MIN_TILE_SIZE && height <= MIN_TILE_SIZE) {
    return { needsTiling: false, estimatedTiles: 1 };
  }

  // Estimate tile count (simplified - actual may vary slightly)
  const tilesX = Math.ceil(width / MIN_TILE_SIZE);
  const tilesY = Math.ceil(height / MIN_TILE_SIZE);
  const estimatedTiles = tilesX * tilesY;

  return { needsTiling: true, estimatedTiles };
}

/**
 * Estimate tokens required for an upscale job
 * 
 * Token logic:
 * - Photos/Anime: 2x-10x: 1 token (single pass, no tiling)
 * - Art & Illustrations: Always processes at 4x minimum, so token cost reflects actual processing
 * - 12x-32x: If tiling needed, tokens = tile count (each tile is processed)
 * - 12x-32x: If no tiling needed, 1 token
 */
export function estimateTokenCost(
  width: number,
  height: number,
  targetScale: Scale,
  contentType?: string
): TokenEstimate {
  // For Art & Illustrations, always use 4x SwinIR as base
  // This means even 2x requests process at 4x (then downscale)
  const isArt = contentType === 'art' || contentType === 'text';
  const effectiveScale = isArt ? Math.max(4, targetScale) : targetScale;
  
  // Check if image is large enough to need tiling
  const NATIVE_SAFE_DIMENSION = 1400;
  const needsTilingForSize = width > NATIVE_SAFE_DIMENSION || height > NATIVE_SAFE_DIMENSION;
  
  // For small images at low scales, always 1 token
  if (!needsTilingForSize && targetScale <= 10) {
    return {
      tokens: 1,
      requiresTiling: false
    };
  }
  
  // For large images or high scales, check if tiling is needed
  if (targetScale >= 12 || needsTilingForSize) {
    const { needsTiling, estimatedTiles } = estimateTilingNeeds(width, height, effectiveScale);
    
    if (!needsTiling) {
      return {
        tokens: 1,
        requiresTiling: false
      };
    }
    
    return {
      tokens: estimatedTiles,
      requiresTiling: true,
      estimatedTiles
    };
  }

  // Default: 1 token
  return {
    tokens: 1,
    requiresTiling: false
  };
}

/**
 * Format token cost for display
 */
export function formatTokenCost(estimate: TokenEstimate): string {
  if (estimate.tokens === 1) {
    return '1 token';
  }

  if (estimate.requiresTiling && estimate.estimatedTiles) {
    return `~${estimate.tokens} tokens (${estimate.estimatedTiles} tiles)`;
  }

  return `${estimate.tokens} tokens`;
}


