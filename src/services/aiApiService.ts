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
  scale: number;
  quality: 'photo' | 'art' | 'text' | 'anime';
  outputFormat: string;
}

interface UpscaleResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
  cost?: number;
}

export class AIApiService {
  private providers: AIProvider[] = [
    {
      name: 'Leonardo.ai',
      endpoint: 'https://api.leonardo.ai/v1/upscale',
      apiKey: process.env.LEONARDO_API_KEY || '',
      supported: false, // Will be true when API key is configured
      costPerImage: 3,
    },
    {
      name: 'Replicate',
      endpoint: 'https://api.replicate.com/v1/predictions',
      apiKey: process.env.REPLICATE_API_KEY || '',
      supported: false,
      costPerImage: 2,
    },
    {
      name: 'Stability.ai',
      endpoint: 'https://api.stability.ai/v1/upscale',
      apiKey: process.env.STABILITY_API_KEY || '',
      supported: false,
      costPerImage: 4,
    },
    {
      name: 'OpenAI DALL-E',
      endpoint: 'https://api.openai.com/v1/images/edit',
      apiKey: process.env.OPENAI_API_KEY || '',
      supported: false,
      costPerImage: 5,
    },
  ];

  private async upscaleWithLeonardo(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const formData = new FormData();
      formData.append('image', request.image);
      formData.append('scale_factor', request.scale.toString());
      formData.append('quality_preset', request.quality);
      
      const response = await fetch('https://api.leonardo.ai/v1/upscale', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
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

  private async upscaleWithReplicate(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const imageBase64 = await this.fileToBase64(request.image);
      
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003', // Real-ESRGAN model
          input: {
            image: imageBase64,
            scale: request.scale,
            model_name: this.getReplicateModel(request.quality),
          },
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Poll for completion
        const finalResult = await this.pollReplicateResult(result.urls.get);
        
        return {
          success: true,
          imageUrl: finalResult.output,
          cost: 2,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Replicate API error',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Replicate API error: ${error}`,
      };
    }
  }

  private async upscaleWithStability(request: UpscaleRequest): Promise<UpscaleResponse> {
    try {
      const formData = new FormData();
      formData.append('image', request.image);
      formData.append('width', (1024 * request.scale).toString());
      formData.append('height', (1024 * request.scale).toString());
      
      const response = await fetch('https://api.stability.ai/v1/generation/esrgan-v1-x2plus/image-to-image/upscale', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        },
        body: formData,
      });

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
      // OpenAI doesn't have a direct upscaling endpoint, but we can use image editing
      // This is a conceptual implementation
      const imageBase64 = await this.fileToBase64(request.image);
      
      const response = await fetch('https://api.openai.com/v1/images/edit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
          imageUrl: result.data[0].url,
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

  public async upscaleImage(request: UpscaleRequest): Promise<UpscaleResponse> {
    const availableProviders = this.providers.filter(p => p.supported);
    
    if (availableProviders.length === 0) {
      return {
        success: false,
        error: 'No AI providers configured. Please add API keys for at least one provider.',
      };
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

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async pollReplicateResult(url: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
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
      } catch (error) {
        throw error;
      }
    }

    throw new Error('Processing timed out');
  }

  private getReplicateModel(quality: string): string {
    switch (quality) {
      case 'photo':
        return 'RealESRGAN_x4plus';
      case 'art':
        return 'RealESRNet_x4plus';
      case 'anime':
        return 'RealESRGAN_x4plus_anime_6B';
      default:
        return 'RealESRGAN_x4plus';
    }
  }

  private getOpenAISize(scale: number): string {
    if (scale >= 4) return '1024x1024';
    if (scale >= 2) return '512x512';
    return '256x256';
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
}

export const aiApiService = new AIApiService();