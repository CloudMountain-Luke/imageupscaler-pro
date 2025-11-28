import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Scale, Quality, PlanTier } from '../types/upscale';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { useThemeLab } from '../contexts/ThemeContext';
import { UploadCloud, Download, Save } from 'lucide-react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Toolbar } from './Toolbar';
import * as UTIF from 'utif';
import { checkBrowserLimits, getMaxAllowedScale, calculateSegmentedDownload } from '../utils/browserLimits';

// const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
// const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

// Utility function to convert TIFF files to PNG for browser display
const convertTiffToPng = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error('Failed to read file'));
          return;
        }
        
        // Decode TIFF using UTIF
        const ifds = UTIF.decode(arrayBuffer);
        if (ifds.length === 0) {
          reject(new Error('Invalid TIFF file'));
          return;
        }
        
        // Get the first image
        const ifd = ifds[0];
        UTIF.decodeImage(arrayBuffer, ifd);
        
        // Create canvas to render the TIFF
        const width = ifd.width;
        const height = ifd.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Convert TIFF data to ImageData
        const imageData = ctx.createImageData(width, height);
        const rgba = UTIF.toRGBA8(ifd);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        
        // Convert canvas to PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Helper function to check if file is TIFF
const isTiffFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.tif') || fileName.endsWith('.tiff') || file.type === 'image/tiff';
};

