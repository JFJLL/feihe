# 本阶段结构复用证据

完整目标仍active，起点f01079c，独立工作区D:/download/pic-vec/feihe-platform-v3。完整命令和隔离环境见commands.json。

- results.json：structure-complete完整144条（129保留+15新增）0失败/跳过/flaky/重试。
- red-01和logs/structure-api-red.log：最初UI无复用入口、接口忽略参数及无权来源仍创建的真实失败。
- failure-01/02：错误从configJson读取行标题的原失败。
- failure-03：持久测试库多个同名前缀来源，使用不唯一选择器的原失败。
- failure-04/06：百分数字段真实存储已转换为fraction，原表格显示0.005；现在数据表按明确元数据显示百分比，存储协议不变。
- failure-05/07：猜测不存在投放标题的原失败；真实投放区域已经有500/10000/100/1.0%，最终沿用现有区域/卡片验证。
- visual-rejected-390.png：实际打开后拒收的单字列标题截图，保留作为布局修改前证据。
- case-01：普通负责人项目中心统一表单、授权来源、明确不复制数据/来源/目标、未确认禁止创建。
- case-02/09：1280/390实际新建→不同字段的新文档→自己的字段映射→1200新目标→600试算→发布刷新→实际存储/报告和viewer。原目标仍600、周期/筛选清空、新ID仅属目标项目。
- case-03/10：源0.5/1.5%的规则复用于自己的1.5/2.5%表，平均2.0%，DB0.015/0.025，发布刷新不重复转换。
- case-04/11：新投放表的五个不同字段驱动专属页500/10000/100/1.0%，自身来源和同ID指标，无旧文档/账户。
- case-05/06/07、12/13/14：500/断网/真实409保留字段与目标，409读新字段仍保留1200，成功重试只有4指标且v1。
- case-08/15：试算503撤下旧300，保留控件并禁确认，重新读取恢复，取消选择不丢。

每case有trace.zip、关键页面请求key-requests.json、真实API诊断persistence.json和截图；夹具准备/角色操作仍是真实本地接口，完整调用可回放trace。仅外部飞书HTTP边界模拟，没有本地成功mock。所有失败trace保留，原始全量报告在忽略的.verification/structure-raw-evidence；版本库只收录本阶段15重点路径、全部失败、完整结果与日志，避免重复拷贝129条成功trace。

回放：在应用目录node node_modules/@playwright/test/cli.js show-trace 加对应绝对trace.zip路径。静态/SQL/SSR脚本不是浏览器，模拟网关不是上线验证。真人/真实飞书/生产均未执行。

最终structure-final-feedback 15条通过；case目录来自这次最新的错误视口/焦点强断言复验。之前CSS-only15与全量144的原始结果仍独立保留。最终图已实际打开检查，索引见visual-review.json。
