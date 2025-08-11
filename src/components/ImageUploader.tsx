import React, { useState, useCallback } from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { edgeFunctionService } from '../services/edgeFunctionService';
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
        {/* Desktop-only: This section contains the side-by-side layout */}
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
                  image={latestProcessedImage?.previewUrl}
                  isProcessing={!!currentProcessing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only: This section contains the stacked layout */}
        <div className="flex flex-col space-y-4 md:hidden w-full">
          <ImageUploadBox
            label="Original or Upload Image"
            image={latestUploadedFile?.previewUrl}
            onImageUpload={onDrop}
          />

          {/* Controls section for mobile */}
          <div className="flex flex-col space-y-4">
            {/* Scale Factor Dropdown */}
            <div className="w-full">
              <label htmlFor="scale-factor-mobile" className="block text-sm font-medium text-gray-400 mb-1">Scale Factor</label>
              <select
                id="scale-factor-mobile"
                value={upscaleSettings.scale}
                onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) })}
                className="w-full rounded-md bg-gray-700 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>2x</option>
                <option value={4}>4x</option>
                <option value={8}>8x</option>
              </select>
            </div>

            {/* Quality Preset Dropdown */}
            <div className="w-full">
              <label htmlFor="quality-preset-mobile" className="block text-sm font-medium text-gray-400 mb-1">Quality Preset</label>
              <select
                id="quality-preset-mobile"
                value={upscaleSettings.quality}
                onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value })}
                className="w-full rounded-md bg-gray-700 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="photo">Photo</option>
                <option value="art">Art</option>
              </select>
            </div>

            {/* Output Format Dropdown */}
            <div className="w-full">
              <label htmlFor="output-format-mobile" className="block text-sm font-medium text-gray-400 mb-1">Output Format</label>
              <select
                id="output-format-mobile"
                value={upscaleSettings.outputFormat}
                onChange={(e) => setUpscaleSettings({ ...upscaleSettings, outputFormat: e.target.value })}
                className="w-full rounded-md bg-gray-700 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUPPORTED_FORMATS.map(format => (
                  <option key={format} value={format}>{format.toUpperCase()}</option>
                ))}
                <option value="original">Original</option>
              </select>
            </div>
          </div>

          {/* Upscale Image Button for mobile */}
          <button
            onClick={handleUpscaleImage}
            disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
            className={`w-full px-6 py-2 rounded-md font-semibold transition-colors duration-200
              ${(!!currentProcessing || !latestUploadedFile || !isApiConfigured) ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Sparkles className="inline-block mr-2" size={16} />
            {currentProcessing ? 'Upscaling...' : 'Upscale Image'}
          </button>

          <ImageUploadBox
            label="Upscaled Image"
            image={latestProcessedImage?.previewUrl}
            isProcessing={!!currentProcessing}
          />
        </div>
      </div>
    </>
  );
};

export default ImageUpscaler;