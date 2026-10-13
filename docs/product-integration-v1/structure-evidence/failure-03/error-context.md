# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-structure.spec.ts >> 结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认
- Location: tests\browser\product-structure.spec.ts:5:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('option').filter({ hasText: '独立部门报告' })
Expected: visible
Error: strict mode violation: getByRole('option').filter({ hasText: '独立部门报告' }) resolved to 4 elements:
    1) <li role="option" aria-selected="false" class="custom-select-option   " id="custom-select-listbox-_r_9_-opt-1">…</li> aka getByRole('option', { name: '独立部门报告1791929968476 · 通用数据工作台' })
    2) <li role="option" aria-selected="false" class="custom-select-option   " id="custom-select-listbox-_r_9_-opt-3">…</li> aka getByRole('option', { name: '独立部门报告1791929607413 · 通用数据工作台' })
    3) <li role="option" aria-selected="false" class="custom-select-option   " id="custom-select-listbox-_r_9_-opt-5">…</li> aka getByRole('option', { name: '独立部门报告1791929600454 · 通用数据工作台' })
    4) <li role="option" aria-selected="false" class="custom-select-option   " id="custom-select-listbox-_r_9_-opt-6">…</li> aka getByRole('option', { name: '独立部门报告1791929594947 · 通用数据工作台' })

