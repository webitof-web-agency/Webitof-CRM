import { bindModalEvents, closeModal } from './components/modal.js';
import { bindSidebar } from './components/sidebar.js';
import { initRouter, route } from './router.js';
import { createSeedState, ensureStateShape } from './seed.js';
import { loadAllState } from './storage.js';
import { getState, setState } from './state.js';
import { showToast } from './utils/helpers.js';
import { checkAndGenerateRecurringInvoices, checkPaymentDueReminders } from './utils/automation.js';

function initApp() {
  const theme = localStorage.getItem('webitof_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const persistedState = loadAllState();
  setState(ensureStateShape(persistedState || createSeedState()), !persistedState);
  bindSidebar();
  bindModalEvents();
  bindGlobalEvents();
  checkAndGenerateRecurringInvoices();
  checkPaymentDueReminders();
  initRouter();
}

function bindGlobalEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="toggle-sidebar"]')) {
      document.body.classList.toggle('sidebar-open');
    }
    
    const themeBtn = event.target.closest('[data-action="toggle-theme"]');
    if (themeBtn) {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('webitof_theme', nextTheme);
      
      const nextIcon = nextTheme === 'dark'
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      themeBtn.innerHTML = nextIcon;
      showToast(`Theme changed to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.body.classList.remove('sidebar-open');
      closeModal();
    }
  });

  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.classList.toggle('has-value', el.value !== '');
    }

    const search = el.closest('#globalSearch');
    if (!search) return;
    const term = search.value.trim().toLowerCase();
    if (!term) return;
    const state = getState();
    const match = state.clients.find((client) => (
      `${client.name} ${client.companyName} ${client.email} ${client.mobile}`.toLowerCase().includes(term)
    ));
    if (match && event.inputType !== 'deleteContentBackward') {
      showToast(`Found ${match.companyName || match.name}. Open Clients to filter.`);
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.classList.toggle('has-value', el.value !== '');
    }
  });

  window.addEventListener('storage', () => {
    const persistedState = loadAllState();
    if (persistedState) setState(ensureStateShape(persistedState), false);
    route();
  });
}

initApp();
