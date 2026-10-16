# 飞鹤社媒增长中台 main 分支普通 5173 启动真实端到端验收报告

- 验收执行人：独立验收和唯一运行环境协调代理
- 验收时间：2026-10-16
- 验收环境：`127.0.0.1:5173`（标准 `npm run dev` 启动模式，Node runtime 直连 `data/local.db`）
- 浏览器上下文：全新 Chromium 实例，无测试请求头（无 `x-user-id`）、无预设 Cookie、无 `ENABLE_TEST_AUTH`、无 `NODE_ENV=test`

---

## 一、核心问题诊断与最终架构修复

### 1. 原普通 5173 启动身份受阻根因
- **现象**：普通浏览器访问 `http://127.0.0.1:5173/` 触发 401 拦截，提示“需要公司身份验证”。
- **直接成因**：
  1. `lib/api-auth.ts` 仅对特定测试目录（`.verification/`）放行无需签名的测试身份，普通开发环境强制校验网关 HMAC-SHA256 签名。
  2. 开发网关中间件在 `vite.config.ts` 中虽尝试注入签名头，但 `@cloudflare/vite-plugin` 的 `createRequest` 直接从底层 `req.rawHeaders` 原始字节数组重建 Web 标准 `Headers`，忽略了 Node 对象属性 `req.headers` 的修改，导致所有网关签名头在传递到 Vinext 应用层时被丢弃。
- **解决方案**：在 `vite.config.ts` 的 `devAuthGatewayPlugin` 中，同步过滤并重构 `req.rawHeaders` 数组，使生成的 HMAC 签名头顺利透传至应用层。

### 2. 数据库“双库分裂”（Split-Brain）根因与单库归一
- **现象**：认证打通后，启萃项目总览提示“本项目尚未绑定业务日报来源”，全部金额和图表无法显示。
- **排查发现**：
  1. 数据迁移工具将 14,637 行业务数据成功写入了主库 `data/local.db`（73MB）。
  2. 但 `vite.config.ts` 默认启用了 `@cloudflare/vite-plugin`，Miniflare 会在 `.wrangler/state/v3/d1/` 下单独创建虚拟 D1 数据库（7MB）。
  3. `lib/db.ts` 的 `db()` 函数优先检查 `workerEnvSync().DB`，导致运行时所有 API 均连接到 Miniflare 虚拟库，而该库中所有业务表行数全为 0。
- **解决方案**：明确拒绝启动复制与双写方案。修改 `vite.config.ts` 使普通开发环境默认运行在纯 Node runtime（不加载 Cloudflare 插件），直接读写唯一的 `data/local.db`；仅在构建或显式指定时启用 Cloudflare 插件。

---

## 二、主库数据迁移与备份独立对账审计

1. **备份时机确认**：
   - 备份文件 `data/local.db.backup.1792123183`（12,263,424 字节）仅包含 36 张历史旧表，无 `users` 表及任何业务表，证明备份确系在任何 Bootstrap 及数据迁移写操作之前生成。
2. **已有历史数据保护比对**：
   - 对原有 33 张表逐表计算 SHA-256 哈希，**31 张表保持 100% Bit-for-bit 完全一致**（包括历史操作日志、KPI 指标、评论记录等）。
   - 仅 2 张表有新增差异，且完全符合白名单设计：
     - `note_profiles`：从 1333 篇增至 1393 篇，为 60 篇竞品笔记补齐外键引用。
     - `note_covers`：从 70 条增至 130 条，为竞品笔记补齐 60 张封面元数据。
   - `projects` 表中启萃原有 13 项字段全量原样保留，仅空值补全了模板及向导状态，未篡改原有属性。
3. **业务数据量核对**：
   - `business_daily_reports`：28 篇
   - `business_note_archives`：937 篇
   - `competitor_notes`：60 篇
   - `business_comment_deliveries`：13,047 条
   - 8 项业务同步任务全部置为 `paused`，杜绝后台未经授权外挂抓取。

