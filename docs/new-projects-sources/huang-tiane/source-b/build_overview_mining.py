#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv
import io
import json
import math
import os
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[3]
RAW_A = ROOT.parent / "source-a" / "raw"
RAW_B = ROOT / "raw"
ENRICHMENT_JSON = REPO_ROOT / "feihe-mvp" / "lib" / "campaign-enrichment" / "huang-tiane.json"

def clean_csv(path):
    if not path.exists():
        return []
    j = json.loads(path.read_text(encoding="utf-8"))
    raw_csv = j.get("annotated_csv", "")
    cleaned = re.sub(r"^\[row=\d+\] ?", "", raw_csv, flags=re.M)
    return list(csv.reader(io.StringIO(cleaned)))

def num(v, pct=False):
    s = str(v or "").strip()
    if not s or s.startswith("#") or s in ("-", "—", "/", "None") or ("%" in s and not pct):
        return None
    try:
        n = float(s.replace(",", "").replace("¥", "").replace("￥", "").replace("%", ""))
        return n if math.isfinite(n) else None
    except ValueError:
        return None

def build_creator_selection_funnel():
    return {
        "id": "huang-creator-selection-funnel",
        "title": "达人选号淘汰漏斗与11月储备池",
        "category": "execution",
        "period": "2026年10月-11月",
        "sourceId": "src-huang-tiane-kol-execution",
        "note": "从10月提报池373人历经一筛(83通过/69待定)、二核(58通过)、商务接洽(55可接)，最终执行定档31人(转化率8.3%)、实际发布18人(发布率58.1%)；11月已提报储备196人，首批确认锁定18人、规划预算18万元。",
        "provenance": "feishu",
        "columns": [
            {"key": "stage", "title": "阶段 / 维度", "type": "string", "align": "left"},
            {"key": "headcount", "title": "达人数量 (人)", "type": "integer", "align": "right"},
            {"key": "retentionRate", "title": "留存转化率", "type": "percent", "align": "right"},
            {"key": "budgetOrCost", "title": "预算或报价 (元)", "type": "currency", "align": "right"},
            {"key": "strategyTier", "title": "量级结构 / 核心方向", "type": "string", "align": "left"},
            {"key": "statusNote", "title": "执行状态与说明", "type": "string", "align": "left"}
        ],
        "rows": [
            {
                "stage": "① 10月全网提报初选池",
                "headcount": 373,
                "retentionRate": 100.0,
                "budgetOrCost": None,
                "strategyTier": "涵盖头部 / 腰部 / 精选 / KOC全量池",
                "statusNote": "初选提报373位候选达人，全网摸排适格博主"
            },
            {
                "stage": "② 团队初审一筛通过",
                "headcount": 83,
                "retentionRate": 22.3,
                "budgetOrCost": None,
                "strategyTier": "83人通过，69人待定，35人不通过",
                "statusNote": "初筛评估基础数据、女性粉丝占比与近期千赞表现"
            },
            {
                "stage": "③ 策略把关二核通过",
                "headcount": 58,
                "retentionRate": 15.5,
                "budgetOrCost": None,
                "strategyTier": "严格匹配蛋品精致调性与烹饪人群",
                "statusNote": "严审内容风格、爆款率与蛋品食谱场景切合度"
            },
            {
                "stage": "④ 商务接洽确认可接",
                "headcount": 55,
                "retentionRate": 14.7,
                "budgetOrCost": None,
                "strategyTier": "55人可接，10人核价中，9人不可接",
                "statusNote": "确认档期排期、报价合理性、排竞时间与纯净素材授权"
            },
            {
                "stage": "⑤ 10月最终执行定档",
                "headcount": 31,
                "retentionRate": 8.3,
                "budgetOrCost": 324774.0,
                "strategyTier": "头部1位 / 精选20位 / KOC 10位",
                "statusNote": "含平台费报价合计¥324,774(裸价¥289,890)，进入脚本初稿定档"
            },
            {
                "stage": "⑥ 实际发布并收录上线",
                "headcount": 18,
                "retentionRate": 58.1,
                "budgetOrCost": 198254.0,
                "strategyTier": "精选13位 / KOC 5位 (截止10/19)",
                "statusNote": "已顺利发布18篇笔记，发布率58.1%，素材收集率100%"
            },
            {
                "stage": "⑦ 11月储备池已提报",
                "headcount": 196,
                "retentionRate": None,
                "budgetOrCost": None,
                "strategyTier": "美食分享 / 邪修溏心蛋 / 场景代入 / 晒单节促",
                "statusNote": "11月达人提报储备池196位，提早锁定双11大促爆发期"
            },
            {
                "stage": "⑧ 11月首批确认定档规划",
                "headcount": 18,
                "retentionRate": None,
                "budgetOrCost": 180000.0,
                "strategyTier": "话题引爆1 / 实验测评1 / 精选12 / 尾部4",
                "statusNote": "11月总规划预算18万元，针对10月舆情强化科普并邪修破圈"
            }
        ]
    }

