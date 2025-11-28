/**
 * Browser canvas and image size limits
 */

export interface BrowserLimits {
  name: string;
  maxPixels: number;
  maxDimension: number;
}

export const BROWSER_LIMITS: Record<string, BrowserLimits> = {
  chrome: {
    name: 'Chrome/Edge',
    maxPixels: 1_000_000_000, // ~1 billion pixels
    maxDimension: 32767,
  },
  safari_macos: {
    name: 'Safari (macOS)',
    maxPixels: 268_000_000, // ~268M pixels
    maxDimension: 16384,
  },
  safari_ios: {
    name: 'Safari (iOS)',
    maxPixels: 16_700_000, // ~16.7M pixels
    maxDimension: 4096,
  },
  firefox: {
    name: 'Firefox',
    maxPixels: 500_000_000, // ~500M pixels
    maxDimension: 32767,
  },
};

export interface BrowserInfo {
  limits: BrowserLimits;
  isIOS: boolean;
  isSafari: boolean;
}

/**
 * Detect current browser and return its limits
 */
export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  if (isIOS) {
    return {
      limits: BROWSER_LIMITS.safari_ios,
      isIOS: true,
      isSafari: true,
    };
  }

  if (isSafari) {
    return {
      limits: BROWSER_LIMITS.safari_macos,
      isIOS: false,
      isSafari: true,
    };
  }

  if (isFirefox) {
    return {
      limits: BROWSER_LIMITS.firefox,
      isIOS: false,
      isSafari: false,
    };
  }

  // Default to Chrome (most permissive)
  return {
    limits: BROWSER_LIMITS.chrome,
    isIOS: false,
    isSafari: false,
  };
}

export interface SizeCheckResult {
  withinLimits: boolean;
  finalWidth: number;
  finalHeight: number;
  finalPixels: number;
  browserInfo: BrowserInfo;
  suggestedScale?: number;
  message?: string;
}

/**
 * Check if upscaled image will fit within browser limits
 */
export function checkBrowserLimits(
  originalWidth: number,
  originalHeight: number,
  targetScale: number
): SizeCheckResult {
  const browserInfo = detectBrowser();
  const finalWidth = originalWidth * targetScale;
  const finalHeight = originalHeight * targetScale;
  const finalPixels = finalWidth * finalHeight;

  const withinLimits =
    finalPixels <= browserInfo.limits.maxPixels &&
    finalWidth <= browserInfo.limits.maxDimension &&
    finalHeight <= browserInfo.limits.maxDimension;

  if (!withinLimits) {
    // Calculate suggested scale that would fit
    const maxScaleByPixels = Math.sqrt(
      browserInfo.limits.maxPixels / (originalWidth * originalHeight)
    );
    const maxScaleByWidth = browserInfo.limits.maxDimension / originalWidth;
    const maxScaleByHeight = browserInfo.limits.maxDimension / originalHeight;
    const suggestedScale = Math.floor(
      Math.min(maxScaleByPixels, maxScaleByWidth, maxScaleByHeight)
    );

    const message = `
⚠️ Final image will be ${finalWidth.toLocaleString()}×${finalHeight.toLocaleString()} (${(finalPixels / 1_000_000).toFixed(0)}M pixels)

This exceeds ${browserInfo.limits.name}'s limit of ${(browserInfo.limits.maxPixels / 1_000_000).toFixed(0)}M pixels.

Options:
• Use Chrome/Edge (supports up to 1000M pixels)
• Reduce scale to ${suggestedScale}× or lower
• Download as tiles for assembly in Photoshop (coming soon)
    `.trim();

    return {
      withinLimits: false,
      finalWidth,
      finalHeight,
      finalPixels,
      browserInfo,
      suggestedScale,
      message,
    };
  }

  return {
    withinLimits: true,
    finalWidth,
    finalHeight,
    finalPixels,
    browserInfo,
  };
}

/**
 * Get maximum allowed scale for given image dimensions
 * Caps at 64x maximum
 */
export function getMaxAllowedScale(
  width: number,
  height: number
): number {
  const browserInfo = detectBrowser();
  const maxPixels = browserInfo.limits.maxPixels;
  const maxDimension = browserInfo.limits.maxDimension;
  
  // Calculate max scale based on pixel limit
  const maxScaleByPixels = Math.sqrt(maxPixels / (width * height));
  
  // Calculate max scale based on dimension limits
  const maxScaleByWidth = maxDimension / width;
  const maxScaleByHeight = maxDimension / height;
  
  // Take the most restrictive limit and cap at 64x
  const maxScale = Math.min(
    maxScaleByPixels,
    maxScaleByWidth,
    maxScaleByHeight,
    64
  );
  
  return Math.floor(maxScale);
}

/**
 * Check if result will exceed browser limits
 */
export function willExceedBrowserLimit(
  width: number,
  height: number,
  scale: number
): boolean {
  const result = checkBrowserLimits(width, height, scale);
  return !result.withinLimits;
}

export interface SegmentedDownloadInfo {
  needed: boolean;
  segments?: number;
  segmentSize?: number;
  gridX?: number;
  gridY?: number;
  message?: string;
}

/**
 * Calculate if segmented download is needed and how to split the image
 */
export function calculateSegmentedDownload(
  width: number,
  height: number,
  scale: number
): SegmentedDownloadInfo {
  const result = checkBrowserLimits(width, height, scale);
  
  if (result.withinLimits) {
    return { needed: false };
  }
  
  const browserInfo = result.browserInfo;
  const finalWidth = result.finalWidth;
  const finalHeight = result.finalHeight;
  
  // Calculate segment size based on browser's max dimension
  // Use 90% of max to leave some safety margin
  const maxSegmentDimension = Math.floor(browserInfo.limits.maxDimension * 0.9);
  
  // Calculate how many segments needed in each dimension
  const gridX = Math.ceil(finalWidth / maxSegmentDimension);
  const gridY = Math.ceil(finalHeight / maxSegmentDimension);
  const totalSegments = gridX * gridY;
  
  // Calculate actual segment size
  const segmentWidth = Math.ceil(finalWidth / gridX);
  const segmentHeight = Math.ceil(finalHeight / gridY);
  const segmentSize = Math.max(segmentWidth, segmentHeight);
  
  const message = `
⚠️ The result (${finalWidth.toLocaleString()}×${finalHeight.toLocaleString()}) exceeds your browser's canvas limit.

The image will be split into ${totalSegments} segments (${gridX}×${gridY} grid).
Each segment will be up to ${segmentSize.toLocaleString()}×${segmentSize.toLocaleString()} pixels.

You can download each segment separately and assemble them in Photoshop or other image editing software.

Assembly instructions:
1. Create a new ${finalWidth}×${finalHeight} canvas
2. Place each segment in its correct position
3. Segments are numbered left-to-right, top-to-bottom
  `.trim();
  
  return {
    needed: true,
    segments: totalSegments,
    segmentSize,
    gridX,
    gridY,
    message,
  };
}

