/**
 * Client-Side Tile Splitting Utility
 * 
 * Splits upscaled tiles into smaller sub-tiles in the browser
 * between upscaling stages. Uses the template system to determine
 * exactly how many sub-tiles each tile should be split into.
 * 
 * Key principle: Templates define splitFromPrevious factor (1, 4, 9, etc.)
 * which tells us exactly how to split tiles between stages.
 */

import { createClient } from '@supabase/supabase-js';
import { getScaleConfig, type StageConfig } from './scaleTemplates';

// GPU memory limit for Replicate models (~2.1M pixels = ~1448x1448)
const GPU_MAX_PIXELS = 2000000;
const GPU_MAX_DIMENSION = Math.floor(Math.sqrt(GPU_MAX_PIXELS)); // ~1414px

export interface TileInfo {
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
  stage3_url?: string | null;
  stage3_prediction_id?: string | null;
  status: string;
  error: string | null;
  // Sub-tile tracking
  parent_tile_id?: number;
  is_sub_tile?: boolean;
  sub_tile_index?: number;
  sub_tile_grid?: { cols: number; rows: number };
  [key: string]: unknown;
}

export interface SplitResult {
  originalTileCount: number;
  newTileCount: number;
  tilesData: TileInfo[];
  splitDetails: {
    tileId: number;
    splitInto: number;
    subTileIds: number[];
  }[];
}

/**
 * Load an image from URL as HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Calculate how many splits are needed to keep tile under GPU limit
 */
export function calculateSplitFactor(width: number, height: number): { cols: number; rows: number } {
  const pixels = width * height;
  if (pixels <= GPU_MAX_PIXELS) {
    return { cols: 1, rows: 1 }; // No split needed
  }
  
  // Calculate minimum splits needed, preferring square-ish splits
  let cols = 1;
  let rows = 1;
  while ((width / cols) * (height / rows) > GPU_MAX_PIXELS) {
    // Split the larger dimension first
    if (width / cols >= height / rows) {
      cols++;
    } else {
      rows++;
    }
  }
  return { cols, rows };
}

/**
 * Check if tiles need splitting before a given stage
 * Returns true if any tile would exceed GPU memory limit
 */
export function needsSplittingForStage(
  tiles: TileInfo[],
  completedStage: number,
  nextStageScale: number
): boolean {
  for (const tile of tiles) {
    // Get the output URL from the completed stage
    const stageUrl = completedStage === 1 
      ? tile.stage1_url 
      : completedStage === 2 
        ? tile.stage2_url 
        : (tile as any)[`stage${completedStage}_url`];
    
    if (!stageUrl) continue;
    
    // Estimate output size based on tile dimensions and cumulative scale
    // The tile's width/height are in original coordinates
    // After stage N, the actual size is width * (product of all scales up to N)
    const cumulativeScale = Math.pow(4, completedStage); // Assuming 4x per stage
    const estimatedWidth = tile.width * cumulativeScale;
    const estimatedHeight = tile.height * cumulativeScale;
    const estimatedPixels = estimatedWidth * estimatedHeight;
    
    console.log(`[ClientSplitter] Tile ${tile.tile_id} after stage ${completedStage}: ~${estimatedWidth}×${estimatedHeight} = ${(estimatedPixels/1000000).toFixed(1)}M pixels`);
    
    if (estimatedPixels > GPU_MAX_PIXELS) {
      console.log(`[ClientSplitter] Tile ${tile.tile_id} exceeds GPU limit, splitting needed`);
      return true;
    }
  }
  return false;
}

/**
 * Split a single tile image into sub-tiles
 */
async function splitTileImage(
  imageUrl: string,
  cols: number,
  rows: number,
  overlap: number = 32
): Promise<Blob[]> {
  console.log(`[ClientSplitter] Splitting image into ${cols}×${rows} = ${cols * rows} sub-tiles`);
  
  const img = await loadImage(imageUrl);
  const imgWidth = img.width;
  const imgHeight = img.height;
  
  console.log(`[ClientSplitter] Source image: ${imgWidth}×${imgHeight}`);
  
  // Calculate sub-tile dimensions with overlap
  const baseSubWidth = Math.ceil(imgWidth / cols);
  const baseSubHeight = Math.ceil(imgHeight / rows);
  
  const subTiles: Blob[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate crop region with overlap
      let x = col * baseSubWidth - (col > 0 ? overlap : 0);
      let y = row * baseSubHeight - (row > 0 ? overlap : 0);
      let width = baseSubWidth + (col > 0 ? overlap : 0) + (col < cols - 1 ? overlap : 0);
      let height = baseSubHeight + (row > 0 ? overlap : 0) + (row < rows - 1 ? overlap : 0);
      
      // Clamp to image bounds
      x = Math.max(0, x);
      y = Math.max(0, y);
      width = Math.min(width, imgWidth - x);
      height = Math.min(height, imgHeight - y);
      
      console.log(`[ClientSplitter] Sub-tile [${row},${col}]: crop (${x},${y}) ${width}×${height}`);
      
      // Create canvas for this sub-tile
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get 2D context');
      }
      
      // Draw the cropped region
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error('Failed to create blob')),
          'image/png',
          1.0
        );
      });
      
      subTiles.push(blob);
    }
  }
  
  return subTiles;
}

