# 非总览工作区 UI 设计系统（Workspace UI v2）

本文件记录本轮非总览页面改版所引入的视觉与交互规范，作为后续新增 / 维护页面的统一依据。
总览两个页面（`总览 · Q3累计全盘`、`分日 · 日报监控看板`）不属于本系统，保持其原生视觉基线，仅作为参考与回归基准。

## 一、目标与范围

把竞品分析（growth）、内容管理（content）、评论运营（comments）、项目设置（settings）四个板块，
改造成与总览同产品体系下的浅色、多色、有主次、适合长时间使用的数据运营工作台。

- 页面任务定位：总览看全盘，分析页看比较与趋势，台账页查找与管理，处置页识别问题并执行操作，设置页理解与维护配置。
- 明确不做：不整体替换为一套全新颜色，不新增无数据支撑的指标，不增加无业务能力的按钮，不改数据计算方式。

## 二、作用域与实现方案

**核心约定：所有本系统样式只作用于 `[data-workspace-ui="v2"]` 容器及其内部。** 四个工作区外壳（Growth/Content/Comments/SettingsWorkspace）的根节点都设置了该属性，总览工作区不设置，因此总览完全不受影响。

样式文件：
- `styles/workspace-ui-v2.css`：本系统的全部作用域样式，通过 `@import` 在 `app/globals.css` 中 **最后** 引入（在 `workspace-polish.css` 之后），以便在相同权重下覆盖旧规则，且尽量不使用 `!important`（个别因旧规则带 `!important` 的地方需匹配覆盖）。
- `lib/workspace-palette.ts`：稳定色板与按稳定 key 取色的函数，供图表 / 品牌 / 方向取色。

### 组件变体（保留默认兼容）

| 组件 | 变体 | 作用 |
| --- | --- | --- |
| `PageHeader` | `banner`（默认） | 总览深蓝横幅页头，保持原样 |
| `PageHeader` | `light` | 非总览轻量白色页头 |
| `WorkspaceModuleTabs` | `cards`（默认） | 总览卡片式入口，保持原样 |
| `WorkspaceModuleTabs` | `compact` | 非总览紧凑下划线标签导航 |

## 三、色彩角色

三类颜色体系，通过 scoped 变量在 `[data-workspace-ui="v2"]` 上声明：

- **中性色**：页面底 `--ws-page-bg:#f6f8fa`、面板 `--ws-surface:#fff`、边框 `#e2e8f0`、文字 `#1e293b`、辅助文字 `#52657c`。
- **交互色**：`--ws-interactive:#1e6091`（稳重蓝），hover `#174d75`，浅底 `--ws-interactive-soft:#edf4fa`。
- **数据与状态色**（稳定映射，禁止按排序索引取色）：
  - 蓝 `#1e6091`、青绿 `#0f807a`、灰绿 `#3f815e`、灰紫 `#7864a5`、琥珀 `#a66f22`、珊瑚 `#b85c55`、灰 `#64748b`。
  - 状态色：成功 `#2e7d5b`、警告 `#a66f22`、危险 `#b0483f`、信息 `#1e6091`、中性 `#52657c`，各配浅底与边框。

### 取色原则

品牌 / 指标 / 方向 / 类别等稳定标识的颜色通过 `paletteColor('brand:' + key)` 或 `paletteForKeys(keys)` 派生，
依据稳定 key（品牌 id、系列 key、方向名）而非当前行序 / 排序索引分配，保证切换月份、排序、筛选后颜色不变。

## 四、字体与间距

- 不引入远程字体，沿用系统 / 项目中文字体。
- 尺度：页面标题 24px，区域标题 16px，正文与常规控件 14px，表格正文 13px，辅助说明 ≥12px，核心指标数字 28px。
- 间距尺度 4 / 8 / 12 / 16 / 24 / 32；卡片圆角 12px，控件圆角 8px。
- 数字使用等宽数字特性（`font-variant-numeric: tabular-nums`），数值列右对齐。

## 五、主要公共控件

1. **二级导航**（紧凑标签）：下划线或轻底色标识当前项，仅保留少量必要数量徽标，不长期显示每个 tab 的完整说明。
2. **按钮**：primary / secondary（默认非 primary 白底描边按钮）/ ghost-text（`.text-link`、`.btn-link`）/ danger（`.danger-link`）。
   覆盖 default / hover / focus-visible / active / disabled / loading，常规高度 36–40px。
3. **输入框 / 下拉 / 文本域**：统一高度、边框、内边距，`focus-visible` 用交互色 + 焦点环，禁用 / 只读灰底。
4. **表格**：`ops-table`，浅灰表头，竖线弱化，数值列右对齐，状态用 `ops-badge`，空结果 / 错误有独立提示。
5. **状态**：`ops-badge-*` 用「色 + 边框 + 文字」表达，避免仅靠颜色传达状态。
6. **指标卡**（`ops-metric-card` / `pastel-card`）：白色平铺表面 + 一条稳定色顶边，不使用渐变填满。
7. **进度条 / 工具栏 / 分页 / 抽屉 / 数据源溯源**：均有 scoped 样式统一。

## 六、可访问性与响应式

- 文字与背景对比度至少 4.5:1，大文字 3:1；用于识别必要控件与状态的非文字信息 ≥3:1。
- `:focus-visible` 提供清晰焦点环；图标按钮有语义名称；错误不只用红色；标签不只靠颜色区分。
- `prefers-reduced-motion: reduce` 时移除过渡动画。
- 响应式断点 760px：页头纵向堆叠、标签导航可横向滚动、控件扩大触控高度。

## 七、新增页面时如何接入

1. 在页面根节点加 `data-workspace-ui="v2"`。
2. `PageHeader` 用 `variant="light"`，`WorkspaceModuleTabs` 用 `variant="compact"`。
3. 复用 `ops-*` / `panel` / `pastel-card` 类名与色板函数，避免堆叠大量 `!important` 的覆盖文件。
4. 数据颜色用 `lib/workspace-palette.ts` 按稳定 key 取色。
