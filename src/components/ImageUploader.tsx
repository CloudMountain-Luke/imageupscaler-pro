import React, { useState, useCallback } from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { edgeFunctionService } from '../services/edgeFunctionService';
import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus, Settings } from 'lucide-react';
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
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUploadBox
                label="Original Image"
                image={latestUploadedFile?.imageUrl}
                onImageUpload={onDrop}
              />
              <ImageUploadBox
                label="Upscaled Image"
                image={latestProcessedImage?.upscaledImage}
                isProcessing={!!currentProcessing}
              />
            </div>
          </div>

          {/* Controls Panel */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h3>
              </div>
              
              {/* Scale Factor */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scale Factor
                </label>
                <select
                  value={upscaleSettings.scale}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2}>2x Enhancement</option>
                  <option value={4}>4x Enhancement</option>
                  <option value={8}>8x Enhancement</option>
                </select>
              </div>

              {/* Quality Preset */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quality Preset
                </label>
                <select
                  value={upscaleSettings.quality}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="photo">Photo (Natural Images)</option>
                  <option value="art">Art & Illustrations</option>
                  <option value="anime">Anime & Cartoons</option>
                  <option value="text">Text & Documents</option>
                </select>
              </div>

              {/* Output Format */}
              <div className="mb-6">
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

              {/* Upscale Button */}
              <button
                onClick={handleUpscaleImage}
                disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                  (!!currentProcessing || !latestUploadedFile || !isApiConfigured) 
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
              </button>

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

              {/* API Status */}
              {isApiConfigured ? (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      AI Upscaling Ready
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      AI Service Not Configured
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex flex-col space-y-4 md:hidden w-full">
          <ImageUploadBox
            label="Original Image"
            image={latestUploadedFile?.imageUrl}
            onImageUpload={onDrop}
          />

          {/* Mobile Controls */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scale</label>
                <select
                  value={upscaleSettings.scale}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                >
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                  <option value={8}>8x</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quality</label>
                <select
                  value={upscaleSettings.quality}
                  onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                >
                  <option value="photo">Photo</option>
                  <option value="art">Art</option>
                  <option value="anime">Anime</option>
                </select>
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
              <Sparkles className="w-5 h-5" />
              <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
            </button>
          </div>

          <ImageUploadBox
            label="Upscaled Image"
            image={latestProcessedImage?.upscaledImage}
            isProcessing={!!currentProcessing}
          />
        </div>
      </div>
    </>
  );
};

export default ImageUpscaler;