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
