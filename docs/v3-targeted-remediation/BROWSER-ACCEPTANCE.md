# 浏览器验收与证据

最终 20 条用例全部通过，retries=0。每条使用真实 DOM 操作并检查请求/数据库，环境边界见 TEST-RESULTS.md。

## 1. 映射规则反例

步骤：空项目→检测→表B→依次必填/主键/日期/布尔/数值反例→改回文本→首次同步。

关键请求：inspect、projects save_source、feishu/sync、datasets GET。

页面断言：每种无效配置出现明确 alert、保存禁用；修正后同步成功关闭弹窗。

持久化断言：无效期间没有数据集；存储金额 null、分组同组、已确认 false。

[trace](browser-results/flows-映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库/trace.zip) · [页面请求](browser-results/flows-映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库/key-requests.json) · [数据库快照](browser-results/flows-映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库/persistence.json)

- [final-page.png](browser-results/flows-映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库/final-page.png)
- [test-finished-1.png](browser-results/flows-映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库/test-finished-1.png)

## 2. A 空项目接入

步骤：创建空项目→数据管理→接入文档→表A切B→重复目标报错→修改 amount/id 与主键→保存同步→重编辑。

关键请求：inspect、projects save_source、feishu/sync、datasets all=true。

页面断言：表A字段消失，表B规则重建；重复目标禁用；预览 true；重编辑 amount 回填。

持久化断言：实际 id=1、amount=10/null、布尔 true/false、数值元数据一致。

[trace](browser-results/flows-A-空项目接入、换表、映射校验、真实同步和重编辑/trace.zip) · [页面请求](browser-results/flows-A-空项目接入、换表、映射校验、真实同步和重编辑/key-requests.json) · [数据库快照](browser-results/flows-A-空项目接入、换表、映射校验、真实同步和重编辑/persistence.json)

- [final-page.png](browser-results/flows-A-空项目接入、换表、映射校验、真实同步和重编辑/final-page.png)
- [test-finished-1.png](browser-results/flows-A-空项目接入、换表、映射校验、真实同步和重编辑/test-finished-1.png)

## 3. 链接和关闭乱序

步骤：SlowDoc 检测→仅改 NewDoc 链接→等待旧请求→再检测→关闭→新建。

关键请求：inspect（真实 upstream 延迟）。

页面断言：只改链接已清除旧字段；旧结果无法写回；新建为空链接，无任务字段残留。

持久化断言：未保存来源/数据集；状态快照保留。

[trace](browser-results/flows-来源慢请求：换链接、关闭与重编辑使旧结果失效/trace.zip) · [页面请求](browser-results/flows-来源慢请求：换链接、关闭与重编辑使旧结果失效/key-requests.json) · [数据库快照](browser-results/flows-来源慢请求：换链接、关闭与重编辑使旧结果失效/persistence.json)

- [final-page.png](browser-results/flows-来源慢请求：换链接、关闭与重编辑使旧结果失效/final-page.png)
- [test-finished-1.png](browser-results/flows-来源慢请求：换链接、关闭与重编辑使旧结果失效/test-finished-1.png)

## 4. B 新建四类卡

步骤：新建计数、平均、组平均、比率→试算→加入→发布→刷新。

关键请求：metrics evaluate、dashboards POST/GET。

页面断言：预览 3、15、同组10/样本1、100%；刷新保留卡片。

持久化断言：5 张卡包含原卡与新卡，配置和绑定数据集保存。

[trace](browser-results/flows-B-新建计数、平均、分组、比率卡，预览发布刷新保持正确/trace.zip) · [页面请求](browser-results/flows-B-新建计数、平均、分组、比率卡，预览发布刷新保持正确/key-requests.json) · [数据库快照](browser-results/flows-B-新建计数、平均、分组、比率卡，预览发布刷新保持正确/persistence.json)

- [final-page.png](browser-results/flows-B-新建计数、平均、分组、比率卡，预览发布刷新保持正确/final-page.png)
- [test-finished-1.png](browser-results/flows-B-新建计数、平均、分组、比率卡，预览发布刷新保持正确/test-finished-1.png)

## 5. C 保存500

步骤：编辑草稿→选择B→保存返回500→继续编辑→解除故障→再次保存并切换。

关键请求：dashboards POST 500故障注入→真实 POST 200→GET。

页面断言：失败停留A/编辑态/草稿；恢复后才B。

持久化断言：失败时仍原始标题；成功后为500草稿；有失败过程截图。

[trace](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/trace.zip) · [页面请求](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/key-requests.json) · [数据库快照](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/persistence.json)

