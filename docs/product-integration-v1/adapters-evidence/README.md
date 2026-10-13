# 字段推荐与投放链路：当前运行证据

起点eb0520e，隔离开发分支codex/product-integration-v1；本地应用5216、模拟外部飞书5217；本次完整浏览器使用 .verification/product-adapters-browser.db（与客户数据隔离）。Playwright自行启动与结束服务，workers=1、retries=0、Chromium真实DOM。

## 实际命令

应用目录 D:/download/pic-vec/feihe-platform-v3/feihe-mvp：

```powershell
npm run typecheck
npm run build
node node_modules/eslint/bin/eslint.js components/project-shell/ProjectShell.tsx components/project-shell/ProjectSidebar.tsx features/data/DataWorkspace.tsx features/overview/GeneralWorkbenchBoard.tsx features/overview/OverviewWorkspace.tsx features/overview/DatasetAdOverview.tsx features/metrics/RecommendationDialog.tsx lib/navigation/project-navigation.ts lib/project-templates.ts lib/metrics/recommendations.ts app/api/business-analytics/route.ts app/api/metric-recommendations/route.ts app/projects/'[projectId]'/ads/page.tsx tests/browser/product-adapters.spec.ts
node scripts/test-product-adapters.mjs
node node_modules/@playwright/test/cli.js test tests/browser/product-adapters.spec.ts
$env:FEIHE_E2E_BASE_URL='http://127.0.0.1:5216'
$env:FEIHE_TEST_VENDOR_ORIGIN='http://127.0.0.1:5217'
$env:FEIHE_TEST_DB_PATH='.verification/product-adapters-browser.db'
$env:FEIHE_TEST_CACHE='node_modules/.vite/product-integration-browser'
$env:FEIHE_E2E_OUTPUT_ROOT='../docs/product-integration-v1/adapters-delivery'
node node_modules/@playwright/test/cli.js test
```

其余实际执行命令逐项在script-results.json，每项原始输出也保留。静态/构建日志的final版本是本批最新检查。7旧看板脚本的实际命令为其 adapters-<script>.log 文件名，不是浏览器。首次红例只有两个用例时同一Playwright命令运行product-adapters.spec.ts；首个完整回归输出为regression-red.log。测试字段0.005/计数2等历史回归没有重新造新“成功”夹具。

## 证据索引

| 文件夹 | 操作与页面/持久化断言 |
|---|---|
| red-01 | 原始四列已入库，无推荐控件；超时失败trace、原表截图、配置和记录均保留 |
| red-02 | 原始五列已入库，专属消耗缺失；断言300失败，不用本地成功mock |
| regression-red | 第一次完整107通过/1失败：空投放页缺失效率区块；保留原失败，补回待配置说明而不修改旧断言 |
| case-01 | 四列经DOM接入，推荐成交率而无预算/任务，实际字段原样保留 |
| case-02 | 五列经DOM确认共享指标、发布、专属消耗300 |
| case-03/06 | 1280/390不同字段名称，经展开选择器确认125；键盘Escape/Enter；再次确认指标数仍5、ID不变、看板7张 |
| case-04/07 | 1280/390四列确认4指标/6卡、发布刷新，2/300/30/10%、日期20%/5%、渠道一致 |
| case-05/08 | 1280/390独立投放页URL与标签，300/4000/70/1.8%，真实同步更新600，修改同指标v2后看板/专属300；viewer只读 |

每个case目录含真实trace、关键请求、持久化及页面截图。trace用安装的Playwright show-trace打开；外部mock仅是飞书接口，所有本地接口/SQLite/计算/发布真实执行。

截图检查：新推荐弹窗打开字段选择器、确认操作区，投放1280/390无加载层；最早投放截图被通知遮住，未作为最终视觉证明，当前通过关闭实际通知重新截取。窄屏业务表允许内部横向滚动，页面本身无横向溢出。全部为合成项目及预置测试身份，未使用真实客户数据。

真实飞书、真实广告账户、真人部门试用、生产授权/部署未执行。完整四条产品场景尚未完成；本文件只证明字段推荐与投放来源阶段。

最终完整浏览器：**108通过，0失败/跳过/flaky/重试**。results.json与adapters-delivery.log为本阶段重跑结果；此前regression-red-results.json为107/1，原始失败仍保留。
