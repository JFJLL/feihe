# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-board.spec.ts >> 共享看板反例：项目周期是真实日期控件且包含完整结束日
- Location: tests\browser\product-board.spec.ts:41:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('项目开始日期', { exact: true })

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
        - generic [ref=e16]: 共同周期与五类呈现1791908995662
      - paragraph [ref=e20]: 品牌未设置 · 共同周期与五类呈现1791908995662 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791908995662
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791908995662/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791908995662/metrics
        - generic [ref=e29]: "03"
      - link "项目设置" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791908995662/settings
        - generic [ref=e32]: "05"
    - generic [ref=e34]:
      - text: 项目资料已连接
      - generic [ref=e36]: 业务编辑者(张晓) · 2026/10/14 00:29:55
  - main [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - text: PROJECT DASHBOARD · 通用数据工作台
          - heading "共同周期与五类呈现1791908995662" [level=1] [ref=e42]
          - paragraph [ref=e43]: 市场与营销部 · 结构化数据集与度量监控看板
        - button "同步最新数据" [ref=e47] [cursor=pointer]
      - region "首次设置" [ref=e51]:
        - generic [ref=e53]:
          - generic [ref=e54]: 首次设置 · 通用数据工作台
          - heading "下一步：选择团队协作或先单人试用" [level=2] [ref=e55]
          - paragraph [ref=e56]: 发布后进入日常工作界面，成员可以查看同一份结果。
        - generic [ref=e57]:
          - button "单人跳过" [ref=e58] [cursor=pointer]
          - button "完成初始化（发布项目）" [disabled] [ref=e59]
          - button "稍后配置" [ref=e60] [cursor=pointer]
        - group [ref=e61]:
          - generic "查看设置进度与团队选项" [ref=e62]
      - generic [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]:
            - generic [ref=e67]: "当前业务数据集:"
            - combobox "当前业务数据集" [ref=e69] [cursor=pointer]:
              - generic [ref=e70]: 仅四列业务表 (4 行)
          - generic [ref=e73]:
            - generic [ref=e74]:
              - button "📊 看板视图" [ref=e75] [cursor=pointer]
              - button "📋 数据明细 (4 行)" [ref=e76] [cursor=pointer]
            - button "⚙ 自定义看板卡片" [ref=e77] [cursor=pointer]
        - article "团队成交率" [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e82]: 团队成交率
            - generic [ref=e84]: 42.5%
          - generic [ref=e85]:
            - generic [ref=e86]: "来源: 仅四列业务表"
            - generic [ref=e87]: 指标 v1 · 跟随最新 · 数据 v1
            - generic [ref=e88]: 成对口径 · 成对有效 4 行 · 分子有效 4/4（100.0%） · 分母有效 4/4（100.0%）
      - generic [ref=e89]:
        - generic [ref=e91]:
          - generic [ref=e92]: AI 复盘
          - heading "基于项目数据生成运营报告" [level=3] [ref=e93]
        - generic [ref=e94]:
          - textbox "报告需求" [ref=e95]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
          - button "生成复盘报告" [ref=e96] [cursor=pointer]
  - button "打开智能助手" [ref=e97] [cursor=pointer]:
    - generic [ref=e99]: 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import type { Page, APIRequestContext } from '@playwright/test';
  3  | 
  4  | const identity = { 'x-user-id': 'user-editor' };
  5  | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  6  | async function choose(page: Page, label: string, option: string) {
  7  |   await page.getByRole('combobox', { name: label, exact: true }).click();
  8  |   await page.getByRole('option', { name: option, exact: true }).click();
  9  | }
  10 | async function fixture(request: APIRequestContext) {
  11 |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '共同周期与五类呈现' + Date.now(), templateId: 'general_workbench' } });
  12 |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  13 |   const token = 'BoardViews-' + projectId;
  14 |   await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [
  15 |     ['日期', '渠道', '咨询人数', '成交人数'],
  16 |     ['2026-10-01 12:00:00', '门店', 100, 20],
  17 |     ['2026-10-01 23:59:59', '线上', 100, 10],
  18 |     ['2026-10-02 00:00:00', '门店', 100, 50],
  19 |     ['', '门店', 100, 90],
  20 |   ] } });
  21 |   const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '仅四列业务表', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
  22 |   expect(source.status()).toBe(200);
  23 |   expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
  24 |   const state = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  25 |   const dataset = state.datasets[0]; expect(dataset.columns.find((c: { key: string }) => c.key === '日期').type).toBe('date');
  26 |   const config = { datasetId: dataset.id, aggregation: 'ratio', numField: '成交人数', denField: '咨询人数', dateField: '日期', missingPolicy: 'skip', ratioBasis: 'paired', format: 'percent', unit: '%' };
  27 |   const saved = await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, name: '成交率', config } });
  28 |   expect(saved.status()).toBe(200);
  29 |   return { projectId, metricId: (await saved.json()).id, config };
  30 | }
  31 | 
  32 | test('共享看板反例：同一指标能通过真实控件选择时间趋势', async ({ page, request }, info) => {
  33 |   await page.context().setExtraHTTPHeaders(identity); const { projectId } = await fixture(request);
  34 |   await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  35 |   await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  36 |   await page.getByRole('combobox', { name: '展示呈现形式', exact: true }).click();
  37 |   await page.screenshot({ path: info.outputPath('trend-option.png') });
  38 |   await page.getByRole('option', { name: '时间趋势', exact: true }).click();
  39 |   await expect(page.getByRole('dialog')).toContainText('按项目时区');
  40 | });
  41 | test('共享看板反例：项目周期是真实日期控件且包含完整结束日', async ({ page, request }, info) => {
  42 |   await page.context().setExtraHTTPHeaders(identity); const { projectId, metricId } = await fixture(request);
  43 |   expect((await request.post('/api/dashboards', { headers: identity, data: { projectId, cards: [{ title: '团队成交率', type: 'metric_card', config: { metricId } }] } })).status()).toBe(200);
  44 |   await page.goto('/projects/' + projectId);
  45 |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('42.5%');
  46 |   await page.screenshot({ path: info.outputPath('missing-project-period.png') });
> 47 |   await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01');
     |                                                    ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  48 |   await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  49 |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('15.0%');
  50 |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('成对有效 2 行');
  51 | });
  52 | 
```