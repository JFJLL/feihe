# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: state.spec.ts >> 评论质检与投放分析进入各自业务主体，数据导航URL和标签一致
- Location: tests\browser\state.spec.ts:144:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '评论运营', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '评论运营', exact: true }) with timeout 10000ms
  - waiting for getByRole('heading', { name: '评论运营', exact: true })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: comment_qc
    - img
  - paragraph: 品牌未设置 · comment_qc · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/template-comment_qc-179193604839
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/template-comment_qc-179193604839/data
      - text: 02 数据管理
    - link "指标":
      - /url: /projects/template-comment_qc-179193604839/metrics
      - text: 03 指标
    - link "评论运营":
      - /url: /projects/template-comment_qc-179193604839/comments
      - text: 04 评论运营
    - link "报告":
      - /url: /projects/template-comment_qc-179193604839/reports
      - text: 05 报告
    - link "项目设置":
      - /url: /projects/template-comment_qc-179193604839/settings
      - text: 06 项目设置
  - text: 项目资料已连接 平台管理员 · 2026/10/14 08:00:48
- main:
  - text: COMMENT QC · 评论口碑质检看板
  - heading "comment_qc" [level=1]
  - paragraph: 本项目评论记录、来源标注与处置状态
  - button "同步最新数据"
  - region "首次设置":
    - text: 首次设置 · 评论质检项目
    - heading "下一步：接入自己的业务表" [level=2]
    - paragraph: 保留飞书原表，不必添加任务、预算或负责人列。接入后按实际字段选择适用的分析。
    - link "接入飞书数据源 →":
      - /url: /projects/template-comment_qc-179193604839/settings?tab=data-sources
    - button "单人跳过"
    - button "完成初始化（发布项目）" [disabled]
    - button "稍后配置"
    - group: 查看设置进度与团队选项
  - text: ∅
  - heading "先确认本项目评论表" [level=3]
  - paragraph: 需要评论内容；评论编号、日期、来源情感和处置状态可选。接入后确认字段与推荐指标，评论分析将使用这张表。
  - link "确认来源与指标":
    - /url: /projects/template-comment_qc-179193604839/data?tab=datasets&purpose=comment
  - paragraph: 外部采集与自动处置尚未配置；接入表格不会自动启用这些能力。
  - text: 团队看板
  - heading "项目指标与图表" [level=3]
  - text: "当前业务数据集: 暂无导入数据集"
  - button "📊 看板视图"
  - button "📋 数据明细 (0 行)"
  - button "⚙ 自定义看板卡片"
  - text: ∅
  - heading "当前项目尚未接入通用数据集" [level=3]
  - paragraph: 接入业务表后，选择适用的指标与图表。飞书原表保持不变。
  - link "前往接入数据源 →":
    - /url: /projects/template-comment_qc-179193604839/settings?tab=data-sources
