import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Scale } from '../types/upscale';
import { useThemeLab } from '../contexts/ThemeContext';

interface ScaleWheelProps {
  scales: number[];
  selectedScale: Scale;
  onScaleChange: (scale: Scale) => void;
  disabled?: boolean;
}

export const ScaleWheel: React.FC<ScaleWheelProps> = ({
  scales,
  selectedScale,
  onScaleChange,
  disabled = false
}) => {
  const { tone } = useThemeLab();
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  
  // Calculate adaptive knob background that matches surface color
  // Create a subtle gradient from surface to slightly darker/lighter for depth
  const knobBackground = useMemo(() => {
    // Use var(--surface) as base, create gradient with subtle variation
    // For dark backgrounds: gradient from surface to slightly darker
    // For light backgrounds: gradient from surface to slightly lighter
    if (tone < 50) {
      // Dark backgrounds: gradient from surface to darker
      return 'linear-gradient(to bottom right, var(--surface), color-mix(in oklab, var(--surface) 70%, black 30%))';
    } else {
      // Light backgrounds: gradient from surface to slightly darker
      return 'linear-gradient(to bottom right, var(--surface), color-mix(in oklab, var(--surface) 85%, black 15%))';
    }
  }, [tone]);

  // Calculate adaptive text color for unselected numbers
  const unselectedNumberColor = useMemo(() => {
    if (tone <= 50) {
      return 'hsl(0, 0%, 96%)'; // White for dark backgrounds
    } else {
      return 'hsl(0, 0%, 35%)'; // Darker grey for light backgrounds
    }
  }, [tone]);

  // Calculate rotation for selected scale
  const getRotationForScale = useCallback((scale: number) => {
    const index = scales.indexOf(scale);
    if (index === -1) return 0;
    return (index / scales.length) * 360;
  }, [scales]);

  // Calculate scale from rotation
  const getScaleFromRotation = useCallback((rot: number) => {
    const normalizedRot = ((rot % 360) + 360) % 360;
    const index = Math.round((normalizedRot / 360) * scales.length) % scales.length;
    return scales[index];
  }, [scales]);

  // Validate that selectedScale is in the scales array
  useEffect(() => {
    if (!scales.includes(selectedScale)) {
      console.warn(`[ScaleWheel] Selected scale ${selectedScale} not in available scales:`, scales);
      // Auto-correct to nearest valid scale
      const nearestScale = scales.reduce((prev, curr) => 
        Math.abs(curr - selectedScale) < Math.abs(prev - selectedScale) ? curr : prev
      );
      console.log(`[ScaleWheel] Auto-correcting to nearest scale: ${nearestScale}`);
      onScaleChange(nearestScale as Scale);
    }
  }, [selectedScale, scales, onScaleChange]);

  // Update rotation when selected scale changes externally
  useEffect(() => {
    if (!isDragging) {
      setRotation(getRotationForScale(selectedScale));
    }
  }, [selectedScale, getRotationForScale, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    startAngleRef.current = angle;
    startRotationRef.current = rotation;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const deltaAngle = angle - startAngleRef.current;
    const newRotation = startRotationRef.current + (deltaAngle * 180 / Math.PI);
    
    setRotation(newRotation);
    
    // Update selected scale based on rotation
    const newScale = getScaleFromRotation(newRotation);
    if (newScale !== selectedScale) {
      onScaleChange(newScale as Scale);
    }
  }, [isDragging, disabled, getScaleFromRotation, selectedScale, onScaleChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Snap to nearest scale
      const nearestScale = getScaleFromRotation(rotation);
      const snapRotation = getRotationForScale(nearestScale);
      setRotation(snapRotation);
      onScaleChange(nearestScale as Scale);
    }
  }, [isDragging, rotation, getScaleFromRotation, getRotationForScale, onScaleChange]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const touch = e.touches[0];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    startAngleRef.current = angle;
    startRotationRef.current = rotation;
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const touch = e.touches[0];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    const deltaAngle = angle - startAngleRef.current;
    const newRotation = startRotationRef.current + (deltaAngle * 180 / Math.PI);
    
    setRotation(newRotation);
    
    const newScale = getScaleFromRotation(newRotation);
    if (newScale !== selectedScale) {
      onScaleChange(newScale as Scale);
    }
  }, [isDragging, disabled, getScaleFromRotation, selectedScale, onScaleChange]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      const nearestScale = getScaleFromRotation(rotation);
      const snapRotation = getRotationForScale(nearestScale);
      setRotation(snapRotation);
      onScaleChange(nearestScale as Scale);
    }
  }, [isDragging, rotation, getScaleFromRotation, getRotationForScale, onScaleChange]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Enhanced Scale Wheel Container */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        
        {/* Scale Numbers Around Knob - Enhanced styling */}
        <div className="absolute inset-0 w-40 h-40">
          {scales.map((scale, index) => {
            const angle = (index / scales.length) * 360;
            const isSelected = scale === selectedScale;
            const x = 50 + 45 * Math.cos((angle - 90) * Math.PI / 180);
            const y = 50 + 45 * Math.sin((angle - 90) * Math.PI / 180);
            
            return (
              <div
                key={scale}
                className={`
                  absolute text-sm font-bold select-none pointer-events-none transition-all duration-300
                  ${isSelected 
                    ? 'scale-125' 
                    : 'scale-100'
                  }
                `}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: isSelected 
                    ? 'var(--primary)'  // Keep neon color for selected
                    : `color-mix(in oklab, ${unselectedNumberColor} 50%, transparent 50%)`, // Adaptive greyed out for unselected
                  filter: isSelected 
                    ? 'drop-shadow(0 0 10px color-mix(in oklab, var(--primary) 50%, transparent 50%))' 
                    : 'none'
                }}
              >
                {scale}
              </div>
            );
          })}
        </div>

        {/* Enhanced Stereo Knob */}
        <div
          ref={wheelRef}
          className={`
            relative w-24 h-24 rounded-full cursor-pointer select-none transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
            ${isDragging ? 'scale-110 shadow-2xl' : 'shadow-lg'}
          `}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Knob Body - Enhanced with gradients and glow */}
          <div 
            className="w-full h-full rounded-full border-2 shadow-inner relative overflow-hidden"
            style={{ 
              borderColor: 'color-mix(in oklab, var(--primary) 40%, var(--border) 60%)',
              background: knobBackground
            }}
          >
            {/* Inner glow effect */}
            <div 
              className="absolute inset-1 rounded-full bg-gradient-to-br to-transparent"
              style={{ backgroundImage: `linear-gradient(to bottom right, color-mix(in oklab, var(--primary) 12%, transparent 88%), transparent)` }}
            />
            
            {/* Enhanced Indicator Bar */}
            <div 
              className="absolute top-2 left-1/2 transform -translate-x-1/2 w-1.5 h-6 rounded-full shadow-lg"
              style={{ background: `linear-gradient(to bottom, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScaleWheel;
