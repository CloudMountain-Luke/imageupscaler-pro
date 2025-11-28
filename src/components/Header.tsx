import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Bell, Palette, Settings, CreditCard, LogOut, Menu, X, History } from 'lucide-react';
import { useThemeLab } from '../contexts/ThemeContext';

interface HeaderProps {
  remainingUpscales?: number;
  isActive?: boolean;
  userName?: string | null;
  onLogout?: () => void;
  onNavigateToHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  remainingUpscales = 0,
  isActive = true,
  userName = null,
  onLogout,
  onNavigateToHistory,
}) => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerMenuRef = useRef<HTMLDivElement>(null);
  const displayName = userName?.trim() || 'Guest';
  const { tone, setTone, isLabOpen, openLab, closeLab, toggleLab, colorScheme, tokens } = useThemeLab();

  // Header background always matches page background for seamless blending
  const headerBackground = useMemo(() => {
    return 'var(--surface)';
  }, []);

  // Calculate text color based on tone level with WCAG contrast compliance
  // At low tones (0-50%): dark background, use light text
  // At high tones (50-100%): light background, use dark text
  // Smooth transition around 50% mark
  const headerTextColor = useMemo(() => {
    if (tone <= 50) {
      // Dark backgrounds: use light text (WCAG AA: 4.5:1 minimum)
      // Using hsl(0, 0%, 96%) for high contrast on dark backgrounds
      return 'hsl(0, 0%, 96%)';
    } else {
      // Light backgrounds: use dark text (WCAG AA: 4.5:1 minimum)
      // Using hsl(0, 0%, 12%) for high contrast on light backgrounds
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);

  // Calculate tone slider text color with proper contrast
  // At 50% tone, use dark text
  const toneSliderTextColor = useMemo(() => {
    if (tone < 50) {
      // Dark backgrounds: use light text
      return 'hsl(0, 0%, 96%)';
    } else {
      // Light backgrounds (50%+): use dark text
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);

  // Calculate logo drop shadow for lighter modes
  const logoShadow = useMemo(() => {
    if (tone > 50) {
      // Add drop shadow in lighter modes to make logo stand out
      // Increased intensity for better visibility at 75% and 88% tone
      return 'drop-shadow(0 2px 12px rgba(0, 0, 0, 0.25))';
    }
    return 'none';
  }, [tone]);

  // Calculate adaptive hover background for buttons
  const buttonHoverBackground = useMemo(() => {
    if (tone <= 50) {
      // Dark backgrounds: use light hover
      return 'rgba(255, 255, 255, 0.1)';
    } else {
      // Light backgrounds: use dark hover
      return 'rgba(0, 0, 0, 0.1)';
    }
  }, [tone]);

  // Calculate pill text color - needs to contrast with pill background (var(--elev))
  // Pill background is lighter at higher tones, so text should be dark earlier
  const pillTextColor = useMemo(() => {
    if (tone <= 40) {
      // Dark backgrounds: use light text
      return 'hsl(0, 0%, 96%)';
    } else {
      // Light backgrounds (40%+): use dark text for contrast with light pill
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);

  // Valid tone values: 0%, 12%, 25%, 38%, 50%, 63%, 75%, 88%, 100%
  const validToneValues = [0, 12, 25, 38, 50, 63, 75, 88, 100];

  // Snap to nearest valid tone value
  const snapToValidTone = (value: number): number => {
    return validToneValues.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };

  const handleToneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(event.target.value);
    const snappedValue = snapToValidTone(rawValue);
    setTone(snappedValue);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(event.target as Node)) {
        setIsHamburgerOpen(false);
      }
    };

    if (isMenuOpen || isHamburgerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isHamburgerOpen]);

  const handleNavigateToAccount = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-account'));
  };

  const handleNavigateToBilling = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-billing'));
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setIsMenuOpen(false);
  };

  return (
    <header
      className="relative backdrop-blur-xl border-b z-50"
      style={{
        background: `color-mix(in oklab, ${headerBackground} 85%, transparent 15%)`,
        borderColor: 'color-mix(in oklab, var(--border) 60%, transparent 40%)',
        height: '120px',
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-full flex items-center">
        {/* Desktop Layout - 1024px+ */}
        <div className="hidden lg:flex items-center w-full">
          {/* Left side - Logo */}
          <div className="flex items-center gap-3 pl-[11px]">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-dashboard'))}
              className="cursor-pointer transition-opacity hover:opacity-80"
              aria-label="Go to dashboard"
            >
            <img
              src="/images/UpscaleForge-Logo_500px_sm.png"
              alt="Upscale Forge Logo"
              className="w-[100px] h-auto"
                style={{ filter: logoShadow }}
            />
            </button>
          </div>

          {/* Right side - New Upscale Button, Tone Slider, Status, Upscales, Notifications, User Menu */}
          <div className="flex items-center gap-3 sm:gap-4 ml-auto" style={{ width: '90%', justifyContent: 'flex-end' }}>
            {/* New Upscale Button */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('start-new-upscale'))}
              className="font-medium transition-all duration-300 whitespace-nowrap"
              style={{ 
                color: headerTextColor, 
                fontSize: '16px', 
                transform: 'translate(-100px, -3px)',
                textShadow: hoveredButton === 'new-upscale' 
                  ? `0 0 8px var(--primary), 0 0 12px var(--primary), 0 0 16px var(--primary)` 
                  : 'none',
              }}
              onMouseEnter={() => setHoveredButton('new-upscale')}
              onMouseLeave={() => setHoveredButton(null)}
              aria-label="Start a new upscale session"
            >
              <span style={{ fontSize: '24px' }}>+</span> New Upscale
            </button>
            {/* Tone Slider */}
            <div className="flex items-center gap-3 rounded-full border px-4 py-2 shadow-lg"
              style={{
                background: 'color-mix(in oklab, var(--elev) 50%, transparent 50%)',
                borderColor: 'color-mix(in oklab, var(--border) 60%, transparent 40%)',
                boxShadow: 'var(--shadow-1)',
              }}
            >
            <input
              type="range"
              min={0}
              max={100}
                step={1}
              value={tone}
              onChange={handleToneChange}
              className="tone-slider"
            />
              <span className="text-xs font-semibold tabular-nums" style={{ color: toneSliderTextColor }}>
              {tone}%
            </span>
            <button
              type="button"
              onClick={isLabOpen ? closeLab : openLab}
              className="text-xs font-semibold transition-colors underline-offset-4 hover:underline"
                style={{ color: toneSliderTextColor }}
            >
              {isLabOpen ? 'Close UI Lab' : 'Open UI Lab'}
            </button>
          </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 shrink-0 rounded-full ${
                  isActive ? 'bg-emerald-400' : 'bg-red-500'
                } transition-all duration-300`}
              ></div>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: headerTextColor }}>
                {isActive ? 'Upscaler Active' : 'Upscaler Inactive'}
              </span>
            </div>

            <div
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 hover:shadow-lg shadow-lg whitespace-nowrap"
              style={{
                background: 'color-mix(in oklab, var(--elev) 80%, transparent 20%)',
                borderColor: 'var(--border)',
                color: pillTextColor,
                boxShadow: 'var(--shadow-1)',
              }}
            >
              <span>{remainingUpscales.toLocaleString()} Tokens</span>
          </div>

          <button
              className={`p-2 rounded-lg transition-all duration-300 ${
              hoveredButton === 'bell'
                  ? 'scale-110'
                  : ''
            }`}
              style={{
                color: headerTextColor,
                background: hoveredButton === 'bell' ? buttonHoverBackground : 'transparent',
              }}
            onMouseEnter={() => setHoveredButton('bell')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <Bell className="w-5 h-5" />
          </button>

          {/* History Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-history'))}
            className="p-2 rounded-lg transition-all duration-300 -translate-y-[3px]"
            style={{ 
              color: headerTextColor,
              background: hoveredButton === 'history' ? buttonHoverBackground : 'transparent',
            }}
            onMouseEnter={() => setHoveredButton('history')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <History className="w-5 h-5" />
          </button>

            <div className="relative" ref={menuRef}>
            <div
              className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer"
              style={{ 
                background: isMenuOpen 
                  ? 'color-mix(in oklab, var(--elev) 60%, transparent 40%)' 
                  : 'transparent' 
              }}
              onMouseEnter={(e) => {
                if (!isMenuOpen) {
                  e.currentTarget.style.background = 'color-mix(in oklab, var(--elev) 60%, transparent 40%)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isMenuOpen) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-md border"
                style={{ background: 'var(--elev)', borderColor: 'var(--border)' }}
              >
                {displayName !== 'Guest' ? (
                  <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                )}
              </div>
            </div>

              {/* Desktop User Dropdown Menu */}
            {isMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-lg border shadow-lg z-50"
                style={{
                  background: 'var(--elev)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <div className="py-1">
                  <button
                    onClick={handleNavigateToAccount}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Account & Settings</span>
                  </button>
                  <button
                    onClick={handleNavigateToBilling}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Billing</span>
                  </button>
                  <div
                    className="my-1"
                    style={{ borderTop: `1px solid var(--border)` }}
                  />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Mobile & Tablet Layout - < 1024px */}
        <div className="lg:hidden flex items-center relative w-full h-full">
          {/* Left side - Hamburger menu and New button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative" ref={hamburgerMenuRef}>
              <button
                onClick={() => setIsHamburgerOpen(!isHamburgerOpen)}
                className="p-2 rounded-lg transition-all duration-300 hover:scale-110"
                style={{
                  color: headerTextColor,
                  background: isHamburgerOpen ? buttonHoverBackground : 'transparent',
                }}
              >
                {isHamburgerOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              {/* Hamburger menu dropdown */}
              {isHamburgerOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-lg border shadow-lg z-50"
                  style={{
                    background: 'var(--elev)',
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--shadow-1)',
                  }}
                >
                  <div className="py-2">
                    {/* Tone Slider */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={tone}
                          onChange={handleToneChange}
                          className="tone-slider flex-1"
                        />
                        <span className="text-xs font-semibold tabular-nums whitespace-nowrap" style={{ color: toneSliderTextColor }}>
                          {tone}%
                        </span>
                      </div>
                    </div>

                    {/* Remaining Tokens */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div
                        className="px-4 py-2 rounded-full text-sm font-semibold border text-center"
                        style={{
                          background: 'color-mix(in oklab, var(--elev) 80%, transparent 20%)',
                          borderColor: 'var(--border)',
                          color: pillTextColor,
                          boxShadow: 'var(--shadow-1)',
                        }}
                      >
                        <span>{remainingUpscales.toLocaleString()} Tokens</span>
                      </div>
                    </div>

                    {/* Notifications */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Bell className="w-4 h-4" />
                      <span>Notifications</span>
                    </button>

                    {/* User Menu Items */}
                    <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => {
                          handleNavigateToAccount();
                          setIsHamburgerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Account & Settings</span>
                      </button>
                      <button
                        onClick={() => {
                          handleNavigateToBilling();
                          setIsHamburgerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Billing</span>
                      </button>
                      <div
                        className="my-1"
                        style={{ borderTop: `1px solid var(--border)` }}
                      />
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsHamburgerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:opacity-80"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'color-mix(in oklab, var(--surface) 50%, var(--elev) 50%)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>

                    {/* User Avatar */}
                    <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shadow-md border shrink-0"
                          style={{ background: 'var(--elev)', borderColor: 'var(--border)' }}
                        >
                          {displayName !== 'Guest' ? (
                            <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                              {displayName.charAt(0).toUpperCase()}
                            </span>
                          ) : (
                            <User className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          )}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {displayName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('start-new-upscale'))}
              className="text-sm font-medium transition-all duration-300"
              style={{ 
                color: headerTextColor,
                textShadow: hoveredButton === 'new-upscale-mobile' 
                  ? `0 0 6px var(--primary), 0 0 10px var(--primary), 0 0 14px var(--primary)` 
                  : 'none',
              }}
              onMouseEnter={() => setHoveredButton('new-upscale-mobile')}
              onMouseLeave={() => setHoveredButton(null)}
              aria-label="Start a new upscale session"
            >
              <span style={{ fontSize: '18px' }}>+</span> New
            </button>
          </div>

          {/* Center - Logo (centered horizontally and vertically) */}
          <div className="flex-1 flex justify-center items-center">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-dashboard'))}
              className="cursor-pointer transition-opacity hover:opacity-80"
              aria-label="Go to dashboard"
            >
              <img
                src="/images/UpscaleForge-Logo_500px_sm.png"
                alt="Upscale Forge Logo"
                className="w-[100px] h-auto"
                style={{ filter: logoShadow }}
              />
            </button>
          </div>

          {/* Right side - UI Lab icon (left) and Upscaler Active indicator (far right) */}
          <div className="flex items-center gap-3 flex-shrink-0 pb-0">
            {/* UI Lab button */}
            <button
              type="button"
              onClick={isLabOpen ? closeLab : openLab}
              className="p-2 rounded-lg transition-all duration-300 hover:scale-110"
              style={{
                color: headerTextColor,
                background: hoveredButton === 'palette' ? buttonHoverBackground : 'transparent',
              }}
              onMouseEnter={() => setHoveredButton('palette')}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <Palette className="w-5 h-5" />
            </button>

            {/* Upscaler Active indicator (far right) */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 shrink-0 rounded-full ${
                  isActive ? 'bg-emerald-400' : 'bg-red-500'
                } transition-all duration-300`}
              ></div>
              <span className="text-sm font-medium whitespace-nowrap hidden sm:inline" style={{ color: headerTextColor }}>
                {isActive ? 'Upscaler Active' : 'Upscaler Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