// Helper component for the image display boxes.
const ImageUploadBox = ({ image, onImageUpload, isProcessing = false, isUpscaledBox = false, progress = 0, timeRemaining = 0 }: { image: string | undefined; onImageUpload?: (files: File[]) => void; isProcessing?: boolean; isUpscaledBox?: boolean; progress?: number; timeRemaining?: number }) => {
  const { tone } = useThemeLab();
  
  // Format time remaining (convert seconds to mm:ss)
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Validate file extensions (case-insensitive)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.dib', '.tiff', '.tif', '.avif', '.heic', '.heif'];
    
    // Allowed MIME types
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', // JPEG variations
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp', 'image/x-ms-bmp', // BMP variations
      'image/tiff', 'image/tif',
      'image/avif',
      'image/heic', 'image/heif'
    ];
    
    // Helper function to check if a file is valid
    const isValidFile = (file: File): boolean => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // Check by extension
      const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      // Check by MIME type
      const hasValidMimeType = fileType && allowedMimeTypes.some(mime => {
        const normalizedMime = mime.toLowerCase();
        return fileType === normalizedMime || fileType.startsWith(normalizedMime.split('/')[0] + '/');
      });
      
      // If file has no valid extension and no MIME type, but is being dragged, be permissive
      // This handles cases where browsers strip extensions or MIME types during drag-and-drop
      // The actual image loading will validate if it's a real image
      const isPermissiveCase = !hasValidExtension && !fileType;
      
      return hasValidExtension || hasValidMimeType || isPermissiveCase;
    };
    
    // Debug: Log what we receive
    console.log('[ImageUploadBox] handleDrop called', {
      acceptedCount: acceptedFiles.length,
      rejectedCount: rejectedFiles.length,
      accepted: acceptedFiles.map(f => ({ name: f.name, type: f.type })),
      rejected: rejectedFiles.map(r => ({ name: r.file.name, type: r.file.type, errors: r.errors }))
    });
    
    // Process accepted files
    const validAcceptedFiles = acceptedFiles.filter(file => {
      const isValid = isValidFile(file);
      console.log('[ImageUploadBox] Accepted file check:', { fileName: file.name, isValid, type: file.type });
      return isValid;
    });
    
    // Also check rejected files - they might have valid extensions but wrong MIME type
    // This is common with JPEG files where browsers may report incorrect MIME types
    const validRejectedFiles: File[] = [];
    rejectedFiles.forEach(rejection => {
      const isValid = isValidFile(rejection.file);
      console.log('[ImageUploadBox] Rejected file check:', { 
        fileName: rejection.file.name, 
        isValid, 
        type: rejection.file.type, 
        errors: rejection.errors 
      });
      if (isValid) {
        validRejectedFiles.push(rejection.file);
      }
    });
    
    // Combine valid files from both accepted and rejected
    const allValidFiles = [...validAcceptedFiles, ...validRejectedFiles];
    
    console.log('[ImageUploadBox] Final result:', {
      validAcceptedCount: validAcceptedFiles.length,
      validRejectedCount: validRejectedFiles.length,
      totalValid: allValidFiles.length,
      hasOnImageUpload: !!onImageUpload
    });
    
    if (allValidFiles.length > 0 && onImageUpload) {
      console.log('[ImageUploadBox] Calling onImageUpload');
      onImageUpload(allValidFiles);
    } else if (rejectedFiles.length > 0 && validRejectedFiles.length === 0) {
      // Log if files were rejected and couldn't be recovered
      console.warn('[ImageUploadBox] Files rejected - invalid format', { 
        rejectedFiles: rejectedFiles.map(r => ({ 
          file: r.file.name, 
          type: r.file.type,
          errors: r.errors 
        }))
      });
    } else if (allValidFiles.length === 0) {
      console.warn('[ImageUploadBox] No valid files found after processing');
    }
  }, [onImageUpload]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    multiple: false,
    // Accept specific image MIME types with explicit extensions
    // This helps browsers correctly identify JPEG files
    // We still validate by extension in handleDrop as a fallback
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp', '.dib'],
      'image/tiff': ['.tiff', '.tif'],
      'image/avif': ['.avif'],
      'image/heic': ['.heic', '.heif']
    },
    disabled: isUpscaledBox,
    noClick: false,
    noKeyboard: false
  });

  // Calculate adaptive text colors based on tone for WCAG compliance
  const primaryTextColor = useMemo(() => {
    if (tone <= 50) {
      return 'hsl(0, 0%, 96%)'; // White/light for dark backgrounds
    } else {
      return 'hsl(0, 0%, 12%)'; // Dark for light backgrounds
    }
  }, [tone]);

  const secondaryTextColor = useMemo(() => {
    if (tone <= 50) {
      return 'hsl(0, 0%, 75%)'; // Light gray for dark backgrounds
    } else {
      return 'hsl(0, 0%, 35%)'; // Darker gray for light backgrounds
    }
  }, [tone]);

  const iconColor = useMemo(() => {
    if (tone <= 50) {
      return 'hsl(0, 0%, 70%)'; // Light gray for dark backgrounds
    } else {
      return 'hsl(0, 0%, 40%)'; // Darker gray for light backgrounds
    }
  }, [tone]);

  const rootProps = getRootProps({
    className: `rounded-lg shadow-inner flex flex-col items-center justify-center relative border-2 border-dashed ${
      isUpscaledBox ? 'cursor-default p-4' : 'hover:border-blue-500 cursor-pointer'
    }`,
    style: {
      background: 'var(--surface)',
      borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
      transition: 'border-color 0.2s ease',
      width: '100%',
      height: '100%',
      padding: isUpscaledBox ? undefined : '0'
    }
  });

  return (
    <div {...rootProps}>
      <input {...getInputProps()} />
      {image ? (
        <img 
          src={image} 
          alt="Image" 
          className="max-h-full max-w-full object-contain rounded-md pointer-events-none" 
          draggable={false}
          style={{ pointerEvents: 'none' }}
        />
      ) : (
        <div className={`flex flex-col items-center justify-center text-center ${isUpscaledBox ? 'p-4' : ''}`}>
          {isUpscaledBox ? (
            <>
              <span className="text-4xl mb-4">✨</span>
              <span className="text-lg" style={{ color: secondaryTextColor }}>
                Upscaled image will appear here
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-16 h-16 mb-4" style={{ color: iconColor }} />
              <div className="text-center">
                <div className="text-xl font-bold mb-2" style={{ color: primaryTextColor }}>Upload Images</div>
                <div className="mb-2" style={{ color: secondaryTextColor }}>Click or drag images here</div>
                <div className="text-sm" style={{ color: secondaryTextColor }}>JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC • Max 25MB</div>
              </div>
            </>
          )}
          {/* Drag active overlay intentionally disabled */}
        </div>
      )}
      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="w-full max-w-xs px-4 mb-4">
            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
              <div
                className="h-full transition-all duration-300 ease-out rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  background: `linear-gradient(to right, var(--primary), var(--secondary))`,
                }}
              />
            </div>
            {/* Progress Percentage */}
            <div className="text-center text-white text-sm font-medium">
              {Math.round(progress)}%
            </div>
          </div>
          {/* Countdown Timer */}
          <div className="flex flex-col items-center gap-2">
            <div 
              className="animate-spin rounded-full h-8 w-8 border-2"
              style={{
                borderColor: 'var(--primary)',
                borderTopColor: 'transparent',
              }}
            />
            <div className="text-white text-sm font-medium">
              Time remaining: {formatTimeRemaining(timeRemaining)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ImageUpscaler = () => {
  const {
    uploadedFiles,
    processedImages,
    processQueue,
    userStats,
    userProfile,
    realUserProfile,
    isApiConfigured,
    addToQueue,
    addUploadedFile,
    clearUploadedFiles,
    clearProcessedImages,
    clearProcessQueue
  } = useImageProcessing();


  const [upscaleSettings, setUpscaleSettings] = useState<{
    scale: Scale;
    quality: Quality;
    outputFormat: string;
    qualityMode?: 'speed' | 'quality';
    useClarityUpscaler?: boolean;
  }>({
    scale: 2 as Scale,
    quality: 'photo' as Quality,
    outputFormat: 'original',
    qualityMode: 'speed',
    useClarityUpscaler: false
  });

  // Get the latest uploaded file and processed image **before useEffect**
  const latestUploadedFile = uploadedFiles.length > 0
    ? uploadedFiles[uploadedFiles.length - 1]
    : null;
  const latestProcessedImage =
    processedImages.find(img => img.status === 'completed') ?? null;
  const currentProcessing =
    processQueue.find(item => item.status === 'processing') ?? null;

  // Track current image dimensions for 12k px guard
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);
  
  // Track upscaled image dimensions for aspect ratio
  const [upscaledImageWidth, setUpscaledImageWidth] = useState<number | null>(null);
  const [upscaledImageHeight, setUpscaledImageHeight] = useState<number | null>(null);

  useEffect(() => {
    // Safely use latestUploadedFile now
    const imgUrl = latestUploadedFile?.imageUrl;
    if (!imgUrl) {
      setImageWidth(null);
      setImageHeight(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageWidth(img.naturalWidth);
      setImageHeight(img.naturalHeight);
    };
    img.onerror = () => {
      setImageWidth(null);
      setImageHeight(null);
    };
    img.src = imgUrl;
  }, [latestUploadedFile?.imageUrl]);

  useEffect(() => {
    // Track upscaled image dimensions
    const upscaledImgUrl = latestProcessedImage?.upscaledImage;
    if (!upscaledImgUrl) {
      setUpscaledImageWidth(null);
      setUpscaledImageHeight(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setUpscaledImageWidth(img.naturalWidth);
      setUpscaledImageHeight(img.naturalHeight);
    };
    img.onerror = () => {
      setUpscaledImageWidth(null);
      setUpscaledImageHeight(null);
    };
    img.src = upscaledImgUrl;
  }, [latestProcessedImage?.upscaledImage]);

  // Calculate aspect ratios (default to 5:4 = 1.25, closest to 1:1 while staying landscape)
  const originalAspectRatio = useMemo(() => {
    if (imageWidth && imageHeight) {
      return imageWidth / imageHeight;
    }
    return 5 / 4; // Default 5:4 (closest to 1:1 while landscape)
  }, [imageWidth, imageHeight]);

  const upscaledAspectRatio = useMemo(() => {
    if (upscaledImageWidth && upscaledImageHeight) {
      return upscaledImageWidth / upscaledImageHeight;
    }
    // If no upscaled image, use original aspect ratio, otherwise default to 5:4
    if (latestProcessedImage?.upscaledImage && originalAspectRatio) {
      return originalAspectRatio;
    }
    return 5 / 4; // Default 5:4 (closest to 1:1 while landscape)
  }, [upscaledImageWidth, upscaledImageHeight, originalAspectRatio, latestProcessedImage?.upscaledImage]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Convert TIFF files to PNG for browser display
      let imageUrl: string;
      if (isTiffFile(file)) {
        try {
          imageUrl = await convertTiffToPng(file);
        } catch (error) {
          console.error('Failed to convert TIFF file:', error);
          // Fallback to object URL even if conversion fails
          imageUrl = URL.createObjectURL(file);
        }
      } else {
        imageUrl = URL.createObjectURL(file);
      }
      
      addUploadedFile(file, imageUrl);
    }
  }, [addUploadedFile]);

  // Compute remaining upscales using stats/profile fallbacks
  const remainingUpscales = (() => {
    if (userStats?.monthly_upscales_limit && typeof userStats.current_month_upscales === 'number') {
      return Math.max(0, userStats.monthly_upscales_limit - userStats.current_month_upscales);
    }
    if (userProfile?.monthly_upscales_limit && typeof userProfile.monthly_upscales_limit === 'number') {
      const used = userProfile.current_month_upscales ?? 0;
      return Math.max(0, userProfile.monthly_upscales_limit - used);
    }
    if (userProfile?.subscription_tiers?.monthly_upscales && typeof userProfile.subscription_tiers.monthly_upscales === 'number') {
      const used = userProfile.current_month_upscales ?? 0;
      return Math.max(0, userProfile.subscription_tiers.monthly_upscales - used);
    }
    if (userProfile?.credits_remaining && typeof userProfile.credits_remaining === 'number') {
      return userProfile.credits_remaining;
    }
    const tier = (
      userProfile?.subscription_tiers?.name ||
      userProfile?.subscription_tier ||
      userProfile?.subscriptionTier ||
      ''
    ).toLowerCase();
    const defaults: Record<string, number> = { basic: 100, pro: 500, enterprise: 1250, mega: 2750 };
    return defaults[tier] ?? 250;
  })();

  const handleUpscaleImage = useCallback(() => {
    if (latestUploadedFile && !currentProcessing) {
      // Validate scale is a valid Scale type
      const validScales: Scale[] = [2, 4, 8, 10, 12, 16, 20, 24, 28, 32, 64];
      if (!validScales.includes(upscaleSettings.scale as Scale)) {
        console.error(`[ImageUploader] Invalid scale: ${upscaleSettings.scale}`);
        alert(`Invalid scale factor: ${upscaleSettings.scale}x. Please select a valid scale.`);
        return;
      }
      
      // Check browser limits and scale constraints
      if (imageWidth && imageHeight) {
        // Check if scale exceeds maximum for this image size
        const maxScale = getMaxAllowedScale(imageWidth, imageHeight);
        if (upscaleSettings.scale > maxScale) {
          alert(
            `⚠️ Scale Factor Too High\n\n` +
            `This image (${imageWidth}×${imageHeight}) is too large for ${upscaleSettings.scale}x upscaling.\n\n` +
            `Maximum scale for this image: ${maxScale}x\n\n` +
            `Please select a lower scale factor.`
          );
          return;
        }
        
        // Check if result will exceed browser limits
        const sizeCheck = checkBrowserLimits(imageWidth, imageHeight, upscaleSettings.scale);
        
        if (!sizeCheck.withinLimits) {
          // Check if segmented download is possible
          const segmentInfo = calculateSegmentedDownload(imageWidth, imageHeight, upscaleSettings.scale);
          
          if (segmentInfo.needed && segmentInfo.segments && segmentInfo.segments <= 16) {
            // Offer segmented download option
            const shouldContinue = window.confirm(
              `${segmentInfo.message}\n\n` +
              `Do you want to continue with segmented download?`
            );
            
            if (!shouldContinue) {
              return;
            }
            
            // TODO: Implement segmented download mode
            console.log('[ImageUploader] Segmented download mode requested:', segmentInfo);
          } else {
            // Too many segments or not possible
            alert(
              `${sizeCheck.message}\n\n` +
              `This upscale would require ${segmentInfo.segments || 'too many'} segments, which is not practical.\n\n` +
              `Please use a lower scale factor (max: ${sizeCheck.suggestedScale}x).`
            );
            return;
          }
        }
      }
      
      // Infer plan from upscales if subscription_tiers is not loaded
      const inferPlanFromUpscales = (upscales: number | null | undefined): PlanTier => {
        if (!upscales) return 'basic';
        if (upscales >= 2750) return 'mega';
        if (upscales >= 1250) return 'enterprise';
        if (upscales >= 500) return 'pro';
        return 'basic';
      };

      // Use realUserProfile if available, otherwise fall back to userProfile
      const profile = realUserProfile || userProfile;
      
      // Get plan from profile (database profile from context)
      let rawPlan = (
        profile?.subscription_tiers?.name?.toLowerCase()?.trim() ||
        profile?.subscription_tier?.toLowerCase()?.trim() ||
        profile?.subscriptionTier?.toLowerCase()?.trim() ||
        ''
      );
      
      // If subscription_tiers is null/empty but we have monthly_upscales_limit, infer the plan
      if ((!rawPlan || rawPlan === '') && profile?.monthly_upscales_limit) {
        rawPlan = inferPlanFromUpscales(profile.monthly_upscales_limit);
        console.log('[ImageUploader] Inferred plan from upscales:', rawPlan, 'from limit:', profile.monthly_upscales_limit, 'profile:', profile);
      }
      
      console.log('[ImageUploader] Plan detection:', {
        hasRealUserProfile: !!realUserProfile,
        hasUserProfile: !!userProfile,
        subscription_tiers: profile?.subscription_tiers,
        monthly_upscales_limit: profile?.monthly_upscales_limit,
        rawPlan,
        finalPlan: rawPlan || 'basic'
      });
      
      const plan = (rawPlan || 'basic').toLowerCase() as PlanTier;
      console.log('[ImageUploader] Using plan for upscale:', plan);
      
      const processingItem = {
        id: Date.now(),
        file: latestUploadedFile.file,
        settings: {
          scale: upscaleSettings.scale,
          quality: upscaleSettings.quality,
          outputFormat: upscaleSettings.outputFormat,
          outputSize: 'original',
          plan: plan, // Add plan to settings
        },
        status: 'pending' as const,
        progress: 0,
        originalImage: latestUploadedFile.imageUrl,
      };
      addToQueue(processingItem);
    }
  }, [latestUploadedFile, currentProcessing, addToQueue, upscaleSettings, userProfile, imageWidth, imageHeight, realUserProfile]);

  const handleStartNew = useCallback(() => {
    clearUploadedFiles();
    clearProcessedImages();
    clearProcessQueue();
    setImageWidth(null);
    setImageHeight(null);
    setUpscaledImageWidth(null);
    setUpscaledImageHeight(null);
    setUpscaleSettings({
      scale: 2 as Scale,
      quality: 'photo' as Quality,
      outputFormat: 'original',
      qualityMode: 'speed',
      useClarityUpscaler: false
    });
  }, [clearUploadedFiles, clearProcessedImages, clearProcessQueue]);

  // Listen for start new upscale event from header
  useEffect(() => {
    const handleStartNewUpscale = () => {
      handleStartNew();
    };
    window.addEventListener('start-new-upscale', handleStartNewUpscale);
    return () => {
      window.removeEventListener('start-new-upscale', handleStartNewUpscale);
    };
  }, [handleStartNew]);

  const handleSaveProject = useCallback(() => {
    if (!latestUploadedFile) return;
    
    const projectData = {
      id: `project_${Date.now()}`,
      timestamp: Date.now(),
      originalImageUrl: latestUploadedFile.imageUrl,
      upscaledImageUrl: latestProcessedImage?.upscaledImage,
      settings: {
        scale: upscaleSettings.scale,
        quality: upscaleSettings.quality,
        outputFormat: upscaleSettings.outputFormat
      }
    };

    try {
      const projects = JSON.parse(localStorage.getItem('upscaleProjects') || '[]');
      projects.push(projectData);
      localStorage.setItem('upscaleProjects', JSON.stringify(projects));
      
      // Also download as JSON file
      const jsonStr = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `upscale_project_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }, [latestUploadedFile, latestProcessedImage, upscaleSettings]);

  const { tone } = useThemeLab();
  const linkTextColor = useMemo(() => {
    if (tone <= 50) {
      return 'hsl(0, 0%, 96%)';
    } else {
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);

  return (
    <>
      <Toolbar
        upscaleSettings={upscaleSettings}
        onSettingsChange={setUpscaleSettings}
        userProfile={userProfile}
        realUserProfile={realUserProfile}
        currentProcessing={currentProcessing}
        onUpscale={handleUpscaleImage}
        latestUploadedFile={latestUploadedFile}
        isApiConfigured={isApiConfigured}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
      />
      <div className="w-full max-w-7xl mx-auto">
        {/* Tablet & Desktop Layout - 768px+ */}
        <div className="hidden md:flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
          <div className="flex-1 space-y-6">

            <div className="w-[90%] max-w-7xl mx-auto" style={{ marginTop: '20px' }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-9">
              <div style={{ aspectRatio: originalAspectRatio }}>
              <ImageUploadBox
                image={latestUploadedFile?.imageUrl}
                onImageUpload={onDrop}
                isUpscaledBox={false}
              />
              </div>
              <div style={{ aspectRatio: upscaledAspectRatio }} className="relative">
              <ImageUploadBox
                image={latestProcessedImage?.upscaledImage}
                isProcessing={!!currentProcessing}
                isUpscaledBox={true}
                progress={currentProcessing?.progress || 0}
                timeRemaining={currentProcessing?.timeRemaining || 0}
              />
                {latestProcessedImage?.upscaledImage && !currentProcessing && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                    <button
                      onClick={handleSaveProject}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg border text-sm"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: linkTextColor,
                      }}
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Project</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - 30px below disclaimer text */}
        <div className="flex flex-col md:hidden w-full items-center" style={{ marginTop: '-15px', paddingLeft: '20px', paddingRight: '20px', paddingBottom: '60px' }}>
          {latestProcessedImage?.upscaledImage ? (
            <MobileImageComparison
              originalImage={latestUploadedFile?.imageUrl || ''}
              upscaledImage={latestProcessedImage.upscaledImage}
              scale={upscaleSettings.scale}
              onSaveProject={handleSaveProject}
            />
          ) : (
            <div className="w-full" style={{ maxWidth: '470px', width: '100%', height: '250px' }}>
          <ImageUploadBox
            image={latestUploadedFile?.imageUrl}
            onImageUpload={onDrop}
            isUpscaledBox={false}
          />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Mobile Before/After Comparison Component
const MobileImageComparison = ({ 
  originalImage, 
  upscaledImage, 
  scale,
  onSaveProject
}: { 
  originalImage: string; 
  upscaledImage: string; 
  scale: number;
  onSaveProject: () => void;
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const { tone } = useThemeLab();

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleMouseMove(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    handleTouchMove(e);
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent | TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let touch: React.Touch | Touch | null = null;
    if ('touches' in e && e.touches.length > 0) {
      touch = e.touches[0] as React.Touch | Touch;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      touch = e.changedTouches[0] as React.Touch | Touch;
    }
    if (!touch) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    const handleGlobalTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const handleGlobalTouchEnd = () => handleMouseUp();

    if (isDragging.current) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  const handleDownload = () => {
    fetch(upscaledImage)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `upscaled_${scale}x_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Download failed:', error);
        window.open(upscaledImage, '_blank');
      });
  };

  const buttonTextColor = useMemo(() => {
    if (tone <= 75) {
      return 'hsl(0, 0%, 96%)';
    } else {
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);


  return (
    <div className="w-full max-w-[360px]">
      {/* Download and Save Project Buttons */}
      <div className="flex justify-center gap-3 mb-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg"
          style={{
            background: 'linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))',
            color: buttonTextColor,
          }}
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
        <button
          onClick={onSaveProject}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: buttonTextColor,
          }}
        >
          <Save className="w-4 h-4" />
          <span>Save Project</span>
        </button>
              </div>

      {/* Comparison Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 cursor-col-resize select-none"
        style={{ 
          width: '360px', 
          height: '175px', 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
      >
        {/* Original Image */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          }}
        >
          <img
            src={originalImage}
            alt="Original"
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
          <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-medium pointer-events-none">
            Original
              </div>
            </div>

        {/* Upscaled Image */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath: `inset(0 0 0 ${sliderPosition}%)`,
          }}
        >
          <img
            src={upscaledImage}
            alt="Upscaled"
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
          <div 
            className="absolute top-2 right-2 text-white px-2 py-1 rounded text-xs font-medium shadow-md pointer-events-none"
            style={{
              background: `linear-gradient(to right, color-mix(in oklab, var(--primary) 85%, transparent 15%), color-mix(in oklab, var(--secondary) 85%, transparent 15%))`
            }}
          >
            {scale}x Upscaled
              </div>
            </div>

        {/* Slider Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-10"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Slider Handle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-xl border-2 border-gray-300 pointer-events-auto cursor-col-resize">
            <div 
              className="w-full h-full rounded-full scale-75"
              style={{
                background: `linear-gradient(to right, var(--primary), var(--secondary))`
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageUpscaler;
