/**
 * Browser Detection Utility
 * 
 * Detects browser type, version, and capabilities for optimal upscaling experience
 */

export interface BrowserInfo {
  name: 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'Opera' | 'Unknown';
  version: number;
  maxCanvasSize: number;
  maxSafeScale: number;
  supportsHighResUpscaling: boolean;
}

/**
 * Detect the current browser and its capabilities
 */
export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  
  // Detect Safari
  if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Edg')) {
    const version = parseInt(ua.match(/Version\/(\d+)/)?.[1] || '0');
    return {
      name: 'Safari',
      version,
      maxCanvasSize: 16384, // Safari has 16K limit
      maxSafeScale: version >= 15 ? 64 : 32, // Older Safari limited to 32x
      supportsHighResUpscaling: version >= 14
    };
  }
  
  // Detect Firefox
  if (ua.includes('Firefox')) {
    const version = parseInt(ua.match(/Firefox\/(\d+)/)?.[1] || '0');
    return {
      name: 'Firefox',
      version,
      maxCanvasSize: 32767, // Firefox has 32K limit
      maxSafeScale: 64,
      supportsHighResUpscaling: version >= 85
    };
  }
  
  // Detect Edge
  if (ua.includes('Edg')) {
    const version = parseInt(ua.match(/Edg\/(\d+)/)?.[1] || '0');
    return {
      name: 'Edge',
      version,
      maxCanvasSize: 32767, // Edge (Chromium) has 32K limit
      maxSafeScale: 64,
      supportsHighResUpscaling: version >= 88
    };
  }
  
  // Detect Opera
  if (ua.includes('OPR') || ua.includes('Opera')) {
    const version = parseInt(ua.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || '0');
    return {
      name: 'Opera',
      version,
      maxCanvasSize: 32767, // Opera (Chromium) has 32K limit
      maxSafeScale: 64,
      supportsHighResUpscaling: version >= 74
    };
  }
  
  // Detect Chrome (must be last as Edge/Opera include "Chrome" in UA)
  if (ua.includes('Chrome')) {
    const version = parseInt(ua.match(/Chrome\/(\d+)/)?.[1] || '0');
    return {
      name: 'Chrome',
      version,
      maxCanvasSize: 32767, // Chrome has 32K limit
      maxSafeScale: 64,
      supportsHighResUpscaling: version >= 88
    };
  }
  
  // Unknown browser - conservative limits
  return {
    name: 'Unknown',
    version: 0,
    maxCanvasSize: 16384,
    maxSafeScale: 32,
    supportsHighResUpscaling: false
  };
}

/**
 * Check if a specific scale is safe for the current browser and image size
 */
export function isScaleSafeForBrowser(
  originalWidth: number,
  originalHeight: number,
  scale: number,
  browserInfo: BrowserInfo
): { safe: boolean; reason?: string } {
  const finalWidth = originalWidth * scale;
  const finalHeight = originalHeight * scale;
  const maxDimension = Math.max(finalWidth, finalHeight);
  
  // Check if scale exceeds browser's max safe scale
  if (scale > browserInfo.maxSafeScale) {
    return {
      safe: false,
      reason: `${scale}x upscaling may not be supported in ${browserInfo.name}. Try ${browserInfo.maxSafeScale}x or use Chrome/Firefox.`
    };
  }
  
  // Check if final dimensions exceed canvas size limit
  if (maxDimension > browserInfo.maxCanvasSize) {
    return {
      safe: false,
      reason: `Final image (${finalWidth}×${finalHeight}) exceeds ${browserInfo.name}'s canvas limit (${browserInfo.maxCanvasSize}px). Try a smaller scale or use Chrome/Firefox.`
    };
  }
  
  // Warn if approaching limits (80% of max)
  if (maxDimension > browserInfo.maxCanvasSize * 0.8) {
    return {
      safe: true,
      reason: `Large output (${finalWidth}×${finalHeight}) may be slow in ${browserInfo.name}. Chrome/Firefox recommended for best performance.`
    };
  }
  
  return { safe: true };
}

/**
 * Get recommended browsers message
 */
export function getRecommendedBrowsersMessage(): string {
  return 'For best results with high-resolution upscaling (32x-64x), we recommend Chrome 88+, Firefox 85+, or Edge 88+.';
}

/**
 * Get browser-specific warning for high scales
 */
export function getBrowserWarning(browserInfo: BrowserInfo, scale: number): string | null {
  if (browserInfo.name === 'Safari' && scale >= 32) {
    return `Safari may have issues with ${scale}x upscaling on large images. For best results, use Chrome or Firefox.`;
  }
  
  if (!browserInfo.supportsHighResUpscaling && scale >= 32) {
    return `Your browser may not fully support ${scale}x upscaling. Please update to the latest version or use Chrome/Firefox.`;
  }
  
  if (browserInfo.name === 'Unknown') {
    return `Your browser may not be fully supported. For best results, use Chrome 88+, Firefox 85+, or Safari 14+.`;
  }
  
  return null;
}

