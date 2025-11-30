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
 * - Desktop: 5 images visible (full queue)
 * 
 * Uses CSS-only animations for performance
 */
export function ForgeConveyor({ className = '' }: ForgeConveyorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setIsAnimating] = useState(true);
  
  // Cycle through images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % conveyorImages.length);
    }, 5000); // 5 seconds per image cycle
    
    return () => clearInterval(interval);
  }, []);
  
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
      <div className={`flex items-center justify-center py-8 ${className}`}>
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
    <div className={`relative w-full py-6 overflow-hidden ${className}`}>
      {/* Conveyor Track - subtle line */}
      <div 
        className="absolute left-0 right-0 h-px top-1/2 -translate-y-1/2 z-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 80%, transparent 100%)',
        }}
      />
      
      {/* Processing Zone Glow - behind center image */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-2xl z-0"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--primary) 25%, transparent 75%) 0%, transparent 70%)',
        }}
      />

      {/* Conveyor Images */}
      <div className="relative flex items-center justify-center h-32 md:h-40 lg:h-48">
        {visibleImages.map((image, idx) => {
          const isProcessing = image.position === 0;
          const isPast = image.position > 0;
          const isFuture = image.position < 0;
          
          // Calculate position offset - responsive spacing
          const baseOffset = 100; // Mobile
          const mdOffset = 130; // Tablet
          const lgOffset = 160; // Desktop
          
          // Visibility based on screen size
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
                // Use CSS custom properties for responsive offset
                transform: `translateX(calc(${image.position} * var(--conveyor-offset, ${baseOffset}px)))`,
                zIndex: isProcessing ? 20 : 10 - Math.abs(image.position),
                // CSS variables for responsive spacing
                ['--conveyor-offset' as string]: `${baseOffset}px`,
              }}
            >
              {/* Image Container */}
              <div 
                className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
                  isProcessing 
                    ? 'w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40' 
                    : 'w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32'
                }`}
                style={{
                  boxShadow: isProcessing 
                    ? '0 0 30px color-mix(in oklab, var(--primary) 40%, transparent 60%), 0 20px 40px -10px rgba(0, 0, 0, 0.5)'
                    : '0 8px 25px rgba(0, 0, 0, 0.4)',
                  opacity: Math.abs(image.position) > 1 ? 0.7 : 1,
                }}
              >
                {/* Pixelated/Blurry Layer (for incoming images) */}
                <img
                  src={image.src}
                  alt="Processing"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    filter: isFuture ? 'blur(2px) saturate(0.7) brightness(0.85)' : 'none',
                    opacity: isPast ? 0 : 1,
                    transition: 'opacity 0.5s ease-out, filter 0.5s ease-out',
                  }}
                />
                
                {/* Sharp Layer (revealed by clip-path animation) */}
                <img
                  src={image.src}
                  alt="Enhanced"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    clipPath: isPast 
                      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' 
                      : isFuture
                        ? 'polygon(0 0, 0 0, 0 100%, 0 100%)'
                        : undefined,
                    animation: isProcessing ? 'revealSweep 3s ease-in-out forwards' : 'none',
                  }}
                />
                
                {/* Processing Indicator - only on center image */}
                {isProcessing && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      animation: 'fadeOut 2.5s ease-in-out forwards',
                    }}
                  >
                    <div 
                      className="w-6 h-6 md:w-8 md:h-8 border-2 border-t-transparent rounded-full"
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
                  className="absolute bottom-1 left-1 right-1 text-center text-[9px] md:text-[10px] font-medium px-1 py-0.5 rounded"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    color: isProcessing ? 'var(--primary)' : isPast ? '#22c55e' : 'rgba(255,255,255,0.5)',
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
          15% {
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
          }
          85% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          }
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          }
        }
        
        @keyframes fadeOut {
          0% { opacity: 1; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Responsive conveyor spacing */
        @media (min-width: 768px) {
          .forge-conveyor-item {
            --conveyor-offset: 130px;
          }
        }
        @media (min-width: 1024px) {
          .forge-conveyor-item {
            --conveyor-offset: 160px;
          }
        }
      `}</style>
    </div>
  );
}

export default ForgeConveyor;

