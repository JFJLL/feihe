# 营销战役富页面（Ads / Content / Settings 与导航）独立验收报告

本报告记录对美菱 (`meiling`)、凯乐石 (`kailas`)、全棉时代 (`winner-wipes`) 三个营销战役项目在独立浏览器会话 `campaign-rich-pages-qa`（视口 1440×900 与 390×844，服务端口 5173）下的实际功能与 UI 框架落地验收结果。

---

## 一、UI 框架对齐启萃规范与轻量化落地

1. **DashboardFrame 与真实 Project 上下文接入**：
   - [CampaignWorkspace.tsx](../../feihe-mvp/features/campaign/CampaignWorkspace.tsx) 统一接入启萃同款 `DashboardFrame`（`content_marketing` 预设，真实读取 `ProjectContext` 避免伪造对象）。
   - 全页面保持单一语义化 `h1`（由 Frame 统一提供项目名称与部门说明）；各子页面原本重复项目名与大标题均降级为紧凑工具条 `h2` / `bd-toolbar-compact`。
   - 顶部提供标准 `button button-secondary` 刷新动作，在 390px 移动端增加 `white-space: nowrap; flex-shrink: 0;` 防止折行。

2. **总览入口卡片与 Tabpanel 语义映射**：
   - 移除原手写小 pill 栏，接入 `WorkspaceModuleTabs`（`cards` 变体，包含「数据总览」与「分日看板」两张卡片）。
   - 双向关联无障碍属性：`aria-controls="workspace-tabpanel-{overview|daily}"` 与对应 `role="tabpanel"` / `aria-labelledby` 严格 1:1 对齐。

3. **四子页面 Header 规范化与数据集命名修正**：
   - [CampaignOverviewPage.tsx](../../feihe-mvp/features/campaign/CampaignOverviewPage.tsx)：标题简化为「数据总览」，业务快照保留单选切换。
   - [CampaignDailyPage.tsx](../../feihe-mvp/features/campaign/CampaignDailyPage.tsx)：标题简化为「分日看板」，分析范围标签去内部化；`meiling-daily-cid-jd` 准确映射为「京东对投 CID」（非自采天猫），保留 fallback 原标签不猜测。
   - [CampaignAdsPage.tsx](../../feihe-mvp/features/campaign/CampaignAdsPage.tsx)：标题简化为「投流分析」，徽标为「投放看板」。
   - [CampaignContentPage.tsx](../../feihe-mvp/features/campaign/CampaignContentPage.tsx)：标题简化为「内容管理」，徽标为「内容看板」；针对 Kailas 单一目标标靶图限制 `maxWidth: 680`，避免放大引起半屏空白。

4. **样式规范与隔离**：
   - 新增 [campaign-shell.css](../../feihe-mvp/features/campaign/campaign-shell.css)，只声明工作区级透传与紧凑工具条样式，复用启萃已有底层组件样式，未改动全局样式与图表内核。

---

## 二、关键功能交互与数据保真验收

1. **内存级 Page.route 反例验证（诚实缺失与非硬编码）**：
   - 劫持 `/api/campaign-dashboard?projectId=meiling`：
     - 将 `meiling-enrich-matrix-product-stage` 首行 count 置为 `null`：矩阵单元格呈现 `—`，对应行合计、列合计与全案母集（Subtitle）同步回退呈现 `—`，严禁伪完整「117 位」。
     - 将 `meiling-enrich-content-theme-format` 首行 format 置为「未注明」：准确归入「其他形式」统计，严禁误归入视频。
   - 验证完成后即时执行 `unroute` 并刷新真实页面，数据完全恢复。

2. **美菱 (Meiling) 投放与内容交互**：
   - 投流页：支持「全部渠道 / 天猫渠道 / 京东渠道」切换，Top 8 商单与气泡散点图联动响应；支持「全量 / ≥1000 / ≥5000」最低消耗过滤联动。
   - 内容页：支持「主推产品 × 阶段」与「外溢平台 × 阶段」矩阵切换，二核确认母集 117 位、正式已发布 50 篇（同口径占比 42.7%）数据自洽。

