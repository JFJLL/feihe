# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-domains.spec.ts >> 评论领域 1280px：来源标注与状态分组、空标注覆盖和同指标报告真实可见
- Location: tests\browser\product-domains.spec.ts:44:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'map')
```

# Page snapshot

```yaml
- generic [ref=f2e2]:
  - complementary "项目主要导航" [ref=f2e3]:
    - link "返回项目中心" [ref=f2e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=f2e5]: 项目工作台
    - generic [ref=f2e11]:
      - generic [ref=f2e12]: 当前项目
      - combobox "切换项目" [ref=f2e15] [cursor=pointer]:
        - generic [ref=f2e16]: 独立部门报告1791934554073
      - paragraph [ref=f2e20]: 品牌未设置 · 独立部门报告1791934554073 · 筹备中
    - navigation "项目模块" [ref=f2e21]:
      - link "项目总览" [ref=f2e22] [cursor=pointer]:
        - /url: /projects/1791934554073
        - generic [ref=f2e23]: "01"
      - link "数据管理" [ref=f2e25] [cursor=pointer]:
        - /url: /projects/1791934554073/data
        - generic [ref=f2e26]: "02"
      - link "指标" [ref=f2e28] [cursor=pointer]:
        - /url: /projects/1791934554073/metrics
        - generic [ref=f2e29]: "03"
      - link "评论运营" [ref=f2e31] [cursor=pointer]:
        - /url: /projects/1791934554073/comments
        - generic [ref=f2e32]: "04"
      - link "报告" [ref=f2e34] [cursor=pointer]:
        - /url: /projects/1791934554073/reports
        - generic [ref=f2e35]: "05"
      - link "项目设置" [ref=f2e37] [cursor=pointer]:
        - /url: /projects/1791934554073/settings
        - generic [ref=f2e38]: "06"
    - generic [ref=f2e40]:
      - text: 项目资料已连接
      - generic [ref=f2e42]: 业务编辑者(张晓) · 2026/10/14 07:35:54
  - main [ref=f2e43]:
    - generic [ref=f2e44]:
      - generic [ref=f2e45]:
        - generic [ref=f2e46]:
          - heading "项目报告" [level=1] [ref=f2e48]
          - paragraph [ref=f2e49]: 独立部门报告1791934554073 · 使用已发布看板的同一指标，历史快照保留原口径
        - link "返回项目看板" [ref=f2e51] [cursor=pointer]:
          - /url: /projects/1791934554073
      - region "报告生成范围" [ref=f2e52]:
        - heading "生成当前范围的报告" [level=2] [ref=f2e53]
        - region "项目周期与共同筛选" [ref=f2e54]:
          - generic [ref=f2e55]:
            - generic [ref=f2e56]:
              - text: 开始日期
              - textbox "项目开始日期" [ref=f2e57]
            - generic [ref=f2e58]:
              - text: 结束日期
              - textbox "项目结束日期" [ref=f2e59]
            - generic [ref=f2e60]:
              - text: 共同筛选字段
              - combobox "共同筛选字段" [ref=f2e62] [cursor=pointer]:
                - generic [ref=f2e63]: 不筛选
            - button "清除周期与筛选" [ref=f2e66] [cursor=pointer]
          - paragraph [ref=f2e67]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
        - paragraph [ref=f2e68]: 默认继承看板周期；独立周期卡片仍使用自己的范围。生成时固定指标和数据版本，之后的编辑不会改变历史报告。当前未启用AI增强；无需模型凭证即可查看、保存和导出真实结果。
        - button "生成并保存报告" [ref=f2e69] [cursor=pointer]
      - region "报告历史" [ref=f2e70]:
        - heading "报告历史 · 1 份" [level=2] [ref=f2e71]
        - table "项目报告历史" [ref=f2e73]:
          - rowgroup [ref=f2e74]:
            - row [ref=f2e75]:
              - columnheader "生成时间" [ref=f2e76]
              - columnheader "周期" [ref=f2e77]
              - columnheader "操作" [ref=f2e78]
          - rowgroup [ref=f2e79]:
            - row [ref=f2e80]:
              - cell "2026/10/14 07:35:57" [ref=f2e81]
              - cell "不限开始 至 不限结束" [ref=f2e82]
              - cell [ref=f2e83]:
                - button "查看报告 e0f3f7af-7f31-458c-8f1e-ae572c599f02" [ref=f2e84] [cursor=pointer]: 查看快照
        - generic [ref=f2e85]:
          - paragraph [ref=f2e86]: 第 1 / 1 页
          - generic [ref=f2e87]:
            - button "报告历史上一页" [disabled] [ref=f2e88] [cursor=pointer]
            - button "报告历史下一页" [disabled] [ref=f2e89] [cursor=pointer]
      - region "已保存的报告快照" [ref=f2e90]:
        - generic [ref=f2e91]:
          - heading "独立部门报告1791934554073 · 项目报告" [level=2] [ref=f2e92]
          - paragraph [ref=f2e93]: 报告周期：不限开始 至 不限结束 · 生成于 2026/10/14 07:35:57
          - paragraph [ref=f2e94]: 此处是已保存快照，日期输入调整后需生成新报告。
          - link "导出当前报告 HTML" [ref=f2e95] [cursor=pointer]:
            - /url: /api/report-html?projectId=1791934554073&id=e0f3f7af-7f31-458c-8f1e-ae572c599f02&download=1
        - region "报告关键指标" [ref=f2e96]:
          - article "评论记录数报告结果" [ref=f2e97]:
            - heading "评论记录数" [level=3] [ref=f2e98]
            - strong [ref=f2e99]: "3"
            - paragraph [ref=f2e100]: 指标 v1 · 数据 v1
            - paragraph [ref=f2e101]: 有效样本 3 行
            - paragraph [ref=f2e102]: 选择完整起止日期后可比较上期
          - article "有情感标注的评论报告结果" [ref=f2e103]:
            - heading "有情感标注的评论" [level=3] [ref=f2e104]
            - strong [ref=f2e105]: "2"
            - paragraph [ref=f2e106]: 指标 v1 · 数据 v1
            - paragraph [ref=f2e107]: 有效样本 2 行
            - paragraph [ref=f2e108]: 选择完整起止日期后可比较上期
          - article "有处置状态的评论报告结果" [ref=f2e109]:
            - heading "有处置状态的评论" [level=3] [ref=f2e110]
            - strong [ref=f2e111]: "3"
            - paragraph [ref=f2e112]: 指标 v1 · 数据 v1
            - paragraph [ref=f2e113]: 有效样本 3 行
            - paragraph [ref=f2e114]: 选择完整起止日期后可比较上期
        - generic [ref=f2e115]:
          - heading "评论记录数趋势" [level=3] [ref=f2e116]
          - generic [ref=f2e117]:
            - generic [ref=f2e118]:
              - strong [ref=f2e119]: 2026-11-02
              - generic [ref=f2e120]:
                - text: 评论记录数趋势
                - generic [ref=f2e122]: "1"
            - img "评论记录数趋势" [ref=f2e123]:
              - generic [ref=f2e124]: "0"
              - generic [ref=f2e126]: "0.5"
              - generic [ref=f2e128]: "1"
              - generic [ref=f2e130]: "1.5"
              - generic [ref=f2e132]: "2"
              - generic [ref=f2e135]:
                - generic "2026-11-01 评论记录数趋势 2" [ref=f2e137]
                - generic "2026-11-02 评论记录数趋势 1" [ref=f2e138]
              - 'button "2026-11-01 评论记录数趋势: 2" [ref=f2e139]'
              - 'button "2026-11-02 评论记录数趋势: 1" [ref=f2e140]'
              - generic [ref=f2e141]: 11-01
              - generic [ref=f2e142]: 11-02
        - group [ref=f2e143]:
          - generic "需要关注的状态" [ref=f2e144]
          - list [ref=f2e145]:
            - listitem [ref=f2e146]: 仅使用本项目已发布的看板指标；报告保留生成时的口径与数据版本，不随之后修改重算。
            - listitem [ref=f2e147]: 当前指标均可核对；这里不自动推断业务原因。
        - group [ref=f2e148]:
          - generic "评论记录数每日趋势" [ref=f2e149]
        - group [ref=f2e150]:
          - generic "有情感标注的评论每日趋势" [ref=f2e151]
        - group [ref=f2e152]:
          - generic "有处置状态的评论每日趋势" [ref=f2e153]
        - group [ref=f2e154]:
          - generic "评论记录数趋势每日趋势" [ref=f2e155]
        - group [ref=f2e156]:
          - generic "来源情感分布每日趋势" [ref=f2e157]
        - group [ref=f2e158]:
          - generic "来源情感分布分组对比" [ref=f2e159]
        - group [ref=f2e160]:
          - generic "来源处置状态每日趋势" [ref=f2e161]
        - group [ref=f2e162]:
          - generic "来源处置状态分组对比" [ref=f2e163]
        - group [ref=f2e164]:
          - generic "来源与数据更新时间" [ref=f2e165]
          - table "来源与数据更新时间" [ref=f2e167]:
            - rowgroup [ref=f2e168]:
              - row [ref=f2e169]:
                - columnheader "来源" [ref=f2e170]
                - columnheader "数据版本" [ref=f2e171]
                - columnheader "原表记录" [ref=f2e172]
                - columnheader "数据更新时间" [ref=f2e173]
                - columnheader "同步状态" [ref=f2e174]
            - rowgroup [ref=f2e175]:
              - row [ref=f2e176]:
                - cell "补修数据" [ref=f2e177]
                - cell "1" [ref=f2e178]
                - cell "3" [ref=f2e179]
                - cell "2026-10-13T23:35:55.374Z" [ref=f2e180]
                - cell "最近成功：2026-10-13T23:35:55.358Z" [ref=f2e181]
        - group [ref=f2e182]:
          - generic "指标口径与版本" [ref=f2e183]
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
> 53  |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: projectIdentity })).json(); expect(new Set(board.dashboards[0].cards.map((card: { id: string }) => card.id)).size).toBe(board.dashboards[0].cards.length);
      |                                                                                                                                                                      ^ TypeError: Cannot read properties of undefined (reading 'map')
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