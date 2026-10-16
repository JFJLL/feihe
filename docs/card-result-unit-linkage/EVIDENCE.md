# 本轮浏览器证据

修复前6条全部失败；最终完整47条通过（新增12条，既有35条），无跳过、无重试。状态取自真实Playwright结果，不以文件存在作为通过条件。

每例的关键请求与实际持久化快照均已保存。新增12例和修复前6例的trace及截图纳入本地提交；其余35例完整trace及HTML报告保留在本地 final-verification/ 下，未纳入提交。原始失败证据与中间运行均保留。

[机器索引](EVIDENCE-INDEX.json) · [修复前报告](evidence/baseline-results.json) · [最终47例报告](evidence/final-results.json)

## before-01 字段联动 A 1280px：平均完成率切金额自动清理百分语义

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:20。

1. 新建平均值卡并选择完成率，页面预览1.0%
2. 同一弹窗通过键盘切到金额；本地计算value=15，页面却为1500.0%
3. 期望15的页面断言失败；后续加入草稿/发布步骤未执行

[关键请求](evidence/before-01/key-requests.json) · [实际持久化](evidence/before-01/persistence.json) · [Trace](evidence/before-01/trace.zip)

- [截图 final-page.png](evidence/before-01/final-page.png)
- [截图 percent-to-amount-preview.png](evidence/before-01/percent-to-amount-preview.png)
- [截图 test-failed-1.png](evidence/before-01/test-failed-1.png)

## before-02 字段联动 B 1280px：完成率字段非空数显示计数2

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:38。

1. 新建非空数或去重计数卡并选择完成率字段
2. 两行数据的计数页面显示200.0%，期望2的断言失败
3. 后续发布与刷新步骤未执行；失败页面、请求和持久化快照保留

[关键请求](evidence/before-02/key-requests.json) · [实际持久化](evidence/before-02/persistence.json) · [Trace](evidence/before-02/trace.zip)

- [截图 final-page.png](evidence/before-02/final-page.png)
- [截图 percent-field-count-preview.png](evidence/before-02/percent-field-count-preview.png)
- [截图 test-failed-1.png](evidence/before-02/test-failed-1.png)

## before-03 字段联动 B 1280px：完成率唯一值计数 (去重计数)显示计数2

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:38。

1. 新建非空数或去重计数卡并选择完成率字段
2. 两行数据的计数页面显示200.0%，期望2的断言失败
3. 后续发布与刷新步骤未执行；失败页面、请求和持久化快照保留

[关键请求](evidence/before-03/key-requests.json) · [实际持久化](evidence/before-03/persistence.json) · [Trace](evidence/before-03/trace.zip)

- [截图 final-page.png](evidence/before-03/final-page.png)
- [截图 percent-field-count-preview.png](evidence/before-03/percent-field-count-preview.png)
- [截图 test-failed-1.png](evidence/before-03/test-failed-1.png)

## before-04 字段联动 A 390px：平均完成率切金额自动清理百分语义

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:20。

1. 新建平均值卡并选择完成率，页面预览1.0%
2. 同一弹窗通过键盘切到金额；本地计算value=15，页面却为1500.0%
3. 期望15的页面断言失败；后续加入草稿/发布步骤未执行

[关键请求](evidence/before-04/key-requests.json) · [实际持久化](evidence/before-04/persistence.json) · [Trace](evidence/before-04/trace.zip)

- [截图 final-page.png](evidence/before-04/final-page.png)
- [截图 percent-to-amount-preview.png](evidence/before-04/percent-to-amount-preview.png)
- [截图 test-failed-1.png](evidence/before-04/test-failed-1.png)

## before-05 字段联动 B 390px：完成率字段非空数显示计数2

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:38。

1. 新建非空数或去重计数卡并选择完成率字段
2. 两行数据的计数页面显示200.0%，期望2的断言失败
3. 后续发布与刷新步骤未执行；失败页面、请求和持久化快照保留

[关键请求](evidence/before-05/key-requests.json) · [实际持久化](evidence/before-05/persistence.json) · [Trace](evidence/before-05/trace.zip)

- [截图 final-page.png](evidence/before-05/final-page.png)
- [截图 percent-field-count-preview.png](evidence/before-05/percent-field-count-preview.png)
- [截图 test-failed-1.png](evidence/before-05/test-failed-1.png)

## before-06 字段联动 B 390px：完成率唯一值计数 (去重计数)显示计数2

实际状态：failed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:38。

1. 新建非空数或去重计数卡并选择完成率字段
2. 两行数据的计数页面显示200.0%，期望2的断言失败
3. 后续发布与刷新步骤未执行；失败页面、请求和持久化快照保留

[关键请求](evidence/before-06/key-requests.json) · [实际持久化](evidence/before-06/persistence.json) · [Trace](evidence/before-06/trace.zip)

