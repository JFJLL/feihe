import { test, expect } from './evidence';
import type { Page, APIRequestContext } from '@playwright/test';

const identity = { 'x-user-id': 'user-editor' };
const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function fixture(request: APIRequestContext) {
  const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '共同周期与五类呈现' + Date.now(), templateId: 'general_workbench' } });
  expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  const token = 'BoardViews-' + projectId;
  await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [
    ['日期', '渠道', '咨询人数', '成交人数'],
    ['2026-10-01 12:00:00', '门店', 100, 20],
    ['2026-10-01 23:59:59', '线上', 100, 10],
    ['2026-10-02 00:00:00', '门店', 100, 50],
    ['', '门店', 100, 90],
  ] } });
  const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '仅四列业务表', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
  expect(source.status()).toBe(200);
  expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
  const state = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  const dataset = state.datasets[0]; expect(dataset.columns.find((c: { key: string }) => c.key === '日期').type).toBe('date');
  const config = { datasetId: dataset.id, aggregation: 'ratio', numField: '成交人数', denField: '咨询人数', dateField: '日期', missingPolicy: 'skip', ratioBasis: 'paired', format: 'percent', unit: '%' };
  const saved = await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, name: '成交率', config } });
  expect(saved.status()).toBe(200);
  return { projectId, metricId: (await saved.json()).id, config, sourceId: (await source.json()).id, token };
}