- [failed-save-dialog.png](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/failed-save-dialog.png)
- [failed-save-preserved.png](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/failed-save-preserved.png)
- [final-page.png](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/final-page.png)
- [test-finished-1.png](browser-results/flows-C-保存并切换500保留草稿，重试成功后才切换/test-finished-1.png)

## 6. C 保存断网

步骤：编辑草稿→选择B→POST请求断开→继续编辑→恢复连接→再次保存并切换。

关键请求：dashboards POST abort(internetdisconnected)→真实200。

页面断言：失败停留A/编辑态/草稿；恢复后才B。

持久化断言：断开期间服务器仍原稿；成功后断网草稿；有失败过程截图。

[trace](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/trace.zip) · [页面请求](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/key-requests.json) · [数据库快照](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/persistence.json)

- [failed-save-dialog.png](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/failed-save-dialog.png)
- [failed-save-preserved.png](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/failed-save-preserved.png)
- [final-page.png](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/final-page.png)
- [test-finished-1.png](browser-results/flows-C-保存并切换断网保留草稿，重试成功后才切换/test-finished-1.png)

## 7. 取消与空看板

步骤：改标题→取消→删除所有卡→保存→刷新。

关键请求：dashboards POST cards=[]、GET。

页面断言：取消恢复原稿；刷新没有卡片并显示空状态。

持久化断言：cards=[] 真实持久化。

[trace](browser-results/flows-取消编辑恢复原稿，删光保存刷新仍为空/trace.zip) · [页面请求](browser-results/flows-取消编辑恢复原稿，删光保存刷新仍为空/key-requests.json) · [数据库快照](browser-results/flows-取消编辑恢复原稿，删光保存刷新仍为空/persistence.json)

- [final-page.png](browser-results/flows-取消编辑恢复原稿，删光保存刷新仍为空/final-page.png)
- [test-finished-1.png](browser-results/flows-取消编辑恢复原稿，删光保存刷新仍为空/test-finished-1.png)

## 8. D 日期生命周期

步骤：接入包含中午/次日零点/无日期的数据→日期字段和同日范围→试算→保存→发布→刷新→再编辑。

关键请求：datasets POST、metrics、dashboards POST/GET。

页面断言：计数1；重新打开日期字段/from/to仍一致。

持久化断言：configJson保留 dateField/from/to；次日和无日期不纳入。

[trace](browser-results/flows-D-日期范围经编辑试算发布GET刷新重新打开完整保存/trace.zip) · [页面请求](browser-results/flows-D-日期范围经编辑试算发布GET刷新重新打开完整保存/key-requests.json) · [数据库快照](browser-results/flows-D-日期范围经编辑试算发布GET刷新重新打开完整保存/persistence.json)

- [final-page.png](browser-results/flows-D-日期范围经编辑试算发布GET刷新重新打开完整保存/final-page.png)
- [test-finished-1.png](browser-results/flows-D-日期范围经编辑试算发布GET刷新重新打开完整保存/test-finished-1.png)

## 9. E 初始化与恢复

步骤：空资源完成受阻→伪造完成接口拒绝→稍后不发布→配置真实资源→单人跳过→完成→归档→刷新→恢复→再编辑。

关键请求：projects mark_onboarding/archive/restore、dashboards。

页面断言：按钮真实受阻；就绪向导结束；刷新归档后有恢复入口；恢复可编辑。

持久化断言：ready、skip:members、项目资料保留；viewer恢复与归档其他写403；恢复后卡片保存。

[trace](browser-results/lifecycle-E-必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑/trace.zip) · [页面请求](browser-results/lifecycle-E-必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑/key-requests.json) · [数据库快照](browser-results/lifecycle-E-必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑/persistence.json)

- [final-page.png](browser-results/lifecycle-E-必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑/final-page.png)
- [test-finished-1.png](browser-results/lifecycle-E-必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑/test-finished-1.png)

## 10. 导航保护

步骤：编辑→模块链接→继续编辑→浏览器 history.back→继续编辑→切项目→保存导航。

关键请求：app导航事件、dashboards真实POST/GET。

页面断言：模块/后退/项目切换均先确认；取消保持URL与草稿。

持久化断言：导航前成功保存原项目草稿；到达实际目标项目。

[trace](browser-results/lifecycle-离开模块、切换项目和浏览器后退均先保护草稿/trace.zip) · [页面请求](browser-results/lifecycle-离开模块、切换项目和浏览器后退均先保护草稿/key-requests.json) · [数据库快照](browser-results/lifecycle-离开模块、切换项目和浏览器后退均先保护草稿/persistence.json)

- [final-page.png](browser-results/lifecycle-离开模块、切换项目和浏览器后退均先保护草稿/final-page.png)
- [test-finished-1.png](browser-results/lifecycle-离开模块、切换项目和浏览器后退均先保护草稿/test-finished-1.png)

