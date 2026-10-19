# 战役复盘看板真实浏览器验收报告

## 验收环境
- **服务地址**：`http://localhost:5173`
- **执行时间**：2026-10-19 17:14 UTC+8
- **测试工具**：playwright-cli（真实 Chromium 浏览器会话驱动）

## 验收结果摘要

### 1. 统计期下拉筛选与卡片/明细表真实联动
- **美菱看板 (`/projects/meiling`)**：
  - 全量状态：共 41 项指标，展示全部 4 张 KPI 复盘明细表。
  - 选择 `7-8月KPI`：卡片过滤为 9 项，KPI 表格精确过滤为《美菱7-8月KPI目标与实际完成对照表》与《美菱7-8月合同签署KPI考核规则表》，排除 618 历史表格。
  - 选择 `618历史复盘`：卡片过滤为 13 项，KPI 表格精确过滤为《美菱618历史KPI目标与实际完成对照表》，排除 7-8 月表格。
- **凯乐石看板 (`/projects/kailas`)**：
  - 全量状态：共 12 项指标。
  - 选择 `7.16-9.27 Q3`：精确过滤为 6 项指标；选择 `Q3`：精确过滤为 1 项指标。
  - 严格 `<` 边界判断与文案：CPE 实际 15.09元与目标 `< 15元` 比较，未达标状态准确呈现为「未达到成本目标」，符号准确显示为 `<`。

### 2. 数据源权限异常消除验证
- **美菱数据源**：官方 KPI 管理表（HNDC/RQff）、618 复盘（MMPZ）及双11 日报表（Dkd）状态均已转为 `ready`（已读取快照），历史 131006 权限缺失提示已完全消除。
- **凯乐石数据源**：原 LT1 未授权节点已替换为已解锁的《黑山Q3日常双周会小结资料 副本》（`ready`），历史权限阻断已消除。

### 3. 390px 移动端无横向溢出验证
- 针对 390×844 视口执行评估：
  - `docScrollWidth`: 390px / `docClientWidth`: 390px
  - `rootScrollWidth`: 362px / `rootClientWidth`: 362px
  - `hasDocOverflow`: `false`，全页无横向滚动条或布局撑破。

## 截图存证
- [access-update-kailas.png](D:/download/pic-vec/feihe/output/playwright/access-update-kailas.png)
- [access-update-meiling.png](D:/download/pic-vec/feihe/output/playwright/access-update-meiling.png)
- [access-update-mobile.png](D:/download/pic-vec/feihe/output/playwright/access-update-mobile.png)
