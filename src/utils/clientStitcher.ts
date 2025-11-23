/**
 * Client-Side Image Stitching Utility
 * 
 * Composites upscaled tiles in the browser to create the final image.
 * Uses Canvas API for memory-efficient tile-by-tile processing.
 */

interface TileInfo {
  tile_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stage1_url: string | null;
  stage2_url: string | null;
}

interface TilingGrid {
  tilesX: number;
  tilesY: number;
  tileWidth: number;
  tileHeight: number;
  overlap: number;
  totalTiles: number;
}

interface StitchResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Load an image from URL as HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS for Supabase storage
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Downscale an image to exact target dimensions using high-quality canvas rendering
 */
async function downscaleToExactSize(
  sourceBlob: Blob,
  targetWidth: number,
  targetHeight: number,
  onProgress?: (percent: number, message: string) => void
): Promise<StitchResult> {
  console.log(`[ClientStitcher] Downscaling from blob to ${targetWidth}×${targetHeight}`);
  
  if (onProgress) {
    onProgress(95, 'Adjusting to exact dimensions...');
  }
  
  // Load the source image
  const url = URL.createObjectURL(sourceBlob);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  
  console.log(`[ClientStitcher] Source image: ${img.width}×${img.height}`);
  
  // Create canvas at target size
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }
  
  // Use high-quality downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw downscaled image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Failed to convert canvas to blob')),
      'image/png',
      1.0
    );
  });
  
  console.log(`[ClientStitcher] ✅ Downscaled to exact size`);
  
  return { blob, width: targetWidth, height: targetHeight };
}

/**
 * Stitch tiles together in the browser
 */
