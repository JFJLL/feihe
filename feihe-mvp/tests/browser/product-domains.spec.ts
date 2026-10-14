import { test, expect } from './evidence';
import { connectProjectTable, connectExistingProjectTable, publishRecommendedBoard, projectIdentity, dismissProjectNotifications } from './product-journey';
import type { Page } from '@playwright/test';

test('内容断链反例：页面接入自己的内容表后，内容页显示真实3000阅读和两条业务记录', async ({ page, request }) => {
  const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['发布日期', '内容编号', '标题', '阅读量', '互动量', '内容费用'], ['2026-11-01', 'article-a', '业务教程', 1000, 10, 50], ['2026-11-02', 'article-b', '案例分享', 2000, 20, 100]]);
  await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/content');
  const business = page.getByTestId('content-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(business.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('业务教程');
});

const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
const commentsRows = [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']];
async function choose(page: Page, name: string, value: string) {
  await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: value, exact: true }).click();
}
async function publishDraft(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await response).status()).toBe(200); await dismissProjectNotifications(page);
}
async function fit(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); }
for (const width of [1280, 390]) {
  test(`内容领域 ${width}px：不同字段经真实选择器确认、发布、刷新和报告均使用本项目3000阅读`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['业务日', '条目编号', '事项标题', '发布渠道', '阅读人次', '互动人次', '稿件支出'], ['2026-11-01', 'own-a', '独立部门教程', '站内', 1000, 10, 50], ['2026-11-02', 'own-b', '独立部门案例', '站外', 2000, 20, 100]]);
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('内容编号或内容链接');
    await choose(page, '内容编号对应字段', '条目编号');
    await page.getByText('确认字段对应', { exact: true }).click();
    for (const [name, value] of [['标题对应字段', '事项标题'], ['渠道对应字段', '发布渠道'], ['阅读量对应字段', '阅读人次'], ['互动量对应字段', '互动人次'], ['内容费用对应字段', '稿件支出']]) await choose(page, name, value);
    await expect(page.getByRole('dialog')).toContainText('阅读总量：3,000');
    await page.getByRole('combobox', { name: '阅读量对应字段', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('content-field-selector-open.png'), fullPage: false }); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).focus(); await page.keyboard.press('Enter'); await publishDraft(page);
    await page.goto('/projects/' + projectId + '/content'); const domain = page.getByTestId('content-domain-overview');
    await expect(domain.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(domain.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('独立部门教程');
    await expect(domain.getByRole('table', { name: '内容渠道对比', exact: true })).toContainText('站外'); await expect(domain.getByRole('link', { name: '在飞书原表处理记录 ↗', exact: true })).toHaveAttribute('href', /fixture\.feishu\.cn/);
    await page.reload(); await expect(domain.locator('.ops-metric-card').filter({ hasText: '内容费用' })).toContainText('150'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '内容费用' })).not.toContainText('¥'); await fit(page);
    await page.screenshot({ path: info.outputPath('content-published-own-records.png'), fullPage: true });
    await page.goto('/projects/' + projectId + '/reports'); const generated = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); const report = await (await generated).json();
    await expect(page.getByRole('article', { name: '阅读总量报告结果', exact: true })).toContainText('3,000');
    const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json();
    expect(report.spec.metrics.find((metric: { title: string }) => metric.title === '阅读总量').metricId).toBe(actual.metrics.reads.definition.id);
    expect(actual.records.total).toBe(2); expect(actual.records.items[0].recordId).toBe('own-a'); expect(actual.metrics.reads.definition.version).toBe(1); await fit(page);
  });
  test(`评论领域 ${width}px：来源标注与状态分组、空标注覆盖和同指标报告真实可见`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'comment_qc', commentsRows); await publishRecommendedBoard(page);
    await page.goto('/projects/' + projectId + '/comments'); const domain = page.getByTestId('comment-domain-overview');
    await expect(domain.locator('.ops-metric-card').filter({ hasText: '有情感标注的评论' })).toContainText('2'); await expect(domain.getByRole('table', { name: '来源处置状态', exact: true })).toContainText('待处理');
    await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('未标注的记录'); await expect(domain).toContainText('不代表平台自动识别或已执行处理');
    await domain.getByLabel('项目开始日期', { exact: true }).fill('2026-11-01'); await domain.getByLabel('项目结束日期', { exact: true }).fill('2026-11-01'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('2');
    await choose(page, '共同筛选字段', '处置状态'); await choose(page, '共同筛选值', '待处理'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).not.toContainText('体验很好');
    await page.screenshot({ path: info.outputPath('comments-source-labeled-and-filtered.png'), fullPage: true }); await domain.getByRole('button', { name: '清除周期与筛选', exact: true }).click();
    await page.goto('/projects/' + projectId + '/reports'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('article', { name: '评论记录数报告结果', exact: true })).toContainText('3');
    const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); expect(new Set(board.cards.map((card: { id: string }) => card.id)).size).toBe(board.cards.length);
    expect(board.cards.filter((card: { type: string }) => card.type === 'breakdown').length).toBe(2);
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/comments'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await fit(page);
    await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('article', { name: '评论记录数报告结果', exact: true })).toContainText('3'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('comments-viewer-same-report.png'), fullPage: true });
  });
  test(`评论最小表 ${width}px：缺字段显示未配置，初始目标不继承，明确保存40/10后刷新仍正确`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['评论内容'], ['只有评论正文']]); await publishRecommendedBoard(page);
    await page.goto('/projects/' + projectId + '/comments'); const domain = page.getByTestId('comment-domain-overview'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '有情感标注的评论' })).toContainText('未配置'); await expect(domain).toContainText('不是跨批次主键'); await expect(domain).toContainText('未对应日期字段');
    await page.screenshot({ path: info.outputPath('comment-optional-capabilities-unconfigured.png'), fullPage: true });
    const initial = await (await request.get('/api/ops?projectId=' + projectId + '&fresh=1', { headers: projectIdentity })).json(); expect(initial.settings.acceptance).toMatchObject({ reportCount: 0, baseCount: 0, targetsConfirmed: false });
    await page.goto('/projects/' + projectId + '/settings?tab=rules'); await expect(page.getByText(/评论验收目标未设置/)).toBeVisible();
    await page.getByLabel('可汇报最低评论数', { exact: true }).fill('40'); await page.getByLabel('基础达标评论数', { exact: true }).fill('10');
    const saved = page.waitForResponse(r => r.url().endsWith('/api/settings') && r.request().method() === 'POST'); await page.getByRole('button', { name: '保存当前项目全部规则与目标', exact: true }).click(); expect((await saved).status()).toBe(200);
    await page.reload(); await expect(page.getByLabel('可汇报最低评论数', { exact: true })).toHaveValue('40'); await expect(page.getByLabel('基础达标评论数', { exact: true })).toHaveValue('10');
    const actual = await (await request.get('/api/ops?projectId=' + projectId + '&fresh=1', { headers: projectIdentity })).json(); expect(actual.settings.acceptance).toMatchObject({ reportCount: 40, baseCount: 10, targetsConfirmed: true }); await fit(page);
    await page.getByLabel('可汇报最低评论数', { exact: true }).focus(); await page.screenshot({ path: info.outputPath('own-comment-targets-confirmed.png'), fullPage: true });
  });
  test(`业务校验 ${width}px：样本之外重复编号阻止确认，错误获焦，改对应字段后使用同一个来源与数据集`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const rows = [['内容编号', '唯一编号', '阅读量'], ...Array.from({ length: 31 }, (_, index) => [index === 30 ? 'duplicate0' : 'duplicate' + index, 'unique' + index, index])];
    const { projectId } = await connectProjectTable(page, request, 'content_marketing', rows); const dataset = (await (await request.get('/api/datasets?projectId=' + projectId, { headers: projectIdentity })).json()).datasets[0];
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); const rejected = page.waitForResponse(r => r.url().endsWith('/api/metric-recommendations') && r.request().method() === 'POST'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); expect((await rejected).status()).toBe(400);
    const alert = page.getByRole('dialog').getByRole('alert'); await expect(alert).toContainText('第31条'); await expect(alert).toContainText('重复'); await expect(alert).toBeFocused(); await expect(alert).toBeInViewport(); await expect(page.getByRole('dialog').getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeInViewport(); await page.screenshot({ path: info.outputPath('complete-batch-identity-validation-error.png'), fullPage: false });
    await page.getByText('确认字段对应', { exact: true }).click(); await choose(page, '内容编号对应字段', '唯一编号'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page);
    await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').getByRole('table', { name: '项目内容记录', exact: true })).toContainText('unique0');
    const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(); expect(actual.dataset.id).toBe(dataset.id); expect(actual.records.total).toBe(31); expect(actual.roles.contentId).toBe('唯一编号');
    const workspace = await (await request.get('/api/projects', { headers: projectIdentity })).json(); expect(workspace.sources.filter((source: { projectId: string }) => source.projectId === projectId).map((source: { id: string }) => source.id)).toEqual([dataset.sourceId]); await fit(page);
  });
  test(`更新与分页 ${width}px：31条评论第3页，同来源真实同步1条后刷新校正到第1页`, async ({ page, request, context }, info) => {
    await page.setViewportSize({ width, height: 900 }); const rows = [['评论编号', '评论内容', '处置状态'], ...Array.from({ length: 31 }, (_, index) => ['c' + index, '评论' + index, '待处理'])];
    const { projectId, token } = await connectProjectTable(page, request, 'comment_qc', rows); await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
    const domain = page.getByTestId('comment-domain-overview'); await domain.getByRole('button', { name: '下一页记录', exact: true }).click(); await expect(domain).toContainText('第 2 / 3 页'); await domain.getByRole('button', { name: '下一页记录', exact: true }).click(); await expect(domain).toContainText('第 3 / 3 页'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('c30');
    expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['评论编号', '评论内容', '处置状态'], ['c0', '更新后评论', '已处理']] } })).status()).toBe(200);
    const sourcePage = await context.newPage(); await sourcePage.goto('/projects/' + projectId + '/data'); const synced = sourcePage.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST'); await sourcePage.getByRole('button', { name: '立即同步', exact: true }).click(); expect((await synced).status()).toBe(200); await sourcePage.close();
    await page.bringToFront(); await domain.getByRole('button', { name: '刷新业务分析', exact: true }).click(); await expect(domain).toContainText('第 1 / 1 页'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('更新后评论'); await expect(domain.getByRole('table', { name: '来源处置状态', exact: true })).toContainText('已处理'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('1');
    await page.screenshot({ path: info.outputPath('comment-source-update-and-page-clamped.png'), fullPage: true }); const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=comment', { headers: projectIdentity })).json(); expect(actual.dataset.version).toBe(2); expect(actual.records.total).toBe(1); expect(actual.metrics.records.definition.version).toBe(1); await fit(page);
  });
  test(`内容与评论分表 ${width}px：一个项目两个真实文档，用途选择、两专属页和团队卡片分别引用自己的来源`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['内容编号', '标题', '阅读量'], ['a1', '自己的内容甲', 1000], ['a2', '自己的内容乙', 2000]]); await publishRecommendedBoard(page);
    await connectExistingProjectTable(page, request, projectId, commentsRows, 'Domain-comments-' + projectId); await page.goto('/projects/' + projectId + '/data?tab=datasets&purpose=comment'); await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('combobox', { name: '这张表用于', exact: true })).toContainText('评论分析'); await expect(page.getByRole('dialog')).toContainText('评论记录数：3'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page);
    await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await page.goto('/projects/' + projectId + '/comments'); await expect(page.getByTestId('comment-domain-overview').getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
    const content = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(), comment = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=comment', { headers: projectIdentity })).json(); expect(content.dataset.id).not.toBe(comment.dataset.id); expect(content.dataset.sourceId).not.toBe(comment.dataset.sourceId); expect(content.metrics.records.definition.id).not.toBe(comment.metrics.records.definition.id);
    const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); const references = board.cards.map((card: { configJson: string }) => JSON.parse(card.configJson).metricId); expect(references).toContain(content.metrics.reads.definition.id); expect(references).toContain(comment.metrics.records.definition.id); await fit(page);
  });
  test(`字段异步 ${width}px：迟到真实试算不覆盖新选择，失败清旧预览并保留字段，重试后发布40`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['内容编号', '阅读量', '备用阅读'], ['a', 10, 100], ['b', 30, 200]]);
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('阅读总量：40'); await page.getByText('确认字段对应', { exact: true }).click();
    let release = () => {}, heldReady = false, delivered = false;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/metric-recommendations?*', async route => {
      const roles = new URL(route.request().url()).searchParams.get('roles');
      if (!heldReady && roles && JSON.parse(roles).reads === '备用阅读') {
        const actualResponse = await route.fetch(); expect(actualResponse.status()).toBe(200); heldReady = true; await held;
        try { await route.fulfill({ response: actualResponse }); } catch { /* the application may cancel the obsolete request */ } finally { delivered = true; }
      } else await route.continue();
    });
    await choose(page, '阅读量对应字段', '备用阅读'); await expect.poll(() => heldReady).toBe(true); await expect(page.getByRole('dialog')).not.toContainText('阅读总量：40'); await expect(page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeDisabled();
    await choose(page, '阅读量对应字段', '阅读量'); await expect(page.getByRole('dialog')).toContainText('阅读总量：40'); release(); await expect.poll(() => delivered).toBe(true); await expect(page.getByRole('dialog')).not.toContainText('阅读总量：300');
    await page.unroute('**/api/metric-recommendations?*'); let failed = false;
    await page.route('**/api/metric-recommendations?*', async route => { if (!failed) { failed = true; await route.abort('failed'); } else await route.continue(); });
    await choose(page, '阅读量对应字段', '备用阅读'); await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible(); await expect(page.getByRole('combobox', { name: '阅读量对应字段', exact: true })).toContainText('备用阅读'); await expect(page.getByRole('dialog')).not.toContainText('阅读总量：40'); await expect(page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('preview-failure-fields-preserved.png'), fullPage: false }); await page.getByRole('button', { name: '重试字段试算', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('阅读总量：300');
    await choose(page, '阅读量对应字段', '阅读量'); await expect(page.getByRole('dialog')).toContainText('阅读总量：40'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page);
    await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('40'); await fit(page);
  });
  test(`推荐版本冲突 ${width}px：弹窗打开期间同来源同步，真实409清旧预览，字段保留并重新试算发布90`, async ({ page, request, context }, info) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId, token } = await connectProjectTable(page, request, 'content_marketing', [['内容编号', '阅读量'], ['a', 10], ['b', 30]]);
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('阅读总量：40');
    expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['内容编号', '阅读量'], ['a', 10], ['b', 30], ['c', 50]] } })).status()).toBe(200);
    const sourcePage = await context.newPage(); await sourcePage.goto('/projects/' + projectId + '/data'); const synced = sourcePage.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST'); await sourcePage.getByRole('button', { name: '立即同步', exact: true }).click(); expect((await synced).status()).toBe(200); await sourcePage.close(); await page.bringToFront();
    const rejected = page.waitForResponse(r => r.url().endsWith('/api/metric-recommendations') && r.request().method() === 'POST'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); expect((await rejected).status()).toBe(409);
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('数据已更新'); await expect(page.getByRole('dialog')).not.toContainText('阅读总量：40'); await expect(page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeDisabled();
    await page.getByText('确认字段对应', { exact: true }).click(); await expect(page.getByRole('combobox', { name: '内容编号对应字段', exact: true })).toContainText('内容编号'); await expect(page.getByRole('combobox', { name: '阅读量对应字段', exact: true })).toContainText('阅读量');
    await page.screenshot({ path: info.outputPath('real-dataset-409-fields-preserved.png'), fullPage: false }); await page.getByRole('button', { name: '重试字段试算', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('阅读总量：90');
    await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page); await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('90');
    const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(); expect(actual.dataset.version).toBe(2); expect(actual.metrics.reads.value).toBe(90); expect(actual.metrics.records.value).toBe(3); await fit(page);
  });
  test(`推荐选择 ${width}px：业务页所需指标未选全时不能确认，可明确只发布所选记录指标再补齐业务页`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['内容编号', '阅读量'], ['a', 1000], ['b', 2000]]);
    await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await page.getByRole('checkbox', { name: '推荐阅读总量', exact: true }).uncheck(); await expect(page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeDisabled(); await expect(page.getByRole('dialog')).toContainText('请勾选业务页所需的全部指标');
    await page.getByRole('checkbox', { name: '同时用于专属业务分析', exact: true }).uncheck(); await expect(page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true })).toBeEnabled(); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page); await expect(page.getByRole('article', { name: '内容记录数', exact: true })).toContainText('2');
    let business = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(); expect(business.configured).toBe(false);
    await page.goto('/projects/' + projectId + '/data?tab=datasets'); await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); business = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(); expect(business.metrics.records.definition.version).toBe(1); await fit(page);
  });
}
test('评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态', async ({ page, request }) => {
  const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']]);
  await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
  const business = page.getByTestId('comment-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await expect(business.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
});
