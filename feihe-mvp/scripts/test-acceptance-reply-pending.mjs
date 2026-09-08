import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Real route handler + real SQLite SQL + real loopback HTTP. Only the app's
// authentication and database bindings are replaced; no query result is mocked.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE notes (id TEXT PRIMARY KEY, url TEXT, author TEXT, title TEXT, published_at TEXT);
  CREATE TABLE project_notes (project_id TEXT, note_id TEXT, source_type TEXT, pipeline TEXT,
    level TEXT, product_scope TEXT, status TEXT, last_fetched_at TEXT, comment_total INTEGER,
    positive_count INTEGER, negative_count INTEGER, question_count INTEGER,
    brand_mention_top5 REAL, added_at TEXT, PRIMARY KEY(project_id, note_id));
  CREATE TABLE note_profiles (note_id TEXT PRIMARY KEY, cover_url TEXT, category1 TEXT, category2 TEXT,
    note_type TEXT, read_count INTEGER, interaction_count INTEGER, like_count INTEGER,
    favorite_count INTEGER, creator_level TEXT, brand TEXT, note_price REAL, cooperation INTEGER);
  CREATE TABLE key_comments (id INTEGER PRIMARY KEY, project_id TEXT, note_id TEXT,
    treatment_status TEXT, action TEXT);
  CREATE TABLE comment_snapshots (project_id TEXT, note_id TEXT, captured_at TEXT,
    l1_count INTEGER, l2_count INTEGER, total_count INTEGER);
`);
const addNote = (id, project, status = '待抓取') => {
  sqlite.prepare('INSERT OR IGNORE INTO notes VALUES (?, ?, ?, ?, ?)')
    .run(id, `https://example.test/${id}`, 'test-author', id, '2026-09-01');
  sqlite.prepare(`INSERT INTO project_notes (project_id,note_id,source_type,status,added_at,
    comment_total,positive_count,negative_count,question_count) VALUES (?,?,'owned',?,'2026-09-01',100,20,20,20)`)
    .run(project, id, status);
};
const addComment = (noteId, project = 'A', status = '待处理', action = '需达人回复') =>
  sqlite.prepare('INSERT INTO key_comments (project_id,note_id,treatment_status,action) VALUES (?,?,?,?)')
    .run(project, noteId, status, action);
const expected = [];
for (let i = 0; i < 25; i++) {
  const id = `reply-${String(i).padStart(2, '0')}`;
  expected.push(id);
  addNote(id, 'A', ['符合且能汇报', '符合基础要求', i % 2 ? '品牌提及不足需补充' : '不够30条需补充'][i % 3]);
  addComment(id);
}
addComment('reply-00');
addComment('reply-00');
for (const id of ['no-pending', 'handled', 'delete-only', 'foreign-comment', 'processing', 'compound-action']) addNote(id, 'A');
addComment('handled', 'A', '已处理');
addComment('delete-only', 'A', '待处理', '需删除');
addComment('processing', 'A', '处理中');
addComment('compound-action', 'A', '待处理', '需达人回复或删除');
addNote('foreign-comment', 'B');
addComment('foreign-comment', 'B');
addNote('foreign-note', 'B');
addComment('foreign-note', 'B');
addComment('orphan-note');

const executedSql = [];
const d1 = { prepare(sql) {
  const bind = (...values) => ({
    async first() { executedSql.push(sql); return sqlite.prepare(sql).get(...values) || null; },
    async all() { executedSql.push(sql); return { results: sqlite.prepare(sql).all(...values) }; },
  });
  return { bind };
} };
let authenticated = true;
const root = path.resolve(import.meta.dirname, '..');
const filename = path.join(root, 'app/api/notes/list/route.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeModule = { exports: {} };
const require = name => {
  if (name === '@/lib/api-auth') return { apiUser: async () => authenticated, jsonError: (error, status) => Response.json({ error }, { status }) };
  if (name === '@/lib/db') return { db: () => d1, ensureSchema: async () => {} };
  if (name === '@/lib/projects') return { projectId: value => value || 'qicui' };
  throw new Error(`Unexpected route dependency: ${name}`);
};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Response, URL, URLSearchParams })(require, routeModule, routeModule.exports);
const server = http.createServer(async (request, response) => {
  try {
    const result = await routeModule.exports.GET(new Request(`http://127.0.0.1${request.url}`));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api/notes/list`;
const get = async (params = {}) => {
  const response = await fetch(`${base}?${new URLSearchParams({ projectId: 'A', view: 'acceptance', ...params })}`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
try {
  const pages = [];
  for (let page = 1; page <= 3; page++) {
    const result = await get({ replyPending: '1', page: String(page), pageSize: '12' });
    assert.equal(result.total, 25, 'Total is distinct matching notes, not pending comments');
    assert.equal(result.summary.replyPendingCount, 27, 'KPI counts comments using the same exact action/status/project');
    assert.equal(result.summary.total, 31, 'Project summary denominator remains independent of list filters');
    assert.equal(result.items.length, page === 3 ? 1 : 12);
    assert(result.items.every(note => note.replyPendingCount > 0));
    pages.push(...result.items);
  }
  assert.deepEqual(pages.map(note => note.id).sort(), expected);
  assert.equal(new Set(pages.map(note => note.id)).size, 25, 'Multiple comments do not duplicate notes across pages');
  assert.equal(pages.find(note => note.id === 'reply-00').replyPendingCount, 3);
  assert.equal((await get({ replyPending: '1', page: '4', pageSize: '12' })).items.length, 0);
  assert.equal((await get()).total, 31, 'Default notes list remains unfiltered');
  assert.equal((await get({ replyPending: '1', query: 'no-pending' })).total, 0);
  assert.equal((await get({ replyPending: '1', query: "' OR 1=1 --" })).total, 0);
  const other = await get({ projectId: 'B', replyPending: '1' });
  assert.equal(other.total, 2);
  assert.equal(other.summary.replyPendingCount, 2);
  assert.deepEqual(other.items.map(note => note.id).sort(), ['foreign-comment', 'foreign-note']);
  const empty = await get({ projectId: 'empty', replyPending: '1' });
  assert.equal(empty.total, 0);
  assert.equal(empty.summary.replyPendingCount, 0);
  for (const [status, summaryKey, total] of [
    ['符合且能汇报', 'reportableCount', 9], ['符合基础要求', 'baseCount', 8], ['需补充', 'supplementCount', 8],
  ]) {
    const result = await get({ status, pageSize: '3' });
    assert.equal(result.total, total);
    assert.equal(result.summary[summaryKey], total, `${status} card count matches filtered list total`);
    assert.equal(result.items.length, 3);
    assert(result.items.every(note => status === '需补充' ? note.status.includes('补充') : note.status === status));
  }
  const countQueries = executedSql.filter(sql => sql.startsWith('SELECT COUNT(*) AS total') && sql.includes('EXISTS'));
  const listQueries = executedSql.filter(sql => sql.includes('LIMIT ? OFFSET ?') && sql.includes('EXISTS'));
  assert(countQueries.length > 0 && listQueries.length > 0, 'Count and paginated list both execute the real EXISTS predicate');
  authenticated = false;
  assert.equal((await fetch(`${base}?projectId=A&replyPending=1`)).status, 401);
  console.log('PASS actual route SQL/HTTP: no-pending exclusion, exact reply/status condition, project isolation, orphan exclusion, note deduplication, 3-page traversal, empty page, injection safety, all three status cards, comment KPI vs note totals, authorization gate. In-memory fixtures only.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  sqlite.close();
}
