# 营销复盘新建项目交付报告 (Campaign Delivery Report)

- **交付日期**：2026-10-19
- **涵盖项目**：凯乐石 (Kailas)、美菱 (Meiling)、酒精湿巾 (Winner Wipes)
- **运行机制**：飞书读取快照 + 离线日报人工补充（只读本地 Store，无前端自动拉取，无后台定时任务）

---

## 1. 架构与运行模式说明

当前营销复盘看板采用**本地双轨数据架构**：
1. **数据存储与展现**：前端页面重新加载时仅读取本地 SQLite (`project_settings`) 序列化的看板快照，不直连飞书 OpenAPI，不设自动轮询或后台 Cron 定时拉取任务。
2. **版本严格隔离**：飞书线上多维表/表格读取快照与用户提供的离线历史日报独立归档，各自保留独立 Source、KPI 与表格，严禁直接覆盖导致历史对比失效。

---

## 2. 三项目核心设计重点

| 项目名称 | 品牌/品类 | 战役定位与监控重点 | 核心风险与预警 |
|---|---|---|---|
| **凯乐石 (kailas)** | 户外越野跑鞋 | 监控大坡王黑山 Q3 投放与日常执行。日报截图现金投流规划 85.00 万元（非全域预算），累计消耗 90.68 万元；9/29 含返点 K + 投流三子项目预算单独列示。 | 现金投流规划累计超支 -5.68 万元（进度 106.68%），重点为 F 线超支 -9.28 万元。 |
| **美菱 (meiling)** | 家电大促 | 监控双11小红书种草提报与执行管线。解耦全量初筛候选池 (1096) 与真实二核确认人群 (117)。 | 严格区分初筛候选与确认达人，切断未合作候选冒充达人规模；解耦离线日报 (108/44) 与线上多维表 (117/50)。 |
| **酒精湿巾 (winner-wipes)** | 稳健医疗湿巾 | 监控玉米消毒湿巾日常种草与大促蓄水。累计消耗 16.53 万元，新客占比 59.73%，跟踪 KFS 与 CID。 | KPI 子表未注明统计截止时间（周报时间明确为 2026/9/16–10/11）；医生 CPE 存在源进度 185.64% 与目标比值 195.31% 的口径差异。 |

---

## 3. 12 个飞书资源链接访问核验结果

核验了用户提供的 12 个飞书在线资源（Wiki / 多维表格 / 电子表格 / PPT 附件）：

- **权限受限 (4 个，返回 `131006 / permission_denied`)**：
  1. 凯乐石资料 Wiki：`LT1MwikWci8LTDk0UL7coXfrnVb`
  2. 美菱官方 KPI Wiki：`RQffw002Aik9aNkW9PScJ05knre`（无法获取品牌考核目标，系统保留空提示）
  3. 美菱资料 Wiki：`MMPZwhQbMiVmIKkcyb9c7mDQnHp`
  4. 美菱投放日报 Wiki：`DkdOwDEk0i9FTUkXlh1cTE0fnOd`
- **历史资料与大文件仅留元数据 (2 个)**：
  1. 凯乐石阶段复盘 PPT：`XI8XbmwQKo4gGKxipdycvmM8n2g`（二进制演示大文件，仅保留名称及节点元数据）
  2. 美菱 618 项目复盘：`UKPKwNHFdi9jk0kBaQKcuO3Anqf`（确认为 618 历史复盘，非当前双11，仅留索引标识）
- **正常解析与读取 (6 个)**：
  1. 凯乐石常见问题表：`MetCwmTK2iof7Sk2SqacURIWnPe`
  2. 凯乐石日常执行表：`S2FRw04w6i21DikL6DVcmfG8nSh`
  3. 凯乐石黑山 Q3 投放副本：`H9y3wPrjQi817YkAyrvcaxzAncg`
  4. 美菱多维表格底表：`XH2obMhtwaPCWUsmsWacRCpLnvg`（数据表 `tbluz50zuZOeGQWf`，视图 `vewOPEh08l`）
  5. 稳健湿巾执行表格：`Jo2cwK3c9ishJdkq40ycfNSMnTh`（工作表 `OgJUzb`）
  6. 稳健湿巾周报文档：`VDyYwLnG9ivYpOko7eocjEvrnag`