def build_cid_placement_breakdown():
    return {
        "id": "huang-cid-placement-breakdown",
        "title": "红猫CID版位与计划模式效能对比表",
        "category": "performance",
        "period": "2026年10月 (10.01 ~ 10.19)",
        "sourceId": "src-huang-tiane-cid-fs",
        "note": "红猫CID标准投信息流贡献绝对主力(消耗占比78.5%, GMV 56,919元, ROI 2.74)；全站流效率突出(消耗4,384元, ROI 3.33)；搜索流精准收割(消耗1,300元, ROI 1.14)；店铺成交ROI计划ROI达5.12；简单投全域补充消耗42,403元(ROI 3.97)。",
        "provenance": "feishu",
        "columns": [
            {"key": "placement", "title": "版位 / 计划模式", "type": "string", "align": "left"},
            {"key": "campaignType", "title": "投放类型", "type": "string", "align": "center"},
            {"key": "spend", "title": "消耗 (元)", "type": "currency", "align": "right"},
            {"key": "ctr", "title": "点击率", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "点击成本 (元/次)", "type": "currency", "align": "right"},
            {"key": "cpm", "title": "千次展现 (元)", "type": "currency", "align": "right"},
            {"key": "orders", "title": "订单量 (单)", "type": "integer", "align": "right"},
            {"key": "gmv", "title": "GMV (元)", "type": "currency", "align": "right"},
            {"key": "roi", "title": "ROI", "type": "ratio", "align": "right"},
            {"key": "uv", "title": "进店量 (人次)", "type": "integer", "align": "right"},
            {"key": "costPerUv", "title": "进店成本 (元/人次)", "type": "currency", "align": "right"}
        ],
        "rows": [
            {
                "placement": "信息流版位",
                "campaignType": "标准投",
                "spend": 20771.77,
                "ctr": 10.45,
                "cpc": 1.17,
                "cpm": 121.91,
                "orders": 352,
                "gmv": 56919.24,
                "roi": 2.74,
                "uv": 699,
                "costPerUv": 29.72
            },
            {
                "placement": "全站流 (通投/混流)",
                "campaignType": "标准投",
                "spend": 4384.29,
                "ctr": 8.88,
                "cpc": 1.14,
                "cpm": 100.87,
                "orders": 75,
                "gmv": 14616.00,
                "roi": 3.33,
                "uv": 158,
                "costPerUv": 27.75
            },
            {
                "placement": "搜索流版位",
                "campaignType": "标准投",
                "spend": 1300.24,
                "ctr": 6.57,
                "cpc": 0.90,
                "cpm": 58.90,
                "orders": 18,
                "gmv": 1482.09,
                "roi": 1.14,
                "uv": 53,
                "costPerUv": 24.53
            },
            {
                "placement": "视频流版位 (独立模板)",
                "campaignType": "标准投",
                "spend": 0.0,
                "ctr": None,
                "cpc": None,
                "cpm": None,
                "orders": 0,
                "gmv": 0.0,
                "roi": None,
                "uv": 0,
                "costPerUv": None
            },
            {
                "placement": "店铺成交计划 (主力)",
                "campaignType": "标准投",
                "spend": 56142.38,
                "ctr": 8.62,
                "cpc": 1.11,
                "cpm": 96.04,
                "orders": 1824,
                "gmv": 178123.82,
                "roi": 3.17,
                "uv": 3764,
                "costPerUv": 14.92
            },
            {
                "placement": "店铺成交ROI计划 (高转)",
                "campaignType": "标准投",
                "spend": 2882.38,
                "ctr": 7.64,
                "cpc": 1.93,
                "cpm": 147.48,
                "orders": 94,
                "gmv": 14760.27,
                "roi": 5.12,
                "uv": 191,
                "costPerUv": 15.09
            },
            {
                "placement": "简单投全域计划",
                "campaignType": "简单投",
                "spend": 42403.02,
                "ctr": None,
                "cpc": None,
                "cpm": None,
                "orders": 2257,
                "gmv": 168346.72,
                "roi": 3.97,
                "uv": 5434,
                "costPerUv": 7.80
            },
            {
                "placement": "红猫CID全域总计",
                "campaignType": "合计",
                "spend": 101427.78,
                "ctr": None,
                "cpc": None,
                "cpm": None,
                "orders": 4175,
                "gmv": 361230.81,
                "roi": 3.56,
                "uv": 9389,
                "costPerUv": 10.80
            }
        ]
    }

def build_content_audience_matrix():
    rows_raw = clean_csv(RAW_B / "brand_fs_lRXQ0O.json")
    cur_tag = ""
    matrix_rows = []
    for r in rows_raw[6:]:
        if not any(r):
            continue
        first_cell = r[0].strip()
        if first_cell:
            cur_tag = first_cell
        aud = r[1].strip() if len(r) > 1 else ""
        if not aud:
            continue
        spend = num(r[2]) if len(r) > 2 else None
        impr = num(r[3]) if len(r) > 3 else None
        clicks = num(r[4]) if len(r) > 4 else None
        ctr = num(r[5], pct=True) if len(r) > 5 else None
        cpc = num(r[6]) if len(r) > 6 else None
        cpm = num(r[7]) if len(r) > 7 else None
        plays5s = num(r[8]) if len(r) > 8 else None
        ctr5s = num(r[9], pct=True) if len(r) > 9 else None

        matrix_rows.append({
            "contentTag": cur_tag,
            "audiencePkg": aud,
            "spend": spend,
            "impressions": int(impr) if impr is not None else None,
            "clicks": int(clicks) if clicks is not None else None,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "plays5s": int(plays5s) if plays5s is not None else None,
            "ctr5s": ctr5s
        })

    return {
        "id": "huang-content-audience-matrix",
        "title": "内容标签×定向人群跨维转化矩阵",
        "category": "performance",
        "period": "2026年10月 (10.01 ~ 10.19)",
        "sourceId": "src-huang-tiane-brand-fs",
        "note": "品牌线9大内容标签与高潜人群包交叉矩阵：美食制作在质感美食家(消耗29,416元, CTR 14.98%)、家宴司膳局(消耗18,088元, CTR 15.89%)及溏心蛋人群(消耗17,460元, CTR 14.87%)转化效率最高；辅以生活记录、运动健身等圈层跨界。",
        "provenance": "feishu",
        "columns": [
            {"key": "contentTag", "title": "内容标签", "type": "string", "align": "left"},
            {"key": "audiencePkg", "title": "定向人群包", "type": "string", "align": "left"},
            {"key": "spend", "title": "消耗 (元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "展现量 (次)", "type": "integer", "align": "right"},
            {"key": "clicks", "title": "点击量 (次)", "type": "integer", "align": "right"},
            {"key": "ctr", "title": "点击率", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "点击成本 (元/次)", "type": "currency", "align": "right"},
            {"key": "cpm", "title": "千次展现 (元)", "type": "currency", "align": "right"},
            {"key": "plays5s", "title": "5s播放量 (次)", "type": "integer", "align": "right"},
            {"key": "ctr5s", "title": "5s播放率", "type": "percent", "align": "right"}
        ],
        "rows": matrix_rows
    }

def main():
    print("[+] 读取现存 huang-tiane.json...")
    data = json.loads(ENRICHMENT_JSON.read_text(encoding="utf-8"))
    existing_tables = data.get("tables", [])
    existing_table_ids = set(t["id"] for t in existing_tables)
    print(f"    原包含表数量: {len(existing_tables)}")

    new_t1 = build_creator_selection_funnel()
    new_t2 = build_cid_placement_breakdown()
    new_t3 = build_content_audience_matrix()

    mined_tables = [new_t1, new_t2, new_t3]
    for mt in mined_tables:
        print(f"    构建挖掘表: {mt['id']}, rows={len(mt['rows'])}")

    table_map = {t["id"]: t for t in existing_tables}
    for mt in mined_tables:
        table_map[mt["id"]] = mt

    ordered_tables = []
    for t in existing_tables:
        ordered_tables.append(table_map[t["id"]])
    for mt in mined_tables:
        if mt["id"] not in existing_table_ids:
            ordered_tables.append(mt)

    data["tables"] = ordered_tables
    print(f"[+] 更新后总表数: {len(data['tables'])}")

    ENRICHMENT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] 成功写回 {ENRICHMENT_JSON}")

