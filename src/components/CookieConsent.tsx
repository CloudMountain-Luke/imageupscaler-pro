import React from 'react';
import { Cookie, Settings, X } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieContext';

export function CookieConsent() {
  const { showBanner, acceptAll, rejectAll, openSettings, closeBanner } = useCookieConsent();

  console.log('[CookieConsent] showBanner:', showBanner);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 md:p-4">
      <div 
        className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg"
        style={{
          background: 'rgba(25, 25, 35, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="p-4 md:p-5">
          {/* Content Row */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Icon and Text */}
            <div className="flex items-start md:items-center gap-3 flex-1">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                }}
              >
                <Cookie className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                We use cookies to enhance your experience. By continuing, you agree to our use of essential cookies.{' '}
                <button
                  onClick={openSettings}
                  className="text-white underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Customize
                </button>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={rejectAll}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/10"
              >
                Reject
              </button>
              
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                }}
              >
                Accept
              </button>
              
              <button
                onClick={closeBanner}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-500 hover:text-white ml-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
