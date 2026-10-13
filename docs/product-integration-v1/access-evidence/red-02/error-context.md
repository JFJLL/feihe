# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-access.spec.ts >> 撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者
- Location: tests\browser\product-access.spec.ts:19:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 200
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
        - generic [ref=e16]: 独立部门报告1791924958325
      - paragraph [ref=e20]: 品牌未设置 · 独立部门报告1791924958325 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791924958325
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791924958325/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791924958325/metrics
        - generic [ref=e29]: "03"
      - link "报告" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791924958325/reports
        - generic [ref=e32]: "04"
      - link "项目设置" [ref=e34] [cursor=pointer]:
        - /url: /projects/1791924958325/settings
        - generic [ref=e35]: "05"
    - generic [ref=e37]:
      - text: 项目资料已连接
      - generic [ref=e39]: 业务编辑者(张晓) · 2026/10/14 04:55:58
  - main [ref=e40]:
    - generic [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]:
          - text: PROJECT DASHBOARD · 通用数据工作台
          - heading "独立部门报告1791924958325" [level=1] [ref=e45]
          - paragraph [ref=e46]: 市场与营销部 · 结构化数据集与度量监控看板
        - button "同步最新数据" [ref=e50] [cursor=pointer]
      - region "首次设置" [ref=e54]:
        - generic [ref=e55]:
          - generic [ref=e56]:
            - generic [ref=e57]: 首次设置 · 通用数据工作台
            - heading "下一步：确认指标与第一份看板" [level=2] [ref=e58]
            - paragraph [ref=e59]: 先得到可核对的指标，再选择趋势、分组或明细。已有设置会保留。
          - button "查看看板与配置 →" [ref=e60] [cursor=pointer]
        - generic [ref=e61]:
          - button "单人跳过" [ref=e62] [cursor=pointer]
          - button "完成初始化（发布项目）" [disabled] [ref=e63]
          - button "稍后配置" [ref=e64] [cursor=pointer]
        - group [ref=e65]:
          - generic "查看设置进度与团队选项" [ref=e66]
      - generic [ref=e68]:
        - generic [ref=e69]:
          - generic [ref=e70]:
            - generic [ref=e71]: "当前业务数据集:"
            - combobox "当前业务数据集" [ref=e73] [cursor=pointer]:
              - generic [ref=e74]: 补修数据 (2 行)
          - generic [ref=e77]:
            - generic [ref=e78]:
              - button "📊 看板视图" [ref=e79] [cursor=pointer]
              - button "📋 数据明细 (2 行)" [ref=e80] [cursor=pointer]
            - link "查看项目报告" [ref=e81] [cursor=pointer]:
              - /url: /projects/1791924958325/reports?query=%7B%7D
            - button "⚙ 自定义看板卡片" [ref=e82] [cursor=pointer]
        - region "项目周期与共同筛选" [ref=e83]:
          - generic [ref=e84]:
            - generic [ref=e85]:
              - text: 开始日期
              - textbox "项目开始日期" [ref=e86]
            - generic [ref=e87]:
              - text: 结束日期
              - textbox "项目结束日期" [ref=e88]
            - generic [ref=e89]:
              - text: 共同筛选字段
              - combobox "共同筛选字段" [ref=e91] [cursor=pointer]:
                - generic [ref=e92]: 不筛选
            - button "清除周期与筛选" [ref=e95] [cursor=pointer]
          - paragraph [ref=e96]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
        - generic [ref=e98]:
          - article "记录数量" [ref=e99]:
            - generic [ref=e100]:
              - generic [ref=e101]: 记录数量
              - generic [ref=e103]: "2"
            - generic [ref=e104]:
              - generic [ref=e105]: "来源: 补修数据"
              - generic [ref=e106]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e107]: "有效样本: 2 行"
              - generic [ref=e108]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "咨询人数合计" [ref=e109]:
            - generic [ref=e110]:
              - generic [ref=e111]: 咨询人数合计
              - generic [ref=e113]: "300"
            - generic [ref=e114]:
              - generic [ref=e115]: "来源: 补修数据"
              - generic [ref=e116]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e117]: "有效样本: 2 行"
              - generic [ref=e118]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交人数合计" [ref=e119]:
            - generic [ref=e120]:
              - generic [ref=e121]: 成交人数合计
              - generic [ref=e123]: "30"
            - generic [ref=e124]:
              - generic [ref=e125]: "来源: 补修数据"
              - generic [ref=e126]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e127]: "有效样本: 2 行"
              - generic [ref=e128]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率" [ref=e129]:
            - generic [ref=e130]:
              - generic [ref=e131]: 成交率
              - generic [ref=e133]: 10.0%
            - generic [ref=e134]:
              - generic [ref=e135]: "来源: 补修数据"
              - generic [ref=e136]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e137]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e138]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率趋势" [ref=e139]:
            - generic [ref=e140]:
              - generic [ref=e141]: 成交率趋势
              - generic [ref=e143]: 10.0%
              - generic [ref=e144]:
                - generic [ref=e145]:
                  - generic [ref=e146]:
                    - strong [ref=e147]: 2026-10-02
                    - generic [ref=e148]:
                      - text: 成交率
                      - generic [ref=e150]: 5.0%
                  - img "成交率趋势时间趋势" [ref=e151]:
                    - generic [ref=e152]: 0.0%
                    - generic [ref=e154]: 5.0%
                    - generic [ref=e156]: 10.0%
                    - generic [ref=e158]: 15.0%
                    - generic [ref=e160]: 20.0%
                    - generic [ref=e163]:
                      - generic "2026-10-01 成交率 20.0%" [ref=e165]
                      - generic "2026-10-02 成交率 5.0%" [ref=e166]
                    - 'button "2026-10-01 成交率: 20.0%" [ref=e167]'
                    - 'button "2026-10-02 成交率: 5.0%" [ref=e168]'
                    - generic [ref=e169]: 10-01
                    - generic [ref=e170]: 10-02
                - group [ref=e171]:
                  - generic "查看每日数值与样本" [ref=e172] [cursor=pointer]
            - generic [ref=e173]:
              - generic [ref=e174]: "来源: 补修数据"
              - generic [ref=e175]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e176]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e177]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率按渠道" [ref=e178]:
            - generic [ref=e179]:
              - generic [ref=e180]: 成交率按渠道
              - generic [ref=e182]: 10.0%
              - generic [ref=e183]:
                - generic [ref=e184]:
                  - generic [ref=e185]: 门店
                  - strong [ref=e186]:
                    - text: 20.0%
                    - generic [ref=e187]: (1)
                  - generic [ref=e188]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
                - generic [ref=e189]:
                  - generic [ref=e190]: 线上
                  - strong [ref=e191]:
                    - text: 5.0%
                    - generic [ref=e192]: (1)
                  - generic [ref=e193]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
            - generic [ref=e194]:
              - generic [ref=e195]: "来源: 补修数据"
              - generic [ref=e196]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e197]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e198]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
  - button "打开智能助手" [ref=e199] [cursor=pointer]:
    - generic [ref=e201]: 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';
  3  | 
  4  | test('页面权限反例：原身份真实缓存后，无成员的新身份不能挂载项目私有页面', async ({ page, request }, info) => {
  5  |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  6  |   await publishRecommendedBoard(page);
  7  |   const privateName = '隔离访问项目' + projectId;
  8  |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, name: privateName } })).status()).toBe(200);
  9  |   await page.reload(); await expect(page.getByRole('heading', { name: privateName, exact: true })).toBeVisible();
  10 |   await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes('project-data:')));
  11 |   await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' });
  12 |   expect((await request.get('/api/datasets?projectId=' + projectId, { headers: { 'x-user-id': 'user-viewer' } })).status()).toBe(403);
  13 |   await page.goto('/projects/' + projectId + '/data');
  14 |   await page.screenshot({ path: info.outputPath('cached-project-unauthorized-entry.png'), fullPage: true });
  15 |   await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  16 |   await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  17 |   await expect(page.getByRole('navigation', { name: '项目模块', exact: true })).toHaveCount(0);
  18 | });
  19 | test('撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者', async ({ page, request }, info) => {
  20 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  21 |   const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId } }); expect(generated.status()).toBe(200); const reportId = (await generated.json()).reportId;
  22 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  23 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, ownerId: 'user-project-manager' } })).status()).toBe(200);
  24 |   const manager = { 'x-user-id': 'user-project-manager' };
  25 |   expect((await request.post('/api/projects', { headers: manager, data: { action: 'remove_member', projectId, userId: 'user-editor' } })).status()).toBe(200);
  26 |   const denied = await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity });
  27 |   await info.attach('创建者撤权后的真实报告响应', { body: JSON.stringify({ status: denied.status(), body: await denied.json() }), contentType: 'application/json' });
> 28 |   expect(denied.status()).toBe(403);
     |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  29 |   expect((await request.get('/api/report-html?projectId=' + projectId + '&id=' + reportId, { headers: projectIdentity })).status()).toBe(403);
  30 |   await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  31 |   await page.screenshot({ path: info.outputPath('revoked-creator-denied.png') });
  32 | });
  33 | 
```