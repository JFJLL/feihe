# 新三项目重构独立验收标准与执行清单 (Acceptance Contract)

本文件定义对美菱 (`meiling`)、凯乐石 (`kailas`)、全棉时代 (`winner-wipes`) 三个营销战役项目的全新独立验收合同。所有验收必须在开发团队发出 `源码 ready` 通知后，通过独立的 `playwright-cli` 会话在真实浏览器环境执行，严禁改动任何源码或底层数据库。

---

## 一、验收对象与截图规程 (9 + 2 矩阵)

### 1. 桌面端 1440×900 视口（9 张核心截图）
| 项目 ID | 页面 / 路由 | 验收截图路径 | 核心审查重点 |
| :--- | :--- | :--- | :--- |
| `meiling` | 项目总览 (`/projects/meiling`) | `output/playwright/redesign-after-meiling-overview.png` | 4-5核心指标、≥2主体图、首屏紧凑 |
| `meiling` | 投流分析 (`/projects/meiling/ads`) | `output/playwright/redesign-after-meiling-ads.png` | 独立投流职责、无首页5tabs、专职看板 |
| `meiling` | 内容管理 (`/projects/meiling/content`) | `output/playwright/redesign-after-meiling-content.png` | 独立内容职责、达人与笔记工作流 |
| `kailas` | 项目总览 (`/projects/kailas`) | `output/playwright/redesign-after-kailas-overview.png` | 紧凑指标、主体图表、Q3真实口径 |
| `kailas` | 投流分析 (`/projects/kailas/ads`) | `output/playwright/redesign-after-kailas-ads.png` | 渠道与投流结构、独立路由组件 |
| `kailas` | 内容管理 (`/projects/kailas/content`) | `output/playwright/redesign-after-kailas-content.png` | 种草执行状态、无混杂跨领域表 |
| `winner-wipes` | 项目总览 (`/projects/winner-wipes`) | `output/playwright/redesign-after-wipes-overview.png` | 4-5核心指标、≥2主体图、真实数据源 |
| `winner-wipes` | 投流分析 (`/projects/winner-wipes/ads`) | `output/playwright/redesign-after-wipes-ads.png` | 投流效果透视、无冗余外壳 |
| `winner-wipes` | 内容管理 (`/projects/winner-wipes/content`) | `output/playwright/redesign-after-wipes-content.png` | 独立内容执行跟踪 |

### 2. 移动端 390×844 视口（2 张专项防溢出截图）
| 项目 ID | 页面 / 路由 | 验收截图路径 | 审查重点 |
| :--- | :--- | :--- | :--- |
| `meiling` | 项目总览 (`/projects/meiling`) | `output/playwright/redesign-after-meiling-390px.png` | 390px 无横向滚动条、图表图例不裁切 |
| `winner-wipes` | 项目总览 (`/projects/winner-wipes`) | `output/playwright/redesign-after-wipes-390px.png` | 390px 无横向滚动条、卡片标签自适应 |

---

## 二、关键数据反例与动态绑定验证（反硬编码专项）

初稿存在硬编码风险（实际值、目标值、解读文案写死）。验收必须包含一次内存级 API route 劫持反例验证（利用 `playwright-cli run-code` 执行 `page.route`，不改动数据库与源码）：

1. **数值变更同步反例**：
   - 拦截目标项目的 API 响应（如 `/api/projects/meiling/campaign` 或对应 bootstrap/metrics 接口），在内存中将某个实际值（例如将实际发布数由 50 改为 999）或目标值修改为特定测试数值；
   - 验证：指标卡数值、主体走势图、完成度百分比、研判摘要文案是否同步变为 999 联动计算，**拒绝卡片变了但摘要仍写死旧数字**。
2. **缺失置空诚实反例**：
   - 将某指标的实际值或目标值在响应中置为 `null` / `undefined` / 移除字段；
   - 验证：前端是否呈现诚实缺失空态（如 `—`、未设定或空态占位），**严禁 fallback 退回到历史旧写死数字**。
3. **环境复原**：
   - 反例验证完成后，调用 `page.unroute(...)` 解除内存劫持，重新加载真实页面，确保最终产出的验收截图 100% 对应真实后端数据。

---

## 三、关键业务基准数据对照表（真实口径防串）

