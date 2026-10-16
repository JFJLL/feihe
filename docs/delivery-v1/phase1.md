# 第一批交付验收报告：分日看板可视化与投流占位 (Phase 1)

验收日期：2026-10-14  
交付工作区：D:/download/pic-vec/feihe-delivery-v1  
运行独立端口：5246（离线预览环境，与源 5236 严格隔离）  
独占实现与维护文件：
- feihe-mvp/features/overview/BusinessDailyBoard.tsx
- feihe-mvp/features/overview/BusinessVisuals.tsx
- feihe-mvp/lib/business-daily/highlights.ts
- feihe-mvp/styles/business-daily.css
- feihe-mvp/styles/business-visuals.css
- feihe-mvp/scripts/test-business-presentation.mjs

---

## 1. 核心变更与实现说明

根据业务实际需求与定向纠偏意见，分日看板拒绝“复制长文长表”或“另造图表平台”，在现有组件和真实底表数据基础上直接完成业务可视化重构：

1. **搜索侧结构化展示**：
   - 核心占位词（新生儿奶粉、二段奶粉推荐哪个）：使用专属卡片展示消耗金额、底表消费占比、源行CTR、星盟合并CPUV、搜索指数快照及日报登记 SOC/排名。对底表占比与日报占比差异主动标注黄色预警。
   - 成本基准对照：小红星与小红盟同月真实 CPUV 对照同月行业区间（SVG 刻度对照条），超出上限主动标红。
   - 关键词 TOP10 横向排行：根据 202 个关键词全量底表按消耗计算 TOP10 横向柱条，明细 202 个词与 40 篇高消耗笔记折叠于底部。
2. **信息流侧分群与快照**：
   - 星/盟独立拆分：小红星与小红盟独立展示各个人群包 CPUV 由低到高横向排序。
   - 竞品人群渗透快照：派星与 A2 至初展示单次渗透率快照、环比及体量说明，明确标注“无连续每日观测，不伪造历史趋势”。
3. **达人储备与当月产出**：
   - 按分层（初级、腰部等）拆解计划、已选、已发的三段进度条，并与最新执行底表 381 篇独立比对，保留口径差异。
4. **评论维护与整改状态**：
   - 规划 vs 登记进度条，纯文案（9,366 条）与 LIVE 图（3,301 条）双色堆叠条。明确标注“登记量不等于平台可见量”。
   - 底表 512 篇唯一在投笔记质量分布（合格/问题/冲突/未明确）横条，日报停投整改进度卡。40 篇高消耗笔记首屏展示，完整 512 篇按需分页展开。
5. **SEO 状态摘要**：
   - 收录进度（380/466）与 15/16 占位摘要卡；明确标记 `TOP3 / 逐日位置` 为“未知（源表未登记，不推算）”。16 词验收状态与分搜索量区间进度卡展开。
6. **首屏噪音消除与长文折叠**：
   - 去掉首屏内部 `sourceKey`、`schemaVersion` 调试信息，收纳至底部“查看来源与口径”或“差异清单”折叠区。
   - 保留最大 FS 预算与实际累计消耗图，累计值在缺失日期自然断开。

---


### 1.1 数据口径严谨性与异常值防护

根据数据审计与业务口径要求，重点强化了以下边界防护机制：
1. **CPUV 零值语义与排行防护**：
   - 底表中存在 74 个关键词的 CPUV 原始值为 `0`（如消耗 469 元但无 UV 进店样本）。
   - 系统坚决杜绝将 `0` 当作“最优超低成本”排入红星/红盟排行首位，统一打标为「原值 0 · 待确认」，并在 SVG 基准图中用灰色圆点及专属标签标明「原值 0（待确认）」，保留原始底表数值追溯。
2. **严格同口径/同月基准对照**：
   - 仅对所选日期月份与基准完全一致的记录做星/盟独立对照（如 10 月只比对 10 月 benchmark），严禁跨月混用行业基准。
3. **文本解析防伪造验证**：
   - 自动化回归测试（`scripts/test-highlights-regression.mjs`）覆盖了 10-13、10-14 两个真实日期及缺失正文/错月反例：
     - 正则未匹配到的文本段落保留 `null`（页面展示「—」或「未登记」），坚决不伪造为 `0`。
     - 错月段落自动隔离，不强算改善或降本效果。


### 1.2 业务人员配置抽屉与权限隔离 (BusinessConfigDrawer)

