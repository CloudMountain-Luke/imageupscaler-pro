import React, { useMemo } from 'react';
import { useThemeLab } from '../contexts/ThemeContext';

export function Footer() {
  const { tone, colorScheme } = useThemeLab();
  
  const handleNavigate = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
  };

  // Footer text should always be white
  const footerTextColor = 'hsl(0, 0%, 96%)';

  // Calculate policy link color based on color scheme
  // flame=yellow, forge=orange, cyber=teal, space=purple/magenta
  const policyLinkColor = useMemo(() => {
    const schemeColors: Record<string, { h: number; s: number }> = {
      flame: { h: 50, s: 85 },   // Yellow
      forge: { h: 30, s: 85 },   // Orange
      cyber: { h: 195, s: 85 },  // Teal/Cyan
      space: { h: 275, s: 80 }, // Purple with a touch of magenta
    };
    
    const color = schemeColors[colorScheme] || schemeColors.space;
    
    // Adjust lightness based on tone for better contrast
    // Bright purple/magenta on dark backgrounds, darker purple on light backgrounds
    if (colorScheme === 'space') {
      if (tone <= 25) {
        // Very dark backgrounds: bright purple/magenta
        return `hsl(${color.h}, ${color.s}%, 70%)`;
      } else if (tone <= 50) {
        // Medium-dark backgrounds: bright purple/magenta
        return `hsl(${color.h}, ${color.s}%, 65%)`;
      } else if (tone <= 75) {
        // Medium-light backgrounds: darker purple
        return `hsl(${color.h}, ${color.s}%, 50%)`;
      } else {
        // Light backgrounds: darker purple
        return `hsl(${color.h}, ${color.s}%, 45%)`;
      }
    } else {
      // For other schemes, use adaptive lightness
      if (tone <= 50) {
        return `hsl(${color.h}, ${color.s}%, 65%)`;
      } else {
        return `hsl(${color.h}, ${color.s}%, 50%)`;
      }
    }
  }, [colorScheme, tone]);

  return (
    <footer 
      className="backdrop-blur-sm border-t mt-auto py-8"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4">
            <img 
              src="/images/UpscaleForge-Logo_500px_sm.png" 
              alt="Upscale Forge Logo" 
              className="w-[100px] h-auto"
            />
            <span className="text-sm sm:text-base" style={{ color: footerTextColor, transform: 'translateY(12px)' }}>
              by
            </span>
            <img 
              src="/CMG Logo_2023_Landscape_300px-42.png" 
              alt="CMG Logo" 
              className="h-[54px] w-auto"
            />
          </div>
          <p className="mb-4" style={{ color: footerTextColor }}>
            Professional AI-powered image upscaling for creators and businesses
          </p>
          {/* Policy links centered under the statement */}
          <div className="flex flex-wrap justify-center space-x-4 md:space-x-6 text-sm mb-4">
            <button 
              onClick={() => handleNavigate('navigate-to-terms')}
              className="transition-colors hover:opacity-80"
              style={{ color: policyLinkColor }}
            >
              Terms of Service
            </button>
            <button 
              onClick={() => handleNavigate('navigate-to-privacy')}
              className="transition-colors hover:opacity-80"
              style={{ color: policyLinkColor }}
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => handleNavigate('navigate-to-refund')}
              className="transition-colors hover:opacity-80"
              style={{ color: policyLinkColor }}
            >
              Refund Policy
            </button>
          </div>
        </div>
        <div className="text-center mt-6 text-sm" style={{ color: footerTextColor }}>
          © Copyright 2025 Cloud Mountain Graphics Ltd. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
