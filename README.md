# 社媒营销增长与多品牌全域看板中台

本项目是面向品牌客户与运营团队的社媒全域营销看板与投流管理中台。系统覆盖内容资产管理、投放分日观测、达人排期制作漏斗、舆情质检处置及多平台数据源（飞书云文档、腾讯文档 OpenAPI）实时同步。

---

## 核心支持项目矩阵

| 项目代码 | 品牌 / 战役 | 核心聚焦产品 (SPU) | 数据源接入形态 | 特色看板与核心能力 |
| :--- | :--- | :--- | :--- | :--- |
| `qicui` | **飞鹤启萃** | 飞鹤启萃新生儿奶粉 | 飞书多维表格 + 本地 SQLite | 内容规划、分日数据大盘、评论质检处置、竞品大盘洞察 |
| `kailas` | **凯乐石** | FUGA 大坡王越野跑鞋 | **腾讯文档 OpenAPI 实时直连** | 18个采集日全量分日时序、种草转化 (CPI/CPTI)、优质词/避坑词矩阵 |
| `huang-tiane` | **黄天鹅** | 黄天鹅可生食鸡蛋 | 飞书表格 (lark-cli 自动化同步) | 31位达人制作发布漏斗、品牌FS/商销/CID双轨时序、投流健康度研判 |
| `meiling` | **美菱** | 502pro / 511 / 大白鲸570 | 飞书多维表格 + 透视流水表 | 84台样机3态流转跟踪、自采天猫/京东种草流水全域对照 |
| `winner-wipes` | **稳健酒精湿巾** | 稳健玉米酒精消毒湿巾 | 飞书表格 (淘搜日流水 + 执行底表) | 三甲医院医生专家号背书专区、淘搜逐日投流拉动效益对照 |

---

## 快速上手

### 1. 本地开发与启动

项目前端与服务端位于 `feihe-mvp/` 目录：

```bash
# 进入工程目录并启动本地服务
cd feihe-mvp
node scripts/dev.mjs
```

- 本地访问：http://127.0.0.1:5173/
- 本地环回访问自动具备 `user-editor`（业务编辑者）权限，直连 `data/local.db`。

### 2. 外部数据源实时同步

```bash
# 1. 腾讯文档 OpenAPI 实时同步（针对凯乐石项目 9 大工作表）
python scripts/sync_kailas_tencent.py

# 2. 飞书表格与多维表格全量实时同步（美菱、黄天鹅、稳健等）
cd feihe-mvp
node scripts/sync-all-feishu-live.mjs
```

### 3. 运行自动化测试与类型检查

```bash
cd feihe-mvp
npm run typecheck                  # TypeScript 静态类型检查
node scripts/verify-campaign-api.mjs # 营销看板 API 与鉴权验证
```

---

## 目录结构说明

```text
.
├── feihe-mvp/                         # [核心工程] Web 前端与服务端系统代码
│   ├── app/                           # Next.js / Vinext 页面路由与 API 端点
│   ├── features/                      # 业务模块组件（campaign/overview/comments 等）
│   ├── lib/                           # 核心业务逻辑、数据适配器与鉴权层
│   ├── styles/                        # 统一现代主题样式系统
│   ├── scripts/                       # 自动化测试、数据同步与迁移运维脚本
│   └── tests/                         # 端到端测试与集成测试
│
├── data/                              # [数据存储] 本地生产/开发数据库
│   └── local.db                       # 核心 SQLite 数据库（严格禁止外部脚本裸写）
│
├── docs/                              # [文档资料] 业务交付标准、看板优化报告与底表说明
│   ├── new-projects-sources/          # 各项目数据源快照与配置
│   └── 飞鹤启萃看板优化分析报告.html    # 优化分析交付报告
│
├── tools/                             # [辅助工具] 离线自动化工具包
│   └── offline-tagger/                # 千瓜数据底表自动打标工具集合
│
├── scripts/                           # [全局运维] 根目录全局数据抓取与同步脚本
│   └── sync_kailas_tencent.py         # 腾讯文档 OpenAPI 增量提取脚本
│
├── config.json                        # [配置凭据] 飞书/腾讯文档/OSS 凭据（gitignored）
├── .gitignore                         # Git 忽略规则
└── README.md                          # 本项目说明文档
```

---

## 离线千瓜底表打标工具

如需对历史千瓜 Excel 底表进行自动 SPU 与内容类型识别：
```bash
cd tools/offline-tagger
python 一键打标.py "../../data/爱他美六月千瓜数据底表.xls"
```
