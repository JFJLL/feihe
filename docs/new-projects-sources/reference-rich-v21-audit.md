# 飞鹤 Q3 日报看板（优化版 v2.1）实际渲染与结构审计报告

## 1. 审计概述与截图产物

- **参考源文件**：`D:\download\del\飞鹤Q3日报看板（优化版v2.1-含月进度）.html`
- **本地复本验证**：与 `docs/飞鹤Q3日报看板（优化版v2.1-含月进度）.html` 字节数（43,492 字节）及内容完全一致。
- **渲染分辨率**：1440 × 900 视口；独立 Playwright 会话 `rich-reference` 渲染。
- **截图输出**：
  - 1440 视口首屏：`output/playwright/reference-rich-v21-viewport.png`
  - 1440 滚动全屏：`output/playwright/reference-rich-v21-full.png`

---

## 2. 业务 Section 结构清单

参考页面按“决策层 → 分析层（分日联动） → 分析层（季度累计） → 行动层”四层展开：

### Section 1：全局顶栏（Sticky Header）
- **左侧**：主标题“飞鹤臻稚卓蓓小红书种草数据 Q3 日报看板”，副信息标签（项目名称：飞鹤臻稚卓蓓 2026年Q3日常种草与电商引流；运营团队：众引传播集团 MGCC）。
- **右侧**：日期下拉选择器 `#dateSelect`，包含 2026-07-01 至 2026-08-24 共 55 天，默认选中文档基准日 `2026-08-24 (最新)`。

### Section 2：决策层 · 今日健康度总览（Health & Executive Summary）
- **健康度评分块**：大字号综合健康度得分（`#healthScore`，当前 72，黄色警戒色）。
- **四维健康度状态胶囊**：
  1. 消耗节奏：达成率 97.7%，稳定（绿点）
  2. 信息流 CTR：8.79%，超 KPI（绿点）
  3. 搜索 CTR：4.56%，低于 KPI 下限（红点）
  4. 预算进度：滞后时间进度 17.6pp（黄点）
- **数据驱动 Executive Summary**：带状态 Tag（达标/预警/关注）的 4 条支撑要点，直接以核心数据口径定性当前业务状态。

### Section 3：决策层 · 预算消耗节奏对比（按月/按季双轨进度）
- **左卡（8月当月，截至24日）**：
  - ⏱ 时间进度（24/31天）：77.4%
  - 💰 消耗进度（¥59.5万 / ¥80.6万）：73.8%
  - 偏差大字卡：`-3.6pp`（当月消耗略滞后，黄底警示）
- **右卡（Q3累计，7-9月）**：
  - ⏱ 时间进度（55/92天）：59.8%
  - 💰 消耗进度（¥203.8万 / ¥475万）：42.18%
  - 偏差大字卡：`-17.6pp`（季度累计滞后较多，红底警示）
- **底部补充标注**：7月实际完成情况（¥103.9万/¥120万，达成率86.6%）与 9月待启动预算（¥120万）。

### Section 4：分析层 · 日报数据区（随全局日期动态联动）
- **第一行 KPI 卡片（4张）**：
  1. 当日消耗：当前值、KPI (¥26,000)、达成率 (97.7%)、14天 Sparkline
  2. 信息流 CTR：当前值 (8.79%)、KPI (6%)、超额 (+2.79pp)、14天 Sparkline
  3. 搜索 CTR：当前值 (4.56%)、KPI (7%-8%)、差距 (-2.44pp)、脉冲报警徽章“未达标”、14天 Sparkline
  4. 小红盟 CPUV：当前值 (¥15.79)、KPI (¥25)、节约比率 (省 36.8%)、14天 Sparkline
- **第二行 KPI 卡片（4张）**：
  5. 小红星 CPUV：当前值 (¥5.10)、KPI (¥10)、节约比率 (省 49%)、14天 Sparkline
  6. 当日达人发布：当前篇数 (2篇)、切角标签 (SEM+搜索优化)、14天 Sparkline
  7. 当日评论维护：当前条数 (18条)、范围标签 (社区UGC+本品)、14天 Sparkline
  8. 消耗达成率：当前值 (97.7%)、目标 (≥95%)、超额 (+2.7pp)、14天 Sparkline
- **双大图（近30天历史走势）**：
  - 投流消耗趋势（30天）：计划消耗（虚线） vs 实际消耗（平滑折线带填充阴影）
  - CTR 趋势对比（30天）：信息流 CTR（绿线） vs 搜索 CTR（红线） vs KPI 下限基准线（6% 灰色虚线）