## 11. F 卡片/冲突390px

步骤：390px→键盘添加/选择器→两次Escape→添加卡→真实版本冲突→未保存→强制保存→刷新。

关键请求：metrics、dashboards409/force200。

页面断言：原生Dialog居中、不溢出；Tab15次不离开；Escape和焦点返回；冲突可操作。

持久化断言：真实新卡保留；服务端确认强制版本；保存刷新验证。

[trace](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/trace.zip) · [页面请求](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/key-requests.json) · [数据库快照](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/persistence.json)

- [390-card-select.png](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/390-card-select.png)
- [390-conflict.png](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/390-conflict.png)
- [390-unsaved.png](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/390-unsaved.png)
- [final-page.png](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/final-page.png)
- [test-finished-1.png](browser-results/lifecycle-F-390px键盘完成卡片、选择器、未保存和冲突弹窗/test-finished-1.png)

## 12. F 映射/确认390px

步骤：390px→键盘进入映射→检测→选表B→映射→保存同步→打开移除确认→Escape。

关键请求：inspect、save_source、feishu/sync、datasets。

页面断言：打开的映射/确认与选择器未遮挡操作区；Escape返回焦点。

持久化断言：3 行实际导入，映射值/类型核对；取消移除保留数据。

[trace](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/trace.zip) · [页面请求](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/key-requests.json) · [数据库快照](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/persistence.json)

- [390-confirmation.png](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/390-confirmation.png)
- [390-mapping.png](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/390-mapping.png)
- [final-page.png](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/final-page.png)
- [test-finished-1.png](browser-results/lifecycle-F-390px键盘映射、真实写入与确认弹窗/test-finished-1.png)

## 13. 首个计数反例

步骤：选择三条任务A→添加自定义记录计数→读实时预览。

关键请求：metrics evaluate。

页面断言：实际预览数字严格为3、计算完成。

持久化断言：真实预置三条；没有custom字段；未发布的卡不改变服务器原稿。

[trace](browser-results/remediation-记录计数：普通三条任务的实时预览必须为3/trace.zip) · [页面请求](browser-results/remediation-记录计数：普通三条任务的实时预览必须为3/key-requests.json) · [数据库快照](browser-results/remediation-记录计数：普通三条任务的实时预览必须为3/persistence.json)

- [final-page.png](browser-results/remediation-记录计数：普通三条任务的实时预览必须为3/final-page.png)
- [test-finished-1.png](browser-results/remediation-记录计数：普通三条任务的实时预览必须为3/test-finished-1.png)

## 14. 首个409反例

步骤：编辑草稿→真实服务器推进4个版本→选B→保存409。

关键请求：dashboards真实多次POST/409/GET。

页面断言：仍A、草稿、编辑态；冲突版本等于真实响应。

持久化断言：服务器仍其最新版本/标题，失败未写入草稿。

[trace](browser-results/remediation-409：保存并切换失败后仍保留数据集A、草稿和编辑状态/trace.zip) · [页面请求](browser-results/remediation-409：保存并切换失败后仍保留数据集A、草稿和编辑状态/key-requests.json) · [数据库快照](browser-results/remediation-409：保存并切换失败后仍保留数据集A、草稿和编辑状态/persistence.json)

- [final-page.png](browser-results/remediation-409：保存并切换失败后仍保留数据集A、草稿和编辑状态/final-page.png)
- [test-finished-1.png](browser-results/remediation-409：保存并切换失败后仍保留数据集A、草稿和编辑状态/test-finished-1.png)

## 15. 模板覆盖反例

步骤：编辑task_total→改sum/amount→预览→发布→刷新。

关键请求：metrics、dashboards POST/GET。

页面断言：预览30；刷新30。

持久化断言：mode=custom、metric=custom、aggregation=sum、field=amount。

[trace](browser-results/state-旧模板改为自定义求和后显示30，保存刷新仍按新配置计算/trace.zip) · [页面请求](browser-results/state-旧模板改为自定义求和后显示30，保存刷新仍按新配置计算/key-requests.json) · [数据库快照](browser-results/state-旧模板改为自定义求和后显示30，保存刷新仍按新配置计算/persistence.json)

- [final-page.png](browser-results/state-旧模板改为自定义求和后显示30，保存刷新仍按新配置计算/final-page.png)
- [test-finished-1.png](browser-results/state-旧模板改为自定义求和后显示30，保存刷新仍按新配置计算/test-finished-1.png)

## 16. 预览迟到与失败

步骤：A真实试算响应延迟→切B→迟到A→新配置500。

关键请求：metrics route.fetch后延迟、500故障。

