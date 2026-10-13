# 第二批阶段：数据工作台

完整产品目标仍 active。本批补齐真实数据页核心，尚未完成共享指标、五类看板、业务适配和报告。前批入口已提交推送4119e1fdcdce41a1f6b610eadcb3e9149992f326；本批验证后按当前会话授权提交推送，不合并、不部署。

## 修复前与现在

- 修复前 /data 被转到设置；两宽度四条有效红例分别找不到数据工作台、数据集明细。测试准备中的错误工作表ID/成员action已先纠正并保留原失败，随后4条有效反例均在预期页面缺口处失败，再改产品实现。
- 现在所有业务方向有真实 /data 导航。数据源/数据集/同步记录分层；保留旧设置链接兼容。沿用原接入Dialog、链接检测、选表、映射、全批次转换与原ID失败重试。
- 来源可查看生成的数据集、已绑定指标/卡片、原表编辑位置、最后同步及有限范围；调度未接通时明确需手动同步，选择频率不冒充调度生效。
- 数据集按真实API分页和搜索；显示名读name、值读key。字段质量检查全量记录，区分空值、非法数值/日期/布尔与真实零，不修改原值。
- 快速搜索取消旧请求并忽略旧结果；查询异常清除旧成功视图并显示错误。31行第三页缩至1行后，自动校正第一页并重读。
- 同步失败记录来源ID、读取量、整批未发布、失败原因及操作者，保留旧数据快照。恢复使用原来源ID/数据集ID。每次读取范围记录在原sync_jobs表两个必要字段中；历史未知范围明确未知，不能根据后来编辑过的来源猜旧范围。
- 数据页按真实角色显示配置/同步操作；viewer可核对数据但不进入写流程，外部/未知身份拒绝。空看板保留唯一配置入口，“创建第一张卡片”直接进入编辑器；归档看板暂停配置。
- 数据页使用原紧凑页面框架，390px表格可在容器内横向滚动并用左右方向键查看；配置校验时不再有浮动助手覆盖字段。概览保留原助手。

## 当前执行与证据

| 类别 | 实际命令（feihe-mvp内） | 结果 |
|---|---|---|
| 新数据 API | node scripts/test-product-data.mjs | 6通过：真实SQL质量/键名、来源关系、权限、失败身份、范围历史 |
| 既有单元/存储/API | node scripts/test-v3-remediation.mjs | 26通过（25单元/存储、1 API） |
| 既有百分比/比率单元 | node scripts/test-focused-remediation.mjs | 12通过 |
| 既有卡片单位单元 | node scripts/test-card-display-linkage.mjs | 17通过 |
| 既有 API | node scripts/test-v3-api.mjs；node scripts/test-focused-api.mjs；node scripts/test-card-display-api.mjs | 分别10、6、5通过 |
| 既有浏览器 + 数据页面 | node node_modules/@playwright/test/cli.js test 加7个既有spec及product-data.spec.ts | 53通过（47既有、6新数据），0跳过、0重试、0flaky |
| 入口浏览器复验 | node node_modules/@playwright/test/cli.js test tests/browser/product-foundation.spec.ts tests/browser/product-data.spec.ts | 此前24通过（18入口、6数据） |
| 类型 | node node_modules/typescript/bin/tsc --noEmit | 通过 |
| 改动路径 lint | node node_modules/eslint/bin/eslint.js 加本批源码及测试路径 | 0错误；3个原看板ref警告 |
| 构建 | node node_modules/vinext/dist/cli.js build | 通过 |

53条运行发现23条失败、24条通过的中间报告仍保留：20条卡片用例被同名入口阻断，3条生命周期/导航在旧文案/旧URL等待。实际修正产品空入口、仅更新旧UI定位器和当前/data地址；原有计算、百分协议、草稿、日期、取消、存储、权限和恢复断言全部保留，最终53通过。没有将first()加到配置按钮去掩盖重复入口。

本批最终数据6条另做通知遮挡、紧凑框架、窄屏键盘检查，最新结果/截图以data-evidence/index.json为准。原截图中通知覆盖了表格，已拒收并保留本地；新截图先关闭通知，失败原因仍由真实同步历史表呈现。每条数据用例有请求、SQL持久化读取、trace及截图。既有47条完整trace在本地data-retained-verified/browser-results；机器结果随data-evidence/results.json保存。

## 模拟与限制

仅飞书 HTTP 边界模拟。页面接入、本地映射/同步/数据库/查询/指标/看板保存均真实。迟到搜索用例执行route.fetch()真实本地查询，只延迟其真实响应的交付，不合成成功值。隔离5216/5217及.verification/product-integration-browser.db；未读取客户凭证/生产数据。

目前数据页的“配置指标（高级）”仍进入既有DataMap；普通选指标→图表、共享指标ID/版本与影响范围在下一批实现，不能把卡片关系当共享指标完成。投放/内容/评论业务页与数据集的适配、同口径报告、启萃登记组件和完整四产品场景仍待实施。完整用户有效结果时间、真人试点、真实飞书、生产身份网关与生产验证未执行。既有历史看板专项脚本还需后续重跑。

## 关键文件

DataWorkspace复用原SettingsDataSources和通用控件；data-workspace读接口组合既有来源、数据集、卡片/绑定及同步表，未新增数据库。sync route追加真实失败记录与每次读取范围；ProjectShell/Sidebar/navigation接通真实页面；GeneralWorkbenchBoard修复空项目入口并保持计算和草稿代码。新tests/browser/product-data.spec.ts使用四列原表，没有为模板补status/budget/spent/owner。

本批已实看并接受的最终图：case-01/data-fields-and-rows.png、case-02/final-page.png、case-04/data-fields-and-rows.png及390-quality-keyboard-scroll.png、case-06/real-sync-failure-history.png及390-sync-error-details.png。桌面原表四列、390px字段/质量/真实错误和只读来源均已加载稳定，通知与浮动助手不覆盖表格；窄屏宽表需要横向查看，已通过真实方向键与整列可见断言。data-evidence/data-results.json为最新6条结果；results.json是此前47既有+6新数据的53条结果。
