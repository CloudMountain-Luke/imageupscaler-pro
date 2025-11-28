import React, { useMemo } from 'react';

interface EmberParticle {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: string;
  opacity: number;
}

interface EmberParticlesProps {
  count?: number;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
  color?: 'orange' | 'cyan' | 'mixed';
}

/**
 * Floating ember/spark particles effect
 * Creates rising glowing particles for a "forge" aesthetic
 */
export function EmberParticles({ 
  count = 30,
  className = '',
  intensity = 'medium',
  color = 'orange'
}: EmberParticlesProps) {
  // Adjust count based on intensity
  const particleCount = {
    low: Math.floor(count * 0.5),
    medium: count,
    high: Math.floor(count * 1.5)
  }[intensity];
  
  // Generate random particles
  const particles = useMemo<EmberParticle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${4 + Math.random() * 6}s`,
      size: `${2 + Math.random() * 4}px`,
      opacity: 0.3 + Math.random() * 0.7
    }));
  }, [particleCount]);
  
  // Color configurations
  const colorConfig = {
    orange: {
      primary: 'var(--primary)',
      secondary: 'var(--secondary)',
      glow: 'rgba(255, 140, 0, 0.8)'
    },
    cyan: {
      primary: 'var(--accent)',
      secondary: 'hsl(195, 100%, 60%)',
      glow: 'rgba(0, 200, 255, 0.8)'
    },
    mixed: {
      primary: 'var(--primary)',
      secondary: 'var(--accent)',
      glow: 'rgba(255, 140, 0, 0.6)'
    }
  }[color];
  
  return (
    <div 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {particles.map((particle, index) => {
        const isAlternate = index % 3 === 0;
        const particleColor = isAlternate && color === 'mixed' 
          ? colorConfig.secondary 
          : colorConfig.primary;
        
        return (
          <div
            key={particle.id}
            className="absolute bottom-0 rounded-full animate-ember-rise"
            style={{
              left: particle.left,
              width: particle.size,
              height: particle.size,
              background: `radial-gradient(circle, ${particleColor} 0%, transparent 70%)`,
              boxShadow: `0 0 ${parseInt(particle.size) * 2}px ${colorConfig.glow}`,
              opacity: particle.opacity,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              filter: 'blur(0.5px)'
            }}
          />
        );
      })}
      
      {/* Larger, slower floating orbs */}
      {Array.from({ length: Math.floor(particleCount / 5) }, (_, i) => (
        <div
          key={`orb-${i}`}
          className="absolute rounded-full animate-ember-float"
          style={{
            left: `${10 + Math.random() * 80}%`,
            bottom: `${Math.random() * 50}%`,
            width: `${8 + Math.random() * 12}px`,
            height: `${8 + Math.random() * 12}px`,
            background: `radial-gradient(circle, ${colorConfig.primary} 0%, transparent 60%)`,
            boxShadow: `0 0 30px ${colorConfig.glow}`,
            opacity: 0.2 + Math.random() * 0.3,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 8}s`,
            filter: 'blur(1px)'
          }}
        />
      ))}
    </div>
  );
}

/**
 * Scan line effect - horizontal light beam that sweeps across
 */
export function ScanLine({ 
  className = '',
  color = 'var(--primary)',
  duration = 3
}: { 
  className?: string;
  color?: string;
  duration?: number;
}) {
  return (
    <div 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <div 
        className="absolute w-full h-px animate-scan-sweep"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
          animationDuration: `${duration}s`
        }}
      />
    </div>
  );
}

/**
 * Static scan lines overlay (CRT effect)
 */
export function ScanLines({ 
  className = '',
  opacity = 0.03,
  spacing = 4
}: { 
  className?: string;
  opacity?: number;
  spacing?: number;
}) {
  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent ${spacing - 1}px,
          rgba(0, 0, 0, ${opacity}) ${spacing - 1}px,
          rgba(0, 0, 0, ${opacity}) ${spacing}px
        )`
      }}
      aria-hidden="true"
    />
  );
}

export default EmberParticles;




