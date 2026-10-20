# 稳健玉米酒精湿巾数据深入挖掘产物说明

## 1. 产物清单
- **前端集成独占文件**：`feihe-mvp/lib/campaign-enrichment/winner-wipes.json`
- **全量可复现提取脚本**：`docs/new-projects-sources/enrichment-winner-wipes/generate_enrichment.py`
- **数据质量核验脚本**：`docs/new-projects-sources/enrichment-winner-wipes/verify_enrichment.py`
- **数据对账与覆盖率审计**：`docs/new-projects-sources/enrichment-winner-wipes/enrichment-audit.json`

## 2. 来源与统计口径说明
1. **淘搜指数与分渠道投放 (`wipes-daily-taosou`)**：
   - 来源：飞书底表 `wY1HZO`。
   - 覆盖周期：2026/09/14 ~ 2026/10/19 共 36 个实际投放日（原表明确分日记载）。
   - 包含 6 大关键词日搜索指数、4 渠道投放消耗（K/F/S/CID）及进店 UV。日消耗总和 ¥361,363.47、总指数 9,375，与源表第 1 行总计误差为 0.00。
2. **全渠道投放日跟踪 (`wipes-daily-delivery`)**：
   - 来源：飞书底表 `0QTVhE`。
   - 覆盖周期：2026/09/16 ~ 2026/10/19 共 34 个实际投放日。
   - 站外活跃 UV 为小红星 30 日归因活跃人数，总消耗 ¥178,867.55 与源表第 37 行总计完全一致。
3. **广告投放版位结构表 (`wipes-placement-efficiency-table`)**：
   - 来源：飞书底表 `0QTVhE` 版位透视区。
   - 覆盖周期：2026/09/16 ~ 2026/10/19（与 By day 第 37 行总计一致）。
   - 包含视频内流、搜索推广、信息流推广三大版位及总计行（4 行）。
4. **关键词词类与 52 词明细表 (`wipes-keyword-category-table`, `wipes-keyword-detail-table`)**：
   - 来源：飞书底表 `WBP7aU`。
   - 周期：依据聚光底表推断约覆盖至 2026/10/19（非源表字面日期）。
   - 包含 4 大词类大盘（5 行含总计）及 52 个有效关键词转化与获客成本明细（不含合计行）。
5. **聚光定向人群包透视表 (`wipes-audience-packages-table`)**：
   - 来源：飞书底表 `PFSl9q`。
   - 周期：依据聚光数透底表推断约覆盖至 2026/10/19。
   - 包含 31 个精准定向人群包细分及 1 条大盘总计行（共 32 行）。
6. **达人层级与内容方向投放对比表 (`wipes-tier-efficiency-table`, `wipes-direction-efficiency-table`)**：
   - 来源：飞书底表 `9weg9y`（113 篇）+ `0lnwuD`（3 篇医学专家号），全量 116 篇笔记。
   - 周期：发布档期 2026/09/14 ~ 10/12，FS 投流数据截止 10/18。
   - 严格拆分 K 端达人采买费（¥188,049.65）与 FS 聚光投流费（¥164,978.79）。
7. **CID 组件引流明细表 (`wipes-cid-creator-table`)**：
   - 来源：飞书底表 `tiermz`。
   - 覆盖 10 位达人素材跨端引流监控及总计行（共 11 行）。

## 3. 数据质量保证
- **空值不充 0**：缺失值及除零情况严格保持 `null`。
- **UV 口径明确**：明确标注为小红星 30 日归因活跃 UV，组间人群存在重叠，不可直接简单去重累加。
- **加权费率计算**：所有 CPM、CPE、CPUV、CTR 均采用总量比值加权计算，不使用行平均值。
- **敏感信息排除**：不包含个人联系电话、微信号或敏感个人数据。
