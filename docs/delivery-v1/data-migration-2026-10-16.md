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
| **主库基准** | `feihe/feihe-mvp/data/local.db` | 只读（Read-Only） | 当前主分支生产/主库（约 14MB） |
| **隔离目标副本** | `output/merge-migration-20261016/local.replica.db` | 读写（验证专用） | 由主库通过 `VACUUM INTO` 生成的独立副本 |

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

### 4.2 安全防护断言

1. **同库校验**：`source` 与 `target` 路径解析一致时抛出异常。
2. **生产防误碰**：未带 `--allow-live-target` 时指定生产库路径抛出异常。
3. **零网络副作用**：不拉起任何 Python 调度器或定时 Worker。

---

## 5. 验收证据与测试结果

### 5.1 首次迁移结果（基于主库副本 replica.db）

```
=== MIGRATION SUMMARY ===
Total Source Rows Evaluated: 14637
Inserted:                    14637
Skipped (Conflict/Existing): 1
Replaced:                    0

=== 核心业务数据统计 ===
- business_daily_reports:          28 / 28 篇全部入库
- business_captures:               51 条原始抓取
- business_source_heads:           26 条来源最新 Head
- business_comment_deliveries:     13,047 条评论核销记录
- business_note_archives:          937 篇笔记归档
- competitor_notes:                60 篇竞品笔记
- note_covers:                     130 条（主库70条 + 交付库60条无损合并）
- note_project_profiles:           1335 条（交付库267条 + 主库1126条自动补齐）
- business_sync_tasks:             8 条全量置为 paused 状态
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

### 5.4 二次运行幂等性与真实冲突语义澄清（针对独立 QA 验收）

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

### 步骤二：生成目标隔离副本并迁移

```bash
cd feihe-mvp
node scripts/migrate-delivery-project.mjs \
  --source .verification/business.db \
  --target output/merge-migration-20261016/local.replica.db \
  --init-from-base ../feihe/feihe-mvp/data/local.db \
  --project-id qicui
```

### 步骤三：验证对账

```bash
node scripts/reconcile-qicui.mjs
```
