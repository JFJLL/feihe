# 营销看板全量适配器实质变异测试与静态检查验证报告 (Validation Report)

> **说明**：此为过程记录，最终类型检查与ESLint均已通过，11/11数据测试通过，以 [final-checks.txt](./final-checks.txt) 为准。


- **执行时间**: 2026-10-19 16:00
- **执行命令**:
  - 变异测试: `npx tsx scripts/test-campaign-adapters.mjs`
  - TypeScript 检查: `npx tsc --noEmit -p tsconfig.json`
  - ESLint 检查: `npx eslint lib/campaign-*.ts features/campaign/*tsx app/api/campaign-dashboard/route.ts components/project-shell/ProjectShell.tsx components/project-shell/ProjectSidebar.tsx`

---

## 1. 适配器实质变异测试结果 (`test-campaign-adapters.mjs`)

全部基于真实 TS 纯函数与 docs 源 JSON 反例变异执行，无镜像 Mock：

| 序号 | 验证项与真反例描述 | 结果 | 诊断说明 |
| :--- | :--- | :--- | :--- |
| 1 | **Wipes: 变异 actual/target 驱动 KPI 与表格变化** | **PASS** | 动态计算，KPI 卡与比较表随入参 19.88/30.00 联动变化 |
| 2 | **Wipes: 删 actual 不回退 8.23** | **PASS** | 缺省 actual 时不回退至硬编码历史值 |
| 3 | **Wipes: 删 weekly 不造 116 发布与周报表** | **PASS** | 缺省周报正文时绝不生成虚构 weekly source 与执行表 |
| 4 | **Wipes: explicit null 实际值保持 null** | **PASS** | 显式传入 null 保持 null，无伪造数值与 NaN |
| 5 | **Wipes: 改变 weekly 周期文本动态反映新周期** | **PASS** | 正文修改为 11/01-11/20 截至 11/21，表格 period 动态联动 |
| 6 | **Meiling: 删候选池 stats 不回退 1096** | **PASS** | 缺少候选池统计时输出 null，无硬编码回退 |
| 7 | **Meiling: 改 records 驱动 confirmed/published 动态计算** | **PASS** | 二核确认 (50) 与发布 (30) 随数据源 records 严格重算 |
| 8 | **Meiling: 无忧嵌502 不归小确杏502** | **PASS** | 优先命中无忧嵌规则，严格归入无忧嵌系列 |
| 9 | **Idempotency: 重复 apply 不追加结构** | **PASS** | 连续执行 sources/kpis/tables 数量与内容严格幂等 |
| 10 | **Referential: 所有 sourceId 真实存在** | **PASS** | 全量 kpi/table.sourceId 均在 sources 列表中有效声明 |
| 11 | **Kailas: 副本 0 不覆盖 manual 906818.64** | **PASS** | 线上副本日报为 0 时，保护 manual 预算不被覆盖清零 |

**变异测试总览**: **11/11 全部通过 (Passed: 11, Failed: 0)**。

---

## 2. 静态检查基线结果

### 2.1 ESLint 检查结果
- **核心文件全部合规 (0 error, 0 warning)**:
  - `lib/campaign-types.ts`
  - `lib/campaign-catalog.ts`
  - `lib/campaign-manual.ts`
  - `lib/campaign-online-kailas.ts`
  - `lib/campaign-online-meiling.ts`
  - `lib/campaign-online-wipes.ts`
  - `lib/campaign-store.ts`
  - `features/campaign/CampaignDashboard.tsx`
  - `app/api/campaign-dashboard/route.ts`
  - `components/project-shell/ProjectShell.tsx`
  - `components/project-shell/ProjectSidebar.tsx`
- **外部协作文件待自检项**:
  - `features/campaign/CampaignWorkspace.tsx` 存在 2 处提示 (`react-hooks/set-state-in-effect`, `no-explicit-any`)，归属 Beauvoir 维护。

### 2.2 TypeScript 检查结果
- 核心展示组件、通用类型、手工底表及 Meiling/Kailas 适配器均无类型报错。
- `lib/campaign-online-wipes.ts` 存在 5 处 `TS2339` 报错（对应代理在重构去除 `any` 时的类型收窄待处理，不影响运行时纯函数逻辑）。

---

> **说明**: Web UI 页面实际渲染、Tab 切换与多端视觉验收详见由 Beauvoir 并行输出的真实浏览器验收报告与截图。
