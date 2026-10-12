# 前端功能闭环与问题整改明细

## 问题 A：初始化完成按钮损坏项目资料
- **整改文件**: `app/api/projects/route.ts`, `features/onboarding/OnboardingWizard.tsx`
- **改动说明**:
  1. 在 `app/api/projects/route.ts` 中新增专属原子动作 `update_onboarding`，仅更新 `projects.onboarding_status` 与 `project_onboarding` 的当前步骤与完成集合；
  2. 在常规 `action === 'update'` 路径中加入字段白名单保护机制：先读取既有项目快照，未传递的字段严格保留原有值，杜绝空值覆盖；
  3. `OnboardingWizard` 提交 `action: 'update_onboarding'`，调用 `onFinish()` 触发工作区刷新，不依赖浏览器强制全页重载。

## 问题 B：通用数据同步假成功
- **整改文件**: `lib/import-rows.ts`, `app/api/feishu/sync/route.ts`, `lib/datasets.ts`
- **改动说明**:
  1. 在 `lib/import-rows.ts` 中针对 `kind === 'general'` 与 `kind === 'dataset'` 分支接入真实的 `saveDataset` 链路；
  2. 真实将解析出的每条记录持久化写入 `datasets` 元数据表与 `dataset_rows` 行存储表；
  3. 返回真实的入库条数，杜绝未落库却虚假计数的情形。

## 问题 C：向导按钮直达深链接
- **整改文件**: `features/onboarding/OnboardingWizard.tsx`
- **改动说明**:
  - 步骤 1 (业务模板确认): 直达 `/settings?tab=profile`
  - 步骤 2 (接入数据源): 直达 `/settings?tab=data-sources`
  - 步骤 3 (字段映射与首次同步): 直达 `/settings?tab=data-sources`
  - 步骤 4 (确认指标与发布看板): 直达项目总览看板 `/projects/{id}`
  - 步骤 5 (邀请团队成员): 直达 `/settings?tab=members`

## 问题 D：初始化进度接入真实资源状态
- **整改文件**: `features/onboarding/OnboardingWizard.tsx`, `app/api/projects/route.ts`
- **改动说明**:
  1. 向导组件加载时并行探测当前项目的真实配置状态；
  2. 只要登记了数据源或已有数据集，即标记步骤 2 完成；
  3. 数据集中已有有效行数或数据源存在成功同步记录，即标记步骤 3 完成；
  4. 存在已发布看板卡片或生成指标，即标记步骤 4 完成；
  5. 项目存在成员分配，即标记步骤 5 完成；刷新页面后状态完整保留。

## 问题 E：动态看板配置与多维工作台
- **整改文件**: `features/overview/GeneralWorkbenchBoard.tsx`, `lib/metrics/engine.ts`
- **改动说明**:
  1. 接通 `dashboards` 与 `dashboard_cards` 存储，通用工作台支持自定义卡片；
  2. 提供“⚙ 自定义看板卡片”编辑模式，支持新增指标卡、达成进度卡与维度分组卡；
  3. 支持对任意字段自定义求和，或配置比率分子分母（如成交转化率）；
  4. 支持卡片前移、后移与删除，并保存发布到服务端（集成版本乐观并发冲突保护）；
  5. 支持多数据集切换；提供“📋 数据明细”完整表格视图，带关键字搜索与分页。

## 问题 F：任务状态与完成率判定精度
- **整改文件**: `lib/metrics/engine.ts`, `features/overview/GeneralWorkbenchBoard.tsx`
- **改动说明**:
  1. 废除宽松的模糊正则，重构 `isStatusCompleted` 判定函数；
  2. 优先排除“未完成”、“尚未完成”、“未开始”、“进行中”、“not done”、“unfinished”、“异常”等反向状态；
  3. 仅对严格确认的“已完成”、“完成”、“done”、“finished”、“已达成”返回 true；
  4. 比率计算基于有效样本全范围分子合计与分母合计，严禁行级比率简单平均。

## 问题 G：飞书多维表格（Bitable）全链路打通
- **整改文件**: `lib/feishu-detector.ts`, `app/api/feishu/inspect/route.ts`, `app/api/feishu/sync/route.ts`
- **改动说明**:
  1. 实现 `inspectFeishuBitable`，调用飞书开放平台 `/bitable/v1/apps/{app_token}/tables` 列出所有数据表；
  2. `inspect` 接口返回多维表格中的全部数据表列表供前端下拉选择；
  3. 在 `feishu/sync` 中接入多维表格分页读取记录接口，支持将 Bitable 记录批量抓取并持久化至通用数据集。

## 问题 H：UI 控件与设计规范全面统一
- **整改文件**: `features/project-center/ProjectCenter.tsx`, `features/settings/ProjectProfile.tsx`, `features/settings/data-sources/SettingsDataSources.tsx`
- **改动说明**:
  1. 全面移除原生 `<select>`，替换为支持无障碍键盘操作（方向键、回车、Esc）与色彩标识的 `CustomSelect`；
  2. 移除原生 `<input type="color">`，统一使用紧凑的 8 色品牌预设调色板与选中态高亮光圈；
  3. 去除全局标题中对无社媒业务项目的“2026年 Q4 小红书种草”、“社媒增长中台”等不恰当硬编码文案。

## 问题 I：提供端到端严密断言测试套件
- **整改文件**: `scripts/verify-frontend-closure.mjs`
- **改动说明**:
  - 数据集 A 反例排除与完成率精度测试
  - 数据集 B 全盘加权成交率测试（19.0% vs 错误的 15.0%）
  - 项目初始化完成不损坏资料原子测试
  - 通用数据导入真实入库检查
  - 成员添加、改权、移除完整闭环测试
  - 动态看板自定义与版本冲突 409 拦截测试