import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

// Cookie consent categories
export interface CookiePreferences {
  essential: boolean; // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export interface CookieConsentState {
  hasConsented: boolean;
  preferences: CookiePreferences;
  consentDate: string | null;
  consentVersion: string;
}

interface CookieContextValue {
  state: CookieConsentState;
  showBanner: boolean;
  showSettings: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  acceptSelected: (preferences: Partial<CookiePreferences>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  closeBanner: () => void;
  resetConsent: () => void;
  hasConsent: (category: keyof CookiePreferences) => boolean;
}

const COOKIE_CONSENT_KEY = 'upscale-forge-cookie-consent';
const CONSENT_VERSION = '1.0.0'; // Increment when policy changes to re-prompt users

const defaultPreferences: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

const defaultState: CookieConsentState = {
  hasConsented: false,
  preferences: defaultPreferences,
  consentDate: null,
  consentVersion: CONSENT_VERSION,
};

const CookieContext = createContext<CookieContextValue | undefined>(undefined);

export function CookieProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CookieConsentState>(defaultState);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved consent on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CookieConsentState;
        
        // Check if consent version matches - if not, re-prompt
        if (parsed.consentVersion !== CONSENT_VERSION) {
          setShowBanner(true);
          return;
        }
        
        setState(parsed);
        setShowBanner(false);
      } else {
        // No saved consent, show banner
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  // Save consent to localStorage and set cookie
  const saveConsent = useCallback((preferences: CookiePreferences) => {
    const newState: CookieConsentState = {
      hasConsented: true,
      preferences: { ...preferences, essential: true }, // Essential always true
      consentDate: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    };
    
    setState(newState);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newState));
    
    // Also set a cookie for server-side detection
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    document.cookie = `cookie_consent=true; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
    
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  const acceptAll = useCallback(() => {
    saveConsent({
      essential: true,
      analytics: true,
      marketing: true,
      preferences: true,
    });
  }, [saveConsent]);

  const rejectAll = useCallback(() => {
    saveConsent({
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
  }, [saveConsent]);

  const acceptSelected = useCallback((preferences: Partial<CookiePreferences>) => {
    saveConsent({
      essential: true,
      analytics: preferences.analytics ?? false,
      marketing: preferences.marketing ?? false,
      preferences: preferences.preferences ?? false,
    });
  }, [saveConsent]);

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const closeBanner = useCallback(() => {
    // Closing banner without action = reject all (GDPR compliant)
    rejectAll();
  }, [rejectAll]);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    document.cookie = 'cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setState(defaultState);
    setShowBanner(true);
  }, []);

  const hasConsent = useCallback((category: keyof CookiePreferences): boolean => {
    if (category === 'essential') return true;
    return state.hasConsented && state.preferences[category];
  }, [state]);

  const value = useMemo<CookieContextValue>(() => ({
    state,
    showBanner,
    showSettings,
    acceptAll,
    rejectAll,
    acceptSelected,
    openSettings,
    closeSettings,
    closeBanner,
    resetConsent,
    hasConsent,
  }), [state, showBanner, showSettings, acceptAll, rejectAll, acceptSelected, openSettings, closeSettings, closeBanner, resetConsent, hasConsent]);

  return (
    <CookieContext.Provider value={value}>
      {children}
    </CookieContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieProvider');
  }
  return context;
}

// Hook to check if a specific cookie category is allowed
export function useCookieCategory(category: keyof CookiePreferences): boolean {
  const { hasConsent } = useCookieConsent();
  return hasConsent(category);
}