/**
 * Upload a blob to Supabase storage
 */
async function uploadSubTile(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  parentTileId: number,
  subTileIndex: number,
  stage: number,
  blob: Blob
): Promise<string> {
  const filename = `${jobId}/subtile_${parentTileId}_${subTileIndex}_stage${stage}_input.png`;
  
  console.log(`[ClientSplitter] Uploading sub-tile to ${filename}`);
  
  const { data, error } = await supabase.storage
    .from('upscale-tiles')
    .upload(filename, blob, {
      contentType: 'image/png',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload sub-tile: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('upscale-tiles')
    .getPublicUrl(filename);
  
  return urlData.publicUrl;
}

/**
 * Split tiles that are too large for the next stage's GPU memory
 * This is called between stages to break down large tiles into smaller ones
 */
export async function splitTilesForNextStage(
  tiles: TileInfo[],
  completedStage: number,
  jobId: string,
  supabaseUrl: string,
  supabaseKey: string,
  onProgress?: (percent: number, message: string) => void
): Promise<SplitResult> {
  console.log(`[ClientSplitter] ========== SPLITTING TILES FOR STAGE ${completedStage + 1} ==========`);
  console.log(`[ClientSplitter] Input tiles: ${tiles.length}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const newTiles: TileInfo[] = [];
  const splitDetails: SplitResult['splitDetails'] = [];
  let nextTileId = Math.max(...tiles.map(t => t.tile_id)) + 1;
  let processedCount = 0;
  
  for (const tile of tiles) {
    processedCount++;
    const progressPercent = (processedCount / tiles.length) * 100;
    
    // Get the output URL from the completed stage
    const stageUrlKey = `stage${completedStage}_url`;
    const stageUrl = completedStage === 1 
      ? tile.stage1_url 
      : completedStage === 2 
        ? tile.stage2_url 
        : (tile as any)[stageUrlKey];
    
    if (!stageUrl) {
      console.warn(`[ClientSplitter] Tile ${tile.tile_id} missing stage${completedStage}_url, keeping as-is`);
      newTiles.push(tile);
      continue;
    }
    
    // Load the image to get actual dimensions
    if (onProgress) {
      onProgress(progressPercent * 0.3, `Analyzing tile ${tile.tile_id}...`);
    }
    
    let img: HTMLImageElement;
    try {
      img = await loadImage(stageUrl);
    } catch (error) {
      console.error(`[ClientSplitter] Failed to load tile ${tile.tile_id}:`, error);
      newTiles.push(tile);
      continue;
    }
    
    const actualWidth = img.width;
    const actualHeight = img.height;
    const actualPixels = actualWidth * actualHeight;
    
    console.log(`[ClientSplitter] Tile ${tile.tile_id}: ${actualWidth}×${actualHeight} = ${(actualPixels/1000000).toFixed(2)}M pixels`);
    
    // Check if splitting is needed
    const { cols, rows } = calculateSplitFactor(actualWidth, actualHeight);
    
    if (cols === 1 && rows === 1) {
      // No split needed, keep original tile
      console.log(`[ClientSplitter] Tile ${tile.tile_id} fits in GPU memory, no split needed`);
      newTiles.push(tile);
      continue;
    }
    
    // Split this tile
    console.log(`[ClientSplitter] Tile ${tile.tile_id} needs ${cols}×${rows} = ${cols * rows} split`);
    
    if (onProgress) {
      onProgress(progressPercent * 0.3 + 10, `Splitting tile ${tile.tile_id} into ${cols * rows} sub-tiles...`);
    }
    
    // Calculate the scale factor from original to current stage output
    const scaleFromOriginal = actualWidth / tile.width;
    
    // Split the image
    const subTileBlobs = await splitTileImage(stageUrl, cols, rows, 32);
    
    // Upload sub-tiles and create new tile entries
    const subTileIds: number[] = [];
    const baseSubWidth = Math.ceil(actualWidth / cols);
    const baseSubHeight = Math.ceil(actualHeight / rows);
    
    for (let i = 0; i < subTileBlobs.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const subTileId = nextTileId++;
      subTileIds.push(subTileId);
      
      if (onProgress) {
        const subProgress = progressPercent * 0.3 + 10 + (i / subTileBlobs.length) * 50;
        onProgress(subProgress, `Uploading sub-tile ${i + 1}/${subTileBlobs.length} of tile ${tile.tile_id}...`);
      }
      
      // Upload the sub-tile
      const subTileUrl = await uploadSubTile(
        supabase,
        jobId,
        tile.tile_id,
        i,
        completedStage + 1,
        subTileBlobs[i]
      );
      
      // Calculate sub-tile position in original image coordinates
      // The sub-tile's position is relative to the parent tile's position
      const subTileX = tile.x + (col * baseSubWidth) / scaleFromOriginal;
      const subTileY = tile.y + (row * baseSubHeight) / scaleFromOriginal;
      const subTileWidth = baseSubWidth / scaleFromOriginal;
      const subTileHeight = baseSubHeight / scaleFromOriginal;
      
      // Create new tile entry for this sub-tile
      const subTile: TileInfo = {
        tile_id: subTileId,
        x: subTileX,
        y: subTileY,
        width: subTileWidth,
        height: subTileHeight,
        input_url: subTileUrl, // The sub-tile image becomes the input for next stage
        stage1_url: completedStage >= 1 ? subTileUrl : null,
        stage2_url: completedStage >= 2 ? subTileUrl : null,
        stage1_prediction_id: null,
        stage2_prediction_id: null,
        status: `stage${completedStage}_complete`, // Ready for next stage
        error: null,
        // Track parent relationship
        parent_tile_id: tile.tile_id,
        is_sub_tile: true,
        sub_tile_index: i,
        sub_tile_grid: { cols, rows }
      };
      
      // Copy over any existing stage URLs from parent
      if (completedStage >= 3) {
        (subTile as any)[`stage${completedStage}_url`] = subTileUrl;
      }
      
      newTiles.push(subTile);
      console.log(`[ClientSplitter] Created sub-tile ${subTileId} at (${subTileX.toFixed(0)}, ${subTileY.toFixed(0)}) ${subTileWidth.toFixed(0)}×${subTileHeight.toFixed(0)}`);
    }
    
    splitDetails.push({
      tileId: tile.tile_id,
      splitInto: cols * rows,
      subTileIds
    });
  }
  
  console.log(`[ClientSplitter] ========== SPLIT COMPLETE ==========`);
  console.log(`[ClientSplitter] Original tiles: ${tiles.length}`);
  console.log(`[ClientSplitter] New tiles: ${newTiles.length}`);
  console.log(`[ClientSplitter] Tiles split: ${splitDetails.length}`);
  
  if (onProgress) {
    onProgress(100, `Split complete: ${tiles.length} → ${newTiles.length} tiles`);
  }
  
  return {
    originalTileCount: tiles.length,
    newTileCount: newTiles.length,
    tilesData: newTiles,
    splitDetails
  };
}

/**
 * Check if any tiles need splitting and return split info
 */
export function analyzeTilesForSplitting(
  tiles: TileInfo[],
  completedStage: number
): { needsSplit: boolean; tilesToSplit: number; estimatedNewTiles: number } {
  let tilesToSplit = 0;
  let estimatedNewTiles = tiles.length;
  
  for (const tile of tiles) {
    // Estimate tile size after completed stage
    // Assuming 4x scale per stage
    const cumulativeScale = Math.pow(4, completedStage);
    const estimatedWidth = tile.width * cumulativeScale;
    const estimatedHeight = tile.height * cumulativeScale;
    const estimatedPixels = estimatedWidth * estimatedHeight;
    
    if (estimatedPixels > GPU_MAX_PIXELS) {
      tilesToSplit++;
      const { cols, rows } = calculateSplitFactor(estimatedWidth, estimatedHeight);
      estimatedNewTiles += (cols * rows) - 1; // -1 because we're replacing the original
    }
  }
  
  return {
    needsSplit: tilesToSplit > 0,
    tilesToSplit,
    estimatedNewTiles
  };
}

/**
 * Split tiles using template-defined split factor
 * This uses the pre-calculated splitFromPrevious value from the template
 * to ensure predictable tile counts at each stage.
 */
export async function splitTilesWithTemplate(
  tiles: TileInfo[],
  completedStage: number,
  nextStageConfig: StageConfig,
  jobId: string,
  supabaseUrl: string,
  supabaseKey: string,
  onProgress?: (percent: number, message: string) => void
): Promise<SplitResult> {
  const splitFactor = nextStageConfig.splitFromPrevious;
  
  console.log(`[ClientSplitter] ========== TEMPLATE-BASED SPLIT ==========`);
  console.log(`[ClientSplitter] Stage ${completedStage} → Stage ${nextStageConfig.stageNumber}`);
  console.log(`[ClientSplitter] Split factor: ${splitFactor} (each tile → ${splitFactor} sub-tiles)`);
  console.log(`[ClientSplitter] Input tiles: ${tiles.length}, Expected output: ${tiles.length * splitFactor}`);
  
  // If no split needed, return tiles as-is
  if (splitFactor === 1) {
    console.log(`[ClientSplitter] No split needed (splitFactor = 1)`);
    return {
      originalTileCount: tiles.length,
      newTileCount: tiles.length,
      tilesData: tiles,
      splitDetails: []
    };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Calculate grid dimensions from split factor
  // splitFactor 4 = 2×2, splitFactor 9 = 3×3, etc.
  const gridSize = Math.sqrt(splitFactor);
  const cols = Math.ceil(gridSize);
  const rows = Math.ceil(gridSize);
  
  console.log(`[ClientSplitter] Split grid: ${cols}×${rows}`);
  
  const newTiles: TileInfo[] = [];
  const splitDetails: SplitResult['splitDetails'] = [];
  let nextTileId = Math.max(...tiles.map(t => t.tile_id)) + 1;
  let processedCount = 0;
  
  for (const tile of tiles) {
    processedCount++;
    const progressPercent = (processedCount / tiles.length) * 100;
    
    // Get the output URL from the completed stage
    const stageUrl = completedStage === 1 
      ? tile.stage1_url 
      : completedStage === 2 
        ? tile.stage2_url 
        : (tile as Record<string, unknown>)[`stage${completedStage}_url`] as string | null;
    
    if (!stageUrl) {
      console.warn(`[ClientSplitter] Tile ${tile.tile_id} missing stage${completedStage}_url, skipping`);
      continue;
    }
    
    if (onProgress) {
      onProgress(progressPercent * 0.3, `Splitting tile ${tile.tile_id}...`);
    }
    
    // Load the image
    let img: HTMLImageElement;
    try {
      img = await loadImage(stageUrl);
    } catch (error) {
      console.error(`[ClientSplitter] Failed to load tile ${tile.tile_id}:`, error);
      continue;
    }
    
    const actualWidth = img.width;
    const actualHeight = img.height;
    
    console.log(`[ClientSplitter] Tile ${tile.tile_id}: ${actualWidth}×${actualHeight}`);
    
    // Calculate the scale factor from original to current stage output
    const scaleFromOriginal = actualWidth / tile.width;
    
    // Split the image using template grid
    const subTileBlobs = await splitTileImage(stageUrl, cols, rows, 32);
    
    // Upload sub-tiles and create new tile entries
    const subTileIds: number[] = [];
    const baseSubWidth = Math.ceil(actualWidth / cols);
    const baseSubHeight = Math.ceil(actualHeight / rows);
    
    for (let i = 0; i < subTileBlobs.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const subTileId = nextTileId++;
      subTileIds.push(subTileId);
      
      if (onProgress) {
        const subProgress = progressPercent * 0.3 + 10 + (i / subTileBlobs.length) * 50;
        onProgress(subProgress, `Uploading sub-tile ${i + 1}/${subTileBlobs.length}...`);
      }
      
      // Upload the sub-tile
      const subTileUrl = await uploadSubTile(
        supabase,
        jobId,
        tile.tile_id,
        i,
        nextStageConfig.stageNumber,
        subTileBlobs[i]
      );
      
      // Calculate sub-tile position in original image coordinates
      const subTileX = tile.x + (col * baseSubWidth) / scaleFromOriginal;
      const subTileY = tile.y + (row * baseSubHeight) / scaleFromOriginal;
      const subTileWidth = baseSubWidth / scaleFromOriginal;
      const subTileHeight = baseSubHeight / scaleFromOriginal;
      
      // Create new tile entry
      const subTile: TileInfo = {
        tile_id: subTileId,
        x: subTileX,
        y: subTileY,
        width: subTileWidth,
        height: subTileHeight,
        input_url: subTileUrl,
        stage1_url: completedStage >= 1 ? subTileUrl : null,
        stage2_url: completedStage >= 2 ? subTileUrl : null,
        stage1_prediction_id: null,
        stage2_prediction_id: null,
        status: `stage${completedStage}_complete`,
        error: null,
        parent_tile_id: tile.tile_id,
        is_sub_tile: true,
        sub_tile_index: i,
        sub_tile_grid: { cols, rows }
      };
      
      newTiles.push(subTile);
    }
    
    splitDetails.push({
      tileId: tile.tile_id,
      splitInto: cols * rows,
      subTileIds
    });
  }
  
  console.log(`[ClientSplitter] ========== TEMPLATE SPLIT COMPLETE ==========`);
  console.log(`[ClientSplitter] Original: ${tiles.length} tiles → New: ${newTiles.length} tiles`);
  
  if (onProgress) {
    onProgress(100, `Split complete: ${tiles.length} → ${newTiles.length} tiles`);
  }
  
  return {
    originalTileCount: tiles.length,
    newTileCount: newTiles.length,
    tilesData: newTiles,
    splitDetails
  };
}




