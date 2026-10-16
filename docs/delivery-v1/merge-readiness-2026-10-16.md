# 交付 V1 主干合并就绪验收报告 (Merge Readiness Report)

**验收日期**：2026-10-16  
**验收环境**：Windows 11 / Node.js v24.11.1 / PowerShell  
**独立验收代理**：Hypatia (`01a1427b-0d63-7c71-a1fb-de310529519a`)  
**主库基线**：`main` (`2169bf5d78e68dfaf0c1b578ff76c44aa3bd53ea`)  
**源分支提交**：`codex/business-delivery-v1` HEAD `e7ff247d4f070a77cdda14477bbbe39f1a3ec94a`  
**干净集成工作树**：`D:\download\pic-vec\feihe-merge-ready` 分支 `codex/merge-ready-20261016`  

---

## 一、核心验收结论：READY FOR MERGE (可合并)

在干净集成工作树 `feihe-merge-ready` 独立执行全新依赖安装、类型检查、生产构建，并在独立隔离服务（端口 5249）与临时副本数据库上完成全套真实自动化回归测试。全部测试 **100% PASS，退出码均为 0**。

主工作区 `D:\download\pic-vec\feihe` 保持纯只读（HEAD `2169bf5`），用户现有 5246 端口预览服务未重启、未修改。

---

## 二、实际执行命令与退出码

| 验收步骤 | 执行工作目录 | 实际执行命令 | 退出码 | 关键结果 |
| :--- | :--- | :--- | :--- | :--- |
| **依赖安装** | `feihe-merge-ready/feihe-mvp` | `npm ci --prefer-offline` | **0** | 500 packages，自动应用 Vinext 499 守卫 |
| **类型检查** | `feihe-merge-ready/feihe-mvp` | `npm run typecheck` (`tsc --noEmit`) | **0** | 0 errors |
| **应用构建** | `feihe-merge-ready/feihe-mvp` | `npm run build` (`vinext build`) | **0** | 全部 54 条路由静态/动态打包完成 |
| **核心边界测试** | `feihe-merge-ready/feihe-mvp` | `node --test scripts/test-p1-isolated.mjs` | **0** | 16/16 PASS（跨项目隔离、日期范围、快照保真） |
| **查询缓存测试** | `feihe-merge-ready/feihe-mvp` | `node scripts/test-query-cache-isolated.mjs` | **0** | 9/9 PASS（5 项并发竞态 + 4 项边界回归） |
| **迁移自动化测试** | `feihe-merge-ready/feihe-mvp` | `node scripts/test-delivery-migration.mjs` | **0** | 8/8 PASS（自建沙箱 Fixture，零外部依赖） |
| **迁移真库演练** | `feihe-delivery-v1` | `node feihe-mvp/scripts/test-delivery-migration.mjs --real-rehearsal` | **0** | 28 篇日报、60 篇封面画像补齐、3 热卡可用 |
| **真实 E2E 导航** | `feihe-merge-ready/feihe-mvp` | `node scripts/test-navigation-alias-history.mjs` | **0** | 6/6 PASS（Playwright 驱动真实 5249 端口） |

---

## 三、关键缺陷修复与实际断言证据

### 1. 设置页 3 旧别名历史栈修复与真实 E2E
- **覆盖别名**：`/settings?tab=data`（及 `data-sources`）、`/settings?tab=metrics`、`/settings?tab=reports`；
- **修复验证**：经由 `navigateTo(target, { replace: true })` 触发 `history.replaceState`；
- **真实浏览器行为**：Playwright 访问真实应用，单次 `page.goBack()` 直达进入前序页，彻底消除了历史死循环 Trap；单次 `page.goForward()` 恢复目标工作区；业务查询参数（`purpose`、`datasetId`、`new`、`view`）及 hash 完整保留，`tab` 别名参数干净剥离；真实 DOM 子导航激活项与工作区容器成功挂载。

### 2. 启萃报告日期范围与快照真实边界
- **严格范围匹配**：`[2026-10-14, 2026-10-15]` 闭区间查询真实执行 `business_day >= ? AND business_day <= ?`，精准命中范围内记录，杜绝了区间外历史确认快照因权重抢占首位的缺陷；
- **状态如实展示**：未确认记录真实呈现为“来源快照”，不伪装为“已确认归档”；
- **空区间阻断**：无快照日期范围显式抛出 `DefinitionError`，不隐式回退旧基线。

### 3. 笔记封面跨项目越权与穿透防御
- **前置所属校验**：严格校验 24/32 位十六进制 ID，并校验属于当前项目的 `project_notes`、`business_note_archives` 或 `competitor_notes`；
- **本地缓存命中防御**：即使存在已污染或跨项目的本地缓存记录，`getNoteCover` 仍执行归属断言并返回 null，API 统一响应 404，不泄漏图片二进制；
- **未命中与 Resolve 防御**：全局表存在但非本项目笔记，阻断下载并不写入缓存，响应 404；
- **真实 3 热门笔记**：`6abe4fe8...`、`6abcd950...`、`6abf9c6e...` 本地封面与解析 URL 100% 成功解析（HTTP 200/302）。

### 4. 主库副本迁移与安全调度约束
- **白名单限定**：仅针对启萃项目迁移 20 张业务表，严格排除全局用户、租户、组织、权限与账号凭据；
- **全字段比对与行 Hash 防篡改**：完全同值计入 `unchanged`（14,638 行）；全局表与外部项目行 Hash 前后 100% 一致；`business_daily_reports` 确认态记录强行拒绝覆盖；
- **防活任务与 worker 绕过**：
  - 8 个 `business_sync_tasks` 强制置为 `paused`；
  - `business_comment_jobs` 活跃状态（`queued/retry/running`）强制转为 `paused` 并清空租约；
  - `business_sync_requests` 未决请求自动回填归档时间戳；
  - 目标库中针对活跃任务的候选查询返回数量恒为 0；
- **幂等零漂移**：`projects.qicui` 仅限空值补齐，二次幂等运行 `updated_at` 零毫秒漂移；
- **Pre-commit 强校验**：孤立引用校验与 28 篇日报 JSON 解析置于事务 `COMMIT` 前执行，异常即回滚。

---

## 四、体积与 Allowlist 清理事实

- **排除冗余过程文件**：共排除 2,747 个临时制品（254 个 Playwright `trace.zip` ~1.71 GB、949 张排查过程截图 ~142 MB、720+ 个抓包转储 JSON ~30 MB、396 个过程日志 ~1.4 MB）；
- **干净集成工作树纯净体积**：相对 `main` 纯净变更 360 个文件（+55,076 / -4,199 行），代码与文档体积仅约 4.8 MB；
- **依赖清单锁定**：`package-lock.json` SHA-256 为 `2b8615ea6a5dbe538783f83c0fe56c501e8b16e52a05054fd1d65b34fe7c1beb`，与源分支完全一致。

---

## 五、外部业务数据与边界说明（非代码 Blocker）

客户数据源缺口（如部分底表未填报、SEO 外部排名表未接入、历史口径差异等）已在业务层做好容错兜底，属于运营范围边界，不阻断代码合入主干。

---

## 六、运行切换方案

1. **验收临时端口服务**：运行于独立端口 5249（PID `33424`），指向临时副本数据库，验收完毕可随时安全终止；
2. **现有 5246 端口服务**：保持未动；在主干合并完成后，经父协调授权，可使用新构建产物以单进程方式定点重启切换，无缝挂接用户既有业务数据库。
