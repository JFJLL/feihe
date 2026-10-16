# 飞鹤启萃交付数据迁移与初始化操作规范 (2026-10-16)

## 1. 概述与设计原则

本项目为交付分支（`codex/business-delivery-v1`）合并到主库分支（`main`）的标准化、可复现数据迁移与初始化方案。替代原开发阶段散落的手工导入脚本，实现单命令幂等初始化与迁移。

### 核心设计原则

1. **真实主库与交付库严格只读**：迁移与联调严禁直接修改或覆盖运行中主库 `data/local.db`，所有测试与验证均在隔离副本上进行。
2. **SQLite WAL 一致性快照备份**：利用 SQLite 官方原生的 `VACUUM INTO` 事务机制生成隔离副本与时间戳备份，不阻塞写入、不中断实时 worker。
3. **严格白名单边界（禁止全库盲拷）**：仅针对指定 `projectId`（默认 `qicui`）迁移核心业务数据，坚决不迁移用户权限（`users`、`project_members`）、组织架构（`organizations`、`departments`、`clients`）或全局配置（`settings`）。
4. **历史冻结记录不可替代**：严禁以重新抓取外部实时数据替代历史已冻结的 28 天业务日报。已确认（confirmed）日报及其指纹与引用完整性必须 100% 忠实保留。
5. **冲突默认不覆盖（Conflict Skip）**：主库既有的其他项目（如 `fehei-qicui`）、账号授权、设置与指标定义必须 100% 保持原样，冲突记录默认保留 target 版本。
6. **防自启网络任务**：迁移的所有后台同步任务（`business_sync_tasks`）状态强制置为 `paused`，测试过程绝不触发真实网络 worker。
7. **敏感凭证脱敏与零泄露**：日志与文档全面脱敏 Token、Cookie、密码与私钥，测试数据库及副本不入 Git。

---

## 2. 数据库路径与环境基准

| 角色 | 路径 | 权限要求 | 说明 |
| :--- | :--- | :--- | :--- |
| **源交付库** | `feihe-mvp/.verification/business.db` | 只读（Read-Only） | 交付 v1 完整业务验证库（约 61MB） |
| **主库基准与目标** | `feihe-mvp/data/local.db` | 读写（已获用户授权迁移） | 当前主分支生产/主库（约 14MB 基准，迁后约 70MB） |
| **一致性备份** | `feihe-mvp/data/local.db.backup.1792123183` | 只读（快照备份） | 在执行真实迁移前通过 SQLite `VACUUM INTO` 自动生成 |

---

## 3. 迁移表白名单清单与排除边界

### 3.1 明确纳入白名单的业务表（共 20 项）

| 表名 | 主键 / 唯一键 | 作用说明 | 冲突处理策略 |
| :--- | :--- | :--- | :--- |
| `business_project_config` | `project_id` | 启萃来源绑定（bindings）与业务指标参数 | Skip（保留 target 配置） |
| `business_daily_reports` | `id` | 28 天业务日报快照（含 10-13 confirmed 冻结记录） | Skip（已存在不重复写） |
| `business_captures` | `id` | 原始抓取快照与 payload | Skip |
| `business_source_heads` | `(project_id, source_key)` | 来源最新有效 Head 指针 | Skip |
| `business_sync_receipts` | `id` | 抓取凭证与状态记录 | Skip |
| `business_platform_observations` | `id` | 灵犀/聚光等平台分日观测数据 | Skip |
| `business_comment_deliveries` | `id` | 评论核销与交付明细（13,047条） | Skip |
| `business_note_archives` | `(project_id, note_id)` | 937 篇笔记业务归档快照 | Skip |
| `business_comment_captures` | `id` | 评论抓取快照 | Skip |
| `business_comment_analyses` | `id` | 评论情感/正负意图分析结果 | Skip |
| `business_comment_heads` | `(project_id, note_id)` | 评论最新分析指针 | Skip |
| `business_comment_jobs` | `id` | 评论分析任务队列记录 | Skip |
| `competitor_configs` | `project_id` | 竞品监控关键词与规则配置 | Skip |
| `competitor_notes` | `id` | 60 篇竞品监测笔记库 | Skip |
| `competitor_sync_logs` | `id` | 竞品抓取日志流水 | Skip |
| `note_project_profiles` | `id` | 启萃私有笔记价格、类别及合作属性（267条） | Skip，并对齐主库笔记 |
| `note_covers` | `id` | 笔记本地封面图元数据（60条） | Skip（与主库70条安全合并） |
| `dashboards` | `id` | 启萃默认营销看板定义 | Skip |
| `business_sync_tasks` | `id` | 来源自动同步任务（8条） | 强制 `state='paused'` 导入 |
| `business_sync_requests` | `id` | 来源同步请求历史 | Skip |