---

## 三、真实浏览器功能验收结果

在全新干净的无头 Chromium 浏览器（视口 1440x900）中执行端到端访问验证：

### 1. 项目中心 (Root)
- 顶部清晰标识当前用户为 `业务编辑者(张晓)`，具备 `本地开发` 标识。
- 展示启萃项目卡片（进行中、内容营销项目、1478 篇笔记、具备编辑权限）。

### 2. 2026-10-13 已确认历史业务日报
- 访问模式：`mode=confirmed`，日期：`2026-10-13`。
- **平台广告消耗 (`adSpend`)**：`¥275,326.74`
- **达人合作费用 (`creatorCost`)**：`¥36,344`
- **项目总投入 (`projectInvestment`)**：`¥326,140.74`
- **政策后结算金额 (`settlement`)**：`¥316,608.9`（原始值 `316608.8978`）
- **快照防伪指纹**：`f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e`，确认人 `user-admin`，真实历史数值完整展现。

### 3. 2026-10-15 最新分日看板与未到日截止标识
- 访问日期：`2026-10-15`（最新未确认日）。
- 顶部黄色横幅与核心卡片明确标注：**“实际数据截至：2026-10-14”** / **“最新截至 2026-10-14，缺失数值保留 —”**。
- 绝不将历史实数伪充为当天数据，合规性 100% 达标。

### 4. 内容管理与居中笔记详情弹窗
- 内容列表正常渲染笔记卡片与真实封面图片。
- 点击“查看笔记明细 →”正常弹出居中 `NoteDetailDrawer`，展示互动总数、情感分析分布及明细。

### 5. 报告工作台与设置中心
- **报告工作台与历史快照预览**：
  - 报告工作台正常加载 37 份历史报告清单。
  - 在此前自动化长截图中，沙箱预览区域曾呈现为白框；经进一步视口滚入校验与直接元素截屏（`07-qicui-reports-visible-preview.png`、`07-qicui-reports-iframe-content.png`）核实，iframe 真实内容已完整渲染：
    - 首份报告正文《启萃经营与社媒增长全景看板》包含 12 项 KPI（内容样本 39 篇、费用消耗 53,220 元、聚光总消耗 331,105.28 元、灵犀大盘均值 135,000 次等）以及分日走势、讨论主题、投放子账户明细等完整图表。
    - 交互切换历史报告：点击列表第二行“查看快照”（2026-08-05 至 2026-09-03），预览区即时切换为《社媒评论与舆情处置看板》（`07-qicui-reports-second-history.png`）。
- **设置中心**：正常展示项目资料、业务数据源（4 个飞书底表连接）以及项目成员矩阵（包含 4 名系统成员）。

### 6. AI 助手入口
- 页面右下角常驻悬浮入口 `.floating-agent-btn`，点击可呼出项目智能助手面板。

---

## 四、服务冷重启持久性与免测试环境验证

- **终止与冷启动验证**：
  1. 完全终止当前 5173 服务进程。
  2. 使用标准命令 `node scripts/dev.mjs` 重新拉起后台服务（分配全新 PID）。
  3. 创建全新的浏览器上下文重新访问各核心页面。
- **持久性结论**：
  - 首页依然稳定识别 `user-editor`。
  - 10-15 总览依然如实展示累计消耗 ¥3,915,166.16 与 10-14 截止日。
  - 10-13 历史确认快照的 4 项金额依然精准呈现。
  - 全程无需任何测试 Header 或特殊测试环境变量。

---

## 五、生产模式安全防越权负向测试

