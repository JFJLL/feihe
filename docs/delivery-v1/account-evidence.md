# 飞鹤启萃业务取数范围与账号证据清单

## 概述与调研结论

本调研严格采用只读方式核查自动化工程（`automation`）、飞书投流/日报/周报底表及阿里云 OSS 凭据存储（`oss://redmagic/token/`），未修改任何业务代码、未上传 Cookie、未写入任何飞书表格或广告投放。

通过对各平台实际请求及业务源表核对，得出以下确定性映射：
1. **京准通（JZT）**：已证实绑定启萃账号 `99950005910`（PIN：`jd_662553458d284`），对启萃真实任务（`204611`）请求完全成功并获得 2026-10-13 完整明细；对卓睿任务请求返回无权限，证明为启萃专属项目账号，已具备真实联调条件。
2. **聚光平台（Juguang）**：已在 OSS 验证启萃日常 F（`6936b2c7252ae100150c5eed`）与日常 S（`693a30f7d20c840015ca168e`）凭据对象有效且为最新（2026-10-13 23:57 上传）。2026-10-13 窄日汇总只读请求 HTTP 200 成功，当日 F 消耗 ¥100,193.83、S 消耗 ¥230,245.68。已证实两账户身份与可读状态。
3. **日常 F/S 与电商/对投的范围边界**：
   - **已证实账户身份与可读**：日常 F（信息流）与日常 S（搜索）在聚光上为两个物理分离的子账户，其账户身份与数据可读性已获验证；
   - **业务标签独立与未确认差异**：日常 F/S、电商易美（`694e2a7e4d79260023c08dd8` / `6a9a8a9253dc4600154e5c33`）及京东对投易美（`6a5ec49d57a1ab0015d2e4d5`）属于不同业务标签，应独立配置。
   - **数值差异提示**：2026-10-13 聚光平台只读汇总消耗 F（¥100,193.83）+ S（¥230,245.68）= ¥330,439.51，而核验同日日报底表广告消耗为 ¥275,326.74。两者存在约 ¥55,112.77 差异，具体扣除/分成口径或整体纳入范围尚未完整验证，不能判定为已对账一致，原因仍未确认。
4. **淘宝星河（AdStar）**：OSS 凭据 `KOL/adstar.txt`（最后更新时间 2026-10-14 09:00）当前登录用户为 `levit0108`（淘宝主账号 `unb=2968129741`）。真实只读检索星河订单接口成功（HTTP 200），证实包含 58 个启萃任务（如 10月/9月“小红星-旗舰店”任务 `117498869`、`117484428`），证明该服务商账号具备管理飞鹤启萃官方旗舰店星河推广订单的真实权限，可直接联调。
5. **灵犀平台（Lingxi）**：OSS 现有凭据对象 `token/lingxi/lingxi_cookie.txt` 发起接口只读请求返回 `HTTP 401 (code: 90180103, 请先登录)`，登录已失效。且本地数据库仅记录非飞鹤任务（童装监控），无飞鹤/启萃品线专用配置，当前无法真实联调，需等待服务商更新有效 Cookie。
6. **评论采集账号**：自动化代码与数据库中无任何自动化小红书笔记评论采集爬虫或专用登录凭据引用。经核查运营日报记录，启萃评论区维护系由外部供应商及执行人员人工在客户端发布，看板评论数据目前依赖飞书多维表格/手动填报，无法通过已有自动化系统调取采集凭据。

---

## 账号与业务取数范围映射表

