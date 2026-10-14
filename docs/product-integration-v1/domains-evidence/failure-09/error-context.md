# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-metrics.spec.ts >> 共享看板入口：comment_qc 保留业务主体并能加入自己的引用指标
- Location: tests\browser\product-metrics.spec.ts:20:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '消费者反馈情感结构', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '消费者反馈情感结构', exact: true }) with timeout 10000ms
  - waiting for getByRole('heading', { name: '消费者反馈情感结构', exact: true })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: 共享指标1791935853526
    - img
  - paragraph: 品牌未设置 · 共享指标1791935853526 · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791935853526
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/1791935853526/data
      - text: 02 数据管理
    - link "指标":
      - /url: /projects/1791935853526/metrics
      - text: 03 指标
    - link "评论运营":
      - /url: /projects/1791935853526/comments
      - text: 04 评论运营
    - link "报告":
      - /url: /projects/1791935853526/reports
      - text: 05 报告
    - link "项目设置":
      - /url: /projects/1791935853526/settings
      - text: 06 项目设置
  - text: 项目资料已连接 业务编辑者(张晓) · 2026/10/14 07:57:33
- main:
  - text: COMMENT QC · 评论口碑质检看板
  - heading "共享指标1791935853526" [level=1]
  - paragraph: 本项目评论记录、来源标注与处置状态
  - button "同步最新数据"
  - region "首次设置":
    - text: 首次设置 · 评论质检项目
    - heading "下一步：选择团队协作或先单人试用" [level=2]
    - paragraph: 发布后进入日常工作界面，成员可以查看同一份结果。
    - button "单人跳过"
    - button "完成初始化（发布项目）" [disabled]
    - button "稍后配置"
    - group: 查看设置进度与团队选项
  - text: ∅
  - heading "先确认本项目评论表" [level=3]
  - paragraph: 需要评论内容；评论编号、日期、来源情感和处置状态可选。接入后确认字段与推荐指标，评论分析将使用这张表。
  - link "确认来源与指标":
    - /url: /projects/1791935853526/data?tab=datasets&purpose=comment
  - paragraph: 外部采集与自动处置尚未配置；接入表格不会自动启用这些能力。
  - text: 团队看板
  - heading "项目指标与图表" [level=3]
  - text: "当前业务数据集:"
  - combobox "当前业务数据集":
    - text: 咨询成交原表 (3 行)
    - img
  - button "📊 看板视图"
  - button "📋 数据明细 (3 行)"
  - link "查看项目报告":
    - /url: /projects/1791935853526/reports?query=%7B%7D
  - button "⚙ 自定义看板卡片"
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
  - article "本项目记录": "本项目记录 3 来源: 咨询成交原表 指标 v1 · 跟随最新 · 数据 v1 有效样本: 3 行 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai"
- button "打开智能助手": 智
```

# Test source

```ts
  1   | import { test, expect } from './evidence';
  2   | import type { Page, APIRequestContext } from '@playwright/test';
  3   | const identity = { 'x-user-id': 'user-editor' };
  4   | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  5   | async function choose(page: Page, label: string, option: string) {
  6   |   await page.getByRole('combobox', { name: label, exact: true }).click();
  7   |   await page.getByRole('option', { name: option, exact: true }).click();
  8   | }
  9   | async function fixture(request: APIRequestContext, complete = false, templateId = 'general_workbench') {
  10  |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '共享指标' + Date.now(), templateId } });
  11  |   expect(created.status()).toBe(200); const id = (await created.json()).id;
  12  |   const token = 'SharedMetric-' + id;
  13  |   await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: complete ? [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-04', '新客户门店', 200, 150]] : [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', '', 10], ['2026-10-02', '线上', 100, ''], ['2026-10-03', '门店', 100, 20]] } });
  14  |   const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId: id, name: '咨询成交原表', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
  15  |   expect(source.status()).toBe(200);
  16  |   expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId: id, sourceId: (await source.json()).id } })).status()).toBe(200);
  17  |   return id as string;
  18  | }
  19  | for (const templateId of ['ad_performance', 'comment_qc', 'content_marketing']) {
  20  |   test('共享看板入口：' + templateId + ' 保留业务主体并能加入自己的引用指标', async ({ page, request }) => {
  21  |     await page.context().setExtraHTTPHeaders(identity);
  22  |     const projectId = await fixture(request, false, templateId);
  23  |     const source = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  24  |     const created = await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, name: '本项目记录', config: { datasetId: source.datasets[0].id, aggregation: 'count' } } });
  25  |     expect(created.status()).toBe(200); const metricId = (await created.json()).id;
  26  |     await page.goto('/projects/' + projectId + '/metrics');
  27  |     await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '本项目记录', exact: true }) }).getByRole('button', { name: '加入看板', exact: true }).click();
  28  |     await expect(page.getByRole('dialog', { name: '添加共享指标卡片', exact: true })).toBeVisible();
  29  |     await page.getByRole('button', { name: '加入草稿', exact: true }).click();
  30  |     const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  31  |     await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await published).status()).toBe(200);
  32  |     await page.reload(); await expect(page.getByRole('article', { name: '本项目记录', exact: true })).toContainText('3');
  33  |     await expect(page.getByRole('article', { name: '本项目记录', exact: true })).toContainText('指标 v1');
  34  |     if (templateId === 'ad_performance') await expect(page.getByTestId('ad-performance-overview')).toBeVisible();