执行脚本 `scripts/test-production-security-negative.mjs`，5 项负向安全测试全部通过：
1. **生产模式匿名访问**：当 `REQUIRE_PROD_AUTH=true` 或 `NODE_ENV=production` 时，服务端拒绝注入本地开发身份，直接返回 401。
2. **伪造请求头防范**：直接传入伪造的 `x-user-id: user-admin`，服务端坚决不予采信并拒绝访问。
3. **伪造网关签名防范**：未持有真实网关 Secret 伪造的签名直接被 HMAC 验证拦截。
4. **跨站 CSRF 防范**：当请求带有非 Loopback 的外部 `Origin`（如 `http://malicious.evil.com`）时，开发网关插件拒绝授予身份。
5. **Sec-Fetch-Site 跨站防范**：当浏览器标明 `sec-fetch-site: cross-site` 时，拒绝授予身份。

---

## 六、可复用测试脚本与截图凭证索引

### 1. 可复用 Playwright 验收脚本
- 文件路径：`tests/browser/normal-startup-acceptance.spec.ts`
- 执行命令：`node node_modules/@playwright/test/cli.js test tests/browser/normal-startup-acceptance.spec.ts`
- 执行结果：**6 passed (33.9s)**

### 2. 视觉复核全量截图路径清单
- **首页项目中心（最终视口截图 · 主库环境）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\01-final-home-viewport.png`
- **10-15 最新分日看板（最终视口截图 · 主库环境）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\02-final-overview-viewport.png`
- **10-13 核心金额与确认快照**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\03-qicui-confirmed-13-amounts.png`
- **10-15 实际截止日期横幅**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\04-qicui-overview-15-status.png`
- **内容管理与真实笔记封面**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\05-qicui-notes-list.png`
- **笔记明细居中抽屉弹窗**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\06-qicui-note-modal-centered.png`
- **报告页面内视口截图（外层框架 + 预览正文）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\07-qicui-reports-visible-preview.png`
- **当前选中首份报告 iframe 真实渲染正文**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\07-qicui-reports-iframe-content.png`
- **交互切换第二份历史报告实测截图**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\07-qicui-reports-second-history.png`
- **项目设置与成员资料**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\08-qicui-settings.png`
- **智能助手 AI 入口面板**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\09-qicui-ai-entrance.png`
- **冷重启后项目中心持久性**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\10-restart-home-project-center.png`
- **冷重启后启萃总览持久性**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\11-restart-qicui-overview.png`
- **冷重启后 10-13 确认快照持久性**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\12-restart-confirmed-13.png`

---

## 七、数据同步调度器（Business Worker）独立运行与同库心跳验证

- **Worker 进程信息**：
  - 进程 PID：`39252`（由 `Start-Process` 以 Hidden 模式启动）
  - 启动命令：`node scripts/run-business-sync.mjs --watch --project qicui`
  - 工作目录：`D:\download\pic-vec\feihe\feihe-mvp`
  - 目标数据库：严格解析为主库 `D:\download\pic-vec\feihe\feihe-mvp\data\local.db`（绝无测试路径或特殊测试变量）
- **多轮 30 秒 Tick 与心跳实测**：
  - 连续观测到 5 次规律的 30 秒轮询 Tick：
    - Tick 1: `2026-10-16T04:45:18.995Z`
    - Tick 2: `2026-10-16T04:45:49.006Z`
    - Tick 3: `2026-10-16T04:46:19.011Z`
    - Tick 4: `2026-10-16T04:46:49.011Z`
    - Tick 5: `2026-10-16T04:47:19.020Z`
  - 心跳记录持续稳定写入主库 `business_sync_worker` 表。
- **任务隔离与防外抓验证**：
  - 任务矩阵状态：共 8 项任务，精确配置为 **7 项 active + 1 项 paused**。
  - 7 项 active 任务的 `next_run_at` 全部落在 6 小时之后（最早为 18:44 北京时间，逐项错峰 20 分钟）。
  - `comments-register-2026-10` 任务保持 `paused`。
  - 经底层 SQLite 实查，当前处于认领态的任务数（`lease_token IS NOT NULL`）为 **0 项**，确认**绝未发生提前认领或未经授权的外挂抓取**。
