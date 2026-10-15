const { pool } = require('../config/db');

async function updateLogos() {
  try {
    const res = await pool.query("SELECT company, payload, branding FROM app_settings WHERE id = 'default'");
    const current = res.rows[0] || {};
    const company = current.company || {};
    company.logoUrl = '/assets/images/horizontal-logo.png';
    const payload = current.payload || {};
    payload.logos = {
      primary: '/assets/images/horizontal-logo.png',
      primaryDark: '/assets/images/horizontal-white-logo.png',
      sidebar: '/assets/images/horizontal-logo.png',
      sidebarDark: '/assets/images/horizontal-white-logo.png',
      sidebarCollapsed: '/assets/images/round-logo.png',
      sidebarCollapsedDark: '/assets/images/webitof-icon-white.png',
      quotation: '/assets/images/main-logo.png',
      favicon: '/assets/images/round-logo.png',
      loginLight: '/assets/images/webitof-icon.png',
      loginDark: '/assets/images/webitof-icon-white.png'
    };
    payload.invoiceTheme = {
      primaryColor: '#4361EE',
      watermarkUrl: '/assets/images/invoice_watermark.png'
    };
    const branding = current.branding || {};
    branding.primaryColor = '#4361ee';
    if (!branding.accentColor) branding.accentColor = '#5e1cd5';
    payload.branding = branding;

    await pool.query(
      "UPDATE app_settings SET company = $1, payload = $2, branding = $3, updated_at = NOW() WHERE id = 'default'",
      [JSON.stringify(company), JSON.stringify(payload), JSON.stringify(branding)]
    );
    console.log('SUCCESS: database app_settings updated with logos, primary color #4361ee and watermark');
    process.exit(0);
  } catch (err) {
    console.error('Error updating logos:', err);
    process.exit(1);
  }
}

updateLogos();
