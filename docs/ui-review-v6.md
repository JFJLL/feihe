# UI 优化分析与验收记录（第六轮）

日期：2026-10-24。工作分支：`codex/ui-polish-v3`。

## 审查依据

本轮主代理亲自检查页面组件、布局规则、图表计算和本地项目接口中的来源快照，子代理执行明确的代码修改。本轮没有重新同步飞书；以下数量来自当前项目接口，不代表飞书实时数据。

| 项目 | 当前数据结构 | 展示中必须保留的边界 |
| --- | --- | --- |
| 黄天鹅 | 6 个来源、25 张业务表、5 组分日数据 | 品牌/CID 19 天，商销 85 天，不能合并成同周期总量 |
| 美菱 | 16 个来源、41 个指标、33 张业务表 | 618、双11、手工日报与线上快照独立；初筛提报池不等于合作达人 |
| 凯乐石 | 19 个来源、12 个指标、25 张业务表 | 预算超支必须保留；UV 为零时不能把未知 CPUV 显示为零成本 |
| 酒精湿巾 | 16 个来源、24 个指标、25 张业务表 | 周报与日报周期不同；日报的“达标”文字不能覆盖源表目标差异 |

## 页面调整决策

| 页面 | 主要问题 | 调整方向 |
| --- | --- | --- |
| 项目总览 | 大卡片外边距与父容器 gap 叠加；导航、周期和指标缺少清晰主次 | 父容器统一负责大区块间距；概览与分日入口集中；周期跟随对应业务区块 |
| 投流分析 | 过多双轴组合图；部分新增图形把缺失值画成比例，或用任意阈值标优劣 | 趋势、结构、成本、排名使用不同展示；保留真实比例与对比方向；去掉无依据的评级 |
| 内容与评论 | 执行进度与明细缺少间隔；评论详情切换存在 Hook 顺序问题 | 统一大区块与内部卡片层级；保留明细入口；修复详情返回及自定义筛选控件 |
| 行业分析 | 五个视图切换不突出；采集状态与数据解释分散 | 五项主切换保持显眼；状态集中；保留样本覆盖范围及独立查询不可相加的说明 |
| 项目设置 | 成员入口重复；任务目标、主线费用、验收标准和词库混杂；原生确认框 | 资料与成员合并；目标、验收、识别规则分区；保存全部配置入口独立；数据源与集成状态紧凑化 |

设置保留团队看板、项目指标、项目报告入口以及旧地址兼容，不能用删除入口来减少视觉复杂度。文案优先说明业务含义；移除装饰性英文眉题、中点分隔及重复操作说明。

## 统一规格

- 大区块间隔 28px，内部卡片间隔 16px，主卡片内边距 24px；避免 gap 与外边距重复计入。
- 字阶为 12、14、16、22px，利用字重和颜色区分其他层级。
- 主卡片圆角 12px，内部卡片/控件圆角 8px；边框 0.5px。图表描线和键盘焦点不按边框削薄。
- 使用 Radix Slate 中性色、Teal 主色及语义色；1–2 作背景，3–5 作状态底色，6–8 作边框与焦点，11–12 作文本。JavaScript 图表中需要拼接透明度的颜色保留对应 Radix 十六进制值。
- 取消装饰性侧边彩线与悬停位移；必要过渡采用 250ms ease-out。

