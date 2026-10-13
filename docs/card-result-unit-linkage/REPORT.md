# 卡片字段与结果单位联动补修

本轮仅修改指标编辑器的配置转换、共享校验和计算保护。起始审查 HEAD 为 9bd89bf565d71a2e0c2fcb9f9ffb35a211b1b7be；实际独立工作区 D:/download/pic-vec/feihe-platform-v3，应用位于 feihe-mvp，开发分支 codex/v3-card-result-unit-linkage。开始时目标工作区没有已跟踪的未提交修改；既有 docs/v3-targeted-remediation 下的未跟踪验收产物保留。另一个 D:/download/pic-vec/feihe/main 工作区及其用户未跟踪文件未改动。

## 修复前后

| 真实触发路径 | 修复前页面 | 本轮最终页面及持久化断言 |
| --- | --- | --- |
| A：平均完成率 → 同一弹窗切金额 | 初始1.0%，切金额变1500.0%（value=15） | 1.0% → 15 → 1.0% → 15；发布后 format=number、unit为空、无percentScale；刷新、重编辑仍15 |
| B：完成率非空/去重计数 | 200.0%（value=2） | 两类均2；发布后普通数值、无百分单位/口径；刷新重编辑仍2 |
| 重复百分值0.005、0.005、0.015、空 | 聚合切换可能遗留百分语义 | 非空3、去重2、平均0.8%来回切换正确；源值不变 |
| 手动显示偏好 | 无法区分自动继承与用户选择 | 兼容金额/简写偏好保留；手动百分切到普通字段时提示确认并禁用保存，选择普通数值后15 |

先写失败反例，再改生产代码：基线单元7/7失败、API3/3失败、浏览器6/6失败。原有失败断言保留在扩展测试中；没有删除失败用例、放宽期望、或用本地成功响应替代真实计算。[修复前日志](logs/baseline-unit.log) / [API日志](logs/baseline-api.log) / [浏览器报告](evidence/baseline-results.json)。

## 实际修改

- [lib/metrics/config.ts](../../feihe-mvp/lib/metrics/config.ts)：小型纯函数 transitionCardConfig 统一字段、聚合、数据集与显式显示设置转换；displayOrigin 区分 auto/manual，displayNeedsConfirmation 标记必须确认的语义变化。计数家族清理百分比/金额语义；sum/avg 继承当前来源已声明的百分协议；ratio 保留固有百分结果及既有样本口径。
- [CardEditModal.tsx](../../feihe-mvp/features/overview/CardEditModal.tsx)：真实选择器使用统一转换；计数禁用百分比与金额格式；不能依据“金额”这个名字添加货币符号；待确认时提示并阻止加入草稿；计数输入框提示“项、个、行”。保留统一Dialog、异步预览保护、日期和取消流程。
- [lib/metrics/engine.ts](../../feihe-mvp/lib/metrics/engine.ts)：对计数与显示格式冲突、待确认配置返回 needs_configuration，避免直接计算路径显示200%。指标/看板接口沿用共享validateCardConfig，自动百分与普通目标字段冲突时返回400。
- 新增 [单元反例及转换测试](../../feihe-mvp/scripts/test-card-display-linkage.mjs)、[真实API保存读取测试](../../feihe-mvp/scripts/test-card-display-api.mjs)、[DOM路径测试](../../feihe-mvp/tests/browser/card-display-linkage.spec.ts)。生产文件仅上述3个，未改数据库结构、百分解析/存储算法、同步服务或无关页面。

默认规则：count/nonempty_count/distinct_count 输出数量；sum/avg 根据绑定字段继承已声明的百分单位；ratio 沿用比例指标既有协议。自动字段切换到普通数值会清理 format=percent、unit=%、percentScale；切回百分来源仅改变显示配置，源值保持0.005/0.015。

历史配置不迁移数据：没有 displayOrigin 的已保存配置在编辑器中按手动偏好对待；已有缺失percentScale的历史确认流程继续生效。已明确但不兼容的来源百分口径由校验拒绝。手动偏好与新字段单位无法判断兼容时必须确认，不能静默继承；兼容的简写或金额偏好保留。旧的手动简写仅清理无效单位/口径，不重置格式。没有恢复按数值大小猜比例的逻辑。

## 本轮实际执行与结果

以下运行均为本轮执行；不引用上一轮的通过数。工作目录为 D:/download/pic-vec/feihe-platform-v3/feihe-mvp。单元/API脚本直接使用Vite SSR加载真实代码并访问隔离的SQLite。