for (const width of [1280, 390]) {
  test(`明细分页 ${width}px：实际同步改变总页数后重读同口径指标与明细`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
    const { projectId, metricId, sourceId, token } = await fixture(request);
    const header = ['日期', '渠道', '咨询人数', '成交人数'];
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [header, ...Array.from({ length: 31 }, () => ['2026-10-01', '门店', 100, 1])] } });
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
    expect((await request.post('/api/dashboards', { headers: identity, data: { projectId, cards: [{ title: '分页可核对', type: 'detail_table', config: { metricId } }] } })).status()).toBe(200);
    await page.goto('/projects/' + projectId);
    const article = page.getByRole('article', { name: '分页可核对', exact: true });
    await expect(article).toContainText('1.0%'); await expect(article).toContainText('共 31 条符合条件记录 · 第 1 / 3 页');
    await article.getByRole('button', { name: '明细下一页', exact: true }).click();
    await expect(article).toContainText('第 2 / 3 页'); await expect(article.getByRole('table').getByRole('row')).toHaveCount(16);
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [header, ['2026-10-01', '门店', 100, 2]] } });
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
    await article.getByRole('button', { name: '明细下一页', exact: true }).click();
    await expect(article).toContainText('共 1 条符合条件记录 · 第 1 / 1 页');
    await expect(article).toContainText('2.0%'); await expect(article).toContainText('数据 v3');
    await expect(article.getByRole('table').getByRole('row')).toHaveCount(2);
    await article.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('detail-page-corrected-after-sync.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`小百分比目标 ${width}px：比例存储的平均与趋势不重复转换，明确目标保存刷新回填`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
    const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '比例目标' + Date.now(), templateId: 'general_workbench' } }); const projectId = (await created.json()).id;
    const token = 'FractionGoal-' + projectId;
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['日期', '完成率'], ['2026-10-01', '0.5%'], ['2026-10-01', '1.5%']] } });
    const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '小百分比来源', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
    const datasets = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
    const definition = await request.post('/api/metric-definitions', { headers: identity, data: { projectId, action: 'save', name: '平均完成率', config: { datasetId: datasets.datasets[0].id, aggregation: 'avg', field: '完成率', dateField: '日期', format: 'percent', unit: '%', percentScale: 'fraction', missingPolicy: 'skip' } } }); const metricId = (await definition.json()).id;
    expect(definition.status()).toBe(200);
    await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await addCard(page, '平均完成趋势', '时间趋势', async () => { await expect(page.getByRole('dialog')).toContainText('2026-10-01：1.0%'); });
    await addCard(page, '小比例目标', '目标进度', async () => { await page.getByLabel('目标数值', { exact: true }).fill('2'); await expect(page.getByRole('dialog')).toContainText('预览：1.0%'); });
    await publish(page); await page.reload();
    const goal = page.getByRole('article', { name: '小比例目标', exact: true });
    await expect(goal).toContainText('目标：2.0% · 达成 50.0%');
    await expect(page.getByRole('article', { name: '平均完成趋势', exact: true })).toContainText('1.0%');
    await goal.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('fraction-target-published.png') });
    const stored = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(JSON.parse(stored.cards[1].configJson)).toMatchObject({ metricId, target: 0.02 });
    const rows = await (await request.get('/api/datasets?projectId=' + projectId + '&id=' + datasets.datasets[0].id + '&all=true', { headers: identity })).json();
    expect(rows.dataset.rows.map((row: { 完成率: number }) => row.完成率)).toEqual([0.005, 0.015]);
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); await goal.getByTitle('编辑卡片', { exact: true }).click();
    await expect(page.getByLabel('目标数值', { exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('button', { name: '取消编辑', exact: true }).click();
    await page.goto('/projects/' + projectId + '/metrics');
    await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '平均完成率', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
    await choose(page, '指标计算方式', '记录计数 (Count)');
    await page.getByRole('button', { name: '保存指标', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/projects/' + projectId);
    await expect(goal).toContainText('指标结果单位已变化，请重新确认目标后发布');
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); await goal.getByTitle('编辑卡片', { exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('旧目标对应指标 v1'); await expect(page.getByRole('button', { name: '加入草稿', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('goal-unit-change-confirmation.png') });
    await page.getByLabel('目标数值', { exact: true }).fill('3'); await page.getByRole('button', { name: '加入草稿', exact: true }).click();
    await publish(page); await page.reload();
    await expect(goal).toContainText('目标：3 · 达成 66.7%');
    const confirmed = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(JSON.parse(confirmed.cards[1].configJson)).toMatchObject({ target: 3, targetMetricVersion: 2 });
  });
}

test('共享看板反例：同一指标能通过真实控件选择时间趋势', async ({ page, request }, info) => {
  await page.context().setExtraHTTPHeaders(identity); const { projectId } = await fixture(request);
  await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  await page.getByRole('combobox', { name: '展示呈现形式', exact: true }).click();
  await page.screenshot({ path: info.outputPath('trend-option.png') });
  await page.getByRole('option', { name: '时间趋势', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('按项目时区');
});
test('共享看板反例：项目周期是真实日期控件且包含完整结束日', async ({ page, request }, info) => {
  await page.context().setExtraHTTPHeaders(identity); const { projectId, metricId } = await fixture(request);
  expect((await request.post('/api/dashboards', { headers: identity, data: { projectId, cards: [{ title: '团队成交率', type: 'metric_card', config: { metricId } }] } })).status()).toBe(200);
  await page.goto('/projects/' + projectId);
  await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('42.5%');
  await page.screenshot({ path: info.outputPath('missing-project-period.png') });
  await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01');
  await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('15.0%');
  await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('成对有效 2 行');
});

async function addCard(page: Page, title: string, presentation: string, extra?: () => Promise<void>) {
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  await page.getByRole('textbox', { name: '卡片标题', exact: true }).fill(title);
  await choose(page, '展示呈现形式', presentation);
  if (extra) await extra();
  await expect(page.getByRole('button', { name: '加入草稿', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '加入草稿', exact: true }).click();
}
async function publish(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click();
  expect((await response).status()).toBe(200);
}
for (const width of [1280, 1440, 768, 390]) {
  test(`共享五类呈现 ${width}px：页面选用同ID、完整周期、明确目标，发布刷新及定义更新一致`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
    const { projectId, metricId } = await fixture(request);
    await page.goto('/projects/' + projectId);
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01');
    await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
    await addCard(page, '同口径单值', '单值指标');
    await addCard(page, '同口径趋势', '时间趋势', async () => { await expect(page.getByRole('dialog')).toContainText('2026-10-01：15.0%'); });
    await addCard(page, '同口径渠道', '分组对比', async () => { await choose(page, '分组字段', '渠道'); });
    await addCard(page, '同口径明细', '明细表');
    await addCard(page, '本项目目标', '目标进度', async () => {
      await expect(page.getByLabel('目标数值', { exact: true })).toHaveValue('');
      await expect(page.getByRole('button', { name: '加入草稿', exact: true })).toBeDisabled();
      await page.getByLabel('目标数值', { exact: true }).fill('20');
      await expect(page.getByRole('dialog').getByRole('status')).toContainText('预览：15.0%');
      await page.getByRole('combobox', { name: '卡片日期范围', exact: true }).click();
      await page.screenshot({ path: info.outputPath('five-presentations-picker-open.png') });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('combobox', { name: '卡片日期范围', exact: true })).toBeFocused();
      await page.getByRole('button', { name: '加入草稿', exact: true }).focus();
      await page.keyboard.press('Tab'); await expect(page.getByRole('dialog')).toBeVisible();
    });
    await expect(page.getByRole('article', { name: '本项目目标', exact: true })).toContainText('目标：20.0% · 达成 75.0%');
    const trend = page.getByRole('article', { name: '同口径趋势', exact: true });
    await trend.getByText('查看每日数值与样本', { exact: true }).click();
    await expect(trend.getByRole('table', { name: '同口径趋势每日结果', exact: true })).toContainText('15.0%');
    await publish(page); await page.reload();
    for (const title of ['同口径单值', '同口径趋势', '同口径渠道', '同口径明细', '本项目目标']) {
      await expect(page.getByRole('article', { name: title, exact: true })).toContainText('15.0%');
      await expect(page.getByRole('article', { name: title, exact: true })).toContainText('指标 v1');
    }
    const detail = page.getByRole('article', { name: '同口径明细', exact: true });
    await expect(detail.getByRole('table', { name: '同口径明细明细', exact: true })).toContainText('成交人数');
    await expect(detail.getByRole('table').getByRole('row')).toHaveCount(3);
    await expect(detail.getByRole('table')).toContainText('20'); await expect(detail.getByRole('table')).not.toContainText('2026-10-02');
    await page.screenshot({ path: info.outputPath('five-presentations-published.png'), fullPage: true });
    const stored = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(stored.cards).toHaveLength(5);
    expect(JSON.parse(stored.dashboards[0].layoutJson).query).toEqual({ from: '2026-10-01', to: '2026-10-01' });
    for (const row of stored.cards) { const value = JSON.parse(row.configJson); expect(value.metricId).toBe(metricId); expect(value.numField).toBeUndefined(); expect(value.format).toBeUndefined(); }
    expect(JSON.parse(stored.cards.find((row: { title: string }) => row.title === '本项目目标').configJson).target).toBe(20);
    await choose(page, '共同筛选字段', '渠道'); await choose(page, '共同筛选值', '门店');
    for (const title of ['同口径单值', '同口径趋势', '同口径渠道', '同口径明细', '本项目目标']) await expect(page.getByRole('article', { name: title, exact: true })).toContainText('20.0%');
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); await publish(page);
    await page.goto('/projects/' + projectId + '/metrics');
    await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '成交率', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
    await choose(page, '分子字段', '咨询人数'); await page.getByRole('button', { name: '保存指标', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/projects/' + projectId);
    for (const title of ['同口径单值', '同口径趋势', '同口径渠道', '同口径明细', '本项目目标']) {
      await expect(page.getByRole('article', { name: title, exact: true })).toContainText('100.0%');
      await expect(page.getByRole('article', { name: title, exact: true })).toContainText('指标 v2');
    }
    await expect(page.getByRole('article', { name: '本项目目标', exact: true })).toContainText('达成 500.0%');
    await expect(detail.getByRole('table').getByRole('row')).toHaveCount(2);
    const final = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(JSON.parse(final.dashboards[0].layoutJson).query.filters).toEqual([{ key: '渠道', value: '门店' }]);
    await page.screenshot({ path: info.outputPath('five-presentations-updated-definition.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } });
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId);
    await expect(page.getByRole('article', { name: '同口径单值', exact: true })).toContainText('100.0%');
    await expect(page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true })).toHaveCount(0);
    await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-02');
    await expect(page.getByRole('article', { name: '同口径明细', exact: true })).toContainText('共 2 条符合条件记录');
    const viewerState = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(JSON.parse(viewerState.dashboards[0].layoutJson).query.to).toBe('2026-10-01');
  });
  test(`独立周期 ${width}px：真实控件选择后保存刷新重新编辑，覆盖范围明确标注`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
    const { projectId, metricId } = await fixture(request);
    await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
    await addCard(page, '跟随团队周期', '单值指标');
    await addCard(page, '独立日期趋势', '时间趋势', async () => {
      await choose(page, '卡片日期范围', '使用独立周期');
      await page.getByLabel('卡片开始日期', { exact: true }).fill('2026-10-02'); await page.getByLabel('卡片结束日期', { exact: true }).fill('2026-10-02');
      await expect(page.getByRole('dialog')).toContainText('2026-10-02：50.0%');
    });
    await publish(page); await page.reload();
    await expect(page.getByRole('article', { name: '跟随团队周期', exact: true })).toContainText('15.0%');
    const independent = page.getByRole('article', { name: '独立日期趋势', exact: true });
    await expect(independent).toContainText('50.0%'); await expect(independent).toContainText('独立周期：2026-10-02 ～ 2026-10-02');
    await independent.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('independent-range-label.png') });
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); await independent.getByTitle('编辑卡片', { exact: true }).click();
    await expect(page.getByLabel('卡片开始日期', { exact: true })).toHaveValue('2026-10-02'); await expect(page.getByLabel('卡片结束日期', { exact: true })).toHaveValue('2026-10-02');
    await expect(page.getByRole('combobox', { name: '卡片日期范围', exact: true })).toContainText('使用独立周期');
    await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('button', { name: '取消编辑', exact: true }).click();
    const stored = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
    expect(JSON.parse(stored.cards[1].configJson)).toMatchObject({ metricId, rangePolicy: 'independent', from: '2026-10-02', to: '2026-10-02' });
  });
}

for (const width of [1280, 390]) {
  for (const failure of ['409', '500', 'network']) {
    test(`周期草稿 ${width}px ${failure}：保存并切换失败保留原数据集、卡片和周期，重试后才切换`, async ({ page, request }, info) => {
      await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
      const { projectId, metricId } = await fixture(request);
      const query = { from: '2026-10-01', to: '2026-10-01' };
      const body = { projectId, layout: { kind: 'project_board', version: 1, query }, cards: [{ title: '初始结果', type: 'metric_card', config: { metricId } }] };
      expect((await request.post('/api/dashboards', { headers: identity, data: body })).status()).toBe(200);
      const otherToken = 'OtherBoard-' + projectId;
      await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: otherToken, rows: [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '第二来源', 1, 1]] } });
      const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '第二来源', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + otherToken, sheetId: 'sheetA', mappingJson: '[]' } });
      expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
      await page.goto('/projects/' + projectId);
      await page.getByRole('combobox', { name: '当前业务数据集', exact: true }).click(); await page.getByRole('option', { name: /仅四列业务表 \(4 行\)/ }).click();
      await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
      await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-02');
      await page.getByRole('article', { name: '初始结果', exact: true }).getByTitle('编辑卡片', { exact: true }).click();
      await page.getByRole('textbox', { name: '卡片标题', exact: true }).fill('卡片和周期都必须保留'); await page.getByRole('button', { name: '加入草稿', exact: true }).click();
      await expect(page.getByRole('article', { name: '卡片和周期都必须保留', exact: true })).toContainText('26.7%');
      if (failure === '409') expect((await request.post('/api/dashboards', { headers: identity, data: body })).status()).toBe(200);
      else await page.route('**/api/dashboards', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        if (failure === 'network') return route.abort('internetdisconnected');
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '隔离测试保存500' }) });
      }, { times: 1 });
      await page.getByRole('combobox', { name: '当前业务数据集', exact: true }).click(); await page.getByRole('option', { name: /第二来源 \(1 行\)/ }).click();
      await page.getByRole('button', { name: '保存修改', exact: true }).click();
      if (failure === '409') {
        await expect(page.getByRole('dialog', { name: '检测到看板并发修改冲突 (409)', exact: true })).toContainText('v3');
        await page.screenshot({ path: info.outputPath('period-conflict-preserves-draft.png') });
        await page.getByRole('button', { name: '保留草稿并关闭', exact: true }).click();
      } else await expect(page.getByText(failure === 'network' ? /Failed to fetch|网络|fetch/i : '隔离测试保存500', { exact: failure === '500' }).first()).toBeVisible();
      await expect(page.getByRole('combobox', { name: '当前业务数据集', exact: true })).toContainText('仅四列业务表');
      await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-02');
      await expect(page.getByRole('article', { name: '卡片和周期都必须保留', exact: true })).toContainText('26.7%');
      await page.getByRole('button', { name: '继续编辑', exact: true }).click();
      await page.getByRole('article', { name: '卡片和周期都必须保留', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('period-save-failed-draft.png'), fullPage: true });
      const unchanged = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
      expect(JSON.parse(unchanged.dashboards[0].layoutJson).query.to).toBe('2026-10-01'); expect(unchanged.cards[0].title).toBe('初始结果');
      await page.getByRole('combobox', { name: '当前业务数据集', exact: true }).click(); await page.getByRole('option', { name: /第二来源 \(1 行\)/ }).click();
      if (failure === '409') {
        await page.getByRole('button', { name: '保存修改', exact: true }).click();
        const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
        await page.getByRole('button', { name: '强制覆盖发布', exact: true }).click(); expect((await response).status()).toBe(200);
      } else {
        const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
        await page.getByRole('button', { name: '保存修改', exact: true }).click(); expect((await response).status()).toBe(200);
      }
      await expect(page.getByRole('combobox', { name: '当前业务数据集', exact: true })).toContainText('第二来源');
      await page.reload(); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-02');
      await expect(page.getByRole('article', { name: '卡片和周期都必须保留', exact: true })).toContainText('26.7%');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    });
  }
}
