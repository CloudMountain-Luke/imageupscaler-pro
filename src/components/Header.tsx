import React, { useState } from 'react';
import { User, Bell, Hammer, Palette } from 'lucide-react';
import { useThemeLab } from '../contexts/ThemeContext';

interface HeaderProps {
  remainingUpscales?: number;
  isActive?: boolean;
  userName?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  remainingUpscales = 0, 
  isActive = true,
  userName = null
}) => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const displayName = userName?.trim() || 'Guest';
  const { tone, setTone, isLabOpen, openLab, closeLab, toggleLab } = useThemeLab();

  const handleToneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTone(parseInt(event.target.value, 10));
  };

  return (
    <div className="backdrop-blur-xl border-b py-4 relative z-50" style={{ background: 'color-mix(in oklab, var(--surface) 85%, transparent 15%)', borderColor: 'color-mix(in oklab, var(--border) 60%, transparent 40%)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 lg:px-10">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-4 pl-0 xl:pl-[76px]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg border" style={{ background: 'color-mix(in oklab, var(--elev) 90%, transparent 10%)', borderColor: 'var(--border)' }}>
              <Hammer className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>Upscale Forge</h1>
            </div>
          </div>
        </div>

        {/* Right side - Status, Upscales, and User actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 pr-0 xl:pr-[76px]">
          <div className="hidden md:flex items-center gap-3 rounded-full border px-4 py-2 shadow-lg order-1" style={{ background: 'color-mix(in oklab, var(--elev) 50%, transparent 50%)', borderColor: 'color-mix(in oklab, var(--border) 60%, transparent 40%)', boxShadow: 'var(--shadow-1)' }}>
            <input
              type="range"
              min={10}
              max={90}
              step={1}
              value={tone}
              onChange={handleToneChange}
              className="tone-slider"
            />
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>{tone}%</span>
            <button
              type="button"
              onClick={isLabOpen ? closeLab : openLab}
              className="text-xs font-semibold transition-colors underline-offset-4 hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              {isLabOpen ? 'Close UI Lab' : 'Open UI Lab'}
            </button>
          </div>
          {/* Status and Upscales Pill */}
          <div className="flex items-center gap-3 sm:gap-4 order-2 md:order-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-red-500'} transition-all duration-300`} />
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text)' }}>
                {isActive ? 'Upscaler Active' : 'Upscaler Inactive'}
              </span>
            </div>
            
            <div className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 hover:shadow-lg shadow-lg whitespace-nowrap" style={{ background: 'color-mix(in oklab, var(--elev) 80%, transparent 20%)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-1)' }}>
              <div className="flex items-center space-x-2">
                <Hammer className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                <span>{remainingUpscales.toLocaleString()} Upscales</span>
              </div>
            </div>
          </div>
          {/* User actions */}
          <button
            className={`md:hidden order-1 p-2 rounded-lg transition-all duration-300 ${
              hoveredButton === 'palette'
                ? 'text-white bg-gray-700/50 scale-110'
                : 'text-gray-300 hover:text-white'
            }`}
            onMouseEnter={() => setHoveredButton('palette')}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={toggleLab}
          >
            <Palette className="w-5 h-5" />
          </button>

          <button 
            className={`p-2 rounded-lg transition-all duration-300 order-3 md:order-3 ${
              hoveredButton === 'bell' 
                ? 'text-white bg-gray-700/50 scale-110' 
                : 'text-gray-300 hover:text-white'
            }`}
            onMouseEnter={() => setHoveredButton('bell')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <Bell className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer order-4" style={{ background: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in oklab, var(--elev) 60%, transparent 40%)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md border" style={{ background: 'var(--elev)', borderColor: 'var(--border)' }}>
              <User className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{displayName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