针对新项目只有 API 缺乏可视化配置界面的缺口，按极简原则补齐了管理入口：
1. **组件实现与位置**：
   - 新增组件 `features/overview/BusinessConfigDrawer.tsx`，在 `BusinessDailyBoard` 管理员顶栏挂载「配置业务来源与规则」按钮。
   - 严格在 `canWrite` 为 `true` 时才向用户呈现配置按钮；非写权限角色（如 `user-viewer`）界面上彻底隐藏该入口，且后端 API 对未授权写入保持 403 严格拒绝。
2. **字段支持与业务友好化**：
   - 支持本品品牌词（`brands`，逗号分隔录入）、竞品对比词（`competitorWords`）、FS业务落后预警阈值（`alertThresholdPoints`）。
   - 来源绑定列表支持动态新增、删除与编辑，包含英文唯一标识（`key`）、业务友好标注的中文角色下拉选项（如 `周趋势底表 (weekly)`、`关键词底表 (keywords)` 等 16 种合法业务角色），以及 http/https URL 地址合法性校验。
   - 保留全量 rawConfig，在保存时深度融合并剔除只读 version，防止丢弃未呈现的其他配置字段；配置发生并发修改（409）时自动提示并保留本地草稿不丢失。
3. **真实隔离项目实操验收**：
   - 在独立空项目 `business-isolated-2` 上执行了完整的抽屉创建、表单录入与持久化保存演练（脚本 `scripts/test-drawer-interactive.mjs`），未修改真实 `qicui` 生产配置。
   - 保存后接口读取验证其持久化结构完全生效，版本自增至 v1，再次打开抽屉回填无误。
   - 截图证据：
     - 初始打开抽屉：`D:\download\pic-veceihe-delivery-v1\docs\delivery-v1\screenshots\drawer-01-isolated-open.png`
     - 填写品牌、竞品词与来源表单：`D:\download\pic-veceihe-delivery-v1\docs\delivery-v1\screenshots\drawer-02-isolated-filled.png`
     - 持久化后重新打开回填与版本递增：`D:\download\pic-veceihe-delivery-v1\docs\delivery-v1\screenshots\drawer-03-isolated-reloaded.png`

## 2. 真实浏览器验收结果 (Playwright / Chromium 5246)

通过独立自动化浏览器脚本 `scripts/test-business-presentation.mjs`，执行了全部边界与视口真实验收：

- **10-13 正常投放日 (1440x900)**：
  - 指标概览：4 项核心 KPI，2 项今日动作，2 核心词卡，4 排行榜，4 成本基准对比 SVG，3 达人分层进度条，1 整改状态分布条，16 个 SEO 验收词，20 篇重点高消耗笔记，139 个折叠区。
  - 验收结论：通过。图表、文字、折叠、数据对齐无横向溢出。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\10-13_1440-view.png`

- **10-13 窄屏桌面 (1280x800)**：
  - 表现特征：双列与排版自适应无遮挡，横条和 SVG 比例适配良好。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\10-13_1280-view.png`

- **10-14 最新日 (1440x900 & 1280x800)**：
  - 表现特征：4 KPI 中由于当天输入尚未回填展示为未采集，今日动作多出 1 条“投放实际数据待补齐”预警；数据截至 10-13；不编造当天平滑走势。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\10-14_1440-view.png`、`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\10-14_1280-view.png`

- **跨月边界 09-30 (1440x900)**：
  - 表现特征：统计区间严格为 09-01 至 09-30，未混入 10 月预算或当月产出。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\cross_month_09-30_1440-view.png`

- **未来跨月 11-01 (1440x900)**：
  - 表现特征：数据截至 10-13，未来日期保留空状态与真实缺失提示，无白屏或异常报错。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\cross_month_11-01_1440-view.png`

- **第二项目隔离 (business-isolated-2)**：
  - 表现特征：未配置数据源的项目展现标准 EmptyState（“本项目尚未绑定业务日报来源”），无越权或缓存数据泄露。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\isolated_empty_project_1440-view.png`

- **投流占位页 (/projects/qicui?tab=ads)**：
  - 表现特征：展示标准的投流分析占位卡片与说明，原内容营销与数据导航无冲突。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\ads_tab_placeholder_1440-view.png`

- **交互与折叠展开**：
  - 表现特征：测试点击展开“占位词下高消耗笔记”、“板块负责人”等折叠区，底表数据正常渲染且无布局错乱。
  - 验收结论：通过。
  - 截图绝对路径：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\10-13_details_expanded.png`

