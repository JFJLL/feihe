# Feihe 通用项目中台 V2 前端定向整改技术排查与修复报告 (Findings)

## 1. 概述与审查基线

- **基础分支**：`codex/platform-upgrade-v2`
- **审查提交**：`08841848f96592eb6e8b38a1af05d4aacaedba00`
- **工作分支**：`codex/platform-upgrade-v3`
- **整改目标**：针对平台 V1 初版中存在的真实用户路径断点、数据截断、计算错位、状态虚假、深链接失效及 UI 不一致问题，执行深度定向修复，达成完整前端产品闭环。

---

## 2. 问题深度排查与修复详述

### Issue 1: 看板 500 行截断与客户端独立计算 (Section 2.1)
- **根本原因**：`app/api/datasets/route.ts` 硬编码 `LIMIT 500`，且未返回分页元数据；`GeneralWorkbenchBoard.tsx` 在前端基于这 500 行数据通过内联函数 `evaluateCard` 维护私有求和与比率算法，无法覆盖全量数据集。
- **修复方案**：
  1. 重构 `app/api/datasets/route.ts`：支持真实服务端分页参数 `page`、`pageSize`，支持全量关键字模糊搜索 `search`，返回标准分页结构 `{ page, pageSize, total, totalPages, currentPageRows }`；
  2. 在 `lib/metrics/engine.ts` 中实现统一指标试算服务 `evaluateCardMetric`：在服务端针对全量授权数据集（SQLite `dataset_rows`）执行精确聚合与加权比率计算，彻底剥离前端独立算法；
  3. 新增 `POST /api/metrics` 评估端点：支持看板卡片全盘批量试算与单卡实时试算预览；
  4. **实测验证**：构造 501 条记录测试集（前 500 条每条咨询 1/成交 0；第 501 条咨询 100/成交 100），全盘加权成交率精确为 **16.7%**（100 / 600），分页第 34 页与全量搜索准确命中第 501 条记录。

---

### Issue 2: 飞书多维表格 5000 行静默截断与分页死循环 (Section 2.2)
- **根本原因**：`app/api/feishu/sync/route.ts` 中的 Bitable 分页循环包含 `while (hasMore && rows.length < 5000)`，达到 5000 行直接截断并伪报同步成功；且无 `page_token` 重复循环保护。
- **修复方案**：
  1. 移除 5000 行截断限制，根据 `has_more` 与 `page_token` 真实遍历全部分页；
  2. 新增 `visitedTokens` 集合检测重复游标，并在无进展时抛出异常；
  3. 设定 50,000 行系统安全上限，超过时明确报错而非静默截断；
  4. 分页中途失败时严格抛出异常，绝不把残缺数据发布为完整版本；
  5. 引入 `normalizeBitableFields`，对人员、富文本、多选、关联等复杂字段对象执行标量化清洗，杜绝页面出现 `[object Object]`。

---

### Issue 3: saveDataset 批量写入失败导致旧数据被清空 (Section 2.3)
- **根本原因**：旧实现先执行元数据更新，接着执行 `DELETE FROM dataset_rows`，再分批（每批 80 条）执行 `INSERT`。若第二批写入发生网络或数据库故障，旧版本已被删除，造成数据不可逆丢失。
- **修复方案**：
  1. 实现整体暂存版本切换机制（Staging Version Switchover）：
     - 将所有新行先以临时隔离数据集 ID（`stagingId`）批量写入 `dataset_rows`；
     - 若写入过程中发生任何异常，在 catch 中清理 `stagingId` 的暂存行并抛出异常，原数据集记录与原行数据 **0% 触碰，100% 完好**；
     - 仅当全部暂存批次成功后，在原子事务 `d1.batch` 中依次执行：① 删除原数据集旧行；② 将 `stagingId` 切换为正式 `datasetId`；③ 更新元数据表 `datasets`（版本递增、更新时间与实际行数）；
  2. **故障注入验证**：先写入 2 条旧记录（v1），随后在写入第 2 批（共 90 条新数据）时注入崩溃异常，验证数据库中原 2 条数据完好无损，版本号维持 v1。

---

### Issue 4: 飞书接入可视化字段映射与陌生字段闭环 (Section 3.1 & 3.2)
- **根本原因**：历史界面要求用户手动查 Sheet ID、手写范围与 JSON；`data_sources.mapping_json` 保存后从未被同步流程消费；Wiki 嵌套多维表格时因正则匹配失败退回电子表格接口报错。
- **修复方案**：
  1. 交付可视化字段映射组件 `FieldMappingEditor.tsx`：提供智能检测工作表、原始数据 5 行快照预览、字段映射表格（来源字段、目标字段名、数据类型、主键、业务日期、必填与空值策略）以及映射后实时转换预览；
  2. 允许已有数据源在列表中重新打开并修改映射（新增 `✏ 编辑/映射` 按钮）；
  3. 在 `app/api/feishu/sync/route.ts` 与 `lib/import-rows.ts` 中消费 `mapping_json`：在入库前执行 `applyFieldMapping` 真实清洗与转换；
  4. 修复 Wiki→Bitable 解析：通过开放平台 `spaces/get_node` 识别节点 `obj_type === 'bitable'`，自动提取真实多维表格 appToken 并分流至多维表格抓取链路。

