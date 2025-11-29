/**
 * Analytics Hook
 * 
 * Placeholder for Google Analytics integration.
 * Only tracks events if the user has consented to analytics cookies.
 * 
 * To enable Google Analytics:
 * 1. Add your GA4 Measurement ID to .env as VITE_GA_MEASUREMENT_ID
 * 2. Uncomment the gtag script loading in this file
 * 3. The hook will automatically check for analytics consent before tracking
 */

import { useCallback, useEffect, useState } from 'react';
import { getCookie, COOKIE_NAMES } from '../utils/cookies';

// Google Analytics Measurement ID (add to .env when ready)
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Check if user has consented to analytics cookies
 */
function hasAnalyticsConsent(): boolean {
  try {
    const consentCookie = getCookie(COOKIE_NAMES.CONSENT);
    if (!consentCookie) return false;
    const consent = JSON.parse(consentCookie);
    return consent?.analytics === true;
  } catch {
    return false;
  }
}

/**
 * Load Google Analytics script (only call if user has consented)
 */
function loadGoogleAnalytics(): void {
  if (!GA_MEASUREMENT_ID) {
    console.log('[Analytics] No GA Measurement ID configured');
    return;
  }

  if (window.gtag) {
    console.log('[Analytics] Already loaded');
    return;
  }

  // Create script element
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true, // GDPR compliance
    cookie_flags: 'SameSite=Lax;Secure',
  });

  console.log('[Analytics] Google Analytics loaded');
}

/**
 * Hook for tracking analytics events
 * 
 * @example
 * const { trackEvent, trackPageView } = useAnalytics();
 * 
 * // Track a custom event
 * trackEvent('button_click', { button_name: 'signup' });
 * 
 * // Track a page view
 * trackPageView('/pricing');
 */
export function useAnalytics() {
  const [isEnabled, setIsEnabled] = useState(false);

  // Check consent and load analytics on mount
  useEffect(() => {
    const hasConsent = hasAnalyticsConsent();
    setIsEnabled(hasConsent);

    if (hasConsent && GA_MEASUREMENT_ID) {
      loadGoogleAnalytics();
    }
  }, []);

  /**
   * Track a custom event
   */
  const trackEvent = useCallback((
    eventName: string,
    eventParams?: Record<string, any>
  ) => {
    if (!isEnabled || !window.gtag) {
      console.log('[Analytics] Event not tracked (disabled or not loaded):', eventName);
      return;
    }

    window.gtag('event', eventName, eventParams);
    console.log('[Analytics] Event tracked:', eventName, eventParams);
  }, [isEnabled]);

  /**
   * Track a page view
   */
  const trackPageView = useCallback((pagePath: string, pageTitle?: string) => {
    if (!isEnabled || !window.gtag) {
      console.log('[Analytics] Page view not tracked (disabled or not loaded):', pagePath);
      return;
    }

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
    console.log('[Analytics] Page view tracked:', pagePath);
  }, [isEnabled]);

  /**
   * Track when a user signs up
   */
  const trackSignUp = useCallback((method: string = 'email') => {
    trackEvent('sign_up', { method });
  }, [trackEvent]);

  /**
   * Track when a user starts an upscale
   */
  const trackUpscaleStart = useCallback((scale: number, quality: string) => {
    trackEvent('upscale_start', { scale, quality });
  }, [trackEvent]);

  /**
   * Track when an upscale completes
   */
  const trackUpscaleComplete = useCallback((scale: number, quality: string, duration: number) => {
    trackEvent('upscale_complete', { scale, quality, duration_seconds: duration });
  }, [trackEvent]);

  /**
   * Track when a user subscribes to a plan
   */
  const trackSubscription = useCallback((planName: string, billingCycle: 'monthly' | 'yearly') => {
    trackEvent('purchase', { 
      plan: planName, 
      billing_cycle: billingCycle,
      currency: 'USD',
    });
  }, [trackEvent]);

  return {
    isEnabled,
    trackEvent,
    trackPageView,
    trackSignUp,
    trackUpscaleStart,
    trackUpscaleComplete,
    trackSubscription,
  };
}

export default useAnalytics;