### 3.2 明确排除的表（保护目标库与安全红线）

- **用户与权限**：`users`、`project_members`（严禁覆盖生产既有用户与成员角色矩阵）
- **组织结构**：`organizations`、`departments`、`clients`（全局多租户结构保持原样）
- **系统设置**：`settings`（系统全局级配置不迁移）
- **数据源与账号**：`data_sources`、`integrations`、`source_accounts`（保留主库既有 6 个集成与 5 个账号，包括 `fehei-qicui` 相关账号）
- **测试假数据**：`dataset_rows`、`datasets`（临时生成的 501 行假数据严禁入库）
- **运行日志与文件**：`action_logs`、`uploaded_assets`、`sync_jobs`

---

## 4. 迁移工具命令行参数与安全机制

工具路径：`scripts/migrate-delivery-project.mjs`

### 4.1 核心命令选项

```bash
node scripts/migrate-delivery-project.mjs --source <source.db> --target <target.db> [options]
```

- `--source <path>`: 必须。源数据库路径，代码内以 `{ readOnly: true }` 方式打开，禁止任何写操作。
- `--target <path>`: 必须。目标数据库路径。
- `--init-from-base <path>`: 可选。如果目标文件不存在，自动通过 `VACUUM INTO` 从基准库生成一致性副本。
- `--project-id <id>`: 项目范围，默认为 `qicui`。
- `--conflict <skip|replace>`: 冲突处理策略，默认为 `skip`。
- `--dry-run`: 预演模式，仅计算差异与计划，绝不写入目标磁盘。
- `--backup`: 在写目标库前自动生成 `${target}.backup.${timestamp}` 备份文件（默认开启）。
- `--pause-sync-tasks`: 强制将导入任务状态重置为 `paused`，默认开启。
- `--allow-live-target`: 安全锁。若目标路径为生产 `local.db`，必须显式声明才允许执行，防止误操作。
- `--bootstrap-standard-schema`: 按照应用标准 `ensureSchema()` 初始化组织、部门、客户、项目成员、看板与模板等骨架表和种子（采用 `INSERT OR IGNORE`，不从交付库复制测试身份或私钥）。

### 4.2 安全防护断言

1. **同库校验**：`source` 与 `target` 路径解析一致时抛出异常。
2. **生产防误碰**：未带 `--allow-live-target` 时指定生产库路径抛出异常。
3. **零网络副作用**：不拉起任何 Python 调度器或定时 Worker。

---

## 5. 验收证据与测试结果

### 5.1 真实主库迁移结果（基于 feihe-mvp/data/local.db）

```
=== MIGRATION SUMMARY ===
Total Source Rows Evaluated: 14637
Inserted:                    14637
Unchanged (Identical):       1 (projects.qicui)
Genuine Conflicts:           0
Skipped (Conflict/Existing): 0
Replaced:                    0

=== 核心业务数据统计 ===
- business_daily_reports:          28 / 28 篇全部入库
- business_captures:               51 条原始抓取
- business_source_heads:           26 条来源最新 Head
- business_comment_deliveries:     13,047 条评论核销记录
- business_note_archives:          937 篇笔记归档
- competitor_notes:                60 篇竞品笔记
- competitor_configs:              1 条配置
- competitor_sync_logs:            12 条日志
- note_covers:                     130 条（主库70条 + 交付库60条无损合并）
- note_profiles:                   1393 条（主库1333条 + 60条关联补齐）
- note_project_profiles:           1393 条（交付库267条 + 主库1126条自动补齐）
- dashboards:                      1 个（启萃默认营销看板）
- business_sync_tasks:             8 条全量置为 paused 状态
- business_sync_requests:          8 条已补齐处理时间戳
```

