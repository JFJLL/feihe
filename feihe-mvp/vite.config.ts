import crypto from 'node:crypto';

export function devAuthGatewayPlugin() {
  return {
    name: 'feihe-dev-auth-gateway',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const devSecret = process.env.FEIHE_DEV_LOCAL_SECRET;
        const gatewaySecret = process.env.FEIHE_AUTH_GATEWAY_SECRET;
        const isProd = process.env.NODE_ENV === 'production' || process.env.REQUIRE_PROD_AUTH === 'true';

        // When plugin is disabled or in production, never touch headers; preserve legitimate gateway signatures
        if (!devSecret || !gatewaySecret || isProd) {
          return next();
        }

        // In dev runner mode, strip any client/caller-supplied identity headers first
        delete req.headers['x-feihe-user-id'];
        delete req.headers['x-feihe-auth-timestamp'];
        delete req.headers['x-feihe-auth-signature'];
        delete req.headers['x-user-id'];
        delete req.headers['x-unauthenticated'];
        delete req.headers['x-feihe-dev-mode'];

        // Server listener check (must be listening on loopback, not 0.0.0.0 or LAN IP)
        const addr = server.httpServer?.address();
        if (typeof addr === 'object' && addr !== null) {
          const listenHost = addr.address;
          const isLoopbackListen = listenHost === '127.0.0.1' || listenHost === '::1' || listenHost === 'localhost';
          if (!isLoopbackListen) {
            return next();
          }
        }

        // Loopback remote socket check (prevents LAN / external connections from getting dev identity)
        const remote = req.socket?.remoteAddress || '';
        const isLoopbackRemote = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
        if (!isLoopbackRemote) {
          return next();
        }

        // Host header check (must be loopback host, prevents Host header spoofing from non-loopback)
        const hostHeader = (req.headers.host || '').split(':')[0].toLowerCase();
        const isLoopbackHost = hostHeader === 'localhost' || hostHeader === '127.0.0.1' || hostHeader === '::1' || hostHeader === '[::1]';
        if (!isLoopbackHost) {
          return next();
        }

        // Cross-Origin / Sec-Fetch-Site check:
        // Reject cross-site origins (e.g. malicious site in browser attempting CSRF to loopback dev server)
        const originHeader = req.headers.origin;
        if (originHeader) {
          try {
            const originHost = new URL(originHeader).hostname.toLowerCase();
            const isLoopbackOrigin = originHost === 'localhost' || originHost === '127.0.0.1' || originHost === '::1' || originHost === '[::1]';
            if (!isLoopbackOrigin) {
              return next();
            }
          } catch {
            return next();
          }
        }

        const secFetchSite = req.headers['sec-fetch-site'];
        const secFetchMode = req.headers['sec-fetch-mode'];
        // Reject cross-site subresource/API requests (CSRF), but allow top-level user navigations (e.g. clicking link in desktop app)
        if (secFetchSite === 'cross-site' && secFetchMode !== 'navigate') {
          return next();
        }

        // Sign trusted developer identity from standard schema bootstrap (user-editor)
        const userId = process.env.FEIHE_DEV_USER_ID || 'user-editor';
        const timestamp = String(Date.now());
        const signature = crypto.createHmac('sha256', gatewaySecret).update(`${userId}\n${timestamp}`).digest('hex');

        req.headers['x-feihe-user-id'] = userId;
        req.headers['x-feihe-auth-timestamp'] = timestamp;
        req.headers['x-feihe-auth-signature'] = signature;
        req.headers['x-feihe-dev-mode'] = '1';

        // Synchronize rawHeaders for Cloudflare Miniflare / workerd adapter
        if (Array.isArray(req.rawHeaders)) {
          const stripped = new Set(['x-feihe-user-id', 'x-feihe-auth-timestamp', 'x-feihe-auth-signature', 'x-user-id', 'x-unauthenticated', 'x-feihe-dev-mode']);
          const newRaw: string[] = [];
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            if (!stripped.has(String(req.rawHeaders[i]).toLowerCase())) {
              newRaw.push(req.rawHeaders[i], req.rawHeaders[i + 1]);
            }
          }
          newRaw.push('x-feihe-user-id', userId, 'x-feihe-auth-timestamp', timestamp, 'x-feihe-auth-signature', signature, 'x-feihe-dev-mode', '1');
          req.rawHeaders = newRaw;
        }

        next();
      });
    },
  };
}

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
    FEIHE_AUTH_GATEWAY_SECRET: process.env.FEIHE_AUTH_GATEWAY_SECRET || '',
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

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Local dev server runs directly on Node runtime so it accesses the single main data/local.db.
  // Cloudflare plugin is enabled only when explicitly requested or during production build.
  const isCloudflare = process.env.ENABLE_CLOUDFLARE_RUNTIME === 'true' || command === 'build';

  const plugins: any[] = [
    devAuthGatewayPlugin(),
    vinext(),
    sites(),
  ];

  if (isCloudflare) {
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    plugins.push(
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      })
    );
  }

  return {
    optimizeDeps: {
      exclude: ['cloudflare:workers'],
    },
    ssr: {
      external: ['cloudflare:workers'],
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins,
  };
});
