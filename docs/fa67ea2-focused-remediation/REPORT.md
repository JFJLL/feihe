# fa67ea2 三项定向补修

## 三项修复表与前后反例

| 修复 | 修复前的实际反例 | 修复后的结果 |
| --- | --- | --- |
| 百分字段协议 | 页面导入 `0.5%`、`1.5%` 后普通平均显示 `100.0%`；百分点值 `0.5`、`1` 被阈值放大 | 新百分字段存比例小数；六档分别存 `0, 0.005, 0.01, 0.011, 1, 1.5`，显示 `0.0%, 0.5%, 1.0%, 1.1%, 100.0%, 150.0%`；普通平均 `1.0%`，全盘/分组共用格式化；原生比例与百分点各转换一次 |
| 首次同步失败的来源身份 | `save_source` 真实返回 200，首次同步 500；重试的 `sourceId` 从 `85d3317d-a13b-40eb-99cf-f1e262f5964b` 变成 `437e970c-5754-4a15-9ea5-74cf7727a7b2` | 保存响应立即写入来源 ID；直接重试、修改映射、关闭刷新重开均更新同一来源；500、断网、样本外第12行必填失败均保持来源1、最终数据集1；双击只保存一次 |
| 比率缺失与样本统计 | `10/null` 与 `null/100` 显示 `10.0%`、样本1 | 默认不可计算、成对0，分子有效1、分母有效1；加 `20/100` 后成对口径 `20.0%`、成对1；显式独立汇总 `15.0%`、分子2/3、分母2/3、成对1；补零单独选择，参与计算行不冒充实际成对样本 |

开始修改功能代码前，新增 8 个单元反例（7失败、1既有正确行为通过）及3个实际 Chromium 页面反例（全部失败）。原始日志、截图、trace、关键请求和持久化快照保存在 [baseline](baseline/)。其后新增边界反例并保留全部失败迭代，未删除失败用例或放宽结果断言。

## 配置与历史兼容

百分来源映射使用 `numericUnit: 'percent'` 与 `sourcePercentScale: 'fraction' | 'percentage_points'`。带 `%` 文本自带单位，不再重复除100；裸数值按显式来源口径转换。存储列元数据为 `numericUnit: 'percent', percentScale: 'fraction'`。直接数据集写入也遵守此协议；混合百分文本与未声明单位的数值拒绝发布旧快照替换。

卡片保存 `percentScale`，格式化只按声明转换。比率计算结果继续使用百分点，1/200、1/100、150/100 分别显示0.5%、1.0%、150.0%，保留501条完整记录16.7%回归。普通字段平均计算数值平均，不改为平均行级比率。

历史百分卡缺少单位声明时显示需确认，编辑入口要求选择比例或百分点；历史映射含百分文本但未声明单位时要求重新确认。不会读时重写旧数据、批量迁移或继续按大小猜测。旧数据数值0.5、1.5选择百分点后显示平均1.0%，存储仍为原值；历史指标定义的读取也有不可计算提示。

比率默认 `ratioBasis: 'paired'`，`missingPolicy: 'skip'` 仅使用两个字段均为有效数值的行。显式 `independent` 分别求和，显示各自有效数、覆盖率及成对数。`missingPolicy: 'zero'` 为独立的补零选择；非法数值始终报错。全盘与分组调用同一计算函数。`sampleSize` 对比率始终是实际成对有效数，`calculationSampleSize` 单独表示参与计算行。指标定义使用现有 `filter_json` 持久化这些选项，无数据库更换或新增表。

来源保存使用服务端 ID，重试只提交该 ID，不伪造新的来源请求。未改配置的直接重试不重复保存；重新编辑或改映射时以原ID更新。同步中的映射控件禁用、提交有同步锁。同步状态、失败原因和来源列表及时刷新，390px 下详情与按钮能完整显示。没有删除或合并其他来源。

## 测试证据

| 类别 | 实际执行命令（在 `feihe-mvp` 内） | 结果 |
| --- | --- | --- |
| 类型检查 | `node node_modules/typescript/bin/tsc --noEmit` | 通过 |
| 构建 | `npm run build`，指定隔离构建库 | 通过 |
| 变更文件 lint | `node node_modules/eslint/bin/eslint.js` + 本轮变更 TS/TSX/MJS 文件 | 0错误，2个既有警告 |
| 全仓 lint | `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` | 失败：8个既有错误、74警告；未更改规则以掩盖 |
| 新增单元 | `node scripts/test-focused-remediation.mjs` | 12/12通过 |
| 保留 v3 单元/存储及 API | `node scripts/test-v3-remediation.mjs` | 26/26通过，其中25单元/存储、1 API |
| 新增 API | `node scripts/test-focused-api.mjs` | 6/6通过，真实路由、转换、SQLite及发布/读取 |
| 保留 v3 API | `node scripts/test-v3-api.mjs` | 10/10通过，含501条16.7%、全表5050条、身份/恢复/冲突 |
| 真实浏览器 | `node node_modules/@playwright/test/cli.js test` | 35/35通过：已有20、新增15；Chromium，桌面1280px与390px，DOM、请求、持久化断言及trace |
| 旧兼容脚本 | `node scripts/verify-v2-unit-api.mjs` | 23章通过，含静态与纯变量烟测；不计为浏览器验收 |
| 历史看板回归 | `npm run verify:dashboards` | 7个脚本通过，含SQL/HTTP、组件、键盘状态与静态检查；不计为浏览器验收 |
| 真实飞书 | 未执行 | 仅模拟外部飞书边界 |
| 生产验证 | 未执行 | 无部署、无真实客户数据写入 |