- [截图 final-page.png](evidence/before-06/final-page.png)
- [截图 percent-field-count-preview.png](evidence/before-06/percent-field-count-preview.png)
- [截图 test-failed-1.png](evidence/before-06/test-failed-1.png)

## after-01 字段联动 A 1280px：平均完成率切金额自动清理百分语义

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:47。

1. 新建平均值卡并选择完成率，预览1.0%
2. 键盘打开目标字段选择器并切到金额，显示15且格式普通数值、单位为空
3. 切回完成率1.0%，再切金额15
4. 加入草稿并真实发布，GET检查format/unit/percentScale/displayOrigin
5. 刷新显示15，重新编辑切回完成率1.0%，Escape返回焦点

[关键请求](evidence/after-01/key-requests.json) · [实际持久化](evidence/after-01/persistence.json) · [Trace](evidence/after-01/trace.zip)

- [截图 field-selector-keyboard.png](evidence/after-01/field-selector-keyboard.png)
- [截图 final-page.png](evidence/after-01/final-page.png)
- [截图 ordinary-amount-published.png](evidence/after-01/ordinary-amount-published.png)
- [截图 percent-to-amount-preview.png](evidence/after-01/percent-to-amount-preview.png)

## after-02 字段联动 B 1280px：完成率字段非空数显示计数2

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:83。

1. 新建字段非空数或去重计数卡，选择完成率
2. 页面结果2，格式普通数值；百分比/金额选项禁用
3. 加入草稿、真实发布并GET核对无percentScale
4. 刷新重编辑结果仍为2，检查弹窗边界及焦点

[关键请求](evidence/after-02/key-requests.json) · [实际持久化](evidence/after-02/persistence.json) · [Trace](evidence/after-02/trace.zip)

- [截图 final-page.png](evidence/after-02/final-page.png)
- [截图 percent-field-count-preview.png](evidence/after-02/percent-field-count-preview.png)

## after-03 字段联动 B 1280px：完成率唯一值计数 (去重计数)显示计数2

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:83。

1. 新建字段非空数或去重计数卡，选择完成率
2. 页面结果2，格式普通数值；百分比/金额选项禁用
3. 加入草稿、真实发布并GET核对无percentScale
4. 刷新重编辑结果仍为2，检查弹窗边界及焦点

[关键请求](evidence/after-03/key-requests.json) · [实际持久化](evidence/after-03/persistence.json) · [Trace](evidence/after-03/trace.zip)

- [截图 final-page.png](evidence/after-03/final-page.png)
- [截图 percent-field-count-preview.png](evidence/after-03/percent-field-count-preview.png)

## after-04 聚合循环 1280px：重复百分值非空3、去重2，平均与计数来回切换发布

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:105。

1. 以0.005、0.005、0.015、null真实保存数据集
2. 平均0.8% → 非空3 → 去重2 → 平均0.8%反复切换，字段保持
3. 发布去重卡并GET核对普通数值配置
4. 刷新重编辑并再次切换；GET核对原始百分值没有变换

[关键请求](evidence/after-04/key-requests.json) · [实际持久化](evidence/after-04/persistence.json) · [Trace](evidence/after-04/trace.zip)

- [截图 duplicate-count-cycle.png](evidence/after-04/duplicate-count-cycle.png)
- [截图 final-page.png](evidence/after-04/final-page.png)

## after-05 手动偏好 1280px：金额与简写偏好保留，来源名字不触发货币单位

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:127。

1. 普通金额字段平均15，无自动货币符号
2. 手动选择金额：平均¥15.00、求和¥30.00，切amount2后¥300.00/¥150.00
3. 手动简写后切回金额15，发布GET保存manual偏好
4. 刷新重编辑、求和30、非空2，仍保留兼容的compact格式

[关键请求](evidence/after-05/key-requests.json) · [实际持久化](evidence/after-05/persistence.json) · [Trace](evidence/after-05/trace.zip)

- [截图 final-page.png](evidence/after-05/final-page.png)
- [截图 manual-compatible-preference.png](evidence/after-05/manual-compatible-preference.png)

## after-06 手动百分确认 1280px：变更未知单位字段时阻止静默继承与错误发布

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:144。

1. 完成率平均1.0%，显式切普通数值再选百分比建立manual偏好
2. 切金额后提示确认，保存禁用且不展示1500.0%
3. 选普通数值恢复15，真实发布GET核对manual且无待确认

[关键请求](evidence/after-06/key-requests.json) · [实际持久化](evidence/after-06/persistence.json) · [Trace](evidence/after-06/trace.zip)

- [截图 final-page.png](evidence/after-06/final-page.png)
- [截图 manual-unit-confirmation.png](evidence/after-06/manual-unit-confirmation.png)