| 平台 | 账号 ID / PIN | 业务用途 | 主/核对来源 | 核心证据 | 凭据引用路径 | 可否真实联调 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **京准通 (JZT)** | `99950005910`<br>(PIN: `jd_662553458d284`) | 启萃小红盟投流与转化进店归因 | `jzt_sync/configs/all_tasks_merged.json`<br>`sync_console/tokens/jzt_token.txt` | 实测只读调用 `downloadGrassDailyData` 抓取启萃任务 `204611` 成功下载 2026-10-13 报表（新客 UV 1700）；调用卓睿任务（`204314`）明确返回“无权限”，证实为启萃绑定账号。 | `sync_console/tokens/jzt_token.txt`<br>`[qicui]` 节点（Cookie 正常） | **可联调** |
| **聚光 (日常 F)** | `6936b2c7252ae100150c5eed`<br>(飞鹤-婴配-启萃-日常-易美-F) | 启萃日常信息流广告投放与消耗 | `juguang_subaccounts.json`<br>`embedded-daily.summary.json`<br>周趋势底表 `anQnEc` | 实测 OSS 凭据请求 `report` 接口成功（HTTP 200，code 0），2026-10-13 单日消耗 ¥100,193.83、曝光 746,878、点击 45,085。已证实身份与可读，但同日底表消耗存在数值差异，未完整对账。 | `oss://redmagic/token/juguang/6936b2c7252ae100150c5eed.txt` | **可联调** |
| **聚光 (日常 S)** | `693a30f7d20c840015ca168e`<br>(飞鹤-婴配-启萃-日常-易美-S) | 启萃日常搜索广告投放与关键词消耗 | `juguang_subaccounts.json`<br>`embedded-daily.summary.json`<br>周趋势底表 `anQnEc` | 实测 OSS 凭据请求 `report` 接口成功（HTTP 200，code 0），2026-10-13 单日消耗 ¥230,245.68、曝光 350,948、点击 23,274。已证实身份与可读，但同日底表消耗存在数值差异，未完整对账。 | `oss://redmagic/token/juguang/693a30f7d20c840015ca168e.txt` | **可联调** |
| **聚光 (电商/对投)** | `694e2a7e4d79260023c08dd8`<br>`6a9a8a9253dc4600154e5c33`<br>`6a5ec49d57a1ab0015d2e4d5` | 启萃电商引流及京东对投专项 | `juguang_subaccounts.json`<br>`weekly.summary.json` (对投KPI监测表) | 日常 F/S 与电商、京东对投分属不同业务标签，应独立配置；各账户具体整体纳入范围与扣减关系尚未完整验证。 | 需对应 OSS `token/juguang/{sub_id}.txt`（日常联调无需引入） | 须独立配置待核实 |
| **淘宝星河 (AdStar)** | `levit0108`<br>(`unb=2968129741`) | 启萃小红星跨域淘系进店与成交转化归因 | `feishu_three_sync/taobao/adstar.txt`<br>`feishu_three_sync/taobao/PROJECT.md`<br>`oct-execution.csv.json` | 实测只读请求星河订单列表接口成功（HTTP 200），搜索返回 58 个启萃专属订单（含 10 月任务 `117498869` 婴配-启萃-日常-10月-旗舰店-小红星），证实该服务商账号直接管理启萃店铺推广订单。 | `oss://redmagic/KOL/adstar.txt`<br>本地 `automation/feishu_three_sync/taobao/adstar.txt` | **可联调** |
| **灵犀 (Lingxi)** | 服务商通用 Cookie<br>(`xsecappid=ads-idea`) | 飞鹤品牌与启萃品线人群资产 (I/TI) 分析 | `lingxi_service/client.py`<br>`sync_console/tokens/lingxi.json`<br>`weekly.summary.json` | 历史周报包含“早阶I+TI（灵犀）”指标；但实测当前 OSS 凭据 `token/lingxi/lingxi_cookie.txt` 请求 `tag/search` 接口返回 HTTP 401（未登录），凭据已过期。 | `oss://redmagic/token/lingxi/lingxi_cookie.txt` | **暂不可联调** (凭据失效需更新) |
| **小红书评论采集** | 无自动化账号凭据 | 笔记评论监控、违规排查与评论区种草维护 | `comment-planning-doc.json`<br>`comment-violations-doc.json`<br>`feedback-doc.json` | 自动化项目内无笔记评论爬虫模块；文档明确记录维评系通过“常规真人账号、自养百粉账号”在客户端人工/服务商发布，看板评论数当前主要依赖飞书底表录入。 | 无自动化配置文件或凭据对象 | **无法联调** (无爬虫系统) |

---

## 验证明细与证据链路（供同步 Worker 核对）

### 1. 京准通（JZT）实证
- **请求接口**：`POST https://jzt-api.jd.com/jrw/content/outside/demand/report/downloadGrassDailyData`
- **请求参数**：`taskId="204611"`, `dataCycle="30"`, `brandId="6731"`, `type="2"`, `dataScope="2"`, `dimension="2"`, `trafficSource="1"`
- **凭据来源**：`sync_console/tokens/jzt_token.txt` 中的 `[qicui]` 节点（账号 `99950005910`）
- **只读测试回执**：
  * 返回 Excel 文件流（HTTP 200，size 10,047 bytes）；
  * 解析 2026-10-13 结果：`阅读UV: 60958`, `点赞UV: 699`, `收藏UV: 348`, `分享UV: 140`, `关注UV: 107`, `互动UV: 1294`, `新客进店UV: 1700`, `新客UV: 106`, `下单GMV: 0.0`；
  * 对比请求卓睿任务 `204314`：返回 `{"code":0,"msg":"任务不存在或商家无此任务权限"}`。
  * **结论**：账号已严格绑定启萃，具备生产联调能力。

