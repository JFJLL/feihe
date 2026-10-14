# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-domains.spec.ts >> 内容断链反例：页面接入自己的内容表后，内容页显示真实3000阅读和两条业务记录
- Location: tests\browser\product-domains.spec.ts:4:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })
Expected substring: "3,000"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' }) with timeout 10000ms
  - waiting for getByTestId('content-domain-overview').locator('.ops-metric-card').filter({ hasText: '阅读总量' })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: 独立部门报告1791933243024
    - img
  - paragraph: 品牌未设置 · 独立部门报告1791933243024 · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791933243024
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/1791933243024/data
      - text: 02 数据管理
    - link "竞品分析":
      - /url: /projects/1791933243024/growth
      - text: 03 竞品分析
    - link "指标":
      - /url: /projects/1791933243024/metrics
      - text: 04 指标
    - link "内容管理":
      - /url: /projects/1791933243024/content
      - text: 05 内容管理
    - link "评论运营":
      - /url: /projects/1791933243024/comments
      - text: 06 评论运营
    - link "报告":
      - /url: /projects/1791933243024/reports
      - text: 07 报告
    - link "项目设置":
      - /url: /projects/1791933243024/settings
      - text: 08 项目设置
  - text: 项目资料已连接 业务编辑者(张晓) · 2026/10/14 07:14:03