Call log:
  - Expect "toBeVisible" getByRole('option').filter({ hasText: '独立部门报告' }) with timeout 10000ms
  - waiting for getByRole('option').filter({ hasText: '独立部门报告' })

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - banner [ref=f1e3]:
    - link "协同 项目数据与报告协作" [ref=f1e4] [cursor=pointer]:
      - /url: /
      - generic [ref=f1e5]: 协同
      - generic [ref=f1e6]: 项目数据与报告协作
    - generic [ref=f1e8]:
      - text: 业务编辑者(张晓)
      - generic [ref=f1e9]: 公司成员
  - main [ref=f1e10]:
    - generic [ref=f1e11]:
      - generic [ref=f1e12]:
        - heading "项目中心" [level=1] [ref=f1e13]
        - paragraph [ref=f1e14]: 查看负责的工作，或为团队建立自己的数据工作台。
      - generic [ref=f1e15]:
        - button "联系平台管理员" [ref=f1e16] [cursor=pointer]
        - button "＋ 新建项目" [ref=f1e17] [cursor=pointer]
    - region "项目筛选" [ref=f1e18]:
      - generic [ref=f1e19]:
        - text: 搜索
        - textbox "搜索项目" [ref=f1e20]:
          - /placeholder: 项目、客户、负责人或说明
      - generic [ref=f1e21]:
        - text: 项目范围
        - combobox "项目范围" [ref=f1e23] [cursor=pointer]:
          - generic [ref=f1e24]: 全部可见项目
      - generic [ref=f1e27]:
        - text: 客户
        - combobox "筛选客户" [ref=f1e29] [cursor=pointer]:
          - generic [ref=f1e30]: 全部客户
      - generic [ref=f1e33]:
        - text: 部门
        - combobox "筛选部门" [ref=f1e35] [cursor=pointer]:
          - generic [ref=f1e36]: 全部部门
      - generic [ref=f1e39]:
        - text: 负责人
        - combobox "筛选负责人" [ref=f1e41] [cursor=pointer]:
          - generic [ref=f1e42]: 全部负责人
      - generic [ref=f1e45]:
        - text: 状态
        - combobox "筛选状态" [ref=f1e47] [cursor=pointer]:
          - generic [ref=f1e48]: 全部状态
    - generic [ref=f1e51]:
      - generic [ref=f1e52]: 7 个授权项目
      - group "项目显示方式" [ref=f1e53]:
        - button "项目卡片" [pressed] [ref=f1e54] [cursor=pointer]
        - button "紧凑列表" [ref=f1e55] [cursor=pointer]
    - generic [ref=f1e56]:
      - article "独立部门报告1791929968476" [ref=f1e57]:
        - generic [ref=f1e58]:
          - generic [ref=f1e59]: 筹备中
          - generic [ref=f1e60]: 通用数据工作台
        - heading "独立部门报告1791929968476" [level=2] [ref=f1e61]
        - paragraph [ref=f1e62]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e63]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e64]: 团队数据、分析与报告工作台
        - generic [ref=f1e65]: 数据更新 2026/10/14 06:19:31
        - generic [ref=f1e66]: 首次设置未完成
        - generic [ref=f1e67]:
          - button "编辑" [ref=f1e68] [cursor=pointer]
          - button "归档" [ref=f1e69] [cursor=pointer]
          - link "继续设置 →" [ref=f1e70] [cursor=pointer]:
            - /url: /projects/1791929968476
      - article "第二客户独立结构1791929609334" [ref=f1e71]:
        - generic [ref=f1e72]:
          - generic [ref=f1e73]: 筹备中
          - generic [ref=f1e74]: 通用数据工作台
        - heading "第二客户独立结构1791929609334" [level=2] [ref=f1e75]
        - paragraph [ref=f1e76]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e77]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e78]: 团队数据、分析与报告工作台
        - generic [ref=f1e79]: 数据更新 2026/10/14 06:13:30
        - generic [ref=f1e80]: 首次设置未完成
        - generic [ref=f1e81]:
          - button "编辑" [ref=f1e82] [cursor=pointer]
          - button "归档" [ref=f1e83] [cursor=pointer]
          - link "继续设置 →" [ref=f1e84] [cursor=pointer]:
            - /url: /projects/1791929609334
      - article "独立部门报告1791929607413" [ref=f1e85]:
        - generic [ref=f1e86]:
          - generic [ref=f1e87]: 筹备中
          - generic [ref=f1e88]: 通用数据工作台
        - heading "独立部门报告1791929607413" [level=2] [ref=f1e89]
        - paragraph [ref=f1e90]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e91]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e92]: 团队数据、分析与报告工作台
        - generic [ref=f1e93]: 数据更新 2026/10/14 06:13:28
        - generic [ref=f1e94]: 首次设置未完成
        - generic [ref=f1e95]:
          - button "编辑" [ref=f1e96] [cursor=pointer]
          - button "归档" [ref=f1e97] [cursor=pointer]
          - link "继续设置 →" [ref=f1e98] [cursor=pointer]:
            - /url: /projects/1791929607413
      - article "第二客户独立结构1791929602771" [ref=f1e99]:
        - generic [ref=f1e100]:
          - generic [ref=f1e101]: 筹备中
          - generic [ref=f1e102]: 通用数据工作台
        - heading "第二客户独立结构1791929602771" [level=2] [ref=f1e103]
        - paragraph [ref=f1e104]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e105]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e106]: 团队数据、分析与报告工作台
        - generic [ref=f1e107]: 数据更新 2026/10/14 06:13:23
        - generic [ref=f1e108]: 首次设置未完成
        - generic [ref=f1e109]:
          - button "编辑" [ref=f1e110] [cursor=pointer]
          - button "归档" [ref=f1e111] [cursor=pointer]
          - link "继续设置 →" [ref=f1e112] [cursor=pointer]:
            - /url: /projects/1791929602771
      - article "独立部门报告1791929600454" [ref=f1e113]:
        - generic [ref=f1e114]:
          - generic [ref=f1e115]: 筹备中
          - generic [ref=f1e116]: 通用数据工作台
        - heading "独立部门报告1791929600454" [level=2] [ref=f1e117]
        - paragraph [ref=f1e118]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e119]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e120]: 团队数据、分析与报告工作台
        - generic [ref=f1e121]: 数据更新 2026/10/14 06:13:21
        - generic [ref=f1e122]: 首次设置未完成
        - generic [ref=f1e123]:
          - button "编辑" [ref=f1e124] [cursor=pointer]
          - button "归档" [ref=f1e125] [cursor=pointer]
          - link "继续设置 →" [ref=f1e126] [cursor=pointer]:
            - /url: /projects/1791929600454
      - article "独立部门报告1791929594947" [ref=f1e127]:
        - generic [ref=f1e128]:
          - generic [ref=f1e129]: 筹备中
          - generic [ref=f1e130]: 通用数据工作台
        - heading "独立部门报告1791929594947" [level=2] [ref=f1e131]
        - paragraph [ref=f1e132]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e133]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e134]: 团队数据、分析与报告工作台
        - generic [ref=f1e135]: 数据更新 2026/10/14 06:13:18
        - generic [ref=f1e136]: 首次设置未完成
        - generic [ref=f1e137]:
          - button "编辑" [ref=f1e138] [cursor=pointer]
          - button "归档" [ref=f1e139] [cursor=pointer]
          - link "继续设置 →" [ref=f1e140] [cursor=pointer]:
            - /url: /projects/1791929594947
      - article "启萃评论与声量项目" [ref=f1e141]:
        - generic [ref=f1e142]:
          - generic [ref=f1e143]: 进行中
          - generic [ref=f1e144]: 内容营销项目
        - heading "启萃评论与声量项目" [level=2] [ref=f1e145]
        - paragraph [ref=f1e146]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e147]: 负责人：平台管理员
        - paragraph [ref=f1e148]: 评论执行、口碑舆情与本竞品监测
        - generic [ref=f1e149]: 待首次同步
        - link "进入工作区 →" [ref=f1e151] [cursor=pointer]:
          - /url: /projects/qicui
  - dialog [ref=f1e152]:
    - generic [ref=f1e153]:
      - banner [ref=f1e154]:
        - heading "新建项目" [level=3] [ref=f1e155]
        - button "关闭弹窗" [ref=f1e156] [cursor=pointer]: ✕
      - generic [ref=f1e158]:
        - group [ref=f1e159]:
          - generic [ref=f1e160]:
            - text: 项目名称
            - textbox "项目名称" [ref=f1e161]:
              - /placeholder: 如：咨询成交分析
          - generic [ref=f1e162]:
            - text: 负责部门
            - combobox "负责部门" [ref=f1e164] [cursor=pointer]:
              - generic [ref=f1e165]: 市场与营销部
          - generic [ref=f1e168]:
            - text: 项目负责人
            - combobox "项目负责人" [ref=f1e170] [cursor=pointer]:
              - generic [ref=f1e171]: 业务编辑者(张晓)
          - generic [ref=f1e174]:
            - text: 客户或内部项目
            - combobox "客户或内部项目" [ref=f1e176] [cursor=pointer]:
              - generic [ref=f1e177]: 内部项目
          - generic [ref=f1e180]:
            - text: 复用项目结构（选填）
            - generic [ref=f1e181]:
              - combobox "复用项目结构" [expanded] [active] [ref=f1e182] [cursor=pointer]:
                - generic [ref=f1e183]: 从业务方向或空白起步
              - listbox [ref=f1e186]:
                - option "从业务方向或空白起步" [selected] [ref=f1e187] [cursor=pointer]
                - option "独立部门报告1791929968476 · 通用数据工作台" [ref=f1e191] [cursor=pointer]
                - option "第二客户独立结构1791929609334 · 通用数据工作台" [ref=f1e193] [cursor=pointer]
                - option "独立部门报告1791929607413 · 通用数据工作台" [ref=f1e195] [cursor=pointer]
                - option "第二客户独立结构1791929602771 · 通用数据工作台" [ref=f1e197] [cursor=pointer]
                - option "独立部门报告1791929600454 · 通用数据工作台" [ref=f1e199] [cursor=pointer]
                - option "独立部门报告1791929594947 · 通用数据工作台" [ref=f1e201] [cursor=pointer]
                - option "启萃评论与声量项目 · 内容营销项目" [ref=f1e203] [cursor=pointer]
          - generic [ref=f1e205]:
            - text: 业务方向
            - combobox "业务方向" [ref=f1e207] [cursor=pointer]:
              - generic [ref=f1e208]: 通用数据工作台
          - generic [ref=f1e211]:
            - strong [ref=f1e212]: 通用数据工作台
            - paragraph [ref=f1e213]: 接入任意部门表格，再按实际字段推荐指标与图表。
            - generic [ref=f1e214]: 必要字段：无固定业务字段。可选：日期、分类或渠道、数值字段。推荐：记录数、数值汇总、趋势与分组对比。
          - generic [ref=f1e215]:
            - text: 项目说明
            - textbox "项目说明" [ref=f1e216]:
              - /placeholder: 这项工作要回答什么问题，团队如何使用结果
          - group [ref=f1e217]:
            - generic "业务状态与识别色" [ref=f1e218] [cursor=pointer]
        - paragraph [ref=f1e219]: 请填写项目名称
      - contentinfo [ref=f1e220]:
        - button "取消" [ref=f1e221] [cursor=pointer]
        - button "创建项目并开启向导" [disabled] [ref=f1e222]
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
> 9  |   await expect(page.getByRole('option').filter({ hasText: '独立部门报告' })).toBeVisible(); await page.getByRole('option').filter({ hasText: '独立部门报告' }).click();
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
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
  35 |     const added = await request.post('/api/dashboards', { headers: projectIdentity, data: { projectId: source.projectId, version: board.dashboards[0].version, layout: { kind: 'project_board', version: 1, query: { from: '2026-10-01', to: '2026-10-02', filters: [{ key: '渠道', value: '门店' }] } }, cards: [...sourceCards, { title: '本项目咨询目标', type: 'progress_card', config: { metricId: reference, target: 600, targetMetricVersion: 1 } }] } }); expect(added.status()).toBe(200);
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
  46 |     expect(JSON.parse(current.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(1200); expect(configs.every((card: { metricId: string }) => card.metricId.startsWith(targetId + ':structure:'))).toBeTruthy(); expect(configs.every((card: { from?: string; to?: string }) => !card.from && !card.to)).toBeTruthy();
  47 |     expect(JSON.parse(current.dashboards[0].layoutJson).query).toEqual({});
  48 |     const amount = page.getByRole('article', { name: '咨询人数合计', exact: true }); await expect(amount).toContainText('600');
  49 |     await page.screenshot({ path: info.outputPath('new-project-published-own-results.png'), fullPage: true });
  50 |     const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId: targetId } }); expect(generated.status()).toBe(200);
  51 |     await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId: targetId, userId: 'user-viewer', role: 'viewer' } }); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + targetId + '/reports');
  52 |     await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('600'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('reused-project-viewer-report.png'), fullPage: true });
  53 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  54 |     const original = await (await request.get('/api/dashboards?projectId=' + source.projectId, { headers: projectIdentity })).json(); expect(JSON.parse(original.cards.find((card: { title: string }) => card.title === '本项目咨询目标').configJson).target).toBe(600);
  55 |   });
  56 | }
  57 | 
```