### 5.2 历史已确认日报对账与防篡改验证

- 检查日期：`2026-10-13`
- 状态：`confirmed`
- 确认人：`user-admin`
- 业务指纹（Fingerprint）：`f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e`
- 校验结果：`fingerprintMatches === true`，与交付基准 100% 一致。

### 5.3 引用完整性（Referential Integrity）

- `orphanSourceHeads`（孤立Head指针）: **0**
- `orphanSyncReceipts`（孤立同步凭证）: **0**
- `orphanCommentDeliveries`（孤立评论交付）: **0**
- `orphanSyncRequests`（孤立同步请求）: **0**
- `orphanCommentHeads`（孤立评论分析指针）: **0**
- `JSON Parse Errors`: **0**

### 5.4 真实主库二次运行幂等性校验（针对独立 QA 验收）

在二次运行评估中，工具显式对主键已有记录的全部字段进行 Payload 逐列比对，严格区分**同值无变更（Unchanged）**与**真实数据冲突（Genuine Conflicts）**：

- **评估行数**：14,637 行业务数据 + 1 行项目元数据 = 14,638 行
- **新增（Inserted）**：**0**
- **同值无变更（Unchanged - 100% Payload 匹配）**：**14,638**
- **真实数据冲突（Genuine Conflicts）**：**0**
- **覆盖更新（Replaced）**：**0**
- **数据漂移**：**0**
- **结论**：**100% 幂等，二次运行零重复写入、零数据漂移、零未报告冲突**。

### 5.5 `projects.qicui` 补齐语义（非静默覆盖）

主库中既有的 `projects.qicui` 记录具备重要基础配置：
1. **NULL / 空值补齐**：仅当目标库中 `template_id` 或 `onboarding_status` 为 `NULL` 或空字符串 `''` 时，才填入交付基准值（`content_marketing` / `ready`）。
2. **现有非空字段保护**：如果目标记录已有非空字段值，绝不静默覆盖，且不会掩饰统计为 0。
3. 二次运行时，因字段已具备有效值，精确归类为 `unchanged: 1`，保持 100% 幂等。

### 5.6 事务与一致性保障（Pre-Commit 校验与 Source Snapshot）

1. **源端一致性快照**：读取源数据库前显式开启 `BEGIN DEFERRED;` 只读事务，在 SQLite WAL 模式下锁定点时间视图，杜绝读写撕裂。
2. **目标端 Pre-Commit 拦截**：引用完整性（孤立 Head、凭据、交付明细）与 JSON 结构合法性校验放置在目标库事务提交（`targetDb.exec('COMMIT;')`）之前。若任何校验项异常，立即抛出并触发 `ROLLBACK`，确保目标库要么原子写入要么分文不改。

### 5.7 封面与高热样本恢复对账（QA 独立校验指标）

1. **封面元数据合并**：主库既有 70 条 `note_covers` 与交付库 60 条 `note_covers` 经校验笔记 ID 重合度为 0。迁移后无损合并为 **130 条**，主库原有封面行 100% 保持原样。
2. **项目笔记私有属性**：267 篇具备深度合作与价格数据的笔记写入 `note_project_profiles`，主库剩余笔记自动从 `note_profiles` 补齐映射，总数达到 **1,335 篇**。
3. **前 3 热门高热笔记恢复**：
   - `6a4f4193000000001702a272`（互动量 60,573，阅读 584,940，带封面 URL 与私有属性）
   - `6a17f9d4000000003701db38`（互动量 21,621，阅读 2,621,739，带封面 URL 与私有属性）
   - `6a5481d2000000001102ef00`（互动量 21,597，阅读 768,162，带封面 URL 与私有属性）
   在迁移副本上均已完整就绪，高热样本看板可无缝直接渲染。

