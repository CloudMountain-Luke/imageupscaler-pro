import { useEffect, useState, useRef, useCallback } from 'react';

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
  hideOnMobile?: boolean; // Hide this image on mobile screens
  mobilePosition?: { // Custom position for mobile (overrides position on small screens)
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

interface FloatingGalleryProps {
  images: GalleryImage[];
  className?: string;
}

// Default gallery images - 6 images, 3 on each side
// Mobile: only shows 4 images (top + bottom), middle row hidden
// Bottom images moved up and toward center on mobile (behind badges)
// Tablet+: shows all 6 images
// Desktop uses 147px padding, scales down proportionally for smaller screens
export const defaultGalleryImages: GalleryImage[] = [
  // LEFT SIDE - top and bottom (middle hidden on mobile)
  {
    src: '/images/woman-portrait_1-1.webp',
    alt: 'Smiling woman portrait',
    position: { top: '8%', left: '12px' },
    size: 'lg',
    depth: 1,
    delay: 0,
    rotation: -2,
    hideOnMobile: false,
  },
  {
    src: '/images/ocean-waves-sunset.webp',
    alt: 'Ocean waves at sunset',
    position: { top: '40%', left: '20px' },
    size: 'sm',
    depth: 3,
    delay: 200,
    rotation: -1,
    hideOnMobile: true, // Middle row - hide on mobile
  },
  {
    src: '/images/acfromspace_sm_1-1_sm.webp',
    alt: 'Tracer figurine',
    position: { bottom: '12%', left: '15%' }, // Moved up and toward center on mobile
    size: 'md',
    depth: 2,
    delay: 400,
    rotation: 2,
    hideOnMobile: false,
    mobilePosition: { bottom: '5%', left: '8%' }, // Custom mobile position
  },
  // RIGHT SIDE - top and bottom (middle hidden on mobile)
  {
    src: '/images/abstract-eye_opt.webp',
    alt: 'Abstract eye painting',
    position: { top: '8%', right: '12px' },
    size: 'md',
    depth: 2,
    delay: 100,
    rotation: 2,
    hideOnMobile: false,
  },
  {
    src: '/images/man-portrait_1-1_sm.webp',
    alt: 'Man portrait',
    position: { top: '40%', right: '20px' },
    size: 'sm',
    depth: 3,
    delay: 300,
    rotation: -2,
    hideOnMobile: true, // Middle row - hide on mobile
  },
  {
    src: '/images/aurora-mountains.webp',
    alt: 'Aurora mountains landscape',
    position: { bottom: '12%', right: '15%' }, // Moved up and toward center on mobile
    size: 'lg',
    depth: 1,
    delay: 500,
    rotation: 1,
    hideOnMobile: false,
    mobilePosition: { bottom: '5%', right: '8%' }, // Custom mobile position
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
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {/* Responsive padding - scales from mobile to desktop */}
      <style>{`
        /* Mobile: bottom images moved up and toward center */
        @media (max-width: 767px) {
          .floating-bottom-left { 
            bottom: 5% !important; 
            left: 10% !important; 
          }
          .floating-bottom-right { 
            bottom: 5% !important; 
            right: 10% !important; 
          }
        }
        
        /* Tablet (md): moderate padding */
        @media (min-width: 768px) and (max-width: 1023px) {
          .floating-image-left { left: 40px !important; }
          .floating-image-left-offset { left: 56px !important; }
          .floating-image-left-offset-sm { left: 68px !important; }
          .floating-image-right { right: 40px !important; }
          .floating-image-right-offset { right: 56px !important; }
          .floating-image-right-offset-sm { right: 68px !important; }
        }
        
        /* Large tablet / small laptop (lg): increased padding */
        @media (min-width: 1024px) and (max-width: 1279px) {
          .floating-image-left { left: 80px !important; }
          .floating-image-left-offset { left: 100px !important; }
          .floating-image-left-offset-sm { left: 116px !important; }
          .floating-image-right { right: 80px !important; }
          .floating-image-right-offset { right: 100px !important; }
          .floating-image-right-offset-sm { right: 116px !important; }
        }
        
        /* Desktop (xl+): full 147px padding */
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
        const isBottom = 'bottom' in image.position;
        const isSmall = image.size === 'sm';
        const isMedium = image.size === 'md';
        
        let positionClass = '';
        if (isLeft) {
          positionClass = isSmall ? 'floating-image-left-offset-sm' : isMedium ? 'floating-image-left-offset' : 'floating-image-left';
        } else {
          positionClass = isSmall ? 'floating-image-right-offset-sm' : isMedium ? 'floating-image-right-offset' : 'floating-image-right';
        }
        
        // Add bottom position class for mobile centering
        if (isBottom && !image.hideOnMobile) {
          positionClass += isLeft ? ' floating-bottom-left' : ' floating-bottom-right';
        }
        
        // Hide on mobile class (hidden below md breakpoint)
        const mobileHideClass = image.hideOnMobile ? 'hidden md:block' : '';
        
        return (
          <div
            key={index}
            className={`absolute ${sizeClasses[image.size]} ${positionClass} ${mobileHideClass} rounded-xl overflow-hidden`}
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
