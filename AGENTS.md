# 项目架构规范与 AI 协作永久铁律 (Beacon Architecture)

本项目已全面接入腾讯灯塔（Beacon）双层解耦解耦架构（QueryRegistry + UniversalBoardRenderer + DOM Provenance）。
所有项目专属逻辑均隔离在 `projects/<projectId>/` 目录下。任何参与本仓库维护的 Agent 或工程师必须严格遵守以下永久铁律：

## 1. 【新项目全自动建站 SOP】
当用户给出新项目名称与飞书链接/本地文件路径（或零散的业务要求）时，Agent 必须自主拍板并全自动执行以下 4 步交付看板：
1. **初始化目录与配置**：创建 `projects/<slug>/`，编写 `manifest.ts`（项目名称、品牌、SPU、类目、主题色、默认周期）及 `sources.ts`（绑定飞书 Sheet/Bitable 链接或本地文件路径）。
2. **智能拉取与画像分析**：运行 `pnpm project:pull <slug>` 获取原始数据缓存（`.cache/raw-sources.json`）与源表画像推荐蓝图（`.cache/auto-blueprint.md`）。
3. **声明式看板装配**：**无需反问用户索要复杂技术口径**，直接根据源表实际探测出的字段，最大化选用 `lib/core/component-catalog.ts` 中的优质组件编写 `projects/<slug>/transform.ts`，导出 `transformProject(rawSources): BoardPayload`。将能提炼出的总览 KPI、预算进度（target-bullet）、分日趋势（line-bar-combo）、渠道/版位分布（donut-rose/percent-stack）、达人/爆文矩阵（effect-scatter/data-table）与洞察卡（analysisCards）全部装配出来。所有率值、聚合与单位换算 100% 在 `transform.ts` 中计算完毕。
4. **自检编译并入库交付**：运行 `pnpm project:build <slug>`，通过 `board-health` 自动健康检查（确认 query/字段绑定完整、无空图表、比率归一化、指标卡成对无孤立）并自动写入数据库，直接交付完整美观的首版看板。

## 2. 【页面框选/局部修改隔离铁律】
当用户通过框选页面元素、视觉标注或口头提出修改某个项目的看板时（例如“删掉这个图”、“把这个指标改一下”）：
1. **DOM 血缘秒级定位**：页面所有卡片与图表容器均带有以下 DOM 溯源属性：
   - `data-project-id`: 归属项目 ID
   - `data-source-file`: 对应的代码源文件（如 `projects/<projectId>/transform.ts`）
   - `data-section-id`: 布局区块 ID
   - `data-comp-type`: 组件类型（如 `line-bar-combo`, `metric-card`）
   - `data-query-id`: 绑定的数据集 ID（如 `daily_flow`）
   - `data-fields`: 关联字段名
2. **严格单项目隔离修改**：Agent 必须直接定位到 `projects/<projectId>/transform.ts`（或 `manifest.ts`）进行增删改，**严禁修改 `lib/core/`、公共组件库或其它项目的文件**（除非用户明确要求升级全局样式或底座能力）。
3. **修改后自动重检**：修改完成后，必须立即重跑 `pnpm project:build <projectId>`，确保通过 `board-health` 体检且 0 报错后再答复用户。

## 3. 【新项目四段式黄金版面与主题自适应铁律】
1. **四段式黄金节奏**：任何新项目的每个核心栏目（`overview` / `ads` / `content`）必须严格遵循腾讯灯塔的四段式视觉节奏：
   - ① **顶部偶数张核心 KPI 卡**：4 张（或 2/6 张）核心指标卡，第一张卡带顶部 2px 品牌主色强调线，成对均分无孤儿卡。大数自动按万/亿收敛并配合 tabular-nums 等宽数字。
   - ② **2 列对称主诊断图**：左双轴趋势图（`line-bar-combo`）+ 右结构诊断图（`donut-rose` / `target-bullet` / `pareto-chart` / `capability-radar` / `contribution-waterfall`），且必须在 `SectionSpec` 中提供 `hint` 或 `description` 读法导读说明。
   - ③ **AI 洞察与行动建议卡**：`analysisCards` 提炼 1~3 条带量化证据与具体行动指引的分析卡。
   - ④ **底部通栏明细表与筛选器**：`data-table` + `select-filter` / `date-range-filter`，展示多维明细并支持页内即时联动过滤。
