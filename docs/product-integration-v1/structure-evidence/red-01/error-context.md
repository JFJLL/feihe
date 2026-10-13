# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-structure.spec.ts >> 结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认
- Location: tests\browser\product-structure.spec.ts:4:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('combobox', { name: '复用项目结构', exact: true })

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - banner [ref=f1e3]:
    - link "协同 项目数据与报告协作" [ref=f1e4] [cursor=pointer]:
      - /url: /
      - generic [ref=f1e5]: 协同
      - generic [ref=f1e6]: 项目数据与报告协作
    - generic [ref=f1e8]:
      - text: 业务编辑者(张晓)
      - generic [ref=f1e9]: 公司成员
  - main [ref=f1e10]:
    - generic [ref=f1e11]:
      - generic [ref=f1e12]:
        - heading "项目中心" [level=1] [ref=f1e13]
        - paragraph [ref=f1e14]: 查看负责的工作，或为团队建立自己的数据工作台。
      - generic [ref=f1e15]:
        - button "联系平台管理员" [ref=f1e16] [cursor=pointer]
        - button "＋ 新建项目" [ref=f1e17] [cursor=pointer]
    - region "项目筛选" [ref=f1e18]:
      - generic [ref=f1e19]:
        - text: 搜索
        - textbox "搜索项目" [ref=f1e20]:
          - /placeholder: 项目、客户、负责人或说明
      - generic [ref=f1e21]:
        - text: 项目范围
        - combobox "项目范围" [ref=f1e23] [cursor=pointer]:
          - generic [ref=f1e24]: 全部可见项目
      - generic [ref=f1e27]:
        - text: 客户
        - combobox "筛选客户" [ref=f1e29] [cursor=pointer]:
          - generic [ref=f1e30]: 全部客户
      - generic [ref=f1e33]:
        - text: 部门
        - combobox "筛选部门" [ref=f1e35] [cursor=pointer]:
          - generic [ref=f1e36]: 全部部门
      - generic [ref=f1e39]:
        - text: 负责人
        - combobox "筛选负责人" [ref=f1e41] [cursor=pointer]:
          - generic [ref=f1e42]: 全部负责人
      - generic [ref=f1e45]:
        - text: 状态
        - combobox "筛选状态" [ref=f1e47] [cursor=pointer]:
          - generic [ref=f1e48]: 全部状态
    - generic [ref=f1e51]:
      - generic [ref=f1e52]: 2 个授权项目
      - group "项目显示方式" [ref=f1e53]:
        - button "项目卡片" [pressed] [ref=f1e54] [cursor=pointer]
        - button "紧凑列表" [ref=f1e55] [cursor=pointer]
    - generic [ref=f1e56]:
      - article "独立部门报告1791928041588" [ref=f1e57]:
        - generic [ref=f1e58]:
          - generic [ref=f1e59]: 筹备中
          - generic [ref=f1e60]: 通用数据工作台
        - heading "独立部门报告1791928041588" [level=2] [ref=f1e61]
        - paragraph [ref=f1e62]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e63]: 负责人：业务编辑者(张晓)
        - paragraph [ref=f1e64]: 团队数据、分析与报告工作台
        - generic [ref=f1e65]: 数据更新 2026/10/14 05:47:24
        - generic [ref=f1e66]: 首次设置未完成
        - generic [ref=f1e67]:
          - button "编辑" [ref=f1e68] [cursor=pointer]
          - button "归档" [ref=f1e69] [cursor=pointer]
          - link "继续设置 →" [ref=f1e70] [cursor=pointer]:
            - /url: /projects/1791928041588
      - article "启萃评论与声量项目" [ref=f1e71]:
        - generic [ref=f1e72]:
          - generic [ref=f1e73]: 进行中
          - generic [ref=f1e74]: 内容营销项目
        - heading "启萃评论与声量项目" [level=2] [ref=f1e75]
        - paragraph [ref=f1e76]: 内部项目 · 市场与营销部
        - paragraph [ref=f1e77]: 负责人：平台管理员
        - paragraph [ref=f1e78]: 评论执行、口碑舆情与本竞品监测
        - generic [ref=f1e79]: 待首次同步
        - link "进入工作区 →" [ref=f1e81] [cursor=pointer]:
          - /url: /projects/qicui
  - dialog [ref=f1e82]:
    - generic [ref=f1e83]:
      - banner [ref=f1e84]:
        - heading "新建项目" [level=3] [ref=f1e85]
        - button "关闭弹窗" [ref=f1e86] [cursor=pointer]: ✕
      - generic [ref=f1e88]:
        - group [ref=f1e89]:
          - generic [ref=f1e90]:
            - text: 项目名称
            - textbox "项目名称" [active] [ref=f1e91]:
              - /placeholder: 如：咨询成交分析
          - generic [ref=f1e92]:
            - text: 负责部门
            - combobox "负责部门" [ref=f1e94] [cursor=pointer]:
              - generic [ref=f1e95]: 市场与营销部
          - generic [ref=f1e98]:
            - text: 项目负责人
            - combobox "项目负责人" [ref=f1e100] [cursor=pointer]:
              - generic [ref=f1e101]: 业务编辑者(张晓)
          - generic [ref=f1e104]:
            - text: 客户或内部项目
            - combobox "客户或内部项目" [ref=f1e106] [cursor=pointer]:
              - generic [ref=f1e107]: 内部项目
          - generic [ref=f1e110]:
            - text: 业务方向
            - combobox "业务方向" [ref=f1e112] [cursor=pointer]:
              - generic [ref=f1e113]: 通用数据工作台
          - generic [ref=f1e116]:
            - strong [ref=f1e117]: 通用数据工作台
            - paragraph [ref=f1e118]: 接入任意部门表格，再按实际字段推荐指标与图表。
            - generic [ref=f1e119]: 必要字段：无固定业务字段。可选：日期、分类或渠道、数值字段。推荐：记录数、数值汇总、趋势与分组对比。
          - generic [ref=f1e120]:
            - text: 项目说明
            - textbox "项目说明" [ref=f1e121]:
              - /placeholder: 这项工作要回答什么问题，团队如何使用结果
          - group [ref=f1e122]:
            - generic "业务状态与识别色" [ref=f1e123] [cursor=pointer]
        - paragraph [ref=f1e124]: 请填写项目名称
      - contentinfo [ref=f1e125]:
        - button "取消" [ref=f1e126] [cursor=pointer]
        - button "创建项目并开启向导" [disabled] [ref=f1e127]
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';
  3  | 
  4  | test('结构复用反例：普通负责人在新建表单选择已有授权项目，看到不复制来源和真实目标的确认', async ({ page, request }, info) => {
  5  |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  6  |   await page.goto('/'); await page.getByRole('button', { name: '＋ 新建项目', exact: true }).click();
> 7  |   await page.getByRole('combobox', { name: '复用项目结构', exact: true }).click();
     |                                                                     ^ Error: locator.click: Test timeout of 60000ms exceeded.
  8  |   await expect(page.getByRole('option').filter({ hasText: '独立部门报告' })).toBeVisible();
  9  |   await info.attach('结构来源项目', { body: JSON.stringify({ projectId, actor: projectIdentity }), contentType: 'application/json' });
  10 | });
  11 | 
```