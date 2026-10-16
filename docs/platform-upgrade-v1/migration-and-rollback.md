# 启萃业务平滑迁移、对账与回滚方案 (Migration & Rollback)

## 1. 原则与前提

1. **绝对不删除重建**: `qicui` 项目标识和数据库中的历史数据（包括千余篇笔记、万余条评论与日度指标）完整保留。
2. **提取而非硬编码**: 将原写死在通配函数中的“启萃”专用逻辑（如特定飞书 Wiki Sheet ID、打标关键词、验收规则）解耦并提取为项目级专有配置及历史适配器。
3. **可恢复与幂等**: 迁移脚本支持多次重复执行，具备前置检查与数据备份。

## 2. 迁移执行步骤

1. **备份数据库**: 对 `feihe-mvp/data/local.db` 生成带时间戳的完整镜像副本 `local.db.backup.<timestamp>`。
2. **结构升级 (Schema Migration)**:
   - 新增多租户对象表：`organizations`, `departments`, `clients`, `project_members`, `dashboards`, `dashboard_cards`, `note_project_profiles`。
   - 为现有 `data_sources`, `supplier_comments`, `comment_snapshots` 补充必要的多源隔离字段。
3. **数据回填与适配**:
   - 创建默认组织 `org-default` 与市场部、运营部。
   - 将现有 `qicui` 项目关联至组织，并分配默认负责人及项目管理员。
   - 将全局 `note_profiles` 中的项目私有字段（报价、合作、分类等）安全回填至 `qicui` 的 `note_project_profiles`。
   - 为 `qicui` 注入内容营销与评论质检的默认看板配置与指标绑定。
4. **指标与数据对账**:
   - 对比迁移前后的笔记总数、评论总数、曝光互动量、供应商核验数，确保数值完全一致。

## 3. 回滚方案 (Rollback)

若在测试或部署中发现严重不可逆异常：
1. 停止运行中的 Node 服务。
2. 将备份的 `local.db.backup.<timestamp>` 恢复覆盖 `local.db`。
3. 检查文件权限与 WAL 日志文件完整性后重新启动服务。
