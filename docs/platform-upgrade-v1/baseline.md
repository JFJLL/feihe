# 通用项目中台 V1 改造基线报告 (Baseline)

## 1. 基础环境与工作区信息

- **代码仓库**: `https://github.com/JFJLL/feihe`
- **基础提交 SHA**: `2169bf5d78e68dfaf0c1b578ff76c44aa3bd53ea` (`fix(feishu): allow both Q3 and Q4 weekly sheet header structure in normalize`)
- **开发工作区 (Worktree)**: `D:\download\pic-vec\feihe-platform-v1`
- **工作分支**: `codex/platform-upgrade-v1`
- **运行时环境**:
  - Node.js: `v24.11.1`
  - 包管理 / 构建系统: `npm` / `vite 8.0.13` + `vinext 1.0.0-beta.3`
  - 核心依赖: `next 16.2.6`, `react 19.2.6`, `drizzle-orm 0.45.2`, 内置 `node:sqlite (DatabaseSync)`
  - 配置文件: `config.json` (包含飞书应用凭证与系统配置，已安全挂载至开发环境，未纳入公开 Git 版本追踪)
  - 数据库: `feihe-mvp/data/local.db` (约 14MB SQLite 本地数据库，包含启萃完整历史与测试用例)

## 2. 现有测试基线执行记录

在改造开始前，已在独立隔离工作区内完整运行现有核心验证集：

| 验证命令 | 执行结果 | 说明 |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) | TypeScript 静态类型检查通过 |
| `npm run build` (`vinext build`) | **PASS** (100%) | 生产编译打包成功，共构建 284 个模块，无构建阻断 |
| `npm run verify:feishu` | **PASS** (100%) | 飞书全量同步、Q3/Q4表头自适应、并发去重与重试测试通过 |
| `npm run verify:xlsx` | **PASS** (8/8) | SSR环境、并发加载、网络重试等 8 个回归用例全部通过 |
| `npm run verify:dashboards` | **PASS** (100%) | 反馈分析、大盘增长、交互抽屉、状态卡片等看板测试全部通过 |
| `npm run verify:operations` | **PASS** (100%) | 20次并发重算、待办生命周期、多项目数据隔离等 12 个运维回归用例全部通过 |

基线状态说明：原有系统针对启萃社媒营销场景的既有功能和本地用例保持完备，但在权限隔离、通用项目接入、指标可配置性与多数据源边界上存在重大历史缺陷。

## 3. 历史问题深度审查清单

对照任务要求与审查线索，对当前系统代码进行复核，确认以下核心问题在基线代码中切实存在：

1. **权限与身份虚设 (P0 安全缺陷)**:
   - `lib/api-auth.ts`: `apiUser()` 始终返回固定公开用户 `{ userId: 'public-workspace', displayName: '公开访问' }`，`requireWrite` 参数被忽略，没有任何真实鉴权。
   - `lib/projects.ts`: `projectId()` 在参数为空或格式不合法时，默认回退为 `DEFAULT_PROJECT_ID` (`'qicui'`)。
   - API 路由未做项目权限校验，任意客户端请求可直接读取或修改任意项目资源。

2. **数据源覆盖与数据损毁风险 (P0 数据安全)**:
   - `lib/import-rows.ts`: 在导入供应商交付数据时，执行 `DELETE FROM supplier_comments WHERE project_id=?`，导致导入单个供应商数据源会清空当前项目内所有其他供应商数据。
   - `importRows()` 存在硬编码 `input.slice(0, 5000)`，超过 5000 行的数据被静默截断。
   - `feishu_sheet_snapshots` 按 `(project_id, sheet_id)` 存储，缺乏跨项目或通用数据源的数据集映射与生命周期管理。

3. **共享事实与项目私有属性未隔离**:
   - `notes` 与 `note_profiles` 表以单一 `note_id` 作为主键，项目私有的合作标记、达人报价、所属分类、品牌等属性被直接写入全局 `note_profiles`，多项目复用同一笔记时会互相覆盖。

4. **数据地图读取时隐式覆盖配置**:
   - `app/api/data-map/route.ts`: 在 `GET` 处理函数中执行 `await seed(project)`，强行写入固定的聚光、灵犀、IPSCG 账户与默认指标绑定，并直接标记为“连接正常”，缺乏真实的探测时间与检测凭证。

5. **项目中心与业务假设高度绑定社媒/启萃**:
   - `features/project-center/ProjectCenter.tsx` 与 `app/api/projects/route.ts`: 创建项目强行校验 `spu` 与 `brand`，状态后端硬编码为“进行中”，且自动为所有新项目生成小红书爆文/价值扫描/商业执行三条主线，以及飞鹤专属的正负向评论关键词与验收规则。
   - 创建成功后仅刷新项目列表，缺乏向导式初始化。
   - 识别色使用原生 `<input type="color">`，视觉突兀。

6. **指标与看板无法通用化配置**:
   - 看板视图 `OverviewWorkspace.tsx` 硬编码了社媒、投流、达人、评论等启萃特定卡片，没有根据项目所选模板和指标绑定动态加载。
   - 比率指标计算缺乏样本同范围保障。

## 4. 改造实施目标与约束

- 严格遵循阶段 0 至 阶段 7 推进。
- 在不破坏启萃原有运行能力的前提下，重构为组织-项目-成员多租户体系，打通数据接入-字段映射-统一指标引擎-动态看板全流程。
- 本地构建与自动化回归矩阵全绿，并在独立工作区和分支上完成最终推送。
