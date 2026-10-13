# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lifecycle.spec.ts >> 离开模块、切换项目和浏览器后退均先保护草稿
- Location: tests\browser\lifecycle.spec.ts:65:1

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary "项目主要导航" [ref=e3]:
      - link "返回项目中心" [ref=e4] [cursor=pointer]:
        - /url: /
        - text: ← 项目中心
      - generic [ref=e5]: 项目工作台
      - generic [ref=e11]:
        - generic [ref=e12]: 当前项目
        - combobox "切换项目" [ref=e15] [cursor=pointer]:
          - generic [ref=e16]: 定向返修测试
        - paragraph [ref=e20]: 品牌未设置 · 定向返修测试 · 筹备中
      - navigation "项目模块" [ref=e21]:
        - link "项目总览" [ref=e22] [cursor=pointer]:
          - /url: /projects/repro-1791912244251
          - generic [ref=e23]: "01"
        - link "数据管理" [ref=e25] [cursor=pointer]:
          - /url: /projects/repro-1791912244251/data
          - generic [ref=e26]: "02"
        - link "指标" [ref=e28] [cursor=pointer]:
          - /url: /projects/repro-1791912244251/metrics
          - generic [ref=e29]: "03"
        - link "项目设置" [ref=e31] [cursor=pointer]:
          - /url: /projects/repro-1791912244251/settings
          - generic [ref=e32]: "05"
      - generic [ref=e34]:
        - text: 项目资料已连接
        - generic [ref=e36]: 平台管理员 · 2026/10/14 01:24:04
    - main [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - text: PROJECT DASHBOARD · 通用数据工作台
            - heading "定向返修测试" [level=1] [ref=e42]
            - paragraph [ref=e43]: 综合管理部 · 结构化数据集与度量监控看板
          - button "同步最新数据" [ref=e47] [cursor=pointer]
        - region "首次设置" [ref=e51]:
          - generic [ref=e53]:
            - generic [ref=e54]: 首次设置 · 通用数据工作台
            - heading "下一步：选择团队协作或先单人试用" [level=2] [ref=e55]
            - paragraph [ref=e56]: 发布后进入日常工作界面，成员可以查看同一份结果。
          - generic [ref=e57]:
            - button "单人跳过" [ref=e58] [cursor=pointer]
            - button "完成初始化（发布项目）" [disabled] [ref=e59]
            - button "稍后配置" [ref=e60] [cursor=pointer]
          - group [ref=e61]:
            - generic "查看设置进度与团队选项" [ref=e62]
        - generic [ref=e64]:
          - generic [ref=e65]:
            - generic [ref=e66]:
              - generic [ref=e67]: "当前业务数据集:"
              - combobox "当前业务数据集" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: 任务数据B (1 行)
            - generic [ref=e73]:
              - generic [ref=e74]:
                - button "📊 看板视图" [ref=e75] [cursor=pointer]
                - button "📋 数据明细 (1 行)" [ref=e76] [cursor=pointer]
              - generic [ref=e77]:
                - button "＋ 添加卡片" [ref=e78] [cursor=pointer]
                - button "✓ 保存并发布看板" [ref=e79] [cursor=pointer]
                - button "取消编辑" [ref=e80] [cursor=pointer]
          - region "项目周期与共同筛选" [ref=e81]:
            - generic [ref=e82]:
              - generic [ref=e83]:
                - text: 开始日期
                - textbox "项目开始日期" [ref=e84]
              - generic [ref=e85]:
                - text: 结束日期
                - textbox "项目结束日期" [ref=e86]
              - generic [ref=e87]:
                - text: 共同筛选字段
                - combobox "共同筛选字段" [ref=e89] [cursor=pointer]:
                  - generic [ref=e90]: 不筛选
              - button "清除周期与筛选" [ref=e93] [cursor=pointer]
            - paragraph [ref=e94]: 发布时保存为团队默认周期与筛选。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
          - generic [ref=e95]:
            - generic [ref=e96]:
              - generic [ref=e97]: 您正在编辑看板布局。您可以添加卡片、修改指标规则、调整顺序或删除卡片。修改完成后点击「保存并发布看板」。
              - generic [ref=e98]: "版本: v2"
            - article "导航保护草稿" [ref=e100]:
              - generic [ref=e101]:
                - button "←" [disabled] [ref=e102]
                - button "→" [disabled] [ref=e103]
                - button "✏" [active] [ref=e104] [cursor=pointer]
                - button "✕" [ref=e105] [cursor=pointer]
              - generic [ref=e106]:
                - generic [ref=e107]: 导航保护草稿
                - generic [ref=e109]: "3"
              - generic [ref=e110]:
                - generic [ref=e111]: "来源: 任务数据A"
                - generic [ref=e112]: "有效样本: 3 行"
                - generic [ref=e113]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
        - generic [ref=e114]:
          - generic [ref=e116]:
            - generic [ref=e117]: AI 复盘
            - heading "基于项目数据生成运营报告" [level=3] [ref=e118]
          - generic [ref=e119]:
            - textbox "报告需求" [ref=e120]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
            - button "生成复盘报告" [ref=e121] [cursor=pointer]
    - button "打开智能助手" [ref=e122] [cursor=pointer]:
      - generic [ref=e124]: 智
  - dialog "Build Error" [ref=e126]:
    - banner [ref=e127]:
      - generic [ref=e128]: Build Error
      - generic [ref=e130]:
        - button "Copy Error Info" [ref=e131] [cursor=pointer]
        - button "Dismiss" [ref=e136] [cursor=pointer]: ×
    - generic [ref=e137]: Response body object should not be disturbed or locked
```