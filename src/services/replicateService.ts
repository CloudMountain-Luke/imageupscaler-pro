import Replicate from 'replicate';

// Real-ESRGAN model versions for different use cases
const MODELS = {
  photo: 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b', // Real-ESRGAN x4 for photos
  art: 'jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a', // SwinIR for art/illustrations
  anime: 'cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4', // Real-ESRGAN anime model
  general: 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b'
};

interface UpscaleOptions {
  image: File;
  scale: number;
  quality: 'photo' | 'art' | 'anime' | 'text';
  outputFormat?: string;
}

interface UpscaleResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
  originalDimensions?: { width: number; height: number };
  upscaledDimensions?: { width: number; height: number };
}

export class ReplicateService {
  private replicate: Replicate;
  private apiToken: string;

  constructor() {
    this.apiToken = import.meta.env.VITE_REPLICATE_API_TOKEN;
    
    if (!this.apiToken) {
      console.warn('Replicate API token not found. AI upscaling will not work.');
      return;
    }

    this.replicate = new Replicate({
      auth: this.apiToken,
    });
  }

  public isConfigured(): boolean {
    return !!this.apiToken;
  }

  public async upscaleImage(options: UpscaleOptions): Promise<UpscaleResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Replicate API not configured. Please add VITE_REPLICATE_API_TOKEN to your environment variables.'
      };
    }

    const startTime = Date.now();

    try {
      // Get original image dimensions
      const originalDimensions = await this.getImageDimensions(options.image);
      
      // Convert file to base64 data URL
      const imageDataUrl = await this.fileToDataUrl(options.image);
      
      // Select appropriate model based on quality preset
      const modelVersion = this.getModelForQuality(options.quality);
      
      // Prepare input parameters
      const input = this.prepareInput(imageDataUrl, options, originalDimensions);
      
      console.log('Starting AI upscaling with Replicate...', {
        model: modelVersion,
        scale: options.scale,
        quality: options.quality,
        originalSize: originalDimensions
      });

      // Run the AI model
      const output = await this.replicate.run(modelVersion, { input }) as string;
      
      const processingTime = Date.now() - startTime;
      
      // Calculate upscaled dimensions
      const upscaledDimensions = {
        width: originalDimensions.width * options.scale,
        height: originalDimensions.height * options.scale
      };

      console.log('AI upscaling completed successfully', {
        processingTime: `${processingTime}ms`,
        outputUrl: output,
        upscaledSize: upscaledDimensions
      });

      return {
        success: true,
        imageUrl: output,
        processingTime,
        originalDimensions,
        upscaledDimensions
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error('AI upscaling failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during AI upscaling',
        processingTime
      };
    }
  }

  private getModelForQuality(quality: string): string {
    switch (quality) {
      case 'photo':
        return MODELS.photo;
      case 'art':
        return MODELS.art;
      case 'anime':
        return MODELS.anime;
      case 'text':
        return MODELS.general; // Use general model for text
      default:
        return MODELS.general;
    }
  }

  private prepareInput(imageDataUrl: string, options: UpscaleOptions, dimensions: { width: number; height: number }) {
    const baseInput: any = {
      image: imageDataUrl,
      scale: options.scale
    };

    // Add model-specific parameters
    if (options.quality === 'photo') {
      baseInput.face_enhance = dimensions.width * dimensions.height < 1000000; // Enable face enhancement for smaller images
    }

    return baseInput;
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for dimension calculation'));
      img.src = URL.createObjectURL(file);
    });
  }

  public async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Test with a simple API call
      await this.replicate.models.list();
      return true;
    } catch (error) {
      console.error('Replicate connection test failed:', error);
      return false;
    }
  }

  public getEstimatedProcessingTime(fileSize: number, scale: number): number {
    // Rough estimation based on file size and scale factor
    const baseTime = 15; // Base processing time in seconds
    const sizeMultiplier = Math.max(1, fileSize / (1024 * 1024)); // MB
    const scaleMultiplier = scale / 2; // Scale factor impact
    
    return Math.round(baseTime * sizeMultiplier * scaleMultiplier);
  }

  public getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB limit for Replicate
  }

  public getSupportedFormats(): string[] {
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif'];
  }
}

export const replicateService = new ReplicateService();