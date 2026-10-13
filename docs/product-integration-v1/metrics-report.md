# 共享指标阶段：真实对象、引用与版本

完整产品目标仍active。起始1027b6b61d819763a5028c6329c34c7c1953b883；当前批从fc96420b2d4c394a8337ad1509641a9dd0b84c05继续，工作区D:/download/pic-vec/feihe-platform-v3，分支codex/product-integration-v1。遵照当前会话授权，完成验证后提交推送，不合并、不部署。

## 行为变化

原来每张卡各自存计算字段，项目没有普通指标页。两条1280/390浏览器反例先真实同步四列原表，再因找不到指标页失败；失败截图和trace保留。

现在项目指标定义一次来源、字段、日期、单位、缺失与比率规则；普通添加卡片为选指标→选呈现→加入草稿，发布仅存metricId、版本策略与分组/范围等呈现配置，计算字段不重复存卡片。复用原metric_definitions、metric_bindings、原引擎和CardEditModal，没有新指标数据库或服务。

同一成交率两张卡从成对20%修改为独立15%后都引用原ID并采用v2；分组门店按同口径30%。固定v1仍按成对规则计算当前数据，明确展示定义版本和数据版本；它不冒充历史数据快照。历史定义不覆盖，变更显示卡片影响范围。

公司标准模板只有规则，没有来源ID、客户数据、授权、目标、日期范围；平台管理员发布/维护版本，普通负责人绑定自己的原表。两项目有独立指标ID和数据集，第二项目自己的原表算出75%。标准模板升级不会悄悄改变已经确认的项目绑定。修改规则偏离标准时保存为项目私有口径，不声称同口径可比较。

保存409保留原字段与标题；版本读取真实GET结果，不猜加1。重读只更新确认版本，表单修改保持；用户核对后保存为新版本，历史仍保留。保存中阻止重复提交/关闭和修改提交快照。高级旧入口不能绕过共享对象版本规则。

投放、评论、内容方向也可进入共用团队卡片配置，原业务主体和启萃复杂图表仍保留。来源到专用业务图表适配、丰富组件登记、趋势/明细/目标进度还需后续实施。

## 已执行检查

- node scripts/test-product-metrics.mjs：7项真实API/SQL通过，包含引用、两种呈现、版本、冲突、只读/跨项目、旧入口保护、标准和配置反例。
- node scripts/test-v3-remediation.mjs：26通过（25单元/存储、1API）。
- node scripts/test-focused-remediation.mjs：12通过；node scripts/test-card-display-linkage.mjs：17通过。
- node scripts/test-v3-api.mjs：10通过；node scripts/test-focused-api.mjs：6通过；node scripts/test-card-display-api.mjs：5通过。
- node scripts/test-product-data.mjs：6通过。
- node node_modules/@playwright/test/cli.js test：第一轮73条全部通过（47既有、18入口、6数据、2共享指标）；后续共享指标/标准/三业务方向/409恢复9条通过。
- 最新完整浏览器80条通过：47既有、18入口、6数据、9共享指标。包含标准模板经页面维护至v2，其他项目原标准v1绑定不变；0跳过、0重试、0flaky。metrics-evidence/index.json和实际日志保存当前证据。
- node node_modules/typescript/bin/tsc --noEmit：通过。
- node node_modules/eslint/bin/eslint.js 加本批改动路径：0错误、4个既有警告（看板ref3、engine旧commentAgg1）。
- node node_modules/vinext/dist/cli.js build：通过。

旧独立卡片用例仅添加一次明确的“高级：独立卡片”操作，让原计算/百分比/草稿/日期/存储断言继续走原编辑器。没有删除、放宽断言，也没有将计算重新作为普通添加流程来迎合旧测试。

## 边界

外部仅飞书HTTP模拟；所有本地导入、SQL、定义、计算、引用、保存/发布/GET与角色检查真实执行。浏览器使用隔离5216/5217与.verification/product-integration-browser.db及预置企业测试身份，没有真实客户数据。

模板维护、共享引用与基本单值/分组本批可验；同一对象的时间趋势、确定性报告/导出及四条完整产品场景尚待后续开发和验证，不能据本批完成B02全部验收。真人试用、真实飞书和生产验证未执行。启萃历史专项仍待重跑。

关键实现：lib/metrics/definitions.ts、api/metric-definitions、MetricWorkspace、MetricCardPicker；引擎和metrics/dashboards/data-map/data-workspace接到同一对象并防绕过；CardEditModal继续承载高级/共享定义编辑，CardRenderView显示真实版本、来源与样本。新metrics页接入统一导航。全部原正确性规则保留。

最终代表截图已实看：case-08/09双呈现、case-07绑定预览75%与保存区、case-09键盘打开选择器、case-06真实409保留标题/字段与服务端v2。选择器初版标签拥挤的图片拒收并保留原运行；已修复为垂直字段布局，最新9条视觉/键盘复验通过。当前完整80条与最新9条结果分别保存，不当真人时间测量。
