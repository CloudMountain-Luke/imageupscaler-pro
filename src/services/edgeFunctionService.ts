// Edge Function Service for AI Image Upscaling
// This service calls our Supabase Edge Function for serverless AI processing

import type { Scale, Quality, PlanTier } from '../../shared/types';
import { isSupabaseConfigured } from '../lib/supabaseClient';

interface UpscaleRequest {
  userId: string;
  image: File;
  scale: Scale;
  quality: Quality;
  outputFormat?: string;
  maxDetail?: boolean;
  plan?: PlanTier;
  selectedModel?: string;
}

interface UpscaleResponse {
  success: boolean;
  inputUrl?: string;
  outputUrl?: string;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
  originalDimensions?: { width: number; height: number };
  upscaledDimensions?: { width: number; height: number };
  appliedScale?: number;
}

export class EdgeFunctionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  }

  public async upscaleImage(request: UpscaleRequest): Promise<UpscaleResponse> {
    if (!isSupabaseConfigured) {
      console.error('[EdgeFunctionService] Supabase is not configured; cannot call edge function.');
      return {
        success: false,
        error: 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    const { imageProcessor } = await import('./imageProcessor');
    const preprocessResult = await imageProcessor['preprocessImage'](request.image, {
      quality: request.quality,
      scale: request.scale,
    });

    if (preprocessResult.metadata.wasResized) {
      console.log(
        `Image was resized from ${preprocessResult.metadata.originalPixelCount} to ${preprocessResult.metadata.targetPixelCount} pixels to fit GPU memory`
      );
    }

    const base64Image = await this.fileToBase64(preprocessResult.processedFile);

    const payload = {
      imageBase64: base64Image,
      scale: request.scale,
      quality: request.quality,
      maxDetail: request.maxDetail ?? false,
      plan: request.plan ?? 'basic',
      selectedModel: request.selectedModel,
    };

    console.log('Calling upscaler edge function...', {
      scale: request.scale,
      quality: request.quality,
      processedSize: `${(preprocessResult.processedFile.size / 1024 / 1024).toFixed(2)}MB`,
      wasResized: preprocessResult.metadata.wasResized,
    });

    const response = await fetch(`${this.baseUrl}/functions/v1/upscaler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Processing error: ${response.status} ${errorText}`);
    }

    const result: UpscaleResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }

    const compatibleResult: UpscaleResponse = {
      ...result,
      imageUrl: result.outputUrl,
      originalDimensions: result.originalDimensions,
      upscaledDimensions: result.upscaledDimensions,
    };

    console.log('AI upscaling completed successfully', {
      appliedScale: result.appliedScale,
      inputUrl: result.inputUrl,
      outputUrl: result.outputUrl,
    });

    return compatibleResult;
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  public isConfigured(): boolean {
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  public getEstimatedProcessingTime(fileSize: number, scale: number): number {
    const baseTime = Math.min(60, Math.max(10, fileSize / (1024 * 1024)) * 8);
    const scaleMultiplier = Math.log2(scale);
    return Math.round(baseTime * scaleMultiplier);
  }

  public getSupportedFormats(): string[] {
    return ['image/jpeg', 'image/png', 'image/webp'];
  }

  public getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB limit
  }
}

export const edgeFunctionService = new EdgeFunctionService();