---

## 4. 关键口径差异与数据质量核验

1. **凯乐石副本 `#REF!` 退零处理**：
   - 线上表格《黑山Q3-种草投放数据 副本》因跨表引用断裂出现大量 `#REF!` 错误，线上直接统计将失真退零；
   - 系统将该表标记为“公式异常待核对”，保留 10.16–10.18 日报截图现金投流规划 85 万与消耗 90.68 万元作为凭据。
2. **稳健湿巾 KPI 目标与进度口径差异**：
   - **考核目标明确存在**：医生互动目标 7,063、实际 11,150；医生 CPE 目标 10.00 元、实际 5.12 元；
   - **进度计算口径差异**：医生 CPE 源表标注进度为 `185.64%`，而按目标与实际比值 `10 / 5.12` 计算为 `195.31%`；
   - **统计截止时间说明**：周报文档明确记录时间周期为 `2026/9/16–10/11`，未注明统计截止时间的是独立的 KPI 访问子表。
3. **美菱线上 117/50 与日报 108/44 隔离及 106 差额**：
   - **线上多维表（2026-10-19 快照）**：严格二核确认合作达人 **117 位**，已发布 **50 篇**（发布率 42.74%），活跃制作管线 **120 位**；
   - **离线历史日报（10.19 日报快照）**：声明确认合作达人 **108 位**，已发布 **44 篇**，且分项明细（内审 18 + 待品牌审 5 + 修改中 8 + 拍摄中 27 + 定稿 4 + 发布 44）合计为 **106篇，与确认合作108位需核对统计口径，数量差2不直接推定缺失两位达人**；
   - **版本隔离**：线上数据与离线日报分别挂载独立 Source，严禁相互覆盖；
   - **管线 3+3 差异**：活跃管线 120 位与严格二核 117 位存在 3+3 偏差（Frank生活家、冉冉理想家、空昵称 3 位已进入审核制作但二核未勾选；阿白呀改供图、北北聊家居、苏苏苏苏 3 位二核已确认但未建常规审核流）。

---

## 5. 可重复数据刷新操作步骤

当本地需要重新提取并刷新看板时，严格按以下步骤执行（凯乐石尚无全自动脚本，需重新采集；不承诺不存在的外部工具）：

```bash
# 1. 美菱多维表刷新：需先通过 lark-cli 重新采集最新 dump，再执行重算脚本
lark-cli base +record-list --base-token XH2obMhtwaPCWUsmsWacRCpLnvg --table-id tbluz50zuZOeGQWf --view-id vewOPEh08l --as user --format ndjson --output .codex_work/meiling-dumps/all-projected.ndjson --overwrite
python docs/new-projects-sources/build_meiling_base.py

# 2. 稳健酒精湿巾刷新：运行已有提取脚本拉取最新表格与周报
python docs/new-projects-sources/extract_wipes_data.py

# 3. 凯乐石数据刷新：当前无全自动脚本，需通过 lark-cli sheet +read 重新手动/CLI 采集并更新 kailas-sheets.json

# 4. 执行项目注册与看板快照更新（写入 local.db，支持幂等更新）
node feihe-mvp/scripts/onboard-campaign-projects.mjs --apply
```

---

## 6. 测试与验证状态

- **TypeScript 静态检查**：`npx tsc lib/campaign-online-meiling.ts --noEmit` 校验通过（0 错误）。
- **美菱 Adapter 逻辑与幂等性验证**：已完成单元测试，确认多次重复应用时旧 Warning 清理彻底，产品分组优先匹配无忧嵌且无硬编码死值。
- **Playwright 端到端浏览器验收**：本地 5173 端口服务正在运行，浏览器端正在验收中。
  - [适配器变异测试用例](../../feihe-mvp/scripts/test-campaign-adapters.mjs)
  - 浏览器验收凭据链接待测试完成后留存，保持客观真实记录。
- **最终检查批次与验证汇总**：全局类型检查 (`npm run typecheck`)、ESLint 及 11 项适配器变异测试均已全部通过，详见 [final-checks.txt](./final-checks.txt)。
- **浏览器验收报告**：详见 [browser-checks.md](./browser-checks.md)（由 James 随后独立产出，验收结论以该报告为准，切勿提前声称其完成）。
