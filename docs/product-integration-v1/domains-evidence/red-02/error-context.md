# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-domains.spec.ts >> 评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态
- Location: tests\browser\product-domains.spec.ts:9:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('comment-domain-overview').locator('.ops-metric-card').filter({ hasText: '评论记录数' })
Expected substring: "3"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByTestId('comment-domain-overview').locator('.ops-metric-card').filter({ hasText: '评论记录数' }) with timeout 10000ms
  - waiting for getByTestId('comment-domain-overview').locator('.ops-metric-card').filter({ hasText: '评论记录数' })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: 独立部门报告1791933259781
    - img
  - paragraph: 品牌未设置 · 独立部门报告1791933259781 · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791933259781
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/1791933259781/data
      - text: 02 数据管理
    - link "指标":
      - /url: /projects/1791933259781/metrics
      - text: 03 指标
    - link "评论运营":
      - /url: /projects/1791933259781/comments
      - text: 04 评论运营
    - link "报告":
      - /url: /projects/1791933259781/reports
      - text: 05 报告
    - link "项目设置":
      - /url: /projects/1791933259781/settings
      - text: 06 项目设置
  - text: 项目资料已连接 业务编辑者(张晓) · 2026/10/14 07:14:19
- main:
  - text: FEIHE · Q3 COMMENTS
  - heading "评论运营" [level=1]
  - text: 0 已确认外显 · 0 风险待办
  - paragraph: 2026年 Q3 · 小红书口碑分析、评论采集、风险处置与供应商核验
  - button "同步最新数据"
  - tablist "模块切换":
    - tab "口碑与处置 0.0% · 0待办" [selected]
    - tab "采集监测 0"
    - tab "交付验收 0"
    - tab "供应商核验 0"
    - tab "执行总览 0"
  - tabpanel "口碑与处置 0.0% · 0待办":
    - button "口碑大盘" [pressed]
    - button "待办处置清单 (0)"
    - article: 正向口碑率 口碑定调 — 高好评赞誉占比 暂无监测评论，暂不判断口碑
    - article: 正向好评评论 正向沉淀 0 条 已识别为正向的评论 暂无正向主题分类
    - article: 负向风险评论 风险监控 0 条 需闭环处置的负面舆情 暂无负向主题分类
    - article: 决策问询评论 转化契机 0 条 已识别为问询的评论 购买前核心决策阻力
    - text: 口碑结构
    - heading "消费者反馈情感结构" [level=3]
    - text: 分析评论总体的情感极性分布与正中负问构成。鼠标悬停查看各情感占比。
    - img
    - strong: —
    - text: 正向口碑 正向好评
    - strong: "0"
    - text: 0.0% 中立讨论
    - strong: "0"
    - text: 0.0% 购买问询
    - strong: "0"
    - text: 0.0% 负向风险
    - strong: "0"
    - text: 0.0% 动态走势
    - heading "口碑趋势动态走势" [level=3]
    - text: 仅显示真实抓取快照；不同日期的监测笔记范围可能不同，数值不是每日新增评论。 真实历史快照不足，暂不展示趋势。积累至少 3 个观测日期后显示。 话题分析
    - heading "动态话题分类与分布" [level=3]
    - text: 基于关键词与 NLP 提炼的评论话题聚类。鼠标悬停查看各分类条数与占比。 暂无关键评论主题分类 消费者洞察
    - heading "口碑核心结论与闭环" [level=3]
    - text: 对高频好评、风险焦点与决策问询的策略性提炼。 ✓ 核心正向体验 暂无可用的正向主题样本，暂不生成结论。 ⚠ 问题与风险焦点 暂无可用的负向主题样本，不能据此判断风险已消除。 💡 购买决策问询 问询占 0.0%，建议按产品适用、使用效果与价格服务分流承接，促成种草拔草。
    - button "前往处置工作台查看与闭环评论 →"
    - text: 行动闭环
    - heading "评论处置与风险闭环进度" [level=3]
    - text: 全盘追踪风险评论的达人回复、删除下架与消失态闭环率。 整体闭环率 — 已处置完成比例 已闭环处理 0 处理完成条数 待达人回复 0 引导达人介入 待删除 0 违规/黑产删除 已自然消失 0 博主自删或系统屏蔽
- button "打开智能助手": 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard } from './product-journey';
  3  | 
  4  | test('内容断链反例：页面接入自己的内容表后，内容页显示真实3000阅读和两条业务记录', async ({ page, request }) => {
  5  |   const { projectId } = await connectProjectTable(page, request, 'content_marketing', [['发布日期', '内容编号', '标题', '阅读量', '互动量', '内容费用'], ['2026-11-01', 'article-a', '业务教程', 1000, 10, 50], ['2026-11-02', 'article-b', '案例分享', 2000, 20, 100]]);
  6  |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/content');
  7  |   const business = page.getByTestId('content-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(business.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('业务教程');
  8  | });
  9  | test('评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态', async ({ page, request }) => {
  10 |   const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']]);
  11 |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
> 12 |   const business = page.getByTestId('comment-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await expect(business.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
     |                                                                                                                                                 ^ Error: expect(locator).toContainText(expected) failed
  13 | });
  14 | 
```