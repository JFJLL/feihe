# 产品整合V1：持续目标

起始SHA：1027b6b61d819763a5028c6329c34c7c1953b883。实际工作区：D:/download/pic-vec/feihe-platform-v3；应用feihe-mvp；分支codex/product-integration-v1。初始已跟踪文件干净，旧v3未跟踪证据保留，main工作区未改动。原始需求完整保存在[request.md](request.md)。

目标：新部门无需理解内部配置实现、无需开发或DB协助，自行创建自己的客户/内部项目，接入自己的业务表，得到共享口径的指标、趋势、分组、报告并授权团队；启萃保留完整业务与复杂图表。定位是项目数据、业务分析与报告协作平台。

人物：普通部门负责人（平台user/项目project_admin）、业务成员editor、只读viewer；平台admin只执行客户/部门等基础管理。界面收敛为项目中心与项目内概览、数据、指标、已启用业务模块、报告、设置。

全部工作包仍在进行，不把最小UI改动或方法测试作为最终完成。已执行本轮当前实现的真实浏览器走查，发现推广阻断见[baseline-audit.md](baseline-audit.md)。入口/表单、数据工作台、共享指标与五类共享看板已开发验证，分别见foundation-report.md、data-report.md、metrics-report.md、board-report.md；字段推荐/结构复用、专属业务适配、报告/启萃组件、页面身份/撤权及四场景仍待继续。

环境：127.0.0.1:5216本地应用，5217外部飞书模拟；隔离SQLite .verification/product-integration-browser.db，测试身份已预置，未使用客户数据、生产或真实飞书。无真人访谈/部门试用，不将浏览器脚本称为真人独立使用。
