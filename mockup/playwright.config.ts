import { defineConfig } from '@playwright/test';

// Uses the system Chrome when CHROME_CHANNEL=chrome (no browser download); otherwise Playwright's Chromium.
const channel = process.env.CHROME_CHANNEL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    ...(channel ? { channel } : {}),
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run build && npx vite preview --port 4173', port: 4173, reuseExistingServer: true },
});
