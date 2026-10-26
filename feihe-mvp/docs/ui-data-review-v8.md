# UI 与数据对齐审查报告 (v8)

## 1. UI 审查已发现与修复项

> 说明：本节记录主审已定位并在代码中落实的修复项，整体效果待主代理完成全部数据与浏览器验收，不作全盘通过的盲目承诺。

### 1.1 扁平 DayNavigator 统一导航组件
- **组件落地**：新建共享 `components/ui/DayNavigator.tsx` 与 `DayNavigator.css`，提供 `value`、`onChange`、`min`、`max`、`latestDate`、`ariaLabel`、`id`、`disabled` 标准接口。
- **外观扁平**：移除旧版 `ca-date-single-box` 外层独立边框、嵌套包装盒与重复冗余的“快捷选日”长下拉面板。
- **规范尺寸与无动画**：控件高度与 Header tabs 严格对齐至 36px，移除缓动 transition 动画。
- **自然日步进与边界隔离**：前后步进按 UTC ISO 严格增减 1 个自然日（保护 4 位年份边界），到达 `min`/`max` 边界自动禁用，缺日诚实显示空态而不进行静默篡改。
- **移动端自适应（≤480px）**：步进按钮自动隐藏文字标签、保留 36px 触控区 SVG，输入框 `flex: 1 1 auto;` 弹性收缩，保证跨模块调用（如 Qicui）不撑宽容器。

### 1.2 刷新按钮行为与 Header 适配
- **真实本地只读**：按钮文案调整为“重新加载”，title 明确标注“重新读取已同步数据”；底层仅触发本地 `fetchDashboard(projectId)`（GET 请求），不发起任何远程飞书同步。
- **清除内联碎样式**：统一收归 `.ca-subnav-reload-btn`，无旋转动画，高度 36px。
- **极窄屏（320px）防裁切适配**：
  - 现象：在 320px 视口下，`tabsSlot`（数据总览/分日看板）横向挤压导致右侧操作按钮被裁剪移出视口（参考截图：`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-wipes-320.png`）。
  - 修复：在 `campaign-shell.css` 中为 Campaign 祖先容器的 `.dashboard-template-header-controls` 增加响应式换行规则，在 `≤480px` 视口下让 actions 另起一行并右对齐展示完整 36px 按钮，杜绝溢出裁切。

### 1.3 分日看板单行工具栏与状态文本
- **单行平整工具栏**：整合数据集选择与 `DayNavigator` 于同一平整白色工具栏，删除与下拉框完全重叠的稳健玉米酒精湿巾视角独立切换按钮。
- **分析范围移动端单行锁定**：scoped 指定 `.ca-daily-toolbar .ca-dataset-picker-item` 为 `flex-direction: row; justify-content: space-between;`，解决移动端标签与 Select 居中折为两行的问题（参考截图：`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-daily-mobile-calendar.png`）。
- **状态文本精简化**：去除中点“·”、emoji 与内联颜色字体，右侧仅保留右对齐的“数据截至 YYYY-MM-DD”与“N个采集日”，不再向状态栏重复冗长区间。

---

## 2. 数据事实确认（由主代理确认）

以下数据口径与底表事实已由主代理完成核对，已在当前worktree应用并完成回读：

1. **飞书反馈与日报关系**：
   - `YIXH` 为反馈文档，`DuDU` 为其内部引用的日报文档。
   - `rev7071` 记录覆盖至 2026-10-26，实际周报业务数据截至 2026-10-22。
2. **黄天鹅品牌聚合口径**：
   - 统一采用底表 `637ef8` 汇总口径，剔除异常分表 `Nm3Sev`。
3. **CID 对投数据**：业务流水截至 2026-10-25。
4. **电商业务流水**：实际业务流水截至 2026-10-22。
5. **稳健玉米酒精湿巾投放流水**：分日记录截至 2026-10-25。
6. **美菱五个分日渠道数据**：全渠道统一截至 2026-10-25。
7. **凯乐石日流水记录**：分日记录截至 2026-10-12，严格保留实际采集记录，不人工捏造补全缺失日。

---

## 3. 剩余活跃副本表清单

目前系统内仍处于活跃引用的副本表（从 `data_sources` 读取权威 `spreadsheet` 地址，一份对应多个工作表按一份计）：