3. **凯乐石 (Kailas) 投放与内容交互**：
   - 投流页：支持 FS 版位 (视频/搜索/信息)、UGC 汇总与预算规划视图切换；ComboChart 双轴单位自适应。
   - 内容页：规划目标标靶图（限制 680px 宽度）、自然/付费内容对比与素材费用结构各图例/柱体渲染正常。

4. **全棉时代湿巾 (Winner-wipes) 投放与内容交互**：
   - 投流页：支持「定向人群包 (Top 8)」与「关键词 (Top 8)」联动切换；4 主体 + 2 深度图表结构完整；底表折叠明细可正常展开。
   - 内容页：旧 2 图（达人矩阵结构 Donut + 内容效果 Bullet）+ 层级费用 + 方向效果共 4 图完整；KOL 30 篇与 KOC 86 篇基准口径保持独立。

5. **移动端 390×844 防溢出校验**：
   - 美菱内容页（含全宽热力矩阵）：`document.documentElement.scrollWidth === clientWidth === 390`，矩阵支持容器内水平轻滚，卡片外部无水平滚动条。
   - 美菱分日看板：顶部「↻ 刷新」按钮保持单行未折行。
   - 湿巾投流分析页：`document.documentElement.scrollWidth === clientWidth === 390`，无横向溢出。

6. **导航与多项目隔离**：
   - 侧边栏 4 项路由（`/projects/{id}`, `/ads`, `/content`, `/settings`）激活高亮与直接 URL 访问均匹配。
   - 数据源设置页（`settings?tab=data-sources`）可见 17 个切片来源模块；Overview 保持只读呈现，无数据源管理外壳。
   - 启萃项目（`/projects/qicui`）通过只读打开与烟测，保持原样未受干扰。

---

## 三、验收截图归档清单

所有实机截图均落盘于 `output/playwright/` 根目录，均在 0,0 鼠标静止态下抓取：

| 截图文件名 | 视口规格 | 说明 |
| :--- | :--- | :--- |
| `ui-reference-qicui-overview.png` | 1440×900 Full | 启萃总览参考基准 |
| `ui-reference-qicui-daily.png` | 1440×900 Full | 启萃分日看板参考基准 |
| `ui-reference-qicui-overview-viewport.png` | 1440×900 Viewport | 启萃总览首屏对照 |
| `ui-reference-qicui-daily-viewport.png` | 1440×900 Viewport | 启萃分日首屏对照 |
| `unified-meiling-content.png` | 1440×900 Full | 美菱内容管理（全宽矩阵 + 5 图完整） |
| `unified-meiling-content-viewport.png` | 1440×900 Viewport | 美菱内容管理首屏 |
| `unified-meiling-ads.png` | 1440×900 Full | 美菱投流分析 |
| `unified-meiling-overview.png` | 1440×900 Full | 美菱总览（Frame + 2 卡片入口） |
| `unified-meiling-daily.png` | 1440×900 Full | 美菱分日（京东对投 CID 正名） |
| `unified-meiling-daily-viewport.png` | 1440×900 Viewport | 美菱分日首屏交付标准 |
| `unified-meiling-content-390px.png` | 390×844 Viewport | 美菱内容移动端（0 横向溢出） |
| `unified-meiling-daily-390px.png` | 390×844 Viewport | 美菱分日移动端（刷新按钮单行） |
| `unified-kailas-ads.png` | 1440×900 Full | 凯乐石投流分析 |
| `unified-kailas-content.png` | 1440×900 Full | 凯乐石内容管理（标靶图限宽 680px） |
| `unified-kailas-overview.png` | 1440×900 Full | 凯乐石总览 |
| `unified-kailas-daily.png` | 1440×900 Full | 凯乐石分日看板 |
| `unified-wipes-ads.png` | 1440×900 Full | 全棉湿巾投流分析（4 主体 + 2 深度图） |
| `unified-wipes-ads-viewport.png` | 1440×900 Viewport | 全棉湿巾投流首屏 |
| `unified-wipes-ads-390px.png` | 390×844 Viewport | 全棉湿巾投流移动端（0 横向溢出） |
| `unified-wipes-content.png` | 1440×900 Full | 全棉湿巾内容管理（4 图完整） |
| `unified-wipes-overview.png` | 1440×900 Full | 全棉湿巾总览 |
| `unified-wipes-daily.png` | 1440×900 Full | 全棉湿巾分日看板 |
