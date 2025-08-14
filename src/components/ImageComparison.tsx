import React, { useState, useRef, useEffect } from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export function ImageComparison() {
  const { processedImages } = useImageProcessing();
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (processedImages.length > 0) {
      const latest = processedImages[processedImages.length - 1];
      if (latest.status === 'completed') {
        setSelectedImage(latest);
      }
    }
  }, [processedImages]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleMouseMove(e);
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isDragging.current) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const handleDownload = (imageUrl: string, filename: string) => {
    // Use fetch to download the image and create a blob URL to avoid CORS issues
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Download failed:', error);
        // Fallback: open in new tab
        window.open(imageUrl, '_blank');
      });
  };

  if (!selectedImage) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-8 text-center border border-gray-200/50 dark:border-gray-700/50">
        <div className="text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No processed images yet</p>
          <p className="text-sm mt-2">Upload and process an image to see the comparison</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Before & After Comparison</h3>
        
        <div className="flex items-center space-x-3">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <span className="text-sm font-medium min-w-[50px] text-center text-gray-900 dark:text-gray-100">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={() => handleDownload(selectedImage.upscaledImage, `upscaled_${selectedImage.file.name}`)}
            className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-all duration-200" style={{background: 'linear-gradient(to right, #FF8C67, #98D738)'}}
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Comparison Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 cursor-col-resize"
        style={{ height: '500px' }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseUp}
      >
        {/* Original Image */}
        <div 
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          }}
        >
          <img
            src={selectedImage.originalImage}
            alt="Original"
            className="w-full h-full object-contain"
            style={{ transform: `scale(${zoom / 100})` }}
            draggable={false}
          />
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">
            Original
          </div>
        </div>

        {/* Upscaled Image */}
        <div 
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 0 0 ${sliderPosition}%)`,
          }}
        >
          <img
            src={selectedImage.upscaledImage}
            alt="Upscaled"
            className="w-full h-full object-contain"
            style={{ transform: `scale(${zoom / 100})` }}
            draggable={false}
          />
          <div className="absolute top-4 right-4 text-white px-3 py-1 rounded-lg text-sm font-medium" style={{background: 'linear-gradient(to right, #0082CA, #98D738)'}}>
            {selectedImage.settings.scale}x Upscaled
          </div>
        </div>

        {/* Slider Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Slider Handle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-gray-300 pointer-events-auto cursor-col-resize">
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-orange-500 rounded-full scale-75"></div>
          </div>
        </div>
      </div>

      {/* Image Info */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Original Image</h4>
          <p className="text-gray-600 dark:text-gray-300">Size: {selectedImage.originalWidth} × {selectedImage.originalHeight}px</p>
          <p className="text-gray-600 dark:text-gray-300">File Size: {(selectedImage.file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:bg-gray-700 rounded-lg p-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Upscaled Image</h4>
          <p className="text-gray-600 dark:text-gray-300">Size: {selectedImage.upscaledWidth} × {selectedImage.upscaledHeight}px</p>
          <p className="text-gray-600 dark:text-gray-300">Enhancement: {selectedImage.settings.quality} preset</p>
        </div>
      </div>
    </div>
  );
}