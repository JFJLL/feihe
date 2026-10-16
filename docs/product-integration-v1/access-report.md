# 页面身份、缓存隔离、成员撤权与发布状态补修

本阶段从 ac8559551cdfd76c57ec525b88cc6b8dbe599fd8 开始，完整产品起始 SHA 是 1027b6b61d819763a5028c6329c34c7c1953b883。工作区 D:/download/pic-vec/feihe-platform-v3，应用 feihe-mvp，独立分支 codex/product-integration-v1。本阶段只补齐产品任务中的身份入口、缓存、撤权和发布状态；完整产品整合目标仍 active。

## 先失败的反例与最终行为

| 触发 | ac85595 反例 | 修复后 |
|---|---|---|
| 原身份接入数据/发布并留下真实缓存，切为无成员身份再进数据页 | API 已 403，但项目壳仍挂载旧项目名和导航；2 条浏览器反例中的此条失败 | 服务端 layout 先鉴权；无权不挂载私有内容；身份改变/撤权清理缓存，页显示可执行的返回入口 |
| 转交负责人、移除创建者 | created_by 回退仍给旧创建者管理/报告/导出权限；API 和浏览器反例失败 | 普通身份只按有效成员授权；原创建者 403 且项目、来源不出现在其列表 |
| 另一管理员移除/降级当前负责人；不一致旧数据移除最后管理员 | 4 条 API 红例中保护规则失败 | 负责人先交接；至少保留一位管理员；SQL 条件防并发清空，冲突不伪报成功 |
| 发布已有初始化 draft 看板 | 保存成功仍 status=draft | 本次明确发布采用服务端 published 状态，GET 再确认；没有批量改历史记录 |
| 登记身份属于另一组织 | 新项目 org_id 被固定为 org-default | 使用经过验证的当前身份组织；另一组织包括其平台管理员不得访问 |

原始 API 红例 4/4 失败，浏览器红例 2/2 失败。失败断言和 trace 保留，没有删除用例或关闭错误层。扩展测试另证明：身份仍获授权但浏览器会话中途切人，原页面先撤销旧状态，刷新后以新身份读取只读结果；成员 editor 降为 viewer 后保留报告 300 并隐藏生成，撤权后去掉结果，重新授权并刷新可读。

## 关键改动

- lib/api-auth.ts、app/api/projects/route.ts：成员为普通项目授权依据；组织范围创建/查询；负责人和最后管理员保护及并发 SQL 条件；确认实际成员写入结果。
- app/page.tsx、app/projects/[projectId]/layout.tsx、IdentityBoundary、AccessState：以现有可信身份校验守住页面入口，拒绝身份不挂载项目壳，清晰登录/申请/返回提示。未引入新的登录体系。
- lib/browser-cache.ts、use-project-data、ProjectContext、ProjectCenter、FloatingAgent：缓存和助手历史按组织/身份分开；身份改变、401/403 或项目撤权清理状态；焦点返回/页面可见和权限响应重新验证；忽略迟到请求。非权限失败仍保留既有草稿保护逻辑。权限撤回时私有编辑内容会卸载，不能承诺被撤权用户继续访问草稿。
- MemberManagement：使用服务端登记姓名与角色，负责人/最后管理员控制禁用并给交接说明，角色选择器有可访问名称，请求取消/卸载不回写。
- app/api/dashboards/route.ts：成功发布更新实际 status，沿用现有乐观版本和原子保存。
- tests/browser/gateway-server.mjs、gateway-identity.ts、product-access.gateway.spec.ts：另一隔离服务实际执行 REQUIRE_PROD_AUTH=true 的 HMAC 校验和已登记身份读取；原始头、任意 Bearer、过期/篡改签名、未登记账号均拒绝。诊断快照的管理员读取与受测页面身份明确分开。

## 实际执行检查

