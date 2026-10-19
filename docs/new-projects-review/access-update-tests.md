# 解锁资料适配器独立 QA 验证报告 (Access Update QA Tests Report)

- **测试执行时间**: 2026/10/19 17:09:32
- **执行命令**: `npx tsx scripts/test-campaign-unlocked.mjs`
- **测试定位**: 独立 QA 交叉测试，验证 `applyUnlockedMeilingKpi`、`applyUnlockedMeilingReports`、`applyUnlockedKailas` 三大适配器的跨模块串联共存、业务实质变异反例、统计周期隔离、边界值保真与全链路幂等性。
- **最终结论**: **11/11 测试全部通过 (PASS)**，无阻塞性问题，可安全集成。

---

## 1. 关键业务断言执行结果清单

| 序号 | 验证项 / 业务反例描述 | 状态 | 验证细节与实际输出 |
| :---: | :--- | :---: | :--- |
| 1 | **Meiling: 串联互不删除**<br>双向串联执行 KPI 与 Reports 适配器，卡表完整共存 | **PASS** | KPI 表=4，Reports 表=4，总计 8 张解锁新表；KPI 卡=26，Reports 卡=4，总计 30 张解锁指标卡，无互删或覆盖 |
| 2 | **Idempotency: 全链路串联重复应用幂等性**<br>连续两次执行完整更新管道，无数量扩张或 ID 重复 | **PASS** | sources=5, kpis=41, tables=14 严格恒定；Set 去重检查确认 sourceId / kpiId / tableId 均无重复 |
| 3 | **Meiling: 旧 KPI blocked placeholder 清除**<br>清除原 131006 权限受限的占位表与缺失警告 | **PASS** | `meiling-online-kpi-status`（官方KPI考核指标表-权限缺失提示）被彻底移除，替换为正式解锁数据表 |
| 4 | **Period: 统计周期严格隔离**<br>618 历史复盘、7-8月考核、双11大促周期不串不混 | **PASS** | 618 表卡标注 `2026年618大促（已结案）`，无“双11”字样；双11 表卡标注 `双11大促执行期`，无“618”字样 |
| 5 | **Mutation: CPC 目标变动动态驱动考核判定**<br>变异目标值，验证判定逻辑基于动态数据非硬编码 | **PASS** | 618 京东代采 CPC 实际 0.74元；原始目标 ≤0.8元判定为 **达标**；反例变异目标为 ≤0.5元后联动判定为 **未达标** |
| 6 | **Fidelity: actual 缺失与公式错误保留 null**<br>源表 `#N/A` 与空值不伪造为 0，不假达成 | **PASS** | 双11 渠道汇总表（BZjmuN）中京东种草等 `#N/A` 行，消耗与 ROI 保持 `null`，附注“源表数据引用异常，保持原表留白” |
| 7 | **MetricScale: 618 CTR 百分比正常达成 / 变异后不达成**<br>防 100x fraction 与百分点尺度混淆 | **PASS** | 原始 14.12% vs ≥10% 正确判定为 **达成**；反例变异实际值为 9.80% 准确判定为 **未达成**，无 `0.1412 < 10` 尺度错误 |
| 8 | **Sources: 新四 sourceId 严格沿用且状态 ready**<br>沿用旧 LT1 / RQff / MMPZ / Dkd 节点 ID | **PASS** | LT1=ready, RQff=ready, MMPZ=ready, Dkd=ready 四个来源均已联通并提供真实数据支撑 |
| 9 | **Kailas: 严格 comparison 字段比较**<br>点击率指标方向为 `gte`，成本指标为严格 `lt` | **PASS** | CTR 比较为 `gte`（≥10%）；CPC 比较为 `lt`（<0.8）；CPE / CPM 均为 `lt`，方向符合业务常理 |
| 10 | **Kailas: JPKUX9 数据变异联动驱动更新**<br>变异数据总览核心指标，验证表卡动态响应 | **PASS** | 变异 CTR 18.5%、CPC 0.42元后，KPI 卡片与数据总览表首行同步反映 18.5% 与 0.42元 |
| 11 | **Kailas: 幂等性与引用完整性**<br>重复 apply 不累加，所有卡表 sourceId 均在 sources 存在 | **PASS** | sources=5, kpis=12, tables=7；悬空 sourceId 校验通过（0 悬空） |

