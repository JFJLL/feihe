# 本轮独立基线

2026-10-14 核验：main 为 `2169bf5`；v3 为 `codex/product-integration-v1`、`2e0352b`。

本轮 worktree：`D:/download/pic-vec/feihe-business-v1`；分支：`codex/feihe-business-v1`。

保留 v3 的 20 个未提交代码、测试及简洁文档，并校验 SHA-256。共 924 个已有改动文件及暂存/未暂存补丁另存于本轮外部验证目录的 `baseline`；大量浏览器原始证据不重新加入 Git。原 v3 的索引与文件未改动。

开发使用独立 `.verification/business.db`、`LOCAL_DB_NO_SEED=true`，不复制原数据库和凭据。线上仅只读。两份明确排除的客户多代理看板及其研究材料不作为本轮输入。

四批顺序：分日看板与投流占位 → automation 定时更新 → 笔记评论巡查 → IPSCG 竞品监测。每批单独验收，本地提交；不推送、合并或部署。
