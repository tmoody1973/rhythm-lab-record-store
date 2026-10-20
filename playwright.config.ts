import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:5317' },
  webServer: { command: 'npm run dev -- --port 5317 --strictPort', port: 5317, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
