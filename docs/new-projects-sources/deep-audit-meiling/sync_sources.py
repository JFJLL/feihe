import json
import os

meiling_json_path = "feihe-mvp/lib/campaign-enrichment/meiling.json"
manifest_json_path = "docs/new-projects-sources/deep-audit-meiling/manifest.json"

with open(meiling_json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

sources_registry = [
    {
        "id": "meiling-base",
        "name": "美菱双11多维表格 (双11 KOL进度表)",
        "url": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l",
        "status": "ready",
        "detail": "双11多维表格，1096条提报记录，117条二核确认合作全量明细",
        "fetchedAt": "2026-10-19T15:27:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书多维表格Base",
            "syncedAt": "2026-10-19T15:27:00+08:00"
        }
    },
    {
        "id": "src-meiling-base-yangji",
        "name": "美菱双11多维表格 - 样机信息表",
        "url": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tblotoaoy40ShO5k",
        "status": "ready",
        "detail": "双11试用样机信息表，全量84台样机型号与流转进度（已脱敏）",
        "fetchedAt": "2026-10-19T15:27:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书多维表格Base",
            "syncedAt": "2026-10-19T15:27:00+08:00"
        }
    },
    {
        "id": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "name": "美菱冰箱双11日报表 副本",
        "url": "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "status": "ready",
        "detail": "双11大促日报表工作簿（RoAtsw3KTh56ZBtT7cmcTYaznJb），包含天猫/京东种草数据源细表与打款表",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-D9ddm3",
        "name": "美菱双11日报表 - 自采天猫种草数据源流水",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=D9ddm3",
        "status": "ready",
        "detail": "自采天猫种草全量底表（7632行，实际可比19天，9篇笔记素材）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-BI2xBs",
        "name": "美菱双11日报表 - 自采京东种草数据源流水",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=BI2xBs",
        "status": "ready",
        "detail": "自采京东种草全量底表（14992行，实际可比20天，5篇笔记素材）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-Trvrou",
        "name": "美菱双11日报表 - 京东对投CID日流水",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=Trvrou",
        "status": "ready",
        "detail": "京东对投CID真实消耗与成交转化（10/16-10/18，3天分日流水）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-Y7qNOu",
        "name": "美菱双11日报表 - 打款与应消耗对照表",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=Y7qNOu",
        "status": "ready",
        "detail": "双11各渠道投放账户规划打款与实际应消耗（7大账户固定列映射）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-mG2COI",
        "name": "美菱双11日报表 - 笔记&词类配置表",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=mG2COI",
        "status": "ready",
        "detail": "小红书投放搜索词类与产品渗透聚类（有效339条非空词，竞品/品类/品牌/大促词）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-ACntPW",
        "name": "美菱双11日报表 - 代采星伴种草数据源流水",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=ACntPW",
        "status": "ready",
        "detail": "代采星伴种草底表（2979行明细聚合，10/15-10/18共4天流水）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-zF2qee",
        "name": "美菱双11日报表 - 京东对投种草数据源流水",
        "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=zF2qee",
        "status": "ready",
        "detail": "京东对投种草底表（13954行明细聚合，10/15-10/18共4天流水）",
        "fetchedAt": "2026-10-19T18:25:00+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T18:25:00+08:00"
        }
    },
    {
        "id": "src-meiling-node-HNDCwmdpkiw4DgkFSNycB3cbnSc",
        "name": "美菱冰箱kpi管理表 副本",
        "url": "https://yimeichuanbo.feishu.cn/wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc",
        "status": "ready",
        "detail": "美菱KPI管理表，接替无权限之RQff，包含双11进度更新（4SGaOf）、筛号透视（SI0mQy）及618/7-8月KPI总览",
        "fetchedAt": "2026-10-19T08:38:11+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T08:38:11+08:00"
        }
    },
    {
        "id": "src-meiling-sheets-4SGaOf",
        "name": "美菱冰箱kpi管理表 - 双11进度更新表",
        "url": "https://yimeichuanbo.feishu.cn/sheets/N2bssx2dBh8xyItaFEfccqaznHY?sheet=4SGaOf",
        "status": "ready",
        "detail": "双11各产品系列与型号原规划预算（380万/117篇）及京东/天猫渠道级回传GMV（9/28更新）",
        "fetchedAt": "2026-10-19T08:38:11+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T08:38:11+08:00"
        }
    },
    {
        "id": "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp",
        "name": "美菱冰箱618复盘数据 副本",
        "url": "https://yimeichuanbo.feishu.cn/wiki/MMPZwhQbMiVmIKkcyb9c7mDQnHp",
        "status": "ready",
        "detail": "2026年618大促结案复盘工作簿（XSKrspszhhgvPvtxMNicmYlUnEc），包含全量105篇达人明细与财务级ROI",
        "fetchedAt": "2026-10-19T16:47:29+08:00",
        "provenance": {
            "type": "feishu",
            "sourceName": "飞书电子表格Sheets",
            "syncedAt": "2026-10-19T16:47:29+08:00"
        }
    }
]