- **D1 虚拟库零写入验证**：
  - 核验 `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b...sqlite` 的最后修改时间保持为 `12:22:27`，整个 Worker 运行期间 D1 物理文件未发生任何修改与写入。

---

## 八、主库（main / data / local.db）最终运行时刻统计

| 数据表名 | 核心含义 | 最终确凿行数 |
| :--- | :--- | :--- |
| `business_daily_reports` | 历史业务日报快照（含 10-13 确认快照） | **28** |
| `business_note_archives` | 业务笔记归档快照 | **937** |
| `competitor_notes` | 竞品笔记样本库 | **60** |
| `business_comment_deliveries` | 评论核销交付明细 | **13,047** |
| `business_captures` | 原始抓取快照 | **51** |
| `business_source_heads` | 业务来源最新有效 Head 指针 | **26** |
| `business_sync_receipts` | 抓取凭据与同步状态收据 | **86** |
| `business_platform_observations` | 平台分日观测数据 | **40** |
| `business_sync_tasks` | 数据源同步任务（7 active + 1 paused） | **8** |
| `business_sync_worker` | 调度器常驻心跳 | **1** |
| `business_project_config` | 启萃业务来源绑定与规则配置 | **1** |
| `projects` | 启萃项目主体 | **1** |
| `users` | 系统平台用户（含 `user-editor`） | **4** |
| `project_members` | 启萃项目成员矩阵 | **4** |
| `report_versions` | 历史报告版本记录 | **37** |
| `notes` | 笔记台账总数 | **1,479** |
| `note_covers` | 笔记本地封面元数据 | **1,418** |
| `note_project_profiles` | 项目私有笔记属性 | **1,537** |

---

## 九、外部平台现场同步前只读基线审计（Pre-Sync Baseline）

- **验收执行人**：独立验收和唯一运行环境协调代理
- **基线审计时间**：2026-10-16
- **服务状态**：
  - Web 5173 服务：稳定运行于 PID 5084（Node runtime 直连主库 data/local.db）
  - 调度器 Worker：运行于 PID 39252（等待数据代理执行现场同步，本代理不启停 worker）
  - 数据库环境：严格为主库 D:\download\pic-vec\feihe\feihe-mvp\data\local.db
- **浏览器上下文**：全新无头 Chromium 实例（视口 1440x900），无测试头（无 x-user-id）、无测试 Cookie、无 ENABLE_TEST_AUTH、无 NODE_ENV=test

### 1. 业务基准日期与采集时间语义界定
- **选择基准日**：2026-10-15（最新日报选择日）与 2026-10-14（最新完整业务数据日 / 实际数据截止日）。
- **时间语义严格区分**：
  - 最新日报选择日：2026-10-15
  - 实际业务数据截止日（businessThrough）：2026-10-14
  - 最新底层数据抓取时间（capturedAt）：2026-10-15T10:29:54.327Z
  - **核心语义原则**：底层采集时间更新不等于业务数据日期更新。周底表（weekly-q4）10-15 当日数据尚未登记，公式默认零不作为有效观测，API 返回 state: "not_collected"，前端保持 "—" 展示，不伪装全区间合计，杜绝假最新或虚假补零。

### 2. 核心金额与口径基线（2026-10-15 视图）
- **单日核心 4 项（10-15 当日）**：
  - 平台广告消耗 (adSpend)：null（状态：not_collected，来源：weekly-q4 行 21 列 50）
  - 达人合作费用 (creatorCost)：null（状态：not_collected，来源：weekly-q4 行 21 列 41）
  - 项目总投入 (projectInvestment)：null（状态：not_collected，来源：weekly-q4 行 21 列 46）
  - 业务结算金额 (settlement)：null（状态：not_collected，来源：weekly-q4 行 21 列 52）
