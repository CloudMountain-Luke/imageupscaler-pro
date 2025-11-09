import React, { useState } from 'react';
import { Sparkles, Hammer } from 'lucide-react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  title, 
  description,
  icon,
  glow = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`
        relative bg-white/5 backdrop-blur-xl 
        border border-white/10 
        rounded-2xl p-6 shadow-2xl transition-all duration-300
        hover:bg-white/8
        hover:border-white/20
        hover:shadow-3xl hover:scale-[1.02]
        ${glow ? 'shadow-blue-500/20' : ''}
        ${isHovered ? 'shadow-blue-500/30' : ''}
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      {glow && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-sm" />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {(title || description || icon) && (
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-2">
              {icon && (
                <div className="text-blue-400 transition-transform duration-300 hover:scale-110">
                  {icon}
                </div>
              )}
              {title && (
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <span>{title}</span>
                  {isHovered && (
                    <Hammer className="w-4 h-4 text-blue-400" />
                  )}
                </h3>
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-300 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