| 命令/检查 | 本轮结果 | 原始日志 |
| --- | --- | --- |
| node scripts/test-card-display-linkage.mjs | 新增17通过，0失败 | [unit](logs/unit.log) |
| node scripts/test-card-display-api.mjs | 新增5通过，0失败 | [api](logs/api.log) |
| node scripts/test-v3-remediation.mjs | 26通过：25单元/存储 + 1API | [retained-unit](logs/retained-unit.log) |
| node scripts/test-focused-remediation.mjs | 12单元通过 | [retained-focused-unit](logs/retained-focused-unit.log) |
| node scripts/test-v3-api.mjs | 10API通过 | [retained-api](logs/retained-api.log) |
| node scripts/test-focused-api.mjs | 6API通过 | [retained-focused-api](logs/retained-focused-api.log) |
| node node_modules/@playwright/test/cli.js test | 47通过：新增12 + 既有35；0跳过、0失败、0flaky，retries=0 | [browser](logs/browser.log) / [机器报告](evidence/final-results.json) |
| tsc --noEmit（使用本地typescript） | 通过 | [typecheck](logs/typecheck.log) |
| 本地eslint：3个生产文件和3个新增测试文件 | 0错误、1个既有commentAgg未使用警告 | [lint-target](logs/lint-target.log) |
| npm run build | 通过，vinext Build complete | [build](logs/build.log) |
| npm run lint | 未通过：8错误、74警告，错误位于未修改文件 | [lint-all](logs/lint-all.log) |

分类汇总：单元/存储54通过；API22通过；真实Chromium浏览器47通过。初次6条浏览器红例及中间运行保留，不与最终47条叠加计为更多成功用例。

浏览器最终运行使用以下测试环境变量与命令：

```powershell
$env:FEIHE_E2E_BASE_URL='http://127.0.0.1:5206'
$env:FEIHE_TEST_VENDOR_ORIGIN='http://127.0.0.1:5207'
$env:FEIHE_TEST_DB_PATH='.verification/card-display-browser.db'
$env:FEIHE_TEST_CACHE='node_modules/.vite/card-display-browser'
$env:FEIHE_E2E_OUTPUT_ROOT='../docs/card-result-unit-linkage/final-verification'
node node_modules/@playwright/test/cli.js test
```

新增定向运行同样实际执行：node node_modules/@playwright/test/cli.js test tests/browser/card-display-linkage.spec.ts；扩展后的12条均通过。初次运行仅路径A/B的6条，全部失败；新增反例后未放宽断言。

静态检查可复现的本地入口：

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js features/overview/CardEditModal.tsx lib/metrics/config.ts lib/metrics/engine.ts scripts/test-card-display-linkage.mjs scripts/test-card-display-api.mjs tests/browser/card-display-linkage.spec.ts
npm run build
npm run lint
```

## 浏览器断言和外部模拟边界

新增12条覆盖1280px与390px：通过真实combobox切字段与聚合；等候真实/api/metrics页面结果；点击加入草稿/发布；真实/api/dashboards POST/GET校验format/unit/percentScale/displayOrigin；刷新重编辑；GET原始数据确认无重复转换；键盘打开选择器、Escape焦点返回、Tab焦点限制、弹窗边界及保存按钮可见。截图已实际检查：390px下金额15、计数2、待确认时禁用保存均可见，无横向溢出。

本地数据集、指标、看板保存与读取、SQLite均运行真实代码。新增联动测试通过真实/api/datasets预置已经采用正确协议的测试数据；未伪装本地计算/保存成功。

重新执行的既有35条浏览器覆盖六档百分比、普通百分平均、成对20%/明确独立汇总15%及覆盖率、首次同步500/断网/样本外校验失败后的原ID复用、草稿409/500/断网保护、日期回填、取消编辑、空看板持久化、归档恢复、初始化及390px键盘流程。501条16.7%与1/200=0.5%、150/100=150%等数值回归在本轮单元/API日志中通过。

外部飞书边界在 localhost5207（或API测试的外部fetch边界）模拟。故障用例允许注入本地409/500/断网以验证草稿保护，成功重试仍执行真实本地保存。新增联动路径未mock本地指标接口返回期望值。测试身份为测试模式预置角色，DB独立、NO_SEED=true，不接触客户数据。

## 证据及Git交付

[逐例步骤、请求、快照、截图及trace](EVIDENCE.md) · [结构化索引](EVIDENCE-INDEX.json)。修复前6例与新增12例的trace、截图纳入本地提交；最终47例请求/持久化快照和机器报告也纳入提交。其余35例原始trace及HTML报告、中间运行保留本地，未纳入Git；raw路径在索引中明确列出。校验文件见 ARTIFACTS-SHA256.json。

本轮功能修复提交为 af8e8d191d038e843ab1bcdd99ef559c6f798f8d。用户后续追加授权：每次完成修复与验证后提交并推送，暂不合并；本轮推送目标为 origin/codex/v3-card-result-unit-linkage，不部署。推送后实际SHA、远端状态与工作区状态由本地 DELIVERY-STATE.json 记录（避免提交自引用，此收据不纳入提交），最终答复也列出最终SHA。原先用户未跟踪的v3证据不加入本轮提交、不删除。

## 未执行与现存限制

- 真实飞书服务、生产环境及真实客户数据验证：未执行。
- Firefox、WebKit及真实手机设备：未执行；本轮为Chromium的1280px/390px视口。
- 与本问题无关的v2矩阵、全部历史图表脚本及全平台重新验收：未执行；本轮保留并重跑上述既有单元/API/浏览器回归。
- 全仓lint现存8个错误：CategoryNotesModal 3、ProjectShell 2、AcceptanceDelivery 1、MemberManagement 1、feishu-sync 1；均不属于本轮改动。未关规则或改无关文件来获得通过。
- 手动在未知单位字段上明确确认百分显示，仍由用户选择明确口径；不会自动改写历史数据。