- main:
  - heading "内容管理" [level=1]
  - text: 0 篇笔记资产
  - paragraph: 2026年 Q3 · 全盘内容效率拆解、切角渗透与达人表现
  - button "同步最新数据"
  - tablist "模块切换":
    - tab "内容分析 0" [selected]
    - tab "内容台账 0"
    - tab "发布管理 0"
    - tab "内容监测 0"
  - tabpanel "内容分析 0":
    - article: 累计总曝光 曝光规模 0 次 已同步内容曝光总额
    - article: 累计总阅读 阅读成本 0 次 待同步投放费用
    - article: 累计总互动 互动质量 0 次 全盘互动率 0.0%
    - article: 达人合作费用 达人采买 待同步 已覆盖 0/0 篇内容
    - text: CORE STRATEGY
    - heading "内容资产来源结构" [level=3]
    - text: 按当前统计范围内的全部笔记汇总，识别内容来源集中度。 暂无内容来源数据 形式分析
    - heading "内容形式互动贡献" [level=3]
    - text: 按已同步互动次数计算贡献占比；缺失互动指标的内容不参与占比计算。 暂无已同步互动贡献 达人效率
    - heading "达人层级篇均互动效率" [level=3]
    - text: 百分比以最高篇均互动层级为 100%；均值沿用已同步指标口径，不代表互动贡献占比。 暂无大于 0 的篇均互动数据 数据质量
    - heading "数据覆盖与分析缺口" [level=3]
    - text: 各项独立统计；表现指标指阅读或互动大于 0，未覆盖不等于表现为零。 暂无笔记，暂不计算覆盖率 内容策略
    - heading "一级内容方向分布" [level=3]
    - text: 按选题方向拆解发文篇数与内容供给规模。 导入 RedTrend 字段后生成 ENGAGEMENT IMPACT
    - heading "一级内容方向互动贡献" [level=3]
    - text: 按选题方向累计互动总量降序拆解，对比各切角互动吸收效能。 暂无选题互动统计 USER INTENTS
    - heading "高频讨论话题与核心诉求" [level=3]
    - text: 笔记与评论高频提及的核心诉求分类与讨论热度集中度。 暂无话题数据 INTERACTION MIX
    - heading "核心互动类型构成拆解" [level=3]
    - text: 全盘笔记点赞、收藏、分享与评论真实互动转化结构。 点赞互动
    - strong: 0 次
    - text: 收藏转化
    - strong: 0 次
    - text: 主动分享
    - strong: 0 次
    - text: 真实评论
    - strong: 0 次
    - text: CONTENT STATUS
    - heading "内容建档与监测状态" [level=3]
    - text: 项目全盘笔记的收录、达标、待补与抓取状态分布。 暂无状态数据 CREATOR MATRIX
    - heading "达人层级效率矩阵" [level=3]
    - text: 头部、腰部、初级达人与 KOC 采买效率与 CPE 表现。
    - table:
      - rowgroup:
        - row "达人层级 笔记数 均阅读 均互动 均 CPE 互动成本":
          - columnheader "达人层级"
          - columnheader "笔记数"
          - columnheader "均阅读"
          - columnheader "均互动"
          - columnheader "均 CPE 互动成本"
      - rowgroup
    - text: 地域分布
    - heading "内容达人地域分布" [level=3]
    - text: 达人分布主要省市与地域渗透格局（已定位 0 位达人）。 待同步达人地域字段 PROCUREMENT PIPELINES
    - heading "投放需求管线交付进度" [level=3]
    - text: 各投放业务管线笔记交付目标与预算消耗执行情况。
    - strong: 口碑爆文维护
    - text: 0 / 1 篇 (0.0%) 已消耗 ¥0 总预算 ¥0
    - strong: 价值内容扫描
    - text: 0 / 1 篇 (0.0%) 已消耗 ¥0 总预算 ¥0
    - strong: 商业内容执行
    - text: 0 / 1 篇 (0.0%) 已消耗 ¥0 总预算 ¥0 SENTIMENT & ACTIONS
    - heading "评论预警处置与闭环进度" [level=3]
    - text: 重点求助问询、客诉负向预警与违规内容处置跟踪。 求助/购买问询
    - strong: 0 条
    - text: 待回复跟进
    - strong: 0 条
    - text: 正向赞誉口碑
    - strong: 0 条
    - text: 待删除处置
    - strong: 0 条
    - text: 负向敏感预警
    - strong: 0 条
    - text: BRAND EFFICIENCY
    - heading "品牌声量与千次投放成效" [level=3]
    - text: 全库品牌内容曝光成本、千次转化与均篇效能拆解。 累计全盘曝光
    - strong: "0"
    - emphasis: 曝光大盘
    - text: 累计总阅读量
    - strong: "0"
    - emphasis: 阅读成本未提供
    - text: 累计总互动量
    - strong: "0"
    - emphasis: 互动成本未提供
    - text: 全盘平均互动率
    - strong: 0%
    - emphasis: 项目已记录互动/阅读
    - text: 达人合作总支出
    - strong: ¥0
    - emphasis: 覆盖 0 篇
    - text: AUDIENCE × STAGE
    - heading "人群×阶段内容矩阵热力图" [level=3]
    - text: 内容规划中各人群在不同决策阶段的选题覆盖密度。 ∅
    - heading "暂无规划数据" [level=3]
    - paragraph: 同步内容规划all in one表格后生成人群×阶段矩阵。
    - text: SCENE TREEMAP
    - heading "内容场景分布树状图" [level=3]
    - text: 一级场景的选题数量占比，面积越大代表该场景覆盖越密集。 ∅
    - heading "暂无场景数据" [level=3]
    - paragraph: 同步内容规划场景库后生成场景分布树状图。
    - text: PAIN POINTS
    - heading "评论高频话题" [level=3]
    - text: 按评论话题分类汇总，同一话题合并不同情绪；字号与数量对应。 ∅
    - heading "暂无话题数据" [level=3]
    - paragraph: 同步笔记与评论话题标签后生成痛点词云。
    - text: CONSUMER FEEDBACK
    - heading "消费者反馈分类构成" [level=3]
    - text: 全盘评论的情感与意图分类：正向赞誉、求助问询、中性讨论、负向敏感。 ∅
    - heading "暂无反馈数据" [level=3]
    - paragraph: 同步评论情感分类后生成消费者反馈构成。
    - text: CREATOR × SCENE
    - heading "达人×内容方向：覆盖与效果" [level=3]
    - text: 对照发布数量、篇均互动和报价成本，筛选值得复盘的内容方向。 内容方向
    - combobox "筛选内容方向":
      - text: 全部方向
      - img
    - text: ∅
    - heading "暂无内容效果样本" [level=3]
    - paragraph: 同步笔记表现后查看各方向的发布数量和效果。
    - paragraph: 覆盖当前项目全部 0 篇已收录笔记。篇均互动包含真实零值；CPE仅对报价、互动均有记录的笔记计算总报价/总互动，非实际结算。缺失显示 —。
    - text: MONTHLY OUTPUT
    - heading "月度内容产出趋势" [level=3]
    - text: 当前项目全量笔记按发布日期分月统计；未填写日期的笔记不参与月度趋势。 ∅
    - heading "暂无产出数据" [level=3]
    - paragraph: 同步笔记发布日期后生成月度产出趋势。
    - text: 内容排行
    - heading "高热内容表现排行" [level=3]
    - text: 按互动与评论总量排序，阅读量辅助评估；点击查看笔记明细。 ∅
    - heading "暂无笔记排行" [level=3]
    - paragraph: 同步笔记表现指标后生成高价值笔记排行。
    - text: 内容规划
    - heading "人群切角与场景库" [level=3]
    - paragraph: 来自飞书「内容切角们」「启萃场景库」，供选题参考。
    - textbox "搜索场景与人群":
      - /placeholder: 搜索人群、场景、痛点
    - paragraph: 同步最新数据后显示规划内容。
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
> 7  |   const business = page.getByTestId('content-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '阅读总量' })).toContainText('3,000'); await expect(business.getByRole('table', { name: '项目内容记录', exact: true })).toContainText('业务教程');
     |                                                                                                                                                ^ Error: expect(locator).toContainText(expected) failed
  8  | });
  9  | test('评论断链反例：页面接入评论表后，评论页显示真实三条评论与来源处置状态', async ({ page, request }) => {
  10 |   const { projectId } = await connectProjectTable(page, request, 'comment_qc', [['记录日期', '评论编号', '评论内容', '情感', '处置状态'], ['2026-11-01', 'c1', '需要回复咨询', '问题', '待处理'], ['2026-11-01', 'c2', '体验很好', '正面', '已处理'], ['2026-11-02', 'c3', '未标注的记录', '', '待处理']]);
  11 |   await publishRecommendedBoard(page); await page.goto('/projects/' + projectId + '/comments');
  12 |   const business = page.getByTestId('comment-domain-overview'); await expect(business.locator('.ops-metric-card').filter({ hasText: '评论记录数' })).toContainText('3'); await expect(business.getByRole('table', { name: '项目评论记录', exact: true })).toContainText('需要回复咨询');
  13 | });
  14 | 
```