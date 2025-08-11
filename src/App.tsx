import React, { useState, useCallback } from 'react';
import { useImageProcessing } from '../src/contexts/ImageProcessingContext';
import { edgeFunctionService } from '../src/services/edgeFunctionService';
import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

// Helper component for the image display boxes.
const ImageUploadBox = ({ label, image, onImageUpload, isProcessing = false }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onImageUpload,
    multiple: false,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    disabled: label === "Upscaled Image"
  });

  return (
    <div
      {...getRootProps()}
      className={`bg-gray-700 rounded-lg p-4 shadow-inner min-h-[300px] flex flex-col items-center justify-center relative border-2 border-dashed border-gray-600 transition-colors ${
        label === "Upscaled Image" ? 'cursor-default' : 'hover:border-blue-500 cursor-pointer'
      }`}
    >
      <input {...getInputProps()} />
      <label className="text-gray-400 text-sm font-medium absolute top-2 left-2">{label}</label>
      {image ? (
        <img src={image} alt={label} className="max-h-full max-w-full object-contain rounded-md" />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          {label === "Upscaled Image" ? (
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl text-gray-400">✨</span>
            </div>
          ) : (
            <Upload className="w-16 h-16 text-gray-500 mb-4" />
          )}
          <span className="text-gray-400">
            {label === "Upscaled Image" ? (
              isProcessing ? 'Processing...' : 'Upscaled image will appear here'
            ) : (
              isDragActive ? 'Drop the image here ...' : 'Click to upload or drag & drop'
            )}
          </span>
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
    currentProcessing,
    latestUploadedFile,
    latestProcessedImage,
    isApiConfigured,
    uploadImage,
    processImage,
    downloadImage
  } = useImageProcessing();

  const [upscaleSettings, setUpscaleSettings] = useState({
    scale: 2,
    quality: 'photo',
    outputFormat: 'original'
  });

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      uploadImage(acceptedFiles[0]);
    }
  }, [uploadImage]);

  const handleUpscaleImage = useCallback(() => {
    if (latestUploadedFile && !currentProcessing) {
      processImage(latestUploadedFile.id, upscaleSettings);
    }
  }, [latestUploadedFile, currentProcessing, processImage, upscaleSettings]);

  return (
    <>
      <div className="w-full max-w-7xl mx-auto">
        {/* Main content area */}
        <div className="hidden md:flex flex-col space-y-6">
          <div className="flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ImageUploadBox
                  label="Original or Upload Image"
                  image={latestUploadedFile?.previewUrl}
                  onImageUpload={onDrop}
                />
                <ImageUploadBox
                  label="Upscaled Image"
                  image={latestProcessedImage?.processedUrl}
                  onImageUpload={onDrop}
                  isProcessing={currentProcessing}
                />
              </div>
            </div>
          </div>
          {/* Main Title - positioned below header */}
          <div className="text-center mb-8 -mt-20 pt-5 md:-mt-12 md:pt-4">
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageUpscaler;