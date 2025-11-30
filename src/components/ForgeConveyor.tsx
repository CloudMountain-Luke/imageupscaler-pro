import { useState, useEffect, useMemo } from 'react';

interface ForgeConveyorProps {
  className?: string;
}

// Sample images to cycle through the conveyor
const conveyorImages = [
  '/images/woman-portrait_1-1.webp',
  '/images/aurora-mountains.webp',
  '/images/abstract-eye_opt.webp',
  '/images/man-portrait_1-1_sm.webp',
  '/images/ocean-waves-sunset.webp',
  '/images/colorful-anime_1-1_sm.webp',
];

/**
 * Forge Conveyor Belt Animation
 * 
 * Shows images being "processed" through a forge:
 * - Images enter pixelated/blurry from the left
 * - A diagonal sweep reveals the sharp version
 * - Images exit to the right, enhanced
 * 
 * Responsive:
 * - Mobile: 1 image visible (processing)
 * - Tablet: 3 images visible (waiting, processing, done)
 * 
 * Uses CSS-only animations for performance
 */
export function ForgeConveyor({ className = '' }: ForgeConveyorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Cycle through images
  useEffect(() => {
    if (!isAnimating) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % conveyorImages.length);
    }, 6000); // 6 seconds per image cycle
    
    return () => clearInterval(interval);
  }, [isAnimating]);
  
  // Get visible images based on current index
  const visibleImages = useMemo(() => {
    const images = [];
    for (let i = -2; i <= 2; i++) {
      const idx = (currentIndex + i + conveyorImages.length) % conveyorImages.length;
      images.push({
        src: conveyorImages[idx],
        position: i, // -2, -1, 0, 1, 2 (0 = center/processing)
      });
    }
    return images;
  }, [currentIndex]);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  if (prefersReducedMotion) {
    // Show static version for users who prefer reduced motion
    return (
      <div className={`absolute inset-0 flex items-center justify-center ${className}`}>
        <div className="w-32 h-32 rounded-xl overflow-hidden shadow-2xl">
          <img 
            src={conveyorImages[0]} 
            alt="Sample upscaled image"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Forge Silhouette Background - inspired by logo shape */}
      <div className="absolute inset-0 flex items-end justify-center pb-8 opacity-20">
        <svg
          viewBox="0 0 200 160"
          className="w-64 h-52 md:w-80 md:h-64"
          style={{ filter: 'blur(1px)' }}
        >
          {/* Shield/badge shape from logo */}
          <path
            d="M20 20 
               Q20 10 30 10 
               L170 10 
               Q180 10 180 20 
               L180 110 
               Q180 130 160 140 
               L110 155 
               Q100 158 90 155 
               L40 140 
               Q20 130 20 110 
               Z"
            fill="none"
            stroke="url(#forgeGradient)"
            strokeWidth="4"
            className="animate-pulse"
          />
          {/* Flame shape on top */}
          <path
            d="M100 0 
               Q115 20 110 40 
               Q120 30 115 50 
               Q130 35 120 60 
               Q125 55 118 70 
               Q110 85 100 75 
               Q90 85 82 70 
               Q75 55 80 60 
               Q70 35 85 50 
               Q80 30 90 40 
               Q85 20 100 0"
            fill="url(#flameGradient)"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="forgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--secondary)" />
            </linearGradient>
            <linearGradient id="flameGradient" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="50%" stopColor="var(--secondary)" />
              <stop offset="100%" stopColor="#ffcc00" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Conveyor Track */}
      <div 
        className="absolute left-0 right-0 h-1 top-1/2 -translate-y-1/2"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)',
        }}
      />
      
      {/* Processing Zone Glow */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 md:w-44 md:h-44 rounded-2xl"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--primary) 30%, transparent 70%) 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />

      {/* Conveyor Images */}
      <div className="absolute inset-0 flex items-center justify-center">
        {visibleImages.map((image, idx) => {
          const isProcessing = image.position === 0;
          const isPast = image.position > 0;
          const isFuture = image.position < 0;
          
          // Calculate position offset
          const xOffset = image.position * 140; // 140px between images
          
          // Visibility based on screen size
          // Mobile: only show position 0
          // Tablet: show positions -1, 0, 1
          let visibilityClass = '';
          if (Math.abs(image.position) > 1) {
            visibilityClass = 'hidden lg:block'; // Only show on lg+ for positions -2, 2
          } else if (Math.abs(image.position) === 1) {
            visibilityClass = 'hidden md:block'; // Show on md+ for positions -1, 1
          }
          
          return (
            <div
              key={`${image.src}-${idx}`}
              className={`absolute transition-all duration-1000 ease-in-out ${visibilityClass}`}
              style={{
                transform: `translateX(${xOffset}px)`,
                zIndex: isProcessing ? 20 : 10,
              }}
            >
              {/* Image Container */}
              <div 
                className={`relative rounded-xl overflow-hidden shadow-2xl transition-all duration-500 ${
                  isProcessing 
                    ? 'w-28 h-28 md:w-36 md:h-36' 
                    : 'w-20 h-20 md:w-28 md:h-28'
                }`}
                style={{
                  boxShadow: isProcessing 
                    ? '0 0 40px color-mix(in oklab, var(--primary) 50%, transparent 50%), 0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    : '0 10px 30px rgba(0, 0, 0, 0.4)',
                }}
              >
                {/* Pixelated/Blurry Layer (for incoming images) */}
                <img
                  src={image.src}
                  alt="Processing"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    filter: isFuture || isProcessing ? 'blur(3px) saturate(0.7) brightness(0.8)' : 'none',
                    imageRendering: isFuture ? 'pixelated' : 'auto',
                    opacity: isPast ? 0 : 1,
                    transition: 'opacity 0.5s ease-out',
                  }}
                />
                
                {/* Sharp Layer (revealed by clip-path) */}
                <img
                  src={image.src}
                  alt="Enhanced"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    clipPath: isProcessing 
                      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' // Fully visible when processing complete
                      : isPast 
                        ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' // Fully visible after processing
                        : 'polygon(0 0, 0 0, 0 100%, 0 100%)', // Hidden before processing
                    animation: isProcessing ? 'revealSweep 3s ease-in-out forwards' : 'none',
                  }}
                />
                
                {/* Processing Indicator */}
                {isProcessing && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      animation: 'fadeOut 3s ease-in-out forwards',
                    }}
                  >
                    <div 
                      className="w-8 h-8 border-2 border-t-transparent rounded-full"
                      style={{
                        borderColor: 'var(--primary)',
                        borderTopColor: 'transparent',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  </div>
                )}
                
                {/* Status Labels */}
                <div 
                  className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-medium px-1 py-0.5 rounded"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    color: isProcessing ? 'var(--primary)' : isPast ? '#22c55e' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {isProcessing ? 'Upscaling...' : isPast ? 'Enhanced' : 'Queued'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline Keyframes */}
      <style>{`
        @keyframes revealSweep {
          0% {
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
          }
          20% {
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
          }
          80% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          }
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          }
        }
        
        @keyframes fadeOut {
          0% { opacity: 1; }
          60% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export default ForgeConveyor;

