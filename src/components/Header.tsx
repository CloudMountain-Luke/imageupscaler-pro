import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, CreditCard, Upload, Plus, ChevronDown, Settings, LogOut } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { useAuth } from '../contexts/AuthContext';


type SidebarState = 'open' | 'collapsed' | 'hidden';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarState: SidebarState;
  isApiConfigured: boolean;
  onLogout?: () => void;
}

export function Header({ onMenuClick, sidebarState, isApiConfigured, onLogout }: HeaderProps) {
  const { userStats, userProfile: realUserProfile } = useImageProcessing();
  const { user } = useAuth();
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [upscaleSettings] = React.useState({
    scale: 2,
    quality: 'photo',
    outputFormat: 'original',
  });

  // Calculate remaining upscales from database values
  const remainingUpscales = (() => {
    // Debug logging to see what values we have
    console.log('Header - userStats:', userStats);
    console.log('Header - realUserProfile:', realUserProfile);
    
    // First try to use the monthly limit minus current usage from userStats
    if (userStats?.monthly_upscales_limit && typeof userStats.current_month_upscales === 'number') {
      const remaining = Math.max(0, userStats.monthly_upscales_limit - userStats.current_month_upscales);
      console.log('Header - Using monthly limit calculation:', remaining);
      return remaining;
    }
    
    // Try to use credits_remaining from the real user profile
    if (realUserProfile?.credits_remaining && typeof realUserProfile.credits_remaining === 'number') {
      console.log('Header - Using credits_remaining:', realUserProfile.credits_remaining);
      return realUserProfile.credits_remaining;
    }
    
    // Try to use monthly_upscales_limit from the real user profile
    if (realUserProfile?.monthly_upscales_limit && typeof realUserProfile.monthly_upscales_limit === 'number') {
      const used = realUserProfile.current_month_upscales ?? 0;
      const remaining = Math.max(0, realUserProfile.monthly_upscales_limit - used);
      console.log('Header - Using profile monthly limit calculation:', remaining);
      return remaining;
    }
    
    console.log('Header - Using fallback value: 250');
    return 250;
  })();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    // Just show a notification that files should be uploaded in the main area
    if (acceptedFiles.length > 0) {
      // You could add a toast notification here if desired
      console.log('Please use the main upload area to select images for upscaling');
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    noClick: true, // Only allow drag & drop in header
  });

  return (
    <header 
      {...getRootProps()}
      className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50"
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          
          <div className="flex items-center justify-center flex-1 md:flex-none md:justify-start space-x-2">
            <img 
              src="/CMG Logo_2023_Landscape_300px-42.png" 
              alt="CMG Logo" 
             className="w-[150px] h-auto"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* API Status Indicator */}
          {isApiConfigured && (
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-900 dark:text-gray-100">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Upscaler Active</span>
            </div>
          )}
          
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 text-gray-900 dark:text-gray-100" style={{ borderColor: '#FF8C67' }}>
            <span>{remainingUpscales} Remaining</span>
          </div>
          
          {/* Account Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center space-x-1 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <User className="w-6 h-6 text-gray-700 dark:text-white" />
              <ChevronDown className={`w-4 h-4 text-gray-700 dark:text-white transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showAccountDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate-to-account'));
                    setShowAccountDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Account Settings</span>
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate-to-billing'));
                    setShowAccountDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Billing & Plans</span>
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-600" />
                <button
                  onClick={() => {
                    onLogout?.();
                    setShowAccountDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </header>
  );
}