import React, { useEffect, useState, useRef, useCallback } from 'react';

interface GalleryImage {
  src: string;
  alt: string;
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  size: 'sm' | 'md' | 'lg';
  depth: number; // 1-3, affects parallax speed and z-index
  delay: number; // Animation delay in ms
  rotation?: number; // Initial rotation in degrees
}

interface FloatingGalleryProps {
  images: GalleryImage[];
  className?: string;
}

// Default gallery images - 6 images, 3 on each side
// Responsive positioning handled via CSS classes
// Desktop uses 147px padding, mobile/tablet uses smaller padding
export const defaultGalleryImages: GalleryImage[] = [
  // LEFT SIDE - lg, sm, md (top to bottom)
  {
    src: '/images/woman-portrait_1-1.webp',
    alt: 'Smiling woman portrait',
    position: { top: '5%', left: '20px' },
    size: 'lg',
    depth: 1,
    delay: 0,
    rotation: -2,
  },
  {
    src: '/images/ocean-waves-sunset.webp',
    alt: 'Ocean waves at sunset',
    position: { top: '38%', left: '28px' },
    size: 'sm',
    depth: 3,
    delay: 200,
    rotation: -1,
  },
  {
    src: '/images/colorful-anime_1-1_sm.webp',
    alt: 'Colorful anime artwork',
    position: { bottom: '5%', left: '20px' },
    size: 'md',
    depth: 2,
    delay: 400,
    rotation: 2,
  },
  // RIGHT SIDE - md, sm, lg (top to bottom)
  {
    src: '/images/abstract-eye_opt.webp',
    alt: 'Abstract eye painting',
    position: { top: '5%', right: '20px' },
    size: 'md',
    depth: 2,
    delay: 100,
    rotation: 2,
  },
  {
    src: '/images/man-portrait_1-1_sm.webp',
    alt: 'Man portrait',
    position: { top: '38%', right: '28px' },
    size: 'sm',
    depth: 3,
    delay: 300,
    rotation: -2,
  },
  {
    src: '/images/aurora-mountains.webp',
    alt: 'Aurora mountains landscape',
    position: { bottom: '5%', right: '20px' },
    size: 'lg',
    depth: 1,
    delay: 500,
    rotation: 1,
  },
];

/**
 * Floating image gallery with parallax effect
 * 6 images positioned 3 on each side of the hero content
 * No Ken Burns or scale animations to prevent flashing
 */
export function FloatingGallery({ 
  images = defaultGalleryImages,
  className = '' 
}: FloatingGalleryProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  
  // Mark as loaded after mount for entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Throttled scroll handler for parallax (max 60fps)
  const handleScroll = useCallback(() => {
    const now = performance.now();
    if (now - lastScrollTime.current < 16) return; // ~60fps throttle
    lastScrollTime.current = now;
    setScrollY(window.scrollY);
  }, []);
  
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  // Size classes - responsive sizes for all screen sizes
  // Mobile: slightly larger, moved in from edges
  // Tablet: medium
  // Desktop (xl+): full size with 147px padding
  const sizeClasses = {
    sm: 'w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 xl:w-44 xl:h-44',
    md: 'w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 lg:w-48 lg:h-48 xl:w-52 xl:h-52',
    lg: 'w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-56 lg:h-56 xl:w-64 xl:h-64'
  };
  
  // Desktop (xl+) uses 147px padding, smaller screens use the position values
  const getResponsivePosition = (position: GalleryImage['position']) => {
    // For xl+ screens, override left/right with 147px base
    // This is handled via CSS media query approach
    return position;
  };
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {/* Desktop padding wrapper - only affects xl+ */}
      <style>{`
        @media (min-width: 1280px) {
          .floating-image-left { left: 147px !important; }
          .floating-image-left-offset { left: 171px !important; }
          .floating-image-left-offset-sm { left: 187px !important; }
          .floating-image-right { right: 147px !important; }
          .floating-image-right-offset { right: 171px !important; }
          .floating-image-right-offset-sm { right: 187px !important; }
        }
      `}</style>
      {images.map((image, index) => {
        // Calculate parallax offset based on depth
        const parallaxSpeed = image.depth * 0.06;
        const parallaxY = scrollY * parallaxSpeed;
        
        // Determine position class for desktop override
        const isLeft = 'left' in image.position;
        const isSmall = image.size === 'sm';
        const isMedium = image.size === 'md';
        let positionClass = '';
        if (isLeft) {
          positionClass = isSmall ? 'floating-image-left-offset-sm' : isMedium ? 'floating-image-left-offset' : 'floating-image-left';
        } else {
          positionClass = isSmall ? 'floating-image-right-offset-sm' : isMedium ? 'floating-image-right-offset' : 'floating-image-right';
        }
        
        return (
          <div
            key={index}
            className={`absolute ${sizeClasses[image.size]} ${positionClass} rounded-xl overflow-hidden`}
            style={{
              ...image.position,
              zIndex: 10 + image.depth,
              transform: `translateY(${-parallaxY}px) rotate(${image.rotation || 0}deg)`,
              opacity: isLoaded ? 1 : 0,
              transition: `opacity 0.8s ease-out ${image.delay}ms`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Image - fully opaque, no overlays, no Ken Burns */}
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            
            {/* Subtle border glow */}
            <div 
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default FloatingGallery;
