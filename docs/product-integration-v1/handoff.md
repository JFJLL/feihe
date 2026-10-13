# 当前真实进度与交接

状态 active；完整产品目标未完成。起始 SHA 1027b6b61d819763a5028c6329c34c7c1953b883，独立分支 codex/product-integration-v1。用户当前会话授权每批完成后提交推送，暂不合并。不部署、不修改真实客户数据。当前批将提交；真实Git收据保存在忽略的DELIVERY-STATE.json，不自引用SHA。

第一批入口/表单/角色首用已实施并验证，详见 foundation-report.md。生产身份基础收紧；12项身份/API、18条当前真实浏览器通过，另26项原单元/存储/API及10项API通过；类型和构建通过，改动文件lint0错误3个原ref警告。最新完整证据为foundation-evidence-final，旧foundation-evidence的加载截图被拒收并保留本地。所有失败版本仍保留。

前置18页审查见baseline-audit.md和before/。原合成审查项目project-f501f105（日期/渠道/咨询/成交3行）、project-8aff73d0（日期/渠道/花费/曝光/点击2行）入库真实，投放专用图仍未贯通；这些是缺口复现，不是最终验收。

测试环境5216/5217，隔离SQLite .verification/product-integration-browser.db；Playwright自动启动并结束服务。此前人工服务session91778/PID25096已结束，不可使用旧句柄或宣称仍live。身份user-editor为普通负责人，user-project-manager为editor，user-viewer为viewer；管理员仅平台管理。外部仅模拟飞书，本地保存/查询/计算/授权真实。

下一批：真实数据工作台→共享指标对象/引用与版本→五种展示及所有方向共享配置→投放等来源适配→同口径报告。同步检查页面认证、缓存隔离和撤权；保留旧启萃能力。新增四产品场景，最后重跑保留的全部适当回归。不得把入口阶段提交缩减成完整目标，也不得用旧轮测试数字冒充本轮执行。

没有真人访谈/试用、真实飞书、生产验证。无需这些外部凭证仍可继续上述本地实施，当前没有阻断继续开发的外部条件。
