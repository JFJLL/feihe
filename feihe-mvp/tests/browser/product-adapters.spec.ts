import { test, expect } from './evidence';
import type { Page, APIRequestContext } from '@playwright/test';
const identity = { 'x-user-id': 'user-editor' };
const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
async function dismissNotifications(page: Page) {
  const close = page.getByRole('button', { name: '关闭通知', exact: true });
  while (await close.count()) await close.first().click();
}
async function connect(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  await page.context().setExtraHTTPHeaders(identity);
  const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '字段驱动接入' + Date.now(), templateId } });
  expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  const token = 'Adapter-' + projectId;
  expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  await page.goto('/projects/' + projectId + '/data');
  await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: '数据集', exact: true }).click();
  await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][2]));
  return { projectId, token };
}
test('字段推荐反例：陌生四列表接入后可以经真实控件确认适用的指标和看板', async ({ page, request }, info) => {
  const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
  await page.screenshot({ path: info.outputPath('no-field-recommendation.png'), fullPage: true });
  await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('成交率');
  await expect(page.getByRole('dialog')).not.toContainText('预算执行率');
  await expect(page.getByRole('dialog')).not.toContainText('任务完成率');
  expect((await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json()).datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(['日期', '渠道', '咨询人数', '成交人数']);
});
test('投放断链反例：五列新来源真实入库后专属投放消耗显示本项目300', async ({ page, request }, info) => {
  const { projectId } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
  await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('广告消耗：300');
  await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toBeVisible();
  const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  await page.goto('/projects/' + projectId);
  const overview = page.getByTestId('ad-performance-overview');
  await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
  await page.screenshot({ path: info.outputPath('imported-ad-dataset-connected.png'), fullPage: true });
  await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
});
async function confirmRecommendations(page: Page) {
  await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toBeVisible();
  const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  await dismissNotifications(page);
}
for (const width of [1280, 390]) {
  test(`字段对应 ${width}px：不同名称的原表经选择器确认后驱动专属页，重复确认不增加对象`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connect(page, request, 'ad_performance', [['业务发生日', '投放位置', '消耗金额', '展示次数', '访问点击'], ['2026-10-01', '独立位置', 125, 1000, 15]]);
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('专属投放分析仍缺少');
    for (const [label, column] of [['渠道', '投放位置'], ['花费', '消耗金额'], ['曝光', '展示次数'], ['点击', '访问点击']]) {
      await page.getByRole('combobox', { name: label + '对应字段', exact: true }).click();
      await page.getByRole('option', { name: column, exact: true }).click();
    }
    await expect(page.getByRole('dialog')).toContainText('广告消耗：125');
    await page.getByText('确认字段对应', { exact: true }).click();
    const field = page.getByRole('combobox', { name: '花费对应字段', exact: true });
    await field.focus(); await field.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: info.outputPath('ad-field-correspondence-confirmed.png') });
    await field.press('Escape'); await expect(field).toBeFocused();
    const confirm = page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true });
    await confirm.focus(); await confirm.press('Enter');
    const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
    await page.getByRole('link', { name: '投放分析', exact: true }).click();
    await expect(page.getByTestId('ad-performance-overview')).toContainText('125');
    await expect(page.getByTestId('ad-performance-overview')).toContainText('独立位置');
    const index = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(index.metrics).toHaveLength(5);
    const source = (await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json()).datasets[0];
    const confirmed = await request.post('/api/metric-recommendations', { headers: identity, data: { projectId, datasetId: source.id, datasetVersion: source.version, selected: ['records', 'spend', 'impressions', 'clicks', 'ctr'], roles: { date: '业务发生日', channel: '投放位置', spend: '消耗金额', impressions: '展示次数', clicks: '访问点击' }, bindBusiness: true } }); expect(confirmed.status()).toBe(200);
    const again = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(again.metrics).toHaveLength(5); expect(again.metrics.map((m: { id: string }) => m.id).sort()).toEqual(index.metrics.map((m: { id: string }) => m.id).sort());
    const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json(); expect(board.cards).toHaveLength(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`陌生部门推荐 ${width}px：四列原表→确认→六卡发布→刷新→同口径趋势与渠道`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
    await confirmRecommendations(page); await page.reload();
    await expect(page.getByRole('article', { name: '记录数量', exact: true })).toContainText('2');
    await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('300');
    await expect(page.getByRole('article', { name: '成交率', exact: true })).toContainText('10.0%');
    const trend = page.getByRole('article', { name: '成交率趋势', exact: true });
    await trend.getByText('查看每日数值与样本', { exact: true }).click();
    await expect(trend.getByRole('table')).toContainText('20.0%'); await expect(trend.getByRole('table')).toContainText('5.0%');
    await expect(page.getByRole('article', { name: '成交率按渠道', exact: true })).toContainText('20.0%');
    await page.screenshot({ path: info.outputPath('field-recommended-board-published.png'), fullPage: true });
    const index = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(index.metrics).toHaveLength(4);
    const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json(); expect(board.cards).toHaveLength(6);
    for (const card of board.cards) expect(JSON.parse(card.configJson).metricId).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`投放真实链路 ${width}px：确认自己的五列来源→专属页→同步更新→共享定义改版→只读与刷新`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId, token } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
    await confirmRecommendations(page);
    await page.getByRole('link', { name: '投放分析', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/projects/' + projectId + '/ads$'));
    await expect(page.getByRole('link', { name: '投放分析', exact: true })).toHaveAttribute('aria-current', 'page');
    const overview = page.getByTestId('ad-performance-overview'), cost = overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' });
    await expect(cost).toContainText('300'); await expect(overview).toContainText('4,000'); await expect(overview).toContainText('70'); await expect(overview).toContainText('1.8%');
    await expect(overview).toContainText('授权飞书投放表'); await expect(overview.getByRole('table', { name: '投放渠道消耗', exact: true })).toContainText('新客户门店');
    await expect(cost).not.toContainText('¥'); await dismissNotifications(page); await page.screenshot({ path: info.outputPath('own-ad-source-real-results.png'), fullPage: true });
    const workspace = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json(); const sourceId = workspace.sources[0].id;
    await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 500, 5000, 100], ['2026-10-02', '新客户线上', 100, 1000, 20]] } });
    expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
    await page.reload(); await expect(cost).toContainText('600'); await expect(overview).toContainText('数据 v2'); await expect(overview).toContainText('2.0%');
    await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
    await expect(cost).toContainText('500');
    await page.goto('/projects/' + projectId + '/metrics');
    await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '广告消耗', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
    await page.getByRole('combobox', { name: '指标计算方式', exact: true }).click(); await page.getByRole('option', { name: '数值平均 (Average)', exact: true }).click();
    await page.getByRole('button', { name: '保存指标', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/projects/' + projectId + '/ads'); await expect(cost).toContainText('300'); await expect(cost).toContainText('指标 v2');
    await page.goto('/projects/' + projectId); await expect(page.getByRole('article', { name: '广告消耗', exact: true })).toContainText('300'); await expect(page.getByRole('article', { name: '广告消耗', exact: true })).toContainText('指标 v2');
    await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } });
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/ads'); await expect(cost).toContainText('300');
    await page.goto('/projects/' + projectId + '/data?tab=datasets'); await expect(page.getByRole('button', { name: '推荐指标与看板', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