色阶依据：[Radix Colors 使用规范](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。

## 根因、修复与证据汇总

| 页面 / 模块 | 根因 | 修复方案 | 真实浏览器验收证据 |
| --- | --- | --- | --- |
| 行业总览与指标 | section inline margin 28px 与 tab-content gap 28px 叠加；KPI 卡 subtext 长度不同导致数值行 Y 坐标错位 | 移除 inline margin，CSS 单点定义 gap 28px；badge 移入 metadata，固定 top 24px，统一缺值状态与 disclosure | 宏 gap 28px；6 卡数值行基准线统一为 y=377.33；截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-industry-desktop-after.png` |
| 日期与日报诊断 | 业务日期仍用原生date输入；KPI到下方图表间距仅4px | 接入共享CustomDatePicker并补齐快捷面板焦点处理，间距16px | 输入 2026-10-18 浏览器 history 条目 +1、KPI 变为 22901.72，非法日期报错且 URL 不变，Escape 回焦；截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-daily-calendar.png` |
| 评论与详情链路 | 评论详情切换存在条件 Hook 顺序问题；移动端侧边栏高度未按视口自适应 | 修复 Hook 调用顺序确保组件重入稳定；移动端侧边栏采用弹性收拢 | 详情进入与返回无 Hook 错误；移动端侧边栏高度由 280px 降至 86.5~88px，label 均可用；截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-comments-mobile-final.png` |
| 项目设置与网关 | 装饰英文眉题「AI GATEWAY」占位；h3 标题冗长；Base URL/令牌池文案偏底层；statusText 含中点 | 移除英文眉题，h3 简化为「模型网关」；Base URL 改为「服务地址」，令牌池改为「可用模型」；输出端中点转斜杠 | 模型网关状态呈现「文本模型可用 / 生图配置已保留」；手机端返回与选择器无重叠，保存 CTA 与助手按钮无碰撞；截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-settings-mobile-final.png` |
| 图表与移动溢出 | 宽网格导致移动端横向截断；热力图矩阵撑开整页宽度 | 引入响应式断点与最小宽度限制；热力图矩阵改为局部横向滚动 | 美菱图表移动端自适应正常（截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-meiling-chart-mobile-final.png`）；全棉时代 wipes 宽度 524→390px（截图 `C:/Users/liuhao_PC/AppData/Local/Temp/ui-v6-wipes-mobile-after.png`）；黄天鹅 ads 489→390px；overview 热力图 696→390px 矩阵局部横滑已回验 |

## 真实浏览器复验记录（2026-10-24）

上一阶段连接阻塞已解除，主代理通过 Chrome 恢复 Kimi 扩展，针对指定路径完成 1440px 桌面端与 390px 移动端真实浏览器验证（其他未测路径不声称穷尽）。所有操作基于本地已有数据，未执行 UI 保存、删除或外部同步。

- **覆盖范围**：黄天鹅（overview/ads/content/daily/settings 4 面板/industry 5 tab）、美菱（ads）、凯乐石（content）、全棉时代（overview）、飞鹤启萃（comments 队列及详情）。
- **交互与按键**：行业主 tab 支持 Home/Right/End 切换焦点与选中；设置 Profile 弹窗经真实鼠标操作验证，按 Escape 仅关闭 select 浮层并保留外层 dialog（此前误关排查为 Kimi synthetic click 未聚焦的测试方法问题，非代码缺陷）；月份选择器 Escape 正常回焦。
- **图表生命周期**：Chrome 下通过临时 React.StrictMode 夹具验证 Butterfly 与 Scatter 经历「空 → 有 → 空」（2 次空状态 → 有图 → 2 次空状态，errors: []）；275px 窄屏散点图 viewBox 为 275，500px 恢复桌面规则；夹具已移除。

## 外部变动与数据说明

后端测试 `test-huang-tiane-backend` 调用 onboard 导致 `docs/new-projects-sources/huang-tiane/integration/snapshot-preview.json` 自动变动，已查明来源系测试产物而非人工编辑，本地保留并排除在本次 UI 代码提交之外。

## 验证状态

- **生产构建与类型**：`build` PASS，`typecheck` PASS（0 错误）。
- **自动化测试**：主代理共 27 个脚本 PASS。包含 `verify:dashboards` 7 脚本、14 个既有聚焦脚本、6 个新增跟进脚本（`test-campaign-browser-followup`、`test-chart-mobile-readability`、`test-daily-browser-followup`、`test-industry-browser-followup`、`test-note-operations-ui-followup`、`test-shell-browser-followup`；新增脚本性质为静态/SSR/模拟 handler，真实浏览器由主代理单独验证）。
- **样式审计**：CSS 规则与 inline 审计结果 `[]`。
- **代码规范**：全仓 79 个既有 error、0 新增 error，新增测试 eslint 0 warning；不称“全部 lint 通过”。