> 35  |     if (templateId === 'comment_qc') await expect(page.getByRole('heading', { name: '消费者反馈情感结构', exact: true })).toBeVisible();
      |                                                                                                                  ^ Error: expect(locator).toBeVisible() failed
  36  |     const stored = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
  37  |     expect(JSON.parse(stored.cards[0].configJson).metricId).toBe(metricId);
  38  |   });
  39  | }
  40  | for (const width of [1280, 390]) {
  41  |   test(`指标冲突 ${width}px：真实409保留字段和草稿，读取真实版本后确认重试`, async ({ page, request }, info) => {
  42  |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  43  |     const projectId = await fixture(request);
  44  |     const data = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  45  |     const config = { datasetId: data.datasets[0].id, aggregation: 'ratio', numField: '成交人数', denField: '咨询人数', ratioBasis: 'paired', missingPolicy: 'skip', unit: '%', format: 'percent' };
  46  |     const created = await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, name: '待编辑指标', config } });
  47  |     const metricId = (await created.json()).id;
  48  |     await page.goto('/projects/' + projectId + '/metrics');
  49  |     await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '待编辑指标', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
  50  |     await page.getByRole('textbox', { name: '指标名称', exact: true }).fill('必须保留的标题');
  51  |     expect((await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, id: metricId, name: '服务端新标题', expectedVersion: 1, config: { ...config, ratioBasis: 'independent' } } })).status()).toBe(200);
  52  |     const conflict = page.waitForResponse(r => r.url().endsWith('/api/metric-definitions') && r.request().method() === 'POST');
  53  |     await page.getByRole('button', { name: '保存指标', exact: true }).click(); expect((await conflict).status()).toBe(409);
  54  |     await expect(page.getByRole('textbox', { name: '指标名称', exact: true })).toHaveValue('必须保留的标题');
  55  |     await expect(page.getByRole('combobox', { name: '比率样本口径', exact: true })).toContainText('成对有效行');
  56  |     await expect(page.getByRole('dialog')).toContainText('服务端当前 v2');
  57  |     await page.screenshot({ path: info.outputPath('metric-conflict-draft-preserved.png'), fullPage: true });
  58  |     await page.getByRole('button', { name: '读取最新版本并保留草稿', exact: true }).click();
  59  |     await expect(page.getByRole('dialog')).toContainText('独立汇总');
  60  |     await expect(page.getByRole('textbox', { name: '指标名称', exact: true })).toHaveValue('必须保留的标题');
  61  |     await expect(page.getByRole('combobox', { name: '比率样本口径', exact: true })).toContainText('成对有效行');
  62  |     await page.getByRole('button', { name: '保存指标', exact: true }).click();
  63  |     await expect(page.getByRole('dialog')).toHaveCount(0);
  64  |     const stored = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json();
  65  |     expect(stored.metrics).toHaveLength(1); expect(stored.metrics[0].id).toBe(metricId); expect(stored.metrics[0].version).toBe(3);
  66  |     expect(stored.metrics[0].name).toBe('必须保留的标题'); expect(stored.metrics[0].config.ratioBasis).toBe('paired');
  67  |     expect(stored.metrics[0].versions[1].config.ratioBasis).toBe('independent');
  68  |   });
  69  |   test(`标准模板 ${width}px：管理员发布无来源模板，普通负责人绑定另一项目自己的原表`, async ({ page, request }, info) => {
  70  |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  71  |     const projectId = await fixture(request), title = '公司成交标准' + Date.now();
  72  |     await page.goto('/projects/' + projectId + '/metrics');
  73  |     await page.getByRole('button', { name: '新建指标', exact: true }).click();
  74  |     await page.getByRole('textbox', { name: '指标名称', exact: true }).fill(title);
  75  |     await choose(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
  76  |     await choose(page, '分子字段', '成交人数'); await choose(page, '分母字段', '咨询人数');
  77  |     await page.getByRole('button', { name: '保存指标', exact: true }).click();
  78  |     await expect(page.getByRole('dialog')).toHaveCount(0);
  79  |     const first = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json();
  80  |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-admin' }); await page.goto('/projects/' + projectId + '/metrics');
  81  |     await page.getByRole('row').filter({ has: page.getByRole('cell', { name: title, exact: true }) }).getByRole('button', { name: '发布为标准模板', exact: true }).click();
  82  |     const publicTemplate = page.locator('.data-actions').filter({ hasText: title }); await expect(publicTemplate).toContainText('标准 v1');
  83  |     const other = await fixture(request, true);
  84  |     await page.context().setExtraHTTPHeaders(identity); await page.goto('/projects/' + other + '/metrics');
  85  |     await expect(page.getByRole('button', { name: '发布为标准模板', exact: true })).toHaveCount(0);
  86  |     await publicTemplate.getByRole('button', { name: '绑定到本项目', exact: true }).click();
  87  |     await expect(page.getByText('🔍 全量指标实时试算预览：').locator('..')).toContainText('75.0%');
  88  |     await page.getByText('🔍 全量指标实时试算预览：').scrollIntoViewIfNeeded();
  89  |     await page.screenshot({ path: info.outputPath('standard-own-project-binding.png') });
  90  |     await page.getByRole('button', { name: '保存指标', exact: true }).click();
  91  |     await expect(page.getByRole('dialog')).toHaveCount(0);
  92  |     const second = await (await request.get('/api/metric-definitions?projectId=' + other, { headers: identity })).json();
  93  |     expect(second.metrics).toHaveLength(1); expect(second.metrics[0].id).not.toBe(first.metrics[0].id);
  94  |     expect(second.metrics[0].config.datasetId).not.toBe(first.metrics[0].config.datasetId);
  95  |     expect(second.metrics[0].standardId).toBeTruthy(); expect(second.metrics[0].standardVersion).toBe(1);
  96  |     const template = second.standards.find((item: { id: string }) => item.id === second.metrics[0].standardId);
  97  |     expect(template.config.datasetId).toBeUndefined(); expect(template.config.from).toBeUndefined(); expect(template.config.to).toBeUndefined();
  98  |     const computed = await request.post('/api/metrics', { headers: identity, data: { projectId: other, card: { metricId: second.metrics[0].id } } });
  99  |     expect((await computed.json()).metric.formattedValue).toBe('75.0%');
  100 |     expect((await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, id: first.metrics[0].id, expectedVersion: 1, name: title, config: { ...first.metrics[0].config, ratioBasis: 'independent' } } })).status()).toBe(200);
  101 |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-admin' }); await page.goto('/projects/' + projectId + '/metrics');
  102 |     await publicTemplate.getByRole('button', { name: '维护标准模板', exact: true }).click();
  103 |     await choose(page, '标准模板采用的指标', title + ' · 项目 v2');
  104 |     await page.getByRole('button', { name: '保存标准新版本', exact: true }).click();
  105 |     await expect(page.getByRole('dialog')).toHaveCount(0); await expect(publicTemplate).toContainText('标准 v2');
  106 |     const retained = await (await request.get('/api/metric-definitions?projectId=' + other, { headers: identity })).json();
  107 |     expect(retained.metrics[0].standardVersion).toBe(1); expect(retained.metrics[0].config.ratioBasis).toBe('paired');
  108 |     const latestTemplate = retained.standards.find((item: { id: string }) => item.id === second.metrics[0].standardId);
  109 |     expect(latestTemplate.version).toBe(2); expect(latestTemplate.config.ratioBasis).toBe('independent');
  110 |     for (const version of latestTemplate.versions) expect(version.config.datasetId).toBeUndefined();
  111 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  112 |   });
  113 | }
  114 | for (const width of [1280, 390]) {
  115 |   test(`共享指标 ${width}px：定义一次，两张卡引用，版本修改影响全部卡且历史口径可计算`, async ({ page, request }, info) => {
  116 |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  117 |     const projectId = await fixture(request);
  118 |     await page.goto('/projects/' + projectId + '/metrics');
  119 |     await expect(page.getByRole('heading', { name: '项目指标', exact: true })).toBeVisible();
  120 |     await page.getByRole('button', { name: '新建指标', exact: true }).click();
  121 |     await page.getByRole('textbox', { name: '指标名称', exact: true }).fill('成交率');
  122 |     await choose(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
  123 |     await choose(page, '分子字段', '成交人数'); await choose(page, '分母字段', '咨询人数');
  124 |     await expect(page.getByText('🔍 全量指标实时试算预览：').locator('..')).toContainText('20.0%');
  125 |     await page.getByRole('button', { name: '保存指标', exact: true }).click();
  126 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  127 |     const metricRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '成交率', exact: true }) });
  128 |     await expect(metricRow).toContainText('v1'); await expect(metricRow).toContainText('项目私有');
  129 |     const definitions = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json();
  130 |     expect(definitions.metrics).toHaveLength(1); const metricId = definitions.metrics[0].id;
  131 |     await metricRow.getByRole('button', { name: '加入看板', exact: true }).click();
  132 |     await expect(page.getByRole('dialog', { name: '添加共享指标卡片', exact: true })).toBeVisible();
  133 |     const picker = page.getByRole('dialog', { name: '添加共享指标卡片', exact: true });
  134 |     await page.getByRole('combobox', { name: '展示呈现形式', exact: true }).focus(); await page.keyboard.press('Enter');
  135 |     await expect(page.getByRole('listbox')).toBeVisible();
```