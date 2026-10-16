# 交接与运行

本轮分支 `codex/feihe-business-v1`；worktree `D:/download/pic-vec/feihe-business-v1`；继承基线提交 `531985b`。不推送、不合并、不部署，原 main/v3 和 automation 未修改。

应用目录 `feihe-mvp`。本地导入：

```powershell
node scripts/import-business-daily.mjs --file '<外部来源bundle.json>' --project '<项目ID>' --db .verification/business.db
node scripts/business-preview.mjs
```

预览入口 `http://127.0.0.1:5236/projects/qicui?tab=daily&day=2026-10-14`。预览脚本只使用隔离开发库和显式测试身份，不读取生产凭据。导入器仅接受 `.verification` 内数据库；每个项目必须先有自己的来源绑定。

新项目复制配置结构与规则时，来源绑定为空；不得复制其他项目的真实数据或授权。第二本地测试项目 `business-isolated-2` 已创建。

首批实现：`lib/business-daily`、`/api/business-daily`、`BusinessDailyBoard`；复用已有计算解析、项目权限、页面框架与可配置看板。其他既有组件仍可展开使用。`/ads`保留唯一入口；内容营销项目显示信息流/搜索占位，原投放模板继续使用其有效业务功能。

下一批复用 `D:/download/pic-vec/automation`；当前仓库 master 有用户未跟踪文件，保持只读。继续完成后台调度、评论巡查和竞品监测，不能将第一批成果作为总目标完成。

后台本地运行：`python scripts/business-scheduler.py --automation-root D:/download/pic-vec/automation --db .verification/business.db`。配置入口为受项目管理权限保护的 `/api/business-sync`，也可用 `configure-business-sync.mjs --file <外部任务JSON> --project <项目ID> --db .verification/business.db`。任务配置不接受凭据。

复用原SchedulerManager构造和APScheduler；不调用会恢复真实任务的start/restore_all_tasks，也不调用真实飞书写表执行器。worker独立于网页；本轮只在隔离开发库运行，没有安装生产OS定时任务。平台账号未确认前不启动采集。