def update_huang_model():
    model_path = REPO_ROOT / "feihe-mvp" / "features" / "campaign" / "huang-model.ts"
    if not model_path.exists():
        print(f"[-] huang-model.ts not found at {model_path}")
        return
    code = model_path.read_text(encoding="utf-8")
    if "brandContentTagsTable: HuangTableWithMeta;" in code:
        print("[+] huang-model.ts 已经包含新增表声明，无需重复注入")
        return

    decl_target = "  industryBenchmarksTable: HuangTableWithMeta;"
    decl_replace = """  industryBenchmarksTable: HuangTableWithMeta;
  brandContentTagsTable: HuangTableWithMeta;
  brandGenderTable: HuangTableWithMeta;
  brandGenderAgeTable: HuangTableWithMeta;
  creatorSelectionFunnelTable: HuangTableWithMeta;
  cidPlacementBreakdownTable: HuangTableWithMeta;
  contentAudienceMatrixTable: HuangTableWithMeta;

  brandContentTagsTop: Record<string, unknown>[];
  brandProvincesTop12: Record<string, unknown>[];
  brandKeywordsTop: Record<string, unknown>[];
  brandAudiencesTop10: Record<string, unknown>[];
  commerceCreativesTop10: Record<string, unknown>[];
  creatorFunnelStages: { name: string; value: number; rate: number | null; note?: string }[];
  genderAgeMatrix: {
    genders: string[];
    ageGroups: string[];
    cells: { gender: string; ageGroup: string; spend: number; engagements: number; cpe: number | null }[];
  };
  cidPlacementsComparison: Record<string, unknown>[];"""

    code_target = "  const industryBenchmarksTable = getTableMeta('huang-industry-benchmarks');"
    code_replace = """  const industryBenchmarksTable = getTableMeta('huang-industry-benchmarks');
  const brandContentTagsTable = getTableMeta('huang-brand-content-tags');
  const brandGenderTable = getTableMeta('huang-brand-gender');
  const brandGenderAgeTable = getTableMeta('huang-brand-gender-age');
  const creatorSelectionFunnelTable = getTableMeta('huang-creator-selection-funnel');
  const cidPlacementBreakdownTable = getTableMeta('huang-cid-placement-breakdown');
  const contentAudienceMatrixTable = getTableMeta('huang-content-audience-matrix');

  const brandContentTagsTop = [...brandContentTagsTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0));
  const brandProvincesTop12 = [...brandProvincesTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0)).slice(0, 12);
  const brandKeywordsTop = [...brandKeywordsTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0));
  const brandAudiencesTop10 = [...brandAudiencesTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0)).slice(0, 10);
  const commerceCreativesTop10 = [...commerceCreativesTable.rows].sort((a, b) => (parseNum(b.gmv) || 0) - (parseNum(a.gmv) || 0)).slice(0, 10);

  const creatorFunnelStages = [
    { name: '① 初选提报', value: 373, rate: 100.0, note: '全网初选373位适格博主' },
    { name: '② 一筛通过', value: 83, rate: 22.3, note: '团队初审83通过/69待定' },
    { name: '③ 二核通过', value: 58, rate: 15.5, note: '调性爆款二核通过' },
    { name: '④ 商务可接', value: 55, rate: 14.7, note: '排期、报价与排竞接洽' },
    { name: '⑤ 定档执行', value: 31, rate: 8.3, note: '含税总报价¥324,774' },
    { name: '⑥ 发布上线', value: 18, rate: 58.1, note: '18篇顺利发布，收集率100%' },
  ];

  const genderSet = new Set<string>();
  const ageSet = new Set<string>();
  brandGenderAgeTable.rows.forEach((r) => {
    if (r.gender) genderSet.add(String(r.gender));
    if (r.ageGroup) ageSet.add(String(r.ageGroup));
  });
  const genders = ['女', '男'].filter((g) => genderSet.has(g));
  const ageGroups = Array.from(ageSet).sort((a, b) => {
    const numA = parseInt(a.replace(/\\D/g, '') || '0', 10);
    const numB = parseInt(b.replace(/\\D/g, '') || '0', 10);
    return numA - numB;
  });
  const cells = brandGenderAgeTable.rows.map((r) => ({
    gender: String(r.gender || ''),
    ageGroup: String(r.ageGroup || ''),
    spend: parseNum(r.spend) || 0,
    engagements: parseNum(r.engagements) || 0,
    cpe: parseNum(r.cpe),
  }));
  const genderAgeMatrix = { genders, ageGroups, cells };
  const cidPlacementsComparison = cidPlacementBreakdownTable.rows;"""

    ret_target = "    industryBenchmarksTable,"
    ret_replace = """    industryBenchmarksTable,
    brandContentTagsTable,
    brandGenderTable,
    brandGenderAgeTable,
    creatorSelectionFunnelTable,
    cidPlacementBreakdownTable,
    contentAudienceMatrixTable,

    brandContentTagsTop,
    brandProvincesTop12,
    brandKeywordsTop,
    brandAudiencesTop10,
    commerceCreativesTop10,
    creatorFunnelStages,
    genderAgeMatrix,
    cidPlacementsComparison,"""

    assert decl_target in code, f"decl_target not found in {model_path}"
    assert code_target in code, f"code_target not found in {model_path}"
    assert ret_target in code, f"ret_target not found in {model_path}"

    code = code.replace(decl_target, decl_replace, 1)
    code = code.replace(code_target, code_replace, 1)
    code = code.replace(ret_target, ret_replace, 1)
    model_path.write_text(code, encoding="utf-8")
    print(f"[+] 成功更新 {model_path}")

