import React, { useEffect, useState, useRef } from 'react';

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

// Default gallery images using Unsplash - reliable, high-quality images
export const defaultGalleryImages: GalleryImage[] = [
  {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
    alt: 'Mountain landscape',
    position: { top: '10%', left: '5%' },
    size: 'lg',
    depth: 1,
    delay: 0
  },
  {
    src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80',
    alt: 'Portrait with detail',
    position: { top: '15%', right: '8%' },
    size: 'md',
    depth: 2,
    delay: 200
  },
  {
    src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=350&q=80',
    alt: 'Ocean waves',
    position: { bottom: '20%', left: '10%' },
    size: 'md',
    depth: 3,
    delay: 400
  },
  {
    src: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=280&q=80',
    alt: 'Abstract art painting',
    position: { bottom: '15%', right: '5%' },
    size: 'sm',
    depth: 2,
    delay: 600
  },
  {
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&q=80',
    alt: 'Portrait photography',
    position: { top: '45%', left: '2%' },
    size: 'sm',
    depth: 3,
    delay: 300
  },
  {
    src: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=380&q=80',
    alt: 'Japanese temple',
    position: { top: '50%', right: '3%' },
    size: 'md',
    depth: 1,
    delay: 500
  }
];

/**
 * Floating image gallery with parallax and Ken Burns effects
 * Images float at different depths and respond to scroll
 */
export function FloatingGallery({ 
  images = defaultGalleryImages,
  className = '' 
}: FloatingGalleryProps) {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll position for parallax
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Track mouse for subtle movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      });
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => container.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);
  
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
        const parallaxSpeed = image.depth * 0.1;
        const parallaxY = scrollY * parallaxSpeed;
        
        // Subtle mouse movement effect
        const mouseOffsetX = (mousePos.x - 0.5) * (4 - image.depth) * 10;
        const mouseOffsetY = (mousePos.y - 0.5) * (4 - image.depth) * 10;
        
        return (
          <div
            key={index}
            className={`
              absolute ${sizeClasses[image.size]} 
              rounded-xl overflow-hidden
              shadow-2xl
              animate-float
              pointer-events-auto
            `}
            style={{
              ...image.position,
              zIndex: 10 + image.depth,
              transform: `
                translateY(${-parallaxY}px) 
                translate(${mouseOffsetX}px, ${mouseOffsetY}px)
                rotate(${(index % 2 === 0 ? 1 : -1) * 2}deg)
              `,
              animationDelay: `${image.delay}ms`,
              animationDuration: `${6 + image.depth}s`,
              boxShadow: `
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 40px color-mix(in oklab, var(--primary) 20%, transparent 80%)
              `
            }}
          >
            {/* Image with Ken Burns effect */}
            <div className="relative w-full h-full overflow-hidden group">
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover animate-ken-burns"
                style={{
                  animationDelay: `${image.delay}ms`,
                  animationDuration: `${20 + index * 5}s`
                }}
                loading="lazy"
              />
              
              {/* Gradient overlay */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 30%, transparent 70%), transparent)'
                }}
              />
              
              {/* Glow border on hover */}
              <div 
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  boxShadow: 'inset 0 0 0 2px var(--primary), 0 0 30px var(--primary)'
                }}
              />
            </div>
            
            {/* Hexagon accent in corner - regular hexagon */}
            <div 
              className="absolute -bottom-2 -right-2 w-8 h-8 opacity-60 hex-badge"
              style={{
                boxShadow: '0 0 20px var(--primary)'
              }}
            />
          </div>
        );
      })}
      
      {/* Connecting lines between images (subtle) */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-10"
        style={{ zIndex: 5 }}
      >
        <defs>
          <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Decorative lines connecting image positions */}
        <line x1="10%" y1="20%" x2="85%" y2="25%" stroke="url(#line-gradient)" strokeWidth="1" />
        <line x1="15%" y1="70%" x2="90%" y2="65%" stroke="url(#line-gradient)" strokeWidth="1" />
      </svg>
    </div>
  );
}

export default FloatingGallery;

