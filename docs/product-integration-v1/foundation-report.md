# 第一批：入口、项目表单与首用交付

状态：这是一批已验证的阶段提交，完整产品目标仍 active。起始 SHA 1027b6b61d819763a5028c6329c34c7c1953b883；工作区 D:/download/pic-vec/feihe-platform-v3；分支 codex/product-integration-v1。用户在当前会话授权每批验证后提交推送，不合并、不部署。

## 已改变的用户行为

| 基线缺口 | 现在的行为 | 证据 |
|---|---|---|
| 新客户/部门只能使用种子；新负责人无法登记 | 平台基础管理经真实页面新增/更新客户、部门和已验证的企业账号；普通负责人选择并创建自己的项目；没有管理员权限时可联系管理员 | case-01/05/09/13、case-17；12项身份/API检查 |
| 创建、中心编辑、资料字段各自实现 | 三入口共用 ProjectFormDialog，默认当前负责人，可调整；名称/部门/客户/负责人服务端验证，扩展信息折叠 | case-02/06/10/14；project references API |
| 项目多时难比较，缺负责人和来源状态 | 参与/负责/全部可见、多维筛选、卡片/列表；展示真实负责人、数据更新时间及继续设置 | case-03/07/11/15 |
| 通用起点默认任务/预算，无字段仍显示错误卡；新内容目标继承旧目标 | 通用/空白从空看板开始，内容新目标为未确认0；不改变启萃原目标 | real dashboard GET、target API tests |
| 五步技术卡抢占首屏，单人选项没有及时持久化 | 只突出真实资源对应的下一步，进度和团队折叠；单人跳过立即持久化，完成仍经服务端 readiness | case-17 |
| 只读成员可见同步/配置/AI写按钮 | 真实项目角色决定入口；只读等待负责人发布，不能进入看板编辑/同步/AI操作 | case-18、case-03/07/11/15 |
| 生产入口信任未经验证的管理员头/任意令牌 | 默认拒绝未知身份；仅隔离非生产测试库接受测试身份；企业已登记账号须可信网关 HMAC 验证 | production identity tests；auth-trust.md |

所有本地项目、映射、保存、计算、SQL、权限都执行真实代码。浏览器预置身份仅限隔离测试环境；本批入口用例没有模拟本地成功响应。外部飞书边界由 tests/browser/feishu-fixture.mjs 模拟；不代表真实飞书联调。

## 先失败，再修复

保留基础 API 初始10条全失败日志、成员目录新增后2条失败日志和修复后的12条全通过日志。原8条浏览器反例在修改产品实现前全部失败；其中焦点与资料首次点击的问题出现于中间版本，已实际修复。反例保留在 foundation-evidence-final/red-01..08 和 red-results.json，没有删除、降低断言或使用重试掩盖失败。

原来两条加载中的首屏图不能证明已渲染角色状态，保留本地并拒收。最终测试等待真实空状态呈现后再断言写入口不可见；最新18条全部通过，0跳过、0重试、0flaky。每条有真实请求记录、持久化快照和trace。index.json中的 duration 是 Playwright 测试运行时长，不是用户首次看到有效结果的时间。

## 本轮实际执行

命令从 feihe-mvp 执行，日志在 logs/，最终浏览器机器结果在 foundation-evidence-final/results.json。

| 类别 | 命令 | 结果 |
|---|---|---|
| 身份/项目/基础管理真实 API | node scripts/test-product-foundation.mjs | 12通过：3生产模式身份断言、9本地接口/SQL断言 |
| 保留单元/存储/API | node scripts/test-v3-remediation.mjs | 26通过：25单元/存储、1 API |
| 保留 API | node scripts/test-v3-api.mjs | 10通过 |
| 浏览器 | node node_modules/@playwright/test/cli.js test tests/browser/product-foundation.spec.ts | 18通过；四宽度各4条，另2条普通负责人/只读路径 |
| 类型 | node node_modules/typescript/bin/tsc --noEmit | 通过 |
| 改动文件 lint | node node_modules/eslint/bin/eslint.js 加本批19个改动源码/测试路径 | 0错误；3个既有看板 ref cleanup 警告 |
| 构建 | node node_modules/vinext/dist/cli.js build | 通过 |

浏览器实际配置：FEIHE_E2E_BASE_URL=http://127.0.0.1:5216；FEIHE_TEST_VENDOR_ORIGIN=http://127.0.0.1:5217；FEIHE_TEST_VENDOR_PORT=5217；FEIHE_TEST_DB_PATH=.verification/product-integration-browser.db；FEIHE_TEST_CACHE=node_modules/.vite/product-integration-browser；FEIHE_E2E_OUTPUT_ROOT=../docs/product-integration-v1/foundation-layout-verified。测试启动/结束服务，无常驻生产进程。测试输出有 Playwright 截图造成的 caret-color hydration 提示，类型检查/构建通过；不据此声称所有运行告警消失。

## 本轮实看截图

前置18张截图与逐步审查在 baseline-audit.md。最新下列保存图已实际打开确认，均为隔离合成数据：

- case-01/shared-project-form.png：1280px，普通负责人，填写新项目，无业务扩展抢占核心表单。
- case-06/final-page.png：1440px，负责人，项目资料显示已保存的新负责人及说明。
- case-13/shared-project-form.png：390px，普通负责人，表单内部滚动，保存/取消仍可访问。
- case-13/new-organization.png：390px，管理员，部门列表；密集表格在自己的容器内横向滚动。
- case-15/readonly-project-list.png：390px，只读成员，参与项目筛选/紧凑列表，没有编辑/归档/删除。
- case-17/final-page.png：负责人，新登记部门/账号创建内部空项目，单人选项保存；下一步仍为接入业务表。
- case-18/final-page.png：只读成员，加载完成的空项目首屏，等待负责人发布，没有同步/配置/AI写入口。

其他自动化截图保留，未逐张接受为视觉审查结论。768px键盘用例通过DOM与trace证明聚焦、Escape、关闭后回焦及无页面溢出；最终全页图过长，不能用缩小图证明打开控件的视觉质量。

## 复用与关键文件

- 共用原 Dialog、CustomSelect、Feedback、既有组织/用户/项目表、readiness 和看板保存/取消实现，没有新数据库/身份产品。
- 新 ProjectFormDialog、OrganizationManager 是缺失的真实入口；organization/project-form/project-templates 把三个表单的规则集中。
- ProjectCenter、ProjectProfile、OnboardingWizard 消除重复表单及技术卡；ProjectShell/Sidebar/Overview/GeneralWorkbenchBoard 读取实际角色；api-auth 收紧信任入口。
- 本批未改百分比协议、比率样本、日期回填、来源重试ID、映射转换与保存冲突逻辑。

## 尚未完成

字段驱动推荐、授权模板结构复用、统一数据工作台、共享指标标识/版本、五类共享看板、投放/评论/内容适配、确定性报告/导出、启萃组件配置、完整四场景及实测用户步骤/有效结果时间均待后续开发/验收。生产页面身份引导、缓存隔离、成员撤权仍需专项核对。本批不宣称可投入真实客户数据。

保留的 focused/card-unit 全部旧浏览器、历史看板回归尚未在本轮全部重跑。真人访谈/部门试用、真实飞书、企业真实身份网关和生产验证未执行。外部模拟不能替代这些验证。
