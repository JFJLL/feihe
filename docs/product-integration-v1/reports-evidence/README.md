# 本阶段报告证据与实际命令

工作目录D:/download/pic-vec/feihe-platform-v3/feihe-mvp；起点e20dd44，独立分支codex/product-integration-v1；合成测试身份与独立SQLite文件。

```powershell
npm run typecheck
npm run build
node scripts/test-product-reports.mjs
node node_modules/eslint/bin/eslint.js lib/project-reports.ts app/api/reports/route.ts app/api/agent/route.ts features/reports/ReportsWorkspace.tsx components/project-shell/ProjectShell.tsx components/project-shell/ProjectSidebar.tsx components/project-shell/FloatingAgent.tsx features/overview/GeneralWorkbenchBoard.tsx features/overview/OverviewWorkspace.tsx lib/metrics/engine.ts lib/report-agent.ts lib/navigation/project-navigation.ts tests/browser/product-journey.ts tests/browser/product-reports.spec.ts
$env:FEIHE_E2E_BASE_URL='http://127.0.0.1:5216'
$env:FEIHE_TEST_VENDOR_ORIGIN='http://127.0.0.1:5217'
$env:FEIHE_TEST_DB_PATH='.verification/product-report-complete-browser.db'
$env:FEIHE_TEST_CACHE='node_modules/.vite/product-integration-browser'
$env:FEIHE_E2E_OUTPUT_ROOT='../docs/product-integration-v1/reports-complete'
node node_modules/@playwright/test/cli.js test
```

原单元/API/历史实际脚本命令见对应reports-test-*.log、reports-verify-*.log，本阶段均重跑，未使用旧阶段数字替代。旧26项脚本包含单元/存储及1API；7旧看板脚本是SQL/SSR/静态或处理器模拟，不是浏览器。

| 证据 | 内容 |
|---|---|
| red-01/02、red-results.json | 最初两个真实反例：缺报告入口；生成接口未取到实际300指标 |
| harness-failure-01/02 | 百分比页面已显示1.0%，测试错误读取dataset.rows层级失败；改为真实API响应结构，保持0.005/0.015断言 |
| date-red-01/02、date-red-results.json | 保存后GET快照范围正确，但生成表单刷新丢范围的两条原失败 |
| reports-api-delta-red.log | 20%→10%错误标记为−10%；当前改为−10个百分点 |
| reports-api-atomic-red.log | 真实SQL审计写入失败时新增了不应存在的报告；当前同批事务回滚 |
| reports-api-action-red.log | 未知action绕过新版生成分支；当前400明确拒绝 |
| case-01/10 | 报告入口/实际取数反例最终页面、请求、快照、trace |
| case-02/03/04/05 | 四宽度、真实周期、键盘生成、300/30/10%、每日/渠道、实际HTML下载、改为avg150/v2而旧300/v1、只读下载与刷新 |
| case-06/08 | 1280/390普通比例平均1.0%，存储0.005/0.015；投放比率每日0.5%/150%，实际导出对账 |
| case-07/09 | 1280/390成对0与不可计算，500/断网保留范围/历史，正常POST重试、提交锁定、刷新范围不丢 |

每个case保存真实trace、key-requests.json、persistence.json、最终截图；生成路径还保存浏览器实际下载的report-v1.html/viewer-report-v2.html/ad-report.html。回放：在应用目录运行node node_modules/@playwright/test/cli.js show-trace后跟对应绝对trace路径。

最终截图须打开检查后在reports-report.md记录。首次带通知遮挡的截图不作为最终视觉证明；后续关闭实际通知，再等待真实结果取证。历史本身按生成时ID/版本固定，不把新输入伪装成旧报告更新。

仅外部飞书HTTP模拟，本地配置、映射、同步、SQL、指标、看板、报告保存/GET与下载真实执行。500/网络注入只制造失败，没有本地成功mock。身份只在隔离测试库预置。真人、真实飞书/广告账户与生产验收/部署未执行；启萃完整历史场景、页面身份/撤权及其他完整产品项目继续待验。

最终完整运行reports-complete：118通过（108保留+10新），0失败/跳过/flaky/重试，完整机器结果results.json。最终纯取证运行reports-final-screens：10通过，机器结果visual-results.json，case目录和cases.json对应这次最新运行；没有用早期遮挡截图证明最终结果。
