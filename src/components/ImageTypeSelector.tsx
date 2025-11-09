import React from 'react';
import { IMAGE_TYPES, ImageTypeInfo } from '../services/modelSelectionService';

interface ImageTypeSelectorProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  disabled?: boolean;
}

export const ImageTypeSelector: React.FC<ImageTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  disabled = false
}) => {
  // Filter out extreme upscaling since all types can access 16x-32x
  const availableTypes = Object.values(IMAGE_TYPES).filter(type => type.id !== 'extreme');

  return (
    <div className="flex gap-[10px] justify-center lg:justify-start">
      {availableTypes.map((type) => {
        const isSelected = selectedType === type.id;
        
        return (
          <button
            key={type.id}
            onClick={() => !disabled && onTypeChange(type.id)}
            disabled={disabled}
            className={`
              relative p-2 rounded-xl border-2 transition-all duration-300 text-left
              w-[100px] h-[81px] bg-cover bg-center overflow-hidden flex-shrink-0
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
            `}
            style={{
              borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
              boxShadow: isSelected ? '0 0 20px color-mix(in oklab, var(--primary) 20%, transparent 80%)' : 'none',
              backgroundImage: type.exampleImage ? `url(${type.exampleImage})` : undefined
            }}
          >
            {/* Futuristic overlay effects */}
            <div 
              className="absolute inset-0 rounded-xl transition-all duration-300"
              style={{
                background: isSelected 
                  ? 'linear-gradient(to bottom right, color-mix(in oklab, var(--primary) 15%, transparent 85%), color-mix(in oklab, var(--secondary) 12%, transparent 88%))'
                  : 'rgba(0, 0, 0, 0.5)'
              }}
            />
            
            {/* Holographic scan lines for selected */}
            {isSelected && (
              <div className="absolute inset-0 rounded-xl">
                <div 
                  className="absolute inset-0 animate-pulse"
                  style={{ 
                    background: `linear-gradient(to right, transparent, color-mix(in oklab, var(--primary) 20%, transparent 80%), transparent)` 
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/8 to-transparent opacity-50" />
              </div>
            )}
            
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
              <span 
                className="font-bold text-xs leading-tight transition-colors duration-300 px-1"
                style={{
                  color: isSelected ? 'var(--primary)' : 'white',
                  textShadow: isSelected ? '0 2px 12px color-mix(in oklab, var(--primary) 40%, transparent 60%)' : 'none'
                }}
              >
                {type.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ImageTypeSelector;

