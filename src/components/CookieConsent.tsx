import React from 'react';
import { Cookie, X } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieContext';

export function CookieConsent() {
  const { showBanner, acceptAll, rejectAll, openSettings, closeBanner } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-2 md:p-3">
      <div 
        className="max-w-3xl mx-auto rounded-lg overflow-hidden shadow-lg"
        style={{
          background: 'rgba(25, 25, 35, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="px-3 py-2 md:px-4 md:py-3">
          {/* Content Row */}
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div 
              className="w-6 h-6 rounded flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              }}
            >
              <Cookie className="w-3.5 h-3.5 text-white" />
            </div>
            
            {/* Text */}
            <p className="text-xs text-gray-300 flex-1">
              We use cookies to enhance your experience.{' '}
              <button
                onClick={openSettings}
                className="text-white underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Customize
              </button>
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={rejectAll}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/10"
              >
                Reject
              </button>
              
              <button
                onClick={acceptAll}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                }}
              >
                Accept
              </button>
              
              <button
                onClick={closeBanner}
                className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-white"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
