import { test, expect } from './evidence';
import { DEFAULT_BUSINESS_COMPONENTS } from '../../lib/business-components';
import type { Page, APIRequestContext } from '@playwright/test';
import { connectExistingProjectTable, dismissProjectNotifications } from './product-journey';
test('启萃组件反例：真实页面有权用户能打开既有复杂图表的团队布局编辑入口', async ({ page }, info) => {
  await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-admin' }); await page.goto('/projects/qicui');
  await expect(page.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('qicui-components-before.png'), fullPage: true });
  await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '团队业务组件布局', exact: true })).toBeVisible();
});
const editor = { 'x-user-id': 'user-editor' }, platform = { 'x-user-id': 'user-admin' };
const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
function cells(values: Record<number, unknown>, size: number) { const row = Array(size).fill(null); for (const [index, value] of Object.entries(values)) row[Number(index)] = value; return row; }
function historicalSheets() {
  const ids = ['aaaaaaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaaaaaaaaaa3'];
  const notes = ids.map((id, i) => cells({ 3: '2026-09-30', 4: '受控达人' + i, 6: (i + 1) * 10000, 8: '受控启萃内容' + ['甲', '乙', '丙'][i], 9: 'https://www.xiaohongshu.com/explore/' + id, 10: '图文', 11: i === 0 ? '2026-09-29' : '2026-09-30', 13: id, 19: (i + 1) * 1000, 23: (i + 1) * 60000, 24: (i + 2) * 10000, 31: (i + 1) * 100, 33: (i + 1) * 70, 34: (i + 1) * 20, 36: (i + 1) * 10 }, 40));
  const creators = ids.map((id, i) => cells({ 3: '受控达人' + i, 4: i === 0 ? '2026-09-29' : '2026-09-30', 5: 'https://www.xiaohongshu.com/explore/' + id, 6: id, 7: i === 0 ? '头部' : '腰部', 9: '图文', 16: '受控启萃内容' + ['甲', '乙', '丙'][i], 17: i === 0 ? '产品科普' : '生活场景', 18: '受控切角' }, 20));
  const adHeader = cells({ 9: '时间', 15: '消费' }, 43);
  const ads = [cells({ 9: '2026-09-29', 10: '信息流', 15: 100, 16: 1000, 17: 10, 26: 5 }, 43), cells({ 9: '2026-09-29', 10: '搜索', 15: 200, 16: 2000, 17: 30, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '信息流', 15: 150, 16: 1000, 17: 20, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '搜索', 15: 250, 16: 2000, 17: 60, 26: 20 }, 43)];
  return { '3Wsban': [Array(40).fill('字段'), ...notes], '4bTvDu': [Array(20).fill('字段'), ...creators], '1XSPsH': [adHeader, ...ads], 'kMYs9o': [Array(40).fill(null), cells({ 15: '信息流' }, 40), cells({ 1: '2026-09-29', 7: 400, 15: 100, 18: 200, 20: 0.7, 32: 0.5 }, 40), cells({ 1: '2026-09-30', 7: 500, 15: 150, 18: 250, 20: 0.8, 32: 0.6 }, 40)] };
}
async function prepare(page: Page, request: APIRequestContext) {
  expect((await request.post('/api/projects', { headers: platform, data: { action: 'add_member', projectId: 'qicui', userId: 'user-editor', role: 'project_admin' } })).status()).toBe(200);
  await page.context().setExtraHTTPHeaders(editor);
  const base = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect((await request.post('/api/dashboards', { headers: editor, data: { action: 'set_components', projectId: 'qicui', version: base.dashboards[0].version, components: DEFAULT_BUSINESS_COMPONENTS } })).status()).toBe(200);
  expect((await request.post(vendor + '/__fixture/legacy-sheets', { data: { sheets: historicalSheets() } })).status()).toBe(200);
  await page.goto('/projects/qicui'); const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST'); await page.getByRole('button', { name: '同步最新数据', exact: true }).click(); const response = await synced; expect(response.status()).toBe(200); const result = await response.json(); expect(result.actorUserId).toBe('user-editor');
  for (const sheetId of Object.keys(historicalSheets())) expect(result.reports.find((report: { sheetId: string }) => report.sheetId === sheetId).status).toBe('success');
  // Only these four historic vendor tables are configured; other reports must remain explicit failures.
  expect(result.ok).toBe(false); expect(result.errors.length).toBeGreaterThan(0);
  const actual = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json(); expect(actual.notes.filter((note: { title: string }) => note.title.startsWith('受控启萃内容')).length).toBe(3); expect(actual.metrics.readCount).toBe(90000); expect(actual.metrics.interactionCount).toBe(600); expect(actual.feishu.daily.at(-1)).toMatchObject({ date: '2026-09-30', actual_spend: 400, plan_spend: 500, feed_ctr: 2, search_ctr: 3, achieve_pct: 80 });
  await expect(page.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible(); await expect(page.getByText('已记录阅读量最多的区间：', { exact: false })).toContainText('1万–5万');
  return actual;
}
for (const width of [1280, 390]) {
  test(`历史业务组件 ${width}px：真实四表同步、复杂图表、选择移动、发布刷新与只读一致`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const before = await prepare(page, request); const board = page.getByTestId('business-component-board-overview');
    await expect(board).toContainText('3篇完整记录'); await expect(board).toContainText('达人层级互动量箱线图'); await expect(board).toContainText('受控启萃内容丙');
    await page.screenshot({ path: info.outputPath('historic-data-before-layout.png'), fullPage: true }); await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true });
    await dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: '上移内容效果深度分析', exact: true }).click();
    await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).focus(); await expect(dialog.getByRole('button', { name: '发布业务组件布局', exact: true })).toBeInViewport(); await page.screenshot({ path: info.outputPath('business-layout-editor-open.png') });
    const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.keyboard.press('Enter'); expect((await published).status()).toBe(200); await expect(dialog).toHaveCount(0); await expect(board.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
    const order = await board.locator('[data-component-order]').getAttribute('data-component-order'); expect(order!.indexOf('content-effects')).toBeLessThan(order!.indexOf('budget')); await page.reload(); await expect(board.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0); await expect(board).toContainText('受控启萃内容丙');
    const after = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json(); expect(after.notes).toEqual(before.notes); expect(after.metrics.readCount).toBe(90000); const saved = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect(JSON.parse(saved.dashboards[0].layoutJson).businessComponents).not.toContain('kfs');
    await page.screenshot({ path: info.outputPath('published-historic-components.png'), fullPage: true });
    await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); await dialog.getByRole('checkbox', { name: '显示内容效果深度分析', exact: true }).uncheck(); await dialog.getByRole('button', { name: '取消布局修改', exact: true }).click(); await expect(board.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible();
    expect((await request.post('/api/projects', { headers: platform, data: { action: 'add_member', projectId: 'qicui', userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/qicui'); await expect(page.getByRole('button', { name: '配置业务组件布局', exact: true })).toHaveCount(0); await expect(board).toContainText('受控启萃内容丙'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  for (const failure of ['500', 'network', '409']) test(`组件发布恢复 ${width}px ${failure}：选择与顺序不丢，成功后才应用新布局`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await prepare(page, request); await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true });
    await dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); await dialog.getByRole('button', { name: '上移预算消耗节奏对比', exact: true }).click();
    if (failure === '409') { const current = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect((await request.post('/api/dashboards', { headers: editor, data: { projectId: 'qicui', action: 'set_components', version: current.dashboards[0].version, components: ['content-effects'] } })).status()).toBe(200); }
    else { let injected = false; await page.route('**/api/dashboards', async route => { if (!injected && route.request().method() === 'POST') { injected = true; if (failure === 'network') await route.abort('failed'); else await route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"模拟布局发布故障"}' }); } else await route.continue(); }); }
    await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByRole('alert')).toBeFocused(); await expect(dialog.getByRole('alert')).toBeInViewport(); await expect(dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true })).not.toBeChecked(); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toBeAttached(); await page.screenshot({ path: info.outputPath('component-error-draft-preserved.png') });
    if (failure === '409') { await dialog.getByRole('button', { name: /读取最新布局版本并保留选择/ }).click(); await expect(dialog.getByRole('alert')).toContainText('当前组件选择和顺序保留'); }
    const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); expect((await published).status()).toBe(200); await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0); await page.reload(); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  });
  test(`日报组件 ${width}px：真实400消耗与加权CTR，单独选择日报区块，空布局刷新与恢复完整图表`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await prepare(page, request); await page.getByRole('button', { name: /分日 · 日报监控看板/ }).click(); const daily = page.getByTestId('business-component-board-daily');
    await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400'); await expect(daily.locator('.reference-kpi').filter({ hasText: '信息流 CTR' })).toContainText('2'); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await dialog.getByRole('checkbox', { name: '显示计划消耗与点击效率趋势', exact: true }).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toHaveCount(0); await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400');
    await page.screenshot({ path: info.outputPath('daily-component-filtered-with-real-values.png'), fullPage: true });
    await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const checked = dialog.getByRole('checkbox'); for (let i = 0; i < await checked.count(); i++) await checked.nth(i).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.reload(); await expect(daily).toContainText('本视图未选择业务组件'); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); await dialog.getByRole('button', { name: '恢复全部业务组件与默认顺序', exact: true }).click(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toBeVisible();
  });
  test(`共享卡片保护 ${width}px：组件发布不覆盖正在编辑的标题草稿，按真实冲突版本重试仍保留已发布组件选择`, async ({ page, request }) => {
    const draftTitle = '组件发布期间保留的草稿' + width; await page.setViewportSize({ width, height: 900 }); await prepare(page, request);
    await connectExistingProjectTable(page, request, 'qicui', [['任务'], ['本项目记录甲'], ['本项目记录乙']], 'ComponentOwn-' + Date.now());
    const source = (await (await request.get('/api/datasets?projectId=qicui', { headers: editor })).json()).datasets.find((item: { sourceId: string; name: string }) => item.name === '补修数据');
    const created = await request.post('/api/metric-definitions', { headers: editor, data: { action: 'save', projectId: 'qicui', name: '组件场景独立记录' + Date.now(), expectedVersion: 0, config: { datasetId: source.id, aggregation: 'count' } } }); expect(created.status()).toBe(200); const definition = await created.json();
    await page.goto('/projects/qicui/metrics'); await page.getByRole('row').filter({ has: page.getByRole('cell', { name: definition.config.title, exact: true }) }).getByRole('button', { name: '加入看板', exact: true }).click(); await page.getByRole('button', { name: '加入草稿', exact: true }).click();
    const first = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await first).status()).toBe(200); await dismissProjectNotifications(page);
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); const card = page.getByRole('article', { name: definition.config.title, exact: true }); await card.getByTitle('编辑卡片', { exact: true }).click(); const cardDialog = page.getByRole('dialog'); await cardDialog.getByLabel('卡片标题', { exact: true }).fill(draftTitle); await cardDialog.getByRole('button', { name: '加入草稿', exact: true }).click();
    await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const layout = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await layout.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); await layout.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(layout).toHaveCount(0); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toContainText('2');
    const conflict = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await conflict).status()).toBe(409); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '强制覆盖发布', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload(); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toContainText('2'); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  });
}
