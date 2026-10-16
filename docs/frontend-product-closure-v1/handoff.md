# 工程交接文档 (HANDOFF)

## 1. 代码仓库与开发分支状态

- **主工作树**: `D:\download\pic-vec\feihe` (`main` 分支，保持干净未合并)
- **整改工作区 (Worktree)**: `D:\download\pic-vec\feihe-platform-v2`
- **整改独立分支**: `codex/platform-upgrade-v2`
- **基础提交**: `e2aebe0b2a0e252e8ed46d62b79f4317e1c6302b`
- **提交与推送策略**: 完成所有修改与验证后，提交并在独立分支推送到远程仓库，不向 `main` 主干合并。

---

## 2. 关键命令速查

在 `D:\download\pic-vec\feihe-platform-v2\feihe-mvp` 下执行：

```bash
# 类型检查
npm run typecheck

# 35项架构验收测试
npm run verify:matrix

# 前端闭环与口径验证
npm run verify:closure

# 启萃历史数据对账
npm run verify:reconcile

# 生产级 HTTP 校验
npm run verify:operations

# 生产打包
npm run build

# 启动本地开发服务
npm run dev

# 启动生产服务预览 (127.0.0.1:5013)
npm run start:prod
```