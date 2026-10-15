import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { themes } from '../config/themes';
import { applyTheme, applyThemeMode, applyUiSettings } from '../config/theme';

const STORAGE_KEY = 'webitof-theme-preference';

const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') return { theme: 'aurora', mode: 'light' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { theme: 'aurora', mode: 'light' };
    const parsed = JSON.parse(raw);
    return {
      theme: themes.some((item) => item.key === parsed.theme) ? parsed.theme : 'aurora',
      mode: ['light', 'dark', 'system'].includes(parsed.mode) ? parsed.mode : 'light'
    };
  } catch {
    return { theme: 'aurora', mode: 'light' };
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme().theme);
  const [mode, setModeState] = useState(() => readStoredTheme().mode);

  // Sync mode changes with DOM & Storage
  useEffect(() => {
    applyThemeMode(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, mode }));
    } catch (e) {}
  }, [mode, theme]);

  // Listen to OS system color scheme changes if mode is 'system'
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyThemeMode('system');

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [mode]);

  // Initial load of custom UI settings, logos, and branding
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('webitof-ui-settings');
      if (raw) {
        const ui = JSON.parse(raw);
        applyUiSettings(ui);
      }
      const rawLogos = window.localStorage.getItem('webitof-logos');
      if (rawLogos) {
        const logos = JSON.parse(rawLogos);
        if (logos.favicon) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = logos.favicon;
        }
      }

      // Apply Branding colors
      const rawBranding = window.localStorage.getItem('webitof-branding');
      let primaryColor = '#4361ee';
      if (rawBranding) {
        try {
          const branding = JSON.parse(rawBranding);
          if (branding.primaryColor) {
            primaryColor = branding.primaryColor;
          }
        } catch (e) {}
      }
      applyTheme(primaryColor);

      // Fetch live public settings so unauthenticated / fresh browsers get updated branding
      fetch('/api/settings/public')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data?.branding?.primaryColor) {
            applyTheme(data.data.branding.primaryColor);
            try {
              window.localStorage.setItem('webitof-branding', JSON.stringify(data.data.branding));
            } catch (e) {}
          }
        })
        .catch(() => {});
    } catch (err) {}
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    const targetTheme = themes.find((item) => item.key === newTheme);
    if (targetTheme?.accent) {
      applyTheme(targetTheme.accent);
    }
  };

  const setMode = (newMode) => {
    applyThemeMode(newMode);
    setModeState(newMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, mode: newMode }));
    } catch (e) {}
  };

  const toggleMode = () => {
    let isCurrentlyDark = false;
    if (mode === 'system') {
      isCurrentlyDark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    } else {
      isCurrentlyDark = mode === 'dark';
    }
    const next = isCurrentlyDark ? 'light' : 'dark';
    applyThemeMode(next);
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, mode: next }));
    } catch (e) {}
  };

  const value = useMemo(() => {
    const activeTheme = themes.find((item) => item.key === theme) || themes[0];
    return {
      theme,
      mode,
      themes,
      accent: activeTheme.accent,
      setTheme,
      setMode,
      toggleMode
    };
  }, [mode, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
