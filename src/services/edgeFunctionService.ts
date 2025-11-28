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
  qualityMode?: 'speed' | 'quality'; // NEW: Speed vs Quality mode
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
  jobId?: string;
}

interface JobStatus {
  success: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial_success' | 'tiles_ready' | 'needs_split';
  progress: number;
  currentStage: number;
  totalStages: number;
  currentOutputUrl?: string | null;
  finalOutputUrl?: string | null;
  errorMessage?: string | null;
  estimatedTimeRemaining?: number;
  createdAt?: string;
  completedAt?: string | null;
  stages?: Array<{ stage: number; scale: number; status: string }>;
  predictionId?: string | null;
  tiles_data?: any[];
  tile_grid?: any;
  target_scale?: number;
  template_config?: {
    stages: Array<{
      stageNumber: number;
      scaleMultiplier: number;
      tileCount: number;
      splitFromPrevious: number;
    }>;
  };
  split_info?: {
    completedStage: number;
    nextStage: number;
    splitFactor: number;
    currentTileCount: number;
    expectedTileCount: number;
  };
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
      userId: request.userId,
      qualityMode: request.qualityMode || 'speed', // NEW: Speed vs Quality mode
    };

    console.log('Calling upscale-init edge function...', {
      scale: request.scale,
      quality: request.quality,
      processedSize: `${(preprocessResult.processedFile.size / 1024 / 1024).toFixed(2)}MB`,
      wasResized: preprocessResult.metadata.wasResized,
    });

    // Start async job
    const initResponse = await fetch(`${this.baseUrl}/functions/v1/upscale-init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(payload),
    });

    if (!initResponse.ok) {
      let errorText = '';
      let errorData: any = null;
      
      try {
        const text = await initResponse.text();
        try {
          errorData = JSON.parse(text);
          errorText = errorData.error || errorData.message || JSON.stringify(errorData);
        } catch {
          errorText = text || `HTTP ${initResponse.status} ${initResponse.statusText}`;
        }
      } catch (e) {
        errorText = `HTTP ${initResponse.status} ${initResponse.statusText}`;
      }
      
      console.error('[EdgeFunctionService] Init request failed:', {
        status: initResponse.status,
        statusText: initResponse.statusText,
        error: errorText,
        errorData: errorData,
      });
      
      throw new Error(`Failed to start upscaling job: ${errorText}`);
    }

    const initResult = await initResponse.json();
    if (!initResult.success) {
      const errorMsg = initResult.error || 'Failed to initialize job';
      console.error('[EdgeFunctionService] Job initialization failed:', errorMsg);
      throw new Error(errorMsg);
    }

    const jobId = initResult.jobId;
    console.log('[EdgeFunctionService] Job started:', jobId, {
      estimatedTime: initResult.estimatedTime,
      totalStages: initResult.totalStages,
      originalDimensions: initResult.originalDimensions,
      targetScale: initResult.targetScale,
    });

    // Return immediately with jobId - let caller handle waiting if needed
    // For backward compatibility, we'll wait here but this can be changed
    return await this.waitForJobCompletion(
      jobId, 
      initResult.originalDimensions, 
      initResult.targetScale,
      undefined // No progress callback at service level - handled by context
    );
  }

  public async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const url = `${this.baseUrl}/functions/v1/upscale-status?jobId=${jobId}`;
      console.log(`[EdgeFunctionService] Fetching job status from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EdgeFunctionService] Status request failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to get job status (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        console.error(`[EdgeFunctionService] Status response indicates failure:`, result);
        throw new Error(result.error || 'Failed to get job status');
      }

      return result;
    } catch (error) {
      console.error(`[EdgeFunctionService] Exception in getJobStatus:`, error);
      throw error;
    }
  }

  public async waitForJobCompletion(
    jobId: string,
    originalDimensions?: { width: number; height: number },
    targetScale?: number,
    onProgress?: (progress: number, status: string) => void
  ): Promise<UpscaleResponse> {
    const pollInterval = 2000; // 2 seconds
    const maxWaitTime = 600000; // 10 minutes max
    const WEBHOOK_TIMEOUT = 10000; // 10 seconds before triggering fallback (3x faster!)
    const CHECK_ALL_INTERVAL = 10000; // Call check-all every 10 seconds (3x faster!)
    const startTime = Date.now();
    let pollCount = 0;
    let lastError: Error | null = null;
    const maxConsecutiveErrors = 5;
    let lastProgress = 0;
    let stuckCount = 0;
    let fallbackTriggered = false;
    let lastCheckAllTime = 0; // Track when we last called check-all

    console.log(`[EdgeFunctionService] Starting to wait for job completion: ${jobId}`);

    while (true) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitTime) {
        console.error(`[EdgeFunctionService] Job ${jobId} timed out after ${elapsed}ms`);
        throw new Error(`Job timed out after ${Math.round(maxWaitTime / 1000)} seconds`);
      }

      try {
        pollCount++;
        if (pollCount % 5 === 0) {
          console.log(`[EdgeFunctionService] Polling job ${jobId} (attempt ${pollCount}, elapsed: ${Math.round(elapsed / 1000)}s)`);
        }

        const status = await this.getJobStatus(jobId);
        lastError = null; // Reset error counter on success

        // Check if stuck (progress hasn't changed)
        if (status.progress === lastProgress && status.status === "processing") {
          stuckCount++;
        } else {
          stuckCount = 0;
        }
        lastProgress = status.progress;

        // PERIODIC CHECK-ALL: Call check-all function every 30 seconds for all stuck jobs
        if (elapsed - lastCheckAllTime > CHECK_ALL_INTERVAL) {
          console.log(`[EdgeFunctionService] Calling check-all function (${Math.round(elapsed / 1000)}s elapsed)`);
          lastCheckAllTime = elapsed;
          
          // Trigger check-all function (don't wait for response)
          this.triggerCheckAll().catch(err => {
            console.warn("[EdgeFunctionService] Check-all trigger failed:", err);
          });
        }
        
        // FALLBACK TRIGGER: If stuck at same progress for >30s, check Replicate
        if (
          !fallbackTriggered &&
          stuckCount >= 5 && // 5 polls = 10 seconds stuck
          status.status === "processing" &&
          elapsed > WEBHOOK_TIMEOUT
        ) {
          console.warn(
            `[EdgeFunctionService] ⚠️ Job appears stuck! Triggering fallback polling... (stuck for ${Math.round(elapsed / 1000)}s, progress: ${status.progress}%)`
          );
          
          fallbackTriggered = true;
          
          // Trigger fallback function (don't wait for response)
          this.triggerFallbackPolling(jobId).catch(err => {
            console.error("[EdgeFunctionService] Fallback trigger failed:", err);
          });
        }

        if (onProgress) {
          onProgress(status.progress, status.status);
        }

        console.log(`[EdgeFunctionService] Job ${jobId} status: ${status.status}, progress: ${status.progress}%, stage: ${status.currentStage}/${status.totalStages}`);

        if (status.status === 'needs_split') {
          console.log(`[EdgeFunctionService] Job ${jobId} needs tile splitting before next stage...`);
          
          if (onProgress) {
            onProgress(status.progress, 'Splitting tiles for next stage...');
          }

          // Trigger client-side tile splitting
          await this.splitTilesClientSide(jobId, status.currentStage, (percent, message) => {
            if (onProgress) {
              onProgress(status.progress, message);
            }
          });

          console.log(`[EdgeFunctionService] Client-side split complete, resuming processing...`);
          
          // Continue polling - the split function will update the job and trigger next stage
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        if (status.status === 'tiles_ready') {
          console.log(`[EdgeFunctionService] Job ${jobId} tiles ready! Starting client-side stitching...`);
          
          if (onProgress) {
            onProgress(100, 'Stitching final image...');
          }

          // Trigger client-side stitching
          const stitchResult = await this.stitchTilesClientSide(jobId, (percent, message) => {
            if (onProgress) {
              onProgress(100, message); // Keep at 100% but update message
            }
          });

          console.log(`[EdgeFunctionService] Client-side stitch complete in ${Math.round(elapsed / 1000)}s`);

          return stitchResult;
        }

        if (status.status === 'completed') {
          if (!status.finalOutputUrl) {
            console.error(`[EdgeFunctionService] Job ${jobId} completed but no output URL`);
            throw new Error('Job completed but no output URL available');
          }

          console.log(`[EdgeFunctionService] Job ${jobId} completed successfully in ${Math.round(elapsed / 1000)}s`);

          // Calculate dimensions if not provided
          const upscaledDimensions = originalDimensions && targetScale
            ? {
                width: Math.round(originalDimensions.width * targetScale),
                height: Math.round(originalDimensions.height * targetScale),
              }
            : undefined;

          return {
            success: true,
            jobId: status.jobId,
            outputUrl: status.finalOutputUrl,
            imageUrl: status.finalOutputUrl,
            inputUrl: status.currentOutputUrl || undefined,
            originalDimensions: originalDimensions,
            upscaledDimensions: upscaledDimensions,
            appliedScale: targetScale,
          };
        }

        if (status.status === 'failed') {
          const errorMsg = status.errorMessage || 'Upscaling job failed';
          console.error(`[EdgeFunctionService] Job ${jobId} failed: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (status.status === 'partial_success') {
          console.warn(`[EdgeFunctionService] Job ${jobId} partial success:`, status.errorMessage);
          if (status.finalOutputUrl) {
            return {
              success: true,
              jobId: status.jobId,
              outputUrl: status.finalOutputUrl,
              imageUrl: status.finalOutputUrl,
              inputUrl: status.currentOutputUrl || undefined,
              originalDimensions: originalDimensions,
              appliedScale: targetScale,
            };
          }
          throw new Error(status.errorMessage || 'Partial success but no output URL');
        }

        // Still processing, wait and poll again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[EdgeFunctionService] Error polling job ${jobId} (attempt ${pollCount}):`, errorMessage);
        
        lastError = error instanceof Error ? error : new Error(errorMessage);
        
        // If we get too many consecutive errors, fail the job
        if (pollCount >= maxConsecutiveErrors && lastError) {
          console.error(`[EdgeFunctionService] Too many consecutive errors (${pollCount}), failing job ${jobId}`);
          throw new Error(`Failed to get job status after ${pollCount} attempts: ${errorMessage}`);
        }

        // Wait a bit longer before retrying on error
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
      }
    }
  }

  public async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Stitch tiles client-side in the browser
   */
  private async stitchTilesClientSide(
    jobId: string,
    onProgress?: (percent: number, message: string) => void
  ): Promise<UpscaleResponse> {
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      
      console.log(`[EdgeFunctionService] Fetching job details for client-side stitching: ${jobId}`);
      
      // Get full job details with tiles_data
      const response = await fetch(`${baseUrl}/functions/v1/upscale-status?jobId=${jobId}`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const jobData = await response.json();
      
      if (!jobData.tiles_data || !jobData.tile_grid) {
        throw new Error('Job missing tile data for stitching');
      }

      console.log(`[EdgeFunctionService] Job details fetched. Tiles: ${jobData.tiles_data.length}`);

      // Import and use client stitcher
      const { stitchTilesInBrowser } = await import('../utils/clientStitcher');
      
      const stitchResult = await stitchTilesInBrowser(
        jobData.tiles_data,
        jobData.tile_grid,
        jobData.target_scale,
        onProgress
      );

      console.log(`[EdgeFunctionService] Stitch complete! Dimensions: ${stitchResult.width}×${stitchResult.height}`);

      // Create object URL for the stitched image
      const imageUrl = URL.createObjectURL(stitchResult.blob);

      // Update job status to completed in database (optional, for record keeping)
      await fetch(`${baseUrl}/functions/v1/upscale-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify({
          jobId,
          status: 'completed',
          finalOutputUrl: imageUrl, // This is a local blob URL, not uploaded
        }),
      }).catch(err => {
        console.warn('[EdgeFunctionService] Failed to update job status after stitch:', err);
        // Don't throw - stitch succeeded, DB update is optional
      });

      return {
        success: true,
        jobId,
        outputUrl: imageUrl,
        imageUrl: imageUrl,
        upscaledDimensions: {
          width: stitchResult.width,
          height: stitchResult.height,
        },
        appliedScale: jobData.target_scale,
      };
    } catch (error) {
      console.error(`[EdgeFunctionService] Client-side stitch error:`, error);
      throw new Error(`Failed to stitch tiles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Split tiles client-side in the browser before next stage
   * This is called when tiles are too large for GPU memory
   */
  private async splitTilesClientSide(
    jobId: string,
    completedStage: number,
    onProgress?: (percent: number, message: string) => void
  ): Promise<void> {
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      console.log(`[EdgeFunctionService] Starting client-side tile splitting for job ${jobId}, stage ${completedStage}`);
      
      // Get full job details with tiles_data
      const response = await fetch(`${baseUrl}/functions/v1/upscale-status?jobId=${jobId}`, {
        headers: {
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const jobData = await response.json();
      
      if (!jobData.tiles_data) {
        throw new Error('Job missing tile data for splitting');
      }

      console.log(`[EdgeFunctionService] Job details fetched. Tiles: ${jobData.tiles_data.length}`);
      
      // Get split info from job data (set by webhook)
      const splitInfo = jobData.split_info;
      const templateConfig = jobData.template_config;
      
      console.log(`[EdgeFunctionService] Split info:`, splitInfo);
      console.log(`[EdgeFunctionService] Template config:`, templateConfig);
      
      // Get the next stage config from template
      const nextStageIndex = completedStage; // 0-indexed for next stage
      let nextStageConfig = templateConfig?.stages?.[nextStageIndex];
      
      // FALLBACK: If template config is missing, create stage config from split_info
      if (!nextStageConfig && splitInfo) {
        console.log(`[EdgeFunctionService] ⚠️ Template config missing, using split_info as fallback`);
        const splitFactor = splitInfo.splitFactor || 4;
        const gridSize = Math.sqrt(splitFactor);
        const cols = Math.ceil(gridSize);
        const rows = Math.ceil(gridSize);
        
        nextStageConfig = {
          stageNumber: splitInfo.nextStage,
          scaleMultiplier: 4, // Default assumption
          tileCount: splitInfo.expectedTileCount,
          splitFromPrevious: splitFactor,
          grid: [cols, rows] as [number, number]
        };
        
        console.log(`[EdgeFunctionService] Created fallback stage config:`, nextStageConfig);
      }
      
      if (!nextStageConfig) {
        throw new Error(`Missing template config and split_info for stage ${completedStage + 1}`);
      }

      // Import and use template-based client splitter
      const { splitTilesWithTemplate } = await import('../utils/clientSplitter');
      
      const splitResult = await splitTilesWithTemplate(
        jobData.tiles_data,
        completedStage,
        nextStageConfig,
        jobId,
        baseUrl,
        anonKey,
        onProgress
      );

      console.log(`[EdgeFunctionService] Split complete: ${splitResult.originalTileCount} → ${splitResult.newTileCount} tiles`);

      // Update job with new tiles_data and resume processing
      const nextStage = completedStage + 1;
      
      const updateResponse = await fetch(`${baseUrl}/functions/v1/upscale-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          jobId,
          tilesData: splitResult.tilesData,
          nextStage,
          splitDetails: splitResult.splitDetails,
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to resume job after split: ${updateResponse.status} ${errorText}`);
      }

      const resumeResult = await updateResponse.json();
      console.log(`[EdgeFunctionService] Job resumed:`, resumeResult);
      
    } catch (error) {
      console.error(`[EdgeFunctionService] Client-side split error:`, error);
      throw new Error(`Failed to split tiles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Trigger fallback polling to rescue stuck job
   */
  private async triggerFallbackPolling(jobId: string): Promise<void> {
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      
      console.log(`[EdgeFunctionService] Calling fallback function for job: ${jobId}`);
      
      const response = await fetch(`${baseUrl}/functions/v1/upscale-fallback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fallback failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log(`[EdgeFunctionService] Fallback result:`, result);
      
    } catch (error) {
      console.error(`[EdgeFunctionService] Fallback error:`, error);
      throw error;
    }
  }

  private async triggerCheckAll(): Promise<void> {
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      
      console.log(`[EdgeFunctionService] Calling check-all function for all stuck jobs`);
      
      const response = await fetch(`${baseUrl}/functions/v1/upscale-check-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Check-all failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("[EdgeFunctionService] Check-all result:", result);
      
    } catch (error) {
      console.error("[EdgeFunctionService] Check-all error:", error);
      // Don't throw - this is a background check
    }
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
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif'];
  }

  public getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB limit
  }
}

export const edgeFunctionService = new EdgeFunctionService();
