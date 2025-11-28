import { createOrchestrationSteps } from '../../shared/replicateOrchestrator';
import type { Scale, Quality, PlanTier } from '../types/upscale';
import { edgeFunctionService } from './edgeFunctionService';
import { isSupabaseConfigured } from '../lib/supabaseClient';

// AI API Service Layer for Multiple Providers
// This service handles integration with various AI upscaling APIs

interface AIProvider {
  name: string;
  endpoint: string;
  apiKey: string;
  supported: boolean;
  costPerImage: number;
}

interface UpscaleRequest {
  image: File;
  scale: Scale;                 // was 2|4|8
  quality: Quality;             // was inline union
  outputFormat: string;         // 'png' | 'jpg' | 'webp'
  maxDetail?: boolean;
  plan?: PlanTier;
}

interface UpscaleResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
  warning?: string; // added to surface non-fatal mismatches
  cost?: number;
}

export class AIApiService {
  private providers: AIProvider[] = [
    {
      name: 'Leonardo.ai',
      endpoint: 'https://api.leonardo.ai/v1/upscale',
      apiKey: import.meta.env.VITE_LEONARDO_API_KEY || '',
      supported: !!import.meta.env.VITE_LEONARDO_API_KEY,
      costPerImage: 3,
    },
    {
      name: 'Replicate',
      endpoint: 'https://api.replicate.com/v1/predictions',
      apiKey: import.meta.env.VITE_REPLICATE_API_TOKEN || '',
      supported: !!import.meta.env.VITE_REPLICATE_API_TOKEN,
      costPerImage: 2,
    },
    {
      name: 'Stability.ai',
      endpoint: 'https://api.stability.ai/v1/upscale',
      apiKey: import.meta.env.VITE_STABILITY_API_KEY || '',
      supported: !!import.meta.env.VITE_STABILITY_API_KEY,
      costPerImage: 4,
    },
    {
      name: 'OpenAI DALL-E',
      endpoint: 'https://api.openai.com/v1/images/edit',
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      supported: !!import.meta.env.VITE_OPENAI_API_KEY,
      costPerImage: 5,
    },
  ];

  // ---------- PUBLIC ENTRY POINT ----------

  public async upscaleImage(request: UpscaleRequest): Promise<UpscaleResponse> {
    const availableProviders = this.providers.filter(p => p.supported);

    if (availableProviders.length === 0 && !isSupabaseConfigured) {
      console.error('[AIApiService] Neither Supabase nor direct API providers are configured.');
      return {
        success: false,
        error: 'Upscaling services not configured. Please add API keys or Supabase credentials.',
      };
    }

    if (availableProviders.length === 0) {
      console.warn('[AIApiService] No direct providers configured; falling back to edge function if available.');
      return edgeFunctionService.upscaleImage(request);
    }

    // Try providers in order of preference (lowest cost first)
    availableProviders.sort((a, b) => a.costPerImage - b.costPerImage);

    for (const provider of availableProviders) {
      try {
        let result: UpscaleResponse;

        switch (provider.name) {
          case 'Leonardo.ai':
            result = await this.upscaleWithLeonardo(request);
            break;
          case 'Replicate':
            result = await this.upscaleWithReplicate(request);
            break;
          case 'Stability.ai':
            result = await this.upscaleWithStability(request);
            break;
          case 'OpenAI DALL-E':
            result = await this.upscaleWithOpenAI(request);
            break;
          default:
            continue;
        }

        if (result.success) {
          return result;
        }

        console.warn(`Provider ${provider.name} failed: ${result.error}`);
      } catch (error) {
        console.warn(`Provider ${provider.name} threw error:`, error);
      }
    }

    return {
      success: false,
      error: 'All AI providers failed. Please try again later.',
    };
  }

  public getProviderStatus(): AIProvider[] {
    return this.providers;
  }

