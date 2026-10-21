import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';

const vite = await createServer({
  root: appRoot,
  configFile: false,
  cacheDir: 'node_modules/.vite/test-industry',
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: { alias: { '@': appRoot } },
});

after(async () => {
  await vite.close();
});

const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
await ensureSchema();
const d1 = db();

const {
  ensureIndustrySchema,
  getIndustryConfig,
  getLatestIndustrySnapshot,
  getIndustryTaskForDate,
  claimIndustryTaskAtomic,
} = await vite.ssrLoadModule('/lib/industry-db.ts');

const { resolveProjectIndustryMeta, runIndustrySync } = await vite.ssrLoadModule('/lib/industry-service.ts');

await ensureIndustrySchema();

test('lease uses valid timestamps and a stalled worker can be reclaimed only once', async () => {
  const options = { taskId: 'lease-recovery', projectId: 'kailas', dateKey: '2026-11-01', spu: 'lease-test', provider: 'pgy', maxAttempts: 3 };
  const first = await claimIndustryTaskAtomic(options);
  assert.equal(first.claimed, true);
  assert(Number.isFinite(Date.parse(first.task.startedAt)), 'Lease timestamp must be a real ISO date, not a token');
  await d1.prepare('UPDATE industry_tasks SET started_at=? WHERE id=?').bind(new Date(Date.now() - 16 * 60_000).toISOString(), first.task.id).run();
  const parallel = await Promise.all([claimIndustryTaskAtomic(options), claimIndustryTaskAtomic(options)]);
  assert.equal(parallel.filter(x => x.claimed).length, 1);
  const recovered = await getIndustryTaskForDate(options.projectId, options.dateKey, options.spu);
  assert.equal(recovered.attempts, 2);
});

