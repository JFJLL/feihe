# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-domains.spec.ts >> 内容领域 1280px：不同字段经真实选择器确认、发布、刷新和报告均使用本项目3000阅读
- Location: tests\browser\product-domains.spec.ts:22:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('combobox', { name: '渠道对应字段', exact: true })

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
        - generic [ref=e16]: 独立部门报告1791934492327
      - paragraph [ref=e20]: 品牌未设置 · 独立部门报告1791934492327 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791934492327
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791934492327/data
        - generic [ref=e26]: "02"
      - link "竞品分析" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791934492327/growth
        - generic [ref=e29]: "03"
      - link "指标" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791934492327/metrics
        - generic [ref=e32]: "04"
      - link "内容管理" [ref=e34] [cursor=pointer]:
        - /url: /projects/1791934492327/content
        - generic [ref=e35]: "05"
      - link "评论运营" [ref=e37] [cursor=pointer]:
        - /url: /projects/1791934492327/comments
        - generic [ref=e38]: "06"
      - link "报告" [ref=e40] [cursor=pointer]:
        - /url: /projects/1791934492327/reports
        - generic [ref=e41]: "07"
      - link "项目设置" [ref=e43] [cursor=pointer]:
        - /url: /projects/1791934492327/settings
        - generic [ref=e44]: "08"
    - generic [ref=e46]:
      - text: 项目资料已连接
      - generic [ref=e48]: 业务编辑者(张晓) · 2026/10/14 07:34:52
  - main [ref=e49]:
    - generic [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]:
          - heading "数据工作台" [level=1] [ref=e54]
          - paragraph [ref=e55]: 从原表接入，到可核对的项目数据。飞书记录仍在原表编辑。
        - button "刷新数据状态" [ref=e57] [cursor=pointer]
      - tablist "模块切换" [ref=e58]:
        - tab "数据源" [ref=e59] [cursor=pointer]
        - tab "数据集" [selected] [ref=e61] [cursor=pointer]
        - tab "同步记录" [ref=e63] [cursor=pointer]
      - generic [ref=e65]:
        - generic [ref=e66]:
          - heading "数据集明细" [level=2] [ref=e67]
          - combobox "业务数据集" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]: 补修数据 · 2 行
        - generic [ref=e73]:
          - paragraph [ref=e74]: 来源：补修数据 · 已入库 2 行 · 数据版本 v1
          - paragraph [ref=e75]: 数据更新时间：2026/10/14 07:34:53
          - paragraph [ref=e76]: 自动同步未启用；当前需手动同步
          - link "在飞书原表修改记录" [ref=e77] [cursor=pointer]:
            - /url: https://fixture.feishu.cn/sheets/Report-1791934492327
        - generic [ref=e78]:
          - generic [ref=e79]:
            - text: 搜索数据明细
            - textbox "搜索数据明细" [ref=e80]:
              - /placeholder: 在当前数据集中搜索
          - button "字段与质量检查" [ref=e81] [cursor=pointer]
          - link "查看项目看板" [ref=e82] [cursor=pointer]:
            - /url: /projects/1791934492327
        - table "业务数据明细" [ref=e84]:
          - rowgroup [ref=e85]:
            - row [ref=e86]:
              - columnheader "业务日" [ref=e87]
              - columnheader "条目编号" [ref=e88]
              - columnheader "事项标题" [ref=e89]
              - columnheader "发布渠道" [ref=e90]
              - columnheader "阅读人次" [ref=e91]
              - columnheader "互动人次" [ref=e92]
              - columnheader "稿件支出" [ref=e93]
          - rowgroup [ref=e94]:
            - row [ref=e95]:
              - cell "2026-11-01" [ref=e96]
              - cell "own-a" [ref=e97]
              - cell "独立部门教程" [ref=e98]
              - cell "站内" [ref=e99]
              - cell "1000" [ref=e100]
              - cell "10" [ref=e101]
              - cell "50" [ref=e102]
            - row [ref=e103]:
              - cell "2026-11-02" [ref=e104]
              - cell "own-b" [ref=e105]
              - cell "独立部门案例" [ref=e106]
              - cell "站外" [ref=e107]
              - cell "2000" [ref=e108]
              - cell "20" [ref=e109]
              - cell "100" [ref=e110]
        - generic [ref=e111]:
          - generic [ref=e112]: 第 1 / 1 页 · 匹配 2 行
          - generic [ref=e113]:
            - button "上一页" [disabled] [ref=e114]
            - button "下一页" [disabled] [ref=e115]
        - heading "正在使用此数据集" [level=3] [ref=e116]
        - paragraph [ref=e117]: 尚无绑定的指标或卡片。
        - generic [ref=e118]:
          - button "推荐指标与看板" [ref=e119] [cursor=pointer]
          - button "创建指标" [ref=e120] [cursor=pointer]
      - dialog [ref=e121]:
        - generic [ref=e122]:
          - generic [ref=e123]:
            - heading "确认适用的指标与看板" [level=3] [ref=e124]
            - button "关闭弹窗" [ref=e125] [cursor=pointer]: ✕
          - generic [ref=e127]:
            - paragraph [ref=e128]: 原表：补修数据 · 2 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。
            - generic [ref=e129]:
              - text: 这张表用于
              - combobox "这张表用于" [ref=e131] [cursor=pointer]:
                - generic [ref=e132]: 内容分析
            - group [ref=e135]:
              - generic "确认字段对应" [ref=e136]
            - generic [ref=e137]:
              - checkbox "推荐内容记录数" [checked] [ref=e138]
              - generic [ref=e139]:
                - strong [ref=e140]: 内容记录数：2
                - generic [ref=e141]: 统计本项目原表记录行数，不要求任务、预算或负责人列。
            - paragraph [ref=e142]: 生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。
            - generic [ref=e143]:
              - checkbox "同时用于专属业务分析" [checked] [ref=e144]
              - generic [ref=e145]: 同时用于内容分析页。业务页需要全部已对应字段的指标；取消可先只创建所选指标。
          - generic [ref=e146]:
            - button "取消" [ref=e147] [cursor=pointer]
            - button "创建指标并进入看板草稿" [ref=e148] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from './evidence';
  2   | import { connectProjectTable, connectExistingProjectTable, publishRecommendedBoard, projectIdentity, dismissProjectNotifications } from './product-journey';
  3   | import type { Page } from '@playwright/test';
  4   | 
  5   | test('内容断链反例：页面接入自己的内容表后，内容页显示真实3000阅读和两条业务记录', async ({ page, request }) => {
  6   |   const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['发布日期', '内容编号', '标题', '阅读量', '互动量', '内容费用'], ['2026-11-01', 'article-a', '业务教程', 1000, 10, 50], ['2026-11-02', 'article-b', '案例分享', 2000, 20, 100]]);
  7   |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/content');
  8   |   const business = page.getByTestId('content-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(business.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('业务教程');
  9   | });
  10  | 
  11  | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  12  | const commentsRows = [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']];
  13  | async function choose(page: Page, name: string, value: string) {
> 14  |   await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: value, exact: true }).click();
      |                                                           ^ Error: locator.click: Test timeout of 60000ms exceeded.
  15  | }
  16  | async function publishDraft(page: Page) {
  17  |   const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  18  |   await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await response).status()).toBe(200); await dismissProjectNotifications(page);
  19  | }
  20  | async function fit(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); }
  21  | for (const width of [1280, 390]) {
  22  |   test(`内容领域 ${width}px：不同字段经真实选择器确认、发布、刷新和报告均使用本项目3000阅读`, async ({ page, request }, info) => {
  23  |     await page.setViewportSize({ width, height: 900 });
  24  |     const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['业务日', '条目编号', '事项标题', '发布渠道', '阅读人次', '互动人次', '稿件支出'], ['2026-11-01', 'own-a', '独立部门教程', '站内', 1000, 10, 50], ['2026-11-02', 'own-b', '独立部门案例', '站外', 2000, 20, 100]]);
  25  |     await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('内容编号或内容链接');
  26  |     await choose(page, '内容编号对应字段', '条目编号');
  27  |     await page.getByText('确认字段对应', { exact: true }).click();
  28  |     for (const [name, value] of [['标题对应字段', '事项标题'], ['渠道对应字段', '发布渠道'], ['阅读量对应字段', '阅读人次'], ['互动量对应字段', '互动人次'], ['内容费用对应字段', '稿件支出']]) await choose(page, name, value);
  29  |     await expect(page.getByRole('dialog')).toContainText('阅读总量：3,000');
  30  |     await page.getByRole('combobox', { name: '阅读量对应字段', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible();
  31  |     await page.screenshot({ path: info.outputPath('content-field-selector-open.png'), fullPage: true }); await page.keyboard.press('Escape');
  32  |     await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).focus(); await page.keyboard.press('Enter'); await publishDraft(page);
  33  |     await page.goto('/projects/' + projectId + '/content'); const domain = page.getByTestId('content-domain-overview');
  34  |     await expect(domain.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(domain.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('独立部门教程');
  35  |     await expect(domain.getByRole('table', { name: '内容渠道对比', exact: true })).toContainText('站外'); await expect(domain.getByRole('link', { name: '在飞书原表处理记录 ↗', exact: true })).toHaveAttribute('href', /fixture\.feishu\.cn/);
  36  |     await page.reload(); await expect(domain.locator('.ops-metric-card').filter({ hasText: '内容费用' })).toContainText('150'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '内容费用' })).not.toContainText('¥'); await fit(page);
  37  |     await page.screenshot({ path: info.outputPath('content-published-own-records.png'), fullPage: true });
  38  |     await page.goto('/projects/' + projectId + '/reports'); const generated = page.waitForResponse(r => r.url().endsWith('/api/reports') && r.request().method() === 'POST'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); const report = await (await generated).json();
  39  |     await expect(page.getByRole('article', { name: '阅读总量报告结果', exact: true })).toContainText('3,000');
  40  |     const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json();
  41  |     expect(report.spec.metrics.find((metric: { title: string }) => metric.title === '阅读总量').metricId).toBe(actual.metrics.reads.definition.id);
  42  |     expect(actual.records.total).toBe(2); expect(actual.records.items[0].recordId).toBe('own-a'); expect(actual.metrics.reads.definition.version).toBe(1); await fit(page);
  43  |   });
  44  |   test(`评论领域 ${width}px：来源标注与状态分组、空标注覆盖和同指标报告真实可见`, async ({ page, request }, info) => {
  45  |     await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'comment_qc', commentsRows); await publishRecommendedBoard(page);
  46  |     await page.goto('/projects/' + projectId + '/comments'); const domain = page.getByTestId('comment-domain-overview');
  47  |     await expect(domain.locator('.ops-metric-card').filter({ hasText: '有情感标注的评论' })).toContainText('2'); await expect(domain.getByRole('table', { name: '来源处置状态', exact: true })).toContainText('待处理');
  48  |     await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('未标注的记录'); await expect(domain).toContainText('不代表平台自动识别或已执行处理');
  49  |     await domain.getByLabel('项目开始日期', { exact: true }).fill('2026-11-01'); await domain.getByLabel('项目结束日期', { exact: true }).fill('2026-11-01'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('2');
  50  |     await choose(page, '共同筛选字段', '处置状态'); await choose(page, '共同筛选值', '待处理'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).not.toContainText('体验很好');
  51  |     await page.screenshot({ path: info.outputPath('comments-source-labeled-and-filtered.png'), fullPage: true }); await domain.getByRole('button', { name: '清除周期与筛选', exact: true }).click();
  52  |     await page.goto('/projects/' + projectId + '/reports'); await page.getByRole('button', { name: '生成并保存报告', exact: true }).click(); await expect(page.getByRole('article', { name: '评论记录数报告结果', exact: true })).toContainText('3');
  53  |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); expect(new Set(board.dashboards[0].cards.map((card: { id: string }) => card.id)).size).toBe(board.dashboards[0].cards.length);
  54  |     expect(board.dashboards[0].cards.filter((card: { type: string }) => card.type === 'breakdown').length).toBe(2);
  55  |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
  56  |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/comments'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await fit(page);
  57  |     await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('article', { name: '评论记录数报告结果', exact: true })).toContainText('3'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
  58  |     await page.screenshot({ path: info.outputPath('comments-viewer-same-report.png'), fullPage: true });
  59  |   });
  60  |   test(`评论最小表 ${width}px：缺字段显示未配置，初始目标不继承，明确保存40/10后刷新仍正确`, async ({ page, request }, info) => {
  61  |     await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['评论内容'], ['只有评论正文']]); await publishRecommendedBoard(page);
  62  |     await page.goto('/projects/' + projectId + '/comments'); const domain = page.getByTestId('comment-domain-overview'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '有情感标注的评论' })).toContainText('未配置'); await expect(domain).toContainText('不是跨批次主键'); await expect(domain).toContainText('未对应日期字段');
  63  |     await page.screenshot({ path: info.outputPath('comment-optional-capabilities-unconfigured.png'), fullPage: true });
  64  |     const initial = await (await request.get('/api/ops?projectId=' + projectId + '&fresh=1', { headers: projectIdentity })).json(); expect(initial.settings.acceptance).toMatchObject({ reportCount: 0, baseCount: 0, targetsConfirmed: false });
  65  |     await page.goto('/projects/' + projectId + '/settings?tab=rules'); await expect(page.getByText(/评论验收目标未设置/)).toBeVisible();
  66  |     await page.getByLabel('可汇报最低评论数', { exact: true }).fill('40'); await page.getByLabel('基础达标评论数', { exact: true }).fill('10');
  67  |     const saved = page.waitForResponse(r => r.url().endsWith('/api/settings') && r.request().method() === 'POST'); await page.getByRole('button', { name: '保存当前项目全部规则与目标', exact: true }).click(); expect((await saved).status()).toBe(200);
  68  |     await page.reload(); await expect(page.getByLabel('可汇报最低评论数', { exact: true })).toHaveValue('40'); await expect(page.getByLabel('基础达标评论数', { exact: true })).toHaveValue('10');
  69  |     const actual = await (await request.get('/api/ops?projectId=' + projectId + '&fresh=1', { headers: projectIdentity })).json(); expect(actual.settings.acceptance).toMatchObject({ reportCount: 40, baseCount: 10, targetsConfirmed: true }); await fit(page);
  70  |     await page.getByLabel('可汇报最低评论数', { exact: true }).focus(); await page.screenshot({ path: info.outputPath('own-comment-targets-confirmed.png'), fullPage: true });
  71  |   });
  72  |   test(`业务校验 ${width}px：样本之外重复编号阻止确认，错误获焦，改对应字段后使用同一个来源与数据集`, async ({ page, request }, info) => {
  73  |     await page.setViewportSize({ width, height: 900 }); const rows = [['内容编号', '唯一编号', '阅读量'], ...Array.from({ length: 31 }, (_, index) => [index === 30 ? 'duplicate0' : 'duplicate' + index, 'unique' + index, index])];
  74  |     const { projectId } = await connectProjectTable(page, request, 'content_marketing', rows); const dataset = (await (await request.get('/api/datasets?projectId=' + projectId, { headers: projectIdentity })).json()).datasets[0];
  75  |     await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); const rejected = page.waitForResponse(r => r.url().endsWith('/api/metric-recommendations') && r.request().method() === 'POST'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); expect((await rejected).status()).toBe(400);
  76  |     const alert = page.getByRole('dialog').getByRole('alert'); await expect(alert).toContainText('第31条'); await expect(alert).toContainText('重复'); await expect(alert).toBeFocused(); await expect(alert).toBeInViewport(); await page.screenshot({ path: info.outputPath('complete-batch-identity-validation-error.png'), fullPage: true });
  77  |     await page.getByText('确认字段对应', { exact: true }).click(); await choose(page, '内容编号对应字段', '唯一编号'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page);
  78  |     await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').getByRole('table', { name: '项目内容记录', exact: true })).toContainText('unique0');
  79  |     const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(); expect(actual.dataset.id).toBe(dataset.id); expect(actual.records.total).toBe(31); expect(actual.roles.contentId).toBe('唯一编号');
  80  |     const workspace = await (await request.get('/api/projects', { headers: projectIdentity })).json(); expect(workspace.sources.filter((source: { projectId: string }) => source.projectId === projectId).map((source: { id: string }) => source.id)).toEqual([dataset.sourceId]); await fit(page);
  81  |   });
  82  |   test(`更新与分页 ${width}px：31条评论第3页，同来源真实同步1条后刷新校正到第1页`, async ({ page, request, context }, info) => {
  83  |     await page.setViewportSize({ width, height: 900 }); const rows = [['评论编号', '评论内容', '处置状态'], ...Array.from({ length: 31 }, (_, index) => ['c' + index, '评论' + index, '待处理'])];
  84  |     const { projectId, token } = await connectProjectTable(page, request, 'comment_qc', rows); await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
  85  |     const domain = page.getByTestId('comment-domain-overview'); await domain.getByRole('button', { name: '下一页记录', exact: true }).click(); await expect(domain).toContainText('第 2 / 3 页'); await domain.getByRole('button', { name: '下一页记录', exact: true }).click(); await expect(domain).toContainText('第 3 / 3 页'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('c30');
  86  |     expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['评论编号', '评论内容', '处置状态'], ['c0', '更新后评论', '已处理']] } })).status()).toBe(200);
  87  |     const sourcePage = await context.newPage(); await sourcePage.goto('/projects/' + projectId + '/data'); const synced = sourcePage.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST'); await sourcePage.getByRole('button', { name: '立即同步', exact: true }).click(); expect((await synced).status()).toBe(200); await sourcePage.close();
  88  |     await page.bringToFront(); await domain.getByRole('button', { name: '刷新业务分析', exact: true }).click(); await expect(domain).toContainText('第 1 / 1 页'); await expect(domain.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('更新后评论'); await expect(domain.getByRole('table', { name: '来源处置状态', exact: true })).toContainText('已处理'); await expect(domain.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('1');
  89  |     await page.screenshot({ path: info.outputPath('comment-source-update-and-page-clamped.png'), fullPage: true }); const actual = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=comment', { headers: projectIdentity })).json(); expect(actual.dataset.version).toBe(2); expect(actual.records.total).toBe(1); expect(actual.metrics.records.definition.version).toBe(1); await fit(page);
  90  |   });
  91  |   test(`内容与评论分表 ${width}px：一个项目两个真实文档，用途选择、两专属页和团队卡片分别引用自己的来源`, async ({ page, request }) => {
  92  |     await page.setViewportSize({ width, height: 900 }); const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['内容编号', '标题', '阅读量'], ['a1', '自己的内容甲', 1000], ['a2', '自己的内容乙', 2000]]); await publishRecommendedBoard(page);
  93  |     await connectExistingProjectTable(page, request, projectId, commentsRows, 'Domain-comments-' + projectId); await page.goto('/projects/' + projectId + '/data?tab=datasets&purpose=comment'); await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click(); await expect(page.getByRole('combobox', { name: '这张表用于', exact: true })).toContainText('评论分析'); await expect(page.getByRole('dialog')).toContainText('评论记录数：3'); await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click(); await publishDraft(page);
  94  |     await page.goto('/projects/' + projectId + '/content'); await expect(page.getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await page.goto('/projects/' + projectId + '/comments'); await expect(page.getByTestId('comment-domain-overview').getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
  95  |     const content = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=content', { headers: projectIdentity })).json(), comment = await (await request.get('/api/business-analytics?projectId=' + projectId + '&kind=comment', { headers: projectIdentity })).json(); expect(content.dataset.id).not.toBe(comment.dataset.id); expect(content.dataset.sourceId).not.toBe(comment.dataset.sourceId); expect(content.metrics.records.definition.id).not.toBe(comment.metrics.records.definition.id);
  96  |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); const references = board.dashboards[0].cards.map((card: { configJson: string }) => JSON.parse(card.configJson).metricId); expect(references).toContain(content.metrics.reads.definition.id); expect(references).toContain(comment.metrics.records.definition.id); await fit(page);
  97  |   });
  98  | }
  99  | test('评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态', async ({ page, request }) => {
  100 |   const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']]);
  101 |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
  102 |   const business = page.getByTestId('comment-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await expect(business.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
  103 | });
  104 | 
```