  public updateApiKey(providerName: string, apiKey: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.apiKey = apiKey;
      provider.supported = !!apiKey;
    }
  }

  // ---------- REPLICATE IMPLEMENTATION ----------

  // NOTE: The old private selectModelForScale(...) has been removed.
  // We now route EVERYTHING through the orchestrator, which uses selectModelFor(...) from ../lib/replicateModelMap.ts

  private async upscaleWithReplicate(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const outputUrl = await this.orchestrateUpscale(
        request.image,
        request.scale,
        request.quality,
        request.maxDetail,
        request.plan
      );
      return { success: true, imageUrl: outputUrl, cost: 2 };
    } catch (error) {
      return {
        success: false,
        error: `Replicate API error: ${error}`,
      };
    }
  }

  private async pollReplicateResult(url: string): Promise<{ output: string }> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (attempts < maxAttempts) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${import.meta.env.VITE_REPLICATE_API_TOKEN}`,
        },
      });

      const result = await response.json();

      if (result.status === 'succeeded') {
        return result;
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Processing failed');
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Processing timed out');
  }

  // ---------- OTHER PROVIDERS (UNCHANGED STUBS) ----------

  private async upscaleWithLeonardo(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const formData = new FormData();
      formData.append('image', request.image);
      formData.append('scale_factor', String(request.scale));
      formData.append('quality_preset', request.quality);

      const response = await fetch('https://api.leonardo.ai/v1/upscale', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_LEONARDO_API_KEY}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          imageUrl: result.output_image_url,
          processingTime: result.processing_time,
          cost: 3,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Leonardo API error',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Leonardo API error: ${error}`,
      };
    }
  }

  private async upscaleWithStability(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const formData = new FormData();
      formData.append('image', request.image);
      formData.append('width', String(1024 * request.scale));
      formData.append('height', String(1024 * request.scale));

      const response = await fetch(
        'https://api.stability.ai/v1/generation/esrgan-v1-x2plus/image-to-image/upscale',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_STABILITY_API_KEY}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);

        return {
          success: true,
          imageUrl,
          cost: 4,
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Stability API error',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Stability API error: ${error}`,
      };
    }
  }

  private async upscaleWithOpenAI(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      // Conceptual placeholder — OpenAI isn’t a true upscaler endpoint
      const imageBase64 = await this.fileToBase64(request.image);

      const response = await fetch('https://api.openai.com/v1/images/edit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt: `Upscale this ${request.quality} image to ${request.scale}x resolution with enhanced details`,
          n: 1,
          size: this.getOpenAISize(request.scale),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          imageUrl: result.data?.[0]?.url,
          cost: 5,
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'OpenAI API error',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `OpenAI API error: ${error}`,
      };
    }
  }

  // ---------- HELPERS ----------

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  private async getImageDimensionsFromUrl(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  }

  private getOpenAISize(scale: number): string {
    if (scale >= 4) return '1024x1024';
    if (scale >= 2) return '512x512';
    return '256x256';
  }

  // ---------- ORCHESTRATOR & REPLICATE HELPERS ----------

  /**
   * Orchestrates multi-pass upscaling using the model selected by selectModelFor(...).
   * Supports chaining 2x/4x steps and optional outscale (if your model supports it).
   * Includes dimension guards and a retry-once path on mismatch.
   */
  private async orchestrateUpscale(
    image: File,
    targetScale: Scale,
    category: Quality,
    maxDetail: boolean = false,
    plan: PlanTier = 'basic'
  ): Promise<string> {
    // Enforce plan-based limits (server-side gate)
    // Limits match homepage pricing tiers:
    // Basic: up to 8x, Pro: up to 10x, Enterprise: up to 16x, Mega: up to 32x
    const maxScaleByPlan: Record<PlanTier, Scale> = {
      basic: 8,
      pro: 10,
      enterprise: 16,
      mega: 32,
    };
    const normalizedPlan = (plan || 'basic').toLowerCase() as PlanTier;
    const maxAllowed = maxScaleByPlan[normalizedPlan] ?? 8;
    // Anime is capped at 8x regardless of plan
    const effectiveMax = category === 'anime' ? Math.min(8, maxAllowed) : maxAllowed;
    
    console.log('[AIApiService] Plan check:', {
      receivedPlan: plan,
      normalizedPlan,
      maxAllowed,
      effectiveMax,
      targetScale,
      category,
      willUseControlNet: targetScale > 8
    });
    
    if (targetScale > effectiveMax) {
      throw new Error(`Your current plan (${normalizedPlan}) does not support this upscale factor. Maximum allowed: ${effectiveMax}x`);
    }
    const originalDimensions = await this.getImageDimensions(image);
    const rawExpectedWidth = Math.round(originalDimensions.width * targetScale);
    const rawExpectedHeight = Math.round(originalDimensions.height * targetScale);
    
    // Check if we need to auto-trim the final output
    const dimensionLimit = 12000;
    const needsAutoTrim = rawExpectedWidth > dimensionLimit || rawExpectedHeight > dimensionLimit;
    
    console.log(`Original: ${originalDimensions.width}x${originalDimensions.height}`);
    console.log(`Target scale: ${targetScale}x`);
    console.log(`Raw expected: ${rawExpectedWidth}x${rawExpectedHeight}`);
    console.log(`Needs auto-trim: ${needsAutoTrim}`);
    
    // Calculate the effective scale that would fit within limits
    const maxOriginalEdge = Math.max(originalDimensions.width, originalDimensions.height);
    const guardScale = dimensionLimit / maxOriginalEdge;
    const cappedScale = Math.min(targetScale, guardScale);
    const cappedExpectedWidth = Math.round(originalDimensions.width * cappedScale);
    const cappedExpectedHeight = Math.round(originalDimensions.height * cappedScale);
    
    if (needsAutoTrim) {
      console.log(`Guard scale: ${guardScale}, capped scale: ${cappedScale}`);
      console.log(`Capped expected: ${cappedExpectedWidth}x${cappedExpectedHeight}`);
    }

    const orchestrationPlan = createOrchestrationSteps(category, targetScale, { maxDetail });
    let currentImage = await this.fileToBase64(image);

    for (const step of orchestrationPlan) {
      const input: Record<string, unknown> = {
        ...step.input,
        image: currentImage,
        scale: step.scale,
      };
      if (step.outscale) {
        input.outscale = step.outscale;
      }
      const result = await this.runReplicate(step.slug, input);
      currentImage = await this.ensureFormat(result.output, 'png');
    }

    // Auto-trim if the result exceeds the dimension limit
    if (needsAutoTrim) {
      console.log('Starting auto-trim process...');
      currentImage = await this.resizeToMaxDimension(currentImage, dimensionLimit);
      console.log('Auto-trim completed');
    }

    // Final verification
    const finalDims = await this.getImageDimensionsFromUrl(currentImage);
    const targetWidth = needsAutoTrim ? cappedExpectedWidth : rawExpectedWidth;
    const targetHeight = needsAutoTrim ? cappedExpectedHeight : rawExpectedHeight;
    const widthDiff = Math.abs(finalDims.width - targetWidth) / targetWidth;
    const heightDiff = Math.abs(finalDims.height - targetHeight) / targetHeight;

    if (widthDiff > 0.02 || heightDiff > 0.02) {
      // Retry entire process once
      return this.orchestrateUpscale(image, targetScale, category, maxDetail, plan);
    }

    return currentImage;
  }

  private async runReplicate(slug: string, input: Record<string, unknown>): Promise<{ output: string }> {
    // slug is expected as "owner/model:versionHash"
    const [, version] = slug.split(':');
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${import.meta.env.VITE_REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version, input }),
    });
    const prediction = await response.json();
    if (!response.ok) {
      throw new Error(prediction?.error || 'Replicate API error');
    }
    return this.pollReplicateResult(prediction.urls.get);
  }

  private async convertToFormat(imageUrl: string, format: 'png' | 'webp'): Promise<string> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await createImageBitmap(blob);
    canvas.width = img.width;
    canvas.height = img.height;
    ctx?.drawImage(img, 0, 0);
    const newBlob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, `image/${format}`, 0.95)
    );
    if (!newBlob) throw new Error('Failed to transcode image');
    return URL.createObjectURL(newBlob);
  }

  private async resizeToMaxDimension(dataUrl: string, maxDimension: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const longestEdge = Math.max(img.width, img.height);
        console.log(`Original dimensions: ${img.width}x${img.height}, longest edge: ${longestEdge}, max allowed: ${maxDimension}`);
        
        if (longestEdge <= maxDimension) {
          console.log('No resize needed');
          resolve(dataUrl);
          return;
        }
        
        const scale = maxDimension / longestEdge;
        const newWidth = Math.round(img.width * scale);
        const newHeight = Math.round(img.height * scale);
        console.log(`Resizing to: ${newWidth}x${newHeight} (scale: ${scale})`);
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        
        // Set high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        const resizedDataUrl = canvas.toDataURL('image/png');
        console.log('Resize completed successfully');
        resolve(resizedDataUrl);
      };
      img.onerror = (error) => {
        console.error('Error loading image for resize:', error);
        reject(new Error('Failed to load image for resizing'));
      };
      img.src = dataUrl;
    });
  }

  private async ensureFormat(imageUrl: string, format: 'png' | 'webp'): Promise<string> {
    try {
      const url = new URL(imageUrl);
      if (url.pathname.endsWith(`.${format}`)) return imageUrl;
    } catch {
      if (imageUrl.endsWith(`.${format}`)) return imageUrl;
    }
    return this.convertToFormat(imageUrl, format);
  }
}

export const aiApiService = new AIApiService();
