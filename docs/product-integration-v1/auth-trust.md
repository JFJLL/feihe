# 身份信任边界（本轮实现与未验证范围）

生产默认拒绝未知身份，不接受任意Bearer令牌、未验证x-user-id或本地访问回退。已登记的公司账号可通过受信网关验证后进入；账号、姓名、邮箱、部门在既有users模型与平台基础管理维护。

网关须先验证企业会话、移除客户端自带身份头，然后注入x-feihe-user-id、x-feihe-auth-timestamp（毫秒）、x-feihe-auth-signature（SHA-256 HMAC的hex）。签名消息为userId + 换行 + timestamp，服务端使用仅保存在服务端的FEIHE_AUTH_GATEWAY_SECRET验证，时间窗口5分钟，并读取已登记账号的真实角色。配置密钥、真实会话和反向代理联调属于单独的预发/生产验收，本轮未执行。

测试身份仅在ENABLE_TEST_AUTH=1、非production且非REQUIRE_PROD_AUTH=true，以及LOCAL_DB_PATH为:memory:或.verification路径时接受。测试身份不可替代企业真实身份。

本轮3条生产模式身份反例已从失败变为通过，包括未经验证管理员头、任意token/无身份、已验证普通用户签名且原始user头不能覆盖。相关真实项目API与成员授权仍继续验证。

真实网关接入、真人角色账号、跨项目撤销后的缓存、完整报告/导出/AI边界还需后续场景审计；不以身份函数通过宣称生产可承载真实客户数据。