- **最新有效单日（10-14 实际数据日）**：
  - 平台广告消耗 (adSpend)：¥184,018.36（状态：observed，来源：weekly-q4 行 20 列 50）
  - 达人合作费用 (creatorCost)：¥30,560.20（状态：observed，来源：weekly-q4 行 20 列 41）
  - 项目总投入 (projectInvestment)：¥219,978.56（状态：observed，来源：weekly-q4 行 20 列 46）
  - 业务结算金额 (settlement)：¥213,388.4022（UI展示：¥213,388.4，状态：observed，来源：weekly-q4 行 20 列 52）
- **统计区间累计（2026-10-01 至 2026-10-15，有效覆盖 14 个观测日）**：
  - 平台广告消耗累计：¥3,915,166.16（覆盖 14 个有效观测日，日均 ¥279,654.73）
  - 达人合作费用累计：¥515,356.70（覆盖 14 个有效观测日，日均 ¥36,811.19）
  - 项目总投入累计：¥4,561,842.86（覆盖 14 个有效观测日，日均 ¥325,845.92）
  - 业务结算金额累计：¥4,426,350.39
- **月度大盘快照（2026-10-15）**：
  - 月累计结算 (monthlySettlement)：¥5,068,518.43（状态：observed，来源：platform_snapshot-2026-10-15，版本 435，进度 42.24%）
  - 月度预算 (monthlyBudget)：¥12,000,000.00

### 3. 趋势时序与末端状态
- **系列长度**：共 15 个点（2026-10-01 至 2026-10-15）。
- **末端点（2026-10-15）**：所有 4 项核心指标均为 state: "not_collected"，未采集状态。
- **倒数第二点（2026-10-14）**：4 项指标全部为有效观测值（observed）。

### 4. 星盟电商漏斗覆盖与分母基线
- **星图（Star）**：
  - 覆盖范围：13/15 天（2026-10-01 至 2026-10-13），底表 10-14 ~ 10-15 暂未回传。
  - 观测指标总量：进店 UV 132,673，阅读 UV 557,802，购买 UV 8,897，新客 UV 3,049，总投资 952,144.35 元，监测进店 UV 53,502。
- **京东联盟 / 电商（Alliance）**：
  - 覆盖范围：12/15 天（2026-10-01 至 2026-10-12），底表 10-13 ~ 10-15 暂未回传。
  - 观测指标总量：进店 UV 129,053，阅读 UV 2,155,657，购买 UV 13,732，新客 UV 2,943，总投资 3,050,802.46 元，监测进店 UV 74,761。
- **口径说明**：星图与京盟渠道各自独立统计，页面明确标注覆盖区间，不进行跨渠道重复相加或虚构全区间合计。

### 5. 2026-10-13 确认日报快照基线（防漂移核验）
- **报告 ID**：qicui:2026-10-13:confirmed:f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e
- **状态与确认人**：status: "confirmed", confirmed_by: "user-admin"
- **指纹**：f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e
- **核心金额指标**：
  - 平台广告消耗 (adSpend)：¥275,326.74
  - 达人合作费用 (creatorCost)：¥36,344.00
  - 项目总投入 (projectInvestment)：¥326,140.74
  - 业务结算金额 (settlement)：¥316,608.8978（UI展示：¥316,608.9）
  - 月累计结算：¥4,244,304.49，月度预算：¥12,000,000.00

### 6. 底层数据源版本清单（sourceVersions：共 25 项）
- 包括周底表 weekly-q4（v11892）、各日平台快照 platform_snapshot-2026-10-08 至 10-15（最新 v435）、达人快照 creator_snapshot-2026-10-08 至 10-15、预算表 budget_plan、SEO 方案与验收底表等。

### 7. 同步前基线真实浏览器视口截图
- **10-15 启萃总览基线（展示截至 10-14 状态与缺失标记）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\presync-01-overview-15.png`
- **10-14 启萃总览基线（最新完整有效观测日）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\presync-02-overview-14.png`
- **10-13 确认报告快照基线（防漂移核验）**：`D:\download\pic-vec\feihe\feihe-mvp\.verification\acceptance\presync-03-confirmed-13.png`

---

