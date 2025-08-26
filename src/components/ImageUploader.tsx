import { useState, useCallback, useEffect } from 'react';
import type { Scale, Quality } from '../types/upscale';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { Clock, UploadCloud, Star } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

// const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
// const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

// Helper component for the image display boxes.
const ImageUploadBox = ({ image, onImageUpload, isProcessing = false, isUpscaledBox = false }: { image: string | undefined; onImageUpload?: (files: File[]) => void; isProcessing?: boolean; isUpscaledBox?: boolean }) => {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onImageUpload || (() => {}),
    multiple: false,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    disabled: isUpscaledBox
  });

  return (
    <div
      {...getRootProps()}
      className={`bg-gray-700 rounded-lg p-4 shadow-inner aspect-square flex flex-col items-center justify-center relative border-2 border-dashed border-gray-600 transition-colors ${
        isUpscaledBox ? 'cursor-default' : 'hover:border-blue-500 cursor-pointer'
      }`}
    >
      <input {...getInputProps()} />
      {image ? (
        <img src={image} alt="Image" className="max-h-full max-w-full object-contain rounded-md" />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          {isUpscaledBox ? (
            <>
              <span className="text-4xl mb-4">✨</span>
              <span className="text-gray-400 text-lg">
                Upscaled image will appear here
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-16 h-16 text-gray-500 mb-4" />
              <div className="text-center">
                <div className="text-white text-xl font-bold mb-2">Upload Images</div>
                <div className="text-gray-400 mb-2">Click or drag images here</div>
                <div className="text-gray-500 text-sm">JPEG, PNG, WebP • Max 25MB</div>
              </div>
            </>
          )}
          {/* Drag active overlay intentionally disabled */}
        </div>
      )}
      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
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
    isApiConfigured,
    addToQueue,
    addUploadedFile
  } = useImageProcessing();

  const [upscaleSettings, setUpscaleSettings] = useState<{
    scale: Scale;
    quality: Quality;
    outputFormat: string;
  }>({
    scale: 2 as Scale,
    quality: 'photo' as Quality,
    outputFormat: 'original'
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const imageUrl = URL.createObjectURL(file);
      addUploadedFile(file, imageUrl);
    }
  }, [addUploadedFile]);

  useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  });

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
      const processingItem = {
        id: Date.now(),
        file: latestUploadedFile.file,
        settings: {
          scale: upscaleSettings.scale,
          quality: upscaleSettings.quality,
          outputFormat: upscaleSettings.outputFormat,
          outputSize: 'original'
        },
        status: 'pending' as const,
        progress: 0,
        originalImage: latestUploadedFile.imageUrl,
      };
      addToQueue(processingItem);
    }
  }, [latestUploadedFile, currentProcessing, addToQueue, upscaleSettings]);

  return (
    <>
      <div className="w-full max-w-7xl mx-auto">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
          <div className="flex-1 space-y-6">
            {/* Controls Panel - Now above the image boxes */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex flex-wrap items-end gap-4">
                {/* Scale Factor */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Scale Factor
                  </label>
                    <select
                      value={upscaleSettings.scale}
                      onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) as Scale })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(() => {
                        const rawPlan = (userProfile?.subscriptionTier || userProfile?.subscription_tier || userProfile?.subscription_tiers?.name || 'basic');
                        const plan = (typeof rawPlan === 'string' ? rawPlan : 'basic').toLowerCase();
                        const scalesByPlan: Record<string, number[]> = {
                          basic: [2, 4, 8],
                          pro: [2, 4, 8, 10],
                          enterprise: [2, 4, 8, 10, 16],
                          mega: [2, 4, 8, 10, 16, 32],
                        };
                        const allowed = scalesByPlan[plan] || [2, 4, 8];
                        const allowedForQuality = upscaleSettings.quality === 'anime' ? allowed.filter(s => s <= 8) : allowed;
                        return allowedForQuality;
                      })().map((sc) => (
                        <option
                          key={sc}
                          value={sc}
                          disabled={
                            !!imageWidth && !!imageHeight && (imageWidth * sc > 12000 || imageHeight * sc > 12000)
                          }
                          title={
                            !!imageWidth && !!imageHeight && (imageWidth * sc > 12000 || imageHeight * sc > 12000)
                              ? 'Would exceed 12k px limit'
                              : ''
                          }
                        >
                          {sc}x Enhancement
                        </option>
                      ))}
                    </select>
                </div>

                {/* Quality Preset */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quality Preset
                  </label>
                  <select
                    value={upscaleSettings.quality}
                    onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value as Quality })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="photo">Photo (Natural Images)</option>
                    <option value="art">Art & Illustrations</option>
                    <option value="anime">Anime & Cartoons</option>
                    <option value="text">Text & Documents</option>
                  </select>
                </div>

                {/* Output Format */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Output Format
                  </label>
                  <select
                    value={upscaleSettings.outputFormat}
                    onChange={(e) => setUpscaleSettings({ ...upscaleSettings, outputFormat: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="original">Keep Original Format</option>
                    <option value="png">PNG (Lossless)</option>
                    <option value="jpg">JPEG (Smaller Size)</option>
                    <option value="webp">WebP (Modern)</option>
                  </select>
                </div>

                {/* Remaining Upscales (Desktop) */}
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 text-gray-900 dark:text-gray-100" style={{ borderColor: '#FF8C67' }}>
                  <span>{remainingUpscales.toLocaleString()} Remaining</span>
                </div>

                {/* Upscale Button - Aligned to the right */}
                <div className="flex-shrink-0">
                  <button
                    onClick={handleUpscaleImage}
                    disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${
                      (!!currentProcessing || !latestUploadedFile || !isApiConfigured) 
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    <Star className="w-5 h-5" />
                    <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
                  </button>
                </div>
              </div>

              {/* Processing Status */}
              {currentProcessing && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {currentProcessing.currentStep || 'Processing...'}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${currentProcessing.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300 mt-2">
                    <span>{Math.round(currentProcessing.progress)}% Complete</span>
                    {currentProcessing.timeRemaining !== undefined && currentProcessing.timeRemaining > 0 && (
                      <span>{currentProcessing.timeRemaining}s remaining</span>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUploadBox
                image={latestUploadedFile?.imageUrl}
                onImageUpload={onDrop}
                isUpscaledBox={false}
              />
              <ImageUploadBox
                image={latestProcessedImage?.upscaledImage}
                isProcessing={!!currentProcessing}
                isUpscaledBox={true}
              />
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex flex-col space-y-4 md:hidden w-full">
          <ImageUploadBox
            image={latestUploadedFile?.imageUrl}
            onImageUpload={onDrop}
            isUpscaledBox={false}
          />

          {/* Mobile Controls */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scale</label>
                <select
                  value={upscaleSettings.scale}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) as Scale })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                >
                  {(() => {
                    const rawPlan = (userProfile?.subscriptionTier || userProfile?.subscription_tier || userProfile?.subscription_tiers?.name || 'basic');
                    const plan = (typeof rawPlan === 'string' ? rawPlan : 'basic').toLowerCase();
                    const scalesByPlan: Record<string, number[]> = {
                      basic: [2, 4, 8],
                      pro: [2, 4, 8, 10],
                      enterprise: [2, 4, 8, 10, 16],
                      mega: [2, 4, 8, 10, 16, 32],
                    };
                    const allowed = scalesByPlan[plan] || [2, 4, 8];
                    const allowedForQuality = upscaleSettings.quality === 'anime' ? allowed.filter(s => s <= 8) : allowed;
                    return allowedForQuality;
                  })().map((sc) => (
                    <option
                      key={sc}
                      value={sc}
                      disabled={
                        !!imageWidth && !!imageHeight && (imageWidth * sc > 12000 || imageHeight * sc > 12000)
                      }
                      title={
                        !!imageWidth && !!imageHeight && (imageWidth * sc > 12000 || imageHeight * sc > 12000)
                          ? 'Would exceed 12k px limit'
                          : ''
                      }
                    >
                      {sc}x
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quality</label>
                <select
                  value={upscaleSettings.quality}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value as Quality })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark-text-gray-100 py-2 px-3"
                >
                  <option value="photo">Photo</option>
                  <option value="art">Art</option>
                  <option value="anime">Anime</option>
                  <option value="text">Text</option>
                </select>
              </div>
            </div>

            {/* Remaining Upscales (Mobile) */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 text-gray-900 dark:text-gray-100" style={{ borderColor: '#FF8C67' }}>
                <span>{remainingUpscales.toLocaleString()} Remaining</span>
              </div>
            </div>

            <button
              onClick={handleUpscaleImage}
              disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                (!!currentProcessing || !latestUploadedFile || !isApiConfigured) 
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
              }`}
            >
              <Star className="w-5 h-5" />
              <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
            </button>
          </div>

          <ImageUploadBox
            image={latestProcessedImage?.upscaledImage}
            isProcessing={!!currentProcessing}
            isUpscaledBox={true}
          />
        </div>
      </div>
    </>
  );
};

export default ImageUpscaler;
