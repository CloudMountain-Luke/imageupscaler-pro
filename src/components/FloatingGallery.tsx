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
// Each side has 3 DIFFERENT sizes: lg, md, sm
// Uniform spacing: 8% from top, 8% gap between images, 8% from bottom
// Left/Right padding: 100px from edges
export const defaultGalleryImages: GalleryImage[] = [
  // LEFT SIDE - lg, md, sm (top to bottom) - evenly spaced
  {
    src: '/images/woman-portrait_1-1.webp',
    alt: 'Smiling woman portrait',
    position: { top: '8%', left: '100px' },
    size: 'lg',
    depth: 1,
    delay: 0,
    rotation: -2,
  },
  {
    src: '/images/colorful-anime_1-1_sm.webp',
    alt: 'Colorful anime artwork',
    position: { top: '40%', left: '100px' },
    size: 'md',
    depth: 2,
    delay: 200,
    rotation: 2,
  },
  {
    src: '/images/ocean-waves-sunset.webp',
    alt: 'Ocean waves at sunset',
    position: { bottom: '12%', left: '100px' },
    size: 'sm',
    depth: 3,
    delay: 400,
    rotation: -1,
  },
  // RIGHT SIDE - md, sm, lg (top to bottom) - evenly spaced
  {
    src: '/images/abstract-eye_opt.webp',
    alt: 'Abstract eye painting',
    position: { top: '8%', right: '100px' },
    size: 'md',
    depth: 2,
    delay: 100,
    rotation: 2,
  },
  {
    src: '/images/man-portrait_1-1_sm.webp',
    alt: 'Man portrait',
    position: { top: '40%', right: '100px' },
    size: 'sm',
    depth: 3,
    delay: 300,
    rotation: -2,
  },
  {
    src: '/images/aurora-mountains.webp',
    alt: 'Aurora mountains landscape',
    position: { bottom: '8%', right: '100px' },
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
  
  // Size classes - 3 distinct sizes
  const sizeClasses = {
    sm: 'w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36',
    md: 'w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52',
    lg: 'w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64'
  };
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
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
