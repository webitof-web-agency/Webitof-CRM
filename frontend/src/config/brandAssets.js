// Brand logos are static files shipped with the app (frontend/public/assets/images), not settings.
// Nothing about them is stored in the database. To change a logo, replace the file at its path
// (same name) or point the entry below at a new file, then rebuild/deploy the frontend.
const IMAGES = '/assets/images';

export const BRAND_LOGOS = Object.freeze({
  primary: `${IMAGES}/horizontal-logo.png`,
  primaryDark: `${IMAGES}/horizontal-white-logo.png`,
  sidebar: `${IMAGES}/horizontal-logo.png`,
  sidebarDark: `${IMAGES}/horizontal-white-logo.png`,
  sidebarCollapsed: `${IMAGES}/round-logo.png`,
  sidebarCollapsedDark: `${IMAGES}/webitof-icon-white.png`,
  quotation: `${IMAGES}/main-logo.png`,
  favicon: `${IMAGES}/round-logo.png`,
  loginLight: `${IMAGES}/webitof-icon.png`,
  loginDark: `${IMAGES}/webitof-icon-white.png`
});

// Shown read-only in Settings → Branding.
export const BRAND_LOGO_SLOTS = [
  { key: 'primary', label: 'Primary logo (light mode)', size: '1000×250px', dark: false },
  { key: 'primaryDark', label: 'Primary logo (dark mode)', size: '1000×250px', dark: true },
  { key: 'sidebar', label: 'Sidebar expanded (light mode)', size: '1000×250px', dark: false },
  { key: 'sidebarDark', label: 'Sidebar expanded (dark mode)', size: '1000×250px', dark: true },
  { key: 'sidebarCollapsed', label: 'Sidebar collapsed (light mode)', size: '250×250px', dark: false },
  { key: 'sidebarCollapsedDark', label: 'Sidebar collapsed (dark mode)', size: '250×250px', dark: true },
  { key: 'quotation', label: 'Quotation / proposal logo', size: 'Proposals & SOW', dark: false },
  { key: 'favicon', label: 'Favicon', size: '64×64px', dark: false },
  { key: 'loginLight', label: 'Login screen logo (light mode)', size: 'Icon / logo', dark: false },
  { key: 'loginDark', label: 'Login screen logo (dark mode)', size: 'Icon / logo', dark: true }
];