export async function stitchTilesInBrowser(
  tiles: TileInfo[],
  grid: TilingGrid,
  targetScale: number,
  onProgress?: (percent: number, message: string) => void
): Promise<StitchResult> {
  console.log('[ClientStitcher] Starting stitch process...');
  console.log('[ClientStitcher] Grid:', grid);
  console.log('[ClientStitcher] Target scale:', targetScale);
  console.log('[ClientStitcher] Tiles:', tiles.length);

  // Calculate original image dimensions from tile data
  // Tiles have x, y, width, height in original (pre-upscale) coordinates
  // Find the bottom-right corner of the image by getting the max x+width and y+height
  const originalWidth = Math.max(...tiles.map(t => t.x + t.width));
  const originalHeight = Math.max(...tiles.map(t => t.y + t.height));

  console.log(`[ClientStitcher] Original dimensions (from tiles): ${originalWidth}×${originalHeight}`);

  // Calculate final dimensions by scaling the original image size
  const finalWidth = originalWidth * targetScale;
  const finalHeight = originalHeight * targetScale;
  
  console.log(`[ClientStitcher] Final canvas size: ${finalWidth}×${finalHeight} (${targetScale}× scale)`);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  // Download and composite tiles one by one
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    
    // Find the final stage URL (work backwards from potential stage 3, 2, 1)
    // Check for stage3+ dynamically
    let tileUrl: string | null = null;
    
    // Check up to stage 10 (covers even extreme multi-stage chains)
    for (let stage = 10; stage >= 1; stage--) {
      let stageUrl: string | null = null;
      
      if (stage === 1) {
        stageUrl = tile.stage1_url;
      } else if (stage === 2) {
        stageUrl = tile.stage2_url;
      } else {
        stageUrl = (tile as any)[`stage${stage}_url`];
      }
      
      if (stageUrl) {
        tileUrl = stageUrl;
        break;
      }
    }
    
    if (!tileUrl) {
      console.warn(`[ClientStitcher] Tile ${tile.tile_id} missing output URL, skipping`);
      continue;
    }

    const progress = ((i + 1) / tiles.length) * 100;
    const message = `Stitching tile ${i + 1}/${tiles.length}...`;
    
    if (onProgress) {
      onProgress(progress, message);
    }

    console.log(`[ClientStitcher] Loading tile ${tile.tile_id} from ${tileUrl}`);

    try {
      // Load tile image
      const img = await loadImage(tileUrl);
      
      // Calculate position (scaled from original tile coordinates)
      const x = tile.x * targetScale;
      const y = tile.y * targetScale;
      
      console.log(`[ClientStitcher] Drawing tile ${tile.tile_id} at (${x}, ${y}), size: ${img.width}×${img.height}`);
      
      // Apply feathered blending if tile has overlap with neighbors
      const overlap = grid.overlap * targetScale; // Scale overlap to match upscaled dimensions
      const tileX = Math.floor(tile.tile_id % grid.tilesX);
      const tileY = Math.floor(tile.tile_id / grid.tilesX);
      
      if (overlap > 0 && (tileX > 0 || tileY > 0)) {
        // This tile has overlap regions that need blending
        console.log(`[ClientStitcher] Applying feathered blend to tile ${tile.tile_id} (overlap: ${overlap}px)`);
        
        // Create temporary canvas for this tile with alpha blending
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) {
          console.warn(`[ClientStitcher] Failed to create temp context for tile ${tile.tile_id}, drawing without blend`);
          ctx.drawImage(img, x, y);
          continue;
        }
        
        // Draw tile to temp canvas
        tempCtx.drawImage(img, 0, 0);
        
        // Apply feather masks to overlap regions using pixel manipulation
        // This correctly handles both edges AND corners by combining fade factors
        const featherSize = overlap; // Blend across entire overlap region
        
        if (featherSize > 0) {
          const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
          const pixels = imageData.data;
          
          // Modify alpha channel for each pixel in the overlap regions
          for (let py = 0; py < img.height; py++) {
            for (let px = 0; px < img.width; px++) {
              const pixelIndex = (py * img.width + px) * 4;
              
              let alphaMultiplier = 1.0;
              
              // Left edge fade (if not first column)
              if (tileX > 0 && px < featherSize) {
                const leftFade = px / featherSize; // 0.0 at edge to 1.0 at featherSize
                alphaMultiplier *= leftFade;
              }
              
              // Top edge fade (if not first row)
              if (tileY > 0 && py < featherSize) {
                const topFade = py / featherSize; // 0.0 at edge to 1.0 at featherSize
                alphaMultiplier *= topFade;
              }
              
              // Apply the combined fade to the alpha channel
              // Note: corners get both fades multiplied (e.g., 0.5 * 0.5 = 0.25)
              if (alphaMultiplier < 1.0) {
                pixels[pixelIndex + 3] = Math.round(pixels[pixelIndex + 3] * alphaMultiplier);
              }
            }
          }
          
          // Put the modified pixel data back
          tempCtx.putImageData(imageData, 0, 0);
        }
        
        // Draw blended tile to main canvas
        ctx.drawImage(tempCanvas, x, y);
      } else {
        // No overlap or first tile, draw normally
        ctx.drawImage(img, x, y);
      }
      
      console.log(`[ClientStitcher] Tile ${tile.tile_id} composited successfully`);
    } catch (error) {
      console.error(`[ClientStitcher] Error processing tile ${tile.tile_id}:`, error);
      throw new Error(`Failed to load tile ${tile.tile_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('[ClientStitcher] All tiles composited! Converting to blob...');

  if (onProgress) {
    onProgress(100, 'Finalizing image...');
  }

  // Convert canvas to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/png',
      1.0 // Maximum quality
    );
  });

  console.log(`[ClientStitcher] ✅ Stitch complete! Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  // Check if we need to downscale to exact dimensions
  // This handles cases where chaining strategies overshoot the target scale
  const exactTargetWidth = Math.round(originalWidth * targetScale);
  const exactTargetHeight = Math.round(originalHeight * targetScale);
  
  if (finalWidth !== exactTargetWidth || finalHeight !== exactTargetHeight) {
    console.log(`[ClientStitcher] Output ${finalWidth}×${finalHeight} doesn't match exact target ${exactTargetWidth}×${exactTargetHeight}`);
    console.log(`[ClientStitcher] Applying downscaling to achieve exact scale factor...`);
    return await downscaleToExactSize(blob, exactTargetWidth, exactTargetHeight, onProgress);
  }

  return {
    blob,
    width: finalWidth,
    height: finalHeight
  };
}




