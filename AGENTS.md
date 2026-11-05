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
