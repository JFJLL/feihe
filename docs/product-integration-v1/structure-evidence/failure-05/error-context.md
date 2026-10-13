# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-structure.spec.ts >> 复用投放结构 1280px：自己的五列新表驱动专属页500/10000/100/1.0%，没有原来源或账户
- Location: tests\browser\product-structure.spec.ts:69:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '本项目投放分析', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '本项目投放分析', exact: true }) with timeout 10000ms
  - waiting for getByRole('heading', { name: '本项目投放分析', exact: true })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: 第二客户独立结构1791930452323
    - img
  - paragraph: 品牌未设置 · 第二客户独立结构1791930452323 · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791930452323
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/1791930452323/data
      - text: 02 数据管理
    - link "指标":
      - /url: /projects/1791930452323/metrics
      - text: 03 指标
    - link "投放分析":
      - /url: /projects/1791930452323/ads
      - text: 04 投放分析
    - link "报告":
      - /url: /projects/1791930452323/reports
      - text: 05 报告
    - link "项目设置":
      - /url: /projects/1791930452323/settings
      - text: 06 项目设置
  - text: 项目资料已连接 业务编辑者(张晓) · 2026/10/14 06:27:32
- main:
  - paragraph: 来源：补修数据 · 授权飞书投放表 · 数据 v1
  - paragraph: 同步时间：2026/10/14 06:27:33
  - link "查看原表与字段":
    - /url: /projects/1791930452323/data?tab=datasets
  - region "项目周期与共同筛选":
    - text: 开始日期
    - textbox "项目开始日期"
    - text: 结束日期
    - textbox "项目结束日期"
    - text: 共同筛选字段
    - combobox "共同筛选字段":
      - text: 不筛选
      - img
    - button "清除周期与筛选"
    - paragraph: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
  - region "投放分析指标":
    - article: 广告消耗 500 指标 v1 · 有效样本 2 行
    - article: 曝光量 10,000 指标 v1 · 有效样本 2 行
    - article: 点击量 100 指标 v1 · 有效样本 2 行
    - article: 点击率 1.0% 指标 v1 · 有效样本 2 行
  - heading "广告消耗趋势" [level=3]
  - strong: 2026-11-02
  - text: 广告消耗 100
  - img "广告消耗趋势":
    - text: 0 100 200 300 400
    - 'button "2026-11-01 广告消耗: 400"'
    - 'button "2026-11-02 广告消耗: 100"'
    - text: 11-01 11-02
  - paragraph: 与团队看板引用同一指标 v1；按项目时区每日汇总，缺失不补零。
  - heading "投放点击效率" [level=3]
  - strong: 2026-11-02
  - text: 点击率 1.0%
  - img "投放点击效率":
    - text: 0.0% 0.3% 0.5% 0.8% 1.0%
    - 'button "2026-11-01 点击率: 1.0%"'
    - 'button "2026-11-02 点击率: 1.0%"'
    - text: 11-01 11-02
  - paragraph: 与团队看板引用同一指标 v1；按项目时区每日汇总，缺失不补零。
  - heading "投放渠道对比" [level=3]
  - table "投放渠道消耗":
    - rowgroup:
      - row "渠道 广告消耗 有效样本":
        - columnheader "渠道"
        - columnheader "广告消耗"
        - columnheader "有效样本"
    - rowgroup:
      - row "新媒体甲 400 1":
        - cell "新媒体甲"
        - cell "400"
        - cell "1"
      - row "新媒体乙 100 1":
        - cell "新媒体乙"
        - cell "100"
        - cell "1"
  - paragraph: 目标不从模板或其他客户继承。需要目标时，使用团队看板的“目标进度”并确认本项目数值。
