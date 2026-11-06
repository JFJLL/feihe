import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = path.resolve('.');
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: { alias: { '@': ROOT_DIR } },
});

const { getCampaignDashboardSnapshot } = await vite.ssrLoadModule('/lib/campaign-store.ts');
const { GET } = await vite.ssrLoadModule('/app/api/campaign-dashboard/route.ts');

const projects = ['kailas', 'meiling', 'winner-wipes', 'huang-tiane', 'qicui'];

for (const pid of projects) {
  const snap = await getCampaignDashboardSnapshot(pid);
  assert.ok(snap, `${pid} snapshot must load from store`);
  assert.equal(snap.projectId, pid);
  assert.ok(Array.isArray(snap.actions?.items), `${pid} actions.items must be an array`);

  const req = new Request(`http://localhost:5173/api/campaign-dashboard?projectId=${pid}`, {
    headers: { 'x-user-id': 'user-admin', 'x-user-role': 'platform_admin' },
  });
  const res = await GET(req);
  assert.equal(res.status, 200, `${pid} API must return 200`);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.dashboard, `${pid} must return dashboard`);
  assert.equal(data.dashboard.projectId, pid);
  console.log(`✓ [200 OK] /api/campaign-dashboard?projectId=${pid} -> returned board successfully`);
}

await vite.close();
console.log('🎉 ALL 5 PROJECTS PASSED /api/campaign-dashboard VERIFICATION (0 errors)');
