import { defineConfig, devices } from '@playwright/test';

// Its own port: never reuse a dev server someone already has running on 5317.
// The 3D shop renders in software (no GPU) here, which is CPU-heavy: few workers, generous time for it to start.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 1 : 2,
  use: { baseURL: 'http://localhost:5318' },
  webServer: { command: 'npm run dev -- --port 5318 --strictPort', port: 5318, reuseExistingServer: false },
  projects: [{
    name: 'chromium',
    // Software WebGL so the 3D shop renders in headless CI machines without a GPU.
    use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  }],
});
