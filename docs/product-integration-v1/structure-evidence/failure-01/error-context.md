# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-structure.spec.ts >> 授权结构复用 1280px：新项目→自己的新表与不同字段→目标确认→试算→草稿→发布刷新→报告及只读
- Location: tests\browser\product-structure.spec.ts:30:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'target')
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
        - generic [ref=f4e16]: 第二客户独立结构1791929602771
      - paragraph [ref=f4e20]: 品牌未设置 · 第二客户独立结构1791929602771 · 筹备中
    - navigation "项目模块" [ref=f4e21]:
      - link "项目总览" [ref=f4e22] [cursor=pointer]:
        - /url: /projects/1791929602771
        - generic [ref=f4e23]: "01"
      - link "数据管理" [ref=f4e25] [cursor=pointer]:
        - /url: /projects/1791929602771/data
        - generic [ref=f4e26]: "02"
      - link "指标" [ref=f4e28] [cursor=pointer]:
        - /url: /projects/1791929602771/metrics
        - generic [ref=f4e29]: "03"
      - link "报告" [ref=f4e31] [cursor=pointer]:
        - /url: /projects/1791929602771/reports
        - generic [ref=f4e32]: "04"
      - link "项目设置" [ref=f4e34] [cursor=pointer]:
        - /url: /projects/1791929602771/settings
        - generic [ref=f4e35]: "05"
    - generic [ref=f4e37]:
      - text: 项目资料已连接
      - generic [ref=f4e39]: 业务编辑者(张晓) · 2026/10/14 06:13:22
  - main [ref=f4e40]:
    - generic [ref=f4e41]:
      - generic [ref=f4e42]:
        - generic [ref=f4e43]:
          - text: PROJECT DASHBOARD · 通用数据工作台
          - heading "第二客户独立结构1791929602771" [level=1] [ref=f4e45]
          - paragraph [ref=f4e46]: 市场与营销部 · 结构化数据集与度量监控看板
        - button "同步最新数据" [ref=f4e50] [cursor=pointer]
      - region "首次设置" [ref=f4e54]:
        - generic [ref=f4e56]:
          - generic [ref=f4e57]: 首次设置 · 通用数据工作台
          - heading "下一步：选择团队协作或先单人试用" [level=2] [ref=f4e58]
          - paragraph [ref=f4e59]: 发布后进入日常工作界面，成员可以查看同一份结果。
        - generic [ref=f4e60]:
          - button "单人跳过" [ref=f4e61] [cursor=pointer]
          - button "完成初始化（发布项目）" [disabled] [ref=f4e62]
          - button "稍后配置" [ref=f4e63] [cursor=pointer]
        - group [ref=f4e64]:
          - generic "查看设置进度与团队选项" [ref=f4e65]
      - generic [ref=f4e67]:
        - generic [ref=f4e68]:
          - generic [ref=f4e69]:
            - generic [ref=f4e70]: "当前业务数据集:"
            - combobox "当前业务数据集" [ref=f4e72] [cursor=pointer]:
              - generic [ref=f4e73]: 补修数据 (2 行)
          - generic [ref=f4e76]:
            - generic [ref=f4e77]:
              - button "📊 看板视图" [ref=f4e78] [cursor=pointer]
              - button "📋 数据明细 (2 行)" [ref=f4e79] [cursor=pointer]
            - link "查看项目报告" [ref=f4e80] [cursor=pointer]:
              - /url: /projects/1791929602771/reports?query=%7B%7D
            - button "⚙ 自定义看板卡片" [ref=f4e81] [cursor=pointer]
        - region "项目周期与共同筛选" [ref=f4e82]:
          - generic [ref=f4e83]:
            - generic [ref=f4e84]:
              - text: 开始日期
              - textbox "项目开始日期" [ref=f4e85]
            - generic [ref=f4e86]:
              - text: 结束日期
              - textbox "项目结束日期" [ref=f4e87]
            - generic [ref=f4e88]:
              - text: 共同筛选字段
              - combobox "共同筛选字段" [ref=f4e90] [cursor=pointer]:
                - generic [ref=f4e91]: 不筛选
            - button "清除周期与筛选" [ref=f4e94] [cursor=pointer]
          - paragraph [ref=f4e95]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
        - generic [ref=f4e97]:
          - article "记录数量" [ref=f4e98]:
            - generic [ref=f4e99]:
              - generic [ref=f4e100]: 记录数量
              - generic [ref=f4e102]: "2"
            - generic [ref=f4e103]:
              - generic [ref=f4e104]: "来源: 补修数据"
              - generic [ref=f4e105]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e106]: "有效样本: 2 行"
              - generic [ref=f4e107]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "咨询人数合计" [ref=f4e108]:
            - generic [ref=f4e109]:
              - generic [ref=f4e110]: 咨询人数合计
              - generic [ref=f4e112]: "600"
            - generic [ref=f4e113]:
              - generic [ref=f4e114]: "来源: 补修数据"
              - generic [ref=f4e115]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e116]: "有效样本: 2 行"
              - generic [ref=f4e117]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交人数合计" [ref=f4e118]:
            - generic [ref=f4e119]:
              - generic [ref=f4e120]: 成交人数合计
              - generic [ref=f4e122]: "90"
            - generic [ref=f4e123]:
              - generic [ref=f4e124]: "来源: 补修数据"
              - generic [ref=f4e125]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e126]: "有效样本: 2 行"
              - generic [ref=f4e127]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率" [ref=f4e128]:
            - generic [ref=f4e129]:
              - generic [ref=f4e130]: 成交率
              - generic [ref=f4e132]: 15.0%
            - generic [ref=f4e133]:
              - generic [ref=f4e134]: "来源: 补修数据"
              - generic [ref=f4e135]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e136]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=f4e137]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率趋势" [ref=f4e138]:
            - generic [ref=f4e139]:
              - generic [ref=f4e140]: 成交率趋势
              - generic [ref=f4e142]: 15.0%
              - generic [ref=f4e143]:
                - generic [ref=f4e144]:
                  - generic [ref=f4e145]:
                    - strong [ref=f4e146]: 2026-11-02
                    - generic [ref=f4e147]:
                      - text: 成交率
                      - generic [ref=f4e149]: 5.0%
                  - img "成交率趋势时间趋势" [ref=f4e150]:
                    - generic [ref=f4e151]: 0.0%
                    - generic [ref=f4e153]: 5.0%
                    - generic [ref=f4e155]: 10.0%
                    - generic [ref=f4e157]: 15.0%
                    - generic [ref=f4e159]: 20.0%
                    - generic [ref=f4e162]:
                      - generic "2026-11-01 成交率 20.0%" [ref=f4e164]
                      - generic "2026-11-02 成交率 5.0%" [ref=f4e165]
                    - 'button "2026-11-01 成交率: 20.0%" [ref=f4e166]'
                    - 'button "2026-11-02 成交率: 5.0%" [ref=f4e167]'
                    - generic [ref=f4e168]: 11-01
                    - generic [ref=f4e169]: 11-02
                - group [ref=f4e170]:
                  - generic "查看每日数值与样本" [ref=f4e171] [cursor=pointer]
            - generic [ref=f4e172]:
              - generic [ref=f4e173]: "来源: 补修数据"
              - generic [ref=f4e174]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e175]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=f4e176]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率按渠道" [ref=f4e177]:
            - generic [ref=f4e178]:
              - generic [ref=f4e179]: 成交率按渠道
              - generic [ref=f4e181]: 15.0%
              - generic [ref=f4e182]:
                - generic [ref=f4e183]:
                  - generic [ref=f4e184]: 线下
                  - strong [ref=f4e185]:
                    - text: 20.0%
                    - generic [ref=f4e186]: (1)
                  - generic [ref=f4e187]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
                - generic [ref=f4e188]:
                  - generic [ref=f4e189]: 网站
                  - strong [ref=f4e190]:
                    - text: 5.0%
                    - generic [ref=f4e191]: (1)
                  - generic [ref=f4e192]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
            - generic [ref=f4e193]:
              - generic [ref=f4e194]: "来源: 补修数据"
              - generic [ref=f4e195]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e196]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=f4e197]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "本项目咨询目标" [ref=f4e198]:
            - generic [ref=f4e199]:
              - generic [ref=f4e200]: 本项目咨询目标
              - generic [ref=f4e202]: "600"
              - paragraph [ref=f4e204]: 目标：1,200 · 达成 50.0%
            - generic [ref=f4e207]:
              - generic [ref=f4e208]: "来源: 补修数据"
              - generic [ref=f4e209]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=f4e210]: "有效样本: 2 行"
              - generic [ref=f4e211]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
  - button "打开智能助手" [ref=f4e212] [cursor=pointer]:
    - generic [ref=f4e214]: 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, connectExistingProjectTable, publishRecommendedBoard, projectIdentity, consultationRows, dismissProjectNotifications } from './product-journey';
  3  | import type { Page, APIRequestContext } from '@playwright/test';
  4  | 
  5  | test('结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认', async ({ page, request }, info) => {
  6  |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  7  |   await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  8  |   await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click();
  9  |   await expect(page.getByRole('option').filter({ hasText: '独立部门报告' })).toBeVisible(); await page.getByRole('option').filter({ hasText: '独立部门报告' }).click();
  10 |   await expect(page.getByText('客户资料、成员、来源链接与授权、私有记录、供应商、历史报告、实际目标和日期范围都不会复制。', { exact: false })).toBeVisible();
  11 |   await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('复用结构新项目'); await expect(page.getByRole('button', { name: '创建项目并开启向导', exact: true })).toBeDisabled();
  12 |   await info.attach('结构来源项目', { body: JSON.stringify({ projectId, actor: projectIdentity }), contentType: 'application/json' });
  13 | });
  14 | async function createFromStructure(page: Page, request: APIRequestContext, sourceId: string) {
  15 |   const source = (await (await request.get('/api/projects?projectId=' + sourceId, { headers: projectIdentity })).json()).project;
  16 |   await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
  17 |   await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('第二客户独立结构' + Date.now());
  18 |   await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click(); await page.getByRole('option', { name: source.name + ' · ' + source.templateName, exact: true }).click();
  19 |   const acknowledge = page.getByRole('checkbox', { name: '我确认仅复用结构，并重新接入本项目来源及设置目标', exact: true }); await expect(acknowledge).toBeVisible(); await acknowledge.check();
  20 |   const created = page.waitForResponse(response => response.url().endsWith('/api/projects') && response.request().method() === 'POST'); await page.getByRole('button', { name: '创建项目并开启向导', exact: true }).click(); expect((await created).status()).toBe(200); const targetId = (await (await created).json()).id;
  21 |   await expect(page).toHaveURL(new RegExp('/projects/' + targetId + '$')); await expect(page.getByRole('heading', { name: /下一步：接入自己的业务表/ })).toBeVisible();
  22 |   const empty = await (await request.get('/api/datasets?projectId=' + targetId, { headers: projectIdentity })).json(); expect(empty.datasets).toHaveLength(0);
  23 |   const workspace = await (await request.get('/api/projects', { headers: projectIdentity })).json(); expect(workspace.sources.filter((source: { projectId: string }) => source.projectId === targetId)).toHaveLength(0);
  24 |   return targetId;
  25 | }
  26 | async function mapField(page: Page, sourceName: string, targetName: string) {
  27 |   const select = page.getByRole('combobox', { name: '来源1 ' + sourceName + '对应字段', exact: true }); await select.click(); await page.getByRole('option', { name: targetName, exact: true }).click();
  28 | }
  29 | for (const width of [1280, 390]) {
  30 |   test(`授权结构复用 ${width}px：新项目→自己的新表与不同字段→目标确认→试算→草稿→发布刷新→报告及只读`, async ({ page, request }, info) => {
  31 |     await page.setViewportSize({ width, height: 900 });
  32 |     const source = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  33 |     const board = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); const reference = JSON.parse(board.cards.find((card: { title: string }) => card.title === '咨询人数合计').configJson).metricId;
  34 |     const sourceCards = board.cards.map((card: { id: string; title: string; type: string; configJson: string }) => ({ id: card.id, title: card.title, type: card.type, config: JSON.parse(card.configJson) }));
  35 |     const added = await request.post('/api/dashboards', { headers: projectIdentity, data: { projectId: source.projectId, version: board.dashboards[0].version, cards: [...sourceCards, { title: '本项目咨询目标', type: 'progress_card', config: { metricId: reference, target: 600, targetMetricVersion: 1 } }] } }); expect(added.status()).toBe(200);
  36 |     const targetId = await createFromStructure(page, request, source.projectId);
  37 |     await connectExistingProjectTable(page, request, targetId, [['业务日期', '业务渠道', '问询量', '签约量'], ['2026-11-01', '线下', 400, 80], ['2026-11-02', '网站', 200, 10]]);
  38 |     await page.getByRole('button', { name: '确认复用指标与看板', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '绑定本项目来源并确认复用看板', exact: true });
  39 |     for (const [from, to] of [['日期', '业务日期'], ['渠道', '业务渠道'], ['咨询人数', '问询量'], ['成交人数', '签约量']]) await mapField(page, from, to);
  40 |     await expect(dialog.getByText('本项目试算：600', { exact: true })).toBeVisible(); const target = dialog.getByRole('spinbutton', { name: '本项目咨询目标本项目目标', exact: true }); await expect(target).toHaveValue('');
  41 |     await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeDisabled(); await target.focus(); await target.pressSequentially('1200'); await expect(target).toBeFocused(); await expect(target).toHaveValue('1200');
  42 |     await expect(dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true })).toBeEnabled(); await page.screenshot({ path: info.outputPath('own-fields-goal-and-real-preview.png'), fullPage: true });
  43 |     const applied = page.waitForResponse(response => response.url().endsWith('/api/project-structure') && response.request().method() === 'POST'); await dialog.getByRole('button', { name: '确认复用并进入看板草稿', exact: true }).click(); expect((await applied).status()).toBe(200);
  44 |     await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0); await page.reload(); await dismissProjectNotifications(page);
  45 |     const current = await (await request.get('/api/dashboards?projectId=' + targetId, { headers: projectIdentity })).json(); expect(current.cards).toHaveLength(sourceCards.length + 1); const configs = current.cards.map((card: { configJson: string }) => JSON.parse(card.configJson));
> 46 |     expect(configs.find((card: { title: string }) => card.title === '本项目咨询目标').target).toBe(1200); expect(configs.every((card: { metricId: string }) => card.metricId.startsWith(targetId + ':structure:'))).toBeTruthy(); expect(configs.every((card: { from?: string; to?: string }) => !card.from && !card.to)).toBeTruthy();
     |                                                                               ^ TypeError: Cannot read properties of undefined (reading 'target')
  47 |     const amount = page.locator('.configured-board .dashboard-card').filter({ has: page.locator('h4', { hasText: /^咨询人数合计$/ }) }); await expect(amount).toContainText('600');
  48 |     await page.screenshot({ path: info.outputPath('new-project-published-own-results.png'), fullPage: true });
  49 |     const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId: targetId } }); expect(generated.status()).toBe(200);
  50 |     await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId: targetId, userId: 'user-viewer', role: 'viewer' } }); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + targetId + '/reports');
  51 |     await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('600'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('reused-project-viewer-report.png'), fullPage: true });
  52 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  53 |     const original = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); expect(JSON.parse(original.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(600);
  54 |   });
  55 | }
  56 | 
```