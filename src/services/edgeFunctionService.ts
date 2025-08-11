// Edge Function Service for AI Image Upscaling
// This service calls our Supabase Edge Function for serverless AI processing

interface UpscaleRequest {
  image: File;
  scale: number;
  quality: 'photo' | 'art' | 'anime' | 'text';
  outputFormat?: string;
}

interface UpscaleResponse {
  success: boolean;
  inputUrl?: string;
  outputUrl?: string;
  error?: string;
  processingTime?: number;
}

export class EdgeFunctionService {
  private baseUrl: string;

  constructor() {
    // Use environment variable for backend URL, fallback to localhost for development
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace('/functions/v1/upscaler', '') || 'http://localhost:54321';
  }

  public async upscaleImage(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      // Convert file to base64
      const base64Image = await this.fileToBase64(request.image);
      
      // Get original image dimensions
      const originalDimensions = await this.getImageDimensions(request.image);
      
      // Prepare request payload
      const payload = {
        imageBase64: base64Image,
        scale: request.scale,
        quality: request.quality
      };

      console.log('Calling upscaler edge function...', {
        scale: request.scale,
        quality: request.quality,
        originalSize: originalDimensions,
        fileSize: `${(request.image.size / 1024 / 1024).toFixed(2)}MB`
      });

      // Call the serverless function
      const response = await fetch(`${this.baseUrl}/functions/v1/upscaler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Processing error: ${response.status} ${errorText}`);
      }

      const result: UpscaleResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      // Return the output URL as the main image URL for compatibility
      const compatibleResult = {
        ...result,
        imageUrl: result.outputUrl,
        originalDimensions: originalDimensions,
        upscaledDimensions: {
          width: originalDimensions.width * request.scale,
          height: originalDimensions.height * request.scale
        }
      };

      console.log('AI upscaling completed successfully', {
        processingTime: result.processingTime,
        inputUrl: result.inputUrl,
        outputUrl: result.outputUrl
      });

      return compatibleResult;

    } catch (error) {
      console.error('AI processing service error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  private async fileToBase64(file: File): Promise<string> {
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

  public isConfigured(): boolean {
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  public getEstimatedProcessingTime(fileSize: number, scale: number): number {
    // Rough estimation based on file size and scale factor
    const baseTime = 20; // Base processing time in seconds for edge functions
    const sizeMultiplier = Math.max(1, fileSize / (1024 * 1024)); // MB
    const scaleMultiplier = scale / 2; // Scale factor impact
    
    return Math.round(baseTime * sizeMultiplier * scaleMultiplier);
  }

  public getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB limit
  }

  public getSupportedFormats(): string[] {
    return ['image/jpeg', 'image/png', 'image/webp'];
  }
}

export const edgeFunctionService = new EdgeFunctionService();