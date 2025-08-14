// Image Processing Utilities and Queue Management

interface ProcessingJob {
  id: string;
  file: File;
  settings: any;
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export class ImageProcessor {
  private queue: ProcessingJob[] = [];
  private processing = false;
  private maxConcurrent = 2; // Process up to 2 images simultaneously
  private currentProcessing = 0;

  public addToQueue(job: ProcessingJob): void {
    this.queue.push(job);
    this.processNext();
  }

  public removeFromQueue(id: string): void {
    this.queue = this.queue.filter(job => job.id !== id);
  }

  public getQueue(): ProcessingJob[] {
    return [...this.queue];
  }

  public getQueueStatus(): {
    pending: number;
    processing: number;
    total: number;
  } {
    const pending = this.queue.filter(job => job.status === 'pending').length;
    const processing = this.queue.filter(job => job.status === 'processing').length;
    
    return {
      pending,
      processing,
      total: this.queue.length,
    };
  }

  private async processNext(): Promise<void> {
    if (this.currentProcessing >= this.maxConcurrent) {
      return; // Already processing maximum concurrent jobs
    }

    const nextJob = this.queue.find(job => job.status === 'pending');
    if (!nextJob) {
      return; // No pending jobs
    }

    this.currentProcessing++;
    nextJob.status = 'processing';
    nextJob.startTime = Date.now();

    try {
      const result = await this.processImage(nextJob);
      nextJob.status = 'completed';
      nextJob.result = result;
      nextJob.endTime = Date.now();
    } catch (error) {
      nextJob.status = 'error';
      nextJob.error = error instanceof Error ? error.message : 'Unknown error';
      nextJob.endTime = Date.now();
    } finally {
      this.currentProcessing--;
      // Try to process the next job
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async processImage(job: ProcessingJob): Promise<any> {
    // Image preprocessing
    const preprocessedImage = await this.preprocessImage(job.file, job.settings);
    
    // Send to AI service for upscaling
    const upscaledResult = await this.upscaleWithAI(preprocessedImage, job.settings);
    
    // Post-processing
    const finalResult = await this.postprocessImage(upscaledResult, job.settings);
    
    return finalResult;
  }

  private async preprocessImage(file: File, settings: any): Promise<{
    processedFile: File;
    metadata: any;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          // Get original dimensions
          const originalWidth = img.width;
          const originalHeight = img.height;
          const originalPixelCount = originalWidth * originalHeight;
          
          // GPU memory limit from the error: 2096704 pixels
          const MAX_PIXELS = 2096704;
          
          let targetWidth = originalWidth;
          let targetHeight = originalHeight;
          
          // Check if image exceeds GPU memory limit
          if (originalPixelCount > MAX_PIXELS) {
            console.log(`Image too large for GPU: ${originalPixelCount} pixels > ${MAX_PIXELS} pixels. Resizing...`);
            
            // Calculate scale factor to fit within pixel limit
            const scaleFactor = Math.sqrt(MAX_PIXELS / originalPixelCount);
            targetWidth = Math.floor(originalWidth * scaleFactor);
            targetHeight = Math.floor(originalHeight * scaleFactor);
            
            console.log(`Resizing from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight}`);
          }
          
          // Apply preprocessing based on quality preset
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          if (!ctx) throw new Error('Could not get canvas context');
          
          // Draw image at target size (this handles resizing if needed)
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Apply filters based on quality preset
          if (settings.quality === 'photo') {
            this.applyPhotoEnhancement(ctx, targetWidth, targetHeight);
          } else if (settings.quality === 'art') {
            this.applyArtEnhancement(ctx, targetWidth, targetHeight);
          }
          
          // Convert back to file
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to process image'));
              return;
            }
            
            const processedFile = new File([blob], file.name, {
              type: blob.type,
              lastModified: Date.now(),
            });
            
            resolve({
              processedFile,
              metadata: {
                originalWidth,
                originalHeight,
                targetWidth,
                targetHeight,
                wasResized: originalPixelCount > MAX_PIXELS,
                originalPixelCount,
                targetPixelCount: targetWidth * targetHeight,
                fileSize: blob.size,
              },
            });
          }, file.type, 0.95);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private applyPhotoEnhancement(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Apply subtle sharpening and contrast enhancement for photos
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Simple contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      // Enhance contrast slightly
      data[i] = Math.min(255, data[i] * 1.1);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * 1.1); // Green
      data[i + 2] = Math.min(255, data[i + 2] * 1.1); // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private applyArtEnhancement(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Apply edge preservation for art/illustrations
    const imageData = ctx.getImageData(0, 0, width, height);
    // Implementation would include edge-preserving filters
    ctx.putImageData(imageData, 0, 0);
  }

  private async upscaleWithAI(preprocessedResult: any, settings: any): Promise<any> {
    // This would call the AI API service
    const { aiApiService } = await import('./aiApiService');
    
    return await aiApiService.upscaleImage({
      image: preprocessedResult.processedFile,
      scale: settings.scale,
      quality: settings.quality,
      outputFormat: settings.outputFormat,
    });
  }

  private async postprocessImage(upscaledResult: any, settings: any): Promise<any> {
    if (!upscaledResult.success) {
      throw new Error(upscaledResult.error || 'Upscaling failed');
    }

    // Apply post-processing based on settings
    if (settings.outputFormat !== 'original') {
      return this.convertImageFormat(upscaledResult.imageUrl, settings.outputFormat);
    }
    
    return upscaledResult;
  }

  private async convertImageFormat(imageUrl: string, targetFormat: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        const mimeType = this.getMimeType(targetFormat);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image format'));
            return;
          }
          
          const convertedUrl = URL.createObjectURL(blob);
          resolve({
            success: true,
            imageUrl: convertedUrl,
          });
        }, mimeType, 0.95);
      };

      img.onerror = () => reject(new Error('Failed to load upscaled image'));
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
    });
  }

  private getMimeType(format: string): string {
    switch (format.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  public clearCompleted(): void {
    this.queue = this.queue.filter(job => 
      job.status !== 'completed' && job.status !== 'error'
    );
  }

  public pauseProcessing(): void {
    this.processing = false;
  }

  public resumeProcessing(): void {
    this.processing = true;
    this.processNext();
  }

  public getProcessingStats(): {
    averageProcessingTime: number;
    successRate: number;
    totalProcessed: number;
  } {
    const completedJobs = this.queue.filter(job => 
      job.status === 'completed' || job.status === 'error'
    );
    
    const successfulJobs = completedJobs.filter(job => job.status === 'completed');
    
    const totalTime = completedJobs.reduce((sum, job) => {
      if (job.startTime && job.endTime) {
        return sum + (job.endTime - job.startTime);
      }
      return sum;
    }, 0);
    
    const averageProcessingTime = completedJobs.length > 0 
      ? totalTime / completedJobs.length 
      : 0;
    
    const successRate = completedJobs.length > 0 
      ? (successfulJobs.length / completedJobs.length) * 100 
      : 0;

    return {
      averageProcessingTime: Math.round(averageProcessingTime / 1000), // Convert to seconds
      successRate: Math.round(successRate),
      totalProcessed: completedJobs.length,
    };
  }
}

export const imageProcessor = new ImageProcessor();