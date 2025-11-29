/**
 * Cookie Utility Functions
 * 
 * Provides type-safe cookie management with proper attributes for security and compliance.
 */

export interface CookieOptions {
  /** Number of days until the cookie expires (default: 365) */
  days?: number;
  /** Cookie path (default: '/') */
  path?: string;
  /** SameSite attribute (default: 'Lax') */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Whether the cookie should only be sent over HTTPS (default: true in production) */
  secure?: boolean;
}

const DEFAULT_OPTIONS: CookieOptions = {
  days: 365,
  path: '/',
  sameSite: 'Lax',
  secure: window.location.protocol === 'https:',
};

/**
 * Set a cookie with the given name, value, and options
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const expires = new Date();
  expires.setTime(expires.getTime() + (opts.days! * 24 * 60 * 60 * 1000));
  
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookieString += `; expires=${expires.toUTCString()}`;
  cookieString += `; path=${opts.path}`;
  cookieString += `; SameSite=${opts.sameSite}`;
  
  if (opts.secure) {
    cookieString += '; Secure';
  }
  
  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 * @returns The cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  const nameEQ = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  
  return null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, path: string = '/'): void {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

// ============================================
// Specific Cookie Names Used by Upscale Forge
// ============================================

export const COOKIE_NAMES = {
  /** Cookie consent preferences */
  CONSENT: 'uf_cookie_consent',
  /** Theme/color scheme preference */
  THEME: 'uf_theme',
  /** Color scheme (flame, forge, cyber, space, brand) */
  COLOR_SCHEME: 'uf_color_scheme',
  /** Tone preference (0-100) */
  TONE: 'uf_tone',
  /** Google Analytics consent (for future use) */
  GA_CONSENT: 'uf_ga_consent',
} as const;

// ============================================
// Theme Preference Cookies
// ============================================

export interface ThemePreferences {
  colorScheme: string;
  tone: number;
}

/**
 * Save theme preferences to cookies (only if user has consented to preference cookies)
 */
export function saveThemePreferencesToCookie(prefs: ThemePreferences): void {
  setCookie(COOKIE_NAMES.COLOR_SCHEME, prefs.colorScheme, { days: 365 });
  setCookie(COOKIE_NAMES.TONE, String(prefs.tone), { days: 365 });
}

/**
 * Load theme preferences from cookies
 * @returns Theme preferences or null if not found
 */
export function loadThemePreferencesFromCookie(): ThemePreferences | null {
  const colorScheme = getCookie(COOKIE_NAMES.COLOR_SCHEME);
  const toneStr = getCookie(COOKIE_NAMES.TONE);
  
  if (colorScheme && toneStr) {
    const tone = parseInt(toneStr, 10);
    if (!isNaN(tone)) {
      return { colorScheme, tone };
    }
  }
  
  return null;
}

/**
 * Clear theme preference cookies
 */
export function clearThemePreferenceCookies(): void {
  deleteCookie(COOKIE_NAMES.COLOR_SCHEME);
  deleteCookie(COOKIE_NAMES.TONE);
}