| 项目 / 模块 | 关键业务指标项 | 严格基准口径要求 | 严禁出现的串流或假数据 |
| :--- | :--- | :--- | :--- |
| **全棉时代 (`winner-wipes`)** | 发布进度与量级 | **KOL 30 篇 / KOC 86 篇** | 不得混入其他战役（如洗脸巾或其他品类）数据 |
| **美菱 (`meiling`)** | 达人二核母集与发布 | **严格二核确认母集 117 位 / 已正式发布 50 篇** | 不得将初筛 1096 当作分母，不得把日报 44 篇与线上 50 篇混为一谈 |
| **美菱 (`meiling`)** | 双11 CID 投流表现 | **3日累计 ROI 2.39 / GMV ¥8,076.81** | 不得出现源表 #REF! 错误值，ROI 分母口径保持纯 CID 花费 |
| **美菱 (`meiling`)** | 历史 618 复盘口径 | 618 结案全渠道总 GMV 1,695.95 万元 | **历史 618 绝对不得出现双11 GMV 55.98万**（严防跨活动串流） |

---

## 四、逐项结构与交互验收标准 (Checklist Rules)

### 规则 1：首页结构与空间效率
- [ ] **Tab 净化**：顶部仅保留「总览 / 分日」两级核心看板切换，彻底移除旧版堆叠的 `总览 / KPI进度 / 投放明细 / 执行优化 / 数据来源` 5 个平铺按钮。
- [ ] **指标卡精简**：总览指标卡数量严格控制在 4～5 项高价值核心指标（如：总投入、总消耗、核心渠道 ROI、已发布进度等），禁止将 40+ 卡片全量平铺。
- [ ] **主体图表真实性**：
  - 总览页必须包含**至少 2 个**具备业务分析价值的主体图表（如：全渠道走势图、渠道构成环/柱图、转化漏斗等）。
  - 图表必须基于真实数据渲染，**绝对不接受无数据仅画占位框/空壳 SVG**。
  - 数据缺失时必须呈现诚实空态说明，严禁伪造连续趋势点。

### 规则 2：分日看板 (Daily Tab) 规范
- [ ] **交互与筛选**：具备日期范围 (Date) 与指标类型 (Metric) 筛选器。
- [ ] **真实走势**：走势折线/柱状图仅在有真实分日源数据时绘制。
- [ ] **诚实空态**：未采集或断流日期不连线、不拟合，无数据区间显示诚实空态。

### 规则 3：子页面职责解耦 (`/ads` 与 `/content`)
- [ ] **页面标题与职责明确**：
  - `/ads`：专职投流效果分析，展示渠道花费结构、CPC/CPM/CPUV/ROI 对比，严禁出现非投流的内容审核或数据源配置混合表。
  - `/content`：专职内容资产与达人执行工作台，展示阶段漏斗、发布达成与合规巡查，严禁堆砌投放明细表。
- [ ] **独立组件路由**：禁止直接渲染 `CampaignBoard` 通用卡表，彻底消除侧栏假路由与同质化外壳。

### 规则 4：数据源与设置真实性 (`/settings?tab=data-sources`)
- [ ] 真实展示当前绑定的飞书底表、多维表格或日报快照元数据，清楚呈现同步状态与数据版本。

### 规则 5：路由流转与交互稳健性
- [ ] **侧栏导航联动**：点击侧栏菜单项，浏览器 URL 精确同步更新，对应菜单高亮（active）状态准确无误。
- [ ] **历史与刷新持久化**：
  - 任意子路由刷新页面（F5 / reload），视图与筛选状态完整保留，不退回默认总览。
  - 浏览器前进 / 后退（`go-back` / `go-forward`）历史记录正常工作。
- [ ] **跨项目隔离性**：通过项目切换下拉框在 `meiling`、`kailas`、`winner-wipes` 间切换，各项目的数据源、指标定义与图表彻底隔离，**严禁数据串流或缓存交叉污染**。
- [ ] **控制联动有效性**：切换筛选期、日期或图表维度，图表与表格能真实重绘响应，非无动于衷的静态死图。
- [ ] **控制台零报错**：全流程所有页面交互过程中，Console 必须保持 0 JS Error（允许无关常规 warn）。

### 规则 6：390px 移动端布局合规
- [ ] **零横向溢出**：在 390×844 视口下，`document.documentElement.scrollWidth === document.documentElement.clientWidth`，页面不得出现横向滚动条或卡片外翘撑破。
- [ ] **无文字图例裁切**：核心指标卡数值、单位、走势图 X/Y 轴标签及图例文字换行或自适应良好，不得被截断遮挡。

### 规则 7：业务语义正确性优先
- [ ] **拒绝形式主义审查**：不仅仅检查 DOM 中是否存在 `<svg>` 标签或元素数量，必须核查业务数值逻辑、比例总和、单位符号（%、元、万）及状态判定（达标/未达标/成本超标）的业务合理性。

---

## 五、执行阶段把控
- **严守时机**：源码仍在变动时绝不提前执行或误报，必须等待开发/主代理明确通知 `源码 ready` 后才开始执行。
- **报告直达**：发现硬编码未解、数据串流、假图表或溢出等缺陷立即整理具体证据汇报用户与 owner。
