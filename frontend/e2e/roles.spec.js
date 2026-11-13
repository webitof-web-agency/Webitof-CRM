// Every role logs in through the real login form, then opens every guarded page of the app:
//   - a page the role may not open shows "Access denied", one it may open does not
//   - the sidebar only links to pages the role may open
//   - allowed pages load without an uncaught script error or a 5xx from the API
// Requests to any host other than the local stack are blocked, so the live API is never reached.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const users = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '.auth', 'users.json'), 'utf8'));

// "path" -> permissions, read from the <PermissionRoute> guards in App.jsx.
function guardedRoutes() {
  const app = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'App.jsx'), 'utf8');
  const routes = [];
  // The guard must sit inside the same <Route> as the path (no other path= in between).
  const pattern = /path="([^"]+)"(?:(?!path=")[\s\S])*?<PermissionRoute\s+(?:permission="([^"]+)"|permissions=\{\[([^\]]+)\]\})/g;
  for (const match of app.matchAll(pattern)) {
    const [, routePath, single, list] = match;
    if (routePath.includes(':') || routePath.includes('*') || routePath.startsWith('/')) continue;
    const permissions = single ? [single] : list.split(',').map((p) => p.trim().replace(/'/g, ''));
    routes.push({ path: `/app/${routePath}`, permissions });
  }
  return routes;
}

const ROUTES = guardedRoutes();
const can = (user, permissions) => user.isSuperAdmin || permissions.some((p) => user.permissions.includes(p));
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//;
// Static assets the page may load from the web; anything else external (an API) is blocked.
const ASSET_HOSTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

async function login(page, user) {
  await page.goto('/#/login');
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/#\/app(\/|$)/, { timeout: 20000 });
}

test('the route map was read from App.jsx', () => {
  expect(ROUTES.length).toBeGreaterThan(20);
});

for (const [role, user] of Object.entries(users)) {
  test(`${role}: guarded pages, sidebar and errors`, async ({ page }) => {
    test.setTimeout(240000);
    const external = [];
    const serverErrors = [];
    const scriptErrors = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (LOCAL.test(url) || ASSET_HOSTS.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      external.push(url);
      return route.abort();
    });
    page.on('response', (res) => {
      if (res.status() >= 500 && LOCAL.test(res.url())) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    await login(page, user);

    // Sidebar: every /app link shown must be a page this role may open.
    // HashRouter: sidebar links look like "#/app/leads".
    const links = await page.locator('nav a[href*="/app/"], aside a[href*="/app/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href').replace(/^#/, '')));
    const forbiddenLinks = links.filter((href) => {
      const route = ROUTES.find((r) => r.path === href.split('?')[0]);
      return route && !can(user, route.permissions);
    });
    expect(forbiddenLinks, `${role} sees links to pages it cannot open`).toEqual([]);

    const wrong = [];
    for (const route of ROUTES) {
      page.removeAllListeners('pageerror');
      page.on('pageerror', (error) => scriptErrors.push(`${route.path}: ${error.message}`));
      await page.goto(`/#${route.path}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const denied = await page.getByText('You do not have permission to open this page.').isVisible().catch(() => false);
      const allowed = can(user, route.permissions);
      if (allowed === denied) wrong.push(`${route.path} (${route.permissions.join('|')}): ${denied ? 'denied but allowed' : 'opened but not allowed'}`);
    }
    await page.screenshot({ path: path.join(import.meta.dirname, '.auth', `${role}-last.png`) });

    expect(wrong, `${role}: wrong access`).toEqual([]);
    expect(external, `${role}: requests left the local stack`).toEqual([]);
    expect(serverErrors, `${role}: API 5xx while browsing`).toEqual([]);
    expect(scriptErrors, `${role}: uncaught script errors`).toEqual([]);
  });
}
