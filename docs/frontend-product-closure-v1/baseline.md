# 前端功能闭环与 UI 一致性整改基线报告

## 1. 评估背景与起始点

- **仓库**: `https://github.com/JFJLL/feihe`
- **上一轮交付基准**: `e2aebe0b2a0e252e8ed46d62b79f4317e1c6302b`
- **整改分支**: `codex/platform-upgrade-v2`
- **目标**: 从真实用户路径与产品体验出发，深入排查并彻底解决系统在“表面通用化”背后的 9 大核心功能断点、假成功与 UI 不一致问题，达成真正的前端功能闭环。

---

## 2. 审查发现的 9 大核心问题

| 编号 | 问题模块 | 严重级别 | 根因排查与复现路径 |
|---|---|---|---|
| **问题 A** | 初始化完成按钮损坏项目资料 | P0 | `OnboardingWizard` 提交 `{ action: 'update', projectId, onboardingStatus: 'ready' }`，但 `app/api/projects/route.ts` 的 update 接口将缺失的 `name`, `brand`, `description`, `departmentId` 覆盖为 NULL 或默认值，造成资料丢失。 |
| **问题 B** | 通用数据同步假成功 | P0 | 前端登记数据用途 `kind='general'`，但在 `lib/import-rows.ts` 中仅对 `owned` 与 `supplier` 进行数据库插入，未命中的通用数据执行 `imported += 1`，虚假上报成功但未向 `datasets` 与 `dataset_rows` 写入任何记录。 |
| **问题 C** | 向导按钮未直达任务 | P1 | 数据接入、字段确认、成员分配等向导链接均跳向 `/settings` 根路径，用户必须二次寻找对应 Tab。 |
| **问题 D** | 初始化进度未接入真实状态 | P1 | 向导固定写死 `completed=['template']`，未从数据源、同步状态、数据集与成员关系中动态计算真实就绪步骤。 |
| **问题 E** | 看板结构仍然固定 | P1 | 通用工作台固定四张任务与预算卡片，未接通 `dashboards` / `dashboard_cards` 动态配置与自定义卡片能力；未提供数据集切换与原始数据表格视图。 |
| **问题 F** | 任务完成率正则误匹配 | P0 | `/已完成|完成|done|finished/i` 模糊匹配会将“未完成”、“尚未完成”、“not done”、“unfinished”均判定为完成。 |
| **问题 G** | 多维表格仅完成链接识别 | P1 | 仅使用正则提取了 Token，缺少调用飞书 OpenAPI 获取数据表列表、分页抓取记录并导入数据集的闭环。 |
| **问题 H** | UI 控件风格不统一 | P2 | 存在原生 `<select>` 与原生 `<input type="color">` 混用，未统一复用支持无障碍与键盘导航的 `CustomSelect` 及 8 色紧凑调色板。 |
| **问题 I** | 测试断言脱离用户实际路径 | P1 | 部分测试仅断言字段存在或字符串匹配，缺少针对全范围加权比率、字段保护原子性及真实落库的端到端严密验证。 |