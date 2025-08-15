import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { edgeFunctionService } from '../services/edgeFunctionService';
import { UpscaleTrackingService } from '../services/upscaleTrackingService'; // Corrected import to use the class
import { useAuth } from './AuthContext';

interface UploadedFile {
  id: string;
  file: File;
  imageUrl: string;
}

interface ProcessingItem {
  id: number;
  file: File;
  settings: {
    scale: number;
    quality: string;
    outputFormat: string;
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
  isApiConfigured: boolean;
  addToQueue: (item: ProcessingItem) => void;
  removeFromQueue: (id: number) => void;
  addUploadedFile: (file: File, imageUrl: string) => void;
  clearUploadedFiles: () => void;
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
    const startTime = Date.now();

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

      // Simulate progress updates during processing
      const progressInterval = setInterval(() => {
        setProcessQueue(prev => 
          prev.map(p => {
            if (p.id === item.id && p.status === 'processing' && p.progress < 90) {
              const newProgress = Math.min(90, p.progress + Math.random() * 15 + 5);
              const elapsed = (Date.now() - startTime) / 1000;
              const remaining = Math.max(0, Math.round(estimatedTime - elapsed));
              
              let currentStep = 'Processing...';
              if (newProgress < 15) {
                currentStep = 'Preparing image for AI processing...';
              } else if (newProgress < 30) {
                currentStep = 'Uploading to AI service...';
              } else if (newProgress < 70) {
                currentStep = 'AI is enhancing your image...';
              } else if (newProgress < 90) {
                currentStep = 'Applying final enhancements...';
              }
              
              return { 
                ...p, 
                progress: newProgress,
                currentStep,
                timeRemaining: remaining
              };
            }
            return p;
          })
        );
      }, 1500);

      // Try edge function first, fallback to direct Replicate API
      let result;
      
      console.log('Using edge function for AI upscaling...');
      
      setProcessQueue(prev => 
        prev.map(p => p.id === item.id ? { 
          ...p, 
          progress: 20,
          currentStep: 'Connecting to AI service...'
        } : p)
      );
      
      result = await edgeFunctionService.upscaleImage({
        userId: user.id,
        image: item.file,
        scale: item.settings.scale,
        quality: item.settings.quality,
        outputFormat: item.settings.outputFormat
      });

      // Update user stats after processing
      if (result.success) {
        const stats = await UpscaleTrackingService.getUserUsageStats(user.id);
        setUserStats(stats);
      }

      clearInterval(progressInterval);

      if (result.success && result.imageUrl) {
        setProcessQueue(prev => 
          prev.map(p => p.id === item.id ? { 
            ...p, 
            progress: 95,
            currentStep: 'Finalizing your enhanced image...'
          } : p)
        );
        
        // Get original image dimensions for comparison
        const img = new Image();
        img.onload = async () => { // Made onload async to await incrementUpscaleCounts
          const completedItem = {
            ...item,
            status: 'completed' as const,
            progress: 100,
            currentStep: 'Upscaling complete!',
            timeRemaining: 0,
            upscaledImage: result.imageUrl!,
            originalWidth: result.originalDimensions?.width || img.width,
            originalHeight: result.originalDimensions?.height || img.height,
            upscaledWidth: result.upscaledDimensions?.width || (img.width * item.settings.scale),
            upscaledHeight: result.upscaledDimensions?.height || (img.height * item.settings.scale),
            processedAt: Date.now(),
            apiCost: result.apiCost,
            remainingUpscales: result.remainingUpscales
          };
          
          setProcessQueue(prev => prev.filter(p => p.id !== item.id));
          setProcessedImages(prev => [...prev, completedItem]);

          // Increment user's upscale counts in the database
          await UpscaleTrackingService.incrementUpscaleCounts(user.id); // <--- ADDED THIS LINE
        };
        img.src = item.originalImage;
      } else {
        clearInterval(progressInterval);
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
      
      console.error('Processing error:', error);
      
      const failedItem = {
        ...item,
        status: 'error' as const,
        progress: 0,
        currentStep: 'Processing failed',
        timeRemaining: 0,
        error: error instanceof Error ? error.message : 'Unknown processing error'
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
      isApiConfigured,
      addToQueue,
      removeFromQueue,
      addUploadedFile,
      clearUploadedFiles,
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