table_source_map = {
    "meiling-enrich-matrix-product-stage": ("meiling-base", "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l"),
    "meiling-enrich-matrix-platform-stage": ("meiling-base", "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l"),
    "meiling-enrich-content-theme-format": ("meiling-base", "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l"),
    "meiling-enrich-channel-creative-efficiency": ("src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd", "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd"),
    "meiling-enrich-note-creative-efficiency": ("src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd", "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd"),
    "meiling-enrich-account-budget-pacing": ("src-meiling-sheets-Y7qNOu", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=Y7qNOu"),
    "meiling-enrich-double11-model-planning": ("src-meiling-sheets-4SGaOf", "https://yimeichuanbo.feishu.cn/sheets/N2bssx2dBh8xyItaFEfccqaznHY?sheet=4SGaOf"),
    "meiling-enrich-double11-platform-kpi-summary": ("src-meiling-sheets-4SGaOf", "https://yimeichuanbo.feishu.cn/sheets/N2bssx2dBh8xyItaFEfccqaznHY?sheet=4SGaOf"),
    "meiling-enrich-sample-machine-progress": ("src-meiling-base-yangji", "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tblotoaoy40ShO5k"),
    "meiling-enrich-search-keywords-classification": ("src-meiling-sheets-mG2COI", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=mG2COI"),
    "meiling-enrich-channel-daily-comparable": ("src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd", "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd"),
    "meiling-enrich-material-pareto-efficiency": ("src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd", "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd"),
    "meiling-enrich-618-procurement-roi-review": ("src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp", "https://yimeichuanbo.feishu.cn/wiki/MMPZwhQbMiVmIKkcyb9c7mDQnHp")
}

for t in data.get("tables", []):
    t_id = t["id"]
    if t_id in table_source_map:
        sid, surl = table_source_map[t_id]
        t["sourceId"] = sid
        t["sourceUrl"] = surl

dataset_source_map = {
    "meiling-daily-tm-seed": ("src-meiling-sheets-D9ddm3", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=D9ddm3"),
    "meiling-daily-jd-seed": ("src-meiling-sheets-BI2xBs", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=BI2xBs"),
    "meiling-daily-cid-jd": ("src-meiling-sheets-Trvrou", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=Trvrou"),
    "meiling-daily-xingban-seed": ("src-meiling-sheets-ACntPW", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=ACntPW"),
    "meiling-daily-jd-toitou-seed": ("src-meiling-sheets-zF2qee", "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=zF2qee")
}

for ds in data.get("dailyDatasets", []):
    ds_id = ds["id"]
    if ds_id in dataset_source_map:
        sid, surl = dataset_source_map[ds_id]
        ds["sourceId"] = sid
        ds["sourceUrl"] = surl

data["sources"] = sources_registry

with open(meiling_json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

registered_ids = {s["id"] for s in sources_registry}
used_ids = set()
for t in data["tables"]:
    used_ids.add(t["sourceId"])
for ds in data["dailyDatasets"]:
    used_ids.add(ds["sourceId"])

dangling = used_ids - registered_ids
print(f"Total registered sources: {len(sources_registry)}")
print(f"Total used sourceIds: {len(used_ids)}")
print(f"Dangling sourceIds: {dangling}")
assert len(dangling) == 0, f"Found dangling sourceIds: {dangling}"

if os.path.exists(manifest_json_path):
    with open(manifest_json_path, "r", encoding="utf-8") as f:
        man = json.load(f)
    man["sources"] = sources_registry
    with open(manifest_json_path, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)

print("All sources successfully registered, synchronized and verified with ZERO dangling IDs!")
