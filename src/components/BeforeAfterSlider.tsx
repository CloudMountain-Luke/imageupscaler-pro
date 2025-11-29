import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImagePair {
  before: string;
  after: string;
  scale: string; // e.g., "2x", "4x", "8x", "24x"
  type: string; // e.g., "Photos", "Art & Illustration", "Anime & Cartoons"
  degradationType?: 'blur' | 'pixelated' | 'jpeg-artifacts' | 'noise';
}

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  stats?: {
    before: string;
    after: string;
    scale: string;
  };
  autoPlay?: boolean;
  autoPlaySpeed?: number; // seconds for full sweep
  className?: string;
  // For image rotation
  images?: ImagePair[];
  imageRotationInterval?: number; // seconds between image changes
}

// Different degradation effects for the "before" image
const getDegradationStyle = (type?: 'blur' | 'pixelated' | 'jpeg-artifacts' | 'noise') => {
  switch (type) {
    case 'blur':
      return {
        filter: 'blur(2px) saturate(0.7) brightness(0.85)',
        overlayOpacity: 0.05,
      };
    case 'pixelated':
      return {
        filter: 'saturate(0.75) brightness(0.9) contrast(0.95)',
        overlayOpacity: 0.25,
        imageRendering: 'pixelated' as const,
      };
    case 'jpeg-artifacts':
      return {
        filter: 'saturate(0.8) brightness(0.88) contrast(1.1)',
        overlayOpacity: 0.2,
      };
    case 'noise':
    default:
      return {
        filter: 'blur(1px) saturate(0.8) brightness(0.9)',
        overlayOpacity: 0.15,
      };
  }
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
  stats,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const imageRotationRef = useRef<NodeJS.Timeout | null>(null);

  // Get current image data
  const currentImage = images && images.length > 0 ? images[currentImageIndex] : null;
  const currentBefore = currentImage ? currentImage.before : beforeImage;
  const currentAfter = currentImage ? currentImage.after : afterImage;
  const currentScale = currentImage ? currentImage.scale : '24x';
  const currentType = currentImage ? currentImage.type : 'Photos';
  const currentDegradation = currentImage?.degradationType || 'noise';
  const degradationStyle = getDegradationStyle(currentDegradation);

  // Image rotation effect
  useEffect(() => {
    if (!images || images.length <= 1) return;

    // Clear existing timer
    if (imageRotationRef.current) {
      clearInterval(imageRotationRef.current);
    }

    // Set up rotation timer
    imageRotationRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, imageRotationInterval * 1000);

    return () => {
      if (imageRotationRef.current) {
        clearInterval(imageRotationRef.current);
      }
    };
  }, [images, imageRotationInterval]);

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

      // Calculate movement per frame (full sweep in autoPlaySpeed seconds)
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

  // Handle mouse/touch interactions
  const handleInteractionStart = useCallback(() => {
    setIsDragging(true);
    setIsAutoPlaying(false); // Stop auto-play when user interacts
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

  // Resume auto-play button
  const resumeAutoPlay = useCallback(() => {
    setIsAutoPlaying(true);
    setSliderPosition(50);
    setAnimationDirection('left');
  }, []);

  // Pause auto-play button
  const pauseAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
  }, []);

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

        {/* Before Image (clipped, top layer) - with degradation effect */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={currentAfter} // Use same image but with degradation filter
            alt={beforeLabel}
            className="w-full h-full object-cover transition-opacity duration-700"
            style={{
              filter: degradationStyle.filter,
              imageRendering: degradationStyle.imageRendering,
            }}
            draggable={false}
          />
          {/* Noise/artifact overlay for low-quality effect */}
          <div
            className="absolute inset-0"
            style={{
              opacity: degradationStyle.overlayOpacity,
              backgroundImage: currentDegradation === 'jpeg-artifacts' 
                ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`
                : currentDegradation === 'pixelated'
                ? `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 4px),
                   repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 4px)`
                : `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        {/* Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 -ml-0.5 z-10"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Glowing line */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 20px var(--primary), 0 0 40px var(--secondary)',
            }}
          />
          
          {/* Handle circle */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 30px var(--primary), 0 4px 20px rgba(0,0,0,0.4)',
              border: '3px solid white',
            }}
          >
            {/* Arrows */}
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
          style={{
            opacity: sliderPosition < 85 ? 1 : 0,
          }}
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

        {/* Stats Overlay */}
        {stats && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md"
            style={{
              background: 'rgba(0,0,0,0.8)',
            }}
          >
            <span className="text-gray-400 text-sm font-mono line-through">{stats.before}</span>
            <span
              className="text-xl font-bold"
              style={{ color: 'var(--primary)' }}
            >
              →
            </span>
            <span className="text-white text-sm font-mono font-medium">{stats.after}</span>
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
        )}
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
    </div>
  );
}

export default BeforeAfterSlider;
