# 共享看板：五类呈现、周期与明确目标

本批起点878fc32fa55d9c84e285452db3d98f287284a2a0，实际分支codex/product-integration-v1、工作区D:/download/pic-vec/feihe-platform-v3。完整产品目标持续active。这里只交付第二批中的共享看板呈现和查询；专属业务适配、启萃复杂组件布局、确定性报告、页面身份/撤权和四条完整产品场景还没有完成。

## 修复前后

| 反例 | 修复前真实结果 | 本批结果 |
|---|---|---|
| 原四列日期/渠道/咨询/成交表，页面添加时间趋势 | 下拉只有单值、分组、比率进度，没有趋势；接口拒绝趋势与明细 | 五种呈现统一登记，选择已有指标后即可加入；趋势、分组、单值与明细引用同ID/版本 |
| 项目范围仅10月1日：中午20/100、23:59的10/100、10月2日零点50/100、无日期90/100 | 无项目日期控件；接口忽略项目query，42.5% | 15.0%、成对有效2行；零点及无日期排除，项目时区及排除策略显示 |
| 页面明确目标20%，结果15% | 只存在默认100%的比率基准，没有业务目标入口 | 目标20.0%、达成75.0%；新目标必须填写正数，发布存储确认版本 |
| 0.5%、1.5%的普通字段平均，目标2% | 新增目标路径需建立明确存储规则 | 平均与日趋势1.0%；目标存0.02，显示2.0%、达成50.0%；原数据仍0.005/0.015 |
| 新增明细路径：31行1%，翻到第二页后真实同步为1行2%，再翻页 | 自测红例：表已是新记录，但标题仍1.0%、样本31、数据v2 | 自动重读整个共享看板，校正第1/1页、1行、2.0%、数据v3；不混合两版结果 |
| 新增目标路径：比例平均改成计数，原目标0.02 | 自测红例：仍正常接受旧目标，将百分比目标解释成记录数 | 结果单位改变后旧目标不可计算/发布，界面要求核对并重新填写；确认3后计数2、达成66.7% |
| 修改卡片与项目周期→保存并切换→409/500/断网 | 原草稿保护只需扩展到新增周期状态 | 三类失败都保留原数据集、标题与10月2日结束日期；服务器仍保留原10月1日范围，重试真实成功后才切换 |

原基线2条浏览器失败和4条API失败已保留。开发过程中新增分页2条失败、目标单位1条API失败、历史min/max周期1条API失败，以及两次完整回归各99通过/1失败，也保留。首次同步回归失败是测试在响应返回后立即用count()决定重试按钮，过早选择已消失的旧按钮；改成等待已保存/失败状态和可用重试控件，原ID/数量/真实同步200断言保留。第二次失败为Vinext取消请求错误层遮挡导航按钮，已通过真实HTTP反例修复。

## 实现与兼容

- CARD_PRESENTATIONS是有限登记表：单值、时间趋势、分组、明细、目标进度。所有业务方向的共享看板沿用同一选择器、渲染和保存接口；旧专属业务主体继续存在。
- 项目query保存在已有dashboards.layout_json，与卡片通过同一乐观版本和原子保存提交。确认后采用服务器layout；失败保留快照，取消/放弃恢复原范围。viewer仅改变自己的临时查看范围，不发布。
- 卡片默认跟随项目周期；明确独立日期及旧from/to覆盖保留并显示“独立周期”。共同字段筛选继续应用，字段缺失报错，不静默忽略。
- 日趋势按项目时区解析后逐日调用原聚合函数；默认成对、明确独立汇总和补零仍各自有效。平均跳过缺失，各桶与全盘样本规则一致；缺日期不进入指定周期，间隔缺日插入缺失点以断开曲线。
- 明细服务端全量筛选、计算后分页15行，显示name并按key取值；超页自动校正。翻页发现来源/指标版本变化时重读全看板，迟到请求被忽略。
- 新目标明确填写，值采用指标原有存储协议：ratio使用百分点，百分比字段使用fraction。发布记录targetMetricVersion；后续单位不兼容时要求重新确认。仍兼容的单位允许定义更新；高级字段/聚合/显示变化时只清除不兼容目标。历史未设置业务目标的比率进度继续以100%为基准，并明确标注它不是业务目标。
- 原格式化函数仅提取为纯display模块，计算和渲染共用同一函数；没有重新引入按数值大小猜比例。
- 新日期校验保留历史min/max键的计算；仅按数值字段验证，不改变实际聚合。新增目标卡的非比率呈现不显示无关分子分母。

## 取消请求兼容

真实浏览器捕获了取消POST在冷初始化期间进入Request克隆后抛出“Response body object should not be disturbed or locked”，错误层拦截按钮。3项真实loopback HTTP检查覆盖完整/部分POST关闭和正常POST的请求体/请求头保留；前两项修复前失败、修复后通过。[Vinext入口源码](https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/server/app-rsc-handler.ts)可核对初始化后的克隆位置；错误原因与修复必要性依据本地已安装代码、真实HTTP反例和浏览器trace判定。

