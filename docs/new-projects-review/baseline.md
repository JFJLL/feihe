# 营销看板新建项目阶段基线与真变异测试报告 (Baseline & Mutation Report)

- **检查时间**: 2026-10-19 15:55
- **执行环境**: Node.js v24.11.1 / npx 11.13.0 / tsx v4.23.15 / Windows (PowerShell)
- **执行范围**: 3大适配器实测（Kai/Wipes最新重构版 + Meiling）、TypeScript 编译、ESLint 代码规范

---

## 1. 真实适配器实质变异测试结果 (`test-campaign-adapters.mjs`)

调用真实 TS 纯函数 (`applyWipesSnapshot`, `applyMeilingSnapshot`, `applyKailasSnapshot`) 驱动反例变异测试：

| 测试项 | 状态 | 验证细节 |
| :--- | :--- | :--- |
| **Wipes: 变异 actual/target** | **PASS** | 动态计算，KPI卡与比较表随入参 19.88 / 30.00 联动变化 |
| **Wipes: 缺省 actual 防回退** | **PASS** | 缺省时返回 null/无值，绝不回退至硬编码 8.23 |
| **Wipes: 缺省 weekly 防虚构** | **PASS** | 缺省时绝不虚构 weekly source 与 116 篇执行表格 |
| **Meiling: 缺省候选池防回退** | **PASS** | 缺少统计信息时返回 null，绝不回退至硬编码 1096 |
| **Meiling: 动态重算二核与发布** | **PASS** | 依据 records 实时动态重算 confirmed (50) 与 published (30) |
| **Meiling: 无忧嵌502 品类归类** | **PASS** | 严格归入“无忧嵌系列”，绝不误归入 502pro 系列 |
| **Idempotency: 重复 apply 幂等** | **PASS** | 连续执行 sources/kpis/tables 数量与内容严格幂等 |
| **Referential: sourceId 完整性** | **PASS** | 全量 kpi/table.sourceId 均在 sources 中有效声明 |
| **Kailas: 保护手工真实预算** | **PASS** | 副本为 0 时保护 manual 906818.64 不被误清零覆盖 |

**测试结论**: **9 项变异反例测试全部 PASS (9/9)**。

---

## 2. 静态检查基线 (TSC 与 ESLint)

1. **TypeScript 编译 (`tsc --noEmit`)**:
   - 结果：**0 Error (TypeScript: No errors found)**。全工程含 `CampaignWorkspace.tsx` 均已通过类型检查。
2. **ESLint 检查**:
   - 核心看板组件与公共类型 (`CampaignDashboard.tsx`, `campaign-types.ts`, `campaign-catalog.ts`, `campaign-manual.ts`, `campaign-online-kailas.ts`, `campaign-online-meiling.ts`, `campaign-store.ts`): **0 issue**。
   - 待协作代理优化提示: `lib/campaign-online-wipes.ts` 存在 2 处 `@typescript-eslint/no-explicit-any`（已记录，不影响功能逻辑与运行）。
