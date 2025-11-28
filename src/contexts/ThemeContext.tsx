import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'light' | 'dark';
type ColorScheme = 'flame' | 'forge' | 'cyber' | 'space' | 'brand';

interface ThemeSnapshot {
  tone: number;
  mode: ThemeMode;
  colorScheme: ColorScheme;
  tokens: Record<string, string>;
}

interface ThemeContextValue {
  tone: number;
  setTone: (value: number) => void;
  savedTone: number;
  saveTone: () => void;
  restoreTone: () => void;
  resetTone: () => void;
  mode: ThemeMode;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  tokens: Record<string, string>;
  initialTone: number;
  isLabOpen: boolean;
  openLab: () => void;
  closeLab: () => void;
  toggleLab: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toHsl = (h: number, s: number, l: number, alpha = 1) =>
  alpha === 1
    ? `hsl(${h}, ${s}%, ${l}%)`
    : `hsla(${h}, ${s}%, ${l}%, ${alpha})`;

// Color schemes based on Upscale Forge logo
const COLOR_SCHEMES = {
  flame: {
    // Yellow to Magenta flame gradient
    primaryH: 50, // Yellow
    secondaryH: 330, // Magenta  
    accentH: 30, // Orange
    name: 'Flame',
  },
  forge: {
    // Warm orange forge glow (balanced between pure orange and reddish)
    primaryH: 24, // Warm orange (between 30 and 18)
    secondaryH: 38, // Amber/golden
    accentH: 195, // Cyan (cool contrast)
    name: 'Forge',
  },
  cyber: {
    // Cyan text focus
    primaryH: 195, // Cyan
    secondaryH: 220, // Blue
    accentH: 50, // Yellow
    name: 'Cyber',
  },
  space: {
    // Purple theme starting at #A171FF (hsl(260, 100%, 72%)) at 0% tone
    primaryH: 260, // Purple matching #A171FF
    secondaryH: 270, // Slightly shifted purple
    accentH: 30, // Warm orange
    name: 'Space',
  },
  brand: {
    // Warm harmonious palette inspired by Upscale Forge logo
    primaryH: 28, // Warm orange (buttons, main UI elements)
    secondaryH: 45, // Golden amber (gradient harmony, secondary highlights)
    accentH: 200, // Cyan-blue (cool accent for contrast/highlights)
    name: 'Brand',
  },
};

const buildTheme = (tone: number, colorScheme: ColorScheme = 'flame'): ThemeSnapshot => {
  const sanitizedTone = clamp(Math.round(tone), 0, 100);
  const scheme = COLOR_SCHEMES[colorScheme];

  // Color system logic:
  // - Dark to Medium backgrounds (0-55%): Bright colors, bright text, glowing shadows
  // - Light backgrounds (55-100%): Dark colors, dark text, dark shadows
  const isBrightMode = sanitizedTone <= 55; // Bright colors for dark/medium backgrounds

  // Surface uses smooth interpolation from 0% (black) to 100% (white)
  const surfaceL = clamp(sanitizedTone, 0, 100);
  
  // Elevation and border adapt to background brightness
  // At 50%, make elev similar to 63% for consistent pill appearance
  const elevL = clamp(
    isBrightMode && sanitizedTone < 50 
      ? Math.max(12, sanitizedTone * 0.5) 
      : isBrightMode && sanitizedTone === 50
      ? 90  // Make 50% elev similar to 63% (96) for consistent pills
      : 96,
    12,
    98
  );
  const borderL = clamp(
    isBrightMode ? Math.max(20, sanitizedTone * 0.8) : 85,
    20,
    90
  );

  // Primary, Secondary, and Accent colors
  // Bright mode (dark/medium backgrounds): High lightness, high saturation for visibility
  // Light mode (light backgrounds): Lower lightness, good saturation for contrast
  let primaryL, secondaryL, accentL;
  let primaryS, secondaryS, accentS;
  
  if (isBrightMode) {
    // Bright, vibrant colors for dark/medium backgrounds
    // Use high lightness (65-80%) with high saturation for maximum visibility and aesthetic appeal
    // Smooth transition from 0% to 55% to avoid drastic changes
    const toneFactor = sanitizedTone / 55; // 0 to 1 from 0% to 55%
    
    // Special handling for Space scheme: start at #A171FF (hsl(260, 100%, 72%)) at 0%
    if (colorScheme === 'space') {
      // #A171FF = hsl(260, 100%, 72%) - starting color at 0%
      // Smoothly transition from this starting point
      const startL = 72; // Starting lightness at 0%
      const endL = 80;   // Target lightness at 55%
      const startS = 100; // Starting saturation at 0%
      const endS = 90;    // Target saturation at 55%
      
      // Smooth interpolation
      primaryL = clamp(startL + toneFactor * (endL - startL), 72, 80);
      secondaryL = clamp(startL + 2 + toneFactor * (endL - startL - 2), 74, 82);
      accentL = clamp(startL - 2 + toneFactor * (endL - startL + 2), 70, 78);
      
      // Smooth saturation transition
      primaryS = clamp(startS - toneFactor * (startS - endS), 90, 100);
      secondaryS = clamp(startS - 5 - toneFactor * (startS - endS - 5), 85, 95);
      accentS = clamp(startS - 10 - toneFactor * (startS - endS - 10), 80, 90);
      
      // Special adjustment at 50%: make purple brighter for better readability on medium grey
      if (sanitizedTone >= 48 && sanitizedTone <= 52) {
        const spaceFactor = Math.abs(sanitizedTone - 50) / 2; // 0 at 50%, 1 at 48% or 52%
        // Increase lightness at 50% for better contrast instead of decreasing
        const spaceAdjustment = (1 - spaceFactor) * 8; // Increase by up to 8% lightness at 50%
        primaryL = clamp(primaryL + spaceAdjustment, 72, 85);
        secondaryL = clamp(secondaryL + spaceAdjustment, 74, 87);
        accentL = clamp(accentL + spaceAdjustment, 70, 83);
        // Also increase saturation slightly for more vibrant purple
        primaryS = clamp(primaryS + (1 - spaceFactor) * 5, 90, 100);
        secondaryS = clamp(secondaryS + (1 - spaceFactor) * 5, 85, 100);
        accentS = clamp(accentS + (1 - spaceFactor) * 5, 80, 95);
      }
    } else {
      // Base lightness values that smoothly increase with tone for other schemes
      let basePrimaryL = 65 + toneFactor * 15;
      let baseSecondaryL = 67 + toneFactor * 15;
      let baseAccentL = 63 + toneFactor * 15;
      
      primaryL = clamp(basePrimaryL, 55, 80);
      secondaryL = clamp(baseSecondaryL, 57, 82);
      accentL = clamp(baseAccentL, 53, 78);
      primaryS = 90;
      secondaryS = 85;
      accentS = 80;
    }
  } else {
    // Darker, rich colors for light backgrounds
    // Use lower lightness (28-38%) with good saturation for contrast and readability
    // Smooth transition from bright mode (55%) to light mode (100%)
    // At 55%: start at ~73% lightness (matching bright mode end), smoothly transition to darker
    const lightFactor = (sanitizedTone - 55) / 45; // 0 to 1 from 55% to 100%
    
    // Smooth transition: start near bright mode values at 55%, gradually get darker
    // At 55%: ~73 lightness (from bright mode), at 100%: 28-38 lightness
    const startL = 73; // Match the end of bright mode
    const endL = 38;   // Target for light mode
    const range = startL - endL; // 35 lightness units to transition
    
    primaryL = clamp(startL - lightFactor * (range * 0.43), 28, 73); // 43% of range
    secondaryL = clamp(startL - lightFactor * (range * 0.41), 30, 73); // 41% of range  
    accentL = clamp(startL - lightFactor * (range * 0.45), 26, 73); // 45% of range
    
    // Saturation also transitions smoothly
    primaryS = clamp(90 - lightFactor * 8, 82, 90);
    secondaryS = clamp(85 - lightFactor * 8, 77, 85);
    accentS = clamp(80 - lightFactor * 8, 72, 80);
    
    // Special handling for Cyber scheme from 75% to 100%: use dark teal
    if (colorScheme === 'cyber' && sanitizedTone >= 75) {
      // Dark teal for better contrast on light backgrounds
      // Target: darker teal (around 40-45% lightness) from 75% to 100%
      const cyberLightFactor = (sanitizedTone - 75) / 25; // 0 at 75%, 1 at 100%
      // At 75%: start darker (~45% lightness), at 100%: even darker (~35% lightness)
      const darkTealStartL = 45;
      const darkTealEndL = 35;
      const darkTealL = darkTealStartL - cyberLightFactor * (darkTealStartL - darkTealEndL);
      
      primaryL = clamp(darkTealL, 35, 45); // Dark teal
      secondaryL = clamp(darkTealL + 2, 37, 47); // Slightly lighter secondary
      accentL = clamp(darkTealL - 2, 33, 43); // Slightly darker accent
      
      // Keep good saturation for vibrant dark teal
      primaryS = clamp(85 + cyberLightFactor * 5, 85, 90);
      secondaryS = clamp(80 + cyberLightFactor * 5, 80, 85);
      accentS = clamp(75 + cyberLightFactor * 5, 75, 80);
    }
    
    // Special handling for Flame scheme at 88%: use #F0D44E (hsl(50, 85%, 62%))
    if (colorScheme === 'flame' && sanitizedTone >= 86 && sanitizedTone <= 90) {
      const flameFactor = Math.abs(sanitizedTone - 88) / 2; // 0 at 88%, 1 at 86% or 90%
      // Target #F0D44E: hsl(50, 85%, 62%)
      const targetL = 62;
      const targetS = 85;
      const adjustmentL = (targetL - primaryL) * (1 - flameFactor);
      const adjustmentS = (targetS - primaryS) * (1 - flameFactor);
      primaryL = clamp(primaryL + adjustmentL, 60, 64);
      secondaryL = clamp(secondaryL + adjustmentL * 0.9, 62, 66);
      primaryS = clamp(primaryS + adjustmentS, 83, 87);
      secondaryS = clamp(secondaryS + adjustmentS * 0.95, 79, 83);
    }
    
    // Special handling for Forge scheme at 75%: use #F7B471 (hsl(30, 90%, 71%))
    if (colorScheme === 'forge' && sanitizedTone >= 73 && sanitizedTone <= 77) {
      const forgeFactor = Math.abs(sanitizedTone - 75) / 2; // 0 at 75%, 1 at 73% or 77%
      // Target #F7B471: hsl(30, 90%, 71%)
      const targetL = 71;
      const targetS = 90;
      const adjustmentL = (targetL - primaryL) * (1 - forgeFactor);
      const adjustmentS = (targetS - primaryS) * (1 - forgeFactor);
      primaryL = clamp(primaryL + adjustmentL, 69, 73);
      secondaryL = clamp(secondaryL + adjustmentL * 0.9, 71, 75);
      primaryS = clamp(primaryS + adjustmentS, 88, 92);
      secondaryS = clamp(secondaryS + adjustmentS * 0.95, 84, 88);
    }
    
    // Special handling for Space scheme at 63%: use #CCB5FE (hsl(260, 95%, 85%))
    if (colorScheme === 'space' && sanitizedTone >= 61 && sanitizedTone <= 65) {
      const spaceFactor = Math.abs(sanitizedTone - 63) / 2; // 0 at 63%, 1 at 61% or 65%
      // Target #CCB5FE: hsl(260, 95%, 85%)
      const targetL = 85;
      const targetS = 95;
      const adjustmentL = (targetL - primaryL) * (1 - spaceFactor);
      const adjustmentS = (targetS - primaryS) * (1 - spaceFactor);
      primaryL = clamp(primaryL + adjustmentL, 83, 87);
      secondaryL = clamp(secondaryL + adjustmentL * 0.9, 85, 89);
      primaryS = clamp(primaryS + adjustmentS, 93, 97);
      secondaryS = clamp(secondaryS + adjustmentS * 0.95, 89, 93);
    }
  }

  // Text colors: Bright for dark/medium backgrounds, dark for light backgrounds
  const textLightness = isBrightMode ? 96 : 12;
  const mutedLightness = isBrightMode ? 82 : 35;
  const onPrimary = isBrightMode ? toHsl(0, 0, 12) : toHsl(0, 0, 98);

  // Surface uses semi-transparent dark navy in dark mode (logo circle color)
  const surfaceColor = toHsl(0, 0, surfaceL); // Pure neutral grey

  // Shadows: Glowing colored shadows for dark/medium backgrounds, dark neutral shadows for light backgrounds
  const shadow1 = isBrightMode
    ? `0 32px 70px ${toHsl(scheme.primaryH, primaryS, primaryL, 0.4)}` // Glowing colored shadow
    : '0 26px 60px rgba(15, 23, 42, 0.15)'; // Dark neutral shadow
  
  const shadow2 = isBrightMode
    ? `0 25px 60px ${toHsl(scheme.primaryH, primaryS, primaryL, 0.35)}` // Glowing colored shadow
    : `0 45px 95px rgba(0, 0, 0, 0.2)`; // Dark neutral shadow

  const tokens: Record<string, string> = {
    primary: toHsl(scheme.primaryH, primaryS, primaryL),
    secondary: toHsl(scheme.secondaryH, secondaryS, secondaryL),
    accent: toHsl(scheme.accentH, accentS, accentL),
    surface: surfaceColor,
    elev: toHsl(isBrightMode ? 220 : 0, isBrightMode ? 30 : 0, elevL, isBrightMode ? 0.9 : 1),
    border: toHsl(isBrightMode ? 220 : 0, isBrightMode ? 20 : 8, borderL, isBrightMode ? 0.6 : 1),
    text: toHsl(isBrightMode ? 210 : 225, isBrightMode ? 10 : 25, textLightness),
    muted: toHsl(isBrightMode ? 220 : 225, isBrightMode ? 12 : 18, mutedLightness, isBrightMode ? 0.7 : 0.65),
    'on-primary': onPrimary,
    'focus-ring': `0 0 0 3px ${toHsl(scheme.primaryH, primaryS, primaryL, 0.4)}`,
    'shadow-1': shadow1,
    'shadow-2': shadow2,
    radius: '18px',
    
    // Logo-specific colors for UI elements
    'flame-yellow': 'hsl(50, 100%, 60%)',
    'flame-magenta': 'hsl(330, 100%, 60%)',
    'forge-orange': 'hsl(24, 100%, 55%)',
    'cyber-cyan': 'hsl(195, 100%, 65%)',
  };

  return {
    tone: sanitizedTone,
    mode: isBrightMode ? 'dark' : 'light',
    colorScheme,
    tokens,
  };
};

const CURRENT_TONE_KEY = 'ufo-theme.currentTone';
const SAVED_TONE_KEY = 'ufo-theme.savedTone';
const COLOR_SCHEME_KEY = 'ufo-theme.colorScheme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  initialTone?: number;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialTone = 10,
  children,
}) => {
  const getStoredTone = useCallback(
    (key: string, fallback: number) => {
      if (typeof window === 'undefined') return fallback;
      const stored = window.localStorage.getItem(key);
      if (!stored) return fallback;
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? clamp(Math.round(parsed), 0, 100) : fallback;
    },
    []
  );

  const getStoredColorScheme = useCallback((): ColorScheme => {
    if (typeof window === 'undefined') return 'flame';
    const stored = window.localStorage.getItem(COLOR_SCHEME_KEY);
    if (stored && ['flame', 'forge', 'cyber', 'space'].includes(stored)) {
      return stored as ColorScheme;
    }
    return 'flame';
  }, []);

  const initialClampedTone = clamp(Math.round(initialTone), 0, 100);

  const [tone, setToneState] = useState<number>(() =>
    getStoredTone(CURRENT_TONE_KEY, initialClampedTone)
  );
  const [savedTone, setSavedToneState] = useState<number>(() =>
    getStoredTone(SAVED_TONE_KEY, initialClampedTone)
  );
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(getStoredColorScheme);
  const [isLabOpen, setIsLabOpen] = useState(false);

  const theme = useMemo(() => buildTheme(tone, colorScheme), [tone, colorScheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CURRENT_TONE_KEY, String(tone));
  }, [tone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVED_TONE_KEY, String(savedTone));
  }, [savedTone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLOR_SCHEME_KEY, colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const previousStyles = new Map<string, string>();

    Object.entries(theme.tokens).forEach(([token, value]) => {
      const cssVar = `--${token}`;
      previousStyles.set(cssVar, root.style.getPropertyValue(cssVar));
      root.style.setProperty(cssVar, value);
    });

    const prevMode = root.dataset.themeMode;
    const prevTone = root.dataset.themeTone;
    const prevScheme = root.dataset.colorScheme;

    root.dataset.themeMode = theme.mode;
    root.dataset.themeTone = String(theme.tone);
    root.dataset.colorScheme = theme.colorScheme;

    return () => {
      previousStyles.forEach((value, cssVar) => {
        if (value) {
          root.style.setProperty(cssVar, value);
        } else {
          root.style.removeProperty(cssVar);
        }
      });

      if (prevMode === undefined) {
        delete root.dataset.themeMode;
      } else {
        root.dataset.themeMode = prevMode;
      }

      if (prevTone === undefined) {
        delete root.dataset.themeTone;
      } else {
        root.dataset.themeTone = prevTone;
      }

      if (prevScheme === undefined) {
        delete root.dataset.colorScheme;
      } else {
        root.dataset.colorScheme = prevScheme;
      }
    };
  }, [theme.tokens, theme.mode, theme.tone, theme.colorScheme]);

  const setTone = useCallback((value: number) => {
    setToneState(clamp(Math.round(value), 0, 100));
  }, []);

  const saveTone = useCallback(() => {
    setSavedToneState((prev) => {
      const next = clamp(Math.round(tone), 0, 100);
      return prev === next ? prev : next;
    });
  }, [tone]);

  const restoreTone = useCallback(() => {
    setTone(savedTone);
  }, [savedTone, setTone]);

  const resetTone = useCallback(() => {
    setTone(initialClampedTone);
  }, [initialClampedTone, setTone]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  }, []);

  const openLab = useCallback(() => setIsLabOpen(true), []);
  const closeLab = useCallback(() => setIsLabOpen(false), []);
  const toggleLab = useCallback(
    () => setIsLabOpen((prev) => !prev),
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      tone,
      setTone,
      savedTone,
      saveTone,
      restoreTone,
      resetTone,
      mode: theme.mode,
      colorScheme: theme.colorScheme,
      setColorScheme,
      tokens: theme.tokens,
      initialTone: initialClampedTone,
      isLabOpen,
      openLab,
      closeLab,
      toggleLab,
    }),
    [
      tone,
      setTone,
      savedTone,
      saveTone,
      restoreTone,
      resetTone,
      theme.mode,
      theme.colorScheme,
      setColorScheme,
      theme.tokens,
      initialClampedTone,
      isLabOpen,
      openLab,
      closeLab,
      toggleLab,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeLab = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeLab must be used within a ThemeProvider');
  }
  return ctx;
};

export const tonePresets = [
  { label: 'Light', value: 90 },
  { label: 'Mid', value: 50 },
  { label: 'Dark', value: 10 },
];

export const colorSchemes: Array<{ label: string; value: ColorScheme; description: string }> = [
  { label: 'Flame', value: 'flame', description: 'Yellow to magenta fire gradient' },
  { label: 'Forge', value: 'forge', description: 'Orange forge glow' },
  { label: 'Cyber', value: 'cyber', description: 'Cyan digital aesthetic' },
  { label: 'Space', value: 'space', description: 'Purple space aesthetic' },
  { label: 'Brand', value: 'brand', description: 'Upscale Forge logo colors' },
];
