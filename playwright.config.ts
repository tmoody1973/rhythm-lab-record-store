import { defineConfig, devices } from '@playwright/test';

// Its own port: never reuse a dev server someone already has running on 5317.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:5318' },
  webServer: { command: 'npm run dev -- --port 5318 --strictPort', port: 5318, reuseExistingServer: false },
  projects: [{
    name: 'chromium',
    // Software WebGL so the 3D shop renders in headless CI machines without a GPU.
    use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  }],
});