## after-07 字段联动 A 390px：平均完成率切金额自动清理百分语义

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:47。

1. 新建平均值卡并选择完成率，预览1.0%
2. 键盘打开目标字段选择器并切到金额，显示15且格式普通数值、单位为空
3. 切回完成率1.0%，再切金额15
4. 加入草稿并真实发布，GET检查format/unit/percentScale/displayOrigin
5. 刷新显示15，重新编辑切回完成率1.0%，Escape返回焦点

[关键请求](evidence/after-07/key-requests.json) · [实际持久化](evidence/after-07/persistence.json) · [Trace](evidence/after-07/trace.zip)

- [截图 field-selector-keyboard.png](evidence/after-07/field-selector-keyboard.png)
- [截图 final-page.png](evidence/after-07/final-page.png)
- [截图 ordinary-amount-published.png](evidence/after-07/ordinary-amount-published.png)
- [截图 percent-to-amount-preview.png](evidence/after-07/percent-to-amount-preview.png)

## after-08 字段联动 B 390px：完成率字段非空数显示计数2

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:83。

1. 新建字段非空数或去重计数卡，选择完成率
2. 页面结果2，格式普通数值；百分比/金额选项禁用
3. 加入草稿、真实发布并GET核对无percentScale
4. 刷新重编辑结果仍为2，检查弹窗边界及焦点

[关键请求](evidence/after-08/key-requests.json) · [实际持久化](evidence/after-08/persistence.json) · [Trace](evidence/after-08/trace.zip)

- [截图 final-page.png](evidence/after-08/final-page.png)
- [截图 percent-field-count-preview.png](evidence/after-08/percent-field-count-preview.png)

## after-09 字段联动 B 390px：完成率唯一值计数 (去重计数)显示计数2

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:83。

1. 新建字段非空数或去重计数卡，选择完成率
2. 页面结果2，格式普通数值；百分比/金额选项禁用
3. 加入草稿、真实发布并GET核对无percentScale
4. 刷新重编辑结果仍为2，检查弹窗边界及焦点

[关键请求](evidence/after-09/key-requests.json) · [实际持久化](evidence/after-09/persistence.json) · [Trace](evidence/after-09/trace.zip)

- [截图 final-page.png](evidence/after-09/final-page.png)
- [截图 percent-field-count-preview.png](evidence/after-09/percent-field-count-preview.png)

## after-10 聚合循环 390px：重复百分值非空3、去重2，平均与计数来回切换发布

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:105。

1. 以0.005、0.005、0.015、null真实保存数据集
2. 平均0.8% → 非空3 → 去重2 → 平均0.8%反复切换，字段保持
3. 发布去重卡并GET核对普通数值配置
4. 刷新重编辑并再次切换；GET核对原始百分值没有变换

[关键请求](evidence/after-10/key-requests.json) · [实际持久化](evidence/after-10/persistence.json) · [Trace](evidence/after-10/trace.zip)

- [截图 duplicate-count-cycle.png](evidence/after-10/duplicate-count-cycle.png)
- [截图 final-page.png](evidence/after-10/final-page.png)

## after-11 手动偏好 390px：金额与简写偏好保留，来源名字不触发货币单位

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:127。

1. 普通金额字段平均15，无自动货币符号
2. 手动选择金额：平均¥15.00、求和¥30.00，切amount2后¥300.00/¥150.00
3. 手动简写后切回金额15，发布GET保存manual偏好
4. 刷新重编辑、求和30、非空2，仍保留兼容的compact格式

[关键请求](evidence/after-11/key-requests.json) · [实际持久化](evidence/after-11/persistence.json) · [Trace](evidence/after-11/trace.zip)

- [截图 final-page.png](evidence/after-11/final-page.png)
- [截图 manual-compatible-preference.png](evidence/after-11/manual-compatible-preference.png)

## after-12 手动百分确认 390px：变更未知单位字段时阻止静默继承与错误发布

实际状态：passed。测试：feihe-mvp/tests/browser/card-display-linkage.spec.ts:144。

1. 完成率平均1.0%，显式切普通数值再选百分比建立manual偏好
2. 切金额后提示确认，保存禁用且不展示1500.0%
3. 选普通数值恢复15，真实发布GET核对manual且无待确认

[关键请求](evidence/after-12/key-requests.json) · [实际持久化](evidence/after-12/persistence.json) · [Trace](evidence/after-12/trace.zip)

- [截图 final-page.png](evidence/after-12/final-page.png)
- [截图 manual-unit-confirmation.png](evidence/after-12/manual-unit-confirmation.png)

## 打开trace

从 feihe-mvp 执行：

```powershell
node node_modules/@playwright/test/cli.js show-trace ../docs/card-result-unit-linkage/evidence/after-01/trace.zip
```