## 十、现场真实同步执行审计、订单链路核实与周表公式零纠偏

- **审计执行人**：独立验收和唯一运行环境协调代理
- **审计时间**：2026-10-16
- **Web 服务状态**：5173 服务稳定在线（PID 5084，纯 Node runtime 直连主库 data/local.db）
- **调度器状态**：Worker 调度器（验收期间观测快照 PID 36444 / 原 25992，scheduled 常驻模式；最新常驻进程 PID 由 data 代理统一重启与终态查验为准）

### 1. 7 项 Active 同步任务执行回执与数据入库核查
- **7 项任务全部平稳完成**：
  - weekly-q4（周底表）：完成于 05:05:46Z，版本由 11892 升级至 11899；
  - business-report（日报来源集）：完成于 05:09:30Z，捕获版本 4181，入库 10-09 至 10-16 平台与达人多日快照；
  - jzt-qicui（京准通）：完成于 05:10:06Z，覆盖至 2026-10-15；
  - juguang-f（聚光信息流）：完成于 05:10:19Z，覆盖至 2026-10-15；
  - juguang-s（聚光搜索）：完成于 05:10:31Z，覆盖至 2026-10-15；
  - adstar-qicui（淘宝星河）：完成于 05:10:40Z，覆盖至 2026-10-14（设 T+1 归因延迟 1 天）；
  - competitor-ipscg（竞品采样）：完成于 05:10:52Z，新增 10 篇真实合生元/金领冠样本，样本库增至 70 篇。
- **收据与 Head 指针**：
  - business_sync_receipts 新增至 103 项，状态均为 updated 或 unchanged，0 失败；
  - business_source_heads 全部指向最新有效 Capture ID，绝无脏数据覆盖；
  - comments-register-2026-10 任务严格保持 paused。

### 2. 淘宝星河订单双 ID 映射链路确凿核实
- **背景核查**：任务配置中的 entityIds 与 sourceUrl 使用 117498869，而入库 observation 记录中显示 orderId 为 133081361，需排查是否发生跨账号或错误订单采集。
- **底层接口与数据链证据**：
  1. 在淘宝星河官方 /api/one/order/list 返回的订单实体中，同一对象同时具备：
     - orderId / buyOrderId：117498869；
     - settleSeqId / displayOrderId：133081361；
     - 任务名称：婴配-启萃-日常-10月-旗舰店-小红星；
     - 店铺所属：飞鹤官方旗舰店（sellerId: 401420443）；
     - 项目 ID：projectId: 10006444334。
  2. bridge 调度链路解析：
     - scripts/automation-read-bridge.py 按配置的 117498869 检索星河订单；
     - resolve_taobao_order_info 命中该启萃 10 月订单对象后，将 settleSeqId（133081361）填入 ext 参数传递给多场景报表接口 /api/report/multiscene/query/detail/data；
     - 报表回包明细携带展示列 orderId 为 133081361；
     - source_account.external_id（acc_tb_adstar / levit0108）为服务商凭据身份，并非订单号。
  3. **核定结论**：两个 ID 严格归属于飞鹤启萃官方旗舰店当月同一合法小红星推广订单，属于平台旧版买家单号与新版结算流水号的标准同对象映射，非跨账号或跨月错单。

### 3. 周底表 10/15 广告 ¥0 公式默认值纠偏证据
- **原始单元格核查（weekly-q4 第 21 行）**：
  - 小红星 F-视频流（Col 17）、小红星 F-信息流（Col 18）、小红星 S-搜索（Col 20）、小红盟 F-视频流（Col 29）、小红盟 F-信息流（Col 30）、小红盟 S-搜索（Col 32）共 6 个原始输入单元格**全部为 null（空值）**，无一单元格人工录入 0；
  - Col 49（投流总金额 F+S）公式 =AQ21+AR21 计算结果为 0，确系公式空值默认计算；