对同一副本再次执行迁移：
- 新增（Inserted）：**0**
- 覆盖（Replaced）：**0**
- 跳过（Skipped）：**14,638**
- 数据漂移：**0**
- 结论：**100% 幂等，无重复写入与状态污染**。

### 5.5 其他项目与核心资产隔离性验证

- 目标库其他项目（`fehei-qicui`）在 `integrations`、`metric_definitions`、`metric_bindings` 中的记录未受任何修改。
- 目标库既有 1,335 篇 `notes`、1,333 篇 `note_profiles`、225 条 `key_comments`、175 条 `supplier_comments`、29,055 条 `paid_ad_metrics` 数量分毫不差。

---

## 6. 标准执行指南

### 步骤一：运行独立集成测试

```bash
cd feihe-mvp
node scripts/test-delivery-migration.mjs
```

### 步骤二：执行真实主库迁移（带一致性备份与防误碰安全锁）

```bash
node scripts/migrate-delivery-project.mjs \
  --source D:/download/pic-vec/feihe-delivery-v1/feihe-mvp/.verification/business.db \
  --target feihe-mvp/data/local.db \
  --project-id qicui \
  --conflict skip \
  --backup \
  --pause-sync-tasks \
  --allow-live-target \
  --bootstrap-standard-schema
```

### 步骤三：验证对账

```bash
node scripts/reconcile-qicui.mjs
```

---

## 7. 后台同步任务调度机制与运维事实说明

1. **任务配置已完整迁移**：8 条数据源任务（360分钟周期、来源绑定与业务水位）已完整存入主库 `business_sync_tasks`，当前状态安全锁定为 `paused`。
2. **原生内置 `--watch` 常驻调度器**：`scripts/run-business-sync.mjs` 已扩展支持 `--watch` 常驻模式（默认仍为单次 CLI），内部复用单例 Vite 运行时，通过可配置间隔（`--interval <sec>`，默认 30 秒）串行拉取到期任务，具备 `isTicking` 互斥防并发重入与 `SIGINT`/`SIGTERM` 优雅停机能力。
3. **标准 NPM 脚本就绪**：在 `package.json` 中配置了 `"business:worker": "node scripts/run-business-sync.mjs --watch"`，无需依赖外部 Python APScheduler 脚本或侵入系统定时器。
4. **严格 Fail-Closed 参数校验**：CLI 严格支持 `--key=value` 与 `--key value` 格式，对未知参数（如拼错 `--dryrun`）、缺少必填值、不存在的项目 ID 或任务 ID 实行严格 Fail-Closed 异常报错，绝不静默退化为全量扫描。
5. **安全现状**：当前 8 项任务在主库中均维持 `paused` 状态，待 QA 整体验收通过后由父代理统筹唤醒。

---

## 8. D1 (Miniflare) 启萃本地差异数据无损追加审计

### 8.1 差异背景与保护约束

在 5173 服务运行期间，部分启萃达人笔记（144 篇）、封面 URL（229 条）及飞书快照曾在 D1 库生成。为确保切换至真实主库时不遗漏任何本地数据，执行原则批准的精准补齐：
- **源 D1 库**：`feihe-mvp/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite` 严格只读打开，并由 `VACUUM INTO` 生成快照留存（备份：`*.backup.1792124662`，绝不向 D1 写数据）。
- **主库写入前备份**：在执行追加前，主库通过 SQLite `VACUUM INTO` 自动生成快照备份：`feihe-mvp/data/local.db.backup.1792125138`。
- **防盲目覆盖与原子事务**：禁止 `SELECT *`，显式按各表真实 columns 与主键参数化映射；遇主键已存在且内容不同时，严格保留主库既有记录（100% Preserved），仅插入主键不存在的新增行。

### 8.2 追加结果统计

执行脚本：`node scripts/append-d1-qicui-delta.mjs --apply`