### Section 5：分析层 · Q3 累计总览（固定季度全局视角）
- **模块一：投流效率（2张大图）**
  - KFS 投流结构占比（水平条形图）：S-SEM搜索推广、F-信息流与视频流、K-达人采买、SEO技术优化、其他运维/产品之金额与占比。
  - 渠道采买费用占比（水平条形图）：小红盟、小红星、搜索优化达人采买结算金额与占比。
- **模块二：内容产出（3张进度卡 + 1环形图 + 1切角明细表）**
  - 种草总篇数卡：199篇（Q3累计）、8月已发54篇 / 目标80篇 (67.5%)
  - SEM达人卡：42/60（8月70%）、Q3累计 96/133 (72%)、8月待发 18篇
  - 搜索优化达人卡：12/30（8月40%，报警红标“月滞后”）、Q3累计 26/66 (39%)、8月待发 18篇
  - 达人量级结构分布（环形图）：初级达人(5k-5w)、素人达人(0-5k)、腰部达人(5w-50w)、头部达人(>50w)篇数与百分比。
  - 内容切角发布进度表（Table + 行内进度条）：7个切角维度，含“8月实际/目标”、“Q3实际/计划”、“8月进度（彩色胶囊进度条）”、“Q3累计百分比标注”。
- **模块三：互动维护（3张维护进度卡）**
  - 评论维护总进度卡：532 / 980（8月54.3%）、Q3累计 1033/2500 (41.3%)、待维护 448条
  - 社区UGC维护卡：520 / 800（8月65%）、Q3累计 1013/2000 (51%)、待维护 280条
  - 本品笔记维护卡：12 / 150（8月8%，报警红标“月严重滞后”）、Q3累计 20/500 (4%)、待维护 138条

### Section 6：行动层 · 复盘与下一步（Learning & Next Step）
- **Learning 沉淀与复盘（4项核心归因）**：
  - K端交付稳步推进（SEM vs 搜索优化达人分化）
  - FS端投流高质放量（信息流超额放量，搜索优化词包冲刺）
  - 内容切角转化验证（单品直推/竞品1v1优异，防敏切角互动领先）
  - 评论维护结构失衡（社区UGC正常，本品笔记严重滞后）
- **Next Step 推进规划（5项带责任人与截止日的任务看板）**：
  - 每项包含序号 Badge、行动具体描述、责任部门 Badge（投放组/内容组/社区组/BD组）、截止日期（8/30、9/5等）、状态 Badge（进行中/待开始/已完成）。

---

## 3. 图表数量、类型与 DOM 映射清单

页面渲染共采用 **13 个 Chart.js Canvas 实例** 与 **2 类原生 HTML 数据可视化组件**：

| # | DOM ID | 可视化类型 | 尺寸/位置 | 业务含义 | 交互与动态特性 |
|---|---|---|---|---|---|
| 1 | `sparkSpend` | Line Chart (无坐标轴/填底) | 36px 高，KPI卡内 | 当日消耗 14 天平滑走势 | 随日期下拉切片动态重绘 |
| 2 | `sparkFeedCTR` | Line Chart | 36px 高，KPI卡内 | 信息流 CTR 14 天平滑走势 | 随日期下拉切片动态重绘 |
| 3 | `sparkSearchCTR` | Line Chart | 36px 高，KPI卡内 | 搜索 CTR 14 天平滑走势 | 随日期下拉切片动态重绘 |
| 4 | `sparkXhmCPUV` | Line Chart | 36px 高，KPI卡内 | 小红盟 CPUV 14 天走势 | 随日期下拉切片动态重绘 |
| 5 | `sparkXhxCPUV` | Line Chart | 36px 高，KPI卡内 | 小红星 CPUV 14 天走势 | 随日期下拉切片动态重绘 |
| 6 | `sparkNotes` | Line Chart | 36px 高，KPI卡内 | 当日达人发布 14 天走势 | 随日期下拉切片动态重绘 |
| 7 | `sparkComments` | Line Chart | 36px 高，KPI卡内 | 当日评论维护 14 天走势 | 随日期下拉切片动态重绘 |
| 8 | `sparkAchieve` | Line Chart | 36px 高，KPI卡内 | 消耗达成率 14 天走势 | 随日期下拉切片动态重绘 |
| 9 | `chartSpendTrend` | Dual Line Chart (平滑+虚线) | 260px 高，分析层大卡 | 计划消耗 vs 实际消耗 30 天走势对比 | 随日期切取前 30 天滑动窗口 |
| 10 | `chartCTRTrend` | Triple Line Chart (双实一虚) | 260px 高，分析层大卡 | 信息流 CTR vs 搜索 CTR vs 6%基准线 | 随日期切取前 30 天滑动窗口 |
| 11 | `chartKFS` | Horizontal Bar Chart (`indexAxis: 'y'`) | 260px 高，Q3累计模块 | KFS 各维度预算支出结构与占比 | 固定展示，不随日期切变 |
| 12 | `chartChannel` | Horizontal Bar Chart (`indexAxis: 'y'`) | 260px 高，Q3累计模块 | 渠道采买（小红盟/小红星/搜索达人）支出 | 固定展示，不随日期切变 |
| 13 | `chartTier` | Doughnut Chart (`cutout: '55%'`) | 260px 高，Q3累计模块 | 达人量级（初级/素人/腰部/头部）分布 | 固定展示，不随日期切变 |
| - | `.budget-bar-fill` | CSS 进度条组件（共4条） | 预算节奏对比卡 | 8月时间/消耗进度、Q3时间/消耗进度 | 纯 CSS 渲染，带动态百分比与文字 |
| - | `#angleTableBody` | HTML 表格 + 行内 Progress Bar | 内容产出表格 | 7 大内容切角 8月进度与 Q3 达成比 | 表格行内彩色胶囊进度条，带阈值色控 |

