import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { edgeFunctionService } from '../services/edgeFunctionService';
import { upscaleTrackingService, type UserProfile } from '../services/upscaleTrackingService';

interface UploadedFile {
  file: File;
  imageUrl: string;
  id: number;
}

interface ProcessingItem {
  id: number;
  file: File;
  settings: {
    scale: number;
    quality: string;
    outputFormat: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  originalImage: string;
  upscaledImage?: string;
  currentStep?: string;
  timeRemaining?: number;
  originalWidth?: number;
  originalHeight?: number;
  upscaledWidth?: number;
  upscaledHeight?: number;
  processedAt?: number;
  apiCost?: number;
  remainingUpscales?: number;
}

interface UserStats {
  current_month_upscales: number;
  monthly_upscales_limit: number;
  total_upscales: number;
  usage_percentage: number;
  days_until_reset: number;
  estimated_monthly_cost: number;
}

interface ImageProcessingContextType {
  uploadedFiles: UploadedFile[];
  processedImages: ProcessingItem[];
  processQueue: ProcessingItem[];
  processing: boolean;
  userStats: UserStats | null;
  userProfile: UserProfile | null;
  isApiConfigured: boolean;
  addUploadedFile: (file: File, imageUrl: string) => void;
  clearUploadedFiles: () => void;
  addToQueue: (item: ProcessingItem) => void;
  removeFromQueue: (id: number) => void;
}

const ImageProcessingContext = createContext<ImageProcessingContextType | undefined>(undefined);

export function ImageProcessingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessingItem[]>([]);
  const [processQueue, setProcessQueue] = useState<ProcessingItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const isApiConfigured = edgeFunctionService.isConfigured();

  // Load user stats when user changes
  useEffect(() => {
    if (user?.id) {
      loadUserStats();
      loadUserProfile();
    } else {
      setUserStats(null);
      setUserProfile(null);
    }
  }, [user?.id]);

  const loadUserStats = async () => {
    if (!user?.id) return;
    
    try {
      const stats = await upscaleTrackingService.getUserUsageStats(user.id);
      setUserStats(stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
      // Set default stats on error
      setUserStats({
        current_month_upscales: 0,
        monthly_upscales_limit: 250,
        total_upscales: 0,
        usage_percentage: 0,
        days_until_reset: 30,
        estimated_monthly_cost: 0
      });
    }
  };

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const profile = await upscaleTrackingService.getUserProfile(user.id);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  // Process queue items
  useEffect(() => {
    const processNext = async () => {
      const pendingItem = processQueue.find(item => item.status === 'pending');
      if (!pendingItem || processing) return;

      setProcessing(true);
      
      // Update item to processing status
      setProcessQueue(prev => prev.map(item => 
        item.id === pendingItem.id 
          ? { ...item, status: 'processing' as const, progress: 0, currentStep: 'Starting AI upscaling...' }
          : item
      ));

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProcessQueue(prev => prev.map(item => {
            if (item.id === pendingItem.id && item.status === 'processing') {
              const newProgress = Math.min(item.progress + Math.random() * 15, 90);
              const steps = [
                'Preprocessing image...',
                'Sending to AI model...',
                'AI enhancement in progress...',
                'Finalizing upscaled image...'
              ];
              const stepIndex = Math.floor(newProgress / 25);
              return {
                ...item,
                progress: newProgress,
                currentStep: steps[stepIndex] || 'Processing...',
                timeRemaining: Math.max(0, Math.round((100 - newProgress) / 2))
              };
            }
            return item;
          }));
        }, 1000);

        // Call the edge function service
        const result = await edgeFunctionService.upscaleImage({
          image: pendingItem.file,
          scale: pendingItem.settings.scale,
          quality: pendingItem.settings.quality as 'photo' | 'art' | 'anime' | 'text',
          outputFormat: pendingItem.settings.outputFormat
        });

        clearInterval(progressInterval);

        if (result.success && result.imageUrl) {
          // Create completed item
          const completedItem: ProcessingItem = {
            ...pendingItem,
            status: 'completed',
            progress: 100,
            currentStep: 'Upscaling complete!',
            timeRemaining: 0,
            upscaledImage: result.imageUrl,
            originalWidth: result.originalDimensions?.width || 1024,
            originalHeight: result.originalDimensions?.height || 1024,
            upscaledWidth: result.upscaledDimensions?.width || (1024 * pendingItem.settings.scale),
            upscaledHeight: result.upscaledDimensions?.height || (1024 * pendingItem.settings.scale),
            processedAt: Date.now(),
            apiCost: 0.0055,
            remainingUpscales: userStats?.monthly_upscales_limit ? userStats.monthly_upscales_limit - userStats.current_month_upscales - 1 : undefined
          };
          
          setProcessQueue(prev => prev.filter(p => p.id !== pendingItem.id));
          setProcessedImages(prev => [...prev, completedItem]);
          
          // Reload user stats after successful processing
          await loadUserStats();
        } else {
          // Handle error
          setProcessQueue(prev => prev.map(item => 
            item.id === pendingItem.id 
              ? { 
                  ...item, 
                  status: 'error' as const, 
                  progress: 0, 
                  currentStep: result.error || 'Processing failed',
                  timeRemaining: 0
                }
              : item
          ));
        }
      } catch (error) {
        console.error('Processing error:', error);
        setProcessQueue(prev => prev.map(item => 
          item.id === pendingItem.id 
            ? { 
                ...item, 
                status: 'error' as const, 
                progress: 0, 
                currentStep: error instanceof Error ? error.message : 'Processing failed',
                timeRemaining: 0
              }
            : item
        ));
      } finally {
        setProcessing(false);
      }
    };

    processNext();
  }, [processQueue, processing, userStats]);

  const addUploadedFile = (file: File, imageUrl: string) => {
    const newFile: UploadedFile = {
      file,
      imageUrl,
      id: Date.now()
    };
    setUploadedFiles(prev => [...prev, newFile]);
  };

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
  };

  const addToQueue = (item: ProcessingItem) => {
    setProcessQueue(prev => [...prev, item]);
  };

  const removeFromQueue = (id: number) => {
    setProcessQueue(prev => prev.filter(item => item.id !== id));
  };

  const value: ImageProcessingContextType = {
    uploadedFiles,
    processedImages,
    processQueue,
    processing,
    userStats,
    userProfile,
    isApiConfigured,
    addUploadedFile,
    clearUploadedFiles,
    addToQueue,
    removeFromQueue
  };

  return (
    <ImageProcessingContext.Provider value={value}>
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