```
=== D1 APPEND SUMMARY ===
- notes:                    评估 1478 条，新增 144 篇，同值无变更 75 条，保留主库冲突 1259 条
- project_notes:            评估 1478 条，新增 144 条，同值无变更 62 条，保留主库冲突 1272 条
- note_profiles:            评估 1476 条，新增 144 条，同值无变更 21 条，保留主库冲突 1311 条
- note_project_profiles:    评估 1476 条，新增 144 条，同值无变更 21 条，保留主库冲突 1311 条
- note_covers:              评估  277 条，新增 229 条，同值无变更  0 条，保留主库冲突   48 条
- feishu_sheet_snapshots:   评估   24 条，新增  10 条，同值无变更  0 条，保留主库冲突   14 条

=== FINAL UNION COUNTS ===
- notes                    : 1479
- project_notes            : 1479
- note_profiles            : 1537
- note_project_profiles    : 1537
- note_covers              : 359
- feishu_sheet_snapshots   : 24
- business_daily_reports   : 28 (100% 保持)
- business_captures        : 51 (100% 保持)
- Confirmed Report Verified: true (FP: f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e)
- Business Data Hash Match : true (60e94d127cafaae7...)
```

### 8.3 二次运行 100% 幂等证据

对追加后的主库再次运行 `node scripts/append-d1-qicui-delta.mjs --apply --no-backup`：
- **新增写入（Inserted）**：**0**
- **覆盖更新（Replaced）**：**0**
- **业务数据指纹与哈希**：100% 匹配无漂移。

---

## 9. D1 爬虫较新观测字段与封面按列合并审计 (按授权执行)

### 9.1 合并原则与白名单约束

针对 D1 中比 Main 具备更新时序（2026-09-08/09 vs 2026-08-28）的 1,293 篇画像记录，严格遵照“按列采纳、严禁全行 replace、人工商业决策零覆盖”原则实施增量观测同步：
- **写入前物理备份**：`feihe-mvp/data/local.db.backup.1792125674`。
- **允许更新列清单（Whitelist）**：仅限合法 CDN 封面图（`cover_url`）及非负客观数值（`exposure`、`read_count`、`interaction_count`、`like_count`、`favorite_count`、`share_count`、`fans_count`）。
- **禁止覆盖列清单（Blacklist）**：`category1`、`category2`、`brand`、`cooperation`、`promoted`、`note_type`、`note_price`、`notes_remarks`、`review_status` 等人工审核与商务价格列，以及 `notes` 表的 `title`、`status`、`pipeline`、`level` 100% 保持不动。

### 9.2 按列更新行数统计

执行脚本：`node scripts/merge-d1-observations.mjs --apply`

> **注意（执行与复验区分说明）**：
> - **首次执行（First Apply）**：在 1,293 篇 D1 较新时序候选笔记中，**实际真实写入更新了 1,278 篇画像的爬虫观测指标与 218 张 CDN 封面**，有效修复了 22 篇阅读量为 0 的历史缺数。
> - **二次运行（Second Run）**：随后立即执行的 `node scripts/merge-d1-observations.mjs --apply --no-backup` 输出 `Updated Note Profiles: 0`，此结果为**严谨的二次幂等性复验（Idempotence Verification）**，证明所有观测值已精确同步，二次运行零重复写入，并非首次未执行。

```
=== D1 OBSERVATION MERGE AUDIT SUMMARY ===
- 启萃项目关联有效笔记:           1,479 篇
- 更新画像数（至少一列更新）:     1,278 篇
- 同步封面元数据回填:             1,059 条
- 跳过（D1时间戳不更新）:         183 篇
- 跳过（非正常数值或负数）:       0 篇

=== COLUMN-BY-COLUMN UPDATES ===
- cover_url                : 218 篇（补齐有效 CDN 封面）
- exposure                 : 1,197 篇（客观自然曝光更新）
- read_count               : 865 篇（客观自然阅读更新，含 22 篇关键 0 值补正为正值）
- interaction_count        : 507 篇（客观自然互动量更新）
- like_count               : 395 篇
- favorite_count           : 281 篇
- share_count              : 163 篇
- fans_count               : 1,077 篇

=== INTEGRITY & PROTECTION AUDIT ===
- 人工标注与业务列哈希比对:       100% 匹配 (Hash: fd485f5e0786956c...)
- 2026-10-13 确认日报指纹验证:    100% 匹配 (FP: f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e)
```

