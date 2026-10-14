# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-components.spec.ts >> 共享卡片保护 1280px：组件发布不覆盖正在编辑的标题草稿，按真实冲突版本重试仍保留已发布组件选择
- Location: tests\browser\product-components.spec.ts:67:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('dialog', { name: '团队业务组件布局', exact: true })
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" getByRole('dialog', { name: '团队业务组件布局', exact: true }) with timeout 10000ms
  - waiting for getByRole('dialog', { name: '团队业务组件布局', exact: true })
    23 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=f2e2]:
  - complementary "项目主要导航" [ref=f2e3]:
    - link "返回项目中心" [ref=f2e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=f2e5]: 项目工作台
    - generic [ref=f2e11]:
      - generic [ref=f2e12]: 当前项目
      - combobox "切换项目" [ref=f2e15] [cursor=pointer]:
        - generic [ref=f2e16]: 启萃评论与声量项目
      - paragraph [ref=f2e20]: 飞鹤 · 启萃 · 进行中
    - navigation "项目模块" [ref=f2e21]:
      - link "项目总览" [ref=f2e22] [cursor=pointer]:
        - /url: /projects/qicui
        - generic [ref=f2e23]: "01"
      - link "数据管理" [ref=f2e25] [cursor=pointer]:
        - /url: /projects/qicui/data
        - generic [ref=f2e26]: "02"
      - link "竞品分析" [ref=f2e28] [cursor=pointer]:
        - /url: /projects/qicui/growth
        - generic [ref=f2e29]: "03"
      - link "指标" [ref=f2e31] [cursor=pointer]:
        - /url: /projects/qicui/metrics
        - generic [ref=f2e32]: "04"
      - link "内容管理" [ref=f2e34] [cursor=pointer]:
        - /url: /projects/qicui/content
        - generic [ref=f2e35]: "05"
      - link "评论运营" [ref=f2e37] [cursor=pointer]:
        - /url: /projects/qicui/comments
        - generic [ref=f2e38]: "06"
      - link "报告" [ref=f2e40] [cursor=pointer]:
        - /url: /projects/qicui/reports
        - generic [ref=f2e41]: "07"
      - link "项目设置" [ref=f2e43] [cursor=pointer]:
        - /url: /projects/qicui/settings
        - generic [ref=f2e44]: "08"
    - generic [ref=f2e46]:
      - text: 项目资料已连接
      - generic [ref=f2e48]: 业务编辑者(张晓) · 2026/10/14 09:22:29
  - main [ref=f2e49]:
    - generic [ref=f2e50]:
      - generic [ref=f2e51]:
        - generic [ref=f2e52]:
          - text: FEIHE · Q3 DASHBOARD
          - heading "启萃评论与声量项目" [level=1] [ref=f2e54]
          - paragraph [ref=f2e55]: 2026年 Q3 · 小红书种草与电商引流 · 项目数据看板
        - generic [ref=f2e57]:
          - generic [ref=f2e58]: 投放截至 2026-09-30
          - button "同步最新数据" [ref=f2e60] [cursor=pointer]
      - navigation "模块切换" [ref=f2e64]:
        - button "总览 · Q3累计全盘 决策摘要、月度进度、投流效率与内容复盘" [pressed] [ref=f2e65] [cursor=pointer]:
          - generic [aria-hidden] [ref=f2e66]: 📊
          - generic [ref=f2e67]:
            - strong [ref=f2e69]: 总览 · Q3累计全盘
            - generic [ref=f2e70]: 决策摘要、月度进度、投流效率与内容复盘
        - button "分日 · 日报监控看板 日期切换、8大核心指标与近30天趋势" [ref=f2e71] [cursor=pointer]:
          - generic [aria-hidden] [ref=f2e72]: 📅
          - generic [ref=f2e73]:
            - strong [ref=f2e75]: 分日 · 日报监控看板
            - generic [ref=f2e76]: 日期切换、8大核心指标与近30天趋势
      - group [ref=f2e77]:
        - generic "数据来源与多工作表溯源明细 · 部分读取失败最近核对 2026/10/14 09:22:55" [ref=f2e78] [cursor=pointer]
      - generic [ref=f2e79]:
        - generic [ref=f2e80]:
          - paragraph [ref=f2e81]: 业务分析截至 2026-09-30，沿用现有日报与季度口径。下方项目指标使用各自已标明的周期与筛选。
          - button "配置业务组件布局" [ref=f2e82] [cursor=pointer]
        - generic [ref=f2e83]:
          - generic [ref=f2e84]:
            - generic [ref=f2e85]:
              - generic [ref=f2e86]: 决策层 · 今日指标与待办
              - generic [ref=f2e87]: 投放 2026-09-30 · 笔记 2026-09-30
            - generic [ref=f2e88]:
              - generic [ref=f2e89]:
                - generic [ref=f2e90]: 80%
                - generic [ref=f2e91]: 当日计划达成率
                - generic [ref=f2e92]: 实际消耗 / 已填计划
              - generic [ref=f2e93]:
                - generic [ref=f2e94]:
                  - strong [ref=f2e96]: 消耗节奏
                  - generic [ref=f2e97]: ¥400
                  - generic [ref=f2e98]: 当日计划 ¥500
                - generic [ref=f2e99]:
                  - strong [ref=f2e101]: 信息流 CTR
                  - generic [ref=f2e102]: 2%
                  - generic [ref=f2e103]: 点击合计 / 展现合计
                - generic [ref=f2e104]:
                  - strong [ref=f2e106]: 搜索 CTR
                  - generic [ref=f2e107]: 3%
                  - generic [ref=f2e108]: 搜索广告实际点击效率
                - generic [ref=f2e109]:
                  - strong [ref=f2e111]: 待处置风险
                  - generic [ref=f2e112]: 0 条
                  - generic [ref=f2e113]: 待回复 0 · 待删除 0
            - generic [ref=f2e114]:
              - strong [ref=f2e116]: Executive Summary · 关键数据摘要
              - list [ref=f2e117]:
                - listitem [ref=f2e118]:
                  - generic [ref=f2e119]: 消耗
                  - generic [ref=f2e120]: 2026-09-30 实际投放 ¥400，当日计划 ¥500，达成率 80%。
                - listitem [ref=f2e121]:
                  - generic [ref=f2e122]: 效率
                  - generic [ref=f2e123]: 信息流 CTR 2%，搜索 CTR 3%；按聚光展现、点击加权计算。
                - listitem [ref=f2e124]:
                  - generic [ref=f2e125]: 内容
                  - generic [ref=f2e126]: 项目已收录 3 篇笔记，累计阅读 9万 次，互动 600 次。
                - listitem [ref=f2e127]:
                  - generic [ref=f2e128]: 行动
                  - generic [ref=f2e129]: 有 0 条风险评论待处理，其中待回复 0 条、待删除 0 条。
          - generic [ref=f2e130]:
            - generic [ref=f2e131]:
              - generic [ref=f2e132]:
                - generic [ref=f2e133]: 预算节奏
                - heading "预算消耗节奏对比" [level=3] [ref=f2e134]
              - generic [ref=f2e135]: 当月进度与季度全盘
            - generic [ref=f2e136]:
              - generic [ref=f2e137]:
                - strong [ref=f2e139]: 9月当月 · 截至9月30日
                - generic [ref=f2e140]:
                  - generic [ref=f2e141]:
                    - generic [ref=f2e142]: 时间进度（30/30 天）
                    - strong [ref=f2e143]: 100%
                  - progressbar "时间进度（30/30 天）" [ref=f2e144]
                - generic [ref=f2e146]:
                  - generic [ref=f2e147]:
                    - generic [ref=f2e148]: 同日期 · 消耗 / 计划
                    - strong [ref=f2e149]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=f2e150]
                  - generic [ref=f2e152]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=f2e153]:
                  - generic [ref=f2e154]: ¥700
                  - generic [ref=f2e155]: 覆盖 2 个有投放数据的日期
              - generic [ref=f2e156]:
                - strong [ref=f2e158]: Q3 累计 · 7月1日—9月30日
                - generic [ref=f2e159]:
                  - generic [ref=f2e160]:
                    - generic [ref=f2e161]: 时间进度（92/92 天）
                    - strong [ref=f2e162]: 100%
                  - progressbar "时间进度（92/92 天）" [ref=f2e163]
                - generic [ref=f2e165]:
                  - generic [ref=f2e166]:
                    - generic [ref=f2e167]: 同日期 · 消耗 / 计划
                    - strong [ref=f2e168]: 77.78%
                  - progressbar "同日期 · 消耗 / 计划" [ref=f2e169]
                  - generic [ref=f2e171]: 2 个可比日期 · 实际 ¥700 / 计划 ¥900
                - generic [ref=f2e172]:
                  - generic [ref=f2e173]: ¥700
                  - generic [ref=f2e174]: 覆盖 2 个有投放数据的日期
            - generic [ref=f2e175]: 计划为已填日期的预算合计，并非完整月度或季度预算。时间进度按自然日计算。
          - generic [ref=f2e176]:
            - generic [ref=f2e177]:
              - generic [ref=f2e178]:
                - generic [ref=f2e179]: 一、投流效率
                - heading "KFS 投流与采买结构" [level=3] [ref=f2e180]
              - generic [ref=f2e181]: 投流与达人采买分开展示
            - generic [ref=f2e182]:
              - generic [ref=f2e183]:
                - generic [ref=f2e184]:
                  - generic [ref=f2e185]:
                    - strong [ref=f2e186]: 信息流 / 搜索投流结构
                    - generic [ref=f2e187]: Q3 已同步日期
                  - generic [ref=f2e188]:
                    - generic [ref=f2e190]:
                      - generic [ref=f2e191]: 信息流 F
                      - generic [ref=f2e192]:
                        - generic [ref=f2e193]: ¥250
                        - strong [ref=f2e194]: 35.7%
                    - generic [ref=f2e198]:
                      - generic [ref=f2e199]: 搜索 S
                      - generic [ref=f2e200]:
                        - generic [ref=f2e201]: ¥450
                        - strong [ref=f2e202]: 64.3%
                - generic [ref=f2e205]:
                  - generic [ref=f2e206]:
                    - strong [ref=f2e207]: 达人 K · 内容采买
                    - generic [ref=f2e208]: 项目笔记报价合计
                  - generic [ref=f2e209]: ¥6000
                  - generic [ref=f2e210]:
                    - generic [ref=f2e211]:
                      - text: 商业合作笔记
                      - strong [ref=f2e212]: 3 篇
                    - generic [ref=f2e213]:
                      - text: 内容平均 CPE
                      - strong [ref=f2e214]: ¥10
                  - paragraph [ref=f2e215]: 使用笔记库已有报价与互动表现；采买费用与投流消耗为不同口径。
              - generic [ref=f2e216]:
                - generic [ref=f2e217]:
                  - strong [ref=f2e218]: KFS 分渠道消耗趋势（堆叠面积）
                  - generic [ref=f2e219]: 近 2 个数据日 · 信息流 F + 搜索 S
                - generic [ref=f2e221]:
                  - generic [ref=f2e222]:
                    - generic [ref=f2e223]: 信息流 F
                    - generic [ref=f2e226]: 搜索 S
                  - img [ref=f2e229]:
                    - generic [ref=f2e230]: ¥0.0w
                    - generic [ref=f2e232]: ¥0.0w
                    - generic [ref=f2e234]: ¥0.0w
                    - generic [ref=f2e236]: ¥0.0w
                    - generic [ref=f2e242]: 09-29
                    - generic [ref=f2e243]: 09-30
          - generic [ref=f2e246]:
            - generic [ref=f2e247]:
              - generic [ref=f2e248]:
                - generic [ref=f2e249]: 二、内容产出
                - heading "种草发布与切角渗透" [level=3] [ref=f2e250]
              - generic [ref=f2e251]: 当前项目累计笔记库
            - generic [ref=f2e252]:
              - generic [ref=f2e253]:
                - generic [ref=f2e254]: 种草笔记总数
                - generic [ref=f2e255]:
                  - text: "3"
                  - generic [ref=f2e256]: 篇
                - generic [ref=f2e257]: 已发布 3 篇
              - generic [ref=f2e258]:
                - generic [ref=f2e259]: 累计内容阅读
                - generic [ref=f2e260]:
                  - text: 9万
                  - generic [ref=f2e261]: 次
                - generic [ref=f2e262]: 累计曝光 36万 次
              - generic [ref=f2e263]:
                - generic [ref=f2e264]: 累计内容互动
                - generic [ref=f2e265]:
                  - text: "600"
                  - generic [ref=f2e266]: 次
                - generic [ref=f2e267]: 项目发布目标 未设置
            - generic [ref=f2e268]:
              - generic [ref=f2e269]:
                - generic [ref=f2e270]:
                  - strong [ref=f2e271]: 达人量级结构分布
                  - generic [ref=f2e272]: 3 篇已收录笔记
                - generic [ref=f2e273]:
                  - generic [ref=f2e274]:
                    - img [ref=f2e275]:
                      - generic [ref=f2e277] [cursor=pointer]
                      - generic [ref=f2e278] [cursor=pointer]
                    - generic:
                      - generic: "3"
                      - generic: 总篇数
                  - generic [ref=f2e279]:
                    - generic [ref=f2e280] [cursor=pointer]:
                      - generic [ref=f2e281]: 腰部
                      - generic [ref=f2e284]:
                        - generic [ref=f2e285]: 2篇
                        - generic [ref=f2e286]: (66.7%)
                    - generic [ref=f2e287] [cursor=pointer]:
                      - generic [ref=f2e288]: 头部
                      - generic [ref=f2e291]:
                        - generic [ref=f2e292]: 1篇
                        - generic [ref=f2e293]: (33.3%)
              - generic [ref=f2e294]:
                - generic [ref=f2e295]:
                  - strong [ref=f2e296]: 内容形式分布
                  - generic [ref=f2e297]: 已收录笔记
                - generic "点击查看「图文」相关笔记" [ref=f2e299] [cursor=pointer]:
                  - generic [ref=f2e300]:
                    - generic [ref=f2e301]: 图文
                    - generic [ref=f2e302]:
                      - generic [ref=f2e303]: 3 篇 · 600 互动
                      - strong [ref=f2e304]: 100.0%
            - generic [ref=f2e307]:
              - generic [ref=f2e308]:
                - generic [ref=f2e309]:
                  - strong [ref=f2e310]: 达人层级采买金额分布
                  - generic [ref=f2e311]: 项目全量笔记报价分布
                - generic [ref=f2e312]:
                  - generic [ref=f2e314] [cursor=pointer]:
                    - generic [ref=f2e315]: 腰部
                    - generic [ref=f2e316]:
                      - generic [ref=f2e317]: 2 篇
                      - strong [ref=f2e318]: ¥0.5w
                      - generic [ref=f2e319]: 83.3%
                  - generic [ref=f2e323] [cursor=pointer]:
                    - generic [ref=f2e324]: 头部
                    - generic [ref=f2e325]:
                      - generic [ref=f2e326]: 1 篇
                      - strong [ref=f2e327]: ¥0.1w
                      - generic [ref=f2e328]: 16.7%
                  - generic [ref=f2e331]: 采买总金额 ¥0.6w · 基于笔记库已填报价
              - generic [ref=f2e332]:
                - generic [ref=f2e333]:
                  - strong [ref=f2e334]: 内容切角 / 场景渗透
                  - generic [ref=f2e335]: TOP 8 方向笔记与互动
                - table [ref=f2e337]:
                  - rowgroup [ref=f2e338]:
                    - row [ref=f2e339]:
                      - columnheader "切角 / 场景" [ref=f2e340]
                      - columnheader "篇数" [ref=f2e341]
                      - columnheader "阅读" [ref=f2e342]
                      - columnheader "互动" [ref=f2e343]
                      - columnheader "分布" [ref=f2e344]
                  - rowgroup [ref=f2e345]:
                    - row [ref=f2e346] [cursor=pointer]:
                      - cell "生活场景 查看笔记 ↗" [ref=f2e347]:
                        - generic [ref=f2e348]:
                          - generic [ref=f2e349]: 生活场景
                          - generic [ref=f2e350]: 查看笔记 ↗
                      - cell "2" [ref=f2e351]
                      - cell "7万" [ref=f2e352]
                      - cell "500" [ref=f2e353]
                      - cell [ref=f2e354]:
                        - generic [ref=f2e355]:
                          - strong [ref=f2e357]: 66.67%
                          - progressbar [ref=f2e358]
                    - row [ref=f2e360] [cursor=pointer]:
                      - cell "产品科普 查看笔记 ↗" [ref=f2e361]:
                        - generic [ref=f2e362]:
                          - generic [ref=f2e363]: 产品科普
                          - generic [ref=f2e364]: 查看笔记 ↗
                      - cell "1" [ref=f2e365]
                      - cell "2万" [ref=f2e366]
                      - cell "100" [ref=f2e367]
                      - cell [ref=f2e368]:
                        - generic [ref=f2e369]:
                          - strong [ref=f2e371]: 33.33%
                          - progressbar [ref=f2e372]
          - generic [ref=f2e374]:
            - generic [ref=f2e375]:
              - generic [ref=f2e376]:
                - generic [ref=f2e377]: 三、内容效果
                - heading "内容效果深度分析" [level=3] [ref=f2e378]
              - generic [ref=f2e379]: 散点矩阵 · 分布直方图 · 箱线图
            - generic [ref=f2e380]:
              - generic [ref=f2e381]:
                - generic [ref=f2e382]:
                  - strong [ref=f2e383]: 笔记阅读与互动效果（散点图）
                  - generic [ref=f2e384]: X=阅读量 Y=互动量 · 3篇完整记录（含零值）· 点大小=采集评论数
                - generic [ref=f2e385]:
                  - text: 内容方向
                  - combobox "散点图内容方向" [ref=f2e387] [cursor=pointer]:
                    - generic [ref=f2e388]: 全部方向
                - img [ref=f2e392]:
                  - generic [ref=f2e393]: "0"
                  - generic [ref=f2e395]: "83"
                  - generic [ref=f2e397]: "165"
                  - generic [ref=f2e399]: "248"
                  - generic [ref=f2e401]: "330"
                  - generic [ref=f2e403]: "0"
                  - generic [ref=f2e405]: 1.1w
                  - generic [ref=f2e407]: 2.2w
                  - generic [ref=f2e409]: 3.3w
                  - generic [ref=f2e411]: 4.4w
                  - generic [ref=f2e413]: 阅读量
                  - generic [ref=f2e414]: 互动量
                  - generic [ref=f2e415] [cursor=pointer]
                  - generic [ref=f2e416] [cursor=pointer]
                  - generic [ref=f2e417] [cursor=pointer]
              - generic [ref=f2e418]:
                - generic [ref=f2e419]:
                  - strong [ref=f2e420]: 笔记阅读量分布直方图
                  - generic [ref=f2e421]: 3 篇有阅读数据的笔记
                - generic [ref=f2e423]:
                  - text: 已记录阅读量最多的区间：
                  - strong [ref=f2e424]: 1万–5万
                - img [ref=f2e427]:
                  - generic [ref=f2e428]: "0"
                  - generic [ref=f2e430]: "1"
                  - generic [ref=f2e432]: "2"
                  - generic [ref=f2e434]: "2"
                  - generic [ref=f2e436]: "3"
                  - generic [ref=f2e438] [cursor=pointer]: 0–1千
                  - generic [ref=f2e440] [cursor=pointer]: 1千–5千
                  - generic [ref=f2e442] [cursor=pointer]: 5千–1万
                  - generic [ref=f2e444] [cursor=pointer]: 1万–5万
                  - generic [ref=f2e447] [cursor=pointer]: 5万–10万
                  - generic [ref=f2e449] [cursor=pointer]: 10万–50万
                  - generic [ref=f2e451] [cursor=pointer]: 50万及以上
            - generic [ref=f2e453]:
              - generic [ref=f2e454]:
                - strong [ref=f2e455]: 达人层级互动量箱线图
                - generic [ref=f2e456]: 各层级已记录互动量分布（含零值，缺失不参与）
              - generic [ref=f2e457]:
                - generic [ref=f2e458]:
                  - generic [ref=f2e459]: 悬停、点击或用 Tab 聚焦层级，查看样本数与五项分布值
                  - button "当前：主体分布（常规范围）" [ref=f2e460] [cursor=pointer]
                - img [ref=f2e461]:
                  - generic [ref=f2e462]: "0"
                  - generic [ref=f2e464]: "3500"
                  - generic [ref=f2e466]: "7000"
                  - generic [ref=f2e468]: 1.1w
                  - generic [ref=f2e470]: 1.4w
                  - button "腰部，2 篇，中位数 250 互动" [ref=f2e472] [cursor=pointer]:
                    - generic [ref=f2e475]: 腰部
                    - generic [ref=f2e476]: n=2
                  - button "头部，1 篇，中位数 100 互动" [ref=f2e477] [cursor=pointer]:
                    - generic [ref=f2e480]: 头部
                    - generic [ref=f2e481]: n=1
          - generic [ref=f2e483]:
            - generic [ref=f2e485]:
              - generic [ref=f2e486]: TARGET VS ACTUAL
              - heading "KPI目标与实际" [level=3] [ref=f2e487]
              - generic [ref=f2e488]: 选择同一周期、代理、项目和渠道进行比较；总计与明细分别查看。
            - generic [ref=f2e489]:
              - generic [ref=f2e490]: ∅
              - heading "等待 KPI 数据" [level=3] [ref=f2e491]
              - paragraph [ref=f2e492]: 同步飞书数据后查看目标、实际和差额。
          - generic [ref=f2e493]:
            - generic [ref=f2e494]:
              - generic [ref=f2e495]:
                - generic [ref=f2e496]: 五、爆文排行
                - heading "高热内容 TOP20 排行榜" [level=3] [ref=f2e497]
              - generic [ref=f2e498]: 项目全量笔记按互动量排序
            - table [ref=f2e500]:
              - rowgroup [ref=f2e501]:
                - row [ref=f2e502]:
                  - columnheader "#" [ref=f2e503]
                  - columnheader "笔记标题" [ref=f2e504]
                  - columnheader "达人" [ref=f2e505]
                  - columnheader "内容方向" [ref=f2e506]
                  - columnheader "阅读量" [ref=f2e507]
                  - columnheader "互动量" [ref=f2e508]
                  - columnheader "评论数" [ref=f2e509]
                  - columnheader "互动率" [ref=f2e510]
              - rowgroup [ref=f2e511]:
                - row [ref=f2e512] [cursor=pointer]:
                  - cell [ref=f2e513]:
                    - strong [ref=f2e514]: "1"
                  - cell "受控启萃内容丙" [ref=f2e515]
                  - cell "受控达人2" [ref=f2e516]
                  - cell "生活场景" [ref=f2e517]
                  - cell "4万" [ref=f2e518]
                  - cell [ref=f2e519]:
                    - strong [ref=f2e520]: "300"
                  - cell "0" [ref=f2e521]
                  - cell "0.75%" [ref=f2e522]
                - row [ref=f2e523] [cursor=pointer]:
                  - cell [ref=f2e524]:
                    - strong [ref=f2e525]: "2"
                  - cell "受控启萃内容乙" [ref=f2e526]
                  - cell "受控达人1" [ref=f2e527]
                  - cell "生活场景" [ref=f2e528]
                  - cell "3万" [ref=f2e529]
                  - cell [ref=f2e530]:
                    - strong [ref=f2e531]: "200"
                  - cell "0" [ref=f2e532]
                  - cell "0.67%" [ref=f2e533]
                - row [ref=f2e534] [cursor=pointer]:
                  - cell [ref=f2e535]:
                    - strong [ref=f2e536]: "3"
                  - cell "受控启萃内容甲" [ref=f2e537]
                  - cell "受控达人0" [ref=f2e538]
                  - cell "产品科普" [ref=f2e539]
                  - cell "2万" [ref=f2e540]
                  - cell [ref=f2e541]:
                    - strong [ref=f2e542]: "100"
                  - cell "0" [ref=f2e543]
                  - cell "0.50%" [ref=f2e544]
          - generic [ref=f2e545]:
            - generic [ref=f2e546]:
              - generic [ref=f2e547]:
                - generic [ref=f2e548]:
                  - generic [ref=f2e549]:
                    - generic [ref=f2e550]: 数据覆盖
                    - heading "内容数据与待办" [level=3] [ref=f2e551]
                  - generic [ref=f2e552]: 真实记录覆盖情况
                - generic [ref=f2e553]:
                  - generic [ref=f2e554]:
                    - text: 当前项目笔记
                    - generic [ref=f2e555]:
                      - strong [ref=f2e556]: "3"
                      - text: 篇
                  - generic [ref=f2e557]:
                    - text: 已记录阅读量
                    - generic [ref=f2e558]:
                      - strong [ref=f2e559]: "3"
                      - text: 篇（含零值）
                  - generic [ref=f2e560]:
                    - text: 阅读和互动均有记录
                    - generic [ref=f2e561]:
                      - strong [ref=f2e562]: "3"
                      - text: 篇
                  - generic [ref=f2e563]:
                    - text: 风险待处理
                    - generic [ref=f2e564]:
                      - strong [ref=f2e565]: "0"
                      - text: 条
                - paragraph [ref=f2e566]: 分布图覆盖当前项目全部已收录笔记；评论来自采集快照，不串联为用户转化漏斗。内容最新有效日期：2026-09-30。
                - link "查看风险待办 →" [ref=f2e567] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
              - generic [ref=f2e568]:
                - generic [ref=f2e569]:
                  - generic [ref=f2e570]:
                    - generic [ref=f2e571]: 字段覆盖
                    - heading "内容分析还缺哪些数据" [level=3] [ref=f2e572]
                  - generic [ref=f2e573]: 按全量笔记核对
                - generic [ref=f2e574]:
                  - generic [ref=f2e576]:
                    - generic [ref=f2e577]: 内容方向
                    - generic [ref=f2e578]:
                      - generic [ref=f2e579]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=f2e580]: 100.0%
                  - generic [ref=f2e584]:
                    - generic [ref=f2e585]: 达人层级
                    - generic [ref=f2e586]:
                      - generic [ref=f2e587]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=f2e588]: 100.0%
                  - generic [ref=f2e592]:
                    - generic [ref=f2e593]: 阅读量
                    - generic [ref=f2e594]:
                      - generic [ref=f2e595]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=f2e596]: 100.0%
                  - generic [ref=f2e600]:
                    - generic [ref=f2e601]: 互动量
                    - generic [ref=f2e602]:
                      - generic [ref=f2e603]: 3 篇有记录 · 0 篇待补充
                      - strong [ref=f2e604]: 100.0%
                - paragraph [ref=f2e607]: 方向缺失的笔记仍计入阅读和互动总量；不参与已标注方向的效果判断。
            - generic [ref=f2e608]:
              - generic [ref=f2e609]:
                - generic [ref=f2e610]:
                  - generic [ref=f2e611]: 达人效率
                  - heading "达人层级效率排行榜" [level=3] [ref=f2e612]
                - generic [ref=f2e613]: 按篇均CPE升序，缺失排末尾
              - generic [ref=f2e614]:
                - generic "点击查看该层级笔记" [ref=f2e615] [cursor=pointer]:
                  - generic [ref=f2e616]:
                    - generic [ref=f2e617]:
                      - generic [ref=f2e618]: "1"
                      - strong [ref=f2e619]: 腰部
                    - generic [ref=f2e620]: 篇均CPE ¥10.00
                  - generic [ref=f2e621]:
                    - generic [ref=f2e622]:
                      - text: 笔记数
                      - strong [ref=f2e623]: "2"
                    - generic [ref=f2e624]:
                      - text: 均阅读
                      - strong [ref=f2e625]: 3.5万
                    - generic [ref=f2e626]:
                      - text: 均互动
                      - strong [ref=f2e627]: "250"
                    - generic [ref=f2e628]:
                      - text: 均CPE
                      - strong [ref=f2e629]: ¥10.0
                - generic "点击查看该层级笔记" [ref=f2e630] [cursor=pointer]:
                  - generic [ref=f2e631]:
                    - generic [ref=f2e632]:
                      - generic [ref=f2e633]: "2"
                      - strong [ref=f2e634]: 头部
                    - generic [ref=f2e635]: 篇均CPE ¥10.00
                  - generic [ref=f2e636]:
                    - generic [ref=f2e637]:
                      - text: 笔记数
                      - strong [ref=f2e638]: "1"
                    - generic [ref=f2e639]:
                      - text: 均阅读
                      - strong [ref=f2e640]: 2万
                    - generic [ref=f2e641]:
                      - text: 均互动
                      - strong [ref=f2e642]: "100"
                    - generic [ref=f2e643]:
                      - text: 均CPE
                      - strong [ref=f2e644]: ¥10.0
          - generic [ref=f2e645]:
            - generic [ref=f2e646]:
              - generic [ref=f2e647]:
                - generic [ref=f2e648]: 互动质量
                - heading "已记录点赞、收藏与分享构成" [level=3] [ref=f2e649]
              - generic [ref=f2e650]: 比例仅在三项已记录指标中计算
            - generic [ref=f2e651]:
              - generic [ref=f2e653]:
                - generic [ref=f2e655]:
                  - generic [ref=f2e656]:
                    - generic [ref=f2e657]: ♥
                    - generic [ref=f2e658]: 点赞
                  - generic [ref=f2e659]:
                    - text: "420"
                    - generic [ref=f2e660]: 70.0%
                - generic [ref=f2e664]:
                  - generic [ref=f2e665]:
                    - generic [ref=f2e666]: ★
                    - generic [ref=f2e667]: 收藏
                  - generic [ref=f2e668]:
                    - text: "120"
                    - generic [ref=f2e669]: 20.0%
                - generic [ref=f2e673]:
                  - generic [ref=f2e674]:
                    - generic [ref=f2e675]: ↗
                    - generic [ref=f2e676]: 分享
                  - generic [ref=f2e677]:
                    - text: "60"
                    - generic [ref=f2e678]: 10.0%
              - generic [ref=f2e681]:
                - generic [ref=f2e682]: 互动质量洞察
                - generic [ref=f2e683]:
                  - generic [ref=f2e684]:
                    - generic [ref=f2e685]: 点赞占比
                    - generic [ref=f2e686]: 70.0%
                    - generic [ref=f2e687]: 浅层互动，反映内容吸引力
                  - generic [ref=f2e688]:
                    - generic [ref=f2e689]: 收藏占比
                    - generic [ref=f2e690]: 20.0%
                    - generic [ref=f2e691]: 深度互动，反映内容价值密度
                  - generic [ref=f2e692]:
                    - generic [ref=f2e693]: 分享占比
                    - generic [ref=f2e694]: 10.0%
                    - generic [ref=f2e695]: 采集评论单独查看，不计入此构成
          - generic [ref=f2e696]:
            - generic [ref=f2e697]:
              - generic [ref=f2e698]:
                - generic [ref=f2e699]: 行动层
                - heading "复盘洞察与下一步行动" [level=3] [ref=f2e700]
              - generic [ref=f2e701]: 从数据直接进入运营
            - generic [ref=f2e702]:
              - generic [ref=f2e703]:
                - strong [ref=f2e704]: 当前观察
                - paragraph [ref=f2e705]: 内容库共 3 篇，累计互动 600 次。已标注的内容方向中，生活场景收录最多。
                - paragraph [ref=f2e706]: 当前真实评论快照合计 0 条，正向 0 条，负向 0 条。继续优先处理待回复和待删除事项。
              - generic [ref=f2e707]:
                - link "处理 0 条风险待办 达人回复与删除处置 去处理 →" [ref=f2e708] [cursor=pointer]:
                  - /url: /projects/qicui/comments?tab=actions
                  - generic [ref=f2e709]:
                    - strong [ref=f2e710]: 处理 0 条风险待办
                    - generic [ref=f2e711]: 达人回复与删除处置
                  - generic [ref=f2e712]: 去处理 →
                - link "复盘高热内容与切角 阅读、互动与达人效率 看内容 →" [ref=f2e713] [cursor=pointer]:
                  - /url: /projects/qicui/content?tab=analysis
                  - generic [ref=f2e714]:
                    - strong [ref=f2e715]: 复盘高热内容与切角
                    - generic [ref=f2e716]: 阅读、互动与达人效率
                  - generic [ref=f2e717]: 看内容 →
                - link "对照竞品月报与搜索趋势 使用已接入的品牌工作表 看竞品 →" [ref=f2e718] [cursor=pointer]:
                  - /url: /projects/qicui/growth?tab=competitor
                  - generic [ref=f2e719]:
                    - strong [ref=f2e720]: 对照竞品月报与搜索趋势
                    - generic [ref=f2e721]: 使用已接入的品牌工作表
                  - generic [ref=f2e722]: 看竞品 →
          - group [ref=f2e723]:
            - generic "查看指标定义与口径说明" [ref=f2e724]
        - dialog [ref=f2e725]:
          - generic [ref=f2e726]:
            - generic [ref=f2e727]:
              - heading "团队业务组件布局" [level=3] [ref=f2e728]
              - button "关闭弹窗" [ref=f2e729] [cursor=pointer]: ✕
            - generic [ref=f2e730]:
              - paragraph [ref=f2e731]: 选择团队显示的既有业务组件，并用上下按钮调整顺序。保留数据、业务规则、目标和项目指标。日报与总览共用此配置。
              - alert [active] [ref=f2e732]: 团队看板已更新，请保留选择并读取最新版本后确认
              - button "读取最新布局版本并保留选择（服务端 v3）" [ref=f2e733] [cursor=pointer]
              - generic [ref=f2e734]:
                - generic [ref=f2e735]:
                  - generic [ref=f2e736]:
                    - checkbox "显示今日指标与待办" [checked] [ref=f2e737]
                    - generic [ref=f2e738]:
                      - text: 今日指标与待办
                      - generic [ref=f2e739]: 总览
                  - generic [ref=f2e740]:
                    - button "上移今日指标与待办" [disabled] [ref=f2e741]: ↑
                    - button "下移今日指标与待办" [ref=f2e742] [cursor=pointer]: ↓
                - generic [ref=f2e743]:
                  - generic [ref=f2e744]:
                    - checkbox "显示预算消耗节奏对比" [checked] [ref=f2e745]
                    - generic [ref=f2e746]:
                      - text: 预算消耗节奏对比
                      - generic [ref=f2e747]: 总览
                  - generic [ref=f2e748]:
                    - button "上移预算消耗节奏对比" [ref=f2e749] [cursor=pointer]: ↑
                    - button "下移预算消耗节奏对比" [ref=f2e750] [cursor=pointer]: ↓
                - generic [ref=f2e751]:
                  - generic [ref=f2e752]:
                    - checkbox "显示KFS投流与采买结构" [ref=f2e753]
                    - generic [ref=f2e754]:
                      - text: KFS投流与采买结构
                      - generic [ref=f2e755]: 总览
                  - generic [ref=f2e756]:
                    - button "上移KFS投流与采买结构" [ref=f2e757] [cursor=pointer]: ↑
                    - button "下移KFS投流与采买结构" [ref=f2e758] [cursor=pointer]: ↓
                - generic [ref=f2e759]:
                  - generic [ref=f2e760]:
                    - checkbox "显示种草发布与切角渗透" [checked] [ref=f2e761]
                    - generic [ref=f2e762]:
                      - text: 种草发布与切角渗透
                      - generic [ref=f2e763]: 总览
                  - generic [ref=f2e764]:
                    - button "上移种草发布与切角渗透" [ref=f2e765] [cursor=pointer]: ↑
                    - button "下移种草发布与切角渗透" [ref=f2e766] [cursor=pointer]: ↓
                - generic [ref=f2e767]:
                  - generic [ref=f2e768]:
                    - checkbox "显示内容效果深度分析" [checked] [ref=f2e769]
                    - generic [ref=f2e770]:
                      - text: 内容效果深度分析
                      - generic [ref=f2e771]: 总览
                  - generic [ref=f2e772]:
                    - button "上移内容效果深度分析" [ref=f2e773] [cursor=pointer]: ↑
                    - button "下移内容效果深度分析" [ref=f2e774] [cursor=pointer]: ↓
                - generic [ref=f2e775]:
                  - generic [ref=f2e776]:
                    - checkbox "显示内容与投放关键指标对比" [checked] [ref=f2e777]
                    - generic [ref=f2e778]:
                      - text: 内容与投放关键指标对比
                      - generic [ref=f2e779]: 总览
                  - generic [ref=f2e780]:
                    - button "上移内容与投放关键指标对比" [ref=f2e781] [cursor=pointer]: ↑
                    - button "下移内容与投放关键指标对比" [ref=f2e782] [cursor=pointer]: ↓
                - generic [ref=f2e783]:
                  - generic [ref=f2e784]:
                    - checkbox "显示高热内容TOP20" [checked] [ref=f2e785]
                    - generic [ref=f2e786]:
                      - text: 高热内容TOP20
                      - generic [ref=f2e787]: 总览
                  - generic [ref=f2e788]:
                    - button "上移高热内容TOP20" [ref=f2e789] [cursor=pointer]: ↑
                    - button "下移高热内容TOP20" [ref=f2e790] [cursor=pointer]: ↓
                - generic [ref=f2e791]:
                  - generic [ref=f2e792]:
                    - checkbox "显示内容覆盖与达人效率" [checked] [ref=f2e793]
                    - generic [ref=f2e794]:
                      - text: 内容覆盖与达人效率
                      - generic [ref=f2e795]: 总览
                  - generic [ref=f2e796]:
                    - button "上移内容覆盖与达人效率" [ref=f2e797] [cursor=pointer]: ↑
                    - button "下移内容覆盖与达人效率" [ref=f2e798] [cursor=pointer]: ↓
                - generic [ref=f2e799]:
                  - generic [ref=f2e800]:
                    - checkbox "显示点赞收藏分享与互动质量" [checked] [ref=f2e801]
                    - generic [ref=f2e802]:
                      - text: 点赞收藏分享与互动质量
                      - generic [ref=f2e803]: 总览
                  - generic [ref=f2e804]:
                    - button "上移点赞收藏分享与互动质量" [ref=f2e805] [cursor=pointer]: ↑
                    - button "下移点赞收藏分享与互动质量" [ref=f2e806] [cursor=pointer]: ↓
                - generic [ref=f2e807]:
                  - generic [ref=f2e808]:
                    - checkbox "显示复盘洞察与下一步行动" [checked] [ref=f2e809]
                    - generic [ref=f2e810]:
                      - text: 复盘洞察与下一步行动
                      - generic [ref=f2e811]: 总览
                  - generic [ref=f2e812]:
                    - button "上移复盘洞察与下一步行动" [ref=f2e813] [cursor=pointer]: ↑
                    - button "下移复盘洞察与下一步行动" [ref=f2e814] [cursor=pointer]: ↓
                - generic [ref=f2e815]:
                  - generic [ref=f2e816]:
                    - checkbox "显示指标口径说明" [checked] [ref=f2e817]
                    - generic [ref=f2e818]:
                      - text: 指标口径说明
                      - generic [ref=f2e819]: 总览
                  - generic [ref=f2e820]:
                    - button "上移指标口径说明" [ref=f2e821] [cursor=pointer]: ↑
                    - button "下移指标口径说明" [ref=f2e822] [cursor=pointer]: ↓
                - generic [ref=f2e823]:
                  - generic [ref=f2e824]:
                    - checkbox "显示日报核心指标与前日比较" [checked] [ref=f2e825]
                    - generic [ref=f2e826]:
                      - text: 日报核心指标与前日比较
                      - generic [ref=f2e827]: 日报
                  - generic [ref=f2e828]:
                    - button "上移日报核心指标与前日比较" [ref=f2e829] [cursor=pointer]: ↑
                    - button "下移日报核心指标与前日比较" [ref=f2e830] [cursor=pointer]: ↓
                - generic [ref=f2e831]:
                  - generic [ref=f2e832]:
                    - checkbox "显示计划消耗与点击效率趋势" [checked] [ref=f2e833]
                    - generic [ref=f2e834]:
                      - text: 计划消耗与点击效率趋势
                      - generic [ref=f2e835]: 日报
                  - generic [ref=f2e836]:
                    - button "上移计划消耗与点击效率趋势" [ref=f2e837] [cursor=pointer]: ↑
                    - button "下移计划消耗与点击效率趋势" [ref=f2e838] [cursor=pointer]: ↓
                - generic [ref=f2e839]:
                  - generic [ref=f2e840]:
                    - checkbox "显示UV成本与每日效率对比" [checked] [ref=f2e841]
                    - generic [ref=f2e842]:
                      - text: UV成本与每日效率对比
                      - generic [ref=f2e843]: 日报
                  - generic [ref=f2e844]:
                    - button "上移UV成本与每日效率对比" [ref=f2e845] [cursor=pointer]: ↑
                    - button "下移UV成本与每日效率对比" [disabled] [ref=f2e846]: ↓
                - button "恢复全部业务组件与默认顺序" [ref=f2e847] [cursor=pointer]
            - generic [ref=f2e848]:
              - button "取消布局修改" [ref=f2e849] [cursor=pointer]
              - button "发布业务组件布局" [disabled] [ref=f2e850]
      - generic [ref=f2e851]:
        - generic [ref=f2e853]:
          - generic [ref=f2e854]: 团队看板
          - heading "项目指标与图表" [level=3] [ref=f2e855]
        - generic [ref=f2e856]:
          - generic [ref=f2e857]:
            - generic [ref=f2e858]:
              - generic [ref=f2e859]: "当前业务数据集:"
              - combobox "当前业务数据集" [ref=f2e861] [cursor=pointer]:
                - generic [ref=f2e862]: 补修数据 (2 行)
            - generic [ref=f2e865]:
              - generic [ref=f2e866]:
                - button "📊 看板视图" [ref=f2e867] [cursor=pointer]
                - button "📋 数据明细 (2 行)" [ref=f2e868] [cursor=pointer]
              - generic [ref=f2e869]:
                - button "＋ 添加卡片" [ref=f2e870] [cursor=pointer]
                - button "✓ 保存并发布看板" [ref=f2e871] [cursor=pointer]
                - button "取消编辑" [ref=f2e872] [cursor=pointer]
          - region "项目周期与共同筛选" [ref=f2e873]:
            - generic [ref=f2e874]:
              - generic [ref=f2e875]:
                - text: 开始日期
                - textbox "项目开始日期" [ref=f2e876]
              - generic [ref=f2e877]:
                - text: 结束日期
                - textbox "项目结束日期" [ref=f2e878]
              - generic [ref=f2e879]:
                - text: 共同筛选字段
                - combobox "共同筛选字段" [ref=f2e881] [cursor=pointer]:
                  - generic [ref=f2e882]: 不筛选
              - button "清除周期与筛选" [ref=f2e885] [cursor=pointer]
            - paragraph [ref=f2e886]: 发布时保存为团队默认周期与筛选。日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。
          - generic [ref=f2e887]:
            - generic [ref=f2e888]:
              - generic [ref=f2e889]: 您正在编辑看板布局。您可以添加卡片、修改指标规则、调整顺序或删除卡片。修改完成后点击「保存并发布看板」。
              - generic [ref=f2e890]: "版本: v3"
            - article "组件发布期间保留的草稿1280" [ref=f2e892]:
              - generic [ref=f2e893]:
                - button "←" [disabled] [ref=f2e894]
                - button "→" [disabled] [ref=f2e895]
                - button "✏" [ref=f2e896] [cursor=pointer]
                - button "✕" [ref=f2e897] [cursor=pointer]
              - generic [ref=f2e898]:
                - generic [ref=f2e899]: 组件发布期间保留的草稿1280
                - generic [ref=f2e901]: "2"
              - generic [ref=f2e902]:
                - generic [ref=f2e903]: "来源: 补修数据"
                - generic [ref=f2e904]: 指标 v1 · 跟随最新 · 数据 v1
                - generic [ref=f2e905]: "有效样本: 2 行"
                - generic [ref=f2e906]: 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai
      - generic [ref=f2e907]:
        - generic [ref=f2e909]:
          - generic [ref=f2e910]: AI 复盘
          - heading "基于项目数据生成运营报告" [level=3] [ref=f2e911]
        - generic [ref=f2e912]:
          - textbox "报告需求" [ref=f2e913]: 根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。
          - button "生成复盘报告" [ref=f2e914] [cursor=pointer]
  - button "打开智能助手" [ref=f2e915] [cursor=pointer]:
    - generic [ref=f2e917]: 智
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
  32 |   const actual = await (await request.get('/api/dashboard?projectId=qicui&fresh=1', { headers: editor })).json(); expect(actual.notes.filter((note: { title: string }) => note.title.startsWith('受控启萃内容')).length).toBe(3); expect(actual.metrics.readCount).toBe(90000); expect(actual.metrics.interactionCount).toBe(600); expect(actual.feishu.daily.at(-1)).toMatchObject({ date: '2026-09-30', actual_spend: 400, plan_spend: 500, feed_ctr: 2, search_ctr: 3, achieve_pct: 80 });
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
  60 |     await page.setViewportSize({ width, height: 900 }); await prepare(page, request); await page.getByRole('button', { name: /分日 · 日报监控看板/ }).click(); const daily = page.getByTestId('business-component-board-daily');
  61 |     await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400'); await expect(daily.locator('.reference-kpi').filter({ hasText: '信息流 CTR' })).toContainText('2'); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toBeVisible();
  62 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await dialog.getByRole('checkbox', { name: '显示计划消耗与点击效率趋势', exact: true }).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '近30个数据日 · 计划与实际', exact: true })).toHaveCount(0); await expect(daily.locator('.reference-kpi').filter({ hasText: '当日实际消耗' })).toContainText('400');
  63 |     await page.screenshot({ path: info.outputPath('daily-component-filtered-with-real-values.png'), fullPage: true });
  64 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const checked = dialog.getByRole('checkbox'); for (let i = 0; i < await checked.count(); i++) await checked.nth(i).uncheck(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.reload(); await expect(daily).toContainText('本视图未选择业务组件'); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toHaveCount(0);
  65 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); await dialog.getByRole('button', { name: '恢复全部业务组件与默认顺序', exact: true }).click(); await dialog.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(daily.getByRole('heading', { name: '信息流与搜索 · 点击效率', exact: true })).toBeVisible();
  66 |   });
  67 |   test(`共享卡片保护 ${width}px：组件发布不覆盖正在编辑的标题草稿，按真实冲突版本重试仍保留已发布组件选择`, async ({ page, request }) => {
  68 |     const draftTitle = '组件发布期间保留的草稿' + width; await page.setViewportSize({ width, height: 900 }); await prepare(page, request);
  69 |     await connectExistingProjectTable(page, request, 'qicui', [['任务'], ['本项目记录甲'], ['本项目记录乙']], 'ComponentOwn-' + Date.now());
  70 |     const source = (await (await request.get('/api/datasets?projectId=qicui', { headers: editor })).json()).datasets.find((item: { sourceId: string; name: string }) => item.name === '补修数据');
  71 |     const created = await request.post('/api/metric-definitions', { headers: editor, data: { action: 'save', projectId: 'qicui', name: '组件场景独立记录' + Date.now(), expectedVersion: 0, config: { datasetId: source.id, aggregation: 'count' } } }); expect(created.status()).toBe(200); const definition = await created.json();
  72 |     await page.goto('/projects/qicui/metrics'); await page.getByRole('row').filter({ has: page.getByRole('cell', { name: definition.config.title, exact: true }) }).getByRole('button', { name: '加入看板', exact: true }).click(); await page.getByRole('button', { name: '加入草稿', exact: true }).click();
  73 |     const first = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await first).status()).toBe(200); await dismissProjectNotifications(page);
  74 |     await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); const card = page.getByRole('article', { name: definition.config.title, exact: true }); await card.getByTitle('编辑卡片', { exact: true }).click(); const cardDialog = page.getByRole('dialog'); await cardDialog.getByLabel('卡片标题', { exact: true }).fill(draftTitle); await cardDialog.getByRole('button', { name: '加入草稿', exact: true }).click();
> 75 |     await page.getByRole('button', { name: '配置业务组件布局', exact: true }).click(); const layout = page.getByRole('dialog', { name: '团队业务组件布局', exact: true }); await layout.getByRole('checkbox', { name: '显示KFS投流与采买结构', exact: true }).uncheck(); await layout.getByRole('button', { name: '发布业务组件布局', exact: true }).click(); await expect(layout).toHaveCount(0); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toContainText('2');
     |                                                                                                                                                                                                                                                                                                                                                   ^ Error: expect(locator).toHaveCount(expected) failed
  76 |     const conflict = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST'); await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await conflict).status()).toBe(409); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toBeVisible();
  77 |     await page.getByRole('button', { name: '强制覆盖发布', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload(); await expect(page.getByRole('article', { name: draftTitle, exact: true })).toContainText('2'); await expect(page.getByRole('heading', { name: 'KFS 投流与采买结构', exact: true })).toHaveCount(0);
  78 |   });
  79 | }
  80 | 
```