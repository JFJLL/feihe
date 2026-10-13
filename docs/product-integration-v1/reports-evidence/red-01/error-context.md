# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-reports.spec.ts >> 报告断链反例：四列原表看板发布后，经页面进入同口径项目报告
- Location: tests\browser\product-reports.spec.ts:4:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: '查看项目报告', exact: true })

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
        - generic [ref=e16]: 独立部门报告1791920368467
      - paragraph [ref=e20]: 品牌未设置 · 独立部门报告1791920368467 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/1791920368467
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/1791920368467/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/1791920368467/metrics
        - generic [ref=e29]: "03"
      - link "项目设置" [ref=e31] [cursor=pointer]:
        - /url: /projects/1791920368467/settings
        - generic [ref=e32]: "05"
    - generic [ref=e34]:
      - text: 项目资料已连接
      - generic [ref=e36]: 业务编辑者(张晓) · 2026/10/14 03:39:28
  - main [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - text: PROJECT DASHBOARD · 通用数据工作台
          - heading "独立部门报告1791920368467" [level=1] [ref=e42]
          - paragraph [ref=e43]: 市场与营销部 · 结构化数据集与度量监控看板
        - button "同步最新数据" [ref=e47] [cursor=pointer]
      - region "首次设置" [ref=e51]:
        - generic [ref=e52]:
          - generic [ref=e53]:
            - generic [ref=e54]: 首次设置 · 通用数据工作台
            - heading "下一步：确认指标与第一份看板" [level=2] [ref=e55]
            - paragraph [ref=e56]: 先得到可核对的指标，再选择趋势、分组或明细。已有设置会保留。
          - button "查看看板与配置 →" [ref=e57] [cursor=pointer]
        - generic [ref=e58]:
          - button "单人跳过" [ref=e59] [cursor=pointer]
          - button "完成初始化（发布项目）" [disabled] [ref=e60]
          - button "稍后配置" [ref=e61] [cursor=pointer]
        - group [ref=e62]:
          - generic "查看设置进度与团队选项" [ref=e63]
      - generic [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e68]: "当前业务数据集:"
            - combobox "当前业务数据集" [ref=e70] [cursor=pointer]:
              - generic [ref=e71]: 补修数据 (2 行)
          - generic [ref=e74]:
            - generic [ref=e75]:
              - button "📊 看板视图" [ref=e76] [cursor=pointer]
              - button "📋 数据明细 (2 行)" [ref=e77] [cursor=pointer]
            - button "⚙ 自定义看板卡片" [ref=e78] [cursor=pointer]
        - region "项目周期与共同筛选" [ref=e79]:
          - generic [ref=e80]:
            - generic [ref=e81]:
              - text: 开始日期
              - textbox "项目开始日期" [ref=e82]
            - generic [ref=e83]:
              - text: 结束日期
              - textbox "项目结束日期" [ref=e84]
            - generic [ref=e85]:
              - text: 共同筛选字段
              - combobox "共同筛选字段" [ref=e87] [cursor=pointer]:
                - generic [ref=e88]: 不筛选
            - button "清除周期与筛选" [ref=e91] [cursor=pointer]
          - paragraph [ref=e92]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
        - generic [ref=e94]:
          - article "记录数量" [ref=e95]:
            - generic [ref=e96]:
              - generic [ref=e97]: 记录数量
              - generic [ref=e99]: "2"
            - generic [ref=e100]:
              - generic [ref=e101]: "来源: 补修数据"
              - generic [ref=e102]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e103]: "有效样本: 2 行"
              - generic [ref=e104]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "咨询人数合计" [ref=e105]:
            - generic [ref=e106]:
              - generic [ref=e107]: 咨询人数合计
              - generic [ref=e109]: "300"
            - generic [ref=e110]:
              - generic [ref=e111]: "来源: 补修数据"
              - generic [ref=e112]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e113]: "有效样本: 2 行"
              - generic [ref=e114]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交人数合计" [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: 成交人数合计
              - generic [ref=e119]: "30"
            - generic [ref=e120]:
              - generic [ref=e121]: "来源: 补修数据"
              - generic [ref=e122]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e123]: "有效样本: 2 行"
              - generic [ref=e124]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率" [ref=e125]:
            - generic [ref=e126]:
              - generic [ref=e127]: 成交率
              - generic [ref=e129]: 10.0%
            - generic [ref=e130]:
              - generic [ref=e131]: "来源: 补修数据"
              - generic [ref=e132]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e133]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e134]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率趋势" [ref=e135]:
            - generic [ref=e136]:
              - generic [ref=e137]: 成交率趋势
              - generic [ref=e139]: 10.0%
              - generic [ref=e140]:
                - generic [ref=e141]:
                  - generic [ref=e142]:
                    - strong [ref=e143]: 2026-10-02
                    - generic [ref=e144]:
                      - text: 成交率
                      - generic [ref=e146]: 5.0%
                  - img "成交率趋势时间趋势" [ref=e147]:
                    - generic [ref=e148]: 0.0%
                    - generic [ref=e150]: 5.0%
                    - generic [ref=e152]: 10.0%
                    - generic [ref=e154]: 15.0%
                    - generic [ref=e156]: 20.0%
                    - generic [ref=e159]:
                      - generic "2026-10-01 成交率 20.0%" [ref=e161]
                      - generic "2026-10-02 成交率 5.0%" [ref=e162]
                    - 'button "2026-10-01 成交率: 20.0%" [ref=e163]'
                    - 'button "2026-10-02 成交率: 5.0%" [ref=e164]'
                    - generic [ref=e165]: 10-01
                    - generic [ref=e166]: 10-02
                - group [ref=e167]:
                  - generic "查看每日数值与样本" [ref=e168] [cursor=pointer]
            - generic [ref=e169]:
              - generic [ref=e170]: "来源: 补修数据"
              - generic [ref=e171]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e172]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e173]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
          - article "成交率按渠道" [ref=e174]:
            - generic [ref=e175]:
              - generic [ref=e176]: 成交率按渠道
              - generic [ref=e178]: 10.0%
              - generic [ref=e179]:
                - generic [ref=e180]:
                  - generic [ref=e181]: 门店
                  - strong [ref=e182]:
                    - text: 20.0%
                    - generic [ref=e183]: (1)
                  - generic [ref=e184]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
                - generic [ref=e185]:
                  - generic [ref=e186]: 线上
                  - strong [ref=e187]:
                    - text: 5.0%
                    - generic [ref=e188]: (1)
                  - generic [ref=e189]: 成对口径 · 成对有效 1 行 · 分子有效 1/1（100.0%） · 分母有效 1/1（100.0%）
            - generic [ref=e190]:
              - generic [ref=e191]: "来源: 补修数据"
              - generic [ref=e192]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e193]: 成对口径 · 成对有效 2 行 · 分子有效 2/2（100.0%） · 分母有效 2/2（100.0%）
              - generic [ref=e194]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
      - generic [ref=e195]:
        - generic [ref=e197]:
          - generic [ref=e198]: AI 复盘
          - heading "基于项目数据生成运营报告" [level=3] [ref=e199]
        - generic [ref=e200]:
          - textbox "报告需求" [ref=e201]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
          - button "生成复盘报告" [ref=e202] [cursor=pointer]
  - button "打开智能助手" [ref=e203] [cursor=pointer]:
    - generic [ref=e205]: 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';
  3  | 
  4  | test('报告断链反例：四列原表看板发布后，经页面进入同口径项目报告', async ({ page, request }, info) => {
  5  |   await connectProjectTable(page, request, 'general_workbench', consultationRows);
  6  |   await publishRecommendedBoard(page);
  7  |   await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('300');
  8  |   await page.screenshot({ path: info.outputPath('published-board-without-report-path.png'), fullPage: true });
> 9  |   await page.getByRole('link', { name: '查看项目报告', exact: true }).click();
     |                                                                 ^ Error: locator.click: Test timeout of 60000ms exceeded.
  10 |   await expect(page.getByRole('heading', { name: '项目报告', exact: true })).toBeVisible();
  11 | });
  12 | test('报告取数反例：已有生成接口消费真实共享咨询指标，而非空社媒记录', async ({ page, request }, info) => {
  13 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  14 |   await publishRecommendedBoard(page);
  15 |   const generated = await request.post('/api/agent', { headers: projectIdentity, data: { projectId, prompt: '查看咨询人数和成交率' } });
  16 |   expect(generated.status()).toBe(200); const report = await generated.json();
  17 |   await info.attach('报告真实响应', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  18 |   expect(report.spec.kpis.find((k: { label: string }) => k.label === '咨询人数合计')?.value).toBe('300');
  19 |   expect(report.spec.metrics.some((m: { metricId: string }) => m.metricId && m.title === '成交率')).toBeTruthy();
  20 | });
  21 | 
```