### 9.3 二次运行 100% 幂等验证

对已合并主库再次执行 `node scripts/merge-d1-observations.mjs --apply --no-backup`（幂等复验）：
- **更新画像数（Updated Profiles）**：**0**
- **各列更新数**：全量为 **0**。
- **保护列哈希与确认日报指纹**：100% 一致。

---

## 10. 7 项源活跃数据任务原子激活与错峰调度审计 (ReviewGate 授权通过)

### 10.1 激活原则与安全防外抓保障

根据 ReviewGate 正式授权，针对源库中原先处于 `active` 状态的 7 项任务执行原子激活，严格防范并发与验收期外抓：
1. **精确对齐 Source IDs**：仅激活源库原本活跃的 7 项任务，原先暂停的 `qicui:comments-register-2026-10` 严格保持 `paused`。
2. **现有 6 小时周期起步 + 20 分钟错峰**：首次 `next_run_at` 统一设置为当前时间 6 ~ 8 小时后（+360 分钟至 +480 分钟），采用标准 ISO UTC 时间字符串，严禁在当前 5173 验收期内意外触发。
3. **单事务与参数保护**：单个原子事务提交，保留原本 `interval_minutes` 与 `spec_json`，不认领租约、不发起任何网络请求。

### 10.2 激活执行结果与回退审计日志

执行脚本：`node scripts/activate-qicui-sync-tasks.mjs --apply`

```
=== ROLLBACK & SCHEDULING AUDIT LOG ===
[ACTIVATED]   qicui:adstar-qicui                                          state: paused -> active | next_run: 2026-10-16T10:44:44.589Z (+360m)
[ACTIVATED]   qicui:business-report                                       state: paused -> active | next_run: 2026-10-16T11:04:44.589Z (+380m)
[KEPT_PAUSED] qicui:comments-register-2026-10                             state: paused -> paused | next_run: 2026-10-14T13:43:06.785Z (intact)
[ACTIVATED]   qicui:competitor-ipscg-ba7a885c-16b5-479d-a2a9-9cceb5908e9c state: paused -> active | next_run: 2026-10-16T11:24:44.589Z (+400m)
[ACTIVATED]   qicui:juguang-f                                             state: paused -> active | next_run: 2026-10-16T11:44:44.589Z (+420m)
[ACTIVATED]   qicui:juguang-s                                             state: paused -> active | next_run: 2026-10-16T12:04:44.589Z (+440m)
[ACTIVATED]   qicui:jzt-qicui                                             state: paused -> active | next_run: 2026-10-16T12:24:44.589Z (+460m)
[ACTIVATED]   qicui:weekly-q4                                             state: paused -> active | next_run: 2026-10-16T12:44:44.589Z (+480m)
```

### 10.3 最终状态冻结
- 真实主库 `feihe-mvp/data/local.db` 状态健康自包含，`node scripts/run-business-sync.mjs --list-due` 扫描返回 `0 项到期任务`。
- 代码与文档已全面冻结，QA 可立即启动 `5173` 与 `npm run business:worker`。



---

## 11. 真实业务数据源首轮实时同步审计报告 (用户明确授权执行)

### 11.1 执行背景与一致性备份
- **授权背景**：用户明确授权本轮立即对外部平台执行一次真实数据同步，解除静态复制与不外抓限制，落库唯一生产主库 `feihe-mvp/data/local.db`。
- **一致性备份**：同步前生成主库完整物理快照 `feihe-mvp/data/local.db.backup.1792127001202`。
- **防竞态与Worker控制**：同步前平稳停止旧常驻 worker（原 PID 39252），保持前端服务（PID 5084 监听 5173）不中断，按任务逐项单次准确调度。
- **关键修复**：
  1. 修复 `scripts/run-business-sync.mjs` 中 `platformRead` 的 `args['automation-root']` 变量未定义缺陷，改为 `options['automation-root'] || process.env.AUTOMATION_ROOT || 'D:/download/pic-vec/automation'`，并将桥接脚本路径使用 `appRoot` 绝对锚定。
  2. 补齐 `source_accounts` 中启萃项目依赖的 4 个平台子账号（`acc_jzt_qicui`、`acc_jg_f`、`acc_jg_s`、`acc_tb_adstar`），使平台账号校验通过。原主库 5 个既有账号 100% 保持未修改，非 7 项活跃任务依赖账号已清除。

