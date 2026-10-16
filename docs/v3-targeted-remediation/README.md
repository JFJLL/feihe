# Feihe v3 定向返修与真实浏览器验收

返修目标：正确计算、失败保留草稿、预览与导入一致、保存刷新后配置仍正确，核心按钮完成其承诺。

起始 SHA：78f56d8b6d9d02d4d66ddb97b11f1ebd30b47787。
起始审查分支：codex/platform-upgrade-v3。
返修分支：codex/v3-targeted-remediation。
工作区：D:\download\pic-vec\feihe-platform-v3；应用目录：feihe-mvp。
该工作区起始无未提交修改。聊天初始目录 D:\download\pic-vec\feihe 为另一份 main 工作区，其原有未跟踪文件未改动。
最终 SHA、提交与剩余工作区状态见 [DELIVERY-STATE.json](DELIVERY-STATE.json)。

## 验证结果

| 类别 | 最终结果 | 边界 |
| --- | --- | --- |
| 静态：TypeScript | 通过 | 完整 tsc --noEmit |
| 静态：构建 | 通过 | vinext build，本地编译 |
| 静态：返修文件 lint | 通过，0 错误，21 警告 | 修改及新增源文件 |
| 静态：完整仓库 lint | 未通过，8 错误，74 警告 | 8 错误逐项确认已存在于起始 SHA；起始共 32 错误 |
| 单元／计算与存储回归 | 25/25 通过 | 与内存 SQLite 的必要集成；不计为浏览器验收 |
| API | 11/11 通过 | 10 个独立 API 用例 + 单元脚本内 1 个真实指标预览 API 用例 |
| 浏览器 E2E | 20/20 通过 | 真正 Chromium、DOM 操作、HTTP 与 SQLite 持久化断言 |
| 用户 Chrome 复核 | 通过已执行的计数与弹窗路径 | 390px 新建记录计数、键盘 Escape/焦点、真实发布、刷新后仍为 3 |
| 外部模拟 | 已执行 | 模拟飞书 HTTP；本地身份校验、导入、查询、计算和保存真实执行 |
| 真实飞书业务验收 | 未执行 | 没有使用真实业务文档完成接入／同步 |
| 生产验证 | 未执行 | 未合并、未部署、未操作生产数据 |

单元脚本共 26 个用例，其中 25 单元／存储回归、1 API。独立 API 脚本共 10 个用例。旧脚本的 23 个检查章节另行报告，没有混入上述数量。

## 阅读与证据

- [问题复现](REPRODUCTIONS.md)：先失败的计数、409，以及后来发现的布局和日期小数秒问题。
- [修复说明](REMEDIATION.md)：配置判别、保存事务、映射上下文、日期、授权、分页与模板。
- [测试结果与边界](TEST-RESULTS.md)：命令、统计、完整 lint 的已知错误、未执行项。
- [20 条浏览器验收](BROWSER-ACCEPTANCE.md)：每条的步骤、请求、页面与数据库断言，以及 trace／截图。
- [机器可读浏览器证据清单](browser-manifest.json)。
- [最终 Playwright 报告](browser-report/index.html)。
- [用户 Chrome 复核](manual-chrome.json)，[实际持久化](manual-chrome-persistence.json)，[390px 弹窗](manual-chrome-390-dialog.png)，[刷新后的卡片](manual-chrome-390-refreshed.png)。

首次失败保存在 initial-browser-results 与 initial-unit-failures.txt；中间迭代保存在 iteration-*-results。没有删除失败用例、删除失败证据或放宽核心断言。浏览器成功来自实际 DOM、HTTP 和持久化断言；清单另核对证据是否齐全。

## 测试环境与重跑

Node 24.11.1；@playwright/test 1.64.0；Playwright Chromium 1248。
浏览器应用端口 5186，外部飞书模拟端口 5187。
单元／API 使用内存 SQLite；浏览器使用应用目录内独立 .verification/browser.db。
测试服务器明确设置 ENABLE_TEST_AUTH=1、禁止业务种子、使用虚构的飞书凭据，并仅在测试构建中替换飞书 HTTP origin。
生产构建不包含测试 provider。

    cd D:\download\pic-vec\feihe-platform-v3\feihe-mvp
    npm ci
    node node_modules/playwright/cli.js install chromium
    npm run verify:unit
    npm run verify:api
    npm run verify:unit-api:v2
    npm run verify:dashboards
    npm run verify:e2e

verify:e2e 会启动本地测试服务和真实浏览器。保存失败用例仅注入 500 或网络故障；成功保存使用真实本地接口。迟到响应通过先取得真实响应再延迟送达；409 来自真实服务端版本冲突。

浏览器产物包含开发资源与源映射，体积较大；本地完整保留。源代码、测试与报告可独立审查。没有推送、合并或部署。
引用的 ChatGPT 历史会话因当前工具未提供 read_thread 而未读取，本次依据用户提供的完整任务说明执行。
