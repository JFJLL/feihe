# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-components.spec.ts >> 日报组件 390px：真实400消耗与加权CTR，单独选择日报区块，空布局刷新与恢复完整图表
- Location: tests\browser\product-components.spec.ts:59:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: '分日 · 日报监控看板', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary "项目主要导航" [ref=e3]:
    - link "返回项目中心" [ref=e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=e5]: 项目工作台
    - combobox "切换项目" [ref=e14] [cursor=pointer]:
      - generic [ref=e15]: 启萃评论与声量项目
    - navigation "项目模块" [ref=e19]:
      - link "项目总览" [ref=e20] [cursor=pointer]:
        - /url: /projects/qicui
      - link "数据管理" [ref=e22] [cursor=pointer]:
        - /url: /projects/qicui/data
      - link "竞品分析" [ref=e24] [cursor=pointer]:
        - /url: /projects/qicui/growth
      - link "指标" [ref=e26] [cursor=pointer]:
        - /url: /projects/qicui/metrics
      - link "内容管理" [ref=e28] [cursor=pointer]:
        - /url: /projects/qicui/content
      - link "评论运营" [ref=e30] [cursor=pointer]:
        - /url: /projects/qicui/comments
      - link "报告" [ref=e32] [cursor=pointer]:
        - /url: /projects/qicui/reports
      - link "项目设置" [ref=e34] [cursor=pointer]:
        - /url: /projects/qicui/settings
  - main [ref=e36]:
    - generic [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - text: FEIHE · Q3 DASHBOARD
          - heading "启萃评论与声量项目" [level=1] [ref=e41]
          - paragraph [ref=e42]: 2026年 Q3 · 小红书种草与电商引流 · 项目数据看板
        - generic [ref=e44]:
          - generic [ref=e45]: 投放截至 2026-09-30
          - generic [ref=e46]:
            - button "同步异常 · 重试" [ref=e47] [cursor=pointer]
            - alert [ref=e51]:
              - generic [ref=e53]: 已核对 4/25 张工作表，内容无变化；投放数据截至 2026-09-30；部分同步失败，请查看数据来源明细
      - navigation "模块切换" [ref=e55]:
        - button "总览 · Q3累计全盘 决策摘要、月度进度、投流效率与内容复盘" [pressed] [ref=e56] [cursor=pointer]:
          - generic [aria-hidden] [ref=e57]: 📊
          - generic [ref=e58]:
            - strong [ref=e60]: 总览 · Q3累计全盘
            - generic [ref=e61]: 决策摘要、月度进度、投流效率与内容复盘
        - button "分日 · 日报监控看板 日期切换、8大核心指标与近30天趋势" [ref=e62] [cursor=pointer]:
          - generic [aria-hidden] [ref=e63]: 📅
          - generic [ref=e64]:
            - strong [ref=e66]: 分日 · 日报监控看板
            - generic [ref=e67]: 日期切换、8大核心指标与近30天趋势
      - group [ref=e68]:
        - generic "数据来源与多工作表溯源明细 · 部分读取失败 最近核对 2026/10/14 09:11:58" [ref=e69] [cursor=pointer]:
          - text: 数据来源与多工作表溯源明细 · 部分读取失败
          - generic [ref=e70]: 最近核对 2026/10/14 09:11:58
      - generic [ref=e71]:
        - generic [ref=e72]:
          - paragraph [ref=e73]: 业务分析截至 2026-09-30，沿用现有日报与季度口径。下方项目指标使用各自已标明的周期与筛选。
          - button "配置业务组件布局" [ref=e74] [cursor=pointer]
        - generic [ref=e75]:
          - generic [ref=e76]:
            - generic [ref=e77]:
              - generic [ref=e78]: 决策层 · 今日指标与待办
              - generic [ref=e79]: 投放 2026-09-30 · 笔记 2026-09-30
            - generic [ref=e80]:
              - generic [ref=e81]:
                - generic [ref=e82]: 80%
                - generic [ref=e83]: 当日计划达成率
                - generic [ref=e84]: 实际消耗 / 已填计划
              - generic [ref=e85]:
                - generic [ref=e86]:
                  - strong [ref=e88]: 消耗节奏
                  - generic [ref=e89]: ¥400
                  - generic [ref=e90]: 当日计划 ¥500
                - generic [ref=e91]:
                  - strong [ref=e93]: 信息流 CTR
                  - generic [ref=e94]: 2%
                  - generic [ref=e95]: 点击合计 / 展现合计
                - generic [ref=e96]:
                  - strong [ref=e98]: 搜索 CTR
                  - generic [ref=e99]: 3%
                  - generic [ref=e100]: 搜索广告实际点击效率
                - generic [ref=e101]:
                  - strong [ref=e103]: 待处置风险
                  - generic [ref=e104]: 0 条
                  - generic [ref=e105]: 待回复 0 · 待删除 0
            - generic [ref=e106]:
              - strong [ref=e108]: Executive Summary · 关键数据摘要
              - list [ref=e109]:
                - listitem [ref=e110]:
                  - generic [ref=e111]: 消耗
                  - generic [ref=e112]: 2026-09-30 实际投放 ¥400，当日计划 ¥500，达成率 80%。
                - listitem [ref=e113]:
                  - generic [ref=e114]: 效率
                  - generic [ref=e115]: 信息流 CTR 2%，搜索 CTR 3%；按聚光展现、点击加权计算。
                - listitem [ref=e116]:
                  - generic [ref=e117]: 内容
                  - generic [ref=e118]: 项目已收录 3 篇笔记，累计阅读 9万 次，互动 600 次。
                - listitem [ref=e119]:
                  - generic [ref=e120]: 行动
                  - generic [ref=e121]: 有 0 条风险评论待处理，其中待回复 0 条、待删除 0 条。
          - generic [ref=e122]:
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]: 预算节奏
                - heading "预算消耗节奏对比" [level=3] [ref=e126]
              - generic [ref=e127]: 当月进度与季度全盘
            - generic [ref=e128]:
              - generic [ref=e129]:
                - strong [ref=e131]: 9月当月 · 截至9月30日
                - generic [ref=e132]:
                  - generic [ref=e133]:
                    - generic [ref=e134]: 时间进度（30/30 天）
                    - strong [ref=e135]: 100%
                  - progressbar "时间进度（30/30 天）" [ref=e136]
                - generic [ref=e138]:
                  - generic [ref=e139]:
                    - generic [ref=e140]: 同日期 · 消耗 / 计划
                    - strong [ref=e141]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=e142]
                  - generic [ref=e144]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=e145]:
                  - generic [ref=e146]: ¥700
                  - generic [ref=e147]: 覆盖 2 个有投放数据的日期
              - generic [ref=e148]:
                - strong [ref=e150]: Q3 累计 · 7月1日—9月30日
                - generic [ref=e151]:
                  - generic [ref=e152]:
                    - generic [ref=e153]: 时间进度（92/92 天）
                    - strong [ref=e154]: 100%
                  - progressbar "时间进度（92/92 天）" [ref=e155]
                - generic [ref=e157]:
                  - generic [ref=e158]:
                    - generic [ref=e159]: 同日期 · 消耗 / 计划
                    - strong [ref=e160]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=e161]
                  - generic [ref=e163]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=e164]:
                  - generic [ref=e165]: ¥700
                  - generic [ref=e166]: 覆盖 2 个有投放数据的日期
            - generic [ref=e167]: 计划为已填日期的预算合计，并非完整月度或季度预算。时间进度按自然日计算。
          - generic [ref=e168]:
            - generic [ref=e169]:
              - generic [ref=e170]:
                - generic [ref=e171]: 一、投流效率
                - heading "KFS 投流与采买结构" [level=3] [ref=e172]
              - generic [ref=e173]: 投流与达人采买分开展示
            - generic [ref=e174]:
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - generic [ref=e177]:
                    - strong [ref=e178]: 信息流 / 搜索投流结构
                    - generic [ref=e179]: Q3 已同步日期
                  - generic [ref=e180]:
                    - generic [ref=e182]:
                      - generic [ref=e183]: 信息流 F
                      - generic [ref=e184]:
                        - generic [ref=e185]: ¥250
                        - strong [ref=e186]: 35.7%
                    - generic [ref=e190]:
                      - generic [ref=e191]: 搜索 S
                      - generic [ref=e192]:
                        - generic [ref=e193]: ¥450
                        - strong [ref=e194]: 64.3%
                - generic [ref=e197]:
                  - generic [ref=e198]:
                    - strong [ref=e199]: 达人 K · 内容采买
                    - generic [ref=e200]: 项目笔记报价合计
                  - generic [ref=e201]: ¥6000
                  - generic [ref=e202]:
                    - generic [ref=e203]:
                      - text: 商业合作笔记
                      - strong [ref=e204]: 3 篇
                    - generic [ref=e205]:
                      - text: 内容平均 CPE
                      - strong [ref=e206]: ¥10
                  - paragraph [ref=e207]: 使用笔记库已有报价与互动表现；采买费用与投流消耗为不同口径。
              - generic [ref=e208]:
                - generic [ref=e209]:
                  - strong [ref=e210]: KFS 分渠道消耗趋势（堆叠面积）
                  - generic [ref=e211]: 近 2 个数据日 · 信息流 F + 搜索 S
                - generic [ref=e213]:
                  - generic [ref=e214]:
                    - generic [ref=e215]: 信息流 F
                    - generic [ref=e218]: 搜索 S
                  - img [ref=e221]:
                    - generic [ref=e222]: ¥0.0w
                    - generic [ref=e224]: ¥0.0w
                    - generic [ref=e226]: ¥0.0w
                    - generic [ref=e228]: ¥0.0w
                    - generic [ref=e234]: 09-29
                    - generic [ref=e235]: 09-30
          - generic [ref=e238]:
            - generic [ref=e239]:
              - generic [ref=e240]:
                - generic [ref=e241]: 二、内容产出
                - heading "种草发布与切角渗透" [level=3] [ref=e242]
              - generic [ref=e243]: 当前项目累计笔记库
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]: 种草笔记总数
                - generic [ref=e247]:
                  - text: "3"
                  - generic [ref=e248]: 篇
                - generic [ref=e249]: 已发布 3 篇
              - generic [ref=e250]:
                - generic [ref=e251]: 累计内容阅读
                - generic [ref=e252]:
                  - text: 9万
                  - generic [ref=e253]: 次
                - generic [ref=e254]: 累计曝光 36万 次
              - generic [ref=e255]:
                - generic [ref=e256]: 累计内容互动
                - generic [ref=e257]:
                  - text: "600"
                  - generic [ref=e258]: 次
                - generic [ref=e259]: 项目发布目标 未设置
            - generic [ref=e260]:
              - generic [ref=e261]:
                - generic [ref=e262]:
                  - strong [ref=e263]: 达人量级结构分布
                  - generic [ref=e264]: 3 篇已收录笔记
                - generic [ref=e265]:
                  - generic [ref=e266]:
                    - img [ref=e267]:
                      - generic [ref=e269] [cursor=pointer]
                      - generic [ref=e270] [cursor=pointer]
                    - generic:
                      - generic: "3"
                      - generic: 总篇数
                  - generic [ref=e271]:
                    - generic [ref=e272] [cursor=pointer]:
                      - generic [ref=e273]: 腰部
                      - generic [ref=e276]:
                        - generic [ref=e277]: 2篇
                        - generic [ref=e278]: (66.7%)
                    - generic [ref=e279] [cursor=pointer]:
                      - generic [ref=e280]: 头部
                      - generic [ref=e283]:
                        - generic [ref=e284]: 1篇
                        - generic [ref=e285]: (33.3%)
              - generic [ref=e286]:
                - generic [ref=e287]:
                  - strong [ref=e288]: 内容形式分布
                  - generic [ref=e289]: 已收录笔记
                - generic "点击查看「图文」相关笔记" [ref=e291] [cursor=pointer]:
                  - generic [ref=e292]:
                    - generic [ref=e293]: 图文
                    - generic [ref=e294]:
                      - generic [ref=e295]: 3 篇 · 600 互动
                      - strong [ref=e296]: 100.0%
            - generic [ref=e299]:
              - generic [ref=e300]:
                - generic [ref=e301]:
                  - strong [ref=e302]: 达人层级采买金额分布
                  - generic [ref=e303]: 项目全量笔记报价分布
                - generic [ref=e304]:
                  - generic [ref=e306] [cursor=pointer]:
                    - generic [ref=e307]: 腰部
                    - generic [ref=e308]:
                      - generic [ref=e309]: 2 篇
                      - strong [ref=e310]: ¥0.5w
                      - generic [ref=e311]: 83.3%
                  - generic [ref=e315] [cursor=pointer]:
                    - generic [ref=e316]: 头部
                    - generic [ref=e317]:
                      - generic [ref=e318]: 1 篇
                      - strong [ref=e319]: ¥0.1w
                      - generic [ref=e320]: 16.7%
                  - generic [ref=e323]: 采买总金额 ¥0.6w · 基于笔记库已填报价
              - generic [ref=e324]:
                - generic [ref=e325]:
                  - strong [ref=e326]: 内容切角 / 场景渗透
                  - generic [ref=e327]: TOP 8 方向笔记与互动
                - table [ref=e329]:
                  - rowgroup [ref=e330]:
                    - row [ref=e331]:
                      - columnheader "切角 / 场景" [ref=e332]
                      - columnheader "篇数" [ref=e333]
                      - columnheader "阅读" [ref=e334]
                      - columnheader "互动" [ref=e335]
                      - columnheader "分布" [ref=e336]
                  - rowgroup [ref=e337]:
                    - row [ref=e338] [cursor=pointer]:
                      - cell "生活场景 查看笔记 ↗" [ref=e339]:
                        - generic [ref=e340]:
                          - generic [ref=e341]: 生活场景
                          - generic [ref=e342]: 查看笔记 ↗
                      - cell "2" [ref=e343]
                      - cell "7万" [ref=e344]
                      - cell "500" [ref=e345]
                      - cell [ref=e346]:
                        - generic [ref=e347]:
                          - strong [ref=e349]: 66.67%
                          - progressbar [ref=e350]
                    - row [ref=e352] [cursor=pointer]:
                      - cell "产品科普 查看笔记 ↗" [ref=e353]:
                        - generic [ref=e354]:
                          - generic [ref=e355]: 产品科普
                          - generic [ref=e356]: 查看笔记 ↗
                      - cell "1" [ref=e357]
                      - cell "2万" [ref=e358]
                      - cell "100" [ref=e359]
                      - cell [ref=e360]:
                        - generic [ref=e361]:
                          - strong [ref=e363]: 33.33%
                          - progressbar [ref=e364]
          - generic [ref=e366]:
            - generic [ref=e367]:
              - generic [ref=e368]:
                - generic [ref=e369]: 三、内容效果
                - heading "内容效果深度分析" [level=3] [ref=e370]
              - generic [ref=e371]: 散点矩阵 · 分布直方图 · 箱线图
            - generic [ref=e372]:
              - generic [ref=e373]:
                - generic [ref=e374]:
                  - strong [ref=e375]: 笔记阅读与互动效果（散点图）
                  - generic [ref=e376]: X=阅读量 Y=互动量 · 3篇完整记录（含零值）· 点大小=采集评论数
                - generic [ref=e377]:
                  - text: 内容方向
                  - combobox "散点图内容方向" [ref=e379] [cursor=pointer]:
                    - generic [ref=e380]: 全部方向
                - img [ref=e384]:
                  - generic [ref=e385]: "0"
                  - generic [ref=e387]: "83"
                  - generic [ref=e389]: "165"
                  - generic [ref=e391]: "248"
                  - generic [ref=e393]: "330"
                  - generic [ref=e395]: "0"
                  - generic [ref=e397]: 1.1w
                  - generic [ref=e399]: 2.2w
                  - generic [ref=e401]: 3.3w
                  - generic [ref=e403]: 4.4w
                  - generic [ref=e405]: 阅读量
                  - generic [ref=e406]: 互动量
                  - generic [ref=e407] [cursor=pointer]
                  - generic [ref=e408] [cursor=pointer]
                  - generic [ref=e409] [cursor=pointer]
              - generic [ref=e410]:
                - generic [ref=e411]:
                  - strong [ref=e412]: 笔记阅读量分布直方图
                  - generic [ref=e413]: 3 篇有阅读数据的笔记
                - generic [ref=e415]:
                  - text: 已记录阅读量最多的区间：
                  - strong [ref=e416]: 1万–5万
                - img [ref=e419]:
                  - generic [ref=e420]: "0"
                  - generic [ref=e422]: "1"
                  - generic [ref=e424]: "2"
                  - generic [ref=e426]: "2"
                  - generic [ref=e428]: "3"
                  - generic [ref=e430] [cursor=pointer]: 0–1千
                  - generic [ref=e432] [cursor=pointer]: 1千–5千
                  - generic [ref=e434] [cursor=pointer]: 5千–1万
                  - generic [ref=e436] [cursor=pointer]: 1万–5万
                  - generic [ref=e439] [cursor=pointer]: 5万–10万
                  - generic [ref=e441] [cursor=pointer]: 10万–50万
                  - generic [ref=e443] [cursor=pointer]: 50万及以上
            - generic [ref=e445]:
              - generic [ref=e446]:
                - strong [ref=e447]: 达人层级互动量箱线图
                - generic [ref=e448]: 各层级已记录互动量分布（含零值，缺失不参与）
              - generic [ref=e449]:
                - generic [ref=e450]:
                  - generic [ref=e451]: 悬停、点击或用 Tab 聚焦层级，查看样本数与五项分布值
                  - button "当前：主体分布（常规范围）" [ref=e452] [cursor=pointer]
                - img [ref=e453]:
                  - generic [ref=e454]: "0"
                  - generic [ref=e456]: "3500"
                  - generic [ref=e458]: "7000"
                  - generic [ref=e460]: 1.1w
                  - generic [ref=e462]: 1.4w
                  - button "腰部，2 篇，中位数 250 互动" [ref=e464] [cursor=pointer]:
                    - generic [ref=e467]: 腰部
                    - generic [ref=e468]: n=2
                  - button "头部，1 篇，中位数 100 互动" [ref=e469] [cursor=pointer]:
                    - generic [ref=e472]: 头部
                    - generic [ref=e473]: n=1
          - generic [ref=e475]:
            - generic [ref=e477]:
              - generic [ref=e478]: TARGET VS ACTUAL
              - heading "KPI目标与实际" [level=3] [ref=e479]
              - generic [ref=e480]: 选择同一周期、代理、项目和渠道进行比较；总计与明细分别查看。
            - generic [ref=e481]:
              - generic [ref=e482]: ∅
              - heading "等待 KPI 数据" [level=3] [ref=e483]
              - paragraph [ref=e484]: 同步飞书数据后查看目标、实际和差额。
          - generic [ref=e485]:
            - generic [ref=e486]:
              - generic [ref=e487]:
                - generic [ref=e488]: 五、爆文排行
                - heading "高热内容 TOP20 排行榜" [level=3] [ref=e489]
              - generic [ref=e490]: 项目全量笔记按互动量排序
            - table [ref=e492]:
              - rowgroup [ref=e493]:
                - row [ref=e494]:
                  - columnheader "#" [ref=e495]
                  - columnheader "笔记标题" [ref=e496]
                  - columnheader "达人" [ref=e497]
                  - columnheader "内容方向" [ref=e498]
                  - columnheader "阅读量" [ref=e499]
                  - columnheader "互动量" [ref=e500]
                  - columnheader "评论数" [ref=e501]
                  - columnheader "互动率" [ref=e502]
              - rowgroup [ref=e503]:
                - row [ref=e504] [cursor=pointer]:
                  - cell [ref=e505]:
                    - strong [ref=e506]: "1"
                  - cell "受控启萃内容丙" [ref=e507]
                  - cell "受控达人2" [ref=e508]
                  - cell "生活场景" [ref=e509]
                  - cell "4万" [ref=e510]
                  - cell [ref=e511]:
                    - strong [ref=e512]: "300"
                  - cell "0" [ref=e513]
                  - cell "0.75%" [ref=e514]
                - row [ref=e515] [cursor=pointer]:
                  - cell [ref=e516]:
                    - strong [ref=e517]: "2"
                  - cell "受控启萃内容乙" [ref=e518]
                  - cell "受控达人1" [ref=e519]
                  - cell "生活场景" [ref=e520]
                  - cell "3万" [ref=e521]
                  - cell [ref=e522]:
                    - strong [ref=e523]: "200"
                  - cell "0" [ref=e524]
                  - cell "0.67%" [ref=e525]
                - row [ref=e526] [cursor=pointer]:
                  - cell [ref=e527]:
                    - strong [ref=e528]: "3"
                  - cell "受控启萃内容甲" [ref=e529]
                  - cell "受控达人0" [ref=e530]
                  - cell "产品科普" [ref=e531]
                  - cell "2万" [ref=e532]
                  - cell [ref=e533]:
                    - strong [ref=e534]: "100"
                  - cell "0" [ref=e535]
                  - cell "0.50%" [ref=e536]
          - generic [ref=e537]:
            - generic [ref=e538]:
              - generic [ref=e539]:
                - generic [ref=e540]:
                  - generic [ref=e541]:
                    - generic [ref=e542]: 数据覆盖
                    - heading "内容数据与待办" [level=3] [ref=e543]
                  - generic [ref=e544]: 真实记录覆盖情况
                - generic [ref=e545]:
                  - generic [ref=e546]:
                    - text: 当前项目笔记
                    - generic [ref=e547]:
                      - strong [ref=e548]: "3"
                      - text: 篇
                  - generic [ref=e549]:
                    - text: 已记录阅读量
                    - generic [ref=e550]:
                      - strong [ref=e551]: "3"
                      - text: 篇（含零值）
                  - generic [ref=e552]:
                    - text: 阅读和互动均有记录
                    - generic [ref=e553]:
                      - strong [ref=e554]: "3"
                      - text: 篇
                  - generic [ref=e555]:
                    - text: 风险待处理
                    - generic [ref=e556]:
                      - strong [ref=e557]: "0"
                      - text: 条
                - paragraph [ref=e558]: 分布图覆盖当前项目全部已收录笔记；评论来自采集快照，不串联为用户转化漏斗。内容最新有效日期：2026-09-30。
                - link "查看风险待办 →" [ref=e559] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
              - generic [ref=e560]:
                - generic [ref=e561]:
                  - generic [ref=e562]:
                    - generic [ref=e563]: 字段覆盖
                    - heading "内容分析还缺哪些数据" [level=3] [ref=e564]
                  - generic [ref=e565]: 按全量笔记核对
                - generic [ref=e566]:
                  - generic [ref=e568]:
                    - generic [ref=e569]: 内容方向
                    - generic [ref=e570]:
                      - generic [ref=e571]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e572]: 100.0%
                  - generic [ref=e576]:
                    - generic [ref=e577]: 达人层级
                    - generic [ref=e578]:
                      - generic [ref=e579]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e580]: 100.0%
                  - generic [ref=e584]:
                    - generic [ref=e585]: 阅读量
                    - generic [ref=e586]:
                      - generic [ref=e587]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e588]: 100.0%
                  - generic [ref=e592]:
                    - generic [ref=e593]: 互动量
                    - generic [ref=e594]:
                      - generic [ref=e595]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e596]: 100.0%
                - paragraph [ref=e599]: 方向缺失的笔记仍计入阅读和互动总量；不参与已标注方向的效果判断。
            - generic [ref=e600]:
              - generic [ref=e601]:
                - generic [ref=e602]:
                  - generic [ref=e603]: 达人效率
                  - heading "达人层级效率排行榜" [level=3] [ref=e604]
                - generic [ref=e605]: 按篇均CPE升序，缺失排末尾
              - generic [ref=e606]:
                - generic "点击查看该层级笔记" [ref=e607] [cursor=pointer]:
                  - generic [ref=e608]:
                    - generic [ref=e609]:
                      - generic [ref=e610]: "1"
                      - strong [ref=e611]: 腰部
                    - generic [ref=e612]: 篇均CPE ¥10.00
                  - generic [ref=e613]:
                    - generic [ref=e614]:
                      - text: 笔记数
                      - strong [ref=e615]: "2"
                    - generic [ref=e616]:
                      - text: 均阅读
                      - strong [ref=e617]: 3.5万
                    - generic [ref=e618]:
                      - text: 均互动
                      - strong [ref=e619]: "250"
                    - generic [ref=e620]:
                      - text: 均CPE
                      - strong [ref=e621]: ¥10.0
                - generic "点击查看该层级笔记" [ref=e622] [cursor=pointer]:
                  - generic [ref=e623]:
                    - generic [ref=e624]:
                      - generic [ref=e625]: "2"
                      - strong [ref=e626]: 头部
                    - generic [ref=e627]: 篇均CPE ¥10.00
                  - generic [ref=e628]:
                    - generic [ref=e629]:
                      - text: 笔记数
                      - strong [ref=e630]: "1"
                    - generic [ref=e631]:
                      - text: 均阅读
                      - strong [ref=e632]: 2万
                    - generic [ref=e633]:
                      - text: 均互动
                      - strong [ref=e634]: "100"
                    - generic [ref=e635]:
                      - text: 均CPE
                      - strong [ref=e636]: ¥10.0
          - generic [ref=e637]:
            - generic [ref=e638]:
              - generic [ref=e639]:
                - generic [ref=e640]: 互动质量
                - heading "已记录点赞、收藏与分享构成" [level=3] [ref=e641]
              - generic [ref=e642]: 比例仅在三项已记录指标中计算
            - generic [ref=e643]:
              - generic [ref=e645]:
                - generic [ref=e647]:
                  - generic [ref=e648]:
                    - generic [ref=e649]: ♥
                    - generic [ref=e650]: 点赞
                  - generic [ref=e651]:
                    - text: "420"
                    - generic [ref=e652]: 70.0%
                - generic [ref=e656]:
                  - generic [ref=e657]:
                    - generic [ref=e658]: ★
                    - generic [ref=e659]: 收藏
                  - generic [ref=e660]:
                    - text: "120"
                    - generic [ref=e661]: 20.0%
                - generic [ref=e665]:
                  - generic [ref=e666]:
                    - generic [ref=e667]: ↗
                    - generic [ref=e668]: 分享
                  - generic [ref=e669]:
                    - text: "60"
                    - generic [ref=e670]: 10.0%
              - generic [ref=e673]:
                - generic [ref=e674]: 互动质量洞察
                - generic [ref=e675]:
                  - generic [ref=e676]:
                    - generic [ref=e677]: 点赞占比
                    - generic [ref=e678]: 70.0%
                    - generic [ref=e679]: 浅层互动，反映内容吸引力
                  - generic [ref=e680]:
                    - generic [ref=e681]: 收藏占比
                    - generic [ref=e682]: 20.0%
                    - generic [ref=e683]: 深度互动，反映内容价值密度
                  - generic [ref=e684]:
                    - generic [ref=e685]: 分享占比
                    - generic [ref=e686]: 10.0%
                    - generic [ref=e687]: 采集评论单独查看，不计入此构成
          - generic [ref=e688]:
            - generic [ref=e689]:
              - generic [ref=e690]:
                - generic [ref=e691]: 行动层
                - heading "复盘洞察与下一步行动" [level=3] [ref=e692]
              - generic [ref=e693]: 从数据直接进入运营
            - generic [ref=e694]:
              - generic [ref=e695]:
                - strong [ref=e696]: 当前观察
                - paragraph [ref=e697]: 内容库共 3 篇，累计互动 600 次。已标注的内容方向中，生活场景收录最多。
                - paragraph [ref=e698]: 当前真实评论快照合计 0 条，正向 0 条，负向 0 条。继续优先处理待回复和待删除事项。
              - generic [ref=e699]:
                - link "处理 0 条风险待办 达人回复与删除处置 去处理 →" [ref=e700] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
                  - generic [ref=e701]:
                    - strong [ref=e702]: 处理 0 条风险待办
                    - generic [ref=e703]: 达人回复与删除处置
                  - generic [ref=e704]: 去处理 →
                - link "复盘高热内容与切角 阅读、互动与达人效率 看内容 →" [ref=e705] [cursor=pointer]:
                  - /url: /projects/qicui/content?tab=analysis
                  - generic [ref=e706]:
                    - strong [ref=e707]: 复盘高热内容与切角
                    - generic [ref=e708]: 阅读、互动与达人效率
                  - generic [ref=e709]: 看内容 →
                - link "对照竞品月报与搜索趋势 使用已接入的品牌工作表 看竞品 →" [ref=e710] [cursor=pointer]:
                  - /url: /projects/qicui/growth?tab=competitor
                  - generic [ref=e711]:
                    - strong [ref=e712]: 对照竞品月报与搜索趋势
                    - generic [ref=e713]: 使用已接入的品牌工作表
                  - generic [ref=e714]: 看竞品 →
          - group [ref=e715]:
            - generic "查看指标定义与口径说明" [ref=e716]
      - generic [ref=e717]:
        - generic [ref=e719]:
          - generic [ref=e720]: 团队看板
          - heading "项目指标与图表" [level=3] [ref=e721]
        - generic [ref=e722]:
          - generic [ref=e723]:
            - generic [ref=e724]:
              - generic [ref=e725]: "当前业务数据集:"
              - combobox "当前业务数据集" [ref=e727] [cursor=pointer]:
                - generic [ref=e728]: 补修数据 (2 行)
            - generic [ref=e731]:
              - generic [ref=e732]:
                - button "📊 看板视图" [ref=e733] [cursor=pointer]
                - button "📋 数据明细 (2 行)" [ref=e734] [cursor=pointer]
              - link "查看项目报告" [ref=e735] [cursor=pointer]:
                - /url: /projects/qicui/reports?query=%7B%7D
              - button "⚙ 自定义看板卡片" [ref=e736] [cursor=pointer]
          - region "项目周期与共同筛选" [ref=e737]:
            - generic [ref=e738]:
              - generic [ref=e739]:
                - text: 开始日期
                - textbox "项目开始日期" [ref=e740]
              - generic [ref=e741]:
                - text: 结束日期
                - textbox "项目结束日期" [ref=e742]
              - generic [ref=e743]:
                - text: 共同筛选字段
                - combobox "共同筛选字段" [ref=e745] [cursor=pointer]:
                  - generic [ref=e746]: 不筛选
              - button "清除周期与筛选" [ref=e749] [cursor=pointer]
            - paragraph [ref=e750]: 当前查看范围；配置者可在编辑看板时发布团队默认范围。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
          - article "组件场景独立记录1791940244635" [ref=e753]:
            - generic [ref=e754]:
              - generic [ref=e755]: 组件场景独立记录1791940244635
              - generic [ref=e757]: "2"
            - generic [ref=e758]:
              - generic [ref=e759]: "来源: 补修数据"
              - generic [ref=e760]: 指标 v1 · 跟随最新 · 数据 v1
              - generic [ref=e761]: "有效样本: 2 行"
              - generic [ref=e762]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
      - generic [ref=e763]:
        - generic [ref=e765]:
          - generic [ref=e766]: AI 复盘
          - heading "基于项目数据生成运营报告" [level=3] [ref=e767]
        - generic [ref=e768]:
          - textbox "报告需求" [ref=e769]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
          - button "生成复盘报告" [ref=e770] [cursor=pointer]
  - button "打开智能助手" [ref=e771] [cursor=pointer]:
    - generic [ref=e773]: 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { DEFAULT_BUSINESS_COMPONENTS } from '../../lib/business-components';
  3  | import type { Page, APIRequestContext } from '@playwright/test';
  4  | import { connectExistingProjectTable, dismissProjectNotifications } from './product-journey';
  5  | test('启萃组件反例：真实页面有权用户能打开既有复杂图表的团队布局编辑入口', async ({ page }, info) => {
  6  |   await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-admin' }); await page.goto('/projects/qicui');
  7  |   await expect(page.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible();
  8  |   await page.screenshot({ path: info.outputPath('qicui-components-before.png'), fullPage: true });
  9  |   await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click();
  10 |   await expect(page.getByRole('dialog', { name: '团队业务组件布局', exact: true })).toBeVisible();
  11 | });
  12 | const editor = { 'x-user-id': 'user-editor' }, platform = { 'x-user-id': 'user-admin' };
  13 | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  14 | function cells(values: Record<number, unknown>, size: number) { const row = Array(size).fill(null); for (const [index, value] of Object.entries(values)) row[Number(index)] = value; return row; }
  15 | function historicalSheets() {
  16 |   const ids = ['aaaaaaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaaaaaaaaaa3'];
  17 |   const notes = ids.map((id, i) => cells({ 3: '2026-09-30', 4: '受控达人' + i, 6: (i + 1) * 10000, 8: '受控启萃内容' + ['甲', '乙', '丙'][i], 9: 'https://www.xiaohongshu.com/explore/' + id, 10: '图文', 11: i === 0 ? '2026-09-29' : '2026-09-30', 13: id, 19: (i + 1) * 1000, 23: (i + 1) * 60000, 24: (i + 2) * 10000, 31: (i + 1) * 100, 33: (i + 1) * 70, 34: (i + 1) * 20, 36: (i + 1) * 10 }, 40));
  18 |   const creators = ids.map((id, i) => cells({ 3: '受控达人' + i, 4: i === 0 ? '2026-09-29' : '2026-09-30', 5: 'https://www.xiaohongshu.com/explore/' + id, 6: id, 7: i === 0 ? '头部' : '腰部', 9: '图文', 16: '受控启萃内容' + ['甲', '乙', '丙'][i], 17: i === 0 ? '产品科普' : '生活场景', 18: '受控切角' }, 20));
  19 |   const adHeader = cells({ 9: '时间', 15: '消费' }, 43);
  20 |   const ads = [cells({ 9: '2026-09-29', 10: '信息流', 15: 100, 16: 1000, 17: 10, 26: 5 }, 43), cells({ 9: '2026-09-29', 10: '搜索', 15: 200, 16: 2000, 17: 30, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '信息流', 15: 150, 16: 1000, 17: 20, 26: 10 }, 43), cells({ 9: '2026-09-30', 10: '搜索', 15: 250, 16: 2000, 17: 60, 26: 20 }, 43)];
  21 |   return { '3Wsban': [Array(40).fill('字段'), ...notes], '4bTvDu': [Array(20).fill('字段'), ...creators], '1XSPsH': [adHeader, ...ads], 'kMYs9o': [Array(40).fill(null), cells({ 15: '信息流' }, 40), cells({ 1: '2026-09-29', 7: 400, 15: 100, 18: 200, 20: 0.7, 32: 0.5 }, 40), cells({ 1: '2026-09-30', 7: 500, 15: 150, 18: 250, 20: 0.8, 32: 0.6 }, 40)] };
  22 | }
  23 | async function prepare(page: Page, request: APIRequestContext) {
  24 |   expect((await request.post('/api/projects', { headers: platform, data: { action: 'add_member', projectId: 'qicui', userId: 'user-editor', role: 'project_admin' } })).status()).toBe(200);
  25 |   await page.context().setExtraHTTPHeaders(editor);
  26 |   const base = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect((await request.post('/api/dashboards', { headers: editor, data: { action: 'set_components', projectId: 'qicui', version: base.dashboards[0].version, components: DEFAULT_BUSINESS_COMPONENTS } })).status()).toBe(200);
  27 |   expect((await request.post(vendor + '/__fixture/legacy-sheets', { data: { sheets: historicalSheets() } })).status()).toBe(200);
  28 |   await page.goto('/projects/qicui'); const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST'); await page.getByRole('button', { name: '同步最新数据', exact: true }).click(); const response = await synced; expect(response.status()).toBe(200); const result = await response.json(); expect(result.actorUserId).toBe('user-editor');
  29 |   for (const sheetId of Object.keys(historicalSheets())) expect(result.reports.find((report: { sheetId: string }) => report.sheetId === sheetId).status).toBe('success');
  30 |   // Only these four historic vendor tables are configured; other reports must remain explicit failures.
  31 |   expect(result.ok).toBe(false); expect(result.errors.length).toBeGreaterThan(0);
  32 |   const actual = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json(); expect(actual.notes.filter((note: { title: string }) => note.title.startsWith('受控启萃内容')).length).toBe(3); expect(actual.metrics.readCount).toBe(90000); expect(actual.metrics.interactionCount).toBe(600);
  33 |   await expect(page.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible(); await expect(page.getByText('已记录阅读量最多的区间：', { exact: false })).toContainText('1万–5万');
  34 |   return actual;
  35 | }
  36 | for (const width of [1280, 390]) {
  37 |   test(`历史业务组件 ${width}px：真实四表同步、复杂图表、选择移动、发布刷新与只读一致`, async ({ page, request }, info) => {
  38 |     await page.setViewportSize({ width, height: 900 }); const before = await prepare(page, request); const board = page.getByTestId('business-component-board-overview');
  39 |     await expect(board).toContainText('3篇完整记录'); await expect(board).toContainText('达人层级互动量箱线图'); await expect(board).toContainText('受控启萃内容丙');
  40 |     await page.screenshot({ path: info.outputPath('historic-data-before-layout.png'), fullPage: true }); await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true });
  41 |     await dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: '上移内容效果深度分析', exact: true }).click();
  42 |     await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).focus(); await expect(dialog.getByRole('button', { name: '发布业务组件布局', exact: true })).toBeInViewport(); await page.screenshot({ path: info.outputPath('business-layout-editor-open.png') });
  43 |     const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.keyboard.press('Enter'); expect((await published).status()).toBe(200); await expect(dialog).toHaveCount(0); await expect(board.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  44 |     const order = await board.locator('[data-component-order]').getAttribute('data-component-order'); expect(order!.indexOf('content-effects')).toBeLessThan(order!.indexOf('budget')); await page.reload(); await expect(board.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0); await expect(board).toContainText('受控启萃内容丙');
  45 |     const after = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json(); expect(after.notes).toEqual(before.notes); expect(after.metrics.readCount).toBe(90000); const saved = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect(JSON.parse(saved.dashboards[0].layoutJson).businessComponents).not.toContain('kfs');
  46 |     await page.screenshot({ path: info.outputPath('published-historic-components.png'), fullPage: true });
  47 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); await dialog.getByRole('checkbox', { name: '显示内容效果深度分析', exact: true }).uncheck(); await dialog.getByRole('button', { name: '取消布局修改', exact: true }).click(); await expect(board.getByRole('heading', { name: '内容效果深度分析', exact: true })).toBeVisible();
  48 |     expect((await request.post('/api/projects', { headers: platform, data: { action: 'add_member', projectId: 'qicui', userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200); await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/qicui'); await expect(page.getByRole('button', { name: '配置业务组件布局', exact: true })).toHaveCount(0); await expect(board).toContainText('受控启萃内容丙'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  49 |   });
  50 |   for (const failure of ['500', 'network', '409']) test(`组件发布恢复 ${width}px ${failure}：选择与顺序不丢，成功后才应用新布局`, async ({ page, request }, info) => {
  51 |     await page.setViewportSize({ width, height: 900 }); await prepare(page, request); await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true });
  52 |     await dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); await dialog.getByRole('button', { name: '上移预算消耗节奏对比', exact: true }).click();
  53 |     if (failure === '409') { const current = await (await request.get('/api/dashboards?projectId=qicui', { headers: editor })).json(); expect((await request.post('/api/dashboards', { headers: editor, data: { projectId: 'qicui', action: 'set_components', version: current.dashboards[0].version, components: ['content-effects'] } })).status()).toBe(200); }
  54 |     else { let injected = false; await page.route('**/api/dashboards', async route => { if (!injected && route.request().method() === 'POST') { injected = true; if (failure === 'network') await route.abort('failed'); else await route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"模拟布局发布故障"}' }); } else await route.continue(); }); }
  55 |     await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByRole('alert')).toBeFocused(); await expect(dialog.getByRole('alert')).toBeInViewport(); await expect(dialog.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true })).not.toBeChecked(); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toBeAttached(); await page.screenshot({ path: info.outputPath('component-error-draft-preserved.png') });
  56 |     if (failure === '409') { await dialog.getByRole('button', { name: /读取最新布局版本并保留选择/ }).click(); await expect(dialog.getByRole('alert')).toContainText('当前组件选择和顺序保留'); }
  57 |     const published = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); expect((await published).status()).toBe(200); await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0); await page.reload(); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  58 |   });
  59 |   test(`日报组件 ${width}px：真实400消耗与加权CTR，单独选择日报区块，空布局刷新与恢复完整图表`, async ({ page, request }, info) => {
> 60 |     await page.setViewportSize({ width, height: 900 }); await prepare(page, request); await page.getByRole('tab', { name: '分日 · 日报监控看板', exact: true }).click(); const daily = page.getByTestId('business-component-board-daily');
     |                                                                                                                                                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
  61 |     await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400'); await expect(daily.locator('.reference-kpi').filter({ hasText: '信息流 CTR' })).toContainText('2'); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toBeVisible();
  62 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await dialog.getByRole('checkbox', { name: '显示计划消耗与点击效率趋势', exact: true }).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toHaveCount(0); await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400');
  63 |     await page.screenshot({ path: info.outputPath('daily-component-filtered-with-real-values.png'), fullPage: true });
  64 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const checked = dialog.getByRole('checkbox'); for (let i = 0; i < await checked.count(); i++) await checked.nth(i).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.reload(); await expect(daily).toContainText('本视图未选择业务组件'); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toHaveCount(0);
  65 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); await dialog.getByRole('button', { name: '恢复全部业务组件与默认顺序', exact: true }).click(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toBeVisible();
  66 |   });
  67 |   test(`共享卡片保护 ${width}px：组件发布不覆盖正在编辑的标题草稿，按真实冲突版本重试仍保留已发布组件选择`, async ({ page, request }) => {
  68 |     await page.setViewportSize({ width, height: 900 }); await prepare(page, request);
  69 |     await connectExistingProjectTable(page, request, 'qicui', [['任务'], ['本项目记录甲'], ['本项目记录乙']], 'ComponentOwn-' + Date.now());
  70 |     const source = (await (await request.get('/api/datasets?projectId=qicui', { headers: editor })).json()).datasets.find((item: { sourceId: string; name: string }) => item.name === '补修数据');
  71 |     const created = await request.post('/api/metric-definitions', { headers: editor, data: { action: 'save', projectId: 'qicui', name: '组件场景独立记录' + Date.now(), expectedVersion: 0, config: { datasetId: source.id, aggregation: 'count' } } }); expect(created.status()).toBe(200); const definition = await created.json();
  72 |     await page.goto('/projects/qicui/metrics'); await page.getByRole('row').filter({ has: page.getByRole('cell', { name: definition.config.title, exact: true }) }).getByRole('button', { name: '加入看板', exact: true }).click(); await page.getByRole('button', { name: '加入草稿', exact: true }).click();
  73 |     const first = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await first).status()).toBe(200); await dismissProjectNotifications(page);
  74 |     await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); const card = page.getByRole('article', { name: definition.config.title, exact: true }); await card.getByRole('button', { name: '编辑', exact: true }).click(); const cardDialog = page.getByRole('dialog'); await cardDialog.getByLabel('卡片标题', { exact: true }).fill('组件发布期间保留的草稿'); await cardDialog.getByRole('button', { name: '保存并加入看板', exact: true }).click();
  75 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const layout = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await layout.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); await layout.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(layout).toHaveCount(0); await expect(page.getByRole('article', { name: '组件发布期间保留的草稿', exact: true })).toContainText('2');
  76 |     const conflict = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await conflict).status()).toBe(409); await expect(page.getByRole('article', { name: '组件发布期间保留的草稿', exact: true })).toBeVisible();
  77 |     await page.getByRole('button', { name: /覆盖保存/ }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload(); await expect(page.getByRole('article', { name: '组件发布期间保留的草稿', exact: true })).toContainText('2'); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  78 |   });
  79 | }
  80 | 
```