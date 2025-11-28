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

// MAX SCALE: 24x (28x/32x/64x removed - require 3-stage processing which is unreliable)
export const IMAGE_TYPES: Record<string, ImageTypeInfo> = {
  'photo': {
    id: 'photo',
    name: 'Photos',
    description: 'Natural photos, portraits, real-world images',
    icon: '📸',
    model: 'photo-real-esrgan',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24],
    exampleImage: '/images/photo-sm.webp'
  },
  'art': {
    id: 'art',
    name: 'Art & Illustrations',
    description: 'Digital art, paintings, illustrations',
    icon: '🎨',
    model: 'art-swinir',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24],
    exampleImage: '/images/art-illustrations_sm.webp'
  },
  'anime': {
    id: 'anime',
    name: 'Anime & Cartoons',
    description: 'Anime, cartoons, animated content',
    icon: '🎌',
    model: 'anime-real-esrgan',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24],
    exampleImage: '/images/anime-sm.webp'
  },
  'text': {
    id: 'text',
    name: 'Text & Documents',
    description: 'Documents, text, screenshots',
    icon: '📄',
    model: 'art-swinir',
    supportedScales: [2, 4, 8, 10, 12, 16, 20, 24],
    exampleImage: '/images/text-sm.webp'
  },
  'extreme': {
    id: 'extreme',
    name: 'Extreme Upscaling',
    description: 'Maximum detail preservation (16x+)',
    icon: '⚡',
    model: 'controlnet-tile',
    supportedScales: [16, 20, 24]
  }
};

// Plan-based scale limits
const PLAN_SCALE_LIMITS: Record<PlanTier, number> = {
  free: 4,        // Free: 2x, 4x only
  starter: 8,     // Starter: up to 8x
  basic: 8,       // Legacy basic = starter
  pro: 16,        // Pro: up to 16x
  power: 24,      // Power: up to 24x (legacy)
  enterprise: 24, // Legacy enterprise
  unlimited: 24,  // Legacy unlimited
  mega: 24,       // Mega: up to 24x (max)
};

// Plans that have access to Anime & Text presets (Pro and above)
const PLANS_WITH_ALL_PRESETS: PlanTier[] = ['pro', 'power', 'enterprise', 'unlimited', 'mega'];

// Check if a plan has access to a specific image type
export function canAccessImageType(imageType: string, plan: PlanTier): boolean {
  // Photo and Art are available to all plans
  if (imageType === 'photo' || imageType === 'art') {
    return true;
  }
  
  // Anime and Text require Pro or higher
  if (imageType === 'anime' || imageType === 'text') {
    return PLANS_WITH_ALL_PRESETS.includes(plan);
  }
  
  // Extreme requires Pro or higher
  if (imageType === 'extreme') {
    return PLANS_WITH_ALL_PRESETS.includes(plan);
  }
  
  return true;
}

// Get available image types for a plan
export function getAvailableImageTypes(plan: PlanTier): ImageTypeInfo[] {
  return Object.values(IMAGE_TYPES).filter(type => canAccessImageType(type.id, plan));
}

export function getAvailableScalesForImageType(imageType: string, plan: PlanTier): number[] {
  const imageTypeInfo = IMAGE_TYPES[imageType];
  // Max scale is 24x for all image types
  if (!imageTypeInfo) return [2, 4, 8, 10, 12, 16, 20, 24];
  
  // Get plan limit
  const planLimit = PLAN_SCALE_LIMITS[plan] || 24;
  
  // Filter scales based on plan limit
  return imageTypeInfo.supportedScales.filter(scale => scale <= planLimit);
}

// Get the max scale for a plan (for UI display)
export function getMaxScaleForPlan(plan: PlanTier): number {
  return PLAN_SCALE_LIMITS[plan] || 24;
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
