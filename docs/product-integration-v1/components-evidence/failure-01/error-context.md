# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-components.spec.ts >> 日报组件 1280px：真实400消耗与加权CTR，单独选择日报区块，空布局刷新与恢复完整图表
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
    - generic [ref=e11]:
      - generic [ref=e12]: 当前项目
      - combobox "切换项目" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 启萃评论与声量项目
      - paragraph [ref=e20]: 飞鹤 · 启萃 · 进行中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/qicui
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/qicui/data
        - generic [ref=e26]: "02"
      - link "竞品分析" [ref=e28] [cursor=pointer]:
        - /url: /projects/qicui/growth
        - generic [ref=e29]: "03"
      - link "指标" [ref=e31] [cursor=pointer]:
        - /url: /projects/qicui/metrics
        - generic [ref=e32]: "04"
      - link "内容管理" [ref=e34] [cursor=pointer]:
        - /url: /projects/qicui/content
        - generic [ref=e35]: "05"
      - link "评论运营" [ref=e37] [cursor=pointer]:
        - /url: /projects/qicui/comments
        - generic [ref=e38]: "06"
      - link "报告" [ref=e40] [cursor=pointer]:
        - /url: /projects/qicui/reports
        - generic [ref=e41]: "07"
      - link "项目设置" [ref=e43] [cursor=pointer]:
        - /url: /projects/qicui/settings
        - generic [ref=e44]: "08"
    - generic [ref=e46]:
      - text: 项目资料已连接
      - generic [ref=e48]: 业务编辑者(张晓) · 2026/10/14 09:08:59
  - main [ref=e49]:
    - generic [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]:
          - text: FEIHE · Q3 DASHBOARD
          - heading "启萃评论与声量项目" [level=1] [ref=e54]
          - paragraph [ref=e55]: 2026年 Q3 · 小红书种草与电商引流 · 项目数据看板
        - generic [ref=e57]:
          - generic [ref=e58]: 投放截至 2026-09-30
          - generic [ref=e59]:
            - button "同步异常 · 重试" [ref=e60] [cursor=pointer]
            - alert [ref=e64]:
              - generic [ref=e66]: 已核对 4/25 张工作表，内容无变化；投放数据截至 2026-09-30；部分同步失败，请查看数据来源明细
      - navigation "模块切换" [ref=e68]:
        - button "总览 · Q3累计全盘 决策摘要、月度进度、投流效率与内容复盘" [pressed] [ref=e69] [cursor=pointer]:
          - generic [aria-hidden] [ref=e70]: 📊
          - generic [ref=e71]:
            - strong [ref=e73]: 总览 · Q3累计全盘
            - generic [ref=e74]: 决策摘要、月度进度、投流效率与内容复盘
        - button "分日 · 日报监控看板 日期切换、8大核心指标与近30天趋势" [ref=e75] [cursor=pointer]:
          - generic [aria-hidden] [ref=e76]: 📅
          - generic [ref=e77]:
            - strong [ref=e79]: 分日 · 日报监控看板
            - generic [ref=e80]: 日期切换、8大核心指标与近30天趋势
      - group [ref=e81]:
        - generic "数据来源与多工作表溯源明细 · 部分读取失败最近核对 2026/10/14 09:09:40" [ref=e82] [cursor=pointer]
      - generic [ref=e83]:
        - generic [ref=e84]:
          - paragraph [ref=e85]: 业务分析截至 2026-09-30，沿用现有日报与季度口径。下方项目指标使用各自已标明的周期与筛选。
          - button "配置业务组件布局" [ref=e86] [cursor=pointer]
        - generic [ref=e87]:
          - generic [ref=e88]:
            - generic [ref=e89]:
              - generic [ref=e90]: 决策层 · 今日指标与待办
              - generic [ref=e91]: 投放 2026-09-30 · 笔记 2026-09-30
            - generic [ref=e92]:
              - generic [ref=e93]:
                - generic [ref=e94]: 80%
                - generic [ref=e95]: 当日计划达成率
                - generic [ref=e96]: 实际消耗 / 已填计划
              - generic [ref=e97]:
                - generic [ref=e98]:
                  - strong [ref=e100]: 消耗节奏
                  - generic [ref=e101]: ¥400
                  - generic [ref=e102]: 当日计划 ¥500
                - generic [ref=e103]:
                  - strong [ref=e105]: 信息流 CTR
                  - generic [ref=e106]: 2%
                  - generic [ref=e107]: 点击合计 / 展现合计
                - generic [ref=e108]:
                  - strong [ref=e110]: 搜索 CTR
                  - generic [ref=e111]: 3%
                  - generic [ref=e112]: 搜索广告实际点击效率
                - generic [ref=e113]:
                  - strong [ref=e115]: 待处置风险
                  - generic [ref=e116]: 0 条
                  - generic [ref=e117]: 待回复 0 · 待删除 0
            - generic [ref=e118]:
              - strong [ref=e120]: Executive Summary · 关键数据摘要
              - list [ref=e121]:
                - listitem [ref=e122]:
                  - generic [ref=e123]: 消耗
                  - generic [ref=e124]: 2026-09-30 实际投放 ¥400，当日计划 ¥500，达成率 80%。
                - listitem [ref=e125]:
                  - generic [ref=e126]: 效率
                  - generic [ref=e127]: 信息流 CTR 2%，搜索 CTR 3%；按聚光展现、点击加权计算。
                - listitem [ref=e128]:
                  - generic [ref=e129]: 内容
                  - generic [ref=e130]: 项目已收录 3 篇笔记，累计阅读 9万 次，互动 600 次。
                - listitem [ref=e131]:
                  - generic [ref=e132]: 行动
                  - generic [ref=e133]: 有 0 条风险评论待处理，其中待回复 0 条、待删除 0 条。
          - generic [ref=e134]:
            - generic [ref=e135]:
              - generic [ref=e136]:
                - generic [ref=e137]: 预算节奏
                - heading "预算消耗节奏对比" [level=3] [ref=e138]
              - generic [ref=e139]: 当月进度与季度全盘
            - generic [ref=e140]:
              - generic [ref=e141]:
                - strong [ref=e143]: 9月当月 · 截至9月30日
                - generic [ref=e144]:
                  - generic [ref=e145]:
                    - generic [ref=e146]: 时间进度（30/30 天）
                    - strong [ref=e147]: 100%
                  - progressbar "时间进度（30/30 天）" [ref=e148]
                - generic [ref=e150]:
                  - generic [ref=e151]:
                    - generic [ref=e152]: 同日期 · 消耗 / 计划
                    - strong [ref=e153]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=e154]
                  - generic [ref=e156]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=e157]:
                  - generic [ref=e158]: ¥700
                  - generic [ref=e159]: 覆盖 2 个有投放数据的日期
              - generic [ref=e160]:
                - strong [ref=e162]: Q3 累计 · 7月1日—9月30日
                - generic [ref=e163]:
                  - generic [ref=e164]:
                    - generic [ref=e165]: 时间进度（92/92 天）
                    - strong [ref=e166]: 100%
                  - progressbar "时间进度（92/92 天）" [ref=e167]
                - generic [ref=e169]:
                  - generic [ref=e170]:
                    - generic [ref=e171]: 同日期 · 消耗 / 计划
                    - strong [ref=e172]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=e173]
                  - generic [ref=e175]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=e176]:
                  - generic [ref=e177]: ¥700
                  - generic [ref=e178]: 覆盖 2 个有投放数据的日期
            - generic [ref=e179]: 计划为已填日期的预算合计，并非完整月度或季度预算。时间进度按自然日计算。
          - generic [ref=e180]:
            - generic [ref=e181]:
              - generic [ref=e182]:
                - generic [ref=e183]: 一、投流效率
                - heading "KFS 投流与采买结构" [level=3] [ref=e184]
              - generic [ref=e185]: 投流与达人采买分开展示
            - generic [ref=e186]:
              - generic [ref=e187]:
                - generic [ref=e188]:
                  - generic [ref=e189]:
                    - strong [ref=e190]: 信息流 / 搜索投流结构
                    - generic [ref=e191]: Q3 已同步日期
                  - generic [ref=e192]:
                    - generic [ref=e194]:
                      - generic [ref=e195]: 信息流 F
                      - generic [ref=e196]:
                        - generic [ref=e197]: ¥250
                        - strong [ref=e198]: 35.7%
                    - generic [ref=e202]:
                      - generic [ref=e203]: 搜索 S
                      - generic [ref=e204]:
                        - generic [ref=e205]: ¥450
                        - strong [ref=e206]: 64.3%
                - generic [ref=e209]:
                  - generic [ref=e210]:
                    - strong [ref=e211]: 达人 K · 内容采买
                    - generic [ref=e212]: 项目笔记报价合计
                  - generic [ref=e213]: ¥6000
                  - generic [ref=e214]:
                    - generic [ref=e215]:
                      - text: 商业合作笔记
                      - strong [ref=e216]: 3 篇
                    - generic [ref=e217]:
                      - text: 内容平均 CPE
                      - strong [ref=e218]: ¥10
                  - paragraph [ref=e219]: 使用笔记库已有报价与互动表现；采买费用与投流消耗为不同口径。
              - generic [ref=e220]:
                - generic [ref=e221]:
                  - strong [ref=e222]: KFS 分渠道消耗趋势（堆叠面积）
                  - generic [ref=e223]: 近 2 个数据日 · 信息流 F + 搜索 S
                - generic [ref=e225]:
                  - generic [ref=e226]:
                    - generic [ref=e227]: 信息流 F
                    - generic [ref=e230]: 搜索 S
                  - img [ref=e233]:
                    - generic [ref=e234]: ¥0.0w
                    - generic [ref=e236]: ¥0.0w
                    - generic [ref=e238]: ¥0.0w
                    - generic [ref=e240]: ¥0.0w
                    - generic [ref=e246]: 09-29
                    - generic [ref=e247]: 09-30
          - generic [ref=e250]:
            - generic [ref=e251]:
              - generic [ref=e252]:
                - generic [ref=e253]: 二、内容产出
                - heading "种草发布与切角渗透" [level=3] [ref=e254]
              - generic [ref=e255]: 当前项目累计笔记库
            - generic [ref=e256]:
              - generic [ref=e257]:
                - generic [ref=e258]: 种草笔记总数
                - generic [ref=e259]:
                  - text: "3"
                  - generic [ref=e260]: 篇
                - generic [ref=e261]: 已发布 3 篇
              - generic [ref=e262]:
                - generic [ref=e263]: 累计内容阅读
                - generic [ref=e264]:
                  - text: 9万
                  - generic [ref=e265]: 次
                - generic [ref=e266]: 累计曝光 36万 次
              - generic [ref=e267]:
                - generic [ref=e268]: 累计内容互动
                - generic [ref=e269]:
                  - text: "600"
                  - generic [ref=e270]: 次
                - generic [ref=e271]: 项目发布目标 未设置
            - generic [ref=e272]:
              - generic [ref=e273]:
                - generic [ref=e274]:
                  - strong [ref=e275]: 达人量级结构分布
                  - generic [ref=e276]: 3 篇已收录笔记
                - generic [ref=e277]:
                  - generic [ref=e278]:
                    - img [ref=e279]:
                      - generic [ref=e281] [cursor=pointer]
                      - generic [ref=e282] [cursor=pointer]
                    - generic:
                      - generic: "3"
                      - generic: 总篇数
                  - generic [ref=e283]:
                    - generic [ref=e284] [cursor=pointer]:
                      - generic [ref=e285]: 腰部
                      - generic [ref=e288]:
                        - generic [ref=e289]: 2篇
                        - generic [ref=e290]: (66.7%)
                    - generic [ref=e291] [cursor=pointer]:
                      - generic [ref=e292]: 头部
                      - generic [ref=e295]:
                        - generic [ref=e296]: 1篇
                        - generic [ref=e297]: (33.3%)
              - generic [ref=e298]:
                - generic [ref=e299]:
                  - strong [ref=e300]: 内容形式分布
                  - generic [ref=e301]: 已收录笔记
                - generic "点击查看「图文」相关笔记" [ref=e303] [cursor=pointer]:
                  - generic [ref=e304]:
                    - generic [ref=e305]: 图文
                    - generic [ref=e306]:
                      - generic [ref=e307]: 3 篇 · 600 互动
                      - strong [ref=e308]: 100.0%
            - generic [ref=e311]:
              - generic [ref=e312]:
                - generic [ref=e313]:
                  - strong [ref=e314]: 达人层级采买金额分布
                  - generic [ref=e315]: 项目全量笔记报价分布
                - generic [ref=e316]:
                  - generic [ref=e318] [cursor=pointer]:
                    - generic [ref=e319]: 腰部
                    - generic [ref=e320]:
                      - generic [ref=e321]: 2 篇
                      - strong [ref=e322]: ¥0.5w
                      - generic [ref=e323]: 83.3%
                  - generic [ref=e327] [cursor=pointer]:
                    - generic [ref=e328]: 头部
                    - generic [ref=e329]:
                      - generic [ref=e330]: 1 篇
                      - strong [ref=e331]: ¥0.1w
                      - generic [ref=e332]: 16.7%
                  - generic [ref=e335]: 采买总金额 ¥0.6w · 基于笔记库已填报价
              - generic [ref=e336]:
                - generic [ref=e337]:
                  - strong [ref=e338]: 内容切角 / 场景渗透
                  - generic [ref=e339]: TOP 8 方向笔记与互动
                - table [ref=e341]:
                  - rowgroup [ref=e342]:
                    - row [ref=e343]:
                      - columnheader "切角 / 场景" [ref=e344]
                      - columnheader "篇数" [ref=e345]
                      - columnheader "阅读" [ref=e346]
                      - columnheader "互动" [ref=e347]
                      - columnheader "分布" [ref=e348]
                  - rowgroup [ref=e349]:
                    - row [ref=e350] [cursor=pointer]:
                      - cell "生活场景 查看笔记 ↗" [ref=e351]:
                        - generic [ref=e352]:
                          - generic [ref=e353]: 生活场景
                          - generic [ref=e354]: 查看笔记 ↗
                      - cell "2" [ref=e355]
                      - cell "7万" [ref=e356]
                      - cell "500" [ref=e357]
                      - cell [ref=e358]:
                        - generic [ref=e359]:
                          - strong [ref=e361]: 66.67%
                          - progressbar [ref=e362]
                    - row [ref=e364] [cursor=pointer]:
                      - cell "产品科普 查看笔记 ↗" [ref=e365]:
                        - generic [ref=e366]:
                          - generic [ref=e367]: 产品科普
                          - generic [ref=e368]: 查看笔记 ↗
                      - cell "1" [ref=e369]
                      - cell "2万" [ref=e370]
                      - cell "100" [ref=e371]
                      - cell [ref=e372]:
                        - generic [ref=e373]:
                          - strong [ref=e375]: 33.33%
                          - progressbar [ref=e376]
          - generic [ref=e378]:
            - generic [ref=e379]:
              - generic [ref=e380]:
                - generic [ref=e381]: 三、内容效果
                - heading "内容效果深度分析" [level=3] [ref=e382]
              - generic [ref=e383]: 散点矩阵 · 分布直方图 · 箱线图
            - generic [ref=e384]:
              - generic [ref=e385]:
                - generic [ref=e386]:
                  - strong [ref=e387]: 笔记阅读与互动效果（散点图）
                  - generic [ref=e388]: X=阅读量 Y=互动量 · 3篇完整记录（含零值）· 点大小=采集评论数
                - generic [ref=e389]:
                  - text: 内容方向
                  - combobox "散点图内容方向" [ref=e391] [cursor=pointer]:
                    - generic [ref=e392]: 全部方向
                - img [ref=e396]:
                  - generic [ref=e397]: "0"
                  - generic [ref=e399]: "83"
                  - generic [ref=e401]: "165"
                  - generic [ref=e403]: "248"
                  - generic [ref=e405]: "330"
                  - generic [ref=e407]: "0"
                  - generic [ref=e409]: 1.1w
                  - generic [ref=e411]: 2.2w
                  - generic [ref=e413]: 3.3w
                  - generic [ref=e415]: 4.4w
                  - generic [ref=e417]: 阅读量
                  - generic [ref=e418]: 互动量
                  - generic [ref=e419] [cursor=pointer]
                  - generic [ref=e420] [cursor=pointer]
                  - generic [ref=e421] [cursor=pointer]
              - generic [ref=e422]:
                - generic [ref=e423]:
                  - strong [ref=e424]: 笔记阅读量分布直方图
                  - generic [ref=e425]: 3 篇有阅读数据的笔记
                - generic [ref=e427]:
                  - text: 已记录阅读量最多的区间：
                  - strong [ref=e428]: 1万–5万
                - img [ref=e431]:
                  - generic [ref=e432]: "0"
                  - generic [ref=e434]: "1"
                  - generic [ref=e436]: "2"
                  - generic [ref=e438]: "2"
                  - generic [ref=e440]: "3"
                  - generic [ref=e442] [cursor=pointer]: 0–1千
                  - generic [ref=e444] [cursor=pointer]: 1千–5千
                  - generic [ref=e446] [cursor=pointer]: 5千–1万
                  - generic [ref=e448] [cursor=pointer]: 1万–5万
                  - generic [ref=e451] [cursor=pointer]: 5万–10万
                  - generic [ref=e453] [cursor=pointer]: 10万–50万
                  - generic [ref=e455] [cursor=pointer]: 50万及以上
            - generic [ref=e457]:
              - generic [ref=e458]:
                - strong [ref=e459]: 达人层级互动量箱线图
                - generic [ref=e460]: 各层级已记录互动量分布（含零值，缺失不参与）
              - generic [ref=e461]:
                - generic [ref=e462]:
                  - generic [ref=e463]: 悬停、点击或用 Tab 聚焦层级，查看样本数与五项分布值
                  - button "当前：主体分布（常规范围）" [ref=e464] [cursor=pointer]
                - img [ref=e465]:
                  - generic [ref=e466]: "0"
                  - generic [ref=e468]: "3500"
                  - generic [ref=e470]: "7000"
                  - generic [ref=e472]: 1.1w
                  - generic [ref=e474]: 1.4w
                  - button "腰部，2 篇，中位数 250 互动" [ref=e476] [cursor=pointer]:
                    - generic [ref=e479]: 腰部
                    - generic [ref=e480]: n=2
                  - button "头部，1 篇，中位数 100 互动" [ref=e481] [cursor=pointer]:
                    - generic [ref=e484]: 头部
                    - generic [ref=e485]: n=1
          - generic [ref=e487]:
            - generic [ref=e489]:
              - generic [ref=e490]: TARGET VS ACTUAL
              - heading "KPI目标与实际" [level=3] [ref=e491]
              - generic [ref=e492]: 选择同一周期、代理、项目和渠道进行比较；总计与明细分别查看。
            - generic [ref=e493]:
              - generic [ref=e494]: ∅
              - heading "等待 KPI 数据" [level=3] [ref=e495]
              - paragraph [ref=e496]: 同步飞书数据后查看目标、实际和差额。
          - generic [ref=e497]:
            - generic [ref=e498]:
              - generic [ref=e499]:
                - generic [ref=e500]: 五、爆文排行
                - heading "高热内容 TOP20 排行榜" [level=3] [ref=e501]
              - generic [ref=e502]: 项目全量笔记按互动量排序
            - table [ref=e504]:
              - rowgroup [ref=e505]:
                - row [ref=e506]:
                  - columnheader "#" [ref=e507]
                  - columnheader "笔记标题" [ref=e508]
                  - columnheader "达人" [ref=e509]
                  - columnheader "内容方向" [ref=e510]
                  - columnheader "阅读量" [ref=e511]
                  - columnheader "互动量" [ref=e512]
                  - columnheader "评论数" [ref=e513]
                  - columnheader "互动率" [ref=e514]
              - rowgroup [ref=e515]:
                - row [ref=e516] [cursor=pointer]:
                  - cell [ref=e517]:
                    - strong [ref=e518]: "1"
                  - cell "受控启萃内容丙" [ref=e519]
                  - cell "受控达人2" [ref=e520]
                  - cell "生活场景" [ref=e521]
                  - cell "4万" [ref=e522]
                  - cell [ref=e523]:
                    - strong [ref=e524]: "300"
                  - cell "0" [ref=e525]
                  - cell "0.75%" [ref=e526]
                - row [ref=e527] [cursor=pointer]:
                  - cell [ref=e528]:
                    - strong [ref=e529]: "2"
                  - cell "受控启萃内容乙" [ref=e530]
                  - cell "受控达人1" [ref=e531]
                  - cell "生活场景" [ref=e532]
                  - cell "3万" [ref=e533]
                  - cell [ref=e534]:
                    - strong [ref=e535]: "200"
                  - cell "0" [ref=e536]
                  - cell "0.67%" [ref=e537]
                - row [ref=e538] [cursor=pointer]:
                  - cell [ref=e539]:
                    - strong [ref=e540]: "3"
                  - cell "受控启萃内容甲" [ref=e541]
                  - cell "受控达人0" [ref=e542]
                  - cell "产品科普" [ref=e543]
                  - cell "2万" [ref=e544]
                  - cell [ref=e545]:
                    - strong [ref=e546]: "100"
                  - cell "0" [ref=e547]
                  - cell "0.50%" [ref=e548]
          - generic [ref=e549]:
            - generic [ref=e550]:
              - generic [ref=e551]:
                - generic [ref=e552]:
                  - generic [ref=e553]:
                    - generic [ref=e554]: 数据覆盖
                    - heading "内容数据与待办" [level=3] [ref=e555]
                  - generic [ref=e556]: 真实记录覆盖情况
                - generic [ref=e557]:
                  - generic [ref=e558]:
                    - text: 当前项目笔记
                    - generic [ref=e559]:
                      - strong [ref=e560]: "3"
                      - text: 篇
                  - generic [ref=e561]:
                    - text: 已记录阅读量
                    - generic [ref=e562]:
                      - strong [ref=e563]: "3"
                      - text: 篇（含零值）
                  - generic [ref=e564]:
                    - text: 阅读和互动均有记录
                    - generic [ref=e565]:
                      - strong [ref=e566]: "3"
                      - text: 篇
                  - generic [ref=e567]:
                    - text: 风险待处理
                    - generic [ref=e568]:
                      - strong [ref=e569]: "0"
                      - text: 条
                - paragraph [ref=e570]: 分布图覆盖当前项目全部已收录笔记；评论来自采集快照，不串联为用户转化漏斗。内容最新有效日期：2026-09-30。
                - link "查看风险待办 →" [ref=e571] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
              - generic [ref=e572]:
                - generic [ref=e573]:
                  - generic [ref=e574]:
                    - generic [ref=e575]: 字段覆盖
                    - heading "内容分析还缺哪些数据" [level=3] [ref=e576]
                  - generic [ref=e577]: 按全量笔记核对
                - generic [ref=e578]:
                  - generic [ref=e580]:
                    - generic [ref=e581]: 内容方向
                    - generic [ref=e582]:
                      - generic [ref=e583]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e584]: 100.0%
                  - generic [ref=e588]:
                    - generic [ref=e589]: 达人层级
                    - generic [ref=e590]:
                      - generic [ref=e591]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e592]: 100.0%
                  - generic [ref=e596]:
                    - generic [ref=e597]: 阅读量
                    - generic [ref=e598]:
                      - generic [ref=e599]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e600]: 100.0%
                  - generic [ref=e604]:
                    - generic [ref=e605]: 互动量
                    - generic [ref=e606]:
                      - generic [ref=e607]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=e608]: 100.0%
                - paragraph [ref=e611]: 方向缺失的笔记仍计入阅读和互动总量；不参与已标注方向的效果判断。
            - generic [ref=e612]:
              - generic [ref=e613]:
                - generic [ref=e614]:
                  - generic [ref=e615]: 达人效率
                  - heading "达人层级效率排行榜" [level=3] [ref=e616]
                - generic [ref=e617]: 按篇均CPE升序，缺失排末尾
              - generic [ref=e618]:
                - generic "点击查看该层级笔记" [ref=e619] [cursor=pointer]:
                  - generic [ref=e620]:
                    - generic [ref=e621]:
                      - generic [ref=e622]: "1"
                      - strong [ref=e623]: 腰部
                    - generic [ref=e624]: 篇均CPE ¥10.00
                  - generic [ref=e625]:
                    - generic [ref=e626]:
                      - text: 笔记数
                      - strong [ref=e627]: "2"
                    - generic [ref=e628]:
                      - text: 均阅读
                      - strong [ref=e629]: 3.5万
                    - generic [ref=e630]:
                      - text: 均互动
                      - strong [ref=e631]: "250"
                    - generic [ref=e632]:
                      - text: 均CPE
                      - strong [ref=e633]: ¥10.0
                - generic "点击查看该层级笔记" [ref=e634] [cursor=pointer]:
                  - generic [ref=e635]:
                    - generic [ref=e636]:
                      - generic [ref=e637]: "2"
                      - strong [ref=e638]: 头部
                    - generic [ref=e639]: 篇均CPE ¥10.00
                  - generic [ref=e640]:
                    - generic [ref=e641]:
                      - text: 笔记数
                      - strong [ref=e642]: "1"
                    - generic [ref=e643]:
                      - text: 均阅读
                      - strong [ref=e644]: 2万
                    - generic [ref=e645]:
                      - text: 均互动
                      - strong [ref=e646]: "100"
                    - generic [ref=e647]:
                      - text: 均CPE
                      - strong [ref=e648]: ¥10.0
          - generic [ref=e649]:
            - generic [ref=e650]:
              - generic [ref=e651]:
                - generic [ref=e652]: 互动质量
                - heading "已记录点赞、收藏与分享构成" [level=3] [ref=e653]
              - generic [ref=e654]: 比例仅在三项已记录指标中计算
            - generic [ref=e655]:
              - generic [ref=e657]:
                - generic [ref=e659]:
                  - generic [ref=e660]:
                    - generic [ref=e661]: ♥
                    - generic [ref=e662]: 点赞
                  - generic [ref=e663]:
                    - text: "420"
                    - generic [ref=e664]: 70.0%
                - generic [ref=e668]:
                  - generic [ref=e669]:
                    - generic [ref=e670]: ★
                    - generic [ref=e671]: 收藏
                  - generic [ref=e672]:
                    - text: "120"
                    - generic [ref=e673]: 20.0%
                - generic [ref=e677]:
                  - generic [ref=e678]:
                    - generic [ref=e679]: ↗
                    - generic [ref=e680]: 分享
                  - generic [ref=e681]:
                    - text: "60"
                    - generic [ref=e682]: 10.0%
              - generic [ref=e685]:
                - generic [ref=e686]: 互动质量洞察
                - generic [ref=e687]:
                  - generic [ref=e688]:
                    - generic [ref=e689]: 点赞占比
                    - generic [ref=e690]: 70.0%
                    - generic [ref=e691]: 浅层互动，反映内容吸引力
                  - generic [ref=e692]:
                    - generic [ref=e693]: 收藏占比
                    - generic [ref=e694]: 20.0%
                    - generic [ref=e695]: 深度互动，反映内容价值密度
                  - generic [ref=e696]:
                    - generic [ref=e697]: 分享占比
                    - generic [ref=e698]: 10.0%
                    - generic [ref=e699]: 采集评论单独查看，不计入此构成
          - generic [ref=e700]:
            - generic [ref=e701]:
              - generic [ref=e702]:
                - generic [ref=e703]: 行动层
                - heading "复盘洞察与下一步行动" [level=3] [ref=e704]
              - generic [ref=e705]: 从数据直接进入运营
            - generic [ref=e706]:
              - generic [ref=e707]:
                - strong [ref=e708]: 当前观察
                - paragraph [ref=e709]: 内容库共 3 篇，累计互动 600 次。已标注的内容方向中，生活场景收录最多。
                - paragraph [ref=e710]: 当前真实评论快照合计 0 条，正向 0 条，负向 0 条。继续优先处理待回复和待删除事项。
              - generic [ref=e711]:
                - link "处理 0 条风险待办 达人回复与删除处置 去处理 →" [ref=e712] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
                  - generic [ref=e713]:
                    - strong [ref=e714]: 处理 0 条风险待办
                    - generic [ref=e715]: 达人回复与删除处置
                  - generic [ref=e716]: 去处理 →
                - link "复盘高热内容与切角 阅读、互动与达人效率 看内容 →" [ref=e717] [cursor=pointer]:
                  - /url: /projects/qicui/content?tab=analysis
                  - generic [ref=e718]:
                    - strong [ref=e719]: 复盘高热内容与切角
                    - generic [ref=e720]: 阅读、互动与达人效率
                  - generic [ref=e721]: 看内容 →
                - link "对照竞品月报与搜索趋势 使用已接入的品牌工作表 看竞品 →" [ref=e722] [cursor=pointer]:
                  - /url: /projects/qicui/growth?tab=competitor
                  - generic [ref=e723]:
                    - strong [ref=e724]: 对照竞品月报与搜索趋势
                    - generic [ref=e725]: 使用已接入的品牌工作表
                  - generic [ref=e726]: 看竞品 →
          - group [ref=e727]:
            - generic "查看指标定义与口径说明" [ref=e728]
      - generic [ref=e729]:
        - generic [ref=e731]:
          - generic [ref=e732]: 团队看板
          - heading "项目指标与图表" [level=3] [ref=e733]
        - generic [ref=e734]:
          - generic [ref=e735]:
            - generic [ref=e736]:
              - generic [ref=e737]: "当前业务数据集:"
              - generic [ref=e738]: 暂无导入数据集
            - generic [ref=e739]:
              - generic [ref=e740]:
                - button "📊 看板视图" [ref=e741] [cursor=pointer]
                - button "📋 数据明细 (0 行)" [ref=e742] [cursor=pointer]
              - button "⚙ 自定义看板卡片" [ref=e743] [cursor=pointer]
          - generic [ref=e744]:
            - generic [ref=e745]: ∅
            - heading "当前项目尚未接入通用数据集" [level=3] [ref=e746]
            - paragraph [ref=e747]: 接入业务表后，选择适用的指标与图表。飞书原表保持不变。
            - link "前往接入数据源 →" [ref=e749] [cursor=pointer]:
              - /url: /projects/qicui/settings?tab=data-sources
      - generic [ref=e750]:
        - generic [ref=e752]:
          - generic [ref=e753]: AI 复盘
          - heading "基于项目数据生成运营报告" [level=3] [ref=e754]
        - generic [ref=e755]:
          - textbox "报告需求" [ref=e756]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
          - button "生成复盘报告" [ref=e757] [cursor=pointer]
  - button "打开智能助手" [ref=e758] [cursor=pointer]:
    - generic [ref=e760]: 智
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