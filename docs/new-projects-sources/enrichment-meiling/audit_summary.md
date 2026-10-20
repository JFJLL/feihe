# 美菱双11数据挖掘与可视化切片核查报告（修正版）

- 加工执行时间：2026-10-20T11:45:00+08:00
- 原始缓存抓取时间：2026-10-19（多维表格 15:27，日报表 18:25，KPI 08:38）
- 项目ID：`meiling`
- 产物路径：`feihe-mvp/lib/campaign-enrichment/meiling.json`

## 一、保留的核心切片数据表（共 5 张）

1. **`meiling-enrich-matrix-product-stage`**：117位二核确认达人【主推产品 × 审核执行阶段】交叉矩阵长表（热力图）
2. **`meiling-enrich-matrix-platform-stage`**：117位二核确认达人【外溢平台链路 × 审核执行阶段】交叉矩阵长表（热力图）
3. **`meiling-enrich-content-theme-format`**：117位二核确认达人【内容类型 × 合作形式】分布计数表（真实纯计数，去未证实量级/成本）
4. **`meiling-enrich-channel-creative-efficiency`**：天猫自采（775条，2026-09-30~2026-10-18）vs 京东自采（1209条，2026-09-29~2026-10-18）渠道投放效率对比
5. **`meiling-enrich-note-creative-efficiency`**：全量14篇商业笔记素材投放效率明细（全量去重，非Top14，各行带真实投放周期）

## 二、主审阻断项修复说明

- **抓取时间修正**：各 source 的 `fetchedAt` / `syncedAt` 恢复为真实 2026-10-19 缓存快照时间，`extractedAt` 单独作为 2026-10-20 加工时间。
- **周期精确对齐**：天猫计算周期为 `2026-09-30 ~ 2026-10-18`（19天），京东计算周期为 `2026-09-29 ~ 2026-10-18`（20天），每行均带准确 `period`。
- **缺值不填充0**：彻底去除 `.get_final() or 0`，缺失分子/分母者严格置为 `null`；全量笔记明细标记为“素材创意名称（非实名达人姓名）”。
- **剔除硬编码表**：已完全移除硬编码的 `pacing_data` 预算表和 `scheduled` 档期表，杜绝虚假审计断言。
- **权限缺失说明**：`wiki/RQffw002Aik9aNkW9PScJ05knre` 报 `131006 permission_denied`，由开放副本 `wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc` 完整接替。