本轮命令和完整输出在 [access-evidence/logs](access-evidence/logs/)，各次浏览器统计在 [iterations.json](access-evidence/iterations.json)。

| 类别 | 实际命令 | 已确认结果 |
|---|---|---|
| 静态 | node node_modules/typescript/bin/tsc --noEmit | 通过 |
| 改动文件 lint | node node_modules/eslint/bin/eslint.js（commands.json 记录 19 个路径） | 0 错误、0 警告；未声称全仓库 lint |
| 构建 | npm.cmd run build | 通过；首次误用不存在的 bin 路径只是启动失败，原日志另存 |
| 原单元/存储/API 混合 | node scripts/test-v3-remediation.mjs；test-focused-remediation.mjs；test-card-display-linkage.mjs | 26/12/17 通过，v3 包含 API 断言，准确保留分类 |
| 原 API | node scripts/test-v3-api.mjs；test-focused-api.mjs；test-card-display-api.mjs | 10/6/5 通过 |
| 产品真实接口/SQL | node scripts/test-product-foundation.mjs；test-product-data.mjs；test-product-metrics.mjs；test-product-board.mjs；test-product-adapters.mjs；test-product-reports.mjs；test-product-access.mjs | 12/6/7/12/7/10/7 通过 |
| HTTP 传输 | node scripts/test-request-abort.mjs | 3 通过 |
| 历史 SQL/SSR/静态 | test-dashboard-feedback、verify-growth、test-workspace-charts、test-content-comment-boards、test-acceptance-reply-pending、test-ui-unification-v1-regression、test-category-notes-modal | 7 个脚本通过，不能充作真实浏览器 |
| 重点浏览器复验 | node node_modules/@playwright/test/cli.js test tests/browser/product-access.spec.ts tests/browser/product-access.gateway.spec.ts（扩展缓存切人测试前） | access-iteration-4 的 9 条通过 |
| 完整浏览器 | node node_modules/@playwright/test/cli.js test | access-complete 129 通过（118 保留+11 新增），0 失败/跳过/flaky/重试 |

21 组脚本全为退出码 0，其中 node:test 合计 140 条。浏览器 workers=1、retries=0，真实 Chromium。外部仅飞书 origin 被隔离模拟；本地认证、映射、同步、SQL、指标、看板、报告和 HTML 真实执行。

扩展迭代的 2 次各两失败源于夹具误写登记姓名及选项可访问名称未包含权限说明；原失败保留。期间一次热编辑触发 React context HMR 错误，保留原输出并冻结代码冷启动复验；未屏蔽异常。最终键盘打开选择器、End/Enter 调角色并 GET 复核实际 viewer，没有放宽数据库与页面角色断言。

## 本轮证据与边界

首次失败：[API 红例](access-evidence/logs/access-api-red.log)、[浏览器红例结果](access-evidence/access-red-results.json)。修复前选用失败终态截图，初次导航的加载截图不当作泄漏证据。最终截图已实际打开检查：1280/390 的打开角色选择器、身份切换清理提示、以新身份查看真实 300 只读报告、伪造身份拒绝与签名 viewer 空报告状态；没有采用初次加载图证明成功。索引与各用例 trace/请求/真实持久化快照见 [access-evidence/README.md](access-evidence/README.md)。

真人部门试用、真实飞书联调、实际企业网关/生产授权、生产数据均未执行。隔离网关测试实际执行生产鉴权代码，但不能代替上线身份链路验收。启萃完整历史浏览器路径、结构复用、内容/评论适配、业务组件布局、日常主页层级及四条完整产品场景仍待后续完成；没有外部条件阻断继续本地开发。

Git：本批验证后提交并推送当前独立分支，未合并、未部署。最终 SHA/远端核对收据在忽略的 DELIVERY-STATE.json 及本次对话；不把自引用哈希写入提交。main 原 SHA 2169bf5d78e68dfaf0c1b578ff76c44aa3bd53ea 及原未跟踪文件保留。
