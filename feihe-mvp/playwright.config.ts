import { defineConfig } from '@playwright/test';
const evidenceRoot = process.env.FEIHE_E2E_OUTPUT_ROOT || '../docs/v3-targeted-remediation';
const baseURL = process.env.FEIHE_E2E_BASE_URL || 'http://127.0.0.1:5186';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  outputDir: evidenceRoot + '/browser-results',
  reporter: [['list'], ['html', { outputFolder: evidenceRoot + '/browser-report', open: 'never' }], ['json', { outputFile: evidenceRoot + '/browser-report/results.json' }]],
  use: {
    channel: 'chromium',
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: 'on',
    screenshot: 'on',
  },
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