---


### 2.1 浏览器实际动态交互实证 (Playwright Chromium)

为明确区分「静态全量快照渲染」与「用户在浏览器中的实际交互操作」，通过脚本 `scripts/run-interactive-browser-evidence.mjs` 单独录制并截图了用户在浏览器中的 5 个核心动态交互步骤：

1. **日期选择器切换 (2026-10-13 → 2026-10-14)**：
   - 行为：真实浏览器点击修改输入框为 `2026-10-14`，触发全局 URL 同步与 `summary=1` 重拉取，首屏自动补齐「投放实际数据待补齐」提示。
   - 截图：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\interactive-01-date-switch-1014.png`
2. **明细展开与 409 来源指纹绑定**：
   - 行为：点击展开「关键词消耗排行（202条）」，触发 `PagedDataTable` 根据 `fingerprint` 按需拉取第 1 页明细数据。
   - 截图：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\interactive-02-kw-page1-expanded.png`
3. **明细翻页交互（下一页明细）**：
   - 行为：在展开区内点击「下一页明细」，动态拉取第 21-40 条明细，分页指示更新为「第21–40条 / 202条」。
   - 截图：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\interactive-03-kw-page2-paged.png`
4. **切换已确认历史日报快照**：
   - 行为：下拉选择 `mode=confirmed`，页面标题与数据状态切换至「已确认快照」，未确认前不展示覆盖数据。
   - 截图：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\interactive-04-confirmed-snapshot.png`
5. **手动刷新按钮点击**：
   - 行为：点击顶栏「刷新」按钮，触发 `revision` 自增与重新拉取，首屏渲染平稳无闪烁。
   - 截图：`D:\download\pic-vec\feihe-delivery-v1\docs\delivery-v1\screenshots\interactive-05-refreshed-state.png`

---

### 2.2 验证方式严格区分声明
- **真实浏览器驱动验证 (Playwright Chromium 驱动 5246 端口)**：
  - 8 组页面全尺寸视口与边界快照（10-13 1440/1280、10-14 1440/1280、09-30 跨月、11-01 未来月、第二隔离项目、投流占位页）。
  - 5 组浏览器动态交互录制（日期切换、409 展开、分页按钮、快照选择、手动刷新）。
- **Node.js 自动化单元/回归测试（非浏览器渲染）**：
  - `test-highlights-regression.mjs`：正则文本解析抗崩溃、反例 null 保留、同月基准严格对齐校验。
  - `test-business-daily.mjs`：数据聚合、防伪造、不可变确认与隔离逻辑。

### 2.3 来源版本突变与过期指纹 409 拒绝实证

为严谨证明系统在底层数据发生突变或客户端使用过期指纹时的真实拒绝能力（而非仅仅在合法指纹下返回 200）：
- 在独立测试环境运行专用套件 `scripts/test-true-409-rejection.mjs`（针对隔离项目 `fixture-409-project`）：
  1. **过期指纹拉取明细拦截**：客户端携带过期/伪造指纹请求 `GET /api/business-daily?part=table`，接口严格返回 **HTTP 409 Conflict**，提示「来源版本已变化，请刷新日报后再展开明细」；
  2. **过期指纹确认归档拦截**：客户端携带过期指纹发起 `POST /api/business-daily action=confirm`，接口严格返回 **HTTP 409 Conflict**，提示「业务数据已变化，请刷新核对后确认」；
  3. **数据突变后翻页失效拦截**：底层重新入库新版本底表后，旧指纹发起的下一页请求被即刻拒绝（HTTP 409），彻底杜绝跨版本数据前后撕裂；
  4. **已确认日报未生成时的明确错态**：当所选日期尚未生成已确认快照时，切换至 `mode=confirmed` 明确返回 HTTP 404 及标准错态卡片，不显示回退内容。

## 3. 局限与未验证项声明

1. **真实数据缺失说明**：
   - 2026-10-14 投放平台原始输入尚未回填，系统如实展示“— 元（未采集）”，未人为生成模拟均值或推算走势。
   - 竞品人群资产仅有 10-11 单次快照，早阶占比与历史连贯趋势保持留空，等待后续真实数据源接入。
2. **聚光/京准通直接抓取凭据**：
   - 当前采用本地真实已导入快照核验；聚光、京准通、淘宝星河真实子账号与 Cookie 定时同步待相关账号授权明确后正式接入。
