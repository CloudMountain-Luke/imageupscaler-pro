import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Scale } from '../types/upscale';

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
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);

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
                  color: isSelected ? 'var(--primary)' : 'color-mix(in oklab, var(--text) 60%, transparent 40%)',
                  filter: isSelected ? 'drop-shadow(0 0 10px color-mix(in oklab, var(--primary) 50%, transparent 50%))' : 'none'
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
            className="w-full h-full rounded-full bg-gradient-to-br from-gray-800 to-black border-2 shadow-inner relative overflow-hidden"
            style={{ borderColor: 'color-mix(in oklab, var(--primary) 40%, var(--border) 60%)' }}
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
