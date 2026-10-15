// To calculate a transparent version of hex colors for backgrounds
function hexToRgba(hex, opacity) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')';
  }
  return hex;
}

export const systemTheme = {
  colors: {
    primary: '#4361ee',
    background: '#f8fafc',
    surface: '#ffffff',
    surface2: '#f1f5f9',
    border: 'rgba(15, 23, 42, 0.08)',
    text: {
      main: '#0f172a',
      muted: '#64748b',
    },
    sidebar: {
      bg: 'rgba(255, 255, 255, 0.88)',
      text: '#64748b',
      border: 'rgba(15, 23, 42, 0.06)',
    }
  }
};

function dispatchThemeUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('theme-updated'));
  }
}

/**
 * Injects CSS variables to the document root to globally apply brand primary color.
 * @param {string} userPrimaryColor 
 */
export function applyTheme(userPrimaryColor) {
  if (typeof document === 'undefined') return;

  const primary = userPrimaryColor || systemTheme.colors.primary;
  const root = document.documentElement.style;

  // Set Core Dynamic Colors
  root.setProperty('--primary', primary);
  root.setProperty('--accent', primary);
  root.setProperty('--primary-hover', hexToRgba(primary, 0.9));
  root.setProperty('--primary-subtle', hexToRgba(primary, 0.09));
  root.setProperty('--primary-foreground', '#ffffff');
  root.setProperty('--accent-foreground', '#ffffff');
  root.setProperty('--sidebar-text-active', primary);
  root.setProperty('--sidebar-bg-active', hexToRgba(primary, 0.12));

  // Clean up any stale inline overrides for layout/surfaces so CSS classes (:root and .dark) control them
  root.removeProperty('--background');
  root.removeProperty('--surface');
  root.removeProperty('--surface-2');
  root.removeProperty('--surface-3');
  root.removeProperty('--border');
  root.removeProperty('--border-muted');
  root.removeProperty('--border-glass');
  root.removeProperty('--text-main');
  root.removeProperty('--text');
  root.removeProperty('--text-muted');
  root.removeProperty('--sidebar-bg');
  root.removeProperty('--sidebar-border');
  root.removeProperty('--sidebar-text');

  dispatchThemeUpdated();
}

/**
 * Apply Light, Dark, or System mode to the document
 * @param {'light'|'dark'|'system'} mode 
 */
export function applyThemeMode(mode = 'light') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  // Clean up any inline overrides
  const rootStyle = root.style;
  rootStyle.removeProperty('--background');
  rootStyle.removeProperty('--surface');
  rootStyle.removeProperty('--surface-2');
  rootStyle.removeProperty('--surface-3');
  rootStyle.removeProperty('--border');
  rootStyle.removeProperty('--border-muted');
  rootStyle.removeProperty('--border-glass');
  rootStyle.removeProperty('--text-main');
  rootStyle.removeProperty('--text');
  rootStyle.removeProperty('--text-muted');
  rootStyle.removeProperty('--sidebar-bg');
  rootStyle.removeProperty('--sidebar-border');
  rootStyle.removeProperty('--sidebar-text');

  dispatchThemeUpdated();
}

export function applyUiSettings(ui = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement.style;
  root.setProperty('--radius-input', ui.inputRadius || '0.625rem');
  root.setProperty('--radius-button', ui.buttonRadius || '0.625rem');
  root.setProperty('--radius-card', ui.cardRadius || '1rem');
  dispatchThemeUpdated();
}

export function persistAndApplyThemeSettings(settings = {}) {
  if (typeof window === 'undefined') return;

  if (settings.ui) {
    window.localStorage.setItem('webitof-ui-settings', JSON.stringify(settings.ui));
    applyUiSettings(settings.ui);
  }

  if (settings.branding) {
    window.localStorage.setItem('webitof-branding', JSON.stringify(settings.branding));
    applyTheme(settings.branding.primaryColor);
  }

  if (settings.logos) {
    window.localStorage.setItem('webitof-logos', JSON.stringify(settings.logos));
    window.dispatchEvent(new Event('logos-updated'));
  }
}

// Auto-apply on module load
try {
  const rawBranding = window.localStorage.getItem('webitof-branding');
  let primaryColor = null;
  if (rawBranding) {
    const branding = JSON.parse(rawBranding);
    if (branding.primaryColor) {
      primaryColor = branding.primaryColor;
    }
  }
  applyTheme(primaryColor);
} catch (err) {
  // Silent fallback
}