- [黑山Q3-种草投放数据 副本](https://yimeichuanbo.feishu.cn/wiki/H9y3wPrjQi817YkAyrvcaxzAncg)
- [黑山Q3日常双周会小结资料 副本](https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf)

---

## 4. 原表替换与口径规则

1. **启萃关键词与评论执行原表替换**：
   - MRIN 工作表映射至 Wiki 节点：[SbeDwPXAIicEimkRxDVco5I6nse?sheet=154ce5](https://yimeichuanbo.feishu.cn/wiki/SbeDwPXAIicEimkRxDVco5I6nse?sheet=154ce5)
   - 来源底表从 `XTFW` 替换至 Wiki 节点：[PGZIwT0Y0iUoIBkAoJVcI9MAnKb](https://yimeichuanbo.feishu.cn/wiki/PGZIwT0Y0iUoIBkAoJVcI9MAnKb)
2. **关键词统计口径**：
   - 原表标题标注近三日，但未给出具体起止日期；按原表当前快照展示，不推算时间窗口，也不标注月累计。
3. **既有数据源链接更新**：
   - 对美菱3条、黄天鹅2条现有数据源登记更新原表链接；另停用黄天鹅备用副本。

---

## 5. 主代理最终验收结论与验证证据

### 5.1 真实 HTTP 回读校验（主代理 Kimi 验证）
- **黄天鹅分日看板**：
  - 默认业务日期回读为 `2026-10-25`。
  - 核心指标：品牌消耗 `¥50,097.74`，展现 `956,695`。
  - 边界控制：步进至最新数据日后，后一天（后一日）按钮处于 `disabled` 禁用状态。
- **飞鹤启萃看板**：
  - URL 无 `day` 参数时默认业务基准日为 `2026-10-26`，实际数据截至 `2026-10-22`。
  - 关键词作用域显示为“近三日”，CPUV 及各项派生指标计算正确。

### 5.2 视口与排版巡检（主代理截图 Inspect 确认）
- **桌面 1651px 视口**：
  - 截图归档：`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-huang-final.png`、`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-qicui-final.png`，布局完整无瑕疵。
- **移动端 390px 视口**：
  - 启萃数据总览（Overview）与分日看板（Daily）排版自适应正常，无横向溢出。
  - 截图归档：`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-daily-mobile-calendar.png`。
- **极窄屏 320px 视口**：
  - 稳健玉米酒精湿巾（Wipes）整页自适应无溢出。
  - Header 重新加载按钮经换行右对齐修复后，完整保留 36px 尺寸与 SVG 触控区（截图归档：`C:\Users\liuhao_PC\AppData\Local\Temp\ui-v8-wipes-320.png`，稍后完成复查）。

### 5.3 构建、回归测试与静态检查
- **构建与类型检查**：`npm run build` 与 `npm run typecheck` 全数通过（exit code 0）。
- **看板关键回归测试**：主代理 `npm run verify:dashboards` 7 项全数 PASS。
- **组件及分日专项单测**：
  - `scripts/test-day-navigator.mjs`：通过（覆盖边界禁用、4位年保护、动态 ID、disabled 拦截）。
  - `scripts/test-daily-browser-followup.mjs`：通过（覆盖 DayNavigator 挂载、无中点/emoji/内联样式、空态说明）。
  - `scripts/test-daily-single-selection.mjs`、`scripts/test-overview-daily-render.mjs`、`scripts/test-campaign-daily.mjs` 全数通过。
- **ESLint 检查声明**：
  - 本轮修改文件（`DayNavigator.tsx`、`CampaignDailyPage.tsx`、`CampaignWorkspace.tsx`）ESLint **0 error, 0 warning**。
  - 全仓范围因存在既有历史未迁移脚本错误，整仓未通过，严禁虚报“全仓 Lint 通过”。

### 5.4 真实数据库合并归档
- **执行结果**：DB Merge 脚本 exit code 0 顺利完成。
- **合并前底表备份**：`.verification/live-sync-20261026/live-backup-pre-merge-2026-10-26T04-09-54-970Z.db`。
- **配置版本**：Config v9。
- **入库规模**：
  - 关键词有效流水行：`100` 行。
  - 评论口碑记录：`31,546` 条成功捕获。
