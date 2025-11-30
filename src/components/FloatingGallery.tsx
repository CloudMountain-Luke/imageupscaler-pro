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
}

interface FloatingGalleryProps {
  images: GalleryImage[];
  className?: string;
}

// Mobile fan images - 3 images in a fan layout above the headline
const mobileFanImages = [
  { src: '/images/woman-portrait_1-1.webp', alt: 'Portrait', rotation: -12 },
  { src: '/images/abstract-eye_opt.webp', alt: 'Art', rotation: 0 },
  { src: '/images/aurora-mountains.webp', alt: 'Landscape', rotation: 12 },
];

// Default gallery images - 6 images, 3 on each side (tablet+ only)
// Desktop uses 147px padding, scales down proportionally for smaller screens
export const defaultGalleryImages: GalleryImage[] = [
  // LEFT SIDE
  {
    src: '/images/woman-portrait_1-1.webp',
    alt: 'Smiling woman portrait',
    position: { top: '8%', left: '12px' },
    size: 'lg',
    depth: 1,
    delay: 0,
    rotation: -2,
  },
  {
    src: '/images/ocean-waves-sunset.webp',
    alt: 'Ocean waves at sunset',
    position: { top: '40%', left: '20px' },
    size: 'sm',
    depth: 3,
    delay: 200,
    rotation: -1,
  },
  {
    src: '/images/acfromspace_sm_1-1_sm.webp',
    alt: 'Tracer figurine',
    position: { bottom: '8%', left: '12px' },
    size: 'md',
    depth: 2,
    delay: 400,
    rotation: 2,
  },
  // RIGHT SIDE
  {
    src: '/images/abstract-eye_opt.webp',
    alt: 'Abstract eye painting',
    position: { top: '8%', right: '12px' },
    size: 'md',
    depth: 2,
    delay: 100,
    rotation: 2,
  },
  {
    src: '/images/man-portrait_1-1_sm.webp',
    alt: 'Man portrait',
    position: { top: '40%', right: '20px' },
    size: 'sm',
    depth: 3,
    delay: 300,
    rotation: -2,
  },
  {
    src: '/images/aurora-mountains.webp',
    alt: 'Aurora mountains landscape',
    position: { bottom: '8%', right: '12px' },
    size: 'lg',
    depth: 1,
    delay: 500,
    rotation: 1,
  },
];

/**
 * Mobile/Tablet Fan Layout - 3 images in a fan above the headline
 * Width matches "Forge Stunning Detail" text
 */
function MobileFanGallery() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="flex justify-center items-end mb-4 relative h-36 sm:h-44 mx-auto">
      {mobileFanImages.map((image, index) => (
        <div
          key={index}
          className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] rounded-xl overflow-hidden relative flex-shrink-0"
          style={{
            transform: `rotate(${image.rotation}deg)`,
            zIndex: index === 1 ? 20 : 10,
            marginLeft: index > 0 ? '-28px' : '0',
            opacity: isLoaded ? 1 : 0,
            transition: `opacity 0.5s ease-out ${index * 100}ms`,
            boxShadow: '0 15px 30px -8px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Floating image gallery with parallax effect
 * Mobile: Shows fan layout (handled separately in Homepage)
 * Tablet+: 6 images positioned 3 on each side of the hero content
 */
export function FloatingGallery({ 
  images = defaultGalleryImages,
  className = '' 
}: FloatingGalleryProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const handleScroll = useCallback(() => {
    const now = performance.now();
    if (now - lastScrollTime.current < 16) return;
    lastScrollTime.current = now;
    setScrollY(window.scrollY);
  }, []);
  
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  const sizeClasses = {
    sm: 'w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 xl:w-44 xl:h-44',
    md: 'w-28 h-28 md:w-36 md:h-36 lg:w-48 lg:h-48 xl:w-52 xl:h-52',
    lg: 'w-36 h-36 md:w-44 md:h-44 lg:w-56 lg:h-56 xl:w-64 xl:h-64'
  };
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none hidden lg:block ${className}`}
    >
      <style>{`
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
        const parallaxSpeed = image.depth * 0.06;
        const parallaxY = scrollY * parallaxSpeed;
        
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
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div 
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Export the mobile fan component
export { MobileFanGallery };

export default FloatingGallery;
