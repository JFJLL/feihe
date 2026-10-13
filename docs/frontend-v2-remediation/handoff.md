# Feihe 通用项目中台 V2 工程交接与上线说明 (Handoff)

## 1. 交付概况与 Git 状态

- **主工作树**：`D:\download\pic-vec\feihe` (`main` 分支保持未修改、未合并状态)。
- **开发与整改工作区**：`D:\download\pic-vec\feihe-platform-v3`
- **基础提交 (Base SHA)**：`08841848f96592eb6e8b38a1af05d4aacaedba00` (`codex/platform-upgrade-v2`)
- **交付分支**：`codex/platform-upgrade-v3`
- **重要约束**：**严禁合并到 `main` 主干**，仅在独立分支上提交并推送到远端。

---

## 2. 关键代码与架构演进清单

1. **统一指标计算与全量聚合** (`lib/metrics/engine.ts`, `app/api/metrics/route.ts`)：
   - 彻底废除前端独立内联指标算法；
   - 支持通用数据集多维度求和、平均、计数、去重计数与加权比率；
   - 加权比率基于同范围分子合计除以分母合计，杜绝行级比率简单平均；
   - 支持时间范围（`from`, `to`）与维度分组（`groupBy`）；
   - 501 行测试集加权成交率精确为 16.7%（100 / 600）。
2. **服务端全量数据分页与搜索** (`app/api/datasets/route.ts`)：
   - 移除 `LIMIT 500` 硬编码；
   - 支持 `page`、`pageSize` 与关键字模糊搜索 `search`，返回标准分页元数据；
   - 前端明细表格支持跨页浏览与搜索过滤，第 34 页直达第 501 条关键记录。
3. **整体暂存版本切换** (`lib/datasets.ts` - `saveDataset`)：
   - 写入前暂存至临时隔离 ID，批处理失败时回滚并清理暂存，旧数据版本 100% 保持；
   - 批处理成功后在单个事务内原子切换，实现零数据损坏的高可用持久化。
4. **飞书多维表格与可视化字段映射** (`features/settings/data-sources/`, `lib/feishu-detector.ts`, `app/api/feishu/sync/route.ts`)：
   - 支持工作表智能检测、5 行原始数据快照预览、可视化字段映射（字段名、数据类型、主键、业务日期、必填与空值策略）以及映射后转换校验预览；
   - 消费 `mapping_json` 真实转换并落库；
   - 支持对列表中已存在的数据源点击“✏ 编辑/映射”重新配置；
   - 支持 Wiki→Bitable 递归节点解析；
   - 标量化清洗复杂字段对象，消除 `[object Object]`。
5. **看板草稿隔离、409 冲突与空看板保持** (`features/overview/GeneralWorkbenchBoard.tsx`, `app/api/dashboards/route.ts`)：
   - `draftCards` 与 `publishedCards` 彻底分离，取消编辑复原草稿；
   - 交付未保存修改拦截弹窗 `UnsavedChangesDialog`；
   - 交付 409 乐观锁冲突解决弹窗 `ConflictResolutionDialog`；
   - 删光卡片保存刷新后保持为空看板，杜绝强制复原预置卡；
   - 提供 `CardEditModal.tsx`，支持卡片重新编辑与全量实时试算预览。
6. **向导真实状态、深链接与路由隔离** (`features/onboarding/OnboardingWizard.tsx`, `lib/hooks/useProjectTab.ts`, `components/project-shell/`)：
   - 步骤完成状态基于真实数据行数推导，单人项目支持跳过团队步骤；
   - 深链接与浏览器历史（前进/后退/刷新）通过 URL 单一真理源完全同步，自动挂载激活面板；
   - 侧边栏增加一级入口“数据管理”，分析接口故障时不阻断设置与数据维护。

---

## 3. 日常运行与本地验证指南

进入工程目录：
```bash
cd D:\download\pic-vec\feihe-platform-v3\feihe-mvp
```

### 3.1 本地测试命令

```bash
# 1. 静态类型检查
npm run typecheck

# 2. 前端定向整改 23 项端到端验收
npm run verify:e2e

# 3. 平台 V1 35 项基准矩阵验收
npm run verify:matrix

# 4. 前端闭环与口径精度测试
npm run verify:closure

# 5. 启萃历史业务对账
npm run verify:reconcile

# 6. 生产构建打包
npm run build
```

### 3.2 启动服务

```bash
# 开发环境调试 (默认 5173 端口)
npm run dev

# 生产环境预览 (5013 端口)
npm run start:prod
```

---

## 4. 关键安全与敏感数据规范

1. **凭证隔离**：
   - `config.json`（飞书 App Secret、OSS 密钥等）、`token.txt` 以及 `local.db` 保持在 `.gitignore` 保护范围，**严禁提交入 Git 历史**。
2. **主分支保护**：
   - **切勿执行 git merge main 或推送 main**，仅推送到远程开发分支 `codex/platform-upgrade-v3`。
3. **真实外部联调提示**：
   - 真实外部飞书多维表格同步需要用户在飞书开放平台配置正确的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`，并确保飞书应用已获得目标文档与多维表格的“查看/读取”授权。本地单元测试与矩阵验收已通过适配器模拟与内置 SQLite 100% 验证。
