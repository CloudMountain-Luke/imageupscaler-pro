import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeSnapshot {
  tone: number;
  mode: ThemeMode;
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

const buildTheme = (tone: number): ThemeSnapshot => {
  const sanitizedTone = clamp(Math.round(tone), 10, 90);
  const isDark = sanitizedTone < 50;

  // At 10% tone (full dark mode): surface = 2% (black), elev = 8% (very dark charcoal), border = 18% (charcoal)
  // At 50% tone (transition): surface = 20%, elev = 28%, border = 38%
  const surfaceL = clamp(isDark ? Math.max(2, sanitizedTone * 0.2) : sanitizedTone - 12, 2, 96);
  const elevL = clamp(isDark ? Math.max(8, sanitizedTone * 0.8) : sanitizedTone - 6, 8, 98);
  const borderL = clamp(isDark ? Math.max(18, sanitizedTone * 1.8) : sanitizedTone - 22, 18, 90);

  const primaryL = clamp(isDark ? sanitizedTone + 48 : sanitizedTone - 26, 22, 86);
  const secondaryL = clamp(isDark ? sanitizedTone + 52 : sanitizedTone - 18, 24, 88);
  const accentL = clamp(isDark ? sanitizedTone + 38 : sanitizedTone - 16, 18, 80);

  const textLightness = isDark ? 96 : 12;
  const mutedLightness = isDark ? 76 : 40;
  const onPrimary = isDark ? toHsl(216, 48, 14) : toHsl(0, 0, 98);

  const tokens: Record<string, string> = {
    primary: toHsl(240, isDark ? 60 : 75, primaryL),
    secondary: toHsl(260, isDark ? 55 : 70, secondaryL),
    accent: toHsl(200, isDark ? 50 : 65, accentL),
    surface: toHsl(222, isDark ? 6 : 34, surfaceL),
    elev: toHsl(222, isDark ? 8 : 40, elevL),
    border: toHsl(222, isDark ? 10 : 32, borderL),
    text: toHsl(isDark ? 210 : 225, isDark ? 8 : 42, textLightness),
    muted: toHsl(220, isDark ? 6 : 24, mutedLightness, isDark ? 0.75 : 0.7),
    'on-primary': onPrimary,
    'focus-ring': `0 0 0 3px ${toHsl(240, isDark ? 60 : 75, primaryL, isDark ? 0.4 : 0.4)}`,
    'shadow-1': isDark
      ? '0 32px 70px rgba(8, 14, 26, 0.65)'
      : '0 26px 60px rgba(15, 23, 42, 0.18)',
    'shadow-2': isDark
      ? '0 25px 60px rgba(88, 93, 255, 0.25)'
      : '0 45px 95px rgba(88, 93, 255, 0.28)',
    radius: '18px',
  };

  return {
    tone: sanitizedTone,
    mode: isDark ? 'dark' : 'light',
    tokens,
  };
};

const CURRENT_TONE_KEY = 'ufo-theme.currentTone';
const SAVED_TONE_KEY = 'ufo-theme.savedTone';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  initialTone?: number;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialTone = 60,
  children,
}) => {
  const getStoredTone = useCallback(
    (key: string, fallback: number) => {
      if (typeof window === 'undefined') return fallback;
      const stored = window.localStorage.getItem(key);
      if (!stored) return fallback;
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? clamp(Math.round(parsed), 10, 90) : fallback;
    },
    []
  );

  const initialClampedTone = clamp(Math.round(initialTone), 10, 90);

  const [tone, setToneState] = useState<number>(() =>
    getStoredTone(CURRENT_TONE_KEY, initialClampedTone)
  );
  const [savedTone, setSavedToneState] = useState<number>(() =>
    getStoredTone(SAVED_TONE_KEY, initialClampedTone)
  );
  const [isLabOpen, setIsLabOpen] = useState(false);

  const theme = useMemo(() => buildTheme(tone), [tone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CURRENT_TONE_KEY, String(tone));
  }, [tone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVED_TONE_KEY, String(savedTone));
  }, [savedTone]);

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

    root.dataset.themeMode = theme.mode;
    root.dataset.themeTone = String(theme.tone);

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
    };
  }, [theme.tokens, theme.mode, theme.tone]);

  const setTone = useCallback((value: number) => {
    setToneState(clamp(Math.round(value), 10, 90));
  }, []);

  const saveTone = useCallback(() => {
    setSavedToneState((prev) => {
      const next = clamp(Math.round(tone), 10, 90);
      return prev === next ? prev : next;
    });
  }, [tone]);

  const restoreTone = useCallback(() => {
    setTone(savedTone);
  }, [savedTone, setTone]);

  const resetTone = useCallback(() => {
    setTone(initialClampedTone);
  }, [initialClampedTone, setTone]);

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
