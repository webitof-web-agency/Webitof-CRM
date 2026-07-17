import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { themes } from '../config/themes';
import { applyTheme } from '../config/theme';

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
      mode: 'light'
    };
  } catch {
    return { theme: 'aurora', mode: 'light' };
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme().theme);
  const [mode, setMode] = useState(() => readStoredTheme().mode);

  useEffect(() => {
    // Only keeping this for compatibility with old toggle switch if it exists,
    // though the user wants to remove dark mode. 
    // The main heavy lifting is done in the other useEffect via applyTheme.
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('webitof-ui-settings');
      if (raw) {
        const ui = JSON.parse(raw);
        if (ui.inputRadius) document.documentElement.style.setProperty('--radius-input', ui.inputRadius);
        if (ui.buttonRadius) document.documentElement.style.setProperty('--radius-button', ui.buttonRadius);
        if (ui.cardRadius) document.documentElement.style.setProperty('--radius-card', ui.cardRadius);
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

      // Apply Branding colors and modes
      const rawBranding = window.localStorage.getItem('webitof-branding');
      let primaryColor = null;
      if (rawBranding) {
        const branding = JSON.parse(rawBranding);
        if (branding.primaryColor) {
          primaryColor = branding.primaryColor;
        }
      }
      applyTheme(primaryColor);
    } catch (err) {}
  }, []);

  const value = useMemo(() => {
    const activeTheme = themes.find((item) => item.key === theme) || themes[0];
    return {
      theme,
      mode,
      themes,
      accent: activeTheme.accent,
      setTheme,
      setMode,
      toggleMode: () => setMode((current) => (current === 'dark' ? 'light' : 'dark'))
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
