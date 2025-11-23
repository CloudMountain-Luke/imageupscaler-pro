import type { Quality, PlanTier } from '../types/upscale';

export interface ImageTypeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  model: string; // Maps to the actual AI model
  supportedScales: number[];
  exampleImage?: string; // Background image for the card
}

export const IMAGE_TYPES: Record<string, ImageTypeInfo> = {
  'photo': {
    id: 'photo',
    name: 'Photos',
    description: 'Natural photos, portraits, real-world images',
    icon: '📸',
    model: 'photo-real-esrgan',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64],
    exampleImage: '/images/photo-sm.webp'
  },
  'art': {
    id: 'art',
    name: 'Art & Illustrations',
    description: 'Digital art, paintings, illustrations',
    icon: '🎨',
    model: 'art-swinir',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64],
    exampleImage: '/images/art-illustrations_sm.webp'
  },
  'anime': {
    id: 'anime',
    name: 'Anime & Cartoons',
    description: 'Anime, cartoons, animated content',
    icon: '🎌',
    model: 'anime-real-esrgan',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64],
    exampleImage: '/images/anime-sm.webp'
  },
  'text': {
    id: 'text',
    name: 'Text & Documents',
    description: 'Documents, text, screenshots',
    icon: '📄',
    model: 'art-swinir',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64],
    exampleImage: '/images/text-sm.webp'
  },
  'extreme': {
    id: 'extreme',
    name: 'Extreme Upscaling',
    description: 'Maximum detail preservation (16x+)',
    icon: '⚡',
    model: 'controlnet-tile',
    supportedScales: [16, 20, 24, 28, 32, 64]
  }
};

export function getAvailableScalesForImageType(imageType: string, plan: PlanTier): number[] {
  const imageTypeInfo = IMAGE_TYPES[imageType];
  if (!imageTypeInfo) return [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64];
  
  // Return full unified scale range for all image types
  // Plan restrictions are handled at processing time, not UI level
  return imageTypeInfo.supportedScales;
}

export function getImageTypeInfo(imageType: string): ImageTypeInfo | undefined {
  return IMAGE_TYPES[imageType];
}

export function getModelForImageType(imageType: string): string {
  const imageTypeInfo = IMAGE_TYPES[imageType];
  return imageTypeInfo?.model || 'photo-real-esrgan';
}

export function getAllImageTypes(): ImageTypeInfo[] {
  return Object.values(IMAGE_TYPES);
}

// Smart model selection based on image type and scale (seamless)
export function getBestModelForScale(imageType: string, scale: number): {
  model: string;
  requiresModelSwitch: boolean;
} {
  const imageTypeInfo = IMAGE_TYPES[imageType];
  if (!imageTypeInfo) {
    return { model: 'photo-real-esrgan', requiresModelSwitch: false };
  }

  // Define optimal scale ranges for each primary model
  const modelRanges = {
    'photo-real-esrgan': { max: 8 },
    'anime-real-esrgan': { max: 8 },
    'art-swinir': { max: 4 },
    'controlnet-tile': { max: 32 }
  };

  const primaryModel = imageTypeInfo.model;
  const primaryRange = modelRanges[primaryModel as keyof typeof modelRanges];
  
  // If scale is within primary model's optimal range, use primary model
  if (scale <= primaryRange.max) {
    return { 
      model: primaryModel, 
      requiresModelSwitch: false 
    };
  }

  // For higher scales, seamlessly switch to ControlNet
  return {
    model: 'controlnet-tile',
    requiresModelSwitch: true
  };
}
