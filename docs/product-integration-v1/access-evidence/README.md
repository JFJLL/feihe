# 本轮身份与成员权限证据

工作目录 D:/download/pic-vec/feihe-platform-v3/feihe-mvp。隔离新 SQLite，普通身份 user-editor/user-project-manager/user-viewer 与必要的平台管理员；HMAC 网关服务独立运行 REQUIRE_PROD_AUTH=true。完整实际命令和环境见 commands.json，原始输出在 logs。

- results.json：本轮 access-complete 全部129条，118保留+11新增，0失败/跳过/flaky/重试。
- case-01：真实导入/发布/缓存后，无成员身份进入页面被拒绝，不泄漏旧项目与缓存。
- case-02/05：1280/390打开的已授权页面中途换身份，先清理旧状态；重新加载后新身份只能查看实际300报告。
- case-03/06：1280/390实际editor→viewer→撤权→恢复，报告300保持、写按钮移除、无权结果卸载、恢复后可读。
- case-04/07：1280/390成员控制保护负责人，真实登记姓名；键盘打开菜单、End/Enter降为viewer，GET复核实际角色。
- case-08：交接并移除创建者，报告/HTML接口403，页面显示无权且不挂载私有内容。
- case-09/10/11：真实HMAC分支的签名、角色隔离和未验证/伪造/过期/篡改/未知身份拒绝；无本地认证成功mock。
- red-01/02：最初失败trace、快照、请求和终态截图；red-01/test-failed-1.png是修复前实际泄漏旧项目名的截图，不选导航初次加载截图。
- harness-failure-01/04：错误夹具名字、菜单可访问名称未包含说明的四条失败；原输出、context错误、trace保持原样。
- iterations.json、access-*-results.json、focused-results.json：各次实际统计，原失败不会被最后绿例覆盖。

每case保留trace.zip、key-requests.json、persistence.json和截图。关键请求捕获页面API；夹具及角色准备也是真实接口，完整调用见trace和spec。受测身份与取证管理员分开，不用管理员结果替代权限断言。

回放：node node_modules/@playwright/test/cli.js show-trace 后接对应绝对 trace.zip 路径。完整129条原始结果/报告与其他迭代全部另外保留在应用 .verification/access-raw-evidence，版本库收录11条新增路径、全部失败、日志、完整机器结果，避免反复复制118条成功回归的trace。

最终实看截图：red-01/test-failed-1.png；case-01/final-page.png；case-05/changed-identity-private-state-cleared.png和confirmed-new-identity-read-only.png；case-04/07/opened-member-role-selector.png；case-09/gateway-forged-identity-denied.png；case-10/gateway-signed-viewer-read-only.png。项目、当前角色与界面值可从真实持久化JSON/trace对账；390的宽表在内部水平滚动，不宣称本轮已完成全平台视觉收敛。

仅外部飞书HTTP模拟；本地身份/权限、数据转换、保存、查询、指标、看板、报告与导出真实。真人、真实飞书、真实网关及生产未执行。完整产品目标仍active。
