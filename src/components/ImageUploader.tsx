import { useCallback } from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { Clock, UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import GlassCard from './GlassCard';

// const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
// const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

// Helper component for the image display boxes.
const ImageUploadBox = ({
  image,
  onImageUpload,
  isProcessing = false,
  isUpscaledBox = false,
  className = '',
}: {
  image: string | undefined;
  onImageUpload?: (files: File[]) => void;
  isProcessing?: boolean;
  isUpscaledBox?: boolean;
  className?: string;
}) => {
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
      className={`rounded-xl p-5 shadow-inner flex flex-col items-center justify-center relative border transition-colors w-full h-full min-h-[360px] ${className} ${
        isUpscaledBox ? 'cursor-default' : 'cursor-pointer'
      }`}
      style={{
        background: 'color-mix(in oklab, var(--elev) 90%, transparent 10%)',
        borderColor: 'var(--border)'
      }}
    >
      <input {...getInputProps()} />
      {image ? (
        <img src={image} alt="Image" className="max-h-full max-w-full object-contain rounded-md" />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          {isUpscaledBox ? (
            <>
              <span className="text-4xl mb-4 text-amber-300">✨</span>
              <span className="text-lg" style={{ color: 'var(--text)' }}>
                Upscaled image will appear here
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-16 h-16 mb-4" style={{ color: 'var(--muted)' }} />
              <div className="text-center">
                <div className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Upload Images</div>
                <div className="mb-2" style={{ color: 'var(--text)' }}>Click or drag images here</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>JPEG, PNG, WebP • Max 25MB</div>
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
    addUploadedFile
  } = useImageProcessing();

  // Get the latest uploaded file and processed image
  const latestUploadedFile = uploadedFiles.length > 0
    ? uploadedFiles[uploadedFiles.length - 1]
    : null;
  const latestProcessedImage =
    processedImages.find(img => img.status === 'completed') ?? null;
  const currentProcessingItem =
    processQueue.find(item => item.status === 'processing') ?? null;



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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 h-full flex flex-col justify-center">
      {/* Processing Status */}
      {currentProcessingItem && (
        <GlassCard glow={true}>
          <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-700/60">
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span className="text-sm font-medium text-cyan-200">
                {currentProcessingItem.currentStep || 'Processing...'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentProcessingItem.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>{Math.round(currentProcessingItem.progress)}% Complete</span>
              {currentProcessingItem.timeRemaining !== undefined && currentProcessingItem.timeRemaining > 0 && (
                <span>{currentProcessingItem.timeRemaining}s remaining</span>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Images Container */}
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start -translate-y-5">
        <div className="w-full">
          <ImageUploadBox
            image={latestUploadedFile?.imageUrl}
            onImageUpload={onDrop}
            isUpscaledBox={false}
            className="aspect-[4/3]"
          />
        </div>
        
        <div className="w-full">
          <ImageUploadBox
            image={latestProcessedImage?.upscaledImage}
            isProcessing={!!currentProcessingItem}
            isUpscaledBox={true}
            className="aspect-[4/3]"
          />
        </div>
      </div>
    </div>
  );
};

export default ImageUpscaler;
