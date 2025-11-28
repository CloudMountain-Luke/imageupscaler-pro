import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface HexagonRevealProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  stats?: {
    before: string;
    after: string;
    scale: string;
  };
  autoPlay?: boolean;
  autoPlayDelay?: number;
  triggerOnView?: boolean;
  className?: string;
}

/**
 * Unique hexagon-based before/after reveal animation
 * Before image is visible initially, hexagons reveal the after image
 * Hexagons are ~47x47px and perfectly symmetrical
 */
export function HexagonReveal({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  stats,
  autoPlay = true,
  autoPlayDelay = 4000,
  triggerOnView = true,
  className = ''
}: HexagonRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // For ~47px hexagons in a typical container width of ~900px
  // We need about 19 columns and 12 rows for good coverage
  const cols = 20;
  const rows = 13;
  const totalHexagons = cols * rows;
  
  // Pre-calculate random delays for digital/sporadic reveal effect
  const randomDelays = useMemo(() => {
    // Create array of indices and shuffle them for random order
    const indices = Array.from({ length: totalHexagons }, (_, i) => i);
    
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Assign delays based on shuffled order (0 to 1200ms spread)
    const delays: number[] = new Array(totalHexagons);
    indices.forEach((originalIndex, newOrder) => {
      // Add some randomness within groups for more digital feel
      const baseDelay = (newOrder / totalHexagons) * 1000;
      const jitter = Math.random() * 150 - 75; // ±75ms jitter
      delays[originalIndex] = Math.max(0, baseDelay + jitter);
    });
    
    return delays;
  }, [totalHexagons]);
  
  // Trigger reveal animation
  const triggerReveal = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsRevealed(true);
    
    // Animation complete after all hexagons revealed
    setTimeout(() => {
      setIsAnimating(false);
    }, 1800);
  }, [isAnimating]);
  
  // Reset to before state
  const resetReveal = useCallback(() => {
    if (isAnimating) return;
    setIsRevealed(false);
  }, [isAnimating]);
  
  // Toggle on click
  const handleClick = () => {
    if (isRevealed) {
      resetReveal();
    } else {
      triggerReveal();
    }
  };
  
  // Intersection Observer for scroll trigger
  useEffect(() => {
    if (!triggerOnView || hasTriggered) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered) {
            setHasTriggered(true);
            setTimeout(triggerReveal, 500);
          }
        });
      },
      { threshold: 0.5 }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [triggerOnView, hasTriggered, triggerReveal]);
  
  // Auto-play loop
  useEffect(() => {
    if (!autoPlay) return;
    
    const interval = setInterval(() => {
      if (isRevealed) {
        resetReveal();
        setTimeout(triggerReveal, 1000);
      } else {
        triggerReveal();
      }
    }, autoPlayDelay);
    
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayDelay, isRevealed, triggerReveal, resetReveal]);
  
  // Hexagon dimensions - calculate for ~47px hexagons
  // For a flat-top regular hexagon: width = size * 2, height = size * sqrt(3)
  // We use percentage-based positioning for responsiveness
  const hexWidth = 100 / cols; // percentage width per column
  const hexHeight = hexWidth * 0.866; // maintain proper hexagon ratio
  
  // Generate hexagon points for a regular flat-top hexagon
  const getHexPoints = (cx: number, cy: number, size: number) => {
    // Flat-top hexagon points (regular hexagon)
    const w = size;
    const h = size * 0.866; // height = width * sqrt(3)/2
    return `
      ${cx},${cy - h/2}
      ${cx + w/2},${cy - h/4}
      ${cx + w/2},${cy + h/4}
      ${cx},${cy + h/2}
      ${cx - w/2},${cy + h/4}
      ${cx - w/2},${cy - h/4}
    `;
  };
  
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl cursor-pointer group ${className}`}
      onClick={handleClick}
      style={{ aspectRatio: '16/10' }}
    >
      {/* LAYER 1: After Image (bottom layer - revealed through hexagons) */}
      <div className="absolute inset-0">
        <img 
          src={afterImage} 
          alt={afterLabel}
          className="w-full h-full object-cover"
          style={{
            filter: 'saturate(1.05) contrast(1.02)',
          }}
        />
      </div>
      
      {/* LAYER 2: Before Image (top layer - masked by hexagons that disappear) */}
      <div 
        className="absolute inset-0"
        style={{
          // The before image fades out as hexagons reveal
          opacity: isRevealed ? 0 : 1,
          transition: 'opacity 1.5s ease-out',
          transitionDelay: isRevealed ? '0.3s' : '0s',
        }}
      >
        <img 
          src={beforeImage} 
          alt={beforeLabel}
          className="w-full h-full object-cover"
          style={{ 
            filter: 'blur(2px) saturate(0.7) brightness(0.85)',
            transform: 'scale(1.02)'
          }}
        />
        {/* Noise overlay for low-quality effect */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            mixBlendMode: 'overlay'
          }}
        />
      </div>
      
      {/* LAYER 3: Hexagon Animation Overlay - glowing hexagons during reveal */}
      <div className="absolute inset-0 pointer-events-none">
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 62.5"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0"
        >
          <defs>
            <linearGradient id="hex-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          
          {Array.from({ length: totalHexagons }).map((_, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const isOddRow = row % 2 === 1;
            
            // Honeycomb positioning - offset odd rows by half a hexagon
            const cx = (col + 0.5) * hexWidth + (isOddRow ? hexWidth * 0.5 : 0);
            const cy = (row + 0.5) * hexHeight * 1.15; // 1.15 for slight vertical overlap
            
            const delay = randomDelays[index];
            const hexSize = hexWidth * 1.1; // Slightly larger for overlap
            
            return (
              <g key={index}>
                {/* Glowing hexagon during animation */}
                <polygon
                  points={getHexPoints(cx, cy, hexSize)}
                  fill="url(#hex-glow-gradient)"
                  stroke="var(--primary)"
                  strokeWidth="0.1"
                  style={{
                    opacity: 0,
                    transform: 'scale(1)',
                    transformOrigin: `${cx}% ${cy}%`,
                    animation: isAnimating 
                      ? `hex-flash 0.5s ease-out ${delay}ms forwards`
                      : 'none',
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* LAYER 4: Subtle hexagon grid outline (only during animation, fades completely when revealed) */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{ 
          opacity: isAnimating ? 0.3 : 0,
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 62.5" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: totalHexagons }).map((_, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const isOddRow = row % 2 === 1;
            const cx = (col + 0.5) * hexWidth + (isOddRow ? hexWidth * 0.5 : 0);
            const cy = (row + 0.5) * hexHeight * 1.15;
            const hexSize = hexWidth * 1.1;
            
            return (
              <polygon
                key={index}
                points={getHexPoints(cx, cy, hexSize)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="0.05"
                opacity="0.4"
              />
            );
          })}
        </svg>
      </div>
      
      {/* Labels */}
      <div 
        className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md transition-all duration-500"
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          opacity: isRevealed ? 0 : 1,
          transform: isRevealed ? 'translateY(-10px)' : 'translateY(0)'
        }}
      >
        {beforeLabel}
      </div>
      
      <div 
        className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md transition-all duration-500"
        style={{
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white',
          opacity: isRevealed ? 1 : 0,
          transform: isRevealed ? 'translateY(0)' : 'translateY(-10px)',
          boxShadow: '0 0 20px color-mix(in oklab, var(--primary) 50%, transparent 50%)'
        }}
      >
        {afterLabel}
      </div>
      
      {/* Stats Overlay */}
      {stats && (
        <div 
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md transition-all duration-700"
          style={{
            background: 'rgba(0,0,0,0.8)',
            opacity: isRevealed ? 1 : 0,
            transform: isRevealed ? 'translateY(0)' : 'translateY(20px)'
          }}
        >
          <span className="text-gray-400 text-sm font-mono line-through">{stats.before}</span>
          <span 
            className="text-xl font-bold"
            style={{ color: 'var(--primary)' }}
          >
            →
          </span>
          <span className="text-white text-sm font-mono font-medium">{stats.after}</span>
          <span 
            className="px-2.5 py-1 rounded text-xs font-bold"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
              boxShadow: '0 0 15px color-mix(in oklab, var(--primary) 40%, transparent 60%)'
            }}
          >
            {stats.scale}
          </span>
        </div>
      )}
      
      {/* Click hint */}
      <div 
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      >
        <div 
          className="px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md"
          style={{
            background: 'rgba(0,0,0,0.8)',
            color: 'white'
          }}
        >
          {isRevealed ? 'Click to reset' : 'Click to reveal'}
        </div>
      </div>
      
      {/* Digital scan line effect during animation */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Multiple scan lines for digital effect */}
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="absolute w-full h-0.5"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, var(--primary) 20%, var(--accent) 50%, var(--primary) 80%, transparent 100%)',
                boxShadow: '0 0 20px var(--primary), 0 0 40px var(--accent)',
                top: 0,
                animation: `scan-line-fast 0.8s ease-out ${i * 0.2}s forwards`,
              }}
            />
          ))}
        </div>
      )}
      
      {/* CSS for hex flash animation */}
      <style>{`
        @keyframes hex-flash {
          0% { opacity: 0; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes scan-line-fast {
          0% { top: 0; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default HexagonReveal;
