import path from 'node:path';
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
Object.assign(process.env, { LOCAL_DB_PATH: path.resolve('.verification/business.db'), LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', REQUIRE_PROD_AUTH: 'false', KEYSTONE_API_KEY: '' });
const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/business-preview', root: process.cwd(), resolve: { alias: { '@': process.cwd() } }, css: { postcss: { plugins: [tailwindcss()] } }, plugins: [vinext()], server: { host: '127.0.0.1', port: 5236, strictPort: true } });
await server.listen(); server.printUrls();
