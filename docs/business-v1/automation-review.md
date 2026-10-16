# 第二批复用核验

2026-10-14 只读检查 `D:/download/pic-vec/automation`，master 工作区有用户未跟踪 `test_remote.py`，未修改。

已存在聚光按指定子账号取OSS凭据、按日分页报表，京准通、淘宝星河采集器，关键词及灵犀模块，统一APScheduler、业务时区、持久任务、租约和失败记录。复用平台取数函数及成熟时间/调度规则，避免通过原任务执行器回写真实飞书。

本地任务库只读核验：11个京准通任务，只有一个active，其余E2E归档任务；没有启萃项目子账号绑定。active任务没有sub_account_id，不能将其Cookie/任务ID推断为启萃授权。需要业务提供明确平台账户、任务或内容ID，已通过异步问题请求；其余开发继续。

京准通 `fetch_jzt_data` 在指定子账号Cookie缺失时回退其他Cookie。飞鹤桥接必须先取指定账号Cookie并显式传入，失败即停；禁止沿用回退。聚光使用显式子账号header，核对v-seller-id；不使用任意默认Cookie。

不调用现有 `execute_task_sync`、keyword/lingxi写表任务或真实调度修改接口。后台更新写入飞鹤自己的开发库，来源主/核对规则明确；实际联调与生产任务部署分开验收。
