import json
import os
from datetime import datetime

deep_audit_dir = "docs/new-projects-sources/deep-audit-meiling"
app_meiling_json_path = "feihe-mvp/lib/campaign-enrichment/meiling.json"

with open(os.path.join(deep_audit_dir, "catalog.json"), "r", encoding="utf-8") as f:
    catalog = json.load(f)

with open(os.path.join(deep_audit_dir, "facts.json"), "r", encoding="utf-8") as f:
    facts = json.load(f)

with open(app_meiling_json_path, "r", encoding="utf-8") as f:
    app_meiling = json.load(f)

manifest = {
    "manifest_version": "v2_strictly_verified",
    "project": "meiling",
    "brand": "美菱冰箱 (Meiling Refrigerator)",
    "generated_at": datetime.now().isoformat(),
    "audit_status": "audit_complete_facts_verified",
    "access_summary": catalog.get("access_audit", {}),
    "base_inventory": catalog.get("base_inventory", {}),
    "workbooks_inventory": catalog.get("workbooks_inventory", []),
    "forensic_audit_evidence": {
        "Y7qNOu_打款": {
            "source": "DkdO (RoAtsw3KTh56ZBtT7cmcTYaznJb) -> Sheet: Y7qNOu",
            "header": ["账户 (A)", "打款 (B)", "实际打款 (C)", "实际应消耗 (D)", "还差&应挪 (E)"],
            "total_accounts": 7,
            "evidence_note": "严格按5列固定位置映射，空单元格保留为null。Row 2 C列为空，D列为1094327.99（自采红猫应消耗）；Row 4 D列为511713.93（红盟应消耗）；Row 6 D列为386111.11（京东对投应消耗）；Row 8 D列为477497.26（星伴应消耗）。规划打款总计120万元，4个种草账户实际应消耗总计246.97万元。"
        },
        "4SGaOf_双11进度更新": {
            "source": "HNDC (N2bssx2dBh8xyItaFEfccqaznHY) -> Sheet: 4SGaOf",
            "update_time": "2026.9.28 (原规划表，截止时间未注明)",
            "scenario": "双11大促9/28初始规划口径（总预算380万/117篇），与后续执行调整后288万口径并存，严禁覆盖。",
            "evidence_note": "Row 1 表头无GMV/UV；Row 15 京东表头与 Row 26 天猫表头含GMV/进店量。Row 16 京东进店量11,508与GMV 1,368,061.20为京东平台整体合并值；Row 27 天猫进店量6,151与GMV 626,127.49为天猫平台整体合并值。型号级无独立GMV/进店归因，坚决不计算假产品ROI，完整保留源数据。"
        },
        "tblotoaoy40ShO5k_双11样机信息表": {
            "source": "Base (XH2obMhtwaPCWUsmsWacRCpLnvg) -> Table: tblotoaoy40ShO5k",
            "records_count": 84,
            "evidence_note": "彻底脱敏所有达人姓名、电话与收件地址。按Base真实字段【推荐产品】、【样机进度】、【退货进度】、【内饰确认进度】分类聚合。小确杏502Pro 35台/421 18台/520 8台/511 7台；已下单61台/已收加急制图15台；未退货55台/已提退货15台/已通知退货14台；内饰已确认62台/未确认16台。"
        },
        "mG2COI_笔记词类": {
            "source": "DkdO (RoAtsw3KTh56ZBtT7cmcTYaznJb) -> Sheet: mG2COI",
            "grid_row_count": 535,
            "actual_valid_keywords_count": 339,
            "evidence_note": "原表535为Feishu分配网格数，扣除空行后有效关键词实际为339条。竞品截流词203条(59.9%)、品类词82条(24.2%)、品牌词28条(8.3%)、618大促词25条(7.4%)、智能词包1条(0.3%)。"
        },
        "618_vs_Double11_隔离": {
            "evidence_note": "618结案复盘（总花费197.6万/GMV 1696万/全案ROI 8.58）与双11进行中（9/28规划版380万/现执行预算288万）分为两个独立表与scenario，禁止混画。"
        },
        "可比日期区间": {
            "evidence_note": "天猫自采（09/30~10/18）与京东自采（09/29~10/18）仅在交集09/30~10/18（19天）进行同日期并排对照，不盲目跨期加总。"
        }
    },
    "enriched_tables_summary": [
        {"id": t["id"], "title": t["title"], "period": t.get("period"), "rows_count": len(t.get("rows", []))}
        for t in app_meiling["tables"]
    ],
    "facts_snapshot": facts["facts"]
}

with open(os.path.join(deep_audit_dir, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print("Manifest generated successfully!")
