import React, { useEffect, useState, useRef, ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number; // 0 to 1, where 0 is no movement and 1 is full scroll speed
  direction?: 'up' | 'down';
  disabled?: boolean;
}

/**
 * Wrapper component that adds parallax scrolling effect
 */
export function ParallaxSection({
  children,
  className = '',
  speed = 0.3,
  direction = 'up',
  disabled = false
}: ParallaxSectionProps) {
  const [offset, setOffset] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (disabled) return;
    
    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how far through the viewport the section is
      const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
      
      // Only apply parallax when section is in view
      if (progress >= 0 && progress <= 1) {
        const parallaxOffset = (progress - 0.5) * 100 * speed;
        setOffset(direction === 'up' ? -parallaxOffset : parallaxOffset);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, direction, disabled]);
  
  // Disable parallax on mobile for performance
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return (
    <div 
      ref={sectionRef}
      className={`relative ${className}`}
      style={{
        transform: !disabled && !isMobile ? `translateY(${offset}px)` : 'none',
        willChange: 'transform'
      }}
    >
      {children}
    </div>
  );
}

/**
 * Multi-layer parallax container
 * Each child with data-parallax-speed attribute moves at different speeds
 */
export function ParallaxContainer({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Normalize scroll position relative to container
      setScrollY(-rect.top);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      style={{ '--scroll-y': scrollY } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Individual parallax layer within ParallaxContainer
 */
export function ParallaxLayer({
  children,
  speed = 0.5,
  className = ''
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const layerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!layerRef.current) return;
      const rect = layerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
      
      if (scrollProgress >= -0.5 && scrollProgress <= 1.5) {
        setOffset((scrollProgress - 0.5) * 100 * speed);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);
  
  return (
    <div 
      ref={layerRef}
      className={className}
      style={{
        transform: `translateY(${offset}px)`,
        willChange: 'transform'
      }}
    >
      {children}
    </div>
  );
}

/**
 * Fade in on scroll component
 */
export function FadeInOnScroll({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  direction = 'up'
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (elementRef.current) {
      observer.observe(elementRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  const directionStyles = {
    up: { transform: 'translateY(30px)' },
    down: { transform: 'translateY(-30px)' },
    left: { transform: 'translateX(30px)' },
    right: { transform: 'translateX(-30px)' }
  };
  
  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0, 0)' : directionStyles[direction].transform,
        transition: `opacity ${duration}s ease-out, transform ${duration}s ease-out`,
        transitionDelay: `${delay}s`
      }}
    >
      {children}
    </div>
  );
}

export default ParallaxSection;




