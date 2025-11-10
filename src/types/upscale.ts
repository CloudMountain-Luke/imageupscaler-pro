// src/types/upscale.ts
export type Scale = 2 | 4 | 8 | 10 | 12 | 16 | 32;
export type Quality = 'photo' | 'art' | 'text' | 'anime';
export type PlanTier = 'basic' | 'pro' | 'enterprise' | 'mega';

export interface UpscaleSettings {
  scale: Scale;
  quality: Quality;
  outputFormat: string;
  maxDetail?: boolean;
  plan?: PlanTier;
  selectedModel?: string;
}
