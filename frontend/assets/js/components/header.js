import { escapeHtml } from '../utils/helpers.js';

export function renderHeader({ title = 'Dashboard', subtitle = '' } = {}) {
  const root = document.getElementById('header');
  if (!root) return;
  root.innerHTML = `
    <div class="page-heading">
      <button class="icon-btn mobile-menu-btn" type="button" data-action="toggle-sidebar" title="Menu">Menu</button>
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
    <div class="header-actions">
      <label class="search-box">
        <span>Search</span>
        <input type="search" id="globalSearch" placeholder="Search clients, invoices, projects">
      </label>
      <button class="icon-btn theme-toggle-btn" type="button" data-action="toggle-theme" title="Toggle Light/Dark Theme" style="min-width: 38px; display: inline-flex; align-items: center; justify-content: center;">
        ${localStorage.getItem('webitof_theme') === 'dark'
          ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
          : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        }
      </button>
      <a class="btn btn-secondary" href="#/clients/add">New Client</a>
      <a class="btn btn-primary" href="#/invoices/add">New Invoice</a>
    </div>
  `;
}
