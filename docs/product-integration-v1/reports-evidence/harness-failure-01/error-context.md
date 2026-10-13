# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-reports.spec.ts >> 报告百分与投放 1280px：普通字段平均1.0%，真实比率每日0.5%和150%，导出单位一致
- Location: tests\browser\product-reports.spec.ts:53:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'map')
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary "项目主要导航" [ref=e3]:
    - link "返回项目中心" [ref=e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=e5]: 项目工作台
    - generic [ref=e11]:
      - generic [ref=e12]: 当前项目
      - combobox "切换项目" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 独立部门报告1791921528169
      - paragraph [ref=e20]: 品牌未设置 · 独立部门报告1791921528169 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791921528169
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791921528169/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791921528169/metrics
        - generic [ref=e29]: "03"
      - link "报告" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791921528169/reports
        - generic [ref=e32]: "05"
      - link "项目设置" [ref=e34] [cursor=pointer]:
        - /url: /projects/1791921528169/settings
        - generic [ref=e35]: "05"
    - generic [ref=e37]:
      - text: 项目资料已连接
      - generic [ref=e39]: 业务编辑者(张晓) · 2026/10/14 03:58:48
  - main [ref=e40]:
    - generic [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]:
          - heading "项目报告" [level=1] [ref=e45]
          - paragraph [ref=e46]: 独立部门报告1791921528169 · 使用已发布看板的同一指标，历史快照保留原口径
        - link "返回项目看板" [ref=e48] [cursor=pointer]:
          - /url: /projects/1791921528169
      - region "报告生成范围" [ref=e49]:
        - heading "生成当前范围的报告" [level=2] [ref=e50]
        - region "项目周期与共同筛选" [ref=e51]:
          - generic [ref=e52]:
            - generic [ref=e53]:
              - text: 开始日期
              - textbox "项目开始日期" [ref=e54]
            - generic [ref=e55]:
              - text: 结束日期
              - textbox "项目结束日期" [ref=e56]
            - generic [ref=e57]:
              - text: 共同筛选字段
              - combobox "共同筛选字段" [ref=e59] [cursor=pointer]:
                - generic [ref=e60]: 不筛选
            - button "清除周期与筛选" [ref=e63] [cursor=pointer]
          - paragraph [ref=e64]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
        - paragraph [ref=e65]: 默认继承看板周期；独立周期卡片仍使用自己的范围。生成时固定指标和数据版本，之后的编辑不会改变历史报告。当前未启用AI增强；无需模型凭证即可查看、保存和导出真实结果。
        - button "生成并保存报告" [ref=e66] [cursor=pointer]
      - region "报告历史" [ref=e67]:
        - heading "报告历史 · 1 份" [level=2] [ref=e68]
        - table "项目报告历史" [ref=e70]:
          - rowgroup [ref=e71]:
            - row [ref=e72]:
              - columnheader "生成时间" [ref=e73]
              - columnheader "周期" [ref=e74]
              - columnheader "操作" [ref=e75]
          - rowgroup [ref=e76]:
            - row [ref=e77]:
              - cell "2026/10/14 03:58:49" [ref=e78]
              - cell "不限开始 至 不限结束" [ref=e79]
              - cell [ref=e80]:
                - button "查看报告 0f115e93-5697-480f-a4b7-ab41e2c5c6ff" [ref=e81] [cursor=pointer]: 查看快照
        - generic [ref=e82]:
          - paragraph [ref=e83]: 第 1 / 1 页
          - generic [ref=e84]:
            - button "报告历史上一页" [disabled] [ref=e85] [cursor=pointer]
            - button "报告历史下一页" [disabled] [ref=e86] [cursor=pointer]
      - region "已保存的报告快照" [ref=e87]:
        - generic [ref=e88]:
          - heading "独立部门报告1791921528169 · 项目报告" [level=2] [ref=e89]
          - paragraph [ref=e90]: 报告周期：不限开始 至 不限结束 · 生成于 2026/10/14 03:58:49
          - paragraph [ref=e91]: 此处是已保存快照，日期输入调整后需生成新报告。
          - link "导出当前报告 HTML" [ref=e92] [cursor=pointer]:
            - /url: /api/report-html?projectId=1791921528169&id=0f115e93-5697-480f-a4b7-ab41e2c5c6ff&download=1
        - region "报告关键指标" [ref=e93]:
          - article "记录数量报告结果" [ref=e94]:
            - heading "记录数量" [level=3] [ref=e95]
            - strong [ref=e96]: "2"
            - paragraph [ref=e97]: 指标 v1 · 数据 v1
            - paragraph [ref=e98]: 有效样本 2 行
            - paragraph [ref=e99]: 选择完整起止日期后可比较上期
          - article "完成率平均值报告结果" [ref=e100]:
            - heading "完成率平均值" [level=3] [ref=e101]
            - strong [ref=e102]: 1.0%
            - paragraph [ref=e103]: 指标 v1 · 数据 v1
            - paragraph [ref=e104]: 有效样本 2 行
            - paragraph [ref=e105]: 选择完整起止日期后可比较上期
        - generic [ref=e106]:
          - heading "完成率平均值趋势" [level=3] [ref=e107]
          - generic [ref=e108]:
            - generic [ref=e109]:
              - strong [ref=e110]: 2026-10-02
              - generic [ref=e111]:
                - text: 完成率平均值趋势
                - generic [ref=e113]: 1.5%
            - img "完成率平均值趋势" [ref=e114]:
              - generic [ref=e115]: 0.0%
              - generic [ref=e117]: 0.4%
              - generic [ref=e119]: 0.8%
              - generic [ref=e121]: 1.1%
              - generic [ref=e123]: 1.5%
              - generic [ref=e126]:
                - generic "2026-10-01 完成率平均值趋势 0.5%" [ref=e128]
                - generic "2026-10-02 完成率平均值趋势 1.5%" [ref=e129]
              - 'button "2026-10-01 完成率平均值趋势: 0.5%" [ref=e130]'
              - 'button "2026-10-02 完成率平均值趋势: 1.5%" [ref=e131]'
              - generic [ref=e132]: 10-01
              - generic [ref=e133]: 10-02
        - group [ref=e134]:
          - generic "需要关注的状态" [ref=e135]
          - list [ref=e136]:
            - listitem [ref=e137]: 仅使用本项目已发布的看板指标；报告保留生成时的口径与数据版本，不随之后修改重算。
            - listitem [ref=e138]: 当前指标均可核对；这里不自动推断业务原因。
        - group [ref=e139]:
          - generic "记录数量每日趋势" [ref=e140]
        - group [ref=e141]:
          - generic "完成率平均值每日趋势" [ref=e142]
        - group [ref=e143]:
          - generic "完成率平均值趋势每日趋势" [active] [ref=e144]
          - table "完成率平均值趋势每日趋势" [ref=e146]:
            - rowgroup [ref=e147]:
              - row [ref=e148]:
                - columnheader "日期" [ref=e149]
                - columnheader "结果" [ref=e150]
                - columnheader "样本" [ref=e151]
                - columnheader "状态" [ref=e152]
            - rowgroup [ref=e153]:
              - row [ref=e154]:
                - cell "2026-10-01" [ref=e155]
                - cell "0.5%" [ref=e156]
                - cell "有效样本 1 行" [ref=e157]
                - cell "计算完成" [ref=e158]
              - row [ref=e159]:
                - cell "2026-10-02" [ref=e160]
                - cell "1.5%" [ref=e161]
                - cell "有效样本 1 行" [ref=e162]
                - cell "计算完成" [ref=e163]
        - group [ref=e164]:
          - generic "完成率平均值按渠道每日趋势" [ref=e165]
        - group [ref=e166]:
          - generic "完成率平均值按渠道分组对比" [ref=e167]
        - group [ref=e168]:
          - generic "来源与数据更新时间" [ref=e169]
          - table "来源与数据更新时间" [ref=e171]:
            - rowgroup [ref=e172]:
              - row [ref=e173]:
                - columnheader "来源" [ref=e174]
                - columnheader "数据版本" [ref=e175]
                - columnheader "原表记录" [ref=e176]
                - columnheader "数据更新时间" [ref=e177]
                - columnheader "同步状态" [ref=e178]
            - rowgroup [ref=e179]:
              - row [ref=e180]:
                - cell "补修数据" [ref=e181]
                - cell "1" [ref=e182]
                - cell "2" [ref=e183]
                - cell "2026-10-13T19:58:48.962Z" [ref=e184]
                - cell "最近成功：2026-10-13T19:58:48.944Z" [ref=e185]
        - group [ref=e186]:
          - generic "指标口径与版本" [ref=e187]
    - region "操作通知":
      - status [ref=e188]:
        - generic [ref=e189]: ✓
        - generic [ref=e190]: 链接解析成功
        - button "关闭通知" [ref=e191] [cursor=pointer]: ×
      - status [ref=e192]:
        - generic [ref=e193]: ✓
        - generic [ref=e194]: 数据源配置已保存
        - button "关闭通知" [ref=e195] [cursor=pointer]: ×
      - status [ref=e196]:
        - generic [ref=e197]: ✓
        - generic [ref=e198]: 同步成功，已入库 2 行数据
        - button "关闭通知" [ref=e199] [cursor=pointer]: ×
      - status [ref=e200]:
        - generic [ref=e201]: ✓
        - generic [ref=e202]: 看板已成功保存并发布！
        - button "关闭通知" [ref=e203] [cursor=pointer]: ×
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';
  3  | import { readFile } from 'node:fs/promises';
  4  | 
  5  | test('报告断链反例：四列原表看板发布后，经页面进入同口径项目报告', async ({ page, request }, info) => {
  6  |   await connectProjectTable(page, request, 'general_workbench', consultationRows);
  7  |   await publishRecommendedBoard(page);
  8  |   await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('300');
  9  |   await page.screenshot({ path: info.outputPath('published-board-without-report-path.png'), fullPage: true });
  10 |   await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
  11 |   await expect(page.getByRole('heading', { name: '项目报告', exact: true })).toBeVisible();
  12 | });
  13 | for (const width of [1280, 1440, 768, 390]) {
  14 |   test(`同口径报告 ${width}px：原表→看板周期→键盘生成→导出→定义变更→新旧快照→只读交接`, async ({ page, request }, info) => {
  15 |     await page.setViewportSize({ width, height: 900 });
  16 |     const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  17 |     await publishRecommendedBoard(page);
  18 |     await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  19 |     await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-02');
  20 |     const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  21 |     await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await published).status()).toBe(200);
  22 |     await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
  23 |     await expect(page.getByRole('link', { name: '报告', exact: true })).toHaveAttribute('aria-current', 'page');
  24 |     await expect(page.getByLabel('项目开始日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-02');
  25 |     const generated = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST');
  26 |     await page.getByRole('button', { name: '生成并保存报告', exact: true }).focus(); await page.keyboard.press('Enter');
  27 |     const firstResponse = await generated; expect(firstResponse.status()).toBe(200); const first = await firstResponse.json();
  28 |     const consultation = page.getByRole('article', { name: '咨询人数合计报告结果', exact: true });
  29 |     await expect(consultation).toContainText('300'); await expect(page.getByRole('article', { name: '成交率报告结果', exact: true })).toContainText('10.0%');
  30 |     await page.getByText('成交率趋势每日趋势', { exact: true }).click();
  31 |     await expect(page.getByRole('table', { name: '成交率趋势每日趋势', exact: true })).toContainText('20.0%'); await expect(page.getByRole('table', { name: '成交率趋势每日趋势', exact: true })).toContainText('5.0%');
  32 |     await page.getByText('成交率按渠道分组对比', { exact: true }).click(); await expect(page.getByRole('table', { name: '成交率按渠道分组对比', exact: true })).toContainText('门店');
  33 |     await expect(page.getByTestId('project-reports')).not.toContainText('母婴'); await expect(page.getByTestId('project-reports')).not.toContainText('启萃');
  34 |     await page.screenshot({ path: info.outputPath('same-metric-report-v1.png'), fullPage: true });
  35 |     const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const download = await downloadPromise;
  36 |     await download.saveAs(info.outputPath('report-v1.html')); const html = await readFile(info.outputPath('report-v1.html'), 'utf8'); expect(html).toContain('<b>300</b>'); expect(html).toContain('<b>10.0%</b>'); expect(html).not.toContain('母婴');
  37 |     expect(first.spec.queryConfig).toEqual({ from: '2026-10-01', to: '2026-10-02' }); expect(first.spec.metrics.filter((m: { metricId: string }) => m.metricId).length).toBe(6);
  38 |     await page.goto('/projects/' + projectId + '/metrics');
  39 |     await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '咨询人数合计', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
  40 |     await page.getByRole('combobox', { name: '指标计算方式', exact: true }).click(); await page.getByRole('option', { name: '数值平均 (Average)', exact: true }).click(); await page.getByRole('button', { name: '保存指标', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  41 |     await page.goto('/projects/' + projectId); await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('150');
  42 |     await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await expect(consultation).toContainText('300'); await expect(consultation).toContainText('指标 v1');
  43 |     await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(consultation).toContainText('150'); await expect(consultation).toContainText('指标 v2'); await expect(page.getByRole('heading', { name: '报告历史 · 2 份', exact: true })).toBeVisible();
  44 |     await page.getByRole('button', { name: '查看报告 ' + first.reportId, exact: true }).click(); await expect(consultation).toContainText('300'); await page.reload(); await expect(consultation).toContainText('300');
  45 |     const stored = await (await request.get('/api/reports?projectId=' + projectId + '&id=' + first.reportId, { headers: projectIdentity })).json(); expect(stored.report.spec).toEqual(first.spec);
  46 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
  47 |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/reports'); await expect(consultation).toContainText('150'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
  48 |     const readerDownloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const readerDownload = await readerDownloadPromise; await readerDownload.saveAs(info.outputPath('viewer-report-v2.html')); expect(await readFile(info.outputPath('viewer-report-v2.html'), 'utf8')).toContain('<b>150</b>');
  49 |     await page.screenshot({ path: info.outputPath('report-viewer-current-version.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  50 |   });
  51 | }
  52 | for (const width of [1280, 390]) {
  53 |   test(`报告百分与投放 ${width}px：普通字段平均1.0%，真实比率每日0.5%和150%，导出单位一致`, async ({ page, request }, info) => {
  54 |     await page.setViewportSize({ width, height: 900 });
  55 |     const percent = await connectProjectTable(page, request, 'general_workbench', [['日期', '渠道', '完成率'], ['2026-10-01', '甲组', '0.5%'], ['2026-10-02', '乙组', '1.5%']]); await publishRecommendedBoard(page);
  56 |     await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
  57 |     const save = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); const saved = await save; expect(saved.status()).toBe(200); const spec = (await saved.json()).spec;
  58 |     await expect(page.getByRole('article', { name: '完成率平均值报告结果', exact: true })).toContainText('1.0%'); const metric = spec.metrics.find((m: { title: string }) => m.title === '完成率平均值'); expect(metric.result.value).toBe(0.01); expect(metric.config.percentScale).toBe('fraction');
  59 |     await page.getByText('完成率平均值趋势每日趋势', { exact: true }).click(); await expect(page.getByRole('table', { name: '完成率平均值趋势每日趋势', exact: true })).toContainText('0.5%'); await page.screenshot({ path: info.outputPath('fraction-percent-report.png'), fullPage: true });
> 60 |     const actual = await (await request.get('/api/datasets?projectId=' + percent.projectId, { headers: projectIdentity })).json(); const rows = await (await request.get('/api/datasets?projectId=' + percent.projectId + '&id=' + actual.datasets[0].id + '&all=true', { headers: projectIdentity })).json(); expect(rows.rows.map((r: { 完成率: number }) => r.完成率)).toEqual([0.005, 0.015]);
     |                                                                                                                                                                                                                                                                                                                                 ^ TypeError: Cannot read properties of undefined (reading 'map')
  61 |     const ad = await connectProjectTable(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '独立甲', 100, 200, 1], ['2026-10-02', '独立乙', 200, 100, 150]]); await publishRecommendedBoard(page);
  62 |     await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('article', { name: '广告消耗报告结果', exact: true })).toContainText('300');
  63 |     await page.getByText('点击率趋势每日趋势', { exact: true }).click(); const table = page.getByRole('table', { name: '点击率趋势每日趋势', exact: true }); await expect(table).toContainText('0.5%'); await expect(table).toContainText('150.0%');
  64 |     await page.screenshot({ path: info.outputPath('own-ad-rate-report.png'), fullPage: true }); const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: '导出当前报告 HTML', exact: true }).click(); const download = await downloadPromise; await download.saveAs(info.outputPath('ad-report.html')); const html = await readFile(info.outputPath('ad-report.html'), 'utf8'); expect(html).toContain('0.5%'); expect(html).toContain('150.0%'); expect(html).not.toContain(percent.projectId);
  65 |     const report = await (await request.get('/api/reports?projectId=' + ad.projectId, { headers: projectIdentity })).json(); expect(report.report.spec.projectId).toBe(ad.projectId); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  66 |   });
  67 |   test(`报告失败恢复 ${width}px：互补缺失显示成对0，500和断网保留范围与历史，真实重试冻结快照`, async ({ page, request }, info) => {
  68 |     await page.setViewportSize({ width, height: 900 });
  69 |     const { projectId } = await connectProjectTable(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '甲', null, 10], ['2026-10-02', '乙', 100, null]]); await publishRecommendedBoard(page);
  70 |     await page.getByRole('link', { name: '查看项目报告', exact: true }).click(); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click();
  71 |     const metric = page.getByRole('article', { name: '成交率报告结果', exact: true }); await expect(metric).toContainText('成对有效 0 行'); await expect(metric).toContainText('成对样本不足'); await expect(metric.locator('.report-metric-value')).toHaveText('—');
  72 |     await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  73 |     for (const failure of ['500', 'network']) {
  74 |       await page.route('**/api/reports', route => route.request().method() === 'POST' ? failure === '500' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '注入报告保存失败' }) }) : route.abort('failed') : route.continue());
  75 |       await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('当前范围和历史报告仍保留'); await expect(page.getByLabel('项目开始日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByLabel('项目结束日期', { exact: true })).toHaveValue('2026-10-01'); await expect(page.getByRole('heading', { name: '报告历史 · 1 份', exact: true })).toBeVisible(); await page.screenshot({ path: info.outputPath('report-' + failure + '-range-retained.png') }); await page.unroute('**/api/reports');
  76 |       expect((await (await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity })).json()).total).toBe(1);
  77 |     }
  78 |     let release: () => void = () => {}, submits = 0; const held = new Promise<void>(resolve => { release = resolve; });
  79 |     await page.route('**/api/reports', async route => { if (route.request().method() === 'POST') { submits++; await held; } await route.continue(); });
  80 |     await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('button', { name: '正在生成指标快照…', exact: true })).toBeDisabled(); await expect(page.getByLabel('项目开始日期', { exact: true })).toBeDisabled(); release();
  81 |     await expect(page.getByRole('heading', { name: '报告历史 · 2 份', exact: true })).toBeVisible(); expect(submits).toBe(1); await page.unroute('**/api/reports'); await page.reload(); await expect(metric).toContainText('成对有效 0 行');
  82 |     await page.screenshot({ path: info.outputPath('missing-paired-report-samples.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  83 |   });
  84 | }
  85 | test('报告取数反例：已有生成接口消费真实共享咨询指标，而非空社媒记录', async ({ page, request }, info) => {
  86 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  87 |   await publishRecommendedBoard(page);
  88 |   const generated = await request.post('/api/agent', { headers: projectIdentity, data: { projectId, prompt: '查看咨询人数和成交率' } });
  89 |   expect(generated.status()).toBe(200); const report = await generated.json();
  90 |   await info.attach('报告真实响应', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  91 |   expect(report.spec.kpis.find((k: { label: string }) => k.label === '咨询人数合计')?.value).toBe('300');
  92 |   expect(report.spec.metrics.some((m: { metricId: string; title: string }) => m.metricId && m.title === '成交率')).toBeTruthy();
  93 | });
  94 | 
```