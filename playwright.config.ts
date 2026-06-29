import { defineConfig, devices } from '@playwright/test';

// The app is served by `ng serve` on :4200 and proxies /api → the backend on
// :3000 (see proxy.conf.json). The backend + database must be running for the
// full journey spec; the smoke spec only needs the frontend.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  // The journey spec is stateful (register → create → purchase → delete), so
  // keep things serial and deterministic.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Auto-start `ng serve` if it isn't already running. Set E2E_NO_SERVER=1 to
  // skip (e.g. when you run the dev server yourself).
  webServer: process.env.E2E_NO_SERVER ? undefined : {
    command: 'npm run start:dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
