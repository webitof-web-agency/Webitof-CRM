// UI role tests (e2e/*.spec.js). They run against a LOCAL stack only:
//   1. QA backend on its own port and database (see backend/tests/e2e/README.md)
//   2. this app in dev mode pointed at it:
//        VITE_API_URL=http://127.0.0.1:5055/api VITE_SOCKET_URL=http://127.0.0.1:5055 npx vite --port 5174
//   3. QA_API_URL=http://127.0.0.1:5055/api QA_DATABASE_URL=... npm run e2e
// Never point it at a production build: that one talks to the live API.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1440, height: 900 }
  }
});
