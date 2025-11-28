import React, { useMemo } from 'react';

interface HexagonGridProps {
  className?: string;
  cellSize?: number;
  opacity?: number;
  glowColor?: string;
  animated?: boolean;
}

/**
 * Futuristic hexagon grid background pattern
 * Creates a subtle hex grid overlay with optional glow effects
 */
export function HexagonGrid({ 
  className = '', 
  cellSize = 50,
  opacity = 0.15,
  glowColor = 'var(--primary)',
  animated = false
}: HexagonGridProps) {
  // Calculate hexagon dimensions
  const hexWidth = cellSize;
  const hexHeight = cellSize * 1.1547; // ratio for regular hexagon
  const rowOffset = hexWidth * 0.75;
  
  // Generate SVG pattern
  const patternId = useMemo(() => `hex-pattern-${Math.random().toString(36).substr(2, 9)}`, []);
  
  return (
    <div 
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <svg 
        width="100%" 
        height="100%" 
        xmlns="http://www.w3.org/2000/svg"
        className={animated ? 'animate-hex-pulse' : ''}
      >
        <defs>
          {/* Hexagon shape */}
          <pattern 
            id={patternId} 
            width={hexWidth * 1.5} 
            height={hexHeight} 
            patternUnits="userSpaceOnUse"
            patternTransform="scale(1)"
          >
            {/* First hexagon */}
            <polygon 
              points={`
                ${hexWidth * 0.25},0 
                ${hexWidth * 0.75},0 
                ${hexWidth},${hexHeight * 0.5} 
                ${hexWidth * 0.75},${hexHeight} 
                ${hexWidth * 0.25},${hexHeight} 
                0,${hexHeight * 0.5}
              `}
              fill="none"
              stroke={glowColor}
              strokeWidth="0.5"
              opacity="0.6"
            />
            {/* Offset hexagon for honeycomb pattern */}
            <polygon 
              points={`
                ${hexWidth * 1},${hexHeight * 0.5} 
                ${hexWidth * 1.25},${hexHeight * 0.5} 
                ${hexWidth * 1.5},${hexHeight} 
                ${hexWidth * 1.25},${hexHeight * 1.5} 
                ${hexWidth * 1},${hexHeight * 1.5} 
                ${hexWidth * 0.75},${hexHeight}
              `}
              fill="none"
              stroke={glowColor}
              strokeWidth="0.5"
              opacity="0.6"
              transform={`translate(0, ${-hexHeight * 0.5})`}
            />
          </pattern>
          
          {/* Glow filter */}
          <filter id={`${patternId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Apply pattern */}
        <rect 
          width="100%" 
          height="100%" 
          fill={`url(#${patternId})`}
          filter={`url(#${patternId}-glow)`}
        />
      </svg>
      
      {/* Gradient fade at edges */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 30%, var(--surface) 100%)
          `
        }}
      />
    </div>
  );
}

/**
 * Alternative: CSS-only hexagon grid using clip-path
 * More performant for simple use cases
 */
export function HexagonGridCSS({ 
  className = '',
  opacity = 0.1 
}: { 
  className?: string;
  opacity?: number;
}) {
  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        opacity,
        backgroundImage: `
          linear-gradient(30deg, var(--primary) 12%, transparent 12.5%, transparent 87%, var(--primary) 87.5%, var(--primary)),
          linear-gradient(150deg, var(--primary) 12%, transparent 12.5%, transparent 87%, var(--primary) 87.5%, var(--primary)),
          linear-gradient(30deg, var(--primary) 12%, transparent 12.5%, transparent 87%, var(--primary) 87.5%, var(--primary)),
          linear-gradient(150deg, var(--primary) 12%, transparent 12.5%, transparent 87%, var(--primary) 87.5%, var(--primary)),
          linear-gradient(60deg, color-mix(in oklab, var(--primary) 50%, transparent 50%) 25%, transparent 25.5%, transparent 75%, color-mix(in oklab, var(--primary) 50%, transparent 50%) 75%, color-mix(in oklab, var(--primary) 50%, transparent 50%)),
          linear-gradient(60deg, color-mix(in oklab, var(--primary) 50%, transparent 50%) 25%, transparent 25.5%, transparent 75%, color-mix(in oklab, var(--primary) 50%, transparent 50%) 75%, color-mix(in oklab, var(--primary) 50%, transparent 50%))
        `,
        backgroundSize: '80px 140px',
        backgroundPosition: '0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px'
      }}
    />
  );
}

export default HexagonGrid;




