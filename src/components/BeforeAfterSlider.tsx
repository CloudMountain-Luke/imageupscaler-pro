import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImagePair {
  before: string;
  after: string;
  scale: string; // e.g., "2x", "4x", "8x", "24x"
  type: string; // e.g., "Photos", "Art & Illustration", "Anime & Cartoons"
  degradationType?: 'blur' | 'pixelated-subtle' | 'jpeg-artifacts' | 'noise';
}

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  autoPlay?: boolean;
  autoPlaySpeed?: number; // seconds for full sweep
  className?: string;
  // For image rotation
  images?: ImagePair[];
  imageRotationInterval?: number; // seconds between image changes
}

// Calculate stats based on scale
const getStatsForScale = (scale: string) => {
  const scaleNum = parseInt(scale.replace('x', ''));
  // Base resolution that gets upscaled
  const baseRes = 480;
  const afterRes = baseRes * scaleNum;
  
  return {
    before: `${baseRes}px`,
    after: `${afterRes.toLocaleString()}px`,
    scale: scale,
  };
};

/**
 * Before/After image comparison slider
 * Auto-animates but stops when user interacts, allowing manual control
 * Supports rotating through multiple image pairs with different degradation effects
 */
export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Original',
  afterLabel = 'Enhanced',
  autoPlay = true,
  autoPlaySpeed = 4,
  className = '',
  images,
  imageRotationInterval = 9
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('left');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pixelatedImages, setPixelatedImages] = useState<Record<number, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const imageRotationRef = useRef<NodeJS.Timeout | null>(null);

  // Get current image data
  const currentImage = images && images.length > 0 ? images[currentImageIndex] : null;
  const currentAfter = currentImage ? currentImage.after : afterImage;
  const currentScale = currentImage ? currentImage.scale : '24x';
  const currentType = currentImage ? currentImage.type : 'Photos';
  const currentDegradation = currentImage?.degradationType || 'noise';
  const currentStats = getStatsForScale(currentScale);

  // Create subtly pixelated version of image using canvas (realistic low-res look)
  useEffect(() => {
    if (!images) return;

    images.forEach((img, index) => {
      if (img.degradationType === 'pixelated-subtle') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          // Subtle pixelation - only 3x downscale for realistic low-res look
          const pixelSize = 3;
          
          const smallWidth = Math.floor(image.width / pixelSize);
          const smallHeight = Math.floor(image.height / pixelSize);
          
          canvas.width = smallWidth;
          canvas.height = smallHeight;
          
          // Draw small with smoothing OFF
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 0, 0, smallWidth, smallHeight);
          
          // Create second canvas at full size
          const canvas2 = document.createElement('canvas');
          const ctx2 = canvas2.getContext('2d');
          if (!ctx2) return;
          
          canvas2.width = image.width;
          canvas2.height = image.height;
          // Use bilinear interpolation for softer upscale (more realistic)
          ctx2.imageSmoothingEnabled = true;
          ctx2.imageSmoothingQuality = 'low';
          ctx2.drawImage(canvas, 0, 0, image.width, image.height);
          
          setPixelatedImages(prev => ({
            ...prev,
            [index]: canvas2.toDataURL('image/jpeg', 0.85)
          }));
        };
        image.src = img.after;
      }
    });
  }, [images]);

  // Get the before image (pixelated or original with filter)
  const getBeforeImage = () => {
    if (currentImage && currentDegradation === 'pixelated-subtle') {
      return pixelatedImages[currentImageIndex] || currentAfter;
    }
    return currentAfter;
  };

  // Get degradation filter style - noticeable but believable effects
  const getDegradationFilter = () => {
    switch (currentDegradation) {
      case 'blur':
        // Soft focus - moderate blur, not too extreme
        return 'blur(1.5px) saturate(0.88) brightness(0.93)';
      case 'pixelated-subtle':
        // Low resolution look - slight softness
        return 'blur(0.6px) saturate(0.9) brightness(0.94) contrast(0.96)';
      case 'jpeg-artifacts':
        // JPEG compression - very noticeable with blur, color loss, contrast boost
        return 'blur(1.2px) saturate(0.65) brightness(0.85) contrast(1.18)';
      case 'noise':
      default:
        // General low quality - soft with grain
        return 'blur(1px) saturate(0.85) brightness(0.92)';
    }
  };

  // Image rotation effect - pauses when animation is paused
  useEffect(() => {
    if (!images || images.length <= 1 || !isAutoPlaying) {
      if (imageRotationRef.current) {
        clearInterval(imageRotationRef.current);
        imageRotationRef.current = null;
      }
      return;
    }

    imageRotationRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, imageRotationInterval * 1000);

    return () => {
      if (imageRotationRef.current) {
        clearInterval(imageRotationRef.current);
      }
    };
  }, [images, imageRotationInterval, isAutoPlaying]);

  // Auto-play animation
  useEffect(() => {
    if (!isAutoPlaying || isDragging) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const movePerMs = 100 / (autoPlaySpeed * 1000);
      const movement = movePerMs * deltaTime;

      setSliderPosition((prev) => {
        let newPos = prev;
        if (animationDirection === 'left') {
          newPos = prev - movement;
          if (newPos <= 5) {
            setAnimationDirection('right');
            return 5;
          }
        } else {
          newPos = prev + movement;
          if (newPos >= 95) {
            setAnimationDirection('left');
            return 95;
          }
        }
        return newPos;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAutoPlaying, isDragging, animationDirection, autoPlaySpeed]);

  const handleInteractionStart = useCallback(() => {
    setIsDragging(true);
    setIsAutoPlaying(false);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    updateSliderPosition(e.clientX);
  }, [isDragging, updateSliderPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    updateSliderPosition(e.touches[0].clientX);
  }, [isDragging, updateSliderPosition]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    setIsAutoPlaying(false);
    updateSliderPosition(e.clientX);
  }, [updateSliderPosition]);

  const resumeAutoPlay = useCallback(() => {
    setIsAutoPlaying(true);
    setSliderPosition(50);
    setAnimationDirection('left');
  }, []);

  const pauseAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
  }, []);

  const beforeImageSrc = getBeforeImage();

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl cursor-ew-resize select-none"
        style={{ aspectRatio: '16/10' }}
        onMouseDown={handleInteractionStart}
        onMouseUp={handleInteractionEnd}
        onMouseLeave={handleInteractionEnd}
        onMouseMove={handleMouseMove}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
        onTouchMove={handleTouchMove}
        onClick={handleClick}
      >
        {/* After Image (full, bottom layer) - the "enhanced" version */}
        <div className="absolute inset-0">
          <img
            src={currentAfter}
            alt={afterLabel}
            className="w-full h-full object-cover transition-opacity duration-700"
            style={{
              filter: 'saturate(1.05) contrast(1.02)',
            }}
            draggable={false}
          />
        </div>

        {/* Before Image (clipped, top layer) - with degradation */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          }}
        >
          <img
            src={beforeImageSrc}
            alt={beforeLabel}
            className="w-full h-full object-cover transition-opacity duration-700"
            style={{
              filter: getDegradationFilter(),
            }}
            draggable={false}
          />
          {/* Visible noise/artifact overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: currentDegradation === 'jpeg-artifacts' 
                ? 0.35 
                : currentDegradation === 'noise' 
                  ? 0.22 
                  : currentDegradation === 'blur'
                    ? 0.12
                    : 0.15,
              backgroundImage: currentDegradation === 'jpeg-artifacts' 
                ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.25' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`
                : `url("data:image/svg+xml,%3Csvg viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              mixBlendMode: 'overlay',
            }}
          />
          {/* Additional color banding for JPEG artifacts */}
          {currentDegradation === 'jpeg-artifacts' && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, transparent 2px, transparent 8px)',
                mixBlendMode: 'multiply',
              }}
            />
          )}
        </div>

        {/* Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 z-10 pointer-events-none"
          style={{ 
            left: `${sliderPosition}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 20px var(--primary), 0 0 40px var(--secondary)',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 30px var(--primary), 0 4px 20px rgba(0,0,0,0.4)',
              border: '3px solid white',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M8 12L4 8M4 8L8 4M4 8H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 12L20 16M20 16L16 20M20 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div
          className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md transition-all duration-300"
          style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            opacity: sliderPosition > 15 ? 1 : 0,
          }}
        >
          {beforeLabel}
        </div>

        <div
          className="absolute top-4 right-4 flex flex-col items-end gap-1 transition-all duration-300"
          style={{ opacity: sliderPosition < 85 ? 1 : 0 }}
        >
          <div
            className="px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
              boxShadow: '0 0 20px color-mix(in oklab, var(--primary) 50%, transparent 50%)',
            }}
          >
            Enhanced {currentScale}
          </div>
          <div
            className="px-2 py-1 rounded text-xs font-medium backdrop-blur-md"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {currentType}
          </div>
        </div>

        {/* Dynamic Stats Overlay */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md"
          style={{ background: 'rgba(0,0,0,0.8)' }}
        >
          <span className="text-gray-400 text-sm font-mono line-through">{currentStats.before}</span>
          <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>→</span>
          <span className="text-white text-sm font-mono font-medium">{currentStats.after}</span>
          <span
            className="px-2.5 py-1 rounded text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
              boxShadow: '0 0 15px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
            }}
          >
            {currentScale}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {isAutoPlaying ? 'Auto-playing' : 'Drag to compare'}
        </p>
        {isAutoPlaying ? (
          <button
            onClick={pauseAutoPlay}
            className="text-sm px-3 py-1 rounded-full transition-all duration-300 hover:scale-105"
            style={{
              background: 'color-mix(in oklab, var(--primary) 20%, transparent 80%)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
            }}
          >
            Pause animation
          </button>
        ) : (
          <button
            onClick={resumeAutoPlay}
            className="text-sm px-3 py-1 rounded-full transition-all duration-300 hover:scale-105"
            style={{
              background: 'color-mix(in oklab, var(--primary) 20%, transparent 80%)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
            }}
          >
            Resume animation
          </button>
        )}
      </div>
      
      {/* Disclaimer */}
      <p 
        className="text-center text-xs mt-3 max-w-md mx-auto"
        style={{ color: 'var(--muted)', opacity: 0.7 }}
      >
        *Results shown are for demonstration purposes. Actual enhancement quality varies based on source image.
      </p>
    </div>
  );
}

export default BeforeAfterSlider;