---

## 2. 专项问题核验与解决确认

### 2.1 美菱双适配器前缀隔离 (Prefix Conflict Resolution)
- **初审发现问题**: 原两适配器若使用相同前缀会导致后执行者通过 `!t.id.startsWith(PREFIX)` 将先执行者的表/卡片清理剔除。
- **整改与验证结果**:
  - `campaign-unlocked-meiling-kpi.ts` 统一采用前缀 `meiling-kpi-unlocked-`；
  - `campaign-unlocked-meiling-reports.ts` 统一采用前缀 `meiling-unlocked-`；
  - 经 Test 1 正反双向串联验证（KPI -> Reports 与 Reports -> KPI），4 张 KPI 表、4 张 Reports 表以及 30 张新增 KPI 卡均无条件共存。

### 2.2 Kailas 转义语法修复确认 (Kailas Template Literal Fix)
- **初期异常定位**: `feihe-mvp/lib/campaign-unlocked-kailas.ts` 第 99 行等处出现 `id: ${PREFIX}budget-ZpT73Q,` 未加模板字符串反引号，导致 TypeScript 词法解析抛出 `Expected "}" but found "{"`。
- **修复确认**: 该语法已由相关 agent 修复为反引号包裹，Test 8/9/10/11 在 `npx tsx` 环境下顺利执行并通过所有变异断言。

### 2.3 尺度与缺失值保真 (Metric Fidelity & Scale Safety)
- 验证确认 CTR 在 14.12% 格式下解析为 14.12，与目标 10 对比，避免除以 100 误判为 0.1412 未达成；
- 验证源表公式报错（`#N/A`、`#REF!`）均解析为 `null`，并在对应单元格/备注中给出明确的数据质量提示，杜绝静默转 0 或误判达标。

---

## 3. 命令行真实原始输出记录

```text
=== Running Campaign Unlocked Adapters QA Tests ===

[PASS] Meiling: 串联互不删除 (KPI与Reports适配器卡表完整共存) -> KPI表=4, Reports表=4, KPI卡=26, Reports卡=4
[PASS] Idempotency: 全链路串联重复应用幂等且无ID重复 -> sources=5, kpis=41, tables=14
[PASS] Meiling: 旧 KPI blocked placeholder 清除 -> meiling-online-kpi-status 已被解锁新表替代并清除
[PASS] Period: 统计周期严格隔离 (618历史复盘与双11大促不混淆) -> 618Period="2026年618大促（已结案）", D11Period="双11大促执行期（截至10月18日累计）"
[PASS] Mutation: CPC 目标变动动态驱动考核判定 (0.8达标 -> 0.5未达标) -> 正常目标=≤0.8元(达标) -> 变异目标=≤0.5元(未达标)
[PASS] Fidelity: actual 缺失与公式错误保留 null (不转 0 且注记错误) -> channel="京东种草", spend=null, roi=null, note="源表数据引用异常，保持原表留白，待业务源表修复"
[PASS] MetricScale: 618 CTR 百分比正常达成 / 变异后不达成 (无100倍比例误判) -> 正常=14.12% vs ≥10%(达成) -> 变异=9.80% vs ≥10%(未达成)
[PASS] Sources: 新四 sourceId 严格沿用旧 LT1/RQff/MMPZ/Dkd 且状态均为 ready -> LT1=ready, RQff=ready, MMPZ=ready, Dkd=ready
[PASS] Kailas: 严格 comparison 字段比较 (CTR为gte, 成本CPC/CPE/CPM为lt) -> ctr=gte, cpc=lt, cpe=lt, cpm=lt
[PASS] Kailas: JPKUX9 数据变异联动驱动 KPI 卡与总览表更新 -> CTR=18.5%(期望18.5%), CPC=0.42元(期望0.42)
[PASS] Kailas: 重复 apply 幂等且无悬空 sourceId -> sources=5, kpis=12, tables=7

=== Summary ===
Total: 11 | Passed: 11 | Failed: 0
```
