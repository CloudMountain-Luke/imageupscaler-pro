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
// Order: Large at top, Small in middle, Large at bottom (on each side)
export const defaultGalleryImages: GalleryImage[] = [
  // Left side - Large, Small, Large (top to bottom)
  {
    src: '/images/aurora-mountains.webp',
    alt: 'Aurora mountains landscape',
    position: { top: '5%', left: '2%' },
    size: 'lg',
    depth: 1,
    delay: 0,
    rotation: -3,
  },
  {
    src: '/images/man-portrait_1-1_sm.webp',
    alt: 'Man portrait',
    position: { top: '42%', left: '3%' },
    size: 'sm',
    depth: 3,
    delay: 300,
    rotation: 2,
  },
  {
    src: '/images/ocean-waves-sunset.webp',
    alt: 'Ocean waves at sunset',
    position: { bottom: '5%', left: '2%' },
    size: 'lg',
    depth: 2,
    delay: 600,
    rotation: -2,
  },
  // Right side - Large, Small, Large (top to bottom)
  {
    src: '/images/abstract-eye_opt.webp',
    alt: 'Abstract eye painting',
    position: { top: '5%', right: '2%' },
    size: 'lg',
    depth: 1,
    delay: 150,
    rotation: 3,
  },
  {
    src: '/images/colorful-anime_1-1_sm.webp',
    alt: 'Colorful anime artwork',
    position: { top: '42%', right: '3%' },
    size: 'sm',
    depth: 3,
    delay: 450,
    rotation: -2,
  },
  {
    src: '/images/woman-portrait_1-1.webp',
    alt: 'Portrait with detail',
    position: { bottom: '5%', right: '2%' },
    size: 'lg',
    depth: 2,
    delay: 750,
    rotation: 2,
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
  
  // Size classes
  const sizeClasses = {
    sm: 'w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40',
    md: 'w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56',
    lg: 'w-44 h-44 md:w-56 md:h-56 lg:w-72 lg:h-72'
  };
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ left: '30px', right: '30px', width: 'calc(100% - 60px)' }} // 30px padding from edges
    >
      {images.map((image, index) => {
        // Calculate parallax offset based on depth
        const parallaxSpeed = image.depth * 0.06;
        const parallaxY = scrollY * parallaxSpeed;
        
        return (
          <div
            key={index}
            className={`absolute ${sizeClasses[image.size]} rounded-xl overflow-hidden`}
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