def update_huang_board():
    board_path = REPO_ROOT / "feihe-mvp" / "features" / "campaign" / "HuangTianeBoard.tsx"
    if not board_path.exists():
        print(f"[-] HuangTianeBoard.tsx not found at {board_path}")
        return
    raw_text = board_path.read_text(encoding="utf-8")
    lines = raw_text.splitlines()
    ads_idx = -1
    for i, line in enumerate(lines):
        if "if (section === 'ads')" in line:
            ads_idx = i
            break
    assert ads_idx > 0, "Could not find 'if (section === \\'ads\\')' in HuangTianeBoard.tsx"
    tail_code = "\n".join(lines[ads_idx:])

    overview_code = """'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  BudgetComparisonChart,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  HorizontalBarChart,
  TargetBulletChart,
  DonutChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type ComparisonDatum,
  type MetricStripItem,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
} from './CampaignCharts';
import { CampaignComboChart, type ComboSeries } from './CampaignComboChart';
import {
  extractHuangTianeData,
  formatNum,
  formatCurrency,
  formatPercent,
  parseNum,
} from './huang-model';
import './huang-tiane.css';

export interface HuangTianeBoardProps {
  dashboard: CampaignDashboard;
  section?: 'overview' | 'ads' | 'content';
}

export function HuangTianeBoard({ dashboard, section = 'overview' }: HuangTianeBoardProps) {
  const model = useMemo(() => extractHuangTianeData(dashboard), [dashboard]);
  const [adsScope, setAdsScope] = useState<'brand' | 'cid' | 'commerce'>('brand');
  const [creatorTableOpen, setCreatorTableOpen] = useState<boolean>(false);
  const [kosTableOpen, setKosTableOpen] = useState<boolean>(false);
  const [showAllAudiences, setShowAllAudiences] = useState<boolean>(false);
  const [showAllProvinces, setShowAllProvinces] = useState<boolean>(false);
  const [showAllCreatives, setShowAllCreatives] = useState<boolean>(false);
  const [selectedBenchmarkMetric, setSelectedBenchmarkMetric] = useState<'CTR' | 'CPC' | 'CPM' | 'CPE' | 'CPI' | 'CPTI'>('CTR');

  const topMetricItems: MetricStripItem[] = useMemo(() => {
    return [
      {
        label: '品牌FS消耗 / 预算进度',
        value: model.brandSpend !== null ? formatCurrency(model.brandSpend) : '—',
        hint: `预算 ${formatCurrency(model.brandBudgetVal)} · 进度 ${formatPercent(model.brandBudgetProgress, 1)}`,
        status: 'accent',
      },
      {
        label: '种草I/TI人群 · CPTI',
        value: `${formatNum(parseNum(model.brandSummary?.seed_total), 0)} 人`,
        hint: `TI心智 ${formatNum(parseNum(model.brandSummary?.seed_ti), 0)} 人 · CPTI ${formatCurrency(parseNum(model.brandSummary?.cpti))}`,
        status: 'success',
      },
      {
        label: '红猫CID全域消耗',
        value: model.cidTotalSpend !== null ? formatCurrency(model.cidTotalSpend) : '—',
        hint: `标准投 ${formatCurrency(model.cidStandardSpend)} · 简单投 ${formatCurrency(model.cidSimpleSpend)}`,
        status: 'neutral',
      },
      {
        label: '红猫CID成交GMV · ROI',
        value: model.cidTotalGmv !== null ? formatCurrency(model.cidTotalGmv) : '—',
        hint: `全域ROI ${model.cidOverallRoi !== null ? model.cidOverallRoi.toFixed(2) : '—'}倍 (标准3.27 / 简单3.97)`,
        status: 'accent',
      },
      {
        label: '闭环商销累计消耗',
        value: model.commerceSpend !== null ? formatCurrency(model.commerceSpend) : '—',
        hint: `全渠道销售日均约 ¥1,486`,
        status: 'neutral',
      },
      {
        label: '商销成交GMV · 订单',
        value: model.commerceGmv !== null ? formatCurrency(model.commerceGmv) : '—',
        hint: `订单 ${formatNum(model.commerceOrders, 0)} 单 · 加购 ${formatNum(model.commerceCart, 0)} 次`,
        status: 'accent',
      },
      {
        label: '达人选号定档 / 发布率',
        value: `${model.creatorsPublished} / ${model.creatorsCount} 位`,
        hint: `已发布 ${formatPercent(model.creatorsPublishRate, 1)} · 素材收集 ${model.creatorsAssetCollected} 篇`,
        status: 'success',
      },
      {
        label: 'KOS笔记矩阵发布量',
        value: `${model.kosCount} 篇`,
        hint: '10/19 集中引爆 · FS/CID/商销多线联动',
        status: 'neutral',
      },
    ];
  }, [model]);

  const statusSummary = useMemo(() => {
    return model.creatorStatusBreakdown.map((s) => `${s.status} ${s.count} 篇`).join('、');
  }, [model.creatorStatusBreakdown]);

  if (section === 'overview') {
    const budgetData: ComparisonDatum[] = model.brandBudgetVal !== null && model.brandSpend !== null
      ? [
          {
            label: '品牌FS预算与实绩',
            target: model.brandBudgetVal,
            actual: model.brandSpend,
            unit: '元',
          },
        ]
      : [];

    // Benchmark computation
    const benchmarkMetric = selectedBenchmarkMetric;
    const bRows = model.industryBenchmarksTable.rows;
    const shengshiItem = bRows.find((r) => r.category === '生食/有机蛋' && r.metric === benchmarkMetric);
    const xinxianItem = bRows.find((r) => r.category === '新鲜蛋' && r.metric === benchmarkMetric);
    const bs = model.brandSummary;
    let benpinNum: number | null = null;
    if (bs) {
      if (benchmarkMetric === 'CTR') benpinNum = parseNum(bs.ctr);
      else if (benchmarkMetric === 'CPC') benpinNum = parseNum(bs.cpc);
      else if (benchmarkMetric === 'CPM') benpinNum = parseNum(bs.cpm);
      else if (benchmarkMetric === 'CPE') benpinNum = parseNum(bs.cpe);
      else if (benchmarkMetric === 'CPI') benpinNum = parseNum(bs.cpi);
      else if (benchmarkMetric === 'CPTI') benpinNum = parseNum(bs.cpti);
    }
    const benchmarkUnit = shengshiItem?.unit ? String(shengshiItem.unit) : (benchmarkMetric === 'CTR' ? '%' : '元');

    // Funnel 1: Brand FS Seeding Funnel
    const brandFunnelStages: FunnelStageDatum[] = bs
      ? [
          { stage: '① 品牌曝光展现', value: parseNum(bs.impressions), unit: '次', conversionLabel: '100.0%', color: CAMPAIGN_PALETTE.primary },
          { stage: '② 笔记有效点击', value: parseNum(bs.clicks), unit: '次', conversionLabel: `CTR ${formatPercent(parseNum(bs.ctr))}`, costLabel: `CPC ${formatCurrency(parseNum(bs.cpc))}`, color: '#3b8b7e' },
          { stage: '③ 深度受众互动', value: parseNum(bs.engagements), unit: '次', conversionLabel: `互动量 ${formatNum(parseNum(bs.engagements), 0)}`, costLabel: `CPE ${formatCurrency(parseNum(bs.cpe))}`, color: CAMPAIGN_PALETTE.purple },
          { stage: '④ 种草I人群沉淀', value: parseNum(bs.seed_i), unit: '人', conversionLabel: '初度兴趣人群', costLabel: `CPI ${formatCurrency(parseNum(bs.cpi))}`, color: CAMPAIGN_PALETTE.gold },
          { stage: '⑤ 种草TI深度心智', value: parseNum(bs.seed_ti), unit: '人', conversionLabel: '深度转化心智', costLabel: `CPTI ${formatCurrency(parseNum(bs.cpti))}`, color: CAMPAIGN_PALETTE.terracotta },
        ]
      : [];

    // Funnel 2: Red Cat CID E-Commerce Funnel
    const cidFunnelStages: FunnelStageDatum[] = [
      { stage: '① CID全域曝光展现', value: 213846, unit: '次', conversionLabel: '100.0%', color: CAMPAIGN_PALETTE.primary },
      { stage: '② 电商引流点击跳转', value: 19255, unit: '次', conversionLabel: 'CTR 9.00%', costLabel: 'CPC ¥1.14', color: '#3b8b7e' },
      { stage: '③ 商品进店访客量', value: model.cidTotalUv, unit: '人次', conversionLabel: '进店率 48.8%', costLabel: `进店成本 ¥${((model.cidTotalSpend || 0) / (model.cidTotalUv || 1)).toFixed(2)}`, color: CAMPAIGN_PALETTE.purple },
      { stage: '④ 支付成交订单量', value: model.cidTotalOrders, unit: '单', conversionLabel: '客单率 44.5%', costLabel: `订单成本 ¥${((model.cidTotalSpend || 0) / (model.cidTotalOrders || 1)).toFixed(2)}`, color: CAMPAIGN_PALETTE.gold },
      { stage: '⑤ 最终成交GMV产出', value: model.cidTotalGmv ? Math.round(model.cidTotalGmv) : null, unit: '元', conversionLabel: `ROI ${model.cidOverallRoi?.toFixed(2) ?? '—'}倍`, color: CAMPAIGN_PALETTE.terracotta },
    ];

    // Funnel 3: Creator Selection Funnel
    const creatorFunnelChartStages: FunnelStageDatum[] = [
      { stage: '① 全网初选提报', value: 373, unit: '人', conversionLabel: '100.0%', subtext: '全量初选池373位博主', color: CAMPAIGN_PALETTE.primary },
      { stage: '② 团队初审一筛通过', value: 83, unit: '人', conversionLabel: '留存 22.3%', subtext: '83人通过 / 69人待定', color: '#3b8b7e' },
      { stage: '③ 策略把关二核通过', value: 58, unit: '人', conversionLabel: '留存 15.5%', subtext: '蛋品精致调性二核严选', color: CAMPAIGN_PALETTE.purple },
      { stage: '④ 商务接洽确认可接', value: 55, unit: '人', conversionLabel: '留存 14.7%', subtext: '排期、报价与排竞确认', color: CAMPAIGN_PALETTE.gold },
      { stage: '⑤ 10月最终执行定档', value: 31, unit: '人', conversionLabel: '定档 8.3%', costLabel: '含税总报价 ¥324,774', color: CAMPAIGN_PALETTE.terracotta },
      { stage: '⑥ 实际发布并收录上线', value: 18, unit: '篇', conversionLabel: '发布率 58.1%', subtext: '已顺利上线18篇, 收集率100%', color: '#277a6f' },
    ];

    // Content tags bar chart
    const contentTagsChartData: ChartDatum[] = model.brandContentTagsTop.slice(0, 8).map((r) => ({
      label: String(r.contentTag || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} · CPC ${formatCurrency(parseNum(r.cpc))}`,
    }));

    // Keywords bar chart
    const keywordsChartData: ChartDatum[] = model.brandKeywordsTop.slice(0, 8).map((r) => ({
      label: String(r.keywordCategory || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} · CPM ${formatCurrency(parseNum(r.cpm))}`,
    }));

    // Top 12 Provinces bar chart
    const provincesChartData: ChartDatum[] = model.brandProvincesTop12.map((r) => ({
      label: String(r.province || ''),
      value: parseNum(r.spend),
      detail: `互动 ${formatNum(parseNum(r.engagements), 0)} 次 · CPE ${formatCurrency(parseNum(r.cpe))}`,
    }));

    // Gender x Age Heatmap Cells
    const heatmapCells: MatrixHeatmapCell[] = model.genderAgeMatrix.cells.map((c) => ({
      row: c.gender,
      col: c.ageGroup,
      value: c.spend,
      displayValue: formatCurrency(c.spend, 0),
      subtext: `互动 ${c.engagements}次 · CPE ${c.cpe ? formatCurrency(c.cpe) : '—'}`,
    }));

    // Gender Donut
    const femaleSpend = model.brandGenderTable.rows.find((r) => r.gender === '女')?.spend;
    const maleSpend = model.brandGenderTable.rows.find((r) => r.gender === '男')?.spend;
    const genderDonutData: ChartDatum[] = [
      { label: '女性受众', value: parseNum(femaleSpend), color: CAMPAIGN_PALETTE.primary },
      { label: '男性受众', value: parseNum(maleSpend), color: CAMPAIGN_PALETTE.purple },
    ];

    // Series definitions
    const cidCompareSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '聚合ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const cidDailySeries: ComboSeries[] = [
      { key: 'spend', label: '日消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '日成交ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceMonthlySeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '阶段ROI', unit: '倍', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceCartOrdersSeries: ComboSeries[] = [
      { key: 'cart', label: '加购量', unit: '次', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'orders', label: '支付订单', unit: '单', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'spend', label: '消耗', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const creatorTierSeries: ComboSeries[] = [
      { key: 'count', label: '达人人数', unit: '位', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'totalFee', label: '含平台费报价', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const contentDirectionSeries: ComboSeries[] = [
      { key: 'total', label: '计划总篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'published', label: '已发布篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
    ];

    return (
      <div className="ht-board" data-testid="huang-tiane-overview">
        {/* 看板头部 */}
        <div className="ht-header">
          <div className="ht-header-left">
            <h2 className="ht-header-title">黄天鹅 · 战役全域经营洞察与深层数据挖掘</h2>
            <span className="ht-header-badge">五层递进分析体系</span>
          </div>
          <div className="ht-header-meta">
            品牌与CID周期：{model.brandPeriod} · 商销周期：{model.commercePeriod}
          </div>
        </div>

        {/* 分层快速导航锚点条 */}
        <div className="ht-nav-anchors-container">
          <nav className="ht-nav-anchors" aria-label="看板分层快速导航">
            <a href="#ht-layer-1" className="ht-nav-anchor">① 全域经营与行业基准</a>
            <a href="#ht-layer-2" className="ht-nav-anchor">② 三线转化漏斗与日趋势</a>
            <a href="#ht-layer-3" className="ht-nav-anchor">③ 内容标签/搜索/人群引擎</a>
            <a href="#ht-layer-4" className="ht-nav-anchor">④ 受众性别年龄与地域画像</a>
            <a href="#ht-layer-5" className="ht-nav-anchor">⑤ 达人选号漏斗与KOS矩阵</a>
          </nav>
        </div>

        {/* 第一层：全域三线经营总览与蛋品行业基准对标 */}
        <section id="ht-layer-1" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第一层 · 全域三线经营总览与蛋品行业基准对标 (重)</h3>
            <span className="ht-layer-sub">8项核心全域KPI与蛋品大盘对照</span>
          </div>

          <MetricStrip items={topMetricItems} />

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS预算推进与实绩对照"
              subtitle={
                model.brandBudgetVal !== null && model.brandSpend !== null
                  ? `预算额度 ${formatCurrency(model.brandBudgetVal)}，累计消耗 ${formatCurrency(model.brandSpend)}，执行率 ${formatPercent(model.brandBudgetProgress, 1)}`
                  : undefined
              }
            >
              {budgetData.length > 0 ? (
                <BudgetComparisonChart data={budgetData} unit="元" />
              ) : (
                <div className="ht-notice">暂无预算对照数据</div>
              )}
              <div className="ht-notice" style={{ marginTop: 12 }}>
                *剩余可用预算 {formatCurrency((model.brandBudgetVal || 0) - (model.brandSpend || 0))}，消耗进度 31.54%，投放节奏平稳可控。
              </div>
            </ChartPanel>

            <ChartPanel
              title="蛋品行业大盘基准与黄天鹅实绩对标"
              subtitle={`对标蛋品行业基准 (生食/有机蛋 vs 新鲜蛋) · 当前指标: ${benchmarkMetric}`}
              actions={
                <div className="ht-benchmark-tabs">
                  {(['CTR', 'CPC', 'CPM', 'CPE', 'CPI', 'CPTI'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`ht-benchmark-tab ${selectedBenchmarkMetric === m ? 'active' : ''}`}
                      onClick={() => setSelectedBenchmarkMetric(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="ht-benchmark-grid">
                <div className="ht-benchmark-card">
                  <div className="ht-benchmark-title">生食/有机蛋大盘区间</div>
                  <div className="ht-benchmark-val">
                    {shengshiItem ? `${shengshiItem.lower} ~ ${shengshiItem.upper} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">行业样本中位区间</div>
                </div>
                <div className="ht-benchmark-card">
                  <div className="ht-benchmark-title">新鲜蛋大盘区间</div>
                  <div className="ht-benchmark-val">
                    {xinxianItem ? `${xinxianItem.lower} ~ ${xinxianItem.upper} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">大众基础蛋品均值</div>
                </div>
                <div className="ht-benchmark-card highlight">
                  <div className="ht-benchmark-title">黄天鹅本品实绩</div>
                  <div className="ht-benchmark-val">
                    {benpinNum !== null ? `${benpinNum} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">
                    {benpinNum !== null && shengshiItem && benpinNum >= (parseNum(shengshiItem.lower) || 0)
                      ? '✓ 处于生食/高端蛋优势区间'
                      : '实绩表现受众心智稳固'}
                  </div>
                </div>
              </div>
              <div className="ht-notice">
                *蛋品行业基准来源于小红书蛋品行业大盘实盘透视表（涵盖生食蛋/有机蛋6家头部品牌大盘基准数据）。
              </div>
            </ChartPanel>
          </div>
        </section>

        {/* 第二层：三大漏斗与趋势 */}
        <section id="ht-layer-2" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第二层 · 品牌种草 / 红猫CID / 闭环商销 三大漏斗与趋势 (重)</h3>
            <span className="ht-layer-sub">全链路展现→点击→进店→转化→GMV与分日走势</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS 种草人群心智沉淀全链路漏斗"
              subtitle="展现 (403.8万) → 点击 (51.7万) → 互动 (5606次) → 种草I (2.3万人) → 种草TI (4008人)"
            >
              <CampaignFunnelChart stages={brandFunnelStages} />
            </ChartPanel>

            <ChartPanel
              title="红猫CID 电商引流转化与成交全链路漏斗"
              subtitle="展现 (21.4万) → 点击 (1.9万) → 进店 (9389人) → 订单 (4175单) → GMV (¥36.1万)"
            >
              <CampaignFunnelChart stages={cidFunnelStages} />
            </ChartPanel>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="红猫CID 标准投与简单投效能对比"
              subtitle={`标准投聚合ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'}倍 · 简单投聚合ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}倍`}
            >
              <CampaignComboChart
                rows={model.cidTypeComparison}
                series={cidCompareSeries}
                xKey="type"
                title="标准投与简单投指标对照"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="红猫CID 日消耗与成交GMV走势"
              subtitle={
                model.cidTotalSpend !== null && model.cidTotalGmv !== null
                  ? `累计消耗 ${formatCurrency(model.cidTotalSpend)}，成交GMV ${formatCurrency(model.cidTotalGmv)}${model.cidOverallRoi !== null ? `，综合ROI ${model.cidOverallRoi.toFixed(2)}倍` : ''}`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.cidTotal}
                series={cidDailySeries}
                xKey="date"
                title="红猫CID日消耗与成交GMV走势"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 各月消耗与GMV对照"
              subtitle={
                model.commerceSpend !== null && model.commerceGmv !== null
                  ? `全周期消耗 ${formatCurrency(model.commerceSpend)}，成交GMV ${formatCurrency(model.commerceGmv)}${model.commerceRoi !== null ? `，综合ROI ${model.commerceRoi.toFixed(2)}倍` : ''}`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.commerceMonths as unknown as Record<string, unknown>[]}
                series={commerceMonthlySeries}
                xKey="monthShort"
                title="商销各月消耗与GMV"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 加购量与支付订单走势"
              subtitle={
                model.commerceCart !== null && model.commerceOrders !== null
                  ? `加购累计 ${formatNum(model.commerceCart, 0)} 次，支付订单累计 ${formatNum(model.commerceOrders, 0)} 单`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.commerceDaily}
                series={commerceCartOrdersSeries}
                xKey="date"
                title="商销加购与订单走势"
                height={260}
              />
            </ChartPanel>
          </div>
        </section>

        {/* 第三层：内容标签、搜索词类与定向人群 */}
        <section id="ht-layer-3" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第三层 · 12大内容标签、10大搜索词类与定向人群引擎 (中重)</h3>
            <span className="ht-layer-sub">内容×人群×关键词三维引擎表现</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌线 12大笔记内容标签投放表现"
              subtitle="美食制作独占81.7%消耗与44万点击，CTR 13.12%表现极佳"
            >
              <HorizontalBarChart data={contentTagsChartData} unit="元" height={280} />
            </ChartPanel>

            <ChartPanel
              title="品牌线 10大搜索词类投放表现"
              subtitle="品牌词独占¥28,786消耗与9.9万点击，品类词CTR 11.23%居次"
            >
              <HorizontalBarChart data={keywordsChartData} unit="元" height={280} />
            </ChartPanel>

            <ChartPanel
              title="品牌线 Top 8 定向人群包消耗与种草表现"
              subtitle="质感美食家、家宴司膳局、溏心蛋人群构成核心种草引擎"
            >
              <HorizontalBarChart
                data={model.brandAudiencesTop10.slice(0, 8).map((r) => ({
                  label: String(r.audience || ''),
                  value: parseNum(r.spend),
                  detail: `种草I+TI: ${formatNum(parseNum(r.seed_total), 0)}人 · 成本 ${formatCurrency(parseNum(r.cp_total))}`,
                }))}
                unit="元"
                height={280}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 Top 10 成交素材创意排行"
              subtitle="头部商销素材GMV与转化ROI产出排行"
            >
              <HorizontalBarChart
                data={model.commerceCreativesTop10.slice(0, 8).map((r) => ({
                  label: String(r.creativeName || '').slice(0, 18),
                  value: parseNum(r.gmv),
                  detail: `订单 ${r.orders}单 · ROI ${r.roi ?? '—'} · 展现 ${formatNum(parseNum(r.impressions), 0)}`,
                }))}
                unit="元"
                height={280}
              />
            </ChartPanel>
          </div>
        </section>

        {/* 第四层：受众人口学 24 维热力矩阵与地域渗透 */}
        <section id="ht-layer-4" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第四层 · 受众人口学 24 维热力矩阵与地域渗透 (中)</h3>
            <span className="ht-layer-sub">性别×年龄二维消耗/互动交叉矩阵与重点省份渗透</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌线受众 性别×年龄 24维交叉热力矩阵"
              subtitle="女性33-40岁(¥5.68万)与28-32岁(¥3.68万)为绝对黄金核心客群"
            >
              <MatrixHeatmapChart
                rows={model.genderAgeMatrix.genders}
                cols={model.genderAgeMatrix.ageGroups}
                cells={heatmapCells}
                unit="元"
                rowHeaderTitle="性别 \\ 年龄"
                showRowTotals={true}
              />
            </ChartPanel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartPanel
                title="品牌受众 性别基本盘分布"
                subtitle="女性受众消耗占比 92.4%，男性占比 7.6%"
              >
                <DonutChart data={genderDonutData} unit="元" centerLabel="性别分布" />
              </ChartPanel>

              <ChartPanel
                title="Top 12 重点渗透省份与地区表现"
                subtitle="广东(¥2.79万)、江苏(¥2.42万)、浙江(¥1.81万)领衔华东华南高潜市场"
              >
                <HorizontalBarChart data={provincesChartData.slice(0, 6)} unit="元" height={200} />
              </ChartPanel>
            </div>
          </div>
        </section>

        {/* 第五层：达人选号淘汰漏斗、菜品方向与 11 月储备 */}
        <section id="ht-layer-5" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第五层 · 达人选号淘汰漏斗、菜品方向与 11 月储备池 (轻)</h3>
            <span className="ht-layer-sub">10月选号漏斗与11月储备池196位规划</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="10月达人选号全流程淘汰漏斗"
              subtitle="提报初选 (373人) → 一筛 (83人) → 二核 (58人) → 可接 (55人) → 定档 (31人) → 发布 (18篇)"
            >
              <CampaignFunnelChart stages={creatorFunnelChartStages} />
            </ChartPanel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartPanel
                title="达人层级分布与含平台费报价"
                subtitle={`共 ${model.creatorsCount} 位达人，涵盖 ${model.creatorTierBreakdown.length} 个账号量级`}
              >
                <CampaignComboChart
                  rows={model.creatorTierBreakdown as unknown as Record<string, unknown>[]}
                  series={creatorTierSeries}
                  xKey="tier"
                  title="达人层级人数与费用"
                  height={200}
                />
              </ChartPanel>

              <ChartPanel
                title="11月储备池与舆情策略规划预览"
                subtitle="已储备196位达人 · 首批定档锁定18位 · 规划总预算18万元"
              >
                <div className="ht-reserve-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ht-primary)' }}>
                      11月双11爆发期达人储备规划
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ht-gold)', fontWeight: 600 }}>
                      总规划预算: ¥180,000
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ht-text-muted)', lineHeight: 1.6 }}>
                    针对10月账号评论区溏心蛋科普疑虑，11月重点布局：<strong>① 科普实测解惑</strong> (Alex实话实测/我是不白吃, 维护品牌形象)；<strong>② 邪修溏心蛋</strong> (微波炉/空气炸锅邪修教程, 制造破圈话题)；<strong>③ 双11节点晒单收割</strong>。
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="ht-badge ht-badge-active">话题引爆 ¥5万</span>
                    <span className="ht-badge ht-badge-active">实验测评 ¥3.5万</span>
                    <span className="ht-badge ht-badge-active">美食分享 ¥3万</span>
                    <span className="ht-badge ht-badge-active">溏心蛋教程 ¥2.8万</span>
                    <span className="ht-badge ht-badge-active">场景代入 ¥2.1万</span>
                    <span className="ht-badge ht-badge-active">晒单节促 ¥1.6万</span>
                  </div>
                </div>
              </ChartPanel>
            </div>
          </div>

          {/* 底部折叠明细表收纳 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="ht-btn ht-btn-secondary"
              onClick={() => setCreatorTableOpen((prev) => !prev)}
            >
              {creatorTableOpen ? '收起 31位达人定档执行明细表 ▲' : '查看 31位达人定档执行明细表 ▼'}
            </button>
            <button
              type="button"
              className="ht-btn ht-btn-secondary"
              onClick={() => setKosTableOpen((prev) => !prev)}
            >
              {kosTableOpen ? '收起 65篇KOS笔记多线联动表 ▲' : '查看 65篇KOS笔记多线联动表 ▼'}
            </button>
          </div>

          {creatorTableOpen && (
            <div className="ht-table-card" style={{ marginTop: 12 }}>
              <div className="ht-table-title">31位定档达人执行明细 (按计划顺序)</div>
              <div className="ht-table-wrapper">
                <table className="ht-table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>达人昵称</th>
                      <th>量级</th>
                      <th>内容类型</th>
                      <th>菜品方向</th>
                      <th>裸价</th>
                      <th>含服务费报价</th>
                      <th>预计发布</th>
                      <th>执行状态</th>
                      <th>实际发布</th>
                      <th>素材收集</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.creators.map((c) => (
                      <tr key={c.index ?? c.kol_name}>
                        <td>{c.index}</td>
                        <td style={{ fontWeight: 500 }}>{c.kol_name}</td>
                        <td><span className="ht-badge">{c.account_tier}</span></td>
                        <td>{c.content_type || '—'}</td>
                        <td>{c.dish_type || c.content_direction || '—'}</td>
                        <td>{formatCurrency(c.price_raw)}</td>
                        <td>{formatCurrency(c.price_with_fee)}</td>
                        <td>{c.scheduled_date || '—'}</td>
                        <td>
                          <span className={`ht-badge ${c.execution_status === '已发布' ? 'ht-badge-active' : ''}`}>
                            {c.execution_status || '执行中'}
                          </span>
                        </td>
                        <td>{c.actual_publish_date || '—'}</td>
                        <td>
                          <span className={`ht-badge ${c.asset_collected ? 'ht-badge-collected' : 'ht-badge-uncollected'}`}>
                            {c.asset_collected ? '已收集' : '待收集'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {kosTableOpen && (
            <div className="ht-table-card" style={{ marginTop: 12 }}>
              <div className="ht-table-title">65篇KOS多线联动笔记明细 (10/19集中引爆)</div>
              <div className="ht-table-wrapper">
                <table className="ht-table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>账号名称</th>
                      <th>账号量级</th>
                      <th>内容类型</th>
                      <th>发布日期</th>
                      <th>品牌FS联动</th>
                      <th>红猫CID联动</th>
                      <th>商销联动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.kosNotes.map((k, idx) => (
                      <tr key={k.note_id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{k.account_name}</td>
                        <td><span className="ht-badge">{k.account_tier}</span></td>
                        <td>{k.content_type}</td>
                        <td>{k.publish_date || '2026-10-19'}</td>
                        <td><span className={`ht-badge ${k.fs_active ? 'ht-badge-active' : ''}`}>{k.fs_active ? '已复用' : '未复用'}</span></td>
                        <td><span className={`ht-badge ${k.cid_active ? 'ht-badge-active' : ''}`}>{k.cid_active ? '已复用' : '未复用'}</span></td>
                        <td><span className={`ht-badge ${k.commerce_active ? 'ht-badge-active' : ''}`}>{k.commerce_active ? '已复用' : '未复用'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  """

    new_content = overview_code + tail_code
    board_path.write_text(new_content, encoding="utf-8")
    print(f"[+] 成功写回 HuangTianeBoard.tsx, 总长度={len(new_content)}")

if __name__ == "__main__":
    main()
    update_huang_model()
    update_huang_board()