- **聚光平台原生 10-15 真实 Cost 铁证**：
  - 聚光信息流推广（juguang-f）：39,608.89 + 10,590.48 = ¥50,199.37；
  - 聚光搜索推广（juguang-s）：¥170,409.84；
  - 聚光平台 F+S 真实消耗：¥220,609.21（证实后台跑量正常，绝非零消耗）。

### 4. 当前核心缺陷与修复准则（等待修复代理 Fix）
- **缺陷表现**：adapter.ts 行级 pending 判定将有达人（34,124.2）误判为整行 observed，致使广告被误标为 observed: 0、折线图跌落至 0、总投入不完整残值被当作有效 observed、businessThrough 误推进至 10-15。
- **修复要求**：
  - 10-15 adSpend、feed、search 修正为 state: not_collected, value: null，UI 卡片显示 —；
  - businessThrough 恢复至 2026-10-14；
  - creatorCost 保留真实 10-15 观测 ¥34,124.20；
  - 广告折线图 10-15 断线不跌 0；各指标采用独立 Coverage 计算。

---

## 十一、最终修复验证与跨源对账端到端验收结论

- **验收执行人**：独立验收和唯一运行环境协调代理
- **最终核验时间**：2026-10-16
- **环境与服务状态**：Web 5173（PID 5084，纯 Node 直连主库 local.db）、调度器 Worker（验收期间观测快照 PID 36444 / 原 25992；最新常驻进程 PID 由 data 代理统一重启与终态查验为准）
- **浏览器自动化验证**：全新 Chromium（无头，1440x900），无测试请求头、无注入 Cookie、Console 报错为 0

### 1. 修复后核心业务口径与指标核定
- **数据截止日与日期语义**：业务截止日 businessThrough 严格锁定为 2026-10-14，顶部明确提示“实际数据截至：2026-10-14（达人等部分费用已登记至 2026-10-15）”。
- **10-15 广告与达人状态**：
  - 平台广告消耗 (adSpend)：严格呈现 state: not_collected（值为 null），彻底排除虚假 ¥0，折线走势图在 10-15 正常断线不跌 0；
  - 达人合作费用 (creatorCost)：完整保留真实登记值 ¥34,124.20（state: observed，星 10,901 + 盟 23,223.2）；
  - 项目总投入与结算金额：因缺失广告组件，如实标记为 not_collected 并附带登记部分小计（投入 ¥39,524.20，结算 ¥38,329.85），不以残值充当完整 observed。
- **各指标独立 Coverage 与区间累计**：
  - 广告消耗：覆盖 14 天（10-01 至 10-14），累计 ¥3,915,166.16（日均 ¥279,654.73），基准日参考为 10-14 实绩 ¥184,018.36；
  - 达人费用：覆盖 15 天（10-01 至 10-15），累计 ¥549,480.90（日均 ¥36,632.06），基准日参考为 10-15 实绩 ¥34,124.20；
  - 项目总投入与结算：覆盖 14 个完整投流日，累计投入 ¥4,561,842.86、累计结算 ¥4,426,350.39。
- **KFS 全渠道费用构成与占比（分子分母范围严格对齐）**：
  - 严格限定在共同完整 14 天口径（10-01 至 10-14，总额 ¥4,561,842.86），10-15 达人/SEO 等残值不混入分母，各项占比之和严格为 100%，杜绝单项 >100% 现象。
- **平台原生独立对账（聚光 220,609.21 元）**：
  - 聚光 F+S 原始投放 ¥220,609.21（信息流 ¥50,199.37 + 搜索 ¥170,409.84）以独立来源呈现，明细表格清晰注明“周底表未回填（公式0）”，未盲目并入周表成本总口径。
- **10-13 确认日报快照防漂移**：指纹严格锁定 f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e，数值 100% 保持一致。

