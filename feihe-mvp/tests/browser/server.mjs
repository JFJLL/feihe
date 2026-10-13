import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { startFeishuFixture } from './feishu-fixture.mjs';

// Local, disposable database. Never load the application's credential config.
mkdirSync('.verification', { recursive: true });
process.env.LOCAL_DB_PATH = path.resolve('.verification/browser.db');
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
await startFeishuFixture();
const server = await createServer({
  configFile: false, cacheDir: 'node_modules/.vite/v3-browser',
  root: process.cwd(),
  resolve: { alias: { '@': process.cwd() } },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [
    {
      name: 'external-feishu-test-provider',
      enforce: 'pre',
      // Replace only the vendor HTTP origin in this disposable test build.
      // Every local route, authentication check, import and SQL write is real.
      transform(code, id) {
        if (/\/(?:lib\/feishu-[^/]+|app\/api\/feishu\/(?:inspect|sync)\/route)\.ts(?:\?|$)/.test(id.replaceAll('\\', '/'))) {
          return code.replaceAll('https://open.feishu.cn', 'http://127.0.0.1:5187');
        }
      },
    },
    vinext(),
  ],
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
});
await server.listen();
server.printUrls();
