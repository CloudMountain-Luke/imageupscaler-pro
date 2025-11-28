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
}

interface FloatingGalleryProps {
  images: GalleryImage[];
  className?: string;
}

// Default gallery images - reduced to 4 for performance, lower quality
export const defaultGalleryImages: GalleryImage[] = [
  {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=350&q=60',
    alt: 'Mountain landscape',
    position: { top: '10%', left: '5%' },
    size: 'lg',
    depth: 1,
    delay: 0
  },
  {
    src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=250&q=60',
    alt: 'Portrait with detail',
    position: { top: '15%', right: '8%' },
    size: 'md',
    depth: 2,
    delay: 200
  },
  {
    src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&q=60',
    alt: 'Ocean waves',
    position: { bottom: '20%', left: '10%' },
    size: 'md',
    depth: 3,
    delay: 400
  },
  {
    src: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=220&q=60',
    alt: 'Abstract art painting',
    position: { bottom: '15%', right: '5%' },
    size: 'sm',
    depth: 2,
    delay: 600
  }
];

/**
 * Floating image gallery with parallax effect
 * Optimized: removed mouse tracking, throttled scroll
 */
export function FloatingGallery({ 
  images = defaultGalleryImages,
  className = '' 
}: FloatingGalleryProps) {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  
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
    sm: 'w-32 h-32 md:w-40 md:h-40',
    md: 'w-40 h-40 md:w-56 md:h-56',
    lg: 'w-48 h-48 md:w-72 md:h-72'
  };
  
  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {images.map((image, index) => {
        // Calculate parallax offset based on depth
        const parallaxSpeed = image.depth * 0.08;
        const parallaxY = scrollY * parallaxSpeed;
        
        return (
          <div
            key={index}
            className={`absolute ${sizeClasses[image.size]} rounded-xl overflow-hidden shadow-2xl`}
            style={{
              ...image.position,
              zIndex: 10 + image.depth,
              transform: `translateY(${-parallaxY}px) rotate(${(index % 2 === 0 ? 1 : -1) * 2}deg)`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Static image - removed Ken Burns for performance */}
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        );
      })}
    </div>
  );
}

export default FloatingGallery;

