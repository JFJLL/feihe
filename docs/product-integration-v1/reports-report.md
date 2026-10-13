# 项目同口径报告阶段

完整产品目标持续 active；本阶段起点e20dd4412615dfa83c7ef916072187338a05f896，分支codex/product-integration-v1，工作区D:/download/pic-vec/feihe-platform-v3。按当前授权验证后提交推送，不合并、不部署，不操作真实客户数据。

## 实际问题与结果

| 路径 | 之前 | 本阶段 |
|---|---|---|
| 四列原业务表→推荐看板→报告 | 看板已发布300/30/10%，没有报告入口；生成接口读空社媒对象，咨询指标缺失 | 从看板带入项目/周期，生成300/30/10%以及同口径每日20%/5%、渠道；保存历史并授权导出HTML |
| 指标定义修改与历史 | 卡片、报告各自取数，无共享版本证据 | 同一咨询指标sum→avg，看板与新报告150/v2，旧报告仍300/v1；GET和实际下载对账 |
| 百分比与样本 | 新报告没有覆盖来源比例协议及成对缺失 | 0.005/0.015普通字段平均1.0%；比率每日1/200=0.5%、150/100=150%；互补缺失成对0、不可计算，显示覆盖及状态 |
| 报告周期刷新 | 初次实现保存周期正确，但刷新后生成表单回到空范围 | 两条日期红例保留；服务端确认范围写入URL并回填，按ID读取快照也恢复其范围；筛选与独立卡片周期准确 |
| 失败与事务 | 初次实现真实审计写入失败返回500，报告却已保存 | 报告与审计复用现有batch事务，SQL触发器反例25/24→不新增快照；500/断网保留当前输入与历史，真实重试冻结快照 |
| 不支持的操作 | 未知action可以绕过新版入口回到旧社媒生成分支 | 显式操作白名单，未知400；新项目生成统一消费当前指标，启萃专属分支保留 |

## 实现范围

复用现有metric_definitions/metric_bindings、中央计算、report_versions、report-html导出、统一Dialog/选择器/图表/状态组件，没有更换数据库或新增报告库。发布卡片是报告来源，正文不重新定义指标。生成前固定每个共享ID的实际定义版本；记录看板版本、数据版本、项目时区、日期/筛选、分子/分母/成对样本、来源与更新时间。计算期间配置/数据改版则409。

日报/分组仍采用中央计算；结束日含全天，无日期数据不混入指定范围。完整周期按等长上期比较，比率差异标明“百分点”，独立范围不伪造共同上期比较。没有原始样本或无法计算的指标展示缺失及真实原因。初步状态摘要只描述观测结果和同步失败，不推断业务原因。

所有方向增加统一报告导航；看板快捷入口传递当前周期。报告历史服务端每页20，页码越界校正，旧版本保留；viewer可以查看/导出而没有生成按钮，业务editor可生成并留下真实操作者。空看板禁用生成入口，服务端同时拒绝。来源、定义等详细表格默认收起，普通用户先看核心指标与趋势。

通用/新投放报告不调用社媒、母婴、无关账户或模型接口；当前未启用AI增强。启萃旧业务生成和已存HTML仍保留，旧报告可通过沙箱预览/导出；本阶段不声称已完成启萃完整历史报告浏览器验收。

## 本阶段实际执行

| 类别 | 命令 | 当前结果 |
|---|---|---|
| 类型/构建 | npm run typecheck；npm run build | 最终代码通过 |
| 改动文件lint | node node_modules/eslint/bin/eslint.js [本阶段14个TS/TSX文件] | 0错误，5项原警告：3请求ref、1旧agent import、1旧commentAgg |
| 新报告API/真实SQLite | node scripts/test-product-reports.mjs | 10通过，含真实SQL写入失败回滚、白名单、权限、历史分页、比例与周期 |
| 原单元/存储/API混合 | node scripts/test-v3-remediation.mjs | 26通过，含1API，不全部算纯单元 |
| 原单位/样本 | node scripts/test-focused-remediation.mjs；node scripts/test-card-display-linkage.mjs | 12、17通过 |
| 原API | node scripts/test-v3-api.mjs；node scripts/test-focused-api.mjs；node scripts/test-card-display-api.mjs | 10、6、5通过，原v3API在最终白名单后又重跑10通过 |
| 已交付产品API | node scripts/test-product-foundation.mjs；test-product-data.mjs；test-product-metrics.mjs；test-product-board.mjs；test-product-adapters.mjs | 12、6、7、12、7通过 |
| HTTP传输 | node scripts/test-request-abort.mjs | 3通过 |
| 历史看板 | 7个原verify:dashboards组成脚本 | 本阶段重跑通过；SQL/SSR/静态，不是历史客户完整浏览器 |
| 本阶段真实浏览器 | node node_modules/@playwright/test/cli.js test tests/browser/product-reports.spec.ts | 事务修复后重点10通过，随后日期回填红例已修复，最终reports-complete全量118通过后，纯取证修改重点10再次通过 |
| 完整浏览器 | node node_modules/@playwright/test/cli.js test | 最终reports-complete完整118通过（108保留+10本阶段），0失败/跳过/重试 |

## 证据与边界

见[reports-evidence/README.md](reports-evidence/README.md)。两条最初报告断链/错误取数红例，响应读取错误的两次失败，日期恢复红例，百分点/事务/操作白名单API红例全部保留，未删除失败断言。API最初fixture参数顺序及看板初始版本错误也保留日志，改用真实保存签名与GET确认版本，业务断言不放宽。

1280/1440/768/390操作真实周期、键盘生成、保存、旧新快照、下载和只读；1280/390另覆盖百分和失败恢复。最早截图被操作通知遮挡，已拒作最终视觉证明，将在关闭实际通知后重新取证；最终截图已实际打开检查：四宽度报告、390px百分与样本、错误范围及只读；最后关闭通知取证的10条路径再次通过，没有加载/通知遮挡。

外部只模拟飞书HTTP边界；本地接入、映射、完整同步、SQL、指标、看板发布、报告保存/GET、HTML下载及DOM是真实代码。500/断网仅注入失败，没有mock本地成功。SQL触发器只在:memory:测试库。本阶段没有真人试用、真实飞书、真实广告账户、生产授权验证或部署。

完整目标仍待：结构复用、内容/评论来源适配、日常首页进一步收敛、启萃业务组件布局与完整历史场景、页面身份/缓存/撤权、四完整产品场景及自动化实测。已有看板发布后status元数据仍可能保留旧draft，需在后续整合中核查；本阶段以真实保存的卡片/版本判定报告资源，不做未经核实的历史迁移。
