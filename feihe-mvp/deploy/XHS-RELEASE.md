# XHS dashboard deployment

## Topology and scope

- Public origin: `https://xhs.red-magic.cn`.
- ECS edge Nginx -> `127.0.0.1:18087` (FRP) -> LAN dashboard `127.0.0.1:5013`.
- LAN repository: `/home/user/models/feihe`; use Node >=22.13, not the system Node 12.
- PM2 application names: `feihe-local`, `xhs-industry-monitor`. Never restart all applications.
- The ECS `/home/red/work/moneyboost/feihe` directory belongs to the older QR publisher, not this dashboard. Do not deploy this code there.

## Release procedure

1. Back up SQLite with its online backup API, preserve the original worktree and generated documents, then create a detached release worktree from the reviewed commit.
2. Link the release's `config.json`, `feihe-mvp/data`, and `feihe-mvp/runtime` to the existing protected deployment resources. Install/build with the Node 22 runtime; do not replace the database with a development copy.
3. Run `node scripts/migrate-spu-departments.mjs` for a read-only preview. After verifying all five projects and the backup, run with `--apply`. This only updates the requested SPUs and inserts missing standard departments; it preserves legacy department assignments and ownership.
4. Configure the private `runtime/site-env.json` file, mode 0600. `scripts/run-deployed.mjs` loads it into the child process without putting credentials in PM2 configuration or Git.
5. Run `node scripts/render-deploy-config.mjs` to generate `runtime/ecosystem.xhs.json`; older PM2 versions cannot load `.cjs` directly. If the script/cwd changed, back up the process definition and recreate only `feihe-local` with `pm2 delete feihe-local` then `pm2 start runtime/ecosystem.xhs.json --only feihe-local`. Start the worker with `--only xhs-industry-monitor`. Do not use `startOrReload` to migrate a legacy pnpm process: older PM2 preserves its old script and cwd. Validate public pages and both named processes, then persist only these entries without altering other applications' saved definitions.

## Private runtime configuration

Required keys: `SITE_ORIGIN=https://xhs.red-magic.cn`, `PUBLIC_SITE_ACCESS=true`, `FEISHU_AUTH_ENABLED=true`, `FEISHU_BASE_URL=https://xhs.red-magic.cn`, an independent random `FEISHU_SESSION_SECRET` (at least 32 characters), and `FEISHU_CONFIG_JSON`.

The Feishu JSON follows ct-magic: `{ "feishu": { "enabled": true, "baseUrl": "https://xhs.red-magic.cn", "apps": [...] } }`. Each app has `key`, `name`, `appId`, `appSecret`, and nonempty `tenantKeys`. Never commit real values.

The implementation supports all three enterprises. For the initial release, only Yimei's two enterprises are enabled; Hongmo is deferred at the user's request until its callback whitelist is configured. Callback for each enabled app: `https://xhs.red-magic.cn/api/auth/feishu/callback`.

Login is an optional identity display and does not grant project roles or restrict anonymous feature access. OAuth state is process-local, single-use and bounded: use one site instance. Restarting the process invalidates in-flight login attempts safely; users can start login again.

## Industry data contract

V2 uses the existing server-side OSS credential pool and Xiaohongshu Pugongying note-search endpoint. The persisted project SPU, category keyword and each competitor keyword are independent queries. Defaults suggest two competitors per project; users can edit these assumptions. V1 snapshots remain intact but do not masquerade as V2 history.

The default window is 30 publication dates ending at Shanghai T-2, matching ct-magic's allowance for indexing latency; 7/14/90-day windows are available. Each query/date is limited to 3 pages of 60 notes. Partial pagination, unknown totals, malformed dates and missing fields remain explicit. Each project has a persisted budget of 360 page reservations per Shanghai calendar day, including failures; failed requests retain conservative reservations because timeouts can still reach upstream. Retry limits are 3 attempts per query/date/calendar day with a 5-minute cooldown. An 8-minute project lease prevents overlapping collection and recovers crashed workers. Recent three publication dates are rechecked once per calendar day.

The continuously running `run-industry-monitor.mjs --watch` worker processes projects fairly in a sequential loop (15-second active / 60-second idle pauses). API actions only enqueue bounded jobs; they never wait for the upstream service. Local development also needs this worker in a separate terminal. Disabling daily sync stops automatic claims; explicit manual enqueue still works within the same budget. Saving a paused configuration does not silently start collection. Changing SPU/brand/keywords isolates the old scope. Failed refreshes retain last successful observations, with failed coverage rather than invented zeroes. A genuine successful empty response is distinguishable from uncollected dates.

Five views cover overview, content, creators, promotion rhythm and evidence-linked actions. Query filtering recomputes the entire report server-side. All aggregate metrics use the full collected sample, while interactive note detail is capped at 500 with a visible notice. `engageNum` is the platform interaction total; `favNum` is likes. Missing values are null, not zero. Rates use paired observations: reads/impressions and interactions/reads. Commercial cooperation and paid promotion are separate flags, with unknowns excluded from their denominators. Creator prices are reference quotes, not actual spend; no ROI is computed.

Trends describe publication-date cohorts with cumulative counters observed at collection time, not daily engagement increments. Sample overlap is deduplicated by note ID, retaining a coherent latest observation and query provenance. Week-over-week changes require 14 consecutive fully covered publication dates. Content scenes/selling points use explicit project-specific rule dictionaries, not invented AI judgments or keyword search volumes. Creator tiers describe the creators, not their audiences. Queries and capped samples are not market share or full-platform totals. Pending/failed/truncated coverage must remain visible even when the UI already has usable samples.

V2 tables are additive (`industry_v2_configs/jobs/leases/budget`). Back up the live database before deployment; do not transfer development samples into production. The first deployment progressively backfills history, so a working feature does not imply a fully collected window. Inspect `pm2 logs xhs-industry-monitor --lines 20 --nostream` and report coverage without printing credentials.

## Verification

`npm run typecheck`, `npm run build`, `node scripts/test-project-edit-isolated.mjs`, `node scripts/test-project-logo-persistence.mjs`, `node --test scripts/test-feishu-login.mjs`, `node --test tests/test-industry-monitor.mjs`, `node scripts/test-industry-provider.mjs`, `node scripts/test-runtime-env-safe.mjs`.

All tests use isolated storage. Do not run historical onboarding scripts against the live database as tests. The repository-wide lint command has pre-existing errors; the changed feature scope is checked separately without disabling rules.

V2 regression scripts: `test-industry-v2-provider.mjs`, `test-industry-v2-analyzer.mjs`, `test-industry-v2-store.mjs`, `test-industry-v2-api.mjs`, `test-industry-v2-ui.mjs` under `scripts/`. Store/API tests force in-memory databases. Real-source smoke collection is an operational action, not a mocked unit-test result.