### 2. 聚光（Juguang）实证
- **OSS 凭据对象与时效**：
  * `token/juguang/6936b2c7252ae100150c5eed.txt`（803 字节，最后修改时间 `2026-10-13 23:57:55`）；
  * `token/juguang/693a30f7d20c840015ca168e.txt`（803 字节，最后修改时间 `2026-10-13 23:57:53`）。
- **请求接口**：`POST https://ad.xiaohongshu.com/api/leona/rtb/common/data/report`
- **请求参数**：`startDate="2026-10-13"`, `endDate="2026-10-13"`, `timeUnit="DAY"`, `dataSource="account"`, `dataPattern="table"`, `columns=["time", "fee", "impression", "click"]`
- **只读测试回执**：
  * 日常 F（`6936b2c7252ae100150c5eed`）：`HTTP 200`，`code: 0`，`dataList` 返回 `fee: 100193.83`, `impression: 746878`, `click: 45085`；
  * 日常 S（`693a30f7d20c840015ca168e`）：`HTTP 200`，`code: 0`，`dataList` 返回 `fee: 230245.68`, `impression: 350948`, `click: 23274`。
- **差异记录**：
  * 两子账号 F + S 平台消耗合计 ¥330,439.51；
  * 已核验 10/13 日报广告消耗为 ¥275,326.74；
  * 两者差异约 ¥55,112.77，原因尚未确认（可能涉及服务费扣除、返点折算或统计口径差异），各业务标签需保持独立配置，不可仅凭名称判定对账吻合。

### 3. 淘宝星河（AdStar）实证
- **OSS 凭据对象**：`KOL/adstar.txt`（最后修改时间 `2026-10-14 09:00:59`），登录账号 `levit0108`（淘宝主账号 `unb=2968129741`）。
- **请求接口**：`GET https://adstar.alimama.com/api/one/order/list`
- **请求参数**：`saleType=1`, `keyword="启萃"`, `keywordType=103`, `pageNo=1`, `pageSize=5`
- **只读测试回执**：
  * 返回 `HTTP 200`，`success: True`，`totalCount: 58`；
  * 命中订单样本：`117498869`（婴配-启萃-日常-10月-旗舰店-小红星）、`117484428`（婴配-启萃-日常-9月-官方店-小红星）。
  * **结论**：服务商账号 `levit0108` 拥有启萃官方旗舰店订单的读取权限，可供跨域转化归因联调。

### 4. 灵犀与评论区现状与阻塞原因
- **灵犀失效回执**：请求 `POST https://idea.xiaohongshu.com/api/idea/audience/group/tag/search`（带参数 `searchKey="飞鹤"`），返回 `HTTP 401`，`code: 90180103`，`msg: "请先登录"`。OSS 现有凭据过期，需等待重签。
- **评论采集系统定位**：自动化代码库中未实现针对小红书移动端/Web 端的笔记评论采集爬虫，缺乏相关账号凭据与数据接口，当前无法开展自动化联调。

---
---
## 生产部署拓扑与真实评论系统核查（第四批补充核验）

根据生产环境部署拓扑及本地工程代码深入核查，针对 ECS 云服务器（公网 IP `123.56.84.130`，实例 `i-2ze3iuvvj4dh738iw1pi`）、局域网自动化同步设备（`172.16.10.45`）及本地采集实现（`comment/app.py`、`feihe-mvp/lib/xhs.ts`），确认真实服务与评论采集能力如下：

### 1. 独立评论采集服务（`comment/app.py`）定位与能力实证
- **服务定位与线上状态**：
  * **PM2 进程**：ECS 实例上 PM2 进程 id `11`，名称 `redmagic-comment`，状态 `online`；
  * **脚本路径与工作目录**：`exec cwd = /home/red/work/moneyboost/comment`，主程序为 `app.py`；
  * **本地监听与对外 baseURL**：监听本地端口 `5000`，通过 Nginx 反向代理对外暴露为 `https://comment.red-magic.cn`（业务入口 `/app`，配置文件见 `/etc/nginx/conf.d/comment.red-magic.cn.conf`）。
