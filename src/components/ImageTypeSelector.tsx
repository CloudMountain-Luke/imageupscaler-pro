import React from 'react';
import { IMAGE_TYPES, ImageTypeInfo } from '../services/modelSelectionService';

interface ImageTypeSelectorProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  disabled?: boolean;
  useClarityUpscaler?: boolean;
  onClarityUpscalerChange?: (enabled: boolean) => void;
}

export const ImageTypeSelector: React.FC<ImageTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  disabled = false,
  useClarityUpscaler = false,
  onClarityUpscalerChange
}) => {
  // Filter out extreme upscaling since all types can access 16x-32x
  const availableTypes = Object.values(IMAGE_TYPES).filter(type => type.id !== 'extreme');
  
  // Show Clarity Upscaler option for art/illustration
  const showClarityOption = (selectedType === 'art' || selectedType === 'illustration') && onClarityUpscalerChange;

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex gap-[10px] justify-center lg:justify-start">
      {availableTypes.map((type) => {
        const isSelected = selectedType === type.id;
        
        return (
          <button
            key={type.id}
            onClick={() => !disabled && onTypeChange(type.id)}
            disabled={disabled}
            className={`
              relative px-2 py-1.5 rounded-xl border-2 transition-all duration-300 text-left
              w-[100px] h-[70px] bg-cover bg-center overflow-hidden flex-shrink-0
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
                  color: isSelected ? 'white' : 'white',
                  textShadow: isSelected 
                    ? '0 0 8px color-mix(in oklab, var(--primary) 80%, transparent 20%), 0 0 16px color-mix(in oklab, var(--primary) 60%, transparent 40%), 0 2px 4px rgba(0, 0, 0, 0.8)' 
                    : 'none'
                }}
              >
                {type.name}
              </span>
            </div>
          </button>
        );
      })}
      </div>
      
      {/* Clarity Upscaler Option for Art/Illustration */}
      {showClarityOption && (
        <div className="text-xs pl-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox"
              checked={useClarityUpscaler}
              onChange={(e) => onClarityUpscalerChange?.(e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded transition-all"
              style={{
                accentColor: 'var(--primary)'
              }}
            />
            <span style={{ color: 'var(--text-primary)' }} className="group-hover:opacity-80 transition-opacity">
              Use Clarity Upscaler (Premium)
            </span>
          </label>
          <p className="text-amber-400 mt-1 ml-6 text-[10px]">
            💎 Higher cost, creative detail generation up to 400MP
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageTypeSelector;

