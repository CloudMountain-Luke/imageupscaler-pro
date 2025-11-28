// src/types/upscale.ts
// Max scale: 24x (28x/32x/64x removed for reliability)
export type Scale = 2 | 4 | 8 | 10 | 12 | 16 | 20 | 24;
export type Quality = 'photo' | 'art' | 'text' | 'anime';
// New tier structure: free, starter, pro, power, unlimited
// Legacy tiers (basic, enterprise, mega) still supported for backwards compatibility
export type PlanTier = 'free' | 'starter' | 'basic' | 'pro' | 'power' | 'enterprise' | 'unlimited' | 'mega';

export interface UpscaleSettings {
  scale: Scale;
  quality: Quality;
  outputFormat: string;
  maxDetail?: boolean;
  plan?: PlanTier;
  selectedModel?: string;
}
