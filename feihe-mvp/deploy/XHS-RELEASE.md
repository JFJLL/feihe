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

The four campaign projects query their persisted SPU through the existing server-side OSS/Pugongying credential path. Requests cover the last 30 Shanghai-calendar days, sorted by heat, at most 2 pages of 60 notes per attempt. Successful project/SPU/day tasks are not repeated. Failed tasks have at most 3 attempts; restarting the worker can retry within this bound. A crashed lease becomes reclaimable after 15 minutes.

The worker runs on startup and each Shanghai date change. Disabling daily sync prevents automatic collection. Project SPU changes invalidate previous results. Failures preserve earlier valid snapshots with a stale warning; no fixture data is used in production.

Charts show search samples, not full-industry market share or whole-platform daily additions. Brand attribution prefers the platform's brand field, with configured title mentions as a fallback. Unidentified brands remain separate. Returned interaction components are summed without filling missing comments/collections with zero. Configured competitor names only help attribute returned notes; they do not trigger additional unbounded searches.

Exact platform aliases are canonicalized: project SPU labels such as `凯乐石FUGA` map to the project's brand; `美菱电商` maps to `美菱`, and `稳健医疗` to `稳健`. No general prefix matching is used. After changing this mapping, `node scripts/rebuild-industry-snapshot.mjs --project <id>` previews a rebuild from existing raw records; `--apply` preserves the original sample count, interaction totals, and collection provenance without another upstream request.

## Verification

`npm run typecheck`, `npm run build`, `node scripts/test-project-edit-isolated.mjs`, `node scripts/test-project-logo-persistence.mjs`, `node --test scripts/test-feishu-login.mjs`, `node --test tests/test-industry-monitor.mjs`, `node scripts/test-industry-provider.mjs`, `node scripts/test-runtime-env-safe.mjs`.

All tests use isolated storage. Do not run historical onboarding scripts against the live database as tests. The repository-wide lint command has pre-existing errors; the changed feature scope is checked separately without disabling rules.
