import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  currentStep?: string;
  originalImage: string;
  upscaledImage?: string;
  originalWidth?: number;
  originalHeight?: number;
  upscaledWidth?: number;
  upscaledHeight?: number;
}

export function ImageComparison() {
  const { processedImages } = useImageProcessing();
  const [selectedImage, setSelectedImage] = useState<ProcessingItem | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (processedImages.length > 0) {
      const latest = processedImages[processedImages.length - 1];
      if (latest.status === 'completed') {
        setSelectedImage(latest);
      }
    }
  }, [processedImages]);

  // Update slider position based on mouse/touch position
  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    updateSliderPosition(e.clientX);
  }, [updateSliderPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    updateSliderPosition(e.clientX);
  }, [updateSliderPosition]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = true;
    updateSliderPosition(e.touches[0].clientX);
  }, [updateSliderPosition]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    updateSliderPosition(e.touches[0].clientX);
  }, [updateSliderPosition]);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Global event listeners for smooth dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const onMouseUp = () => handleMouseUp();
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();

    // Add listeners to document for smooth tracking even outside container
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleDownload = (imageUrl: string, filename: string) => {
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
    <div className="w-[90%] max-w-7xl mx-auto">
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
              onClick={() => selectedImage.upscaledImage && handleDownload(selectedImage.upscaledImage, `upscaled_${selectedImage.file.name}`)}
              disabled={!selectedImage.upscaledImage}
              className="flex items-center space-x-2 px-4 py-2 rounded-md shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))`,
                color: 'var(--on-primary)'
              }}
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Comparison Container */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 cursor-ew-resize select-none touch-none"
          style={{ 
            height: '500px', 
            userSelect: 'none', 
            WebkitUserSelect: 'none',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
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
              src={selectedImage.originalImage}
              alt="Original"
              className="w-full h-full object-contain pointer-events-none select-none"
              style={{ 
                transform: `scale(${zoom / 100})`, 
                userSelect: 'none',
                willChange: 'transform',
              }}
              draggable={false}
            />
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium pointer-events-none">
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
              src={selectedImage.upscaledImage}
              alt="Upscaled"
              className="w-full h-full object-contain pointer-events-none select-none"
              style={{ 
                transform: `scale(${zoom / 100})`, 
                userSelect: 'none',
                willChange: 'transform',
              }}
              draggable={false}
            />
            <div 
              className="absolute top-4 right-4 text-white px-3 py-1 rounded-md text-sm font-medium shadow-md pointer-events-none"
              style={{
                background: `linear-gradient(to right, color-mix(in oklab, var(--primary) 85%, transparent 15%), color-mix(in oklab, var(--secondary) 85%, transparent 15%))`
              }}
            >
              {selectedImage.settings.scale}x Upscaled
            </div>
          </div>

          {/* Slider Line */}
          <div
            className="absolute top-0 bottom-0 w-1 pointer-events-none"
            style={{ 
              left: `${sliderPosition}%`,
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 10px var(--primary), 0 0 20px var(--secondary)',
            }}
          >
            {/* Slider Handle */}
            <div 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-xl pointer-events-auto cursor-ew-resize flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                border: '3px solid white',
                boxShadow: '0 0 20px var(--primary), 0 4px 15px rgba(0,0,0,0.3)',
              }}
            >
              {/* Arrows icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M8 12L4 8M4 8L8 4M4 8H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 12L20 16M20 16L16 20M20 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Upscaled Image</h4>
            <p className="text-gray-600 dark:text-gray-300">Size: {selectedImage.upscaledWidth} × {selectedImage.upscaledHeight}px</p>
            <p className="text-gray-600 dark:text-gray-300">Enhancement: {selectedImage.settings.quality} preset</p>
          </div>
        </div>
      </div>
    </div>
  );
}