---

## 4. 交互与过滤机制

1. **日期选择器切换 (`#dateSelect.addEventListener('change')`)**：
   - 触发 `renderDaily(dateKey)`：
     - 更新 8 张日报 KPI 卡片的数值文本（消耗、CTR、CPUV、发布数、评论数、达成率）。
     - 动态条件样式切换：搜索 CTR 若 `< 7%`，KPI 文字转红，卡片状态 Badge 自动切换为“风险 (`status-danger`)”，否则显示“达标 (`status-ok`)”。
     - 截取当前日期倒推 14 天数据更新 8 张 Sparkline 迷你折线图。
     - 截取当前日期倒推 30 天数据更新 2 张大趋势图（消耗走势双线、CTR走势三线）。
2. **Q3 静态数据隔离机制**：
   - 预算节奏条、KFS 条形图、渠道费用条形图、达人量级环形图、内容切角进度表、互动维护模块、Learning 与 Next Step 均为固定展示，不因分日日期切换发生重置，避免了全量报表被单日状态打乱。

---

## 5. 数据字段与业务口径清单

| 字段名称 | 英文字段标识（参考） | 计算口径 / 逻辑 | 达标与警戒阈值 |
|---|---|---|---|
| 当日计划消耗 | `plan_spend` | 当日预算目标额 | 7月 ¥38,700/天，8月 ¥26,000/天 |
| 当日实际消耗 | `actual_spend` | 当日投流实际消耗 | - |
| 消耗达成率 | `achieve_pct` | `actual_spend / plan_spend * 100%` | ≥95% 为达标，<95% 关注 |
| 信息流消耗 / CTR | `feed_spend`, `feed_ctr` | 信息流投流消耗与点击率 | CTR 目标 ≥6.0% |
| 搜索消耗 / CTR | `search_spend`, `search_ctr` | 搜索投流消耗与点击率 | CTR 目标 7.0% - 8.0%，<7.0% 红色预警 |
| 小红盟 CPUV | `xhm_cpuv` | 小红盟渠道单 UV 成本 | KPI 预算目标 ≤¥25.0 |
| 小红星 CPUV | `xhx_cpuv` | 小红星渠道单 UV 成本 | KPI 预算目标 ≤¥10.0 |
| 当日达人发布 | `notes_today` | 当日审结上线并带监测的种草笔记篇数 | SEM 与搜索优化达人合并统计 |
| 当日评论维护 | `comments_today` | 当日在社区 UGC 与本品笔记下的正向维护条数 | 社区 UGC + 本品笔记维护 |
| 预算时间进度 | `time_pacing` | 经过天数 / 周期总天数（当月或季度） | - |
| 预算消耗进度 | `budget_pacing`| 累计实际消耗 / 周期总预算（当月或季度） | 与时间进度对比，计算 pp 偏差 |
| KFS 支出结构 | `kfs_spend` | S搜索 / F信息流 / K达人 / SEO / 运维 分项支出与占比 | 合计为季度总投流盘子 |
| 内容切角完成度 | `angle_progress` | 各切角当月实际发篇 / 当月目标发篇 | 进度 <50% 红色，<75% 黄色，≥75% 绿色 |

---

## 6. 严禁复制的 Dummy / Mock 伪数据预警

在参考 HTML 的 `<script>` 区域中，存在大量的**算法仿真假数据**，必须明确指出以避免被后续集成误当做真实业务指标：

