import { expect, type Page, type APIRequestContext } from '@playwright/test';
function cells(values: Record<number, unknown>, size: number) { const row = Array(size).fill(null); for (const [index, value] of Object.entries(values)) row[Number(index)] = value; return row; }
export function historicalSheets() {
  const ids = ['aaaaaaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaaaaaaaaaa3'];
  const notes = ids.map((id, i) => cells({ 3: '2026-09-30', 4: '受控达人' + i, 6: (i + 1) * 10000, 8: '受控启萃内容' + ['甲', '乙', '丙'][i], 9: 'https://www.xiaohongshu.com/explore/' + id, 10: '图文', 11: i === 0 ? '2026-09-29' : '2026-09-30', 13: id, 19: (i + 1) * 1000, 23: (i + 1) * 60000, 24: (i + 2) * 10000, 31: (i + 1) * 100, 33: (i + 1) * 70, 34: (i + 1) * 20, 36: (i + 1) * 10 }, 40));
  const creators = ids.map((id, i) => cells({ 3: '受控达人' + i, 4: i === 0 ? '2026-09-29' : '2026-09-30', 5: 'https://www.xiaohongshu.com/explore/' + id, 6: id, 7: i === 0 ? '头部' : '腰部', 9: '图文', 16: '受控启萃内容' + ['甲', '乙', '丙'][i], 17: i === 0 ? '产品科普' : '生活场景', 18: '受控切角' }, 20));
  const adHeader = cells({ 9: '时间', 15: '消费' }, 43);
  const ads = [cells({ 9: '2026-09-29', 10: '信息流', 15: 100, 16: 1000, 17: 10, 26: 5 }, 43), cells({ 9: '2026-09-29', 10: '搜索', 15: 200, 16: 2000, 17: 30, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '信息流', 15: 150, 16: 1000, 17: 20, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '搜索', 15: 250, 16: 2000, 17: 60, 26: 20 }, 43)];
  return { '3Wsban': [Array(40).fill('字段'), ...notes], '4bTvDu': [Array(20).fill('字段'), ...creators], '1XSPsH': [adHeader, ...ads], 'kMYs9o': [Array(40).fill(null), cells({ 15: '信息流' }, 40), cells({ 1: '2026-09-29', 7: 400, 15: 100, 18: 200, 20: 0.7, 32: 0.5 }, 40), cells({ 1: '2026-09-30', 7: 500, 15: 150, 18: 250, 20: 0.8, 32: 0.6 }, 40)] };
}

export async function syncQicuiHistory(page: Page, request: APIRequestContext) {
  const editor = { 'x-user-id': 'user-editor' };
  expect((await request.post('/api/projects', { headers: { 'x-user-id': 'user-admin' }, data: { action: 'add_member', projectId: 'qicui', userId: 'user-editor', role: 'project_admin' } })).status()).toBe(200);
  await page.context().setExtraHTTPHeaders(editor);
  const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5247';
  expect((await request.post(vendor + '/__fixture/legacy-sheets', { data: { sheets: historicalSheets() } })).status()).toBe(200);
  await page.goto('/projects/qicui');
  const sync = page.waitForResponse(response => response.url().endsWith('/api/feishu/sync') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '同步最新数据', exact: true }).click();
  const response = await sync; expect(response.status()).toBe(200); const result = await response.json();
  for (const id of Object.keys(historicalSheets())) expect(result.reports.find((item: { sheetId: string }) => item.sheetId === id).status).toBe('success');
  expect(result.ok).toBe(false); expect(result.errors.length).toBeGreaterThan(0); expect(result.actorUserId).toBe('user-editor');
  const dashboard = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json();
  expect(dashboard.metrics.noteCount).toBe(3); expect(dashboard.metrics.readCount).toBe(90000); expect(dashboard.metrics.interactionCount).toBe(600);
  await expect(page.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible();
  return dashboard;
}

export async function seedHistoricQicuiAction(label: string) {
  const path = await import('node:path'); const { DatabaseSync } = await import('node:sqlite');
  const file = path.resolve(process.env.FEIHE_TEST_DB_PATH || '.verification/browser.db');
  const boundary = path.resolve('.verification') + path.sep;
  if (!file.toLowerCase().startsWith(boundary.toLowerCase())) throw new Error('Historic fixture must stay in the disposable verification database');
  const database = new DatabaseSync(file);
  try {
    expect(database.prepare('SELECT COUNT(*) AS n FROM project_notes WHERE project_id=? AND note_id=?').get('qicui','aaaaaaaaaaaaaaaaaaaaaaa1')?.n).toBe(1);
    const id='historic-action-'+label+'-'+Date.now(), content='受控需回复咨询-'+label+'-'+Date.now();
    database.prepare('INSERT INTO key_comments(id,project_id,note_id,content,sentiment,category,action,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'qicui','aaaaaaaaaaaaaaaaaaaaaaa1',content,'问题','咨询','需达人回复','2026-09-30T12:00:00+08:00','2026-09-30T12:00:00+08:00');
    return {id,content};
  } finally { database.close(); }
}
