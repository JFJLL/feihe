# 第四批交付报告：真实竞品监测系统 (Phase 4 Delivery - Final Frozen)

## 一、交付概述
本批次任务负责将竞品监测能力从原有的静态月报快照升级为**真实只读数据源驱动、具有持久化调度队列与严格数据归一化的可用监测系统**，已完全落盘并在统一预览环境 (端口 5246) 验证通过并准备冻结。

系统基于公司采集系统（只读 API：http://117.78.5.18:8080/ips-api/yimei/selectKeywordResults，固定核验任务 taskId: ba7a885c-16b5-479d-a2a9-9cceb5908e9c）实现受控限速抓取、本地归一化入库、断点续传、疑似重复标记、品牌严格证据归属（严禁 fallback）、消费者风险线索提取、换任务独立游标与持久调度队列闭环。

---

## 二、两项关键审查项修复报告

### 1. 品牌归属严格证据化与旧样本修复 (analyzer.ts)
- **删除错误 fallback**：彻底删除原 analyzer.ts 在正文/标题未命中品牌时回退到 rawRecord.keyword 的逻辑。
- **严格归属规则**：
  - 无品牌证据或游戏/无标题/空正文笔记：严格归为 unknown（未知），同时保留原始 keywordHit 作为采集来源；
  - 正文指向另一品牌（如搜索合生元但正文通篇推荐飞鹤）：按证据归属飞鹤；
  - 多品牌对比且无法确定主导者：归为 多品牌对比。
- **本地现有样本重算修复**：
  - 对本地入库样本基于保留的 raw_payload_json 原始证据重新核验并更新派生字段（不改 raw 数据，不清库，不重新请求上游）。
  - **真实未知数量与实例核验**：
    - 样本 6abd32a3000000001203d807（标题 #第五人格追光逐梦，游戏笔记，原误判为金领冠）：准确修复为 unknown（无明确品牌提及）；
    - 样本 6abd32050000000018004520（标题 爱倍悠 收收收，二手求购，原误判为金领冠）：准确修复为 unknown（无明确品牌提及）；
    - 样本 6abd33280000000018004c00（标题 全出，原误判为金领冠）：准确修复为 unknown（无明确品牌提及）；
    - 样本 6abd3453000000001500a841（标题 无标题笔记，原误判为金领冠）：准确修复为 unknown（无明确品牌提及）；
    - 样本 6abd3697000000001c01f5f1（标题 马上要出发了，我家的行李还没收好……，原误判为合生元）：准确修复为 unknown（无明确品牌提及）；
    - 真实具备品牌证据的样本（如 合生元派星一段奶粉、出一罐合生元派星天护 750克、合生元超金菌）保持归属为 合生元。
    - 彻底纠正了此前 50/50 的虚假品牌份额，页面真实呈现 unknown 占比达 60%。

### 2. Checkpoint 键纳入 taskId 与换任务隔离 (worker.ts)
- **复合键升级**：Checkpoint 键名严格升级为 :::_。
- **换任务隔离续跑**：
  - 同项目、同关键词、同时间窗口下，旧任务即使 pageCursor > 1，切换新任务后因键名绑定新 taskId，新任务严格从 pageCursor = 1（初始水位 0）开始拉取，绝不继承旧任务页码；
  - 旧任务 Checkpoint 永久保留在字典存档中可供追溯。
- **查询隔离**：route.ts 中所有 SQL 查询强制包含 task_id = ?，切换任务后主看板旧数据自动隔离（总数归 0），只有显式传参时才可历史回溯。

---

## 三、端到端真实验证证据与运行记录

### 1. 真实 POST 排队 -> 独立 Runner -> 持久日志全链条数据
- **前端 POST 排队请求与响应**：
  POST /api/competitors 响应 202 Accepted, 返回 jobId: req-comp-1791973599827, taskId: qicui:competitor-ipscg-ba7a885c-16b5-479d-a2a9-9cceb5908e9c
- **持久化队列记录** (business_sync_requests)：
  ID: qicui:req-comp-1791973599827 已由调度 Worker 标记 processed_at: 2026-10-14T10:27:15.267Z
- **调度 Worker Claim Lease 与执行**：
  租约 Token: 314c3157-ff8f-43bf-82de-96990b4d185b, 调度 RunId: b0d6cf7c-ff9a-4ba4-9000-20570405ec8e, 读取: 10, 入库: 10
- **持久日志落地** (sync_jobs)：
  Job ID: b0d6cf7c-ff9a-4ba4-9000-20570405ec8e, status: success, finished_at: 2026-10-14T10:27:15.267Z

### 2. 自动化回归测试全绿通过 (scripts/test-competitors.mjs)
普通 Node 命令直接可复现：
node scripts/test-competitors.mjs

### 3. 页面截图证据
- 修复后包含真实 unknown 占比与 2026-10-01 窗口看板截图：.verification/phase4-growth-repaired-final.png
- 新项目空态看板截图：.verification/phase4-empty-project-preview.png
