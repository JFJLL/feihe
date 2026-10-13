import { test, expect } from './evidence';
import type { APIRequestContext, Page } from '@playwright/test';

const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
const identity = { 'x-user-id': 'user-editor' };
async function create(request: APIRequestContext, name: string) {
  const response = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: name + Date.now(), templateId: 'general_workbench' } });
  expect(response.status()).toBe(200); return (await response.json()).id as string;
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function dismissNotices(page: Page) {
  const notices = page.getByRole('button', { name: '关闭通知', exact: true });
  while (await notices.count()) await notices.first().click();
}
for (const width of [1280, 390]) {
  test(`数据工作台 ${width}px：四列原表经真实接入、明细、字段和同步记录贯通`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.context().setExtraHTTPHeaders(identity);
    const projectId = await create(request, '陌生部门数据工作台'), token = 'ProductData-' + projectId;
    const raw = [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 100, 10], ['2026-10-03', '门店', 50, 5]];
    expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: raw } })).ok()).toBeTruthy();
    await page.goto('/projects/' + projectId + '/data');
    await expect(page.getByRole('heading', { name: '数据工作台', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '数据管理', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: /接入飞书数据源/ }).click();
    await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
    await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
    await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
    const sync = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click();
    expect((await sync).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: '数据集', exact: true }).click();
    await expect(page.getByRole('heading', { name: '数据集明细', exact: true })).toBeVisible();
    const table = page.getByRole('table', { name: '业务数据明细', exact: true });
    await expect(table.getByRole('columnheader')).toHaveText(['日期', '渠道', '咨询人数', '成交人数']);
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table.getByRole('cell', { name: '20', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '字段与质量检查', exact: true }).click();
    await expect(page.getByRole('table', { name: '字段质量', exact: true })).toContainText('咨询人数');
    await expect(page.getByText('已检查完整数据集 3 行', { exact: true })).toBeVisible();
    await expect(page.getByText('自动同步未启用；当前需手动同步', { exact: true })).toBeVisible();
    await dismissNotices(page);
    if (width === 390) {
      const scrollArea = page.getByRole('table', { name: '字段质量', exact: true }).locator('..');
      await scrollArea.scrollIntoViewIfNeeded(); await scrollArea.focus();
      for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('table', { name: '字段质量', exact: true }).getByRole('columnheader', { name: '类型错误', exact: true })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: info.outputPath('390-quality-keyboard-scroll.png'), fullPage: true });
      for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowLeft');
      await expect(page.getByRole('table', { name: '字段质量', exact: true }).getByRole('columnheader', { name: '字段显示名', exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: info.outputPath('data-fields-and-rows.png'), fullPage: true });
    await page.getByRole('tab', { name: '同步记录', exact: true }).click();
    await expect(page.getByRole('table', { name: '来源同步记录', exact: true })).toContainText('成功');
    await expect(page.getByRole('table', { name: '来源同步记录', exact: true })).toContainText('3');
    await page.reload();
    await expect(page.getByRole('tab', { name: '同步记录', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('/data?tab=runs');
    const state = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json();
    expect(state.sources).toHaveLength(1); expect(state.datasets).toHaveLength(1);
    expect(state.datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(raw[0]);
    expect(state.runs[0]).toMatchObject({ status: 'success', rowsRead: 3, rowsImported: 3 });
    expect(state.sources[0].datasetIds).toEqual([state.datasets[0].id]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  test(`数据工作台 ${width}px：只读明细、分页搜索、项目隔离和来源权限`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const projectId = await create(request, '只读数据明细'), token = 'DataPage-' + projectId;
    const rows = [['日期', '渠道', '咨询人数', '成交人数'], ...Array.from({ length: 31 }, (_, i) => ['2026-10-01', '渠道' + (i + 1), 100 + i, i + 1])];
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } });
    const saved = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '明细来源', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', kind: 'general', type: 'feishu_sheet' } });
    const sourceId = (await saved.json()).id; expect(sourceId).toBeTruthy();
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
    expect((await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' });
    await page.goto('/projects/' + projectId + '/data?tab=datasets');
    await expect(page.getByRole('heading', { name: '数据集明细', exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(16);
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('渠道16');
    let releaseOld!: () => void, oldStarted!: () => void, oldFinished!: () => void;
    const started = new Promise<void>(resolve => { oldStarted = resolve; });
    const finished = new Promise<void>(resolve => { oldFinished = resolve; });
    const gate = new Promise<void>(resolve => { releaseOld = resolve; });
    await page.route('**/api/datasets?**', async route => {
      if (new URL(route.request().url()).searchParams.get('search') !== '渠道1') return route.continue();
      // Execute the real local query, then delay only delivery of its real response.
      const actual = await route.fetch(); oldStarted(); await gate;
      try { await route.fulfill({ response: actual }); } catch { /* The app may correctly abort the old request. */ }
      finally { oldFinished(); }
    });
    await page.getByRole('textbox', { name: '搜索数据明细', exact: true }).fill('渠道1');
    await started;
    await page.getByRole('textbox', { name: '搜索数据明细', exact: true }).fill('渠道31');
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('130');
    releaseOld(); await finished;
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('渠道31');
    await page.unrouteAll({ behavior: 'wait' });
    await page.getByRole('textbox', { name: '搜索数据明细', exact: true }).fill('');
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(16);
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByText('第 2 / 3 页 · 匹配 31 行', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByText('第 3 / 3 页 · 匹配 31 行', { exact: true })).toBeVisible();
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [rows[0], ['2026-10-01', '更新后的唯一渠道', 999, 1]] } });
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
    await page.getByRole('button', { name: '刷新数据状态', exact: true }).click();
    await expect(page.getByText('第 1 / 1 页 · 匹配 1 行', { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('999');
    await page.getByRole('tab', { name: '数据源', exact: true }).click();
    await expect(page.getByRole('table', { name: '来源与使用关系', exact: true })).toContainText('明细来源');
    await expect(page.getByRole('button', { name: /接入飞书数据源|立即同步|编辑\/映射/ })).toHaveCount(0);
    expect((await request.get('/api/data-workspace?projectId=' + projectId, { headers: { 'x-user-id': 'user-no-access' } })).status()).toBe(403);
    expect((await request.post('/api/feishu/sync', { headers: { 'x-user-id': 'user-viewer' }, data: { projectId, sourceId } })).status()).toBe(403);
    await choose(page, '数据源视图', '全部来源');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  test(`数据同步失败 ${width}px：真实校验失败保留旧快照，记录失败与复用来源恢复`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
    const projectId = await create(request, '失败同步历史'), token = 'DataFailure-' + projectId;
    const original = [['任务', '金额'], ...Array.from({ length: 12 }, (_, i) => ['任务' + (i + 1), i + 1])];
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: original } });
    await page.goto('/projects/' + projectId + '/data');
    await page.getByRole('button', { name: /接入飞书数据源/ }).click();
    await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
    await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
    await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
    await page.getByRole('checkbox', { name: '金额必填', exact: true }).check();
    const initialSync = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click();
    expect((await initialSync).status()).toBe(200); await expect(page.getByRole('dialog')).toHaveCount(0);
    const before = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json();
    const sourceId = before.sources[0].id, datasetId = before.datasets[0].id;
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [...original.slice(0, -1), ['任务12', '']] } });
    const failed = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '立即同步', exact: true }).click();
    expect((await failed).status()).toBe(500);
    await page.getByRole('tab', { name: '同步记录', exact: true }).click();
    const history = page.getByRole('table', { name: '来源同步记录', exact: true });
    await expect(history).toContainText('必填'); await expect(history).toContainText('失败'); await expect(history).toContainText('成功');
    await expect(history).toContainText('完整工作表');
    await dismissNotices(page);
    await page.screenshot({ path: info.outputPath('real-sync-failure-history.png'), fullPage: true });
    if (width === 390) {
      const scrollArea = history.locator('..'); await scrollArea.focus();
      for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
      await expect(history.getByRole('cell', { name: /第 12 行.*必填/ })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: info.outputPath('390-sync-error-details.png'), fullPage: true });
    }
    await page.getByRole('tab', { name: '数据集', exact: true }).click();
    await expect(page.getByText(/以下保留上一次成功数据/)).toBeVisible();
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(13);
    await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row').last()).toContainText('12');
    const stored = await (await request.get('/api/datasets?projectId=' + projectId + '&id=' + datasetId + '&all=true', { headers: identity })).json();
    expect(stored.dataset.rows.at(-1)['金额']).toBe(12); expect(stored.dataset.version).toBe(1);
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: original } });
    await page.getByRole('tab', { name: '数据源', exact: true }).click();
    const recovered = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '立即同步', exact: true }).click(); expect((await recovered).status()).toBe(200);
    await page.getByRole('tab', { name: '数据集', exact: true }).click();
    await expect(page.getByText(/以下保留上一次成功数据/)).toHaveCount(0);
    const after = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json();
    expect(after.sources).toHaveLength(1); expect(after.datasets).toHaveLength(1);
    expect(after.sources[0].id).toBe(sourceId); expect(after.datasets[0].id).toBe(datasetId);
    expect(after.datasets[0].version).toBe(2); expect(after.runs.map((run: { status: string }) => run.status)).toEqual(['success', 'failed', 'success']);
  });
}
