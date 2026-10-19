# 营销复盘四新解锁来源集成与权限更新报告 (ACCESS-UPDATE.md)

- **更新时间**：2026-10-19T09:14:13.736Z
- **执行范围**：`--projects kailas,meiling` (Scoped Apply)
- **备份文件**：`D:\download\pic-vec\feihe\.verification\campaign\local.db.pre-access-update-2026-10-19T09-14-12-998Z.db`

## 1. 四项解锁来源登记核验 (复用旧 ID，无数量膨胀)

| 登记源 ID | 项目 | 原节点 / 替代说明 | 更新后 URL | 类型 | 状态 | 探测结果 |
|---|---|---|---|---|---|---|
| `src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb` | kailas | 黑山Q3日常双周会小结资料 副本 | [Y8S1wy0YUiAtJrkY9G5ceczDnjf](https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf) | `feishu_docx` | 元数据已核验 | `accessible` |
| `src-meiling-node-RQffw002Aik9aNkW9PScJ05knre` | meiling | 美菱冰箱kpi管理表 副本 | [HNDCwmdpkiw4DgkFSNycB3cbnSc](https://yimeichuanbo.feishu.cn/wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc) | `feishu_sheet` | 元数据已核验 | `accessible` |
| `src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp` | meiling | 美菱冰箱618复盘数据 副本 | [MMPZwhQbMiVmIKkcyb9c7mDQnHp](https://yimeichuanbo.feishu.cn/wiki/MMPZwhQbMiVmIKkcyb9c7mDQnHp) | `feishu_sheet` | 元数据已核验 | `accessible` |
| `src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd` | meiling | 美菱冰箱双11日报表  副本 | [DkdOwDEk0i9FTUkXlh1cTE0fnOd](https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd) | `feishu_sheet` | 元数据已核验 | `accessible` |

## 2. 数据库与非目标项目一致性防护

- **启萃项目 (qicui) 哈希**：`a3098236e09ce98c20d174c200ebd4ca35ca0d9511809fac04283d5a407209f8` -> `a3098236e09ce98c20d174c200ebd4ca35ca0d9511809fac04283d5a407209f8` (完全一致，零变更)
- **酒精湿巾 (winner-wipes) 哈希**：`b518f39679875d8447c3848c1b3c0559940211d6e897a8cfcd4f31e5e1d305a5` -> `b518f39679875d8447c3848c1b3c0559940211d6e897a8cfcd4f31e5e1d305a5` (完全一致，范围限定保护生效)
- **项目总数**：4 个 (qicui, kailas, meiling, winner-wipes)
- **数据源总数**：19 个 (无重复记录，既有 19 源不膨胀)
- **人工日报保留验证**：凯乐石与美菱 manual-report 均完整保留，历史离线指标卡与表格未被覆盖。

## 3. 看板快照动态产出核验

- **凯乐石 (kailas)**：快照包含 12 个 KPI、7 个表格；双周会核心指标概览、数据总览及日常预算表已联通。
- **美菱 (meiling)**：快照包含 41 个 KPI、14 个表格；618 大促历史复盘考核表、7-8月及618历史KPI对照、双11执行进度/投放表均可见，权限缺失提示已被真实数据替换。

## 4. 幂等性与验证结论

- 经二次执行 apply 验证，业务内容/ID数量保持一致，更新时间更新，数据库表行数与哈希完全幂等。
- 本次更新未触及任何其他业务文件与非目标项目。
