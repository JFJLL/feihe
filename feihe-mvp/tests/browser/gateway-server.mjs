// Separate disposable server executing the production identity branch, not an auth mock.
process.env.REQUIRE_PROD_AUTH = 'true';
process.env.FEIHE_AUTH_GATEWAY_SECRET = process.env.FEIHE_GATEWAY_TEST_SECRET || 'isolated-gateway-fixture-only';
process.env.FEIHE_E2E_BASE_URL = process.env.FEIHE_GATEWAY_BASE_URL || 'http://127.0.0.1:5226';
process.env.FEIHE_TEST_VENDOR_ORIGIN = process.env.FEIHE_GATEWAY_VENDOR_ORIGIN || 'http://127.0.0.1:5227';
process.env.FEIHE_TEST_DB_PATH = process.env.FEIHE_GATEWAY_DB_PATH || '.verification/product-gateway-browser.db';
process.env.FEIHE_TEST_CACHE = 'node_modules/.vite/product-gateway-browser';
await import('./server.mjs');
