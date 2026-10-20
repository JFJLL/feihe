# 黄天鹅 (Huang Tiane) 后端集成与看板注册架构设计

## 1. 项目基础定义

- **项目标识 (Slug)**: `huang-tiane`
- **项目模板 (Template)**: `campaign_review` (轻量营销看板)
- **品牌名称**: 黄天鹅
- **品类领域**: 生鲜食品 / 可生食鸡蛋
- **项目描述**: 可生食鸡蛋小红书种草、全域投流与商销引流复盘
- **视觉主题色**: `#d97706` (蛋黄琥珀色)
- **管理归属**:
  - 组织: `org-default`
  - 部门: `dept-marketing`
  - 负责人 (Owner): `user-editor`
  - 默认成员角色: `project_admin`

---

## 2. 数据源接入与 Canonical/Alternate 归口规范

黄天鹅项目共接入 **5 个核心飞书工作簿/文档**（共涵盖 63 个子表），在后端注册中明确区分主数据源与备用副本，防止指标重复累加：

| 登记源 ID | 角色定位 | 来源归属 | 飞书 URL / Wiki Token | 子表数 | 业务职责与对齐规则 |
|---|---|---|---|---|---|
| `src-huang-tiane-kol-execution` | 达人内容执行表 | Source A | [HfYRwSbEKiBex5ks2uwc9S9ynog](https://yimeichuanbo.feishu.cn/wiki/HfYRwSbEKiBex5ks2uwc9S9ynog?sheet=wZtAgh) | 10 | 达人筛选、审稿、发文及监测执行管理 |
| `src-huang-tiane-cid-fs` | CID投流报表 | Source A | [KpHrwJt1picaxBkWB9NcaLlsnih](https://yimeichuanbo.feishu.cn/wiki/KpHrwJt1picaxBkWB9NcaLlsnih) | 20 | 红猫 CID 投流、链路转化与分日明细 |
| `src-huang-tiane-brand-fs` | 品牌投流报表 | Source B | [F42ksAyO8hKRGNt2plhccnSWnNh](https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=Nm3Sev) | 17 | 品牌线信息流 (F) 与搜索 (S) 消耗与转化 |
| `src-huang-tiane-commerce-canonical` | **商销日报 (Canonical)** | **Source B** | [CqyPwlUTNiiD0lkXlZJcuyIYnCc](https://yimeichuanbo.feishu.cn/wiki/CqyPwlUTNiiD0lkXlZJcuyIYnCc) | 8 | **商销核心主数据源**；全渠道销售、GMV、订单与消耗核算以此为准 |
| `src-huang-tiane-commerce-alt` | 商销日报 (Alternate) | Source A | [T2eowqaUOi74Q9kPvQLcu8sSn9c](https://yimeichuanbo.feishu.cn/wiki/T2eowqaUOi74Q9kPvQLcu8sSn9c) | 8 | 商销备用副本；标记 `alternate: true`，**严禁与 Canonical 合并累计** |

---

## 3. 生产数据库实体关联与幂等保障

### 3.1 实体关联映射
- `projects`: `id='huang-tiane'`, `template_id='campaign_review'`, `status='进行中'`, `onboarding_status='ready'`
- `project_members`: `id='huang-tiane:user-editor'`, `project_id='huang-tiane'`, `role='project_admin'`
- `dashboards`: `id='dash-huang-tiane-default'`, `project_id='huang-tiane'`, `name='营销复盘工作台'`, `is_default=1`
- `data_sources`: 登记上述 5 项数据源，包含精确的 mapping_json，status 为“元数据已核验”，probe_status 为“accessible”。
- `project_settings`: `key='campaign_dashboard'`，存储由 facts 组装的结构化快照。

### 3.2 幂等与防覆盖保护规则
1. **项目实体首次创建保护**: `INSERT INTO projects ... ON CONFLICT(id) DO NOTHING`。若用户后续在系统内修改了项目名称、品牌或负责人，脚本不会执行覆写。
2. **非目标项目零副作用**: 脚本在事务前后自动计算并比对 `qicui`、`kailas`、`meiling`、`winner-wipes` 4 个既有项目的 SHA-256 完整性哈希。若发生任何微小字节变动，立即抛出致命错误并回滚。
3. **事务前热备份**: 在写入前调用 SQLite 引擎级 `VACUUM INTO '.verification/campaign/local.db.pre-huang-tiane-*.db'`，确保数据库具备秒级回滚快照。
4. **空壳写入防御 (Anti-Empty Shell Guard)**:
   - `--apply` 模式下强制检查 `source-a/facts.json` 与 `source-b/facts.json`。
   - 要求两份事实表均落盘且标记 `buildStatus: 'complete'`，并且表格数非空。
   - 若未完全就绪，`--apply` 直接抛出异常拒绝任何数据库写入。
   - `--dry-run` 模式（默认）仅输出计划与环境核验报告，不触发任何库操作。

---

## 4. API 数据合并机制优化 (Snapshot Daily Datasets Merge)

针对 `app/api/campaign-dashboard/route.ts` 原有逻辑直接使用 `dailyDatasets` 覆盖快照的问题进行了修复：
- 采用 `mergeById(snapshot.dailyDatasets || [], serverDailyDatasets)` 算法。
- 保证快照中自带的分日时序数据集（例如通过 DB 存储的定制分日流水）与服务端动态日流水无缝并存，同 ID 则以最新为准，缺失则予以保留。

---

## 5. 代码职责与边界清单

- **本子代理职责**:
  - `lib/campaign-types.ts`: 扩展 `CampaignProjectId` 包含 `'huang-tiane'`。
  - `lib/campaign-catalog.ts`: 目录注册 `'huang-tiane'` 元数据。
  - `lib/campaign-manual.ts`: 改为 `Partial<Record<CampaignProjectId, CampaignDashboard>>`，纯类型兼容，严禁侵入假数据。
  - `lib/campaign-enrichment-server.ts`: 注册黄天鹅 payload 与白名单。
  - `app/api/campaign-dashboard/route.ts`: 修复分日数据 mergeById 覆盖缺陷。
  - `scripts/onboard-huang-tiane.mjs`: 独立幂等注册脚本。
  - `docs/new-projects-sources/huang-tiane/integration/`: 架构设计文档。
  - 核心接线预留: `CampaignEnrichmentPanels.tsx` 扩展 `overview` 分发口；`CampaignOverviewPage.tsx` 预留增强入口。
- **其他 Worker 职责**:
  - Source A & B Worker: 负责 `facts.json` 真实业务事实提取与落盘。
  - UI Worker: 负责在 facts 就绪后实现 `HuangTianeBoard` 及各项目的 Rich 组件，不产生代码冲突。