1. **正弦波伪造分日走势（严禁采用）**：
   ```javascript
   const actual = Math.round(baseActual + (Math.sin(i*0.7)*400));
   const feedCTR = isJuly ? (8.25 + i*0.01 + Math.sin(i*0.5)*0.15) : ...;
   const searchCTR = isJuly ? (5.0 + Math.sin(i*0.8)*0.35) : (5.0 - (i-31)*0.015 + Math.sin(i*0.6)*0.2);
   const notes = (i%4===0)?4:(i%4===1?2:(i%4===2?3:1));
   const comments = 10 + (i%15);
   ```
   **风险提示**：此类由 `Math.sin()`、取模生成的 55 天数据纯属前端 Mock，黄天鹅项目必须从真实的 `facts.json`、原始工作簿及真实投放表中提炼，严禁通过算法补齐伪造。
2. **硬编码末日覆盖值**：
   参考代码在 `genData()` 末尾将 `2026-08-24` 强行改写为固定常数。真实系统必须支持任意真实日期的准确映射。
3. **静态数组绑定**：
   `KFS_DATA`、`CHANNEL_DATA`、`TIER_DATA`、`ANGLE_DATA` 均直接硬编码于前端脚本中，在新项目中必须走后端 `campaign-enrichment` 或 `dashboard snapshot` 驱动。

---

## 7. 黄天鹅及已有 3 项目可直接借鉴的模块清单

| 模块名称 | 结构特征与 UI 规范 | 后端数据契约要求 | 落地优先级 |
|---|---|---|---|
| **M1: 综合健康度与 Executive Summary 决策卡** | 大分值 + 4 个健康指标彩色状态圆点 + 4 条结构化定性摘要（达标/预警/关注 Tag） | `decisionSummary: { score: number, items: Array<{label, status, desc}>, bullets: Array<{tag, text}> }` | P0 |
| **M2: 月度/季度双轨预算时间进度条** | 双卡对照网格：时间进度条（灰）与消耗进度条（品牌色）上下对比，右侧直接突出 `±pp` 偏差大字 | `budgetPacing: { monthly: { timePct, spendPct, gapPp, actual, plan }, quarterly: { ... } }` | P0 |
| **M3: 带 Sparkline 的标准分日 KPI 矩阵** | 4 列网格卡片，顶部标题+状态徽章，中间大数字，下部目标与差距，底部 36px 纯曲线折线图 | `dailyKpis: Array<{ key, label, value, target, delta, status, sparkline14d: number[] }>` | P0 |
| **M4: 投放 30 天走势对比图（双线/三线）** | 双折线对比（计划 vs 实际），三折线对比（信息流 CTR vs 搜索 CTR vs 警戒基准线） | `trend30d: { dates: string[], planSpend: number[], actualSpend: number[], feedCtr: number[], searchCtr: number[], baselineCtr: number }` | P1 |
| **M5: 投流与采买结构水平条形图 (KFS)** | 水平柱状图，条形带圆角，直接展示万元金额与百分比占比 | `spendBreakdown: { kfs: Array<{label, amount, pct}>, channels: Array<{label, amount, pct}> }` | P1 |
| **M6: 内容切角发篇进度跟踪表格** | 表格列：切角主题、当月实际/目标、季度实际/目标、行内彩色胶囊进度条（动态阈值色） | `contentAngles: Array<{ name, monthActual, monthPlan, monthPct, qActual, qPlan, qPct }>` | P1 |
| **M7: 互动维护双维度卡片组** | 评论维护按“社区 UGC 维护”与“本品笔记维护”拆分，展示当前/目标、季度累计及月待维护缺口 | `engagementProgress: { total: {...}, communityUgc: {...}, ownNote: {...} }` | P1 |
| **M8: 行动层复盘与带责任人 Next Step** | 复盘列表（左）与带序号圆形 Badge、负责人、截止时间、状态标签的任务清单（右） | `actionPlan: { learnings: string[], nextSteps: Array<{id, task, owner, deadline, status}> }` | P2 |

---

## 8. 结论与下一步集成指引

- 参考页面的信息丰富度核心在于**“决策层健康度诊断”**、**“月/季双时间进度对齐”**、**“分日 14 天 Sparkline + 30 天双/三走势线”**以及**“内容切角/达人量级/互动维护结构化”**。
- 黄天鹅（`huang-tiane`，template: `campaign_review`）后端集成将提供标准的数据模型承载上述模块字段，在保持“启萃”统一视觉规范的同时，实现同等颗粒度的数据深度。