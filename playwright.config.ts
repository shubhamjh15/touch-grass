import { defineConfig, devices } from '@playwright/test';

// Locally we drive the browser that is already installed (no download). CI installs Chromium.
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

// Software WebGL so the 3D world renders in headless runs.
const launchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel, launchOptions } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // Its own output folder, so the suite can run while the dev server is up.
    env: { NEXT_DIST_DIR: '.next-e2e' },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
