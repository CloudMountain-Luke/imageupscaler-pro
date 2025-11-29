import React from 'react';
import { Cookie, Settings, X, Shield, ChevronRight } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieContext';

export function CookieConsent() {
  const { showBanner, acceptAll, rejectAll, openSettings, closeBanner } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]" />
      
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6">
        <div 
          className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98), rgba(20, 20, 30, 0.98))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                }}
              >
                <Cookie className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Cookie Preferences</h3>
                <p className="text-sm text-gray-400">We value your privacy</p>
              </div>
            </div>
            <button
              onClick={closeBanner}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              aria-label="Close cookie banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6">
            <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
              We use cookies to enhance your browsing experience, provide personalized content, and analyze our traffic. 
              By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or reject 
              non-essential cookies.
            </p>

            {/* Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Essential cookies always active</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Cookie className="w-4 h-4 text-blue-400" />
                <span>No third-party tracking</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Customize anytime</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={rejectAll}
                className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 text-gray-300 hover:text-white"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                Reject All
              </button>
              
              <button
                onClick={openSettings}
                className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 text-gray-300 hover:text-white"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <Settings className="w-4 h-4" />
                Customize
              </button>
              
              <button
                onClick={acceptAll}
                className="flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 text-white flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  boxShadow: '0 4px 20px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
                }}
              >
                Accept All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('show-privacy-policy'))}
                className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-2"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('show-terms'))}
                className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-2"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieConsent;

