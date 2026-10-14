# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-domains.spec.ts >> 内容与评论分表 390px：一个项目两个真实文档，用途选择、两专属页和团队卡片分别引用自己的来源
- Location: tests\browser\product-domains.spec.ts:91:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'map')
```

# Page snapshot

```yaml
- generic [ref=f4e2]:
  - complementary "项目主要导航" [ref=f4e3]:
    - link "返回项目中心" [ref=f4e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=f4e5]: 项目工作台
    - generic [ref=f4e11]:
      - generic [ref=f4e12]: 当前项目
      - combobox "切换项目" [ref=f4e15] [cursor=pointer]:
        - generic [ref=f4e16]: 独立部门报告1791934656881
      - paragraph [ref=f4e20]: 品牌未设置 · 独立部门报告1791934656881 · 筹备中
    - navigation "项目模块" [ref=f4e21]:
      - link "项目总览" [ref=f4e22] [cursor=pointer]:
        - /url: /projects/1791934656881
        - generic [ref=f4e23]: "01"
      - link "数据管理" [ref=f4e25] [cursor=pointer]:
        - /url: /projects/1791934656881/data
        - generic [ref=f4e26]: "02"
      - link "竞品分析" [ref=f4e28] [cursor=pointer]:
        - /url: /projects/1791934656881/growth
        - generic [ref=f4e29]: "03"
      - link "指标" [ref=f4e31] [cursor=pointer]:
        - /url: /projects/1791934656881/metrics
        - generic [ref=f4e32]: "04"
      - link "内容管理" [ref=f4e34] [cursor=pointer]:
        - /url: /projects/1791934656881/content
        - generic [ref=f4e35]: "05"
      - link "评论运营" [ref=f4e37] [cursor=pointer]:
        - /url: /projects/1791934656881/comments
        - generic [ref=f4e38]: "06"
      - link "报告" [ref=f4e40] [cursor=pointer]:
        - /url: /projects/1791934656881/reports
        - generic [ref=f4e41]: "07"
      - link "项目设置" [ref=f4e43] [cursor=pointer]:
        - /url: /projects/1791934656881/settings
        - generic [ref=f4e44]: "08"
  - main [ref=f4e46]:
    - generic [ref=f4e47]:
      - generic [ref=f4e48]:
        - heading "评论分析" [level=2] [ref=f4e49]
        - paragraph [ref=f4e50]: 来源：补修数据 · 数据 v1 · 更新于 2026/10/14 07:37:39
        - generic [ref=f4e51]:
          - link "查看字段与同步记录" [ref=f4e52] [cursor=pointer]:
            - /url: /projects/1791934656881/data?tab=datasets
          - link "在飞书原表处理记录 ↗" [ref=f4e53] [cursor=pointer]:
            - /url: https://fixture.feishu.cn/sheets/Domain-comments-1791934656881
          - button "刷新业务分析" [ref=f4e54] [cursor=pointer]
        - paragraph [ref=f4e55]: 原始记录在飞书修改；当前未启用自动同步，请从数据页手动同步。
      - region "项目周期与共同筛选" [ref=f4e56]:
        - generic [ref=f4e57]:
          - generic [ref=f4e58]:
            - text: 开始日期
            - textbox "项目开始日期" [ref=f4e59]
          - generic [ref=f4e60]:
            - text: 结束日期
            - textbox "项目结束日期" [ref=f4e61]
          - generic [ref=f4e62]:
            - text: 共同筛选字段
            - combobox "共同筛选字段" [ref=f4e64] [cursor=pointer]:
              - generic [ref=f4e65]: 不筛选
          - button "清除周期与筛选" [ref=f4e68] [cursor=pointer]
        - paragraph [ref=f4e69]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
      - region "评论分析指标" [ref=f4e70]:
        - article [ref=f4e71]:
          - generic [ref=f4e72]: 评论记录数
          - generic [ref=f4e74]: "3"
          - generic [ref=f4e76]: 指标 v1 · 有效样本 3 行
        - article [ref=f4e77]:
          - generic [ref=f4e78]: 有情感标注的评论
          - generic [ref=f4e80]: "2"
          - generic [ref=f4e82]: 指标 v1 · 有效样本 2 行
        - article [ref=f4e83]:
          - generic [ref=f4e84]: 有处置状态的评论
          - generic [ref=f4e86]: "3"
          - generic [ref=f4e88]: 指标 v1 · 有效样本 3 行
      - generic [ref=f4e89]:
        - heading "评论记录趋势" [level=3] [ref=f4e90]
        - generic [ref=f4e91]:
          - generic [ref=f4e92]:
            - strong [ref=f4e93]: 2026-11-02
            - generic [ref=f4e94]:
              - text: 评论记录数
              - generic [ref=f4e96]: "1"
          - img "评论记录趋势" [ref=f4e97]:
            - generic [ref=f4e98]: "0"
            - generic [ref=f4e100]: "0.5"
            - generic [ref=f4e102]: "1"
            - generic [ref=f4e104]: "1.5"
            - generic [ref=f4e106]: "2"
            - generic [ref=f4e109]:
              - generic "2026-11-01 评论记录数 2" [ref=f4e111]
              - generic "2026-11-02 评论记录数 1" [ref=f4e112]
            - 'button "2026-11-01 评论记录数: 2" [ref=f4e113]'
            - 'button "2026-11-02 评论记录数: 1" [ref=f4e114]'
            - generic [ref=f4e115]: 11-01
            - generic [ref=f4e116]: 11-02
        - paragraph [ref=f4e117]: 与看板和报告引用同一指标 v1。缺失不补零；无日期记录不进入指定周期。
      - generic [ref=f4e118]:
        - heading "来源情感分布" [level=3] [ref=f4e119]
        - table "来源情感分布" [ref=f4e121]:
          - rowgroup [ref=f4e122]:
            - row [ref=f4e123]:
              - columnheader "来源分组" [ref=f4e124]
              - columnheader "记录数" [ref=f4e125]
              - columnheader "有效样本" [ref=f4e126]
          - rowgroup [ref=f4e127]:
            - row [ref=f4e128]:
              - cell "问题" [ref=f4e129]
              - cell "1" [ref=f4e130]
              - cell "1" [ref=f4e131]
            - row [ref=f4e132]:
              - cell "正面" [ref=f4e133]
              - cell "1" [ref=f4e134]
              - cell "1" [ref=f4e135]
            - row [ref=f4e136]:
              - cell "未分类" [ref=f4e137]
              - cell "1" [ref=f4e138]
              - cell "1" [ref=f4e139]
      - generic [ref=f4e140]:
        - heading "来源处置状态" [level=3] [ref=f4e141]
        - table "来源处置状态" [ref=f4e143]:
          - rowgroup [ref=f4e144]:
            - row [ref=f4e145]:
              - columnheader "来源分组" [ref=f4e146]
              - columnheader "记录数" [ref=f4e147]
              - columnheader "有效样本" [ref=f4e148]
          - rowgroup [ref=f4e149]:
            - row [ref=f4e150]:
              - cell "待处理" [ref=f4e151]
              - cell "2" [ref=f4e152]
              - cell "2" [ref=f4e153]
            - row [ref=f4e154]:
              - cell "已处理" [ref=f4e155]
              - cell "1" [ref=f4e156]
              - cell "1" [ref=f4e157]
      - generic [ref=f4e158]:
        - heading "项目评论记录" [level=3] [ref=f4e159]
        - paragraph [ref=f4e160]: 当前筛选共 3 条记录。使用已确认的来源编号或链接识别记录。
        - table "项目评论记录" [ref=f4e162]:
          - rowgroup [ref=f4e163]:
            - row [ref=f4e164]:
              - columnheader "评论编号" [ref=f4e165]
              - columnheader "评论内容" [ref=f4e166]
              - columnheader "记录日期" [ref=f4e167]
              - columnheader "来源情感标注" [ref=f4e168]
              - columnheader "来源处置状态" [ref=f4e169]
          - rowgroup [ref=f4e170]:
            - row [ref=f4e171]:
              - cell "c1" [ref=f4e172]
              - cell "需要回复咨询" [ref=f4e173]
              - cell "2026-11-01" [ref=f4e174]
              - cell "问题" [ref=f4e175]
              - cell "待处理" [ref=f4e176]
            - row [ref=f4e177]:
              - cell "c2" [ref=f4e178]
              - cell "体验很好" [ref=f4e179]
              - cell "2026-11-01" [ref=f4e180]
              - cell "正面" [ref=f4e181]
              - cell "已处理" [ref=f4e182]
            - row [ref=f4e183]:
              - cell "c3" [ref=f4e184]
              - cell "未标注的记录" [ref=f4e185]
              - cell "2026-11-02" [ref=f4e186]
              - cell "—" [ref=f4e187]
              - cell "待处理" [ref=f4e188]
        - generic [ref=f4e189]:
          - button "上一页记录" [disabled] [ref=f4e190] [cursor=pointer]
          - generic [ref=f4e191]: 第 1 / 1 页
          - button "下一页记录" [disabled] [ref=f4e192] [cursor=pointer]
      - paragraph [ref=f4e193]: 情感和处置状态均为来源原有标注，不代表平台自动识别或已执行处理。验收目标需在本项目明确设置；外部采集、自动删除与自动回复待配置。
  - button "打开智能助手" [ref=f4e194] [cursor=pointer]:
    - generic [ref=f4e196]: 智
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
  14  |   await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: value, exact: true }).click();
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
> 96  |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); const references = board.dashboards[0].cards.map((card: { configJson: string }) => JSON.parse(card.configJson).metricId); expect(references).toContain(content.metrics.reads.definition.id); expect(references).toContain(comment.metrics.records.definition.id); await fit(page);
      |                                                                                                                                                                          ^ TypeError: Cannot read properties of undefined (reading 'map')
  97  |   });
  98  | }
  99  | test('评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态', async ({ page, request }) => {
  100 |   const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']]);
  101 |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
  102 |   const business = page.getByTestId('comment-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await expect(business.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
  103 | });
  104 | 
```