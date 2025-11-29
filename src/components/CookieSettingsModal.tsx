import React, { useState, useEffect } from 'react';
import { X, Cookie, Shield, BarChart3, Megaphone, Palette, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useCookieConsent, CookiePreferences } from '../contexts/CookieContext';

interface CookieCategory {
  id: keyof CookiePreferences;
  name: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  comingSoon?: boolean;
  details: string[];
}

const cookieCategories: CookieCategory[] = [
  {
    id: 'essential',
    name: 'Essential',
    description: 'Required for the website to function properly.',
    icon: <Shield className="w-4 h-4" />,
    required: true,
    details: [
      'User authentication (Supabase)',
      'Security and session management',
      'Cookie consent storage',
    ],
  },
  {
    id: 'preferences',
    name: 'Preferences',
    description: 'Remember your theme and display settings.',
    icon: <Palette className="w-4 h-4" />,
    required: false,
    details: [
      'Color scheme preference',
      'Theme tone (light/dark)',
      'UI customizations',
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Help us understand how visitors use our site.',
    icon: <BarChart3 className="w-4 h-4" />,
    required: false,
    comingSoon: true,
    details: [
      'Page view tracking',
      'Feature usage analytics',
      'Performance monitoring',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Used for advertising and campaign tracking.',
    icon: <Megaphone className="w-4 h-4" />,
    required: false,
    comingSoon: true,
    details: [
      'Personalized advertising',
      'Campaign performance',
      'Retargeting',
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

  // Sync preferences when state changes
  useEffect(() => {
    setPreferences({
      essential: true,
      analytics: state.preferences.analytics,
      marketing: state.preferences.marketing,
      preferences: state.preferences.preferences,
    });
  }, [state.preferences]);

  if (!showSettings) return null;

  const handleToggle = (id: keyof CookiePreferences) => {
    if (id === 'essential') return;
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000]"
        onClick={closeSettings}
      />
      
      {/* Modal - Centered, compact */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md max-h-[80vh] z-[10001] flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(25, 25, 35, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-white" />
            <h3 className="text-base font-semibold text-white">Cookie Settings</h3>
          </div>
          <button
            onClick={closeSettings}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Cookie Categories */}
          <div className="space-y-2">
            {cookieCategories.map((category) => (
              <div 
                key={category.id}
                className="rounded-lg overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {/* Category Row */}
                <div className="p-3 flex items-center gap-3">
                  {/* Icon */}
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
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
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white">{category.name}</span>
                      {category.required && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                          Required
                        </span>
                      )}
                      {category.comingSoon && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{category.description}</p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(category.id)}
                    disabled={category.required || category.comingSoon}
                    className={`relative w-10 h-5 rounded-full transition-all duration-200 shrink-0 ${
                      category.required || category.comingSoon ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                    style={{
                      background: category.required || (preferences[category.id] && !category.comingSoon)
                        ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                        : 'rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: category.required || (preferences[category.id] && !category.comingSoon)
                          ? 'translateX(22px)' 
                          : 'translateX(2px)',
                      }}
                    />
                  </button>

                  {/* Expand Button */}
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-white shrink-0"
                  >
                    {expandedCategory === category.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedCategory === category.id && (
                  <div className="px-3 pb-3">
                    <div 
                      className="rounded-lg p-2 text-xs"
                      style={{ background: 'rgba(0, 0, 0, 0.2)' }}
                    >
                      <ul className="space-y-1">
                        {category.details.map((detail, index) => (
                          <li key={index} className="flex items-center gap-2 text-gray-400">
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
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleRejectAll}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 text-gray-400 hover:text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              Reject All
            </button>
            
            <button
              onClick={handleAcceptSelected}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 text-white"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              }}
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieSettingsModal;
