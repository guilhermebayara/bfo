import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8788',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      'node scripts/e2e-setup.mjs && npm run build && wrangler dev --port 8788 --persist-to .wrangler/e2e/state',
    url: 'http://127.0.0.1:8788/api/health',
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: 'list',
});
