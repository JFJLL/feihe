import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  outputDir: '../docs/v3-targeted-remediation/browser-results',
  reporter: [['list'], ['html', { outputFolder: '../docs/v3-targeted-remediation/browser-report', open: 'never' }]],
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:5186',
    viewport: { width: 1280, height: 900 },
    trace: 'on',
    screenshot: 'on',
  },
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