- button "打开智能助手": 智
```

# Test source

```ts
  55  |   await expect(page.getByRole('alert')).toContainText('试算失败证据');
  56  |   await expect(preview.locator('span')).toHaveCount(0);
  57  |   await expect(page.getByRole('button', { name: '保存并加入看板' })).toBeDisabled();
  58  |   expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('原始任务总数');
  59  | });
  60  | 
  61  | test('数据集迟到响应、搜索和金额显示名均使用当前内容和存储key', async ({ page, request }) => {
  62  |   const { projectId, datasetA } = await setup(request);
  63  |   expect((await request.post('/api/datasets', { data: { projectId, sourceId: 'b', name: '任务数据B', rows: [{ task: '最新B', amount: 100 }], columns: [{ key: 'task', name: '任务', type: 'text' }, { key: 'amount', name: '金额', type: 'number' }] } })).ok()).toBeTruthy();
  64  |   await page.goto(`/projects/${projectId}`);
  65  |   await selectDataset(page, '任务数据B');
  66  |   await page.getByRole('button', { name: /数据明细/ }).click();
  67  |   await expect(page.getByRole('columnheader', { name: '金额', exact: true })).toBeVisible();
  68  |   await expect(page.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  69  |   await page.route('**/api/datasets?**', async route => {
  70  |     const url = new URL(route.request().url());
  71  |     if (url.searchParams.get('id') === datasetA.id || url.searchParams.get('search') === '旧搜索') {
  72  |       const actual = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 700));
  73  |       await route.fulfill({ response: actual }).catch(() => {});
  74  |     } else await route.continue();
  75  |   });
  76  |   await selectDataset(page, '任务数据A');
  77  |   await selectDataset(page, '任务数据B');
  78  |   await page.getByPlaceholder('全量搜索记录关键字…').fill('旧搜索');
  79  |   await page.getByPlaceholder('全量搜索记录关键字…').fill('最新B');
  80  |   await expect(page.getByRole('cell', { name: '最新B', exact: true })).toBeVisible();
  81  |   await page.waitForTimeout(900);
  82  |   await expect(page.getByRole('cell', { name: '最新B', exact: true })).toBeVisible();
  83  |   await expect(page.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  84  |   await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('任务数据B');
  85  | });
  86  | 
  87  | test('数据更新使当前页越界时自动校正重读，同时保留编辑草稿', async ({ page, request }) => {
  88  |   const { projectId } = await setup(request);
  89  |   const sourceId = projectId + '-page';
  90  |   const documentToken = 'PageDoc' + projectId;
  91  |   expect((await request.post((process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187') + '/__fixture/page-sheet', { data: { documentToken, rowCount: 31 } })).ok()).toBeTruthy();
  92  |   expect((await request.post('/api/projects', { data: { action: 'save_source', projectId, id: sourceId, name: '分页业务', spreadsheet: 'https://fixture.feishu.cn/sheets/' + documentToken, sheetId: 'sheetA', kind: 'general', mappingJson: JSON.stringify([{ sourceField: '任务', targetField: 'task', type: 'text' }, { sourceField: '金额', targetField: 'amount', type: 'number' }]) } })).ok()).toBeTruthy();
  93  |   expect((await request.post('/api/feishu/sync', { data: { projectId, sourceId } })).ok()).toBeTruthy();
  94  |   await page.goto(`/projects/${projectId}`);
  95  |   await selectDataset(page, '分页业务');
  96  |   await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('分页业务 (31 行)');
  97  |   await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  98  |   await page.getByTitle('编辑卡片', { exact: true }).click();
  99  |   await page.getByLabel('卡片标题', { exact: true }).fill('分页刷新草稿');
  100 |   await page.getByRole('button', { name: '保存并加入看板' }).click();
  101 |   await page.getByRole('button', { name: /数据明细/ }).click();
  102 |   await page.getByRole('button', { name: '下一页', exact: true }).click();
  103 |   await expect(page.getByText('共 31 条记录 · 第 2 / 3 页')).toBeVisible();
  104 |   await page.getByRole('button', { name: '下一页', exact: true }).click();
  105 |   await expect(page.getByRole('cell', { name: '分页任务31', exact: true })).toBeVisible();
  106 |   // Change only the external vendor fixture, then use the real page sync button.
  107 |   expect((await request.post((process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187') + '/__fixture/page-sheet', { data: { documentToken, rowCount: 1 } })).ok()).toBeTruthy();
  108 |   await page.getByRole('button', { name: '同步最新数据', exact: true }).click();
  109 |   await expect(page.getByText('共 1 条记录 · 第 1 / 1 页')).toBeVisible();
  110 |   await expect(page.getByRole('cell', { name: '更新后唯一任务', exact: true })).toBeVisible();
  111 |   await page.getByRole('button', { name: '📊 看板视图', exact: true }).click();
  112 |   await expect(page.getByText('分页刷新草稿', { exact: true })).toBeVisible();
  113 |   await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeVisible();
  114 |   expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('原始任务总数');
  115 | });
  116 | 
  117 | test('保存中冻结快照且重复操作只提交一次真实请求', async ({ page, request }) => {
  118 |   const { projectId } = await setup(request);
  119 |   await page.goto(`/projects/${projectId}`);
  120 |   await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  121 |   await page.getByTitle('编辑卡片', { exact: true }).click();
  122 |   await page.getByLabel('卡片标题', { exact: true }).fill('单次冻结快照');
  123 |   await page.getByRole('button', { name: '保存并加入看板' }).click();
  124 |   let submissions = 0;
  125 |   let release!: () => void;
  126 |   const gate = new Promise<void>(resolve => { release = resolve; });
  127 |   await page.route('**/api/dashboards', async route => {
  128 |     if (route.request().method() !== 'POST') return route.continue();
  129 |     submissions++; await gate; await route.continue();
  130 |   });
  131 |   await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  132 |   await expect(page.getByRole('button', { name: '正在发布…' })).toBeDisabled();
  133 |   await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeDisabled();
  134 |   await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toBeDisabled();
  135 |   await expect(page.getByTitle('编辑卡片', { exact: true })).toHaveCount(0);
  136 |   expect(submissions).toBe(1);
  137 |   release();
  138 |   await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  139 |   expect(submissions).toBe(1);
  140 |   const stored = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  141 |   expect(stored[0].title).toBe('单次冻结快照');
  142 | });
  143 | 
  144 | test('评论质检与投放分析进入各自业务主体，数据导航URL和标签一致', async ({ page, request }) => {
  145 |   for (const templateId of ['comment_qc', 'ad_performance']) {
  146 |     const created = await request.post('/api/projects', { data: { action: 'create', id: `template-${templateId}-${Date.now()}`, name: templateId, templateId } });
  147 |     expect(created.ok()).toBeTruthy();
  148 |     const projectId = (await created.json()).id;
  149 |     await page.goto(`/projects/${projectId}`);
  150 |     if (templateId === 'ad_performance') {
  151 |       await expect(page.getByTestId('ad-performance-overview')).toBeVisible();
  152 |       await expect(page.getByRole('heading', { name: '广告消耗趋势' })).toBeVisible();
  153 |       await expect(page.getByRole('heading', { name: '投放点击效率' })).toBeVisible();
  154 |     } else {
> 155 |       await expect(page.getByRole('heading', { name: '评论运营', exact: true })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  156 |       await expect(page.getByRole('heading', { name: '消费者反馈情感结构' })).toBeVisible();
  157 |       await page.getByRole('button', { name: '前往处置工作台查看与闭环评论 →' }).click();
  158 |       await expect(page.getByRole('heading', { name: /处置/ }).first()).toBeVisible();
  159 |     }
  160 |     await expect(page.getByText('决策层 · 今日指标与待办', { exact: true })).toHaveCount(0);
  161 |   }
  162 |   const { projectId } = await setup(request);
  163 |   await page.goto(`/projects/${projectId}`);
  164 |   await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).waitFor();
  165 |   await page.getByRole('link', { name: '数据管理', exact: true }).click();
  166 |   await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/data$`));
  167 |   await expect(page.getByRole('heading', { name: '数据工作台', exact: true })).toBeVisible();
  168 |   await expect(page.getByRole('tab', { name: '数据源', exact: true })).toHaveAttribute('aria-selected', 'true');
  169 |   await expect(page.getByRole('link', { name: '数据管理', exact: true })).toHaveAttribute('aria-current', 'page');
  170 |   await expect(page.getByRole('link', { name: '项目设置', exact: true })).not.toHaveAttribute('aria-current', 'page');
  171 | });
  172 | 
```