---

### Issue 5: 封堵假成功类型与用途校验 (Section 3.3)
- **根本原因**：前端数据用途下拉框提供 `competitor`，但导入器 `importRows` 仅有 `general`、`owned`、`supplier` 分支，传入其他类型仍虚增计数返回成功。
- **修复方案**：
  1. 在 `importRows` 中增加严格用途白名单校验（`['general', 'dataset', 'owned', 'supplier']`），传入未知类型直接抛出异常；
  2. 前端移除或禁用不支持的用途选项，并明确提示使用专项情报模块。

---

### Issue 6: 顶部“同步最新数据”错配 (Section 3.4)
- **根本原因**：`OverviewWorkspace.tsx` 顶部同步按钮发送 `all: true`，直接调用硬编码启萃专用 4 份文档的 `syncFeishuSpreadsheets('qicui')`，导致非启萃项目报错或越权读取启萃。
- **修复方案**：
  1. 在 `app/api/feishu/sync/route.ts` 中针对 `all: true` 区分项目上下文：
     - 若 `project === 'qicui'`：继续执行启萃历史多表同步；
     - 若 `project !== 'qicui'`：查询当前项目已配置的数据源，逐一执行安全同步；若未配置数据源，返回明确引导提示 `{ needSetup: true, message: '请先接入数据源' }`；
  2. 彻底杜绝跨项目读取启萃数据，顶部状态与设置页面状态保持同步。

---

### Issue 7: 看板编辑草稿与发布分离、409 冲突与空看板保持 (Section 4.1 & 4.2 & 4.3)
- **根本原因**：卡片编辑直接修改内存数组，取消编辑无法复原；删除全部卡片保存后，刷新因 `cards.length === 0` 强行恢复默认卡片；409 并发冲突仅提示刷新；比率卡片无法选择分子分母。
- **修复方案**：
  1. 分离 `publishedCards` 与 `draftCards`，取消编辑时一键恢复原发布配置；
  2. 交付 `UnsavedChangesDialog`：未保存时切换数据集或离开页面提供保存、放弃、继续编辑选项；
  3. 交付 `ConflictResolutionDialog`：409 冲突时完整保留本地草稿，提供重新加载最新版或强制覆盖选项；
  4. 修复空看板保持：若看板在数据库中已存在且保存为 0 张卡片，刷新时尊重空看板，展示规范空状态，不再强制复原预置卡；
  5. 交付 `CardEditModal.tsx`：支持选择数据集、计算方式（求和/平均/计数/去重/比率）、比率分子分母选择、细分维度（`groupBy`）、业务日期与单位，并提供全量实时试算预览；
  6. 支持卡片点击 `✏` 重新编辑，不再必须删除重建。

---

### Issue 8: 数据明细元数据与分页约束 (Section 4.4)
- **根本原因**：表头依赖 `Object.keys(rows[0])`，第二行出现的字段无法显示；切页后可能出现 `4/1页` 空白异常。
- **修复方案**：
  1. 表头优先消费数据集 `columns` 元数据；
  2. 增加当前页保护逻辑：`Math.min(currentPage, totalPages)`，重置切换为第 1 页。

---

### Issue 9: 初始化向导真实条件与角色权限 (Section 5.1)
- **根本原因**：向导无条件将通用项目 metrics 标为完成；有创建者即声称团队协作完成；完成接口无条件写入全部步骤完成；角色固定假设为管理员。
- **修复方案**：
  1. 真实推导步骤状态：
     - 指标卡完成需同时满足“已落库数据行 > 0”且“看板卡片 > 0”；
     - 成员步骤在单人项目标记为“选填”，支持单人跳过，绝不声称已邀请团队；
  2. `update_onboarding` 接口保存真实的已完成步骤与跳过步骤列表，杜绝全量伪造；
  3. 注入真实成员角色：向导与操作按钮根据权限展示说明或禁用。

---

### Issue 10: 深链接与浏览器历史同步 (Section 5.2)
- **根本原因**：`useProjectTab.ts` 中本地 `selectedTab` 状态优先级高于 URL 参数，浏览器后退或深链接无法生效；`SettingsWorkspace.tsx` 的 `visited` 集合未同步外部 URL 变更导致面板未挂载。
- **修复方案**：
  1. 重构 `useProjectTab.ts`：以 URL 为单一真理源，监听 `popstate` 事件即时响应前进后退；
  2. 在 `SettingsWorkspace.tsx` 中将当前 `tab` 动态并入 `visited` 集合，确保直接打开 `?tab=data-sources` 或 `?tab=members` 时组件即时挂载。

---

### Issue 11: 数据管理一级入口与分析接口故障隔离 (Section 5.3)
- **根本原因**：`ProjectShell` 强依赖 `dashboard` 接口，分析接口 500 导致用户无法进入设置修复数据源；通用项目缺少数据管理入口。
- **修复方案**：
  1. 在通用项目侧边栏增加一级入口“数据管理” (`02 数据管理`，直达 `settings?tab=data-sources`)；
  2. 在 `ProjectShellContent` 中隔离设置与数据路由：分析接口异常时展示顶部警告横幅，但不阻断设置、数据源与成员管理。
