import { defineConfig, devices } from '@playwright/test';

// Locally we drive the browser that is already installed (no download). CI installs Chromium.
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

// Software WebGL so the 3D world renders in headless runs. Specs that do not look at the
// world switch WebGL off in the page (see e2e/support/test.ts), so the machine is not busy
// rasterising a scene nobody is judging.
const launchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

const PORT = 4173;

// Set PW_SKIP_BUILD=1 to serve the build that is already in .next-e2e (iterating on specs).
const skipBuild = process.env.PW_SKIP_BUILD === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The scene is software-rendered and several engineers share the machine: two browsers at a time.
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Every date in the suite is local to one fixed zone, so the saved-state fixtures
    // (which store local day keys) mean the same thing on every machine.
    timezoneId: 'Asia/Kolkata',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel, launchOptions } },
  ],
  webServer: {
    command: skipBuild ? 'npm run preview' : 'npm run build && npm run preview',
    url: `http://localhost:${PORT}/privacy`,
    // Its own output folder, so the suite can run while the dev server is up. No AI key: the
    // coach must answer through the offline coach, which is the path under test.
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      AI_API_KEY: '',
      AI_PROVIDER: '',
      GROQ_API_KEY: '',
      GEMINI_API_KEY: '',
      MISTRAL_API_KEY: '',
      OPENROUTER_API_KEY: '',
      CLOUDFLARE_AI_TOKEN: '',
      SAMBANOVA_API_KEY: '',
      NVIDIA_API_KEY: '',
      COHERE_API_KEY: '',
      CEREBRAS_API_KEY: '',
      HUGGINGFACE_API_KEY: '',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
