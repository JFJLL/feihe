# 业务看板设计规格与统一展示框架模板 (Delivery V1)

## 1. 核心视觉与层级问题治理结论
- 视觉压抑与色彩泛滥治理：彻底废除深蓝渐变页头与全页泛滥的浅蓝背景/高饱和蓝边框；整体采用暖中性灰白底，界面轻盈护眼且关键异动信息具有高识别度。
- 终结三栏机械重复：废止全页平铺的 6 至 8 处三栏大盒子，统一收敛为单行轻量「Insight 研判卡」（核心结论/关键动作一行透出，长归因与作者原文默认折叠）。
- 排版模数与呼吸感：拒绝硬性 fixed height，采用合理的 min-height 与响应式网格，文字、表格与图表自然展开无截断。

## 2. 最终确认色彩 Token 体系 (Warm Neutral Theme)
- 中性基底 Token：
  - 页面背景 --dt-bg-page: #f6f5f2（暖中性底）
  - 卡片容器 --dt-bg-card: #ffffff（纯白卡片，避免每卡大彩底）
  - 描边线条 --dt-border: #e4e7e2（1px 细线，替代泛蓝描边）
  - 辅助描边 --dt-border-light: #ecefe9
  - 主文本 --dt-text-main: #252b2a（深沉碳灰，高可读性）
  - 辅助描述 --dt-text-muted: #6f7875
- 语义主辅色 Token（仅用于图表走势、关键强调与状态）：
  - 核心主色 --dt-primary: #2c7168（深青色，用于实际消耗、主按键与激活标记）
  - 辅助紫色 --dt-purple: #8273a3（用于政策后结算、搜索侧、快照参考）
  - 赭金色 --dt-ochre: #b88a45（用于项目总投入、达人采买、预警待核）
  - 陶土色 --dt-terracotta: #bd7964（用于缺陷整改、停投、严重滞后）
  - 计划灰 --dt-plan: #8c9ba5（用于预算基准、未提供、参考线）

## 3. DOM 结构与新增 Selector 契约
- 页面根容器：.dashboard-template.dashboard-template-{kind}.theme-{themeTag}
  - 示例：div.dashboard-template.dashboard-template-overview.theme-warm-neutral
  - 属性标记：data-preset="overview|daily|general"，data-project-template="{templateId}"
- 统一头部：header.ui-page-header
  - 子类：.ui-page-header-eyebrow（深青色字号11px）、.ui-page-header-title（20px #252b2a）、.ui-page-header-subtitle（12.5px #6f7875）
- 模块切换区域：
av.dashboard-template-nav
  - 容纳两张精美模块切换卡：
av.ops-module-tabs -> utton.ops-module-tab（约 58-62px 高度，轻色图标，Teal 细描边与柔和内衬阴影激活标记）
- 内容主体：main.dashboard-template-body 或 div.dashboard-template-body（纵向 gap: 12px 弹性流）
- 单行轻量研判卡（Insight Card）：.bd-aspect-summary.bd-insight-card
  - 横条头部：.bd-insight-banner
  - 结论行：.bd-insight-lead-wrap -> .bd-insight-badge（深青/陶土浅底胶囊） + .bd-insight-lead（单行文字）
  - 元数据：.bd-insight-meta -> .bd-insight-owner（责任人） + .bd-insight-deadline（时限）
  - 折叠明细：details.bd-aspect-details -> <summary> 点击展开差异原因与跟进策略
- 语义业务板块（Section Partitioning）：
  - [data-section="spend"]：广告消耗与总投入走势（深青顶边）
  - [data-section="funnel"]：星盟电商漏斗（紫顶边）
  - [data-section="search"]：搜索分析核心与大词 TOP10（紫顶边）
  - [data-section="feed"]：信息流分析与人群渗透（深青顶边）
  - [data-section="rectification"]：评论区巡查与整改全盘（陶土顶边）
  - [data-section="creators"]：达人储备与执行底表（赭金顶边）
  - [data-section="comments"]：评论维护与心智（陶土顶边）
  - [data-section="seo"]：SEO 关键词收录与占位（青绿顶边）
  - [data-section="actions"]：当天动作与负责人（赭金顶边）
- 壳层统一与安全隔离：
  - ProjectShell 根节点应用 .app-shell.theme-{themeTag}[data-project-template]
  - 侧边栏 .sidebar 仅在 .app-shell:has(.dashboard-template) 或 .theme-warm-neutral 下同步暖白边框，坚决不全局重置 button/svg 等基础元素


## 4. 板块分区导航与锚点规范
- 轻量导航栏：采用无外边框轻量链接条 .bd-section-nav，去除冗余大卡片与实现口吻，仅保留 4 组功能项标签（如 [经营表现] [投流效果] [执行进度] [数据明细]）。
- 分组序号与标题：分组头部 .bd-group-heading 采用小号等宽序号徽标 01、02、03、04，搭配 14.5px 标题与简要副标题，间距紧凑自然。
- 锚点交互规范：点击锚点通过原生 scrollIntoView 定位并为目标元素赋予聚焦态，严格保持 window.location.search 中的 day 与 tab 参数不重置，支持键盘无障碍访问。

## 5. 排版尺寸与展开规范
- 模块卡片：保留两张双模块卡，min-height: 58px，自适应屏幕宽度。
- 4 格 KPI 卡片：采用中性白底、细灰边框与 2.5px 语义色顶边；主数值统一为 23px 炭灰加粗，去除彩虹底色。
- 图表绘图区：统一设置 min-height: 240px 至 280px（趋势图），采用相对弹性高度，轴线与图例留足空间，严禁硬性固定高度截断内容。
- 原文与归因：日常重点动作直接透出，长归因文字收纳于 <details class="bd-aspect-details">，点击即可无缝平滑展开。

## 6. 验收标准
- 页面彻底去除深蓝渐变页头与全页泛蓝卡片描边，统一呈现质感高级的暖中性灰白基调。
- 全页同质化三栏机械卡片清空，替换为紧凑单行 Insight 卡，页面纵向噪音消除。
- 双模块切换卡与 ProjectShell 风格统一，图表配色与图例严格遵照统一调色板。
