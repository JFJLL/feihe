import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';

// Strictly use in-memory database - never touch real DB
Object.assign(process.env, {
  LOCAL_DB_PATH: ':memory:',
  LOCAL_DB_NO_SEED: 'true',
  ENABLE_TEST_AUTH: '1',
  KEYSTONE_API_KEY: '',
  KEYSTONE_MODEL: '',
});

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/p1-isolated-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});

after(async () => {
  await vite.close();
});

const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
const { ensureBusinessSchema } = await vite.ssrLoadModule('/lib/business-daily/store.ts');
const { ensureCompetitorsSchema } = await vite.ssrLoadModule('/lib/competitors/db.ts');
const { blobPut } = await vite.ssrLoadModule('/lib/blob-store.ts');
const {
  isValidNoteId,
  isNoteInProject,
  getNoteCover,
  resolveNoteCoverUrl,
  cacheNoteCovers,
} = await vite.ssrLoadModule('/lib/note-covers.ts');
const { readQicuiReport } = await vite.ssrLoadModule('/lib/qicui-report.ts');
const noteCoversRoute = await vite.ssrLoadModule('/app/api/note-covers/route.ts');
const projectsRoute = await vite.ssrLoadModule('/app/api/projects/route.ts');

const postReq = (url, body, user = 'user-admin') =>
  new Request(url, {
    method: 'POST',
    headers: { 'x-user-id': user, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const getReq = (url, params = {}, user = 'user-admin') => {
  const qs = new URLSearchParams(params).toString();
  return new Request(url + (qs ? '?' + qs : ''), {
    method: 'GET',
    headers: { 'x-user-id': user },
  });
};

test('=== P1-1: NOTE-COVERS PERMISSION BOUNDARY & MEMBERSHIP VERIFICATION ===', async (t) => {
  await ensureSchema();
  await ensureBusinessSchema();
  await ensureCompetitorsSchema();
  const d1 = db();

  await d1.prepare(`CREATE TABLE IF NOT EXISTS business_note_archives (
    project_id TEXT NOT NULL, note_id TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, note_id)
  )`).run();

  const alpha = 'project_alpha';
  const beta = 'project_beta';

  const noteAlphaOwned = '111111111111111111111111'; // 24 hex
  const noteAlphaArchived = '222222222222222222222222'; // 24 hex
  const noteAlphaComp = '33333333333333333333333333333333'; // 32 hex
  const noteBetaOwned = '444444444444444444444444'; // 24 hex

  const now = new Date().toISOString();
  await d1.batch([
    d1.prepare('INSERT INTO projects(id, name, template_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(alpha, 'Alpha', 'general_workbench', now, now),
    d1.prepare('INSERT INTO projects(id, name, template_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(beta, 'Beta', 'general_workbench', now, now),
    d1.prepare('INSERT INTO project_members(project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(alpha, 'user-editor', 'editor', now, now),
    d1.prepare('INSERT INTO project_members(project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(alpha, 'user-admin', 'project_admin', now, now),
    d1.prepare('INSERT INTO project_members(project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(beta, 'user-admin', 'project_admin', now, now),

    // Alpha owned note in project_notes
    d1.prepare('INSERT INTO project_notes(project_id, note_id, added_at) VALUES(?, ?, ?)').bind(alpha, noteAlphaOwned, now),
    // Alpha archived note in business_note_archives
    d1.prepare('INSERT INTO business_note_archives(project_id, note_id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(alpha, noteAlphaArchived, JSON.stringify({ id: noteAlphaArchived, title: 'Archived Note' }), now),
    // Alpha competitor note in competitor_notes (32 hex)
    d1.prepare('INSERT INTO competitor_notes(id, project_id, task_id, raw_note_id, id_hex_length, title, keyword_hit, brand_attributed, product_line, note_url, raw_payload_json, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('comp-1', alpha, 'task-1', noteAlphaComp, 32, 'Alpha Comp Note', 'hit', 'brand', 'line', 'https://example.com/note', JSON.stringify({ imageList: ['https://example.com/comp.jpg'] }), now, now),

    // Beta owned note
    d1.prepare('INSERT INTO project_notes(project_id, note_id, added_at) VALUES(?, ?, ?)').bind(beta, noteBetaOwned, now),
  ]);

  await t.test('1.1: isValidNoteId supports 24 and 32 hex characters, rejects invalid', () => {
    assert.equal(isValidNoteId(noteAlphaOwned), true);
    assert.equal(isValidNoteId(noteAlphaComp), true);
    assert.equal(isValidNoteId('xyz'), false);
    assert.equal(isValidNoteId('11111111111111111111111'), false); // 23 hex
    assert.equal(isValidNoteId('1111111111111111111111111'), false); // 25 hex
    assert.equal(isValidNoteId(''), false);
  });

  await t.test('1.2: isNoteInProject correctly resolves project_notes, archives, and competitor_notes', async () => {
    assert.equal(await isNoteInProject(alpha, noteAlphaOwned), true);
    assert.equal(await isNoteInProject(alpha, noteAlphaArchived), true);
    assert.equal(await isNoteInProject(alpha, noteAlphaComp), true);
    assert.equal(await isNoteInProject(alpha, noteBetaOwned), false); // Beta note is NOT in alpha
    assert.equal(await isNoteInProject(beta, noteBetaOwned), true);
  });

  await t.test('1.3: Existing polluted cache for foreign note is rejected and not leaked', async () => {
    // Simulate a pre-existing or polluted cache row in note_covers table
    const pollutedKey = `${alpha}:${noteBetaOwned}`;
    const testR2Key = `projects/${alpha}/note-covers/${noteBetaOwned}.jpg`;
    await blobPut(testR2Key, new Uint8Array([1, 2, 3]).buffer, 'image/jpeg');
    await d1.prepare(`INSERT INTO note_covers(id, note_id, project_id, source_url, r2_key, content_type, status, fetched_at, updated_at)
      VALUES(?, ?, ?, 'https://example.com/beta.jpg', ?, 'image/jpeg', '已缓存', ?, ?)`).bind(pollutedKey, noteBetaOwned, alpha, testR2Key, now, now).run();

    // Direct library call MUST reject
    const libResult = await getNoteCover(alpha, noteBetaOwned);
    assert.equal(libResult, null, 'getNoteCover must return null even when note_covers row exists for foreign note');

    // Route API call MUST reject with 404
    const res = await noteCoversRoute.GET(getReq('http://localhost/api/note-covers', { projectId: alpha, noteId: noteBetaOwned }, 'user-editor'));
    assert.equal(res.status, 404);
    assert.equal(await res.text(), '笔记不属于当前项目');
  });

  await t.test('1.4: Cache miss for foreign note in global note_profiles is rejected without store/network side effect', async () => {
    const foreignGlobalNote = '555555555555555555555555';
    // Add to global note_profiles
    await d1.prepare('INSERT INTO note_profiles(note_id, cover_url, updated_at) VALUES(?, ?, ?)').bind(foreignGlobalNote, 'https://example.com/foreign.jpg', now).run();

    // Library call
    const libResult = await getNoteCover(alpha, foreignGlobalNote);
    assert.equal(libResult, null, 'getNoteCover must return null for note not in project');

    // Check that NO note_covers row was written
    const coverRow = await d1.prepare('SELECT id FROM note_covers WHERE project_id=? AND note_id=?').bind(alpha, foreignGlobalNote).first();
    assert.equal(coverRow, null, 'No note_covers row should be inserted for foreign note');

    // Route call
    const res = await noteCoversRoute.GET(getReq('http://localhost/api/note-covers', { projectId: alpha, noteId: foreignGlobalNote }, 'user-editor'));
    assert.equal(res.status, 404);
    assert.equal(await res.text(), '笔记不属于当前项目');
  });

  await t.test('1.5: resolve for foreign note is rejected without fetch side effect', async () => {
    await assert.rejects(
      () => resolveNoteCoverUrl(alpha, noteBetaOwned),
      /笔记不属于当前项目/
    );

    const res = await noteCoversRoute.GET(getReq('http://localhost/api/note-covers', { projectId: alpha, noteId: noteBetaOwned, resolve: '1' }, 'user-editor'));
    assert.equal(res.status, 404);
    assert.equal(await res.text(), '笔记不属于当前项目');
  });

  await t.test('1.6: Same-project notes pass normally for owned and competitor notes', async () => {
    // Competitor note with imageList in raw_payload_json
    const compCover = await resolveNoteCoverUrl(alpha, noteAlphaComp);
    assert.equal(compCover, 'https://example.com/comp.jpg');

    // GET resolve=1 for owned competitor note returns 302 redirect
    const resResolve = await noteCoversRoute.GET(getReq('http://localhost/api/note-covers', { projectId: alpha, noteId: noteAlphaComp, resolve: '1' }, 'user-editor'));
    assert.equal(resResolve.status, 302);
    assert.equal(resResolve.headers.get('location'), 'https://example.com/comp.jpg');
  });
});

test('=== P1-2: QICUI REPORT DATE RANGE & FROZEN SNAPSHOT SEMANTICS ===', async (t) => {
  await ensureSchema();
  await ensureBusinessSchema();
  await ensureCompetitorsSchema();
  const d1 = db();
  const now = new Date().toISOString();

  // Make sure qicui project exists in projects table
  await d1.prepare("INSERT OR IGNORE INTO projects(id, name, template_id, created_at, updated_at) VALUES('qicui', '启萃项目', 'general_workbench', ?, ?)").bind(now, now).run();

  // Seed business_daily_reports with 3 days:
  // 10-10: confirmed (settlement: 1000)
  // 10-14: pending (settlement: 1400)
  // 10-15: confirmed (settlement: 1500)
  const makePayload = (day, settlement, status) => JSON.stringify({
    core: {
      monthlySettlement: { value: settlement },
      monthlyBudget: { value: 2000 },
      adSpend: { value: 100, state: 'collected' },
    },
    progress: { gapThroughData: 200, actualThroughData: settlement, planThroughData: 1200 },
    notes: [{ id: 'note-1', author: 'Author A', publishedDay: day, monthSpend: { value: 50 }, totalSpend: { value: 100 }, audit: '正常', correction: '无需整改', owner: 'Tester' }],
    tables: [{ title: '当月产出与执行', columns: ['达人', '产出'], rows: [['达人A', '5篇']] }],
    sourceVersions: [{ sourceKey: 'feishu-daily', version: 'v1.0', capturedAt: now, url: 'https://example.com/sheet' }],
  });

  await d1.batch([
    d1.prepare(`INSERT INTO business_daily_reports(id, project_id, business_day, status, payload_json, fingerprint, created_at)
      VALUES('rep-1010', 'qicui', '2026-10-10', 'confirmed', ?, 'fp-1010', ?)`).bind(makePayload('2026-10-10', 1000, 'confirmed'), '2026-10-10T08:00:00Z'),
    d1.prepare(`INSERT INTO business_daily_reports(id, project_id, business_day, status, payload_json, fingerprint, created_at)
      VALUES('rep-1014', 'qicui', '2026-10-14', 'pending', ?, 'fp-1014', ?)`).bind(makePayload('2026-10-14', 1400, 'pending'), '2026-10-14T08:00:00Z'),
    d1.prepare(`INSERT INTO business_daily_reports(id, project_id, business_day, status, payload_json, fingerprint, created_at)
      VALUES('rep-1015', 'qicui', '2026-10-15', 'confirmed', ?, 'fp-1015', ?)`).bind(makePayload('2026-10-15', 1500, 'confirmed'), '2026-10-15T08:00:00Z'),
  ]);

  await t.test('2.1: Range 14-15 strictly picks in range and NEVER selects 10-10 confirmed', async () => {
    // In range [10-14, 10-15], 10-15 is confirmed, 10-14 is pending. 10-15 must be chosen, NOT 10-10!
    const rep = await readQicuiReport({ from: '2026-10-14', to: '2026-10-15' });
    const settlement = rep.kpis.find(k => k.key === 'qicui-settlement');
    assert.equal(settlement.value, '¥1,500');
    assert.ok(settlement.note.includes('2026-10-15'));
    assert.ok(settlement.note.includes('已确认归档快照'));
  });

  await t.test('2.2: Range without confirmed uses in-range available snapshot with truthful status', async () => {
    // Only 10-14 requested: status is pending. Must use 10-14 with truthful status, NOT jump back to 10-10 confirmed!
    const rep = await readQicuiReport({ from: '2026-10-14', to: '2026-10-14' });
    const settlement = rep.kpis.find(k => k.key === 'qicui-settlement');
    assert.equal(settlement.value, '¥1,400');
    assert.ok(settlement.note.includes('2026-10-14'));
    assert.ok(settlement.note.includes('来源快照'), 'Status note must truthfully state 来源快照 instead of 已确认归档');
  });

  await t.test('2.3: Empty range throws DefinitionError and does NOT fall back to old daily or legacy', async () => {
    // Range 11-01 to 11-02 has no daily reports
    await assert.rejects(
      () => readQicuiReport({ from: '2026-11-01', to: '2026-11-02' }),
      /所选日期范围内无启萃业务日报快照/
    );
  });

  await t.test('2.4: Invalid range (from > to) throws error', async () => {
    await assert.rejects(
      () => readQicuiReport({ from: '2026-10-15', to: '2026-10-14' }),
      /项目结束日期不能早于开始日期/
    );
  });

  await t.test('2.5: Single-ended from boundary does not pick earlier confirmed', async () => {
    // from: '2026-10-14' matches [10-14, 10-15], must not pick 10-10
    const rep = await readQicuiReport({ from: '2026-10-14' });
    const settlement = rep.kpis.find(k => k.key === 'qicui-settlement');
    assert.notEqual(settlement.value, '¥1,000'); // NOT 10-10
    assert.equal(settlement.value, '¥1,500');
  });

  await t.test('2.6: Single-ended to boundary matches days <= to', async () => {
    // to: '2026-10-12' matches only 10-10
    const rep = await readQicuiReport({ to: '2026-10-12' });
    const settlement = rep.kpis.find(k => k.key === 'qicui-settlement');
    assert.equal(settlement.value, '¥1,000');
    assert.ok(settlement.note.includes('2026-10-10'));
  });

  await t.test('2.7: No range specified defaults to latest confirmed snapshot', async () => {
    const rep = await readQicuiReport({});
    const settlement = rep.kpis.find(k => k.key === 'qicui-settlement');
    assert.equal(settlement.value, '¥1,500'); // 10-15 confirmed is latest confirmed
  });

  await t.test('2.8: Frozen snapshot fingerprint is deterministic and stable across re-reads', async () => {
    const rep1 = await readQicuiReport({ from: '2026-10-14', to: '2026-10-15' });
    const rep2 = await readQicuiReport({ from: '2026-10-14', to: '2026-10-15' });
    assert.equal(rep1.fingerprint, rep2.fingerprint);
    assert.deepEqual(rep1.kpis, rep2.kpis);
  });
});