单元/存储合计37项，API合计17项；以上没有把脚本章节或截图文件数加进浏览器用例数。完整日志在 [logs](logs/)，逐条步骤、关键请求、页面与持久化断言、截图和trace在 [EVIDENCE.md](EVIDENCE.md)，浏览器原始报告在 [最终报告](final-validation-2/browser-report/results.json)。

完整浏览器回归同时覆盖原有计数、分组平均、409/500/断网草稿保护、日期回填、来源乱序/映射上下文、初始化、授权归档恢复、空看板持久化及键盘弹窗路径。

测试环境：本地应用 `127.0.0.1:5196`，飞书边界模拟 `127.0.0.1:5197`，浏览器数据库 `.verification/focused-browser.db`，新缓存 `node_modules/.vite/focused-browser`。预置测试管理员身份。新项目都为测试项目；本地保存、映射、同步、数据库、查询、指标与看板发布执行真实代码。仅首次同步500和断网注入失败（没有伪造本地成功响应）；第12行必填失败由完整同步的真实校验产生。旧5186/5187测试环境和旧证据未覆盖。

重新运行时先设置这些环境变量，再调用 Playwright（`verify:focused:browser` 也需使用这些变量），以免沿用原测试端口或覆盖旧证据。Playwright会自动启动本地测试服务：

```powershell
$env:FEIHE_E2E_BASE_URL='http://127.0.0.1:5196'
$env:FEIHE_TEST_VENDOR_ORIGIN='http://127.0.0.1:5197'
$env:FEIHE_TEST_DB_PATH='.verification/focused-browser.db'
$env:FEIHE_TEST_CACHE='node_modules/.vite/focused-browser'
$env:FEIHE_E2E_OUTPUT_ROOT='../docs/fa67ea2-focused-remediation/re-run'
node node_modules/@playwright/test/cli.js test
```

全仓 lint 的8个错误位于未修改的 `CategoryNotesModal.tsx`（3）、`ProjectShell.tsx`（2）、`AcceptanceDeliveryWorkspace.tsx`（1）、`MemberManagement.tsx`（1）与 `feishu-sync.ts`（1）。变更文件的两个旧警告是状态请求清理引用及未使用的 `commentAgg`。

## 关键文件

- `lib/numeric-values.ts`、`lib/field-mapping.ts`、`lib/import-rows.ts`、`lib/datasets.ts`：解析、明确单位、一次转换与存储元数据。
- `lib/metrics/engine.ts`、`lib/metrics/config.ts`、`app/api/metrics/route.ts`：统一显示、成对/独立统计、配置校验与指标定义持久化。
- `features/overview/CardEditModal.tsx`、`CardRenderView.tsx`：单位与样本口径入口、发布/重编辑、分组值与样本提示。
- `features/settings/data-sources/SettingsDataSources.tsx`、`FieldMappingEditor.tsx`、`styles/workspace-polish.css`：确认来源ID、重试流程、映射单位与390px失败列表。
- `scripts/test-focused-remediation.mjs`、`scripts/test-focused-api.mjs`、`tests/browser/focused-red.spec.ts`、`focused.spec.ts`：反例与真实页面验收；其余测试工具改动仅隔离环境、归档失败请求及避免覆盖旧证据。

来源接口与同步接口的已有按ID更新、来源隔离和暂存发布机制继续使用，本轮未修改这两处认证或存储实现。

## 验收结束时的 Git 快照与未验证项

实际修改工作区 `D:\download\pic-vec\feihe-platform-v3`；会话原工作区 `D:\download\pic-vec\feihe` 的main与用户已有未跟踪文件未动。起始与验收结束时HEAD均为 `fa67ea2c0380e470fe32fb5b57fb8ce02402f5f1`。从 `codex/v3-targeted-remediation` 创建独立分支 `codex/v3-percent-source-ratio-fix`。开始时目标工作区无受跟踪的未提交修改，只有旧证据目录；验收结束时本轮代码与新证据未提交。未推送、未合并main、未部署。详情见 [GIT-STATE.json](GIT-STATE.json)。

来源快照补充归档重跑了新增15条，报告与附件在 `final-focused-evidence/`，不重复累计为新用例。

真实飞书权限、实际工作表格式、生产环境与其他浏览器内核未执行验证。历史模糊百分配置需要业务人员确认口径。客户端断网/注入500若请求没有到达服务端，刷新后服务端只能确认配置已保存、待首次同步，不能冒称已同步成功；仍可找到同一来源继续处理。全仓既有lint错误未在本轮扩展修复。

## 证据提交范围

Git保留修复前反例、35条唯一浏览器用例的trace/截图/请求/持久化快照、最终机器可读报告和执行日志。重复HTML打包副本及迭代原件保留在本地；没有删除失败证据。`EVIDENCE-INDEX.json` 列出的35条证据全部随本轮提交。旧 `docs/v3-targeted-remediation/` 未跟踪产物保留原状。
