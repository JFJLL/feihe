# 测试结果与剩余限制

## 最终执行

| 检查 | 命令／范围 | 结果 |
| --- | --- | --- |
| TypeScript | npm run typecheck | 通过 |
| 本地构建 | npm run build | 通过；没有启动生产服务或部署 |
| 返修文件 lint | ESLint 对修改/新增的 TS、TSX、JS、MJS 文件 | 0 错误，21 警告 |
| 全仓库 lint | npm run lint 相同检查范围，排除已生成的 dist/.verification | 8 错误，74 警告；未通过 |
| 单元脚本 | npm run verify:unit | 26/26；其中 25 单元/存储，1 指标预览 API |
| API 脚本 | npm run verify:api | 10/10；本地真实接口处理、认证及 SQL |
| 浏览器 | npm run verify:e2e | 20/20；Chromium，单 worker，retries=0 |
| 旧脚本 | npm run verify:unit-api:v2 | 23 检查章节通过，含静态检查、单元/API 与烟测 |
| 历史看板 | npm run verify:dashboards | 七段脚本全部退出码 0 |
| 用户 Chrome | Kimi Browser Extension 已连接浏览器 | 390px 计数/弹窗/发布/刷新路径通过 |
| 外部模拟 | 飞书 HTTP 模拟服务器 / fixture handler | 已执行；覆盖 5 个浏览器用例及 7 个独立 API 用例 |
| 真实飞书业务验收 | 未调用真实文档完成验收 | 未执行 |
| 生产验证 | 无发布或生产数据操作 | 未执行 |

API 数量分别列出并合计为 11；单元为 25；浏览器为 20。外部模拟是这些用例的环境维度，不加入测试总数。
原 verify:e2e 的脚本重命名为 verify-v2-unit-api.mjs，入口为 verify:unit-api:v2。原有局部变量、常量数组、笔记数 >=0、布尔状态等断言明确作为烟测/单元边界，没有继续宣称浏览器用户路径通过。直接 saveDataset 的完整数组用例验证存储，不代表飞书全表接入通过。

原始输出在 [checks](checks/)。首次失败与中间失败见 [复现报告](REPRODUCTIONS.md)。
浏览器 trace 内记录真实 DOM 操作和请求。各用例 key-requests.json 为页面请求摘要，persistence.json 为用例完成时从真实本地 GET 接口取得的数据库状态；数据准备及持久化查询也进入 trace。

## 关键反例

- 记录行数 3；非空数与去重数分别计算。
- 旧 task_total 转求和 amount 得 30，刷新仍为自定义配置。
- 10/null 平均 10；组内平均 10、有效样本 1；补零后两者共同为 5。
- 缺字段、全空、真零、非法数值、零分母五种状态；小于 1% 的比率不再次乘 100。
- 501 行经六页真实本地同步后加权 16.7%，5050 行电子表格读取越过原 5000 行边界。
- URL 只改动而不再次检测，也阻止旧 inspect 写回；换表重新绑定映射。
- 空必填、重复主键、重复目标、未知布尔、非法数值、非法日期、畸形规则、旧 skip 配置拒绝。
- 预览 true/null 与实际存储类型一致；未映射列保留在元数据。
- ISO 小数秒不损坏；按时区包含结束日中午，排除下日零点与无日期记录。
- 409 采用真实多次推进后的版本；500、断网停止切换并保留草稿；恢复后真实成功保存。
- 空看板保存刷新仍空；取消恢复原稿；同步导致当前页越界自动校正、草稿不丢。
- 保存冻结且重复动作只发一次真实请求。
- 初始化不能伪造就绪；单人跳过有效；管理员恢复归档，只读/其他写操作拒绝。
- 模块导航、项目切换、后退保留草稿；评论与投放模板进入各自业务主体。
- 390px 弹窗居中、不溢出、操作区可见，Tab 限制焦点、Escape 与返回焦点有效。

## 完整 lint 的 8 个既有错误

以当前同一 ESLint 配置对起始 SHA 的原始文件执行 lintText，记录 [lint-baseline.json](checks/lint-baseline.json)：32 个错误。
最终以下 8 个错误在起始文件也存在，并且该文件没有被本次返修改写：

| 文件 | 原始行 | 规则／数量 |
| --- | --- | --- |
| components/notes-modal/CategoryNotesModal.tsx | 51、80、87 | effect 状态更新 2、explicit-any 1 |
| components/project-shell/ProjectShell.tsx | 66、73 | explicit-any 2 |
| features/comments/AcceptanceDelivery.tsx | 29 | explicit-any 1 |
| features/settings/members/MemberManagement.tsx | 84 | effect 状态更新 1 |
| lib/feishu-sync.ts | 65 | explicit-any 1 |

因此完整 lint 结果保留失败。返修文件的独立 lint 为成功，但警告未归零，没有禁用这些规则。只忽略构建/缓存等生成目录。

## 剩余限制和未执行项

1. 真实飞书文档权限、限流、特殊字段及租户差异尚未验收；本次飞书服务是外部模拟。早期认证 400 不构成真实飞书成功验收。
2. 生产验证、推送、合并和部署未执行。
3. 来源预览只读样本（电子表格前 10 行）；服务端导入校验完整批次，样本外无效数据仍会拒绝，保存按钮的预览校验不能承诺全部外部行已合法。
4. 多维表超过安全上限或分页协议不完整会明确失败并保留旧快照；没有悄然发布截断数据。
5. 日期支持界面列出的 auto/YYYY-MM-DD/YYYY-MM/ISO；未知文本、错误日期、unsupported skip 规则被拒绝。未增加定时同步后台。
6. 浏览器覆盖 Chromium 和已连接的用户 Chrome。Firefox/Safari 与其中的后退兼容行为未执行。
7. 20 个自动用例与 Chrome 补充复核覆盖指定核心控件；没有宣称整个平台所有按钮或真实外部 AI/媒体服务通过。
8. 旧脚本内的源代码/静态 React 渲染与烟测保持原价值，统计独立。启萃历史图表回归通过，不代表真实启萃文档同步完成。
9. 所有失败证据保存在本地 docs 目录。trace/HTML 生成文件含开发资源，体积较大，与本地代码提交的边界记录在 DELIVERY-STATE.json。
