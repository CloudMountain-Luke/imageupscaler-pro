import React from 'react';
import { ExternalLink } from 'lucide-react';

export function Footer() {
  const handleNavigate = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
  };

  return (
    <footer className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          <div className="mb-4 md:mb-0">
            <img 
              src="/CMG Logo_2023_Landscape_300px-42.png" 
              alt="CMG Logo" 
              className="w-[120px] h-auto mx-auto md:mx-0"
            />
            <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
              Professional AI-powered image upscaling for creators and businesses
            </p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end space-x-4 md:space-x-6 text-sm mb-4 md:mb-0">
            <button 
              onClick={() => handleNavigate('navigate-to-terms')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => handleNavigate('navigate-to-privacy')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => handleNavigate('navigate-to-refund')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Refund Policy
            </button>
          </div>
        </div>
        <div className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} CMG. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