- button "打开智能助手": 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, connectExistingProjectTable, publishRecommendedBoard, projectIdentity, consultationRows, dismissProjectNotifications } from './product-journey';
  3  | import type { Page, APIRequestContext } from '@playwright/test';
  4  | 
  5  | test('结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认', async ({ page, request }, info) => {
  6  |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  7  |   const source = (await (await request.get('/api/projects?projectId=' + projectId, { headers: projectIdentity })).json()).project;
  8  |   await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  9  |   await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click();
  10 |   await expect(page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true })).toBeVisible(); await page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true }).click();
  11 |   await expect(page.getByText('客户资料、成员、来源链接与授权、私有记录、供应商、历史报告、实际目标和日期范围都不会复制。', { exact: false })).toBeVisible();
  12 |   await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('复用结构新项目'); await expect(page.getByRole('button', { name: '创建项目并开启向导', exact: true })).toBeDisabled();
  13 |   await info.attach('结构来源项目', { body: JSON.stringify({ projectId, actor: projectIdentity }), contentType: 'application/json' });
  14 | });
  15 | async function createFromStructure(page: Page, request: APIRequestContext, sourceId: string) {
  16 |   const source = (await (await request.get('/api/projects?projectId=' + sourceId, { headers: projectIdentity })).json()).project;
  17 |   await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  18 |   await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('第二客户独立结构' + Date.now());
  19 |   await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click(); await page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true }).click();
  20 |   const acknowledge = page.getByRole('checkbox', { name: '我确认仅复用结构，并重新接入本项目来源及设置目标', exact: true }); await expect(acknowledge).toBeVisible(); await acknowledge.check();
  21 |   const created = page.waitForResponse(response => response.url().endsWith('/api/projects') && response.request().method() === 'POST'); await page.getByRole('button', { name: '创建项目并开启向导', exact: true }).click(); expect((await created).status()).toBe(200); const targetId = (await (await created).json()).id;
  22 |   await expect(page).toHaveURL(new RegExp('/projects/' + targetId + '$')); await expect(page.getByRole('heading', { name: /下一步：接入自己的业务表/ })).toBeVisible();
  23 |   const empty = await (await request.get('/api/datasets?projectId=' + targetId, { headers: projectIdentity })).json(); expect(empty.datasets).toHaveLength(0);
  24 |   const workspace = await (await request.get('/api/projects', { headers: projectIdentity })).json(); expect(workspace.sources.filter((source: { projectId: string }) => source.projectId === targetId)).toHaveLength(0);
  25 |   return targetId;
  26 | }
  27 | async function mapField(page: Page, sourceName: string, targetName: string) {
  28 |   const select = page.getByRole('combobox', { name: '来源1 ' + sourceName + '对应字段', exact: true }); await select.click(); await page.getByRole('option', { name: targetName, exact: true }).click();
  29 | }
  30 | for (const width of [1280, 390]) {
  31 |   test(`授权结构复用 ${width}px：新项目→自己的新表与不同字段→目标确认→试算→草稿→发布刷新→报告及只读`, async ({ page, request }, info) => {
  32 |     await page.setViewportSize({ width, height: 900 });
  33 |     const source = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  34 |     const board = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); const reference = JSON.parse(board.cards.find((card: { title: string }) => card.title === '咨询人数合计').configJson).metricId;
  35 |     const sourceCards = board.cards.map((card: { id: string; title: string; type: string; configJson: string }) => ({ id: card.id, title: card.title, type: card.type, config: JSON.parse(card.configJson) }));
  36 |     const added = await request.post('/api/dashboards', { headers: projectIdentity, data: { projectId: source.projectId, version: board.dashboards[0].version, layout: { kind: 'project_board', version: 1, query: { from: '2026-10-01', to: '2026-10-02', filters: [{ key: '渠道', value: '门店' }] } }, cards: [...sourceCards, { title: '本项目咨询目标', type: 'progress_card', config: { metricId: reference, target: 600, targetMetricVersion: 1 } }] } }); expect(added.status()).toBe(200);
  37 |     const targetId = await createFromStructure(page, request, source.projectId);
  38 |     await connectExistingProjectTable(page, request, targetId, [['业务日期', '业务渠道', '问询量', '签约量'], ['2026-11-01', '线下', 400, 80], ['2026-11-02', '网站', 200, 10]]);
  39 |     await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '绑定本项目来源并确认复用看板', exact: true });
  40 |     for (const [from, to] of [['日期', '业务日期'], ['渠道', '业务渠道'], ['咨询人数', '问询量'], ['成交人数', '签约量']]) await mapField(page, from, to);
  41 |     await expect(dialog.getByText('本项目试算：600', { exact: true })).toBeVisible(); const target = dialog.getByRole('spinbutton', { name: '本项目咨询目标本项目目标', exact: true }); await expect(target).toHaveValue('');
  42 |     await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeDisabled(); await target.focus(); await target.pressSequentially('1200'); await expect(target).toBeFocused(); await expect(target).toHaveValue('1200');
  43 |     await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeEnabled(); await page.screenshot({ path: info.outputPath('own-fields-goal-and-real-preview.png'), fullPage: true });
  44 |     const applied = page.waitForResponse(response => response.url().endsWith('/api/project-structure') && response.request().method() === 'POST'); await dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); expect((await applied).status()).toBe(200);
  45 |     await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0); await page.reload(); await dismissProjectNotifications(page);
  46 |     const current = await (await request.get('/api/dashboards?projectId=' + targetId, { headers: projectIdentity })).json(); expect(current.cards).toHaveLength(sourceCards.length + 1); const configs = current.cards.map((card: { configJson: string }) => JSON.parse(card.configJson));
  47 |     expect(JSON.parse(current.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(1200); expect(configs.every((card: { metricId: string }) => card.metricId.startsWith(targetId + ':structure:'))).toBeTruthy(); expect(configs.every((card: { from?: string; to?: string }) => !card.from && !card.to)).toBeTruthy();
  48 |     expect(JSON.parse(current.dashboards[0].layoutJson).query).toEqual({});
  49 |     const amount = page.getByRole('article', { name: '咨询人数合计', exact: true }); await expect(amount).toContainText('600');
  50 |     await page.screenshot({ path: info.outputPath('new-project-published-own-results.png'), fullPage: true });
  51 |     const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId: targetId } }); expect(generated.status()).toBe(200);
  52 |     await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId: targetId, userId: 'user-viewer', role: 'viewer' } }); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + targetId + '/reports');
  53 |     await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('600'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('reused-project-viewer-report.png'), fullPage: true });
  54 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  55 |     const original = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); expect(JSON.parse(original.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(600);
  56 |   });
  57 |   test(`复用百分口径 ${width}px：新来源1.5%与2.5%平均2.0%，发布刷新保持分数协议`, async ({ page, request }, info) => {
  58 |     await page.setViewportSize({ width, height: 900 });
  59 |     const source = await connectProjectTable(page, request, 'general_workbench', [['完成率', '金额'], ['0.5%', 10], ['1.5%', 20]]); await publishRecommendedBoard(page);
  60 |     const targetId = await createFromStructure(page, request, source.projectId); await connectExistingProjectTable(page, request, targetId, [['达标率', '金额'], ['1.5%', 40], ['2.5%', 20]]);
  61 |     await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); await mapField(page, '完成率', '达标率');
  62 |     await expect(page.getByRole('dialog').getByText('本项目试算：2.0%', { exact: true })).toBeVisible(); await page.screenshot({ path: info.outputPath('fractional-percentage-reuse-preview.png'), fullPage: true });
  63 |     await page.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0); await page.reload();
  64 |     await expect(page.getByRole('article', { name: '完成率平均值', exact: true })).toContainText('2.0%');
  65 |     const definitions = await (await request.get('/api/metric-definitions?projectId=' + targetId, { headers: projectIdentity })).json(); const metric = definitions.metrics.find((metric: { name: string }) => metric.name === '完成率平均值'); expect(metric.config).toMatchObject({ format: 'percent', percentScale: 'fraction', unit: '%' });
  66 |     const data = await (await request.get('/api/datasets?projectId=' + targetId + '&id=' + encodeURIComponent(metric.config.datasetId) + '&all=true', { headers: projectIdentity })).json(); const key = metric.config.field; expect(data.dataset.rows.map((row: Record<string, number>) => row[key])).toEqual([0.015, 0.025]);
  67 |     await page.screenshot({ path: info.outputPath('fractional-percentage-reuse-published.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  68 |   });
  69 |   test(`复用投放结构 ${width}px：自己的五列新表驱动专属页500/10000/100/1.0%，没有原来源或账户`, async ({ page, request }, info) => {
  70 |     await page.setViewportSize({ width, height: 900 });
  71 |     const source = await connectProjectTable(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '原媒体', 100, 1000, 20], ['2026-10-02', '原渠道', 200, 3000, 50]]); await publishRecommendedBoard(page);
  72 |     const targetId = await createFromStructure(page, request, source.projectId); await connectExistingProjectTable(page, request, targetId, [['业务日期', '媒体', '消耗', '展示次数', '点击次数'], ['2026-11-01', '新媒体甲', 400, 6000, 60], ['2026-11-02', '新媒体乙', 100, 4000, 40]]);
  73 |     await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); for (const [from, to] of [['日期', '业务日期'], ['渠道', '媒体'], ['花费', '消耗'], ['曝光', '展示次数'], ['点击', '点击次数']]) await mapField(page, from, to);
  74 |     await expect(page.getByRole('dialog').getByText('本项目试算：500', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0);
> 75 |     await page.goto('/projects/' + targetId + '/ads'); await expect(page.getByRole('heading', { name: '本项目投放分析', exact: true })).toBeVisible(); await expect(page.getByText('500', { exact: true }).first()).toBeVisible(); await expect(page.getByText('1.0%', { exact: true }).first()).toBeVisible();
     |                                                                                                                                  ^ Error: expect(locator).toBeVisible() failed
  76 |     const analytics = await (await request.get('/api/business-analytics?projectId=' + targetId, { headers: projectIdentity })).json(); expect(analytics.configured).toBeTruthy(); expect(analytics.metrics.spend.value).toBe(500); expect(analytics.metrics.impressions.value).toBe(10000); expect(analytics.metrics.clicks.value).toBe(100); expect(analytics.metrics.ctr.formattedValue).toBe('1.0%'); expect(analytics.dataset.projectId).toBe(targetId); expect(analytics.source.spreadsheet).not.toContain(source.token);
  77 |     await page.screenshot({ path: info.outputPath('own-ad-adapter-after-structure-reuse.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  78 |   });
  79 | }
  80 | 
```