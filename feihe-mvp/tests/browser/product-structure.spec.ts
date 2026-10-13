import { test, expect } from './evidence';
import { connectProjectTable, connectExistingProjectTable, publishRecommendedBoard, projectIdentity, consultationRows, dismissProjectNotifications } from './product-journey';
import type { Page, APIRequestContext } from '@playwright/test';

test('结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认', async ({ page, request }, info) => {
  const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  const source = (await (await request.get('/api/projects?projectId=' + projectId, { headers: projectIdentity })).json()).project;
  await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click();
  await expect(page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true })).toBeVisible(); await page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true }).click();
  await expect(page.getByText('客户资料、成员、来源链接与授权、私有记录、供应商、历史报告、实际目标和日期范围都不会复制。', { exact: false })).toBeVisible();
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('复用结构新项目'); await expect(page.getByRole('button', { name: '创建项目并开启向导', exact: true })).toBeDisabled();
  await info.attach('结构来源项目', { body: JSON.stringify({ projectId, actor: projectIdentity }), contentType: 'application/json' });
});
async function createFromStructure(page: Page, request: APIRequestContext, sourceId: string) {
  const source = (await (await request.get('/api/projects?projectId=' + sourceId, { headers: projectIdentity })).json()).project;
  await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('第二客户独立结构' + Date.now());
  await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click(); await page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true }).click();
  const acknowledge = page.getByRole('checkbox', { name: '我确认仅复用结构，并重新接入本项目来源及设置目标', exact: true }); await expect(acknowledge).toBeVisible(); await acknowledge.check();
  const created = page.waitForResponse(response => response.url().endsWith('/api/projects') && response.request().method() === 'POST'); await page.getByRole('button', { name: '创建项目并开启向导', exact: true }).click(); expect((await created).status()).toBe(200); const targetId = (await (await created).json()).id;
  await expect(page).toHaveURL(new RegExp('/projects/' + targetId + '$')); await expect(page.getByRole('heading', { name: /下一步：接入自己的业务表/ })).toBeVisible();
  const empty = await (await request.get('/api/datasets?projectId=' + targetId, { headers: projectIdentity })).json(); expect(empty.datasets).toHaveLength(0);
  const workspace = await (await request.get('/api/projects', { headers: projectIdentity })).json(); expect(workspace.sources.filter((source: { projectId: string }) => source.projectId === targetId)).toHaveLength(0);
  return targetId;
}
async function mapField(page: Page, sourceName: string, targetName: string) {
  const select = page.getByRole('combobox', { name: '来源1 ' + sourceName + '对应字段', exact: true }); await select.click(); await page.getByRole('option', { name: targetName, exact: true }).click();
}
for (const width of [1280, 390]) {
  test(`授权结构复用 ${width}px：新项目→自己的新表与不同字段→目标确认→试算→草稿→发布刷新→报告及只读`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const source = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
    const board = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); const reference = JSON.parse(board.cards.find((card: { title: string }) => card.title === '咨询人数合计').configJson).metricId;
    const sourceCards = board.cards.map((card: { id: string; title: string; type: string; configJson: string }) => ({ id: card.id, title: card.title, type: card.type, config: JSON.parse(card.configJson) }));
    const added = await request.post('/api/dashboards', { headers: projectIdentity, data: { projectId: source.projectId, version: board.dashboards[0].version, layout: { kind: 'project_board', version: 1, query: { from: '2026-10-01', to: '2026-10-02', filters: [{ key: '渠道', value: '门店' }] } }, cards: [...sourceCards, { title: '本项目咨询目标', type: 'progress_card', config: { metricId: reference, target: 600, targetMetricVersion: 1 } }] } }); expect(added.status()).toBe(200);
    const targetId = await createFromStructure(page, request, source.projectId);
    await connectExistingProjectTable(page, request, targetId, [['业务日期', '业务渠道', '问询量', '签约量'], ['2026-11-01', '线下', 400, 80], ['2026-11-02', '网站', 200, 10]]);
    await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '绑定本项目来源并确认复用看板', exact: true });
    for (const [from, to] of [['日期', '业务日期'], ['渠道', '业务渠道'], ['咨询人数', '问询量'], ['成交人数', '签约量']]) await mapField(page, from, to);
    await expect(dialog.getByText('本项目试算：600', { exact: true })).toBeVisible(); const target = dialog.getByRole('spinbutton', { name: '本项目咨询目标本项目目标', exact: true }); await expect(target).toHaveValue('');
    await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeDisabled(); await target.focus(); await target.pressSequentially('1200'); await expect(target).toBeFocused(); await expect(target).toHaveValue('1200');
    await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeEnabled(); await page.screenshot({ path: info.outputPath('own-fields-goal-and-real-preview.png'), fullPage: true });
    const applied = page.waitForResponse(response => response.url().endsWith('/api/project-structure') && response.request().method() === 'POST'); await dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); expect((await applied).status()).toBe(200);
    await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0); await page.reload(); await dismissProjectNotifications(page);
    const current = await (await request.get('/api/dashboards?projectId=' + targetId, { headers: projectIdentity })).json(); expect(current.cards).toHaveLength(sourceCards.length + 1); const configs = current.cards.map((card: { configJson: string }) => JSON.parse(card.configJson));
    expect(JSON.parse(current.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(1200); expect(configs.every((card: { metricId: string }) => card.metricId.startsWith(targetId + ':structure:'))).toBeTruthy(); expect(configs.every((card: { from?: string; to?: string }) => !card.from && !card.to)).toBeTruthy();
    expect(JSON.parse(current.dashboards[0].layoutJson).query).toEqual({});
    const amount = page.getByRole('article', { name: '咨询人数合计', exact: true }); await expect(amount).toContainText('600');
    await page.screenshot({ path: info.outputPath('new-project-published-own-results.png'), fullPage: true });
    const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId: targetId } }); expect(generated.status()).toBe(200);
    await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId: targetId, userId: 'user-viewer', role: 'viewer' } }); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + targetId + '/reports');
    await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('600'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('reused-project-viewer-report.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const original = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); expect(JSON.parse(original.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(600);
  });
  test(`复用百分口径 ${width}px：新来源1.5%与2.5%平均2.0%，发布刷新保持分数协议`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const source = await connectProjectTable(page, request, 'general_workbench', [['完成率', '金额'], ['0.5%', 10], ['1.5%', 20]]); await publishRecommendedBoard(page);
    const targetId = await createFromStructure(page, request, source.projectId); await connectExistingProjectTable(page, request, targetId, [['达标率', '金额'], ['1.5%', 40], ['2.5%', 20]]);
    await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); await mapField(page, '完成率', '达标率');
    await expect(page.getByRole('dialog').getByText('本项目试算：2.0%', { exact: true })).toBeVisible(); await page.screenshot({ path: info.outputPath('fractional-percentage-reuse-preview.png'), fullPage: true });
    await page.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0); await page.reload();
    await expect(page.getByRole('article', { name: '完成率平均值', exact: true })).toContainText('2.0%');
    const definitions = await (await request.get('/api/metric-definitions?projectId=' + targetId, { headers: projectIdentity })).json(); const metric = definitions.metrics.find((metric: { name: string }) => metric.name === '完成率平均值'); expect(metric.config).toMatchObject({ format: 'percent', percentScale: 'fraction', unit: '%' });
    const data = await (await request.get('/api/datasets?projectId=' + targetId + '&id=' + encodeURIComponent(metric.config.datasetId) + '&all=true', { headers: projectIdentity })).json(); const key = metric.config.field; expect(data.dataset.rows.map((row: Record<string, number>) => row[key])).toEqual([0.015, 0.025]);
    await page.screenshot({ path: info.outputPath('fractional-percentage-reuse-published.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`复用投放结构 ${width}px：自己的五列新表驱动专属页500/10000/100/1.0%，没有原来源或账户`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const source = await connectProjectTable(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '原媒体', 100, 1000, 20], ['2026-10-02', '原渠道', 200, 3000, 50]]); await publishRecommendedBoard(page);
    const targetId = await createFromStructure(page, request, source.projectId); await connectExistingProjectTable(page, request, targetId, [['业务日期', '媒体', '消耗', '展示次数', '点击次数'], ['2026-11-01', '新媒体甲', 400, 6000, 60], ['2026-11-02', '新媒体乙', 100, 4000, 40]]);
    await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); for (const [from, to] of [['日期', '业务日期'], ['渠道', '媒体'], ['花费', '消耗'], ['曝光', '展示次数'], ['点击', '点击次数']]) await mapField(page, from, to);
    await expect(page.getByRole('dialog').getByText('本项目试算：500', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0);
    await page.goto('/projects/' + targetId + '/ads'); const overview = page.getByTestId('ad-performance-overview'); await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('500'); await expect(overview).toContainText('10,000'); await expect(overview).toContainText('1.0%');
    const analytics = await (await request.get('/api/business-analytics?projectId=' + targetId, { headers: projectIdentity })).json(); expect(analytics.configured).toBeTruthy(); expect(analytics.metrics.spend.value).toBe(500); expect(analytics.metrics.impressions.value).toBe(10000); expect(analytics.metrics.clicks.value).toBe(100); expect(analytics.metrics.ctr.formattedValue).toBe('1.0%'); expect(analytics.dataset.projectId).toBe(targetId); expect(analytics.source.spreadsheet).not.toContain(source.token);
    await page.screenshot({ path: info.outputPath('own-ad-adapter-after-structure-reuse.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  for (const failure of ['500', 'network', '409'] as const) test(`结构保存恢复 ${width}px ${failure}：完整字段与目标保留，成功重试复用一个指标集合`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const source = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
    const original = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json();
    const shared = JSON.parse(original.cards.find((card: { title: string }) => card.title === '咨询人数合计').configJson).metricId;
    expect((await request.post('/api/dashboards', { headers: projectIdentity, data: { projectId: source.projectId, version: original.dashboards[0].version,
      cards: [...original.cards.map((card: { title: string; type: string; configJson: string }) => ({ title: card.title, type: card.type, config: JSON.parse(card.configJson) })), { title: '本项目咨询目标', type: 'progress_card', config: { metricId: shared, target: 600, targetMetricVersion: 1 } }] } })).status()).toBe(200);
    const targetId = await createFromStructure(page, request, source.projectId); const own = await connectExistingProjectTable(page, request, targetId, [['业务日期', '业务渠道', '问询量', '签约量'], ['2026-11-01', '门店', 400, 80], ['2026-11-02', '网站', 200, 10]]);
    await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); for (const [from, to] of [['日期', '业务日期'], ['渠道', '业务渠道'], ['咨询人数', '问询量'], ['成交人数', '签约量']]) await mapField(page, from, to);
    const dialog = page.getByRole('dialog'), submit = dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }), goal = dialog.getByRole('spinbutton', { name: '本项目咨询目标本项目目标', exact: true }); await goal.fill('1200'); await expect(submit).toBeEnabled();
    if (failure === '409') {
      const workspace = await (await request.get('/api/data-workspace?projectId=' + targetId, { headers: projectIdentity })).json();
      await request.post((process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217') + '/__fixture/focused-rows', { data: { documentToken: own.token, rows: [['业务日期', '业务渠道', '问询量', '签约量'], ['2026-11-01', '门店', 500, 100], ['2026-11-02', '网站', 200, 10]] } });
      expect((await request.post('/api/feishu/sync', { headers: projectIdentity, data: { projectId: targetId, sourceId: workspace.sources[0].id } })).status()).toBe(200);
    } else await page.route('**/api/project-structure', async route => { if (route.request().method() !== 'POST') return route.continue(); if (failure === 'network') await route.abort('failed'); else await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '隔离保存失败' }) }); });
    await submit.click(); await expect(dialog.getByRole('alert')).toBeInViewport(); await expect(dialog.getByRole('alert')).toBeFocused(); await expect(page).toHaveURL(new RegExp('/projects/' + targetId + '/data')); await expect(dialog.getByRole('combobox', { name: '来源1 咨询人数对应字段', exact: true })).toContainText('问询量'); await expect(goal).toHaveValue('1200');
    expect((await (await request.get('/api/metric-definitions?projectId=' + targetId, { headers: projectIdentity })).json()).metrics).toHaveLength(0); await page.screenshot({ path: info.outputPath('structure-' + failure + '-choices-preserved.png'), fullPage: true });
    if (failure === '409') { await dialog.getByRole('button', { name: '重新读取来源字段', exact: true }).click(); await expect(dialog.getByText('本项目试算：700', { exact: true }).first()).toBeVisible(); await expect(goal).toHaveValue('1200'); } else await page.unroute('**/api/project-structure');
    await expect(submit).toBeEnabled(); await submit.click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toBeVisible();
    const definitions = await (await request.get('/api/metric-definitions?projectId=' + targetId, { headers: projectIdentity })).json(); expect(definitions.metrics).toHaveLength(4); expect(definitions.metrics.every((metric: { version: number }) => metric.version === 1)).toBeTruthy();
  });
  test(`结构试算失败 ${width}px：新请求503清除旧成功预览，保留控件且禁止确认，重新读取恢复`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 }); const source = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
    const targetId = await createFromStructure(page, request, source.projectId); await connectExistingProjectTable(page, request, targetId, consultationRows); await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog.getByText('本项目试算：300', { exact: true })).toBeVisible();
    await page.route('**/api/project-structure?*', async route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '隔离试算失败' }) })); await dialog.getByRole('checkbox', { name: '复用成交人数合计', exact: true }).uncheck();
    await expect(dialog.getByRole('alert')).toContainText('隔离试算失败'); await expect(dialog.getByRole('alert')).toBeInViewport(); await expect(dialog.getByText('本项目试算：300', { exact: true })).toHaveCount(0); await expect(dialog.getByRole('combobox', { name: '来源1 咨询人数对应字段', exact: true })).toContainText('咨询人数'); await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeDisabled();
    await page.unroute('**/api/project-structure?*'); await dialog.getByRole('button', { name: '重新读取结构', exact: true }).click(); await expect(dialog.getByText('本项目试算：300', { exact: true })).toBeVisible(); await expect(dialog.getByRole('checkbox', { name: '复用成交人数合计', exact: true })).not.toBeChecked();
  });
}
