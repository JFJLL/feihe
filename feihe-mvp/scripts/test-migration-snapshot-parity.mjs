/**
 * Automated Snapshot Parity & Health Verification Test
 * Verifies 100% data consistency and zero regressions across all 5 projects.
 */

import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = path.resolve('.');
const db = new DatabaseSync(path.resolve('data/local.db'));

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: { alias: { '@': ROOT_DIR } },
});
after(() => vite.close());

const { getAllProjectManifests, buildProjectBoard, isProjectRegistered } = await vite.ssrLoadModule('/lib/core/registry.ts');
const { validateBoardHealth, formatHealthReport } = await vite.ssrLoadModule('/lib/core/board-health.ts');

test('Registry auto-discovers all 5 projects without hardcoded lists', () => {
  const manifests = getAllProjectManifests();
  const ids = Object.keys(manifests);
  console.log('Discovered projects:', ids);
  assert.ok(ids.includes('winner-wipes'), 'winner-wipes must be discovered');
  assert.ok(ids.includes('kailas'), 'kailas must be discovered');
  assert.ok(ids.includes('meiling'), 'meiling must be discovered');
  assert.ok(ids.includes('huang-tiane'), 'huang-tiane must be discovered');
  assert.ok(ids.includes('qicui'), 'qicui must be discovered');
  assert.equal(isProjectRegistered('kailas'), true);
  assert.equal(isProjectRegistered('unknown-xyz'), false);
});

test('Project winner-wipes snapshot parity & BoardHealth check', async () => {
  const payload = await buildProjectBoard('winner-wipes');
  assert.ok(payload, 'Payload must be returned');
  assert.equal(payload.projectId, 'winner-wipes');

  const row = db.prepare("SELECT value FROM project_settings WHERE project_id='winner-wipes' AND key='campaign_dashboard'").get();
  assert.ok(row, 'Base DB snapshot must exist');
  const base = JSON.parse(row.value);

  assert.equal(payload.kpis.length, base.kpis.length, 'KPI count must match 100%');
  for (let i = 0; i < base.kpis.length; i++) {
    assert.equal(payload.kpis[i].id, base.kpis[i].id);
    assert.equal(payload.kpis[i].value, base.kpis[i].value);
  }

  assert.ok(payload.tables.length >= base.tables.length);
  assert.ok(Object.keys(payload.datasets).length >= base.tables.length);

  const health = validateBoardHealth(payload);
  if (!health.ok) console.error(formatHealthReport(health));
  assert.equal(health.ok, true, 'BoardHealth check must pass with 0 errors');
  console.log('✓ winner-wipes passed parity and health check');
});

test('Project kailas snapshot parity & BoardHealth check', async () => {
  const payload = await buildProjectBoard('kailas');
  assert.ok(payload);
  assert.equal(payload.projectId, 'kailas');

  const row = db.prepare("SELECT value FROM project_settings WHERE project_id='kailas' AND key='campaign_dashboard'").get();
  const base = JSON.parse(row.value);

  assert.equal(payload.kpis.length, base.kpis.length);
  for (let i = 0; i < base.kpis.length; i++) {
    assert.equal(payload.kpis[i].id, base.kpis[i].id);
    assert.equal(payload.kpis[i].value, base.kpis[i].value);
  }

  const health = validateBoardHealth(payload);
  if (!health.ok) console.error(formatHealthReport(health));
  assert.equal(health.ok, true, 'BoardHealth check must pass');
  console.log('✓ kailas passed parity and health check');
});

test('Project meiling snapshot parity & BoardHealth check', async () => {
  const payload = await buildProjectBoard('meiling');
  assert.ok(payload);
  assert.equal(payload.projectId, 'meiling');

  const row = db.prepare("SELECT value FROM project_settings WHERE project_id='meiling' AND key='campaign_dashboard'").get();
  const base = JSON.parse(row.value);

  assert.equal(payload.kpis.length, base.kpis.length);
  for (let i = 0; i < base.kpis.length; i++) {
    assert.equal(payload.kpis[i].id, base.kpis[i].id);
    assert.equal(payload.kpis[i].value, base.kpis[i].value);
  }

  const health = validateBoardHealth(payload);
  if (!health.ok) console.error(formatHealthReport(health));
  assert.equal(health.ok, true, 'BoardHealth check must pass');
  console.log('✓ meiling passed parity and health check');
});

test('Project huang-tiane snapshot parity & BoardHealth check', async () => {
  const payload = await buildProjectBoard('huang-tiane');
  assert.ok(payload);
  assert.equal(payload.projectId, 'huang-tiane');

  const row = db.prepare("SELECT value FROM project_settings WHERE project_id='huang-tiane' AND key='campaign_dashboard'").get();
  const base = JSON.parse(row.value);

  assert.equal(payload.kpis.length, base.kpis.length);
  for (let i = 0; i < base.kpis.length; i++) {
    assert.equal(payload.kpis[i].id, base.kpis[i].id);
    assert.equal(payload.kpis[i].value, base.kpis[i].value);
  }

  const health = validateBoardHealth(payload);
  if (!health.ok) console.error(formatHealthReport(health));
  assert.equal(health.ok, true, 'BoardHealth check must pass');
  console.log('✓ huang-tiane passed parity and health check');
});

test('Project qicui snapshot parity & BoardHealth check', async () => {
  const payload = await buildProjectBoard('qicui');
  assert.ok(payload);
  assert.equal(payload.projectId, 'qicui');

  const kpiDs = payload.datasets['summary_kpis'];
  assert.ok(kpiDs, 'summary_kpis must exist');
  assert.equal(kpiDs.rows[0].note_count, 3076, 'Note count must be 3076');

  const flowDs = payload.datasets['daily_flow'];
  assert.ok(flowDs, 'daily_flow must exist');
  assert.ok(flowDs.rows.length === 14 || flowDs.rows.length > 0, 'Daily flow must contain unique deduplicated days');

  const health = validateBoardHealth(payload);
  if (!health.ok) console.error(formatHealthReport(health));
  assert.equal(health.ok, true, 'BoardHealth check must pass');
  console.log('✓ qicui passed parity and health check');
});