scripts/patch-vinext-aborts.mjs只为当前锁定vinext 1.0.0-beta.3添加关闭连接检查：在克隆前结束已取消请求，不执行接口业务。postinstall幂等应用，版本及唯一入口断言拒绝未知源码。没有更新依赖版本、关闭错误层、绕过认证或模拟本地成功。后续升级Vinext时必须复核并移除此兼容补丁。正常保存/查询/计算仍经过真实接口，最后100条浏览器回归已覆盖。

## 本批验证

实际工作目录为D:/download/pic-vec/feihe-platform-v3/feihe-mvp。最终完整浏览器为board-runtime-verified，100通过、0失败/跳过/重试；之前的99通过/1失败单独保留。

| 类别 | 实际命令 | 本批结果 |
|---|---|---|
| 静态 | npm run typecheck | 通过 |
| 构建 | npm run build | 通过 |
| 改动文件lint | node node_modules/eslint/bin/eslint.js [本批16个TS/TSX文件及2个传输脚本] | 0错误，4项原警告（3个请求ref、1个commentAgg） |
| 原单元/存储/API混合 | node scripts/test-v3-remediation.mjs | 26通过；包含1项API，不全部计为纯单元 |
| 原单位/样本单元 | node scripts/test-focused-remediation.mjs；node scripts/test-card-display-linkage.mjs | 12、17通过 |
| 原API | node scripts/test-v3-api.mjs；node scripts/test-focused-api.mjs；node scripts/test-card-display-api.mjs | 10、6、5通过 |
| 已交付共享对象/数据API | node scripts/test-product-metrics.mjs；node scripts/test-product-data.mjs | 7、6通过 |
| 新共享看板API/真实SQLite | node scripts/test-product-board.mjs | 12通过 |
| HTTP传输 | node scripts/test-request-abort.mjs | 3通过；2项取消、1项正常请求，不计为平台API或浏览器 |
| 新看板与同步失败浏览器 | node node_modules/@playwright/test/cli.js test tests/browser/product-board.spec.ts tests/browser/focused-red.spec.ts | 23通过（20新、3保留）；四宽度含打开的选择器，1280/390含失败恢复及目标确认 |
| 全部浏览器 | node node_modules/@playwright/test/cli.js test | 100通过（47原、18入口、6数据、9共享指标、20本批）；0失败/跳过/重试 |
| 旧启萃专项 | node scripts/test-dashboard-feedback.mjs；node scripts/verify-growth.mjs；node scripts/test-workspace-charts.mjs；node scripts/test-content-comment-boards.mjs；node scripts/test-acceptance-reply-pending.mjs；node scripts/test-ui-unification-v1-regression.mjs；node scripts/test-category-notes-modal.mjs | 7个脚本通过；SQL/内存HTTP、静态/SSR/交互处理器回归，不能称真实历史客户浏览器验收 |

浏览器变量：FEIHE_E2E_BASE_URL=http://127.0.0.1:5216，FEIHE_TEST_VENDOR_ORIGIN=http://127.0.0.1:5217，FEIHE_TEST_DB_PATH=.verification/product-integration-browser.db，FEIHE_TEST_CACHE=node_modules/.vite/product-integration-browser；每次FEIHE_E2E_OUTPUT_ROOT使用独立本批目录。

外部模拟仅替换飞书HTTP边界；本地配置、同步、转换、SQLite、指标、保存、GET与DOM执行真实代码。保存500和断网仅注入失败；409通过真实第二次服务器发布触发。测试身份仅隔离环境。真人试用、真实飞书、生产验证/部署均未执行。

## 证据与剩余范围

最终证据在[board-evidence](board-evidence/README.md)，包含20条新增路径、6条失败证据、同步失败重试、trace、页面和存储快照、关键请求及完整机器结果。截图实际打开检查，含四宽度展开选择器、已发布五类呈现、390px目标确认/周期草稿/分页纠正。初次周期截图抓到加载状态，被拒收，重新等待实际42.5%结果后取证。

关键文件：lib/metrics/config.ts、query.ts、display.ts、definitions.ts、engine.ts；features/metrics/MetricCardPicker.tsx；features/overview/GeneralWorkbenchBoard.tsx、BoardQueryBar.tsx、MetricDetailTable.tsx、CardRenderView.tsx、CardEditModal.tsx；components/ui/TimeSeriesChart.tsx；app/api/metrics与dashboards/route.ts；scripts/patch-vinext-aborts.mjs及本批测试文件。

V1共享看板目前只提供同一来源字段的共同筛选，候选列表最多100项并标注限制；不做任意联表。时间趋势按日聚合。明细每页15行，指标始终计算完整符合条件记录。新目标不是自动预测，必须经用户确认。

旧专属投放/内容/评论图表仍未贯通通用来源；启萃丰富组件还没有完成可选择布局；字段推荐/结构复制、确定性报告、页面认证/缓存/撤权以及四条完整产品路径继续待实施。不能用本批五类呈现通过替代这些目标。

本批验证完成后按当前用户授权提交推送，暂不合并，不部署。最终Git收据写入忽略的DELIVERY-STATE.json，避免文件自引用提交SHA；原main与未跟踪v3历史证据保留。