test('1. prevent cross-project mix: project-isolated configs, tasks, notes, and snapshots', async () => {
  const now = new Date().toISOString();
  await d1.batch([
    d1.prepare('INSERT INTO projects(id, name, spu, brand, category, status, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('kailas', '凯乐石', '登山鞋', '凯乐石', '户外', '进行中', '#000', now, now),
    d1.prepare('INSERT INTO projects(id, name, spu, brand, category, status, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('meiling', '美菱', '冰箱', '美菱', '家电', '进行中', '#000', now, now),
  ]);

  // Mock fetcher returning project-specific data
  const mockFetcher = async (opts) => {
    if (opts.projectId === 'kailas') {
      return {
        success: true,
        provider: 'pgy',
        liveVerified: true,
        notes: [{
          id: 'kailas:note1',
          noteId: 'note1',
          title: '凯乐石登山鞋硬核测评',
          bloggerName: '户外徒步者',
          noteUrl: 'https://example.com/k1',
          likedCount: 300,
          commentCount: 50,
          collectedCount: 80,
          brand: '凯乐石',
          isOurBrand: true,
          nature: 'commercial',
          sourceProvider: 'pgy',
          fetchedAt: now,
        }],
        recordCount: 1,
      };
    }
    return {
      success: true,
      provider: 'pgy',
      liveVerified: true,
      notes: [{
        id: 'meiling:note2',
        noteId: 'note2',
        title: '美菱大容量保鲜冰箱实测',
        bloggerName: '家电评测',
        noteUrl: 'https://example.com/m2',
        likedCount: 120,
        commentCount: 20,
        collectedCount: 40,
        brand: '美菱',
        isOurBrand: true,
        nature: 'natural',
        sourceProvider: 'pgy',
        fetchedAt: now,
      }],
      recordCount: 1,
    };
  };

  await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-21' }, mockFetcher);
  await runIndustrySync({ projectId: 'meiling', dateKey: '2026-10-21' }, mockFetcher);

  const kailasNotes = (await d1.prepare('SELECT * FROM industry_notes WHERE project_id = ?').bind('kailas').all()).results;
  const meilingNotes = (await d1.prepare('SELECT * FROM industry_notes WHERE project_id = ?').bind('meiling').all()).results;

  assert.equal(kailasNotes.length, 1);
  assert.equal(kailasNotes[0].spu, '登山鞋');
  assert.equal(kailasNotes[0].brand, '凯乐石');

  assert.equal(meilingNotes.length, 1);
  assert.equal(meilingNotes[0].spu, '冰箱');
  assert.equal(meilingNotes[0].brand, '美菱');
});

test('2. stale overwrite prevention: real runIndustrySync preserves Day 1 snapshot when Day 2 fails', async () => {
  const now = new Date().toISOString();
  // Day 1: Successful sync
  const successFetcher = async () => ({
    success: true,
    provider: 'pgy',
    liveVerified: true,
    notes: [{
      id: 'kailas:day1_note',
      noteId: 'day1_note',
      title: '凯乐石第一天真实笔记',
      bloggerName: '达人1',
      noteUrl: 'https://example.com/d1',
      likedCount: 500,
      commentCount: 60,
      collectedCount: 90,
      brand: '凯乐石',
      isOurBrand: true,
      nature: 'commercial',
      sourceProvider: 'pgy',
      fetchedAt: now,
    }],
    recordCount: 1,
  });

  const day1Res = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-20', force: true }, successFetcher);
  assert.equal(day1Res.ok, true);
  assert.equal(day1Res.status, 'ready');

  const snapshotDay1 = await getLatestIndustrySnapshot('kailas', '登山鞋');
  assert.equal(snapshotDay1?.status, 'ready');
  assert.equal(snapshotDay1?.summary.totalNotes, 1);

  // Day 2: Provider fails with upstream 503 error
  const failFetcher = async () => ({
    success: false,
    provider: 'pgy',
    liveVerified: true,
    notes: [],
    recordCount: 0,
    errorMessage: '上游服务暂时不可用 HTTP 503',
  });

  const day2Res = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-22', force: true }, failFetcher);
  assert.equal(day2Res.ok, false);
  assert.equal(day2Res.status, 'failed');
  assert.match(day2Res.error || '', /HTTP 503/);

  // Crucial adversarial check: Day 1 snapshot is preserved as stale, NOT wiped or replaced with 0
  const snapshotAfterFailure = await getLatestIndustrySnapshot('kailas', '登山鞋');
  assert.equal(snapshotAfterFailure?.status, 'stale');
  assert.equal(snapshotAfterFailure?.summary.totalNotes, 1, 'Day 1 note count must be preserved');
  assert.equal(snapshotAfterFailure?.recentNotes.length, 1, 'Day 1 recent notes must be preserved');
});

test('3. concurrency lock: Promise.all calls only trigger one execution', async () => {
  let fetchCalls = 0;
  const slowFetcher = async () => {
    fetchCalls++;
    await new Promise(r => setTimeout(r, 60));
    return {
      success: true,
      provider: 'pgy',
      liveVerified: true,
      notes: [],
      recordCount: 0,
    };
  };

  const [resA, resB] = await Promise.all([
    runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-23', force: false }, slowFetcher),
    runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-23', force: false }, slowFetcher),
  ]);

  assert.equal(fetchCalls, 1, 'Exactly one fetcher call allowed; duplicate call must be blocked');
  assert.ok(resA.ok || resB.ok);
  assert.ok(resA.skipped || resB.skipped, 'One of the concurrent calls must be marked skipped');
});

test('4. in-flight spu change: discards old SPU snapshot when SPU changes during request', async () => {
  const inFlightChangeFetcher = async () => {
    // Simulate DB SPU updating during network latency
    await d1.prepare('UPDATE projects SET spu = ? WHERE id = ?').bind('冲锋衣', 'kailas').run();
    return {
      success: true,
      provider: 'pgy',
      liveVerified: true,
      notes: [{
        id: 'kailas:old_spu_note',
        noteId: 'old_spu_note',
        title: '登山鞋旧笔记',
        noteUrl: 'https://example.com/old',
        brand: '凯乐石',
        isOurBrand: true,
        likedCount: 10,
        commentCount: 2,
        collectedCount: 3,
        nature: 'natural',
        sourceProvider: 'pgy',
        fetchedAt: new Date().toISOString(),
      }],
      recordCount: 1,
    };
  };

  // kailas started with 冲锋衣 or 登山鞋
  await d1.prepare('UPDATE projects SET spu = ? WHERE id = ?').bind('登山鞋', 'kailas').run();
  const res = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-24', force: true }, inFlightChangeFetcher);

  assert.equal(res.ok, false);
  assert.equal(res.status, 'invalidated');
  assert.match(res.error || '', /SPU 发生变更/);
});

test('5. cleared/missing spu: never exposes old SPU snapshot summary', async () => {
  // Clear SPU in projects table
  await d1.prepare('UPDATE projects SET spu = ? WHERE id = ?').bind('', 'kailas').run();

  const meta = await resolveProjectIndustryMeta('kailas');
  assert.equal(meta.spu, '', 'SPU must be empty string');

  const snapshot = await getLatestIndustrySnapshot('kailas', '');
  assert.equal(snapshot, null, 'Must NOT expose old snapshot when SPU is empty');

  const syncRes = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-24' });
  assert.equal(syncRes.ok, false);
  assert.equal(syncRes.status, 'missing_spu');
});

test('6. daily boundary: completed task on Day 1 does not block Day 2 execution', async () => {
  // Restore SPU
  await d1.prepare('UPDATE projects SET spu = ? WHERE id = ?').bind('冲锋衣', 'kailas').run();
  const simpleFetcher = async () => ({
    success: true,
    provider: 'pgy',
    liveVerified: true,
    notes: [],
    recordCount: 0,
  });

  const resDay1 = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-25' }, simpleFetcher);
  assert.equal(resDay1.ok, true);
  assert.equal(resDay1.skipped, undefined);

  // Run on Day 2 with same SPU
  const resDay2 = await runIndustrySync({ projectId: 'kailas', dateKey: '2026-10-26' }, simpleFetcher);
  assert.equal(resDay2.ok, true);
  assert.equal(resDay2.skipped, undefined, 'Day 2 must run cleanly and not be blocked by Day 1');
});