2. **纯通用渲染与色彩自适应**：
   - 新项目一律使用 `rendererMode: 'universal'`。
   - 严禁 Agent 为新项目手写自定义 React 页面或自定义 CSS。
   - 只需在 `manifest.json` 中配置该 SPU/品牌的代表色 `color`（或可选指定 `themeId`），系统通过 `deriveThemeFromBrandColor` 自动执行 HSL 降噪护栏（S ≤ 78%, L ∈ [32%, 46%]）、90-8-2 极淡背景与 6 色冷暖互补图表色板派生，从底座杜绝廉价“AI 味”。

## 4. 【4 大确定性业务原型选型指南 (Business Layout Archetypes)】
当接入第 6 个或任意新项目时，Agent 必须先根据源表实际业务数据结构，明确选定以下 **4 类确定性业务原型（Archetype）之一** 进行装配，确保大外壳与间距 100% 统一保住 UI 下限，同时根据业务侧重展现鲜明版式特色：

- **原型 A（多渠道/大促 ROI 归因型）**：
  - 适用场景：包含天猫/京东/抖音等多渠道分日投放、GMV、ROI 归因赛马的项目（如美菱、家电数码）。
  - 版式装配：首屏采用 `paired-metrics` + `variant: 'hero-spotlight'` 突出核心总 ROI/GMV 主色实心高亮；主诊断区采用 `multi-line-deck` 渲染多渠道横向赛马记分牌（带各线专属色标与二级指标矩阵）；配合 `contribution-waterfall` 展现各渠道增减贡献。
- **原型 B（预算控盘与版位效率型）**：
  - 适用场景：包含预算限额、版位千次曝光成本（CPM）、进店成本（CPUV）与打款对账的项目（如凯乐石、户外鞋服）。
  - 版式装配：首屏用 `hero-spotlight` 突出预算达成率与阶段消耗；核心诊断区采用 `bento-split`（左 1.8fr 渲染分日双轴趋势 `line-bar-combo`，右 1fr 紧凑排列预算考核 `target-bullet` 靶心图与版位构成 `donut-rose` 玫瑰图）。
- **原型 C（内容种草与达人矩阵型）**：
  - 适用场景：包含达人采买、博主梯队、小红书笔记发布、互动量、阅读量与千粉成本的项目（如黄天鹅、稳健湿巾、食品美妆快消）。
  - 版式装配：首屏用 `hero-spotlight` 突出全域总声量与互动规模；核心诊断区配置 `pareto-chart` 达人二八定律集中度分析 + `effect-scatter` 达人投入产出象限图；底部明细表配备 `select-filter`（按达人梯队/内容切角实时过滤）。
- **原型 D（舆情防守与口碑质检型）**：
  - 适用场景：包含评论采集、正负向情感判别、外显率达标核验与关键评论处置的项目（如飞鹤启萃、母婴医疗）。
  - 版式装配：首屏突出正向好评率与外显率；诊断区采用 `percent-stack` 呈现正向/中立/负向情感多层堆叠图；搭配 `comment-qc-panel` 质检面板与低置信度人工复核流。

## 5. 【一级导航栏固定与板块内数据自由编排铁律】
1. **一级导航栏全平台严格固定**：任何新项目严禁修改左侧一级导航栏名称。全平台所有项目的一级左侧导航栏始终固定统一为：
   - 01 项目总览 (`overview`)
   - 02 投流分析 (`ads`)
   - 03 行业分析 (`industry`)
   - 04 内容管理 (`content`)
   - （仅当项目包含真实评论质检数据时显示 `评论质检` (`comments`)）
   - 项目设置 (`settings`)
   严禁在 `ProjectSidebar.tsx` 中为个别项目硬编码或映射别名。
2. **板块内章节按数据基因自由深度编排**：
   - 左侧栏固定为标准板块，但板块内部绝不允许千篇一律套用“4张卡+1张表”的死板模板！
   - Agent 在编写 `projects/<newId>/transform.ts` 时，必须深入扫描该项目的所有源表，在固定的 `overview`、`ads`、`content` 三个板块下，根据其所属原型（大促归因/预算控盘/内容种草/舆情口碑），灵活选用 16 种标准图表与容器积木：
     `hero-spotlight`、`bento-split`、`multi-line-deck`、`pareto-chart`、`contribution-waterfall`、`target-bullet`、`donut-rose`、`capability-radar`、`effect-scatter`、`percent-stack`、`placement-efficiency-strip`、`data-table` + `select-filter`，
     每个顶级章节通过 `.ca-macro-section-card` 结构化大卡片呈现（01/02/03 SPU 品牌色编号徽章 + 16px 粗体标题 + 右侧口径导读胶囊），打造出既符合该业务独特逻辑、又严守统一视觉网格下限的专属灯塔看板。
