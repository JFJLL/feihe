# 干净主干集成与产物解耦方案 (2026-10-16)

## 1. 目标与架构原则

- **目标**：为飞鹤启萃营销看板提供一个以 main (commit 2169bf5) 为直接父节点的单次干净集成提交，彻底阻断 33 个历史 Commit 中包含的约 1.89 GB 调试跟踪包 (	race.zip)、过程截图及网络快照进入主干。
- **历史归档保护**：原交付分支 codex/business-delivery-v1 及其关联素材、1.89 GB 历史提交、真实数据库 eihe-mvp/.verification/business.db 均保持只读留存，不执行 
eset、
ebase 或破坏性重写。
- **主干体积控制**：干净集成包仅包含应用源码、运行时配置、必需测试 Fixture 及交付说明文档，文件总数约 340 个，Blob 总体积约 4.8 MB。

## 2. 文件分类与清单策略

### 2.1 Allowlist（准入保留清单）
1. **应用全部核心源码与样式**：
   - eihe-mvp/app/、eihe-mvp/components/、eihe-mvp/features/、eihe-mvp/lib/、eihe-mvp/styles/、eihe-mvp/types/。
2. **构建与运行配置**：
   - eihe-mvp/package.json、eihe-mvp/package-lock.json、eihe-mvp/tsconfig.json、eihe-mvp/vite.config.ts、eihe-mvp/playwright.config.ts、eihe-mvp/eslint.config.mjs。
3. **真实运行时与测试数据依赖**：
   - eihe-mvp/.openai/hosting.json
   - eihe-mvp/lib/competitor_intelligence.json
   - eihe-mvp/lib/migrations/rejected-snapshot-signatures.json
   - eihe-mvp/data/qicui/supplier-seed.json
   - eihe-mvp/tests/browser/feishu-fixture.mjs
4. **自动化脚本与迁移工具**：
   - scripts/migrate-delivery-project.mjs (根目录代理入口)
   - eihe-mvp/scripts/migrate-delivery-project.mjs (迁移核心工具)
   - eihe-mvp/scripts/test-delivery-migration.mjs (迁移回归测试)
   - eihe-mvp/scripts/test-p1-isolated.mjs (权限与日期隔离单测)
   - eihe-mvp/scripts/test-query-cache-isolated.mjs (查询缓存单测)
   - eihe-mvp/scripts/test-navigation-alias-history.mjs (真实 E2E 路由测试)
   - eihe-mvp/scripts/patch-vinext-aborts.mjs (受跟踪 postinstall hook)
   - eihe-mvp/scripts/ 其余已跟踪核心脚本。
5. **交付与规范文档**：
   - docs/delivery-v1/*.md
   - docs/business-v1/*.md
   - 各批次阶段交付结论 Markdown。

### 2.2 Denylist（排除清单，留存原分支）
- docs/*/browser-results/ 与 docs/*/browser-report/ (254 个 Playwright 	race.zip，1.71 GB)
- docs/*/evidence/、ttachments/、screenshots/ (949 张过程截图，141.89 MB)
- key-requests.json、persistence.json、
esults.json 等过程网络转储 (720+ JSON，29.95 MB)
- logs/*.log 过程输出日志 (396 个日志，1.44 MB)
- 根目录及 eihe-mvp/ 下未跟踪的 100+ 个临时探查/修复脚本。

## 3. D/R (Deleted / Renamed) 安全处理机制

物化至干净工作树 D:/download/pic-vec/feihe-merge-ready 时：
1. 先以 git diff --name-status main <finalSourceHead> 提取自基线以来的全部 D（删除）与 R（重命名旧路径）文件。
2. 仅在 clean 工作树内部限定边界内执行安全删除（git rm），杜绝任何已废弃文件在 overlay 时残留。
3. 比对 Allowlist 检出或复制最终源码，核验 package-lock.json 等关键文件哈希。

## 4. 离线证据链归档声明

历史文档中若包含指向本地 	race.zip 或网络抓包 JSON 的相对链接，其物理文件完整归档于 codex/business-delivery-v1 分支，主干不保留大体积离线跟踪包。