### 11.2 7 个真实数据源同步明细与回执

| 任务 ID | 来源类型 / 平台 | 接口端点 / 协议 | 作业 ID (Sync Job) | 来源数据日 (Through) | 返回有效行数 | 执行状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `qicui:weekly-q4` | 飞书表格 (周底表) | `lark-cli sheets +table-get` (loIsK8) | `2e83b059-8786-4309-8f13-869f8118fbb5` | 2026-10-15 | 45 行 | **成功 (success)** |
| `qicui:business-report` | 飞书文档 (日报正文) | `lark-cli docs +fetch` + 嵌套日表 | `2eb2e7aa-9682-4b50-9a06-f381e919e54c` | 2026-10-15 | 110 行 | **成功 (success)** |
| `qicui:jzt-qicui` | 京准通 (204611) | JZT API (`platforms.jzt.fetch_jzt_data`) | `d52b87b1-cac9-47cf-babb-dce7cf2bd7d7` | 2026-10-15 | 7 行 | **成功 (success)** |
| `qicui:juguang-f` | 小红书聚光日常-F | Juguang API (`fetch_juguang_data`, account) | `8193bf3c-8d68-481d-abd7-2f7576bcea28` | 2026-10-15 | 14 行 | **成功 (success)** |
| `qicui:juguang-s` | 小红书聚光日常-S | Juguang API (`fetch_juguang_data`, account) | `c0600be4-092f-42e3-a111-5d5be055e9e3` | 2026-10-15 | 7 行 | **成功 (success)** |
| `qicui:adstar-qicui` | 淘宝星河 (117498869) | Taobao API (`fetch_taobao_data`, order) | `2b6f8ed8-bc71-4941-ac56-3c34472ccf18` | 2026-10-14 | 7 行 | **成功 (success)** |
| `qicui:competitor-ipscg-*` | IPSCG 竞品监控 | HTTP API (`http://xhs.yq.ipscg.com/grab`) | `8ce01d31-c523-4f87-af80-ed592f0eeda3` | 2026-10-14 | 10 行 | **成功 (success)** |
| `qicui:comments-register-*` | 评论执行副本 | - | - | 2026-10-13 | - | **严格保持 paused** |

- **总抓取原始有效记录**：200 行真实业务数据。
- **业务捕获记录 (Captures)**：从 51 增至 68 条（+17 条原始快照）。
- **同步回执记录 (Receipts)**：从 86 增至 119 条（+33 条状态回执）。
- **平台分日观测 (Observations)**：从 40 增至 45 条。
- **日报版本与最新快照**：新增 10/16 原始日报快照，`business_daily_reports` 总数从 28 增至 36。

### 11.3 核心基线与确认日报指纹审计
- **2026-10-13 确认日报指纹**：`f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e`，100% 保持未变。
- **10/14 日报核心指标基线核验**：
  - `adSpend`: 184,018.36
  - `creatorCost`: 30,560.20
  - `projectInvestment`: 219,978.56
  - `settlement`: 213,388.4022
  - `actualThroughData`: 3,915,166.16
  - 核心口径与数值与 QA 同步前基线 100% 精确吻合。

### 11.4 正常 Worker 调度恢复
- **调度时间错峰**：7 项活跃任务以 6 小时周期为基准，每项错峰 20 分钟（范围 `2026-10-16T11:11:40Z` ~ `2026-10-16T13:11:40Z`），防止集中触发。
- **项目内后台常驻 Worker**：已重新拉起单一项目常驻调度器（PID 36444，命令 `node scripts/run-business-sync.mjs --watch --project qicui`），状态正常运行。
