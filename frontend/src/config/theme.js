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
    // These defaults will be overridden by the user's primaryColor
    primary: '#3b82f6',
    
    // Core Layout Colors
    background: '#f8fafc',
    surface: '#ffffff',
    surface2: '#f1f5f9',
    border: 'rgba(15, 23, 42, 0.09)',

    // Typography 
    text: {
      main: '#0f172a',      // Used for Titles
      muted: '#475569',     // Used for Subtitles/Descriptions
    },

    // Sidebar specifically requested to be bright/light
    sidebar: {
      bg: '#ffffff',
      text: '#94a3b8',      // Lighter slate for inactive icons/text
      border: '#e2e8f0',
    }
  }
};

function dispatchThemeUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('theme-updated'));
  }
}

/**
 * Injects CSS variables to the document root to globally apply the theme.
 * @param {string} userPrimaryColor 
 */
export function applyTheme(userPrimaryColor) {
  if (typeof document === 'undefined') return;

  const primary = userPrimaryColor || systemTheme.colors.primary;
  const root = document.documentElement.style;

  // Set Core Dynamic Colors
  root.setProperty('--primary', primary);
  root.setProperty('--accent', primary);
  root.setProperty('--primary-foreground', '#ffffff');
  root.setProperty('--accent-foreground', '#ffffff');
  
  // Set Layout Backgrounds & Surfaces
  root.setProperty('--background', systemTheme.colors.background);
  root.setProperty('--surface', systemTheme.colors.surface);
  root.setProperty('--surface-2', systemTheme.colors.surface2);
  root.setProperty('--border', systemTheme.colors.border);

  // Set Typography Colors
  root.setProperty('--text-main', systemTheme.colors.text.main);
  root.setProperty('--text', systemTheme.colors.text.main);
  root.setProperty('--text-muted', systemTheme.colors.text.muted);

  // Set Sidebar Specific Colors
  root.setProperty('--sidebar-bg', systemTheme.colors.sidebar.bg);
  root.setProperty('--sidebar-border', systemTheme.colors.sidebar.border);
  root.setProperty('--sidebar-text', systemTheme.colors.sidebar.text);
  root.setProperty('--sidebar-bg-active', hexToRgba(primary, 0.12));
  root.setProperty('--sidebar-text-active', primary);

  dispatchThemeUpdated();
}

export function applyUiSettings(ui = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement.style;
  root.setProperty('--radius-input', ui.inputRadius || '0.75rem');
  root.setProperty('--radius-button', ui.buttonRadius || '0.5rem');
  root.setProperty('--radius-card', ui.cardRadius || '1.5rem');
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

// Auto-apply on module load to fix Hot-Reloading (HMR) issues
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