### 2. 最终验收真实浏览器截图清单
- **数据总览顶部卡片与独立 Coverage**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-01-overview-cards-cutoff.png
- **KFS 全渠道费用构成与占比（共同 14 天口径）**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-02-channel-structure-common-range.png
- **广告消耗趋势折线断线与原生对账 Chip**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-03-spendbars-trend-native-chip.png
- **分日看板 10-15 达人与部分小计明细卡片**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-04-daily-15-partial-cards.png
- **分日看板聚光平台原生投放核对表**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-05-daily-platform-native-table.png
- **10-13 确认日报快照防漂移核验**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-06-confirmed-13-frozen.png

### 3. 动态原生对账标题与 15→14 切换核验
- **10-15 分日看板原生折叠标题**：展开平台原生投放分日核对（聚光独立来源 · 10-15 ¥220,609.21 · 待回填），与表内 4 行明细（信息流 ¥50,199.37 + 搜索 ¥170,409.84 = ¥220,609.21）完全一致；
- **10-14 分日看板原生折叠标题**：切换至 10-14 后，折叠标题即时动态切换为 展开平台原生投放分日核对（聚光独立来源 · 10-14 ¥220,827.34 · 已对账），与表内 4 行明细（信息流 ¥50,341.18 + 搜索 ¥170,486.16 = ¥220,827.34）完全一致，彻底清除硬编码；
- **截图凭证**：
  - 10-15 动态标题与明细：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-dynamic-01-day15-native-table.png
  - 10-14 动态标题与明细：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-dynamic-02-day14-native-table.png

---

## 十二、对账状态三态（待回填/金额差异/金额一致）与分日横幅语义最终验收

- **验收执行人**：独立验收和唯一运行环境协调代理
- **最终核定时间**：2026-10-16

### 1. 对账状态三态动态判定与真实双方数字复核
- **10-15 日真实对账状态（待回填）**：
  - 聚光原生投放合计：¥220,609.21（信息流 ¥50,199.37 + 搜索 ¥170,409.84）；
  - 周底表当日投流广告：尚未回填（公式默认0，已修正为 null / not_collected）；
  - UI呈现：折叠标题动态显示 展开平台原生投放分日核对（聚光独立来源 · 10-15 ¥220,609.21 · 待回填）；
  - 对账提示条：明确标明 周底表广告投放尚未回填，保持独立来源对账，不计入周表成本总口径。
- **10-14 日真实对账状态（金额有差异，拒绝假对账）**：
  - 聚光原生投放合计：¥220,827.34（信息流 ¥50,341.18 + 搜索 ¥170,486.16）；
  - 周底表当日广告消耗：登记实值 ¥184,018.36；
  - 真实差额：两套数据差额为 ¥36,808.98；
  - UI呈现：折叠标题动态显示 展开平台原生投放分日核对（聚光独立来源 · 10-14 ¥220,827.34 · 金额有差异（差额 ¥36808.98）），彻底排除了误导性的“已对账/已纳入底表”；
  - 对账提示条：标明 聚光原生投放 ¥220,827.34 vs 周底表广告消耗 ¥184,018.36，差额 ¥36,808.98（口径待核对）。两套来源独立，不擅自合并或自动抵扣。

### 2. 10-15 分日看板状态横幅语义纠偏
- **状态横幅**：修正为 💡 2026-10-15 费用尚未齐备 · 投流广告待回填 · 达人等单项已登记，未齐备指标参考 2026-10-14 完整实绩；所选基准日保持 2026-10-15。
- **业务研判结论**：2026-10-15 费用尚未齐备 · 达人已填报（¥34,124.20），投流广告待回填；未齐备指标参考截至 2026-10-14 完整实绩。

### 3. 最新截图凭证清单
- **10-15 原生对账（待回填状态）与横幅**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-reconciled-01-day15-missing-weekly.png
- **10-14 原生对账（差额 36,808.98 元有差异状态）**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-reconciled-02-day14-diff-weekly.png
- **数据总览 4Cards 与独立 Coverage**：D:/download/pic-vec/feihe/feihe-mvp/.verification/acceptance/final-reconciled-03-overview-cards.png
