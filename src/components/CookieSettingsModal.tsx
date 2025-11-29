import React, { useState } from 'react';
import { X, Cookie, Shield, BarChart3, Megaphone, Palette, Check, Info } from 'lucide-react';
import { useCookieConsent, CookiePreferences } from '../contexts/CookieContext';

interface CookieCategory {
  id: keyof CookiePreferences;
  name: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  details: string[];
}

const cookieCategories: CookieCategory[] = [
  {
    id: 'essential',
    name: 'Essential Cookies',
    description: 'Required for the website to function properly. Cannot be disabled.',
    icon: <Shield className="w-5 h-5" />,
    required: true,
    details: [
      'User authentication and session management',
      'Security features and fraud prevention',
      'Load balancing and server optimization',
      'Cookie consent preferences storage',
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website.',
    icon: <BarChart3 className="w-5 h-5" />,
    required: false,
    details: [
      'Page view and session tracking',
      'Feature usage analytics',
      'Performance monitoring',
      'Error tracking and debugging',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Cookies',
    description: 'Used to deliver relevant advertisements and track campaign effectiveness.',
    icon: <Megaphone className="w-5 h-5" />,
    required: false,
    details: [
      'Personalized advertising',
      'Campaign performance tracking',
      'Retargeting across platforms',
      'Social media integration',
    ],
  },
  {
    id: 'preferences',
    name: 'Preference Cookies',
    description: 'Remember your settings and preferences for a better experience.',
    icon: <Palette className="w-5 h-5" />,
    required: false,
    details: [
      'Theme and display preferences',
      'Language settings',
      'UI customizations',
      'Recently used features',
    ],
  },
];

export function CookieSettingsModal() {
  const { showSettings, closeSettings, acceptSelected, rejectAll, state } = useCookieConsent();
  
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: state.preferences.analytics,
    marketing: state.preferences.marketing,
    preferences: state.preferences.preferences,
  });
  
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  if (!showSettings) return null;

  const handleToggle = (id: keyof CookiePreferences) => {
    if (id === 'essential') return; // Cannot toggle essential
    setPreferences(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAcceptSelected = () => {
    acceptSelected(preferences);
  };

  const handleRejectAll = () => {
    rejectAll();
  };

  const toggleExpand = (id: string) => {
    setExpandedCategory(prev => prev === id ? null : id);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
        onClick={closeSettings}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[85vh] z-[10001] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98), rgba(20, 20, 30, 0.98))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 shrink-0">
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
              <h3 className="text-lg font-semibold text-white">Cookie Settings</h3>
              <p className="text-sm text-gray-400">Manage your cookie preferences</p>
            </div>
          </div>
          <button
            onClick={closeSettings}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <p className="text-gray-300 text-sm mb-6">
            We use different types of cookies to optimize your experience on our website. 
            Click on the categories below to learn more and customize your preferences. 
            Essential cookies cannot be disabled as they are required for the website to function.
          </p>

          {/* Cookie Categories */}
          <div className="space-y-3">
            {cookieCategories.map((category) => (
              <div 
                key={category.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Category Header */}
                <div className="p-4 flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: category.required 
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)' 
                        : preferences[category.id]
                          ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                          : 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {category.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{category.name}</h4>
                      {category.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{category.description}</p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(category.id)}
                    disabled={category.required}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
                      category.required ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    style={{
                      background: category.required || preferences[category.id]
                        ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                        : 'rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300"
                      style={{
                        transform: category.required || preferences[category.id] 
                          ? 'translateX(28px)' 
                          : 'translateX(4px)',
                      }}
                    />
                  </button>

                  {/* Expand Button */}
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white shrink-0"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedCategory === category.id && (
                  <div className="px-4 pb-4 pt-0">
                    <div 
                      className="rounded-lg p-3"
                      style={{ background: 'rgba(0, 0, 0, 0.2)' }}
                    >
                      <p className="text-xs text-gray-400 mb-2">This category includes:</p>
                      <ul className="space-y-1">
                        {category.details.map((detail, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="w-3 h-3 text-green-400 shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-white/10 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRejectAll}
              className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 text-gray-300 hover:text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              Reject All
            </button>
            
            <button
              onClick={handleAcceptSelected}
              className="flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 text-white"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                boxShadow: '0 4px 20px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
              }}
            >
              Accept Selected
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-3">
            You can change your preferences at any time from the footer menu.
          </p>
        </div>
      </div>
    </>
  );
}

export default CookieSettingsModal;

