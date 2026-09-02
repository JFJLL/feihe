import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
  vars: {
    SITE_ORIGIN: process.env.SITE_ORIGIN || 'http://127.0.0.1:5173',
    KEYSTONE_API_KEY: process.env.KEYSTONE_API_KEY || '',
    KEYSTONE_BASE_URL: process.env.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1',
    KEYSTONE_MODEL: process.env.KEYSTONE_MODEL || 'gpt-5.6-terra',
    KEYSTONE_IMAGE_MODEL: process.env.KEYSTONE_IMAGE_MODEL || 'gpt-image-2',
    XHS_BASE_URL: process.env.XHS_BASE_URL || '',
    XHS_COMMENT_L1_PAGE_SIZE: process.env.XHS_COMMENT_L1_PAGE_SIZE || '20',
    XHS_COMMENT_L2_PAGE_SIZE: process.env.XHS_COMMENT_L2_PAGE_SIZE || '20',
    XHS_SEARCH_PAGE_SIZE: process.env.XHS_SEARCH_PAGE_SIZE || '60',
    XHS_REQUEST_TIMEOUT_SECONDS: process.env.XHS_REQUEST_TIMEOUT_SECONDS || '30',
    OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID || '',
    OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET || '',
    OSS_ENDPOINT: process.env.OSS_ENDPOINT || '',
    OSS_BUCKET: process.env.OSS_BUCKET || '',
    OSS_COOKIE_OBJECT: process.env.OSS_COOKIE_OBJECT || '',
  },
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