页面断言：最新预览1保留；500清旧值、alert、禁止加入。

持久化断言：服务器原看板未被失败配置修改。

[trace](browser-results/state-预览乱序忽略旧值，500错误清除成功预览并禁止加入/trace.zip) · [页面请求](browser-results/state-预览乱序忽略旧值，500错误清除成功预览并禁止加入/key-requests.json) · [数据库快照](browser-results/state-预览乱序忽略旧值，500错误清除成功预览并禁止加入/persistence.json)

- [final-page.png](browser-results/state-预览乱序忽略旧值，500错误清除成功预览并禁止加入/final-page.png)
- [test-finished-1.png](browser-results/state-预览乱序忽略旧值，500错误清除成功预览并禁止加入/test-finished-1.png)

## 17. 数据/搜索与key

步骤：B设置金额显示名→读100→延迟A响应→切B→旧搜索→新搜索。

关键请求：datasets真实响应延迟。

页面断言：表头金额，取值100；旧响应/旧搜索不覆盖最新B。

持久化断言：columns.key=amount、name=金额，rows.amount=100。

[trace](browser-results/state-数据集迟到响应、搜索和金额显示名均使用当前内容和存储key/trace.zip) · [页面请求](browser-results/state-数据集迟到响应、搜索和金额显示名均使用当前内容和存储key/key-requests.json) · [数据库快照](browser-results/state-数据集迟到响应、搜索和金额显示名均使用当前内容和存储key/persistence.json)

- [final-page.png](browser-results/state-数据集迟到响应、搜索和金额显示名均使用当前内容和存储key/final-page.png)
- [test-finished-1.png](browser-results/state-数据集迟到响应、搜索和金额显示名均使用当前内容和存储key/test-finished-1.png)

## 18. 分页越界

步骤：外部模拟31条→真实同步→第3页→编辑草稿→外部变1条→页面同步→看板。

关键请求：外部fixture控制、真实feishu/sync、datasets分页GET。

页面断言：自动到第1/1页、显示唯一新任务；草稿和编辑态保留。

持久化断言：实际数据集1条；看板服务器仍原稿，证明草稿未被刷新覆盖。

[trace](browser-results/state-数据更新使当前页越界时自动校正重读，同时保留编辑草稿/trace.zip) · [页面请求](browser-results/state-数据更新使当前页越界时自动校正重读，同时保留编辑草稿/key-requests.json) · [数据库快照](browser-results/state-数据更新使当前页越界时自动校正重读，同时保留编辑草稿/persistence.json)

- [final-page.png](browser-results/state-数据更新使当前页越界时自动校正重读，同时保留编辑草稿/final-page.png)
- [test-finished-1.png](browser-results/state-数据更新使当前页越界时自动校正重读，同时保留编辑草稿/test-finished-1.png)

## 19. 冻结与重复提交

步骤：编辑标题→延迟真实保存请求→重复操作检查→放行→GET。

关键请求：dashboards延迟后continue真实请求。

页面断言：发布/取消/选择器禁用，编辑按钮不可操作。

持久化断言：仅一次真实POST；已确认标题为提交快照。

[trace](browser-results/state-保存中冻结快照且重复操作只提交一次真实请求/trace.zip) · [页面请求](browser-results/state-保存中冻结快照且重复操作只提交一次真实请求/key-requests.json) · [数据库快照](browser-results/state-保存中冻结快照且重复操作只提交一次真实请求/persistence.json)

- [final-page.png](browser-results/state-保存中冻结快照且重复操作只提交一次真实请求/final-page.png)
- [test-finished-1.png](browser-results/state-保存中冻结快照且重复操作只提交一次真实请求/test-finished-1.png)

## 20. 模板与导航

步骤：创建评论/投放模板→各自业务主体与评论处置→一般项目数据管理。

关键请求：projects、各模块真实GET。

页面断言：评论运营/情感/处置；广告消耗趋势/点击效率；URL/标签/active链接一致。

持久化断言：模板项目真实存在；一般项目数据集/看板不被导航重置。

[trace](browser-results/state-评论质检与投放分析进入各自业务主体，数据导航URL和标签一致/trace.zip) · [页面请求](browser-results/state-评论质检与投放分析进入各自业务主体，数据导航URL和标签一致/key-requests.json) · [数据库快照](browser-results/state-评论质检与投放分析进入各自业务主体，数据导航URL和标签一致/persistence.json)

- [final-page.png](browser-results/state-评论质检与投放分析进入各自业务主体，数据导航URL和标签一致/final-page.png)
- [test-finished-1.png](browser-results/state-评论质检与投放分析进入各自业务主体，数据导航URL和标签一致/test-finished-1.png)
