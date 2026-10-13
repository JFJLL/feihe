# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-adapters.spec.ts >> 字段推荐反例：陌生四列表接入后可以经真实控件确认适用的指标和看板
- Location: tests\browser\product-adapters.spec.ts:23:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '推荐指标与看板', exact: true })

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
        - generic [ref=e16]: 字段驱动接入1791916777847
      - paragraph [ref=e20]: 品牌未设置 · 字段驱动接入1791916777847 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791916777847
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791916777847/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791916777847/metrics
        - generic [ref=e29]: "03"
      - link "项目设置" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791916777847/settings
        - generic [ref=e32]: "05"
    - generic [ref=e34]:
      - text: 项目资料已连接
      - generic [ref=e36]: 业务编辑者(张晓) · 2026/10/14 02:39:38
  - main [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - heading "数据工作台" [level=1] [ref=e42]
          - paragraph [ref=e43]: 从原表接入，到可核对的项目数据。飞书记录仍在原表编辑。
        - button "刷新数据状态" [ref=e45] [cursor=pointer]
      - tablist "模块切换" [ref=e46]:
        - tab "数据源" [ref=e47] [cursor=pointer]
        - tab "数据集" [active] [selected] [ref=e49] [cursor=pointer]
        - tab "同步记录" [ref=e51] [cursor=pointer]
      - generic [ref=e53]:
        - generic [ref=e54]:
          - heading "数据集明细" [level=2] [ref=e55]
          - combobox "业务数据集" [ref=e57] [cursor=pointer]:
            - generic [ref=e58]: 补修数据 · 2 行
        - generic [ref=e61]:
          - paragraph [ref=e62]: 来源：补修数据 · 已入库 2 行 · 数据版本 v1
          - paragraph [ref=e63]: 数据更新时间：2026/10/14 02:39:41
          - paragraph [ref=e64]: 自动同步未启用；当前需手动同步
          - link "在飞书原表修改记录" [ref=e65] [cursor=pointer]:
            - /url: https://fixture.feishu.cn/sheets/Adapter-1791916777847
        - generic [ref=e66]:
          - generic [ref=e67]:
            - text: 搜索数据明细
            - textbox "搜索数据明细" [ref=e68]:
              - /placeholder: 在当前数据集中搜索
          - button "字段与质量检查" [ref=e69] [cursor=pointer]
          - link "查看项目看板" [ref=e70] [cursor=pointer]:
            - /url: /projects/1791916777847
        - table "业务数据明细" [ref=e72]:
          - rowgroup [ref=e73]:
            - row [ref=e74]:
              - columnheader "日期" [ref=e75]
              - columnheader "渠道" [ref=e76]
              - columnheader "咨询人数" [ref=e77]
              - columnheader "成交人数" [ref=e78]
          - rowgroup [ref=e79]:
            - row [ref=e80]:
              - cell "2026-10-01" [ref=e81]
              - cell "门店" [ref=e82]
              - cell "100" [ref=e83]
              - cell "20" [ref=e84]
            - row [ref=e85]:
              - cell "2026-10-02" [ref=e86]
              - cell "线上" [ref=e87]
              - cell "200" [ref=e88]
              - cell "10" [ref=e89]
        - generic [ref=e90]:
          - generic [ref=e91]: 第 1 / 1 页 · 匹配 2 行
          - generic [ref=e92]:
            - button "上一页" [disabled] [ref=e93]
            - button "下一页" [disabled] [ref=e94]
        - heading "正在使用此数据集" [level=3] [ref=e95]
        - paragraph [ref=e96]: 尚无绑定的指标或卡片。
        - button "创建指标" [ref=e97] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import type { Page, APIRequestContext } from '@playwright/test';
  3  | const identity = { 'x-user-id': 'user-editor' };
  4  | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  5  | async function connect(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  6  |   await page.context().setExtraHTTPHeaders(identity);
  7  |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '字段驱动接入' + Date.now(), templateId } });
  8  |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  9  |   const token = 'Adapter-' + projectId;
  10 |   expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  11 |   await page.goto('/projects/' + projectId + '/data');
  12 |   await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  13 |   await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  14 |   await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  15 |   await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  16 |   const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  17 |   await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  18 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  19 |   await page.getByRole('tab', { name: '数据集', exact: true }).click();
  20 |   await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][2]));
  21 |   return { projectId, token };
  22 | }
  23 | test('字段推荐反例：陌生四列表接入后可以经真实控件确认适用的指标和看板', async ({ page, request }, info) => {
  24 |   const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
  25 |   await page.screenshot({ path: info.outputPath('no-field-recommendation.png'), fullPage: true });
> 26 |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
     |                                                                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
  27 |   await expect(page.getByRole('dialog')).toContainText('成交率');
  28 |   await expect(page.getByRole('dialog')).not.toContainText('预算执行率');
  29 |   await expect(page.getByRole('dialog')).not.toContainText('任务完成率');
  30 |   expect((await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json()).datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(['日期', '渠道', '咨询人数', '成交人数']);
  31 | });
  32 | test('投放断链反例：五列新来源真实入库后专属投放消耗显示本项目300', async ({ page, request }, info) => {
  33 |   const { projectId } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
  34 |   await page.goto('/projects/' + projectId);
  35 |   const overview = page.getByTestId('ad-performance-overview');
  36 |   await expect(overview).toBeVisible(); await page.screenshot({ path: info.outputPath('imported-ad-dataset-disconnected.png'), fullPage: true });
  37 |   await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
  38 | });
  39 | 
```