- **Solar 真实主子评论采集能力实证**：
  * 深入审计本地 `D:/download/pic-vec/comment/app.py`（行 398、427、446、487、494），该服务**已完整实现真实小红书主子评论抓取逻辑**：
    - L1 根评论接口：`https://pgy.xiaohongshu.com/api/solar/note/{note_id}/l1Comments?offset={offset}&pageSize=100&l2PageSize=100`；
    - L2 楼中楼回复接口：`https://pgy.xiaohongshu.com/api/solar/note/{note_id}/l2Comments?l1CommentId={cid}&offset={offset}&pageSize=100`；
    - 用户元数据映射：通过响应结构中的 `userMap` 字段反查用户展示 ID（`get_user_display_id`）与昵称，逐条落盘解析出笔记 ID、评论内容、评论时间、被回复者、主客态判定等；
  * **结论**：先前关于“`comment` 仅为本地管理库、无采集能力”的判断不成立。该独立服务已具备完整的 Solar 评论采集流水线能力。
- **凭据机制与 OSS 引用路径**：
  * `comment/app.py`（行 293-312）通过 `get_cookies_list_from_oss` 动态加载 OSS 存储的 Cookie 池：
    - 对象路径：`oss://redmagic/KOL/token.txt`；
    - 格式：多行 JSONL，每行一个账号的 Cookie 字典；
    - 采集时自动拼接为标准请求头并按账号分发任务。

### 2. 飞鹤项目适配层（`feihe-mvp/lib/xhs.ts`）路径与 Schema 差异
- **路径与命名差异**：
  * `feihe-mvp/lib/xhs.ts` 原先设定的适配路径为小驼峰与下划线混合（如 `l1_comments`、`l2_comments`，且未适配 `userMap`）；
  * 与 `comment/app.py` 经线上验证的路径（`l1Comments`、`l2Comments`，大写 C）及 `userMap` 用户解析结构存在差异；
  * 飞鹤项目的评论适配层需对齐该规范（由评论 worker 负责本地实现与 schema 修复，本调查不修改业务代码）。

### 3. Rtrend 服务与局域网自动化链路定位
- **ECS（123.56.84.130）Rtrend 服务**：
  * PM2 进程 id `10`，名称 `redtrend`，状态 `online`；
  * 监听端口 `5002`，对外域名 `https://redtrend.red-magic.cn`；
  * 仅处理关键词与内容分析任务（`/api/keyword/...`, `/api/content/...`），不承担评论采集。
- **局域网设备（172.16.10.45）自动化同步链路**：
  * 部署于 `/home/user/models/automation`，监听 `18092`；
  * 通过 FRP STCP（`auto-sync-origin`）穿透至云端 ECS visitor 端口 `38292`，经 Nginx 暴露为 `https://auto.red-magic.cn`（HTTP 200，前端运行正常）。

### 4. 真实服务引用与联调依据汇总

| 服务模块 | 线上对外 Base URL | 内部服务目录 / 端口 | 核心功能与接口 | 凭据引用源 | 联调状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **小红书评论采集服务** | `https://comment.red-magic.cn` | `/home/red/work/moneyboost/comment`<br>(端口: `127.0.0.1:5000`) | 具备蒲公英 Solar 主子评论采集流水线：<br>`/api/solar/note/{noteId}/l1Comments`<br>`/api/solar/note/{noteId}/l2Comments`<br>解析 `userMap` 用户字典 | `oss://redmagic/KOL/token.txt`<br>(JSONL 格式 Cookie 池) | **能力具备**<br>(需适配 feihe-mvp 路径/Schema) |
| **自动化同步控制台** | `https://auto.red-magic.cn` | 局域网 `172.16.10.45:18092`<br>(FRP 穿透 ECS `127.0.0.1:38292`) | 飞书表格自动同步与任务调度中心 | 本地 / OSS Token 映射 | **正常在线** |
| **RedTrend 内容/词服务** | `https://redtrend.red-magic.cn` | `/home/red/work/moneyboost/Rtrend`<br>(端口: `127.0.0.1:5002`) | 关键词投放与内容大盘报表分析任务 | 本地 `token_cache.txt` | **正常在线** |
| **竞品舆情数据服务** | `http://117.78.5.18:8080` | 公司既有 IPSCG 采集平台 | 笔记级舆情监控与互动汇总数据（`/ips-api/yimei/...`） | 无需额外鉴权 | **正常在线** |
