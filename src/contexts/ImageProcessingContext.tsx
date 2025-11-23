import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { edgeFunctionService } from '../services/edgeFunctionService';
import { UpscaleTrackingService } from '../services/upscaleTrackingService'; // Corrected import to use the class
import { useAuth } from './AuthContext';
import type { PlanTier, Quality, Scale, UpscaleSettings } from '../../shared/types';

interface UploadedFile {
  id: string;
  file: File;
  imageUrl: string;
}

interface ProcessingItem {
  id: number;
  file: File;
  settings: UpscaleSettings & {
    outputSize: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep?: string;
  estimatedTime?: number;
  timeRemaining?: number;
  originalImage: string;
  upscaledImage?: string;
  originalWidth?: number;
  originalHeight?: number;
  upscaledWidth?: number;
  upscaledHeight?: number;
  processedAt?: number;
}

interface ImageProcessingContextType {
  processQueue: ProcessingItem[];
  processedImages: ProcessingItem[];
  uploadedFiles: UploadedFile[];
  processing: boolean;
  userStats: any;
  userProfile: any;
  realUserProfile: any;
  isApiConfigured: boolean;
  addToQueue: (item: ProcessingItem) => void;
  removeFromQueue: (id: number) => void;
  addUploadedFile: (file: File, imageUrl: string) => void;
  clearUploadedFiles: () => void;
  clearProcessedImages: () => void;
  clearProcessQueue: () => void;
}

const ImageProcessingContext = createContext<ImageProcessingContextType | undefined>(undefined);

export function ImageProcessingProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const [processQueue, setProcessQueue] = useState<ProcessingItem[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessingItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [realUserProfile, setRealUserProfile] = useState<any>(null);

  const isApiConfigured = edgeFunctionService.isConfigured();
  console.log('ImageProcessingContext - isApiConfigured:', isApiConfigured);

  const simulateProcessing = useCallback(async (item: ProcessingItem) => {
    if (!user) {
      console.error('No user found for processing');
      return;
    }

    // Calculate estimated processing time based on file size and scale
    const estimatedTime = edgeFunctionService.getEstimatedProcessingTime(item.file.size, item.settings.scale);

    setProcessQueue(prev => 
      prev.map(p => p.id === item.id ? { 
        ...p, 
        status: 'processing' as const,
        currentStep: 'Preparing image for AI processing...',
        estimatedTime,
        timeRemaining: estimatedTime
      } : p)
    );

    try {

      console.log('Using edge function for AI upscaling...');
      
      setProcessQueue(prev => 
        prev.map(p => p.id === item.id ? { 
          ...p, 
          progress: 10,
          currentStep: 'Initializing upscaling job...'
        } : p)
      );

      // Preprocess image first
      const { imageProcessor } = await import('../services/imageProcessor');
      const preprocessResult = await imageProcessor['preprocessImage'](item.file, {
        quality: item.settings.quality,
        scale: item.settings.scale,
      });

      // Convert to base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(preprocessResult.processedFile);
      });

      // Start job and get jobId
      const initPayload = {
        imageBase64: base64Image,
        scale: item.settings.scale,
        quality: item.settings.quality,
        maxDetail: item.settings.maxDetail ?? false,
        plan: item.settings.plan ?? 'basic',
        selectedModel: item.settings.selectedModel,
        userId: user.id,
        qualityMode: item.settings.qualityMode || 'speed', // NEW: Speed vs Quality mode
      };

      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      const initResponse = await fetch(`${baseUrl}/functions/v1/upscale-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify(initPayload),
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(`Failed to start job: ${errorText}`);
      }

      const initResult = await initResponse.json();
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize job');
      }

      const jobId = initResult.jobId;
      console.log('[ImageProcessingContext] Job started:', jobId);

      // Wait for completion with progress updates
      const result = await edgeFunctionService.waitForJobCompletion(
        jobId,
        initResult.originalDimensions,
        initResult.targetScale,
        (progress) => {
          setProcessQueue(prev => 
            prev.map(p => {
              if (p.id === item.id) {
                let currentStep = 'Processing...';
                if (progress < 20) {
                  currentStep = 'Initializing upscaling job...';
                } else if (progress < 50) {
                  currentStep = `AI is enhancing your image... (${Math.round(progress)}% complete)`;
                } else if (progress < 90) {
                  currentStep = 'Applying final enhancements...';
                } else {
                  currentStep = 'Finalizing your enhanced image...';
                }

                return {
                  ...p,
                  progress: Math.max(10, Math.min(95, progress)),
                  currentStep,
                  timeRemaining: Math.max(0, Math.round(estimatedTime * (1 - progress / 100))),
                };
              }
              return p;
            })
          );
        }
      );

      // Update user stats after processing
      if (result.success) {
        const stats = await UpscaleTrackingService.getUserUsageStats(user.id);
        setUserStats(stats);
      }

      if (result.success && result.imageUrl) {
        setProcessQueue(prev => 
          prev.map(p => p.id === item.id ? { 
            ...p, 
            progress: 95,
            currentStep: 'Finalizing your enhanced image...'
          } : p)
        );
        
        // Check if we need client-side downscaling for Art/Text non-tiled jobs
        let finalImageUrl = result.imageUrl;
        
        // For Art/Text at 2x, we process at 4x and need to downscale
        if ((item.settings.quality === 'art' || item.settings.quality === 'text') && 
            item.settings.scale === 2 && 
            !result.usingTiling) {
          
          setProcessQueue(prev => 
            prev.map(p => p.id === item.id ? { 
              ...p, 
              progress: 96,
              currentStep: 'Adjusting to exact dimensions...'
            } : p)
          );
          
          try {
            // Load the 4x image
            const sourceImg = new Image();
            sourceImg.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              sourceImg.onload = resolve;
              sourceImg.onerror = reject;
              sourceImg.src = result.imageUrl!;
            });
            
            // Calculate target 2x dimensions
            const originalImg = new Image();
            await new Promise((resolve) => {
              originalImg.onload = resolve;
              originalImg.src = item.originalImage;
            });
            
            const targetWidth = Math.round(originalImg.width * 2);
            const targetHeight = Math.round(originalImg.height * 2);
            
            console.log(`[ImageProcessingContext] Downscaling Art 2x: ${sourceImg.width}×${sourceImg.height} → ${targetWidth}×${targetHeight}`);
            
            // Create canvas and downscale
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);
              
              // Convert to blob and create URL
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (result) => result ? resolve(result) : reject(new Error('Failed to convert canvas to blob')),
                  'image/png',
                  1.0
                );
              });
              
              finalImageUrl = URL.createObjectURL(blob);
              console.log(`[ImageProcessingContext] ✅ Downscaled to exact 2x`);
            }
          } catch (error) {
            console.error('[ImageProcessingContext] Downscaling failed:', error);
            // Continue with original 4x image if downscaling fails
          }
        }
        
        // Get original image dimensions for comparison
        const img = new Image();
        img.onload = async () => { // Made onload async to await incrementUpscaleCounts
          const completedItem = {
            ...item,
            status: 'completed' as const,
            progress: 100,
            currentStep: 'Upscaling complete!',
            timeRemaining: 0,
            upscaledImage: finalImageUrl,
            originalWidth: result.originalDimensions?.width || img.width,
            originalHeight: result.originalDimensions?.height || img.height,
            upscaledWidth: result.upscaledDimensions?.width || (img.width * item.settings.scale),
            upscaledHeight: result.upscaledDimensions?.height || (img.height * item.settings.scale),
            processedAt: Date.now()
          };
          
          setProcessQueue(prev => prev.filter(p => p.id !== item.id));
          setProcessedImages(prev => [...prev, completedItem]);

          // Increment user's upscale counts in the database
          await UpscaleTrackingService.incrementUpscaleCounts(user.id); // <--- ADDED THIS LINE
        };
        img.src = item.originalImage;
      } else {
        // Handle AI processing failure
        const failedItem = {
          ...item,
          status: 'error' as const,
          progress: 0,
          currentStep: 'Upscaling failed',
          timeRemaining: 0,
          error: result.error || 'AI upscaling failed'
        };
        
        setProcessQueue(prev => 
          prev.map(p => p.id === item.id ? failedItem : p)
        );
      }
    } catch (error) {
      // Clear progress interval on error
      const progressInterval = setInterval(() => {}, 1000);
      clearInterval(progressInterval);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ImageProcessingContext] Processing error:', {
        error: errorMessage,
        itemId: item.id,
        scale: item.settings.scale,
        quality: item.settings.quality,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const failedItem = {
        ...item,
        status: 'error' as const,
        progress: 0,
        currentStep: 'Processing failed',
        timeRemaining: 0,
        error: errorMessage || 'Unknown processing error'
      };
      
      setProcessQueue(prev => 
        prev.map(p => p.id === item.id ? failedItem : p)
      );
    }
  }, [user]);

  const addToQueue = useCallback((item: ProcessingItem) => {
    setProcessQueue(prev => [...prev, item]);
    
    // Start processing immediately (in real implementation, this would be managed by a queue system)
    setTimeout(() => {
      simulateProcessing(item);
    }, 1000);
  }, [simulateProcessing]);

  const removeFromQueue = useCallback((id: number) => {
    setProcessQueue(prev => prev.filter(item => item.id !== id));
    setProcessedImages(prev => prev.filter(item => item.id !== id));
  }, []);

  const addUploadedFile = useCallback((file: File, imageUrl: string) => {
    const uploadedFile: UploadedFile = {
      id: Date.now().toString(),
      file,
      imageUrl
    };
    setUploadedFiles(prev => [...prev, uploadedFile]);
  }, []);

  const clearUploadedFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  const clearProcessedImages = useCallback(() => {
    setProcessedImages([]);
  }, []);

  const clearProcessQueue = useCallback(() => {
    setProcessQueue([]);
  }, []);

  // Load user stats on mount
  React.useEffect(() => {
    if (user) {
      // Load real user profile and stats from database
      const loadUserData = async () => {
        try {
          // Load user profile from database
          const profile = await UpscaleTrackingService.getUserProfile(user.id);
          setRealUserProfile(profile);
          
          // Load usage stats
          const stats = await UpscaleTrackingService.getUserUsageStats(user.id);
          setUserStats(stats);
          
          console.log('Loaded user profile:', profile);
          console.log('Loaded user stats:', stats);
        } catch (error) {
          console.warn('Could not load user data from database:', error);
          // Set fallback values
          setUserStats({
            monthly_upscales_limit: 500,
            current_month_upscales: 0,
            usage_percentage: 0,
            days_until_reset: 30,
            estimated_monthly_cost: 0
          });
        }
      };
      
      loadUserData();
    } else {
      // Clear data when user logs out
      setUserStats(null);
      setRealUserProfile(null);
    }
  }, [user]);

  // Listen for profile refresh events (e.g., after subscription tier update)
  React.useEffect(() => {
    const handleRefreshProfile = async () => {
      if (user) {
        try {
          console.log('Refreshing user profile after update...');
          const profile = await UpscaleTrackingService.getUserProfile(user.id);
          setRealUserProfile(profile);
          
          const stats = await UpscaleTrackingService.getUserUsageStats(user.id);
          setUserStats(stats);
          
          console.log('Profile refreshed:', profile);
        } catch (error) {
          console.error('Error refreshing user profile:', error);
        }
      }
    };

    window.addEventListener('refresh-user-profile', handleRefreshProfile);
    return () => {
      window.removeEventListener('refresh-user-profile', handleRefreshProfile);
    };
  }, [user]);

  // Update user stats after processing
  React.useEffect(() => {
    if (user && processedImages.length > 0) {
      const loadUpdatedStats = async () => {
        try {
          const stats = await UpscaleTrackingService.getUserUsageStats(user.id);
          setUserStats(stats);
        } catch (error) {
          console.warn('Could not reload user stats after processing:', error);
        }
      };
      
      loadUpdatedStats();
    }
  }, [user, processedImages.length]);

  return (
    <ImageProcessingContext.Provider value={{
      processQueue,
      processedImages,
      uploadedFiles,
      processing,
      userStats,
      userProfile: realUserProfile, // Use real profile from database
      realUserProfile, // Export as realUserProfile for components
      isApiConfigured,
      addToQueue,
      removeFromQueue,
      addUploadedFile,
      clearUploadedFiles,
      clearProcessedImages,
      clearProcessQueue,
    }}>
      {children}
    </ImageProcessingContext.Provider>
  );
}

export function useImageProcessing() {
  const context = useContext(ImageProcessingContext);
  if (context === undefined) {
    throw new Error('useImageProcessing must be used within an ImageProcessingProvider');
  }
  return context;
}
