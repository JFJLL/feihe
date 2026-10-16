import { test, expect } from './evidence';
import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows, dismissProjectNotifications } from './product-journey';
import { readFile } from 'node:fs/promises';

test('报告断链反例：四列原表看板发布后，经页面进入同口径项目报告', async ({ page, request }, info) => {
  await connectProjectTable(page, request, 'general_workbench', consultationRows);
  await publishRecommendedBoard(page);
  await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('300');
  await page.screenshot({ path: info.outputPath('published-board-without-report-path.png'), fullPage: true });
  await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
  await expect(page.getByRole('heading', { name: '项目报告', exact: true })).toBeVisible();
});
for (const width of [1280, 1440, 768, 390]) {
  test(`同口径报告 ${width}px：原表→看板周期→键盘生成→导出→定义变更→新旧快照→只读交接`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'general_workbench', [...consultationRows, ['2026-09-29', '门店', 50, 10], ['2026-09-30', '线上', 50, 10]]);
    await publishRecommendedBoard(page);
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-02');
    const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await published).status()).toBe(200);
    await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
    await expect(page.getByRole('link', { name: '报告', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('项目开始日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-02');
    const generated = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '生成并保存报告', exact: true }).focus(); await page.keyboard.press('Enter');
    const firstResponse = await generated; expect(firstResponse.status()).toBe(200); const first = await firstResponse.json();
    const consultation = page.getByRole('article', { name: '咨询人数合计报告结果', exact: true });
    await expect(consultation).toContainText('300'); await expect(consultation).toContainText('较上期 +200'); await expect(page.getByRole('article', { name: '成交率报告结果', exact: true })).toContainText('10.0%'); await expect(page.getByRole('article', { name: '成交率报告结果', exact: true })).toContainText('较上期 −10.0 个百分点');
    await page.getByText('成交率趋势每日趋势', { exact: true }).click();
    await expect(page.getByRole('table', { name: '成交率趋势每日趋势', exact: true })).toContainText('20.0%'); await expect(page.getByRole('table', { name: '成交率趋势每日趋势', exact: true })).toContainText('5.0%');
    await page.getByText('成交率按渠道分组对比', { exact: true }).click(); await expect(page.getByRole('table', { name: '成交率按渠道分组对比', exact: true })).toContainText('门店');
    await expect(page.getByTestId('project-reports')).not.toContainText('母婴'); await expect(page.getByTestId('project-reports')).not.toContainText('启萃');
    await dismissProjectNotifications(page); await page.screenshot({ path: info.outputPath('same-metric-report-v1.png'), fullPage: true });
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const download = await downloadPromise;
    await download.saveAs(info.outputPath('report-v1.html')); const html = await readFile(info.outputPath('report-v1.html'), 'utf8'); expect(html).toContain('<b>300</b>'); expect(html).toContain('<b>10.0%</b>'); expect(html).not.toContain('母婴');
    expect(first.spec.queryConfig).toEqual({ from: '2026-10-01', to: '2026-10-02' }); expect(first.spec.metrics.filter((m: { metricId: string }) => m.metricId).length).toBe(6);
    await page.goto('/projects/' + projectId + '/metrics');
    await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '咨询人数合计', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
    await page.getByRole('combobox', { name: '指标计算方式', exact: true }).click(); await page.getByRole('option', { name: '数值平均 (Average)', exact: true }).click(); await page.getByRole('button', { name: '保存指标', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/projects/' + projectId); await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('150');
    await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await expect(consultation).toContainText('300'); await expect(consultation).toContainText('指标 v1');
    await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(consultation).toContainText('150'); await expect(consultation).toContainText('指标 v2'); await expect(page.getByRole('heading', { name: '报告历史 · 2 份', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '查看报告 ' + first.reportId, exact: true }).click(); await expect(consultation).toContainText('300'); await page.reload(); await expect(consultation).toContainText('300');
    const stored = await (await request.get('/api/reports?projectId=' + projectId + '&id=' + first.reportId, { headers: projectIdentity })).json(); expect(stored.report.spec).toEqual(first.spec);
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/reports'); await expect(consultation).toContainText('150'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
    const readerDownloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const readerDownload = await readerDownloadPromise; await readerDownload.saveAs(info.outputPath('viewer-report-v2.html')); expect(await readFile(info.outputPath('viewer-report-v2.html'), 'utf8')).toContain('<b>150</b>');
    await page.screenshot({ path: info.outputPath('report-viewer-current-version.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
for (const width of [1280, 390]) {
  test(`报告百分与投放 ${width}px：普通字段平均1.0%，真实比率每日0.5%和150%，导出单位一致`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const percent = await connectProjectTable(page, request, 'general_workbench', [['日期', '渠道', '完成率'], ['2026-10-01', '甲组', '0.5%'], ['2026-10-02', '乙组', '1.5%']]); await publishRecommendedBoard(page);
    await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
    const save = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); const saved = await save; expect(saved.status()).toBe(200); const spec = (await saved.json()).spec;
    await expect(page.getByRole('article', { name: '完成率平均值报告结果', exact: true })).toContainText('1.0%'); const metric = spec.metrics.find((m: { title: string }) => m.title === '完成率平均值'); expect(metric.result.value).toBe(0.01); expect(metric.config.percentScale).toBe('fraction');
    await page.getByText('完成率平均值趋势每日趋势', { exact: true }).click(); await expect(page.getByRole('table', { name: '完成率平均值趋势每日趋势', exact: true })).toContainText('0.5%'); await page.screenshot({ path: info.outputPath('fraction-percent-report.png'), fullPage: true });
    const actual = await (await request.get('/api/datasets?projectId=' + percent.projectId, { headers: projectIdentity })).json(); const storedResponse = await request.get('/api/datasets?projectId=' + percent.projectId + '&id=' + actual.datasets[0].id + '&all=true', { headers: projectIdentity }); expect(storedResponse.status()).toBe(200); const rows = await storedResponse.json(); expect(rows.dataset.rows.map((r: { 完成率: number }) => r.完成率)).toEqual([0.005, 0.015]);
    const ad = await connectProjectTable(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '独立甲', 100, 200, 1], ['2026-10-02', '独立乙', 200, 100, 150]]); await publishRecommendedBoard(page);
    await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('article', { name: '广告消耗报告结果', exact: true })).toContainText('300');
    await page.getByText('点击率趋势每日趋势', { exact: true }).click(); const table = page.getByRole('table', { name: '点击率趋势每日趋势', exact: true }); await expect(table).toContainText('0.5%'); await expect(table).toContainText('150.0%');
    await page.screenshot({ path: info.outputPath('own-ad-rate-report.png'), fullPage: true }); const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const download = await downloadPromise; await download.saveAs(info.outputPath('ad-report.html')); const html = await readFile(info.outputPath('ad-report.html'), 'utf8'); expect(html).toContain('0.5%'); expect(html).toContain('150.0%'); expect(html).not.toContain(percent.projectId);
    const report = await (await request.get('/api/reports?projectId=' + ad.projectId, { headers: projectIdentity })).json(); expect(report.report.spec.projectId).toBe(ad.projectId); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`报告失败恢复 ${width}px：互补缺失显示成对0，500和断网保留范围与历史，真实重试冻结快照`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '甲', null, 10], ['2026-10-02', '乙', 100, null]]); await publishRecommendedBoard(page);
    await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click();
    const metric = page.getByRole('article', { name: '成交率报告结果', exact: true }); await expect(metric).toContainText('成对有效 0 行'); await expect(metric).toContainText('成对样本不足'); await expect(metric.locator('.report-metric-value')).toHaveText('—');
    await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
    for (const failure of ['500', 'network']) {
      await page.route('**/api/reports', route => route.request().method() === 'POST' ? failure === '500' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '注入报告保存失败' }) }) : route.abort('failed') : route.continue());
      await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('当前范围和历史报告仍保留'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toBeEnabled(); await expect(page.getByLabel('项目开始日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByRole('heading', { name: '报告历史 · 1 份', exact: true })).toBeVisible(); await dismissProjectNotifications(page); await page.getByRole('region', { name: '报告生成范围', exact: true }).screenshot({ path: info.outputPath('report-' + failure + '-range-retained.png') }); await page.unroute('**/api/reports');
      expect((await (await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity })).json()).total).toBe(1);
    }
    let release: () => void = () => {}, submits = 0; const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/reports', async route => { if (route.request().method() === 'POST') { submits++; await held; } await route.continue(); });
    await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('button', { name: '正在生成指标快照…', exact: true })).toBeDisabled(); await expect(page.getByLabel('项目开始日期', { exact: true })).toBeDisabled(); release();
    await expect(page.getByRole('heading', { name: '报告历史 · 2 份', exact: true })).toBeVisible(); expect(submits).toBe(1); await page.unroute('**/api/reports'); await page.reload(); await expect(metric).toContainText('成对有效 0 行'); await expect(page.getByLabel('项目开始日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-01');
    await page.screenshot({ path: info.outputPath('missing-paired-report-samples.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
test('报告取数反例：已有生成接口消费真实共享咨询指标，而非空社媒记录', async ({ page, request }, info) => {
  const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  await publishRecommendedBoard(page);
  const generated = await request.post('/api/agent', { headers: projectIdentity, data: { projectId, prompt: '查看咨询人数和成交率' } });
  expect(generated.status()).toBe(200); const report = await generated.json();
  await info.attach('报告真实响应', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  expect(report.spec.kpis.find((k: { label: string }) => k.label === '咨询人数合计')?.value).toBe('300');
  expect(report.spec.metrics.some((m: { metricId: string; title: string }) => m.metricId && m.title === '成交率')).toBeTruthy();
});
