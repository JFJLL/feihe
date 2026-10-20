"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type {
  CampaignDashboard,
  CampaignKpi,
  CampaignTable,
} from "../../lib/campaign-types";
import {
  MetricStrip,
  ChartPanel,
  DonutChart,
  BudgetComparisonChart,
  TargetBulletChart,
  type ChartDatum,
  type ComparisonDatum,
  CAMPAIGN_PALETTE,
} from "./CampaignCharts";
import "./campaign-analytics.css";
import "./CampaignOverviewPage.css";
import { CampaignComboChart } from "./CampaignComboChart";
import { CampaignEnrichmentPanels } from "./CampaignEnrichmentPanels";
import { buildCalendarRows } from "./campaign-daily-model";
import {
  safeNum,
  strictSum,
  isSummaryRow,
  extractKailasPlacements,
  extractWipesPlacements,
  extractMeilingFourLines,
  type PlacementRecord,
} from "./campaign-placement-model";

export interface CampaignOverviewPageProps {
  dashboard: CampaignDashboard;
}

function computeDateRange(
  rows?: { date: string }[],
): { minDate: string; maxDate: string; rangeText: string } | null {
  if (!rows || rows.length === 0) return null;
  const dates = rows
    .map((r) => String(r.date || ""))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return null;
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  return {
    minDate,
    maxDate,
    rangeText: `${minDate} ~ ${maxDate}`,
  };
}

export function CampaignOverviewPage({ dashboard }: CampaignOverviewPageProps) {
  const { projectId, name, reportPeriod, updatedAt, kpis = [], tables = [], dailyDatasets = [] } = dashboard;

  const [activeSnapshot, setActiveSnapshot] = useState<string>(() => {
    if (projectId === "kailas") return "daily-1018";
    if (projectId === "meiling") return "double11-1018";
    if (projectId === "winner-wipes") return "daily-1019";
    return "default";
  });

  const findTable = useCallback((id: string) => tables.find((t) => t.id === id), [tables]);
  const findKpi = useCallback((id: string) => kpis.find((k) => k.id === id), [kpis]);

  // Kailas tables
  const kailasBudgetLinesTable = findTable("kailas-budget-lines");
  const kailasFsPlacementsTable = findTable("kailas-fs-placements");
  const kailasQ3BudgetTable = findTable("kailas-unlocked-budget-ZpT73Q");
  const kailasQ3PerfTable = findTable("kailas-unlocked-performance-JPKUX9");

  // Project-specific daily datasets for sparklines and overview trend
  const kailasDailyDataset = useMemo(() => {
    return dailyDatasets.find((d) => d.id === "kailas-daily-fuga-creatives") || dailyDatasets[0];
  }, [dailyDatasets]);

  const meilingDailyDataset = useMemo(() => {
    return (
      dailyDatasets.find((d) => d.id === "meiling-daily-tm-seed") ||
      dailyDatasets.find((d) => d.id === "meiling-daily-cid-jd") ||
      dailyDatasets[0]
    );
  }, [dailyDatasets]);

  const wipesDailyDataset = useMemo(() => {
    return dailyDatasets.find((d) => d.id === "wipes-daily-delivery") || dailyDatasets[0];
  }, [dailyDatasets]);

  const kailasDailyInfo = useMemo(() => {
    if (!kailasDailyDataset) return null;
    const range = computeDateRange(kailasDailyDataset.rows);
    if (!range) return null;
    const rows = buildCalendarRows(kailasDailyDataset, range.minDate, range.maxDate);
    return { ...range, rows };
  }, [kailasDailyDataset]);

  const meilingDailyInfo = useMemo(() => {
    if (!meilingDailyDataset) return null;
    const range = computeDateRange(meilingDailyDataset.rows);
    if (!range) return null;
    const rows = buildCalendarRows(meilingDailyDataset, range.minDate, range.maxDate);
    return { ...range, rows };
  }, [meilingDailyDataset]);

  const wipesDailyInfo = useMemo(() => {
    if (!wipesDailyDataset) return null;
    const range = computeDateRange(wipesDailyDataset.rows);
    if (!range) return null;
    const rows = buildCalendarRows(wipesDailyDataset, range.minDate, range.maxDate);
    return { ...range, rows };
  }, [wipesDailyDataset]);

  const kailasDailyMetrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string; badge?: string; status?: "default" | "accent" | "warning" | "danger" | "success"; sparkline?: (number | null)[] }> => {
    const totalPlanned = findKpi("kailas-budget-total");
    const totalSpend = findKpi("kailas-spend-total");
    const progress = findKpi("kailas-budget-progress");
    const remaining = findKpi("kailas-budget-remaining");
    const spendSpark = (kailasDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.spend));
    const impSpark = (kailasDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.impressions));
    const clkSpark = (kailasDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.clicks));

    return [
      { label: totalPlanned?.label || "规划总预算", value: totalPlanned?.value ?? null, unit: totalPlanned?.unit || "元", note: totalPlanned?.period, badge: "现金口径", status: "default" },
      { label: totalSpend?.label || "累计总消耗", value: totalSpend?.value ?? null, unit: totalSpend?.unit || "元", note: totalSpend?.note, badge: "日流水走势", status: "accent", sparkline: spendSpark },
      { label: progress?.label || "预算执行进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.note, badge: Number(progress?.value) > 100 ? "超支预警" : "执行中", status: Number(progress?.value) > 100 ? "danger" : "accent", sparkline: impSpark },
      { label: remaining?.label || "预算差额", value: remaining?.value ?? null, unit: remaining?.unit || "元", note: remaining?.note, badge: Number(remaining?.value) < 0 ? "超额支出" : "剩余可用", status: Number(remaining?.value) < 0 ? "warning" : "default", sparkline: clkSpark },
    ];
  }, [findKpi, kailasDailyInfo]);

  const kailasQ3Metrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const q3SpendKpi = findKpi("kailas-unlocked-kpi-budget");
    const ctrKpi = findKpi("kailas-unlocked-kpi-ctr");
    const cpcKpi = findKpi("kailas-unlocked-kpi-cpc");
    const publishKpi = findKpi("kailas-unlocked-kpi-publish");

    return [
      { label: q3SpendKpi?.label || "Q3阶段总消耗", value: q3SpendKpi?.value ?? null, unit: q3SpendKpi?.unit || "元", note: q3SpendKpi?.period },
      { label: ctrKpi?.label || "CTR", value: ctrKpi?.value !== null && ctrKpi?.value !== undefined ? String(ctrKpi.value) + "%" : null, note: ctrKpi?.target !== null && ctrKpi?.target !== undefined ? "目标: ≥" + String(ctrKpi.target) + "%" : undefined },
      { label: cpcKpi?.label || "CPC", value: cpcKpi?.value !== null && cpcKpi?.value !== undefined ? "¥" + String(cpcKpi.value) : null, note: cpcKpi?.target !== null && cpcKpi?.target !== undefined ? "目标: <¥" + String(cpcKpi.target) : undefined },
      { label: publishKpi?.label || "笔记发布量", value: publishKpi?.value ?? null, unit: publishKpi?.unit || "篇", note: publishKpi?.target !== null && publishKpi?.target !== undefined ? "目标: " + String(publishKpi.target) + "篇" : undefined },
    ];
  }, [findKpi]);

  const kailasBudgetLinesComparison = useMemo((): ComparisonDatum[] => {
    if (!kailasBudgetLinesTable?.rows) return [];
    return kailasBudgetLinesTable.rows
      .filter((r) => !isSummaryRow(String(r.line || "")))
      .map((r) => ({
        label: String(r.line).replace(/\(.*?\)/g, "").trim(),
        actual: safeNum(r.spend),
        target: safeNum(r.planned),
        unit: "元",
        direction: "lower",
      }));
  }, [kailasBudgetLinesTable]);

  const kailasFsPlacementsData = useMemo((): PlacementRecord[] => {
    return extractKailasPlacements(kailasFsPlacementsTable);
  }, [kailasFsPlacementsTable]);

  const kailasQ3BudgetComparison = useMemo((): ComparisonDatum[] => {
    if (!kailasQ3BudgetTable?.rows) return [];
    return kailasQ3BudgetTable.rows
      .filter((r) => {
        const m = String(r.metric || "");
        return !isSummaryRow(m) && m.includes("费用") && !m.includes("篇数");
      })
      .map((r) => ({
        label: String(r.metric),
        actual: safeNum(r.actual),
        target: safeNum(r.planned),
        unit: "元",
        direction: "lower",
      }));
  }, [kailasQ3BudgetTable]);

  const kailasQ3TargetBullets = useMemo((): ComparisonDatum[] => {
    const targets = ["kailas-unlocked-kpi-ctr", "kailas-unlocked-kpi-cpc", "kailas-unlocked-kpi-cpe", "kailas-unlocked-kpi-cpm"];
    return targets
      .map((id) => findKpi(id))
      .filter((k): k is CampaignKpi => Boolean(k && k.target !== null))
      .map((k) => ({
        label: k.label,
        actual: k.value,
        target: k.target,
        unit: k.unit,
        direction: k.direction,
        comparison: k.comparison,
      }));
  }, [findKpi]);

  // Meiling tables
  const meilingExecutionTable = findTable("meiling-unlocked-double11-budget-execution");
  const meilingFourLinesTable = findTable("meiling-four-lines");
  const meiling618KpiTable = findTable("meiling-unlocked-618-kpi");

  const meilingDouble11Metrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string; badge?: string; status?: "default" | "accent" | "warning" | "danger" | "success"; sparkline?: (number | null)[] }> => {
    const spendKpi = findKpi("meiling-unlocked-kpi-d11-actual-spend");
    const progressKpi = findKpi("meiling-unlocked-kpi-d11-progress");
    const publishedKpi = findKpi("meiling-online-published-count");

    const summaryRow = meilingExecutionTable?.rows.find(
      (r) => isSummaryRow(String(r.model || "")) || isSummaryRow(String(r.series || ""))
    );
    const budgetVal = spendKpi?.target ?? safeNum(summaryRow?.newBudget);
    const actualVal = spendKpi?.value ?? safeNum(summaryRow?.actualSpend);

    const nonSummaryRows = (meilingFourLinesTable?.rows || []).filter((r) => !isSummaryRow(String(r.name || "")));
    const fourLinesGmv = strictSum(nonSummaryRows.map((r) => safeNum(r.gmv)));
    const spendSpark = (meilingDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.spend));
    const impSpark = (meilingDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.impressions));
    const clkSpark = (meilingDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.clicks));

    return [
      { label: "双11调整后总预算", value: budgetVal, unit: "元", note: "10.18快照调整预算口径", badge: "调整预算", status: "default" },
      { label: spendKpi?.label || "截至10.18消耗", value: actualVal, unit: "元", note: spendKpi?.period, badge: "近14日走势", status: "accent", sparkline: spendSpark },
      { label: progressKpi?.label || "大促消耗进度", value: progressKpi?.value !== null && progressKpi?.value !== undefined ? String(progressKpi.value) + "%" : null, note: "截至10.18累计", badge: "推进中", status: "warning", sparkline: impSpark },
      { label: "四线产出 GMV 总额", value: fourLinesGmv, unit: "元", note: publishedKpi?.value !== null && publishedKpi?.value !== undefined ? `${publishedKpi.label}: ${publishedKpi.value}${publishedKpi.unit || "篇"}` : undefined, badge: "四线独立归因", status: "success", sparkline: clkSpark },
    ];
  }, [meilingExecutionTable, meilingFourLinesTable, findKpi, meilingDailyInfo]);

  const meiling618Metrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const gmvKpi = findKpi("meiling-unlocked-kpi-618-gmv");
    const roiKpi = findKpi("meiling-unlocked-kpi-618-roi");
    const ctrKpi = findKpi("meiling-kpi-unlocked-618-self-ctr");
    const viralKpi = findKpi("meiling-kpi-unlocked-618-self-viralRate");

    return [
      { label: gmvKpi?.label || "618全渠道总GMV", value: gmvKpi?.value ?? null, unit: gmvKpi?.unit || "元", note: gmvKpi?.period },
      { label: roiKpi?.label || "618全案ROI", value: roiKpi?.value ?? null, note: roiKpi?.target !== null && roiKpi?.target !== undefined ? "目标: ≥" + String(roiKpi.target) : undefined },
      { label: ctrKpi?.label || "自采点击率(CTR)", value: ctrKpi?.value !== null && ctrKpi?.value !== undefined ? String(ctrKpi.value) + "%" : null, note: ctrKpi?.target !== null && ctrKpi?.target !== undefined ? "目标: ≥" + String(ctrKpi.target) + "%" : undefined },
      { label: viralKpi?.label || "自采爆文率", value: viralKpi?.value !== null && viralKpi?.value !== undefined ? String(viralKpi.value) + "%" : null, note: viralKpi?.target !== null && viralKpi?.target !== undefined ? "目标: ≥" + String(viralKpi.target) + "%" : undefined },
    ];
  }, [findKpi]);

  const meilingBudgetAggregatedData = useMemo((): ComparisonDatum[] => {
    if (!meilingExecutionTable?.rows) return [];
    const groups = new Map<string, { label: string; actuals: (number | null)[]; targets: (number | null)[] }>();

    for (const r of meilingExecutionTable.rows) {
      if (isSummaryRow(String(r.model || "")) || isSummaryRow(String(r.series || "")) || isSummaryRow(String(r.procurementForm || ""))) {
        continue;
      }
      const form = String(r.procurementForm || "其他").trim();
      const channel = String(r.channel || "-").trim();
      const key = `${form} · ${channel}`;

      if (!groups.has(key)) {
        groups.set(key, { label: key, actuals: [], targets: [] });
      }
      const g = groups.get(key)!;
      g.actuals.push(safeNum(r.actualSpend));
      g.targets.push(safeNum(r.newBudget));
    }

    return Array.from(groups.values()).map((g) => {
      const actualSum = strictSum(g.actuals);
      const targetSum = strictSum(g.targets);
      return {
        label: g.label,
        actual: actualSum !== null ? Number(actualSum.toFixed(2)) : null,
        target: targetSum !== null ? Number(targetSum.toFixed(2)) : null,
        unit: "元",
        direction: "lower",
      };
    });
  }, [meilingExecutionTable]);

  const meilingFourLinesData = useMemo((): PlacementRecord[] => {
    return extractMeilingFourLines(meilingFourLinesTable);
  }, [meilingFourLinesTable]);

  const meiling618BulletData = useMemo((): ComparisonDatum[] => {
    const targets = [
      "meiling-kpi-unlocked-618-self-ctr",
      "meiling-kpi-unlocked-618-self-viralRate",
      "meiling-kpi-unlocked-618-self-cpe",
      "meiling-kpi-unlocked-618-self-cpuv",
      "meiling-unlocked-kpi-618-roi",
    ];
    return targets
      .map((id) => findKpi(id))
      .filter((k): k is CampaignKpi => Boolean(k && k.target !== null))
      .map((k) => ({
        label: k.label,
        actual: k.value,
        target: k.target,
        unit: k.unit,
        direction: k.direction,
        comparison: k.comparison,
      }));
  }, [findKpi]);

  // Wipes tables
  const wipesBudgetAllocTable = findTable("wipes-budget-allocation");
  const wipesPlacementsTable = findTable("wipes-current-placements");

  const wipesDailyMetrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string; badge?: string; status?: "default" | "accent" | "warning" | "danger" | "success"; sparkline?: (number | null)[] }> => {
    const cumSpend = findKpi("wipes-cum-spend");
    const progress = findKpi("wipes-cum-progress");
    const cpuvT2 = findKpi("wipes-cum-cpuv-t2");
    const newCust = findKpi("wipes-cum-new-cust");
    const spendSpark = (wipesDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.spend));
    const impSpark = (wipesDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.impressions));
    const clkSpark = (wipesDailyInfo?.rows || []).slice(-14).map((r) => safeNum(r.clicks));

    return [
      { label: cumSpend?.label || "日常种草累计消耗", value: cumSpend?.value ?? null, unit: cumSpend?.unit || "元", note: cumSpend?.period, badge: "近14日消耗", status: "accent", sparkline: spendSpark },
      { label: progress?.label || "日常种草进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.target !== null && progress?.target !== undefined ? "目标: " + String(progress.target) + "%" : undefined, badge: "节奏跟踪", status: "default", sparkline: impSpark },
      { label: cpuvT2?.label || "CPUV(T-2)", value: cpuvT2?.value !== null && cpuvT2?.value !== undefined ? "¥" + String(cpuvT2.value) : null, note: cpuvT2?.period, badge: "访客成本", status: "success", sparkline: clkSpark },
      { label: newCust?.label || "新客占比", value: newCust?.value !== null && newCust?.value !== undefined ? String(newCust.value) + "%" : null, note: newCust?.period, badge: "拉新健康度", status: "accent" },
    ];
  }, [findKpi, wipesDailyInfo]);

  const wipesSheetMetrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const exposure = findKpi("wipes-online-daily-exposure");
    const cpuvFs = findKpi("wipes-online-daily-cpuv");
    const hitRate = findKpi("wipes-online-daily-hit-rate");
    const taoSearch = findKpi("wipes-online-daily-tao-search");

    return [
      { label: exposure?.label || "曝光量(KFS)", value: exposure?.value ?? null, unit: exposure?.unit || "次", note: exposure?.target !== null && exposure?.target !== undefined ? "目标: " + String(exposure.target) + "次" : undefined },
      { label: cpuvFs?.label || "CPUV(FS)", value: cpuvFs?.value !== null && cpuvFs?.value !== undefined ? "¥" + String(cpuvFs.value) : null, note: cpuvFs?.target !== null && cpuvFs?.target !== undefined ? "目标: ≤¥" + String(cpuvFs.target) : undefined },
      { label: hitRate?.label || "爆文率(KFS)", value: hitRate?.value !== null && hitRate?.value !== undefined ? String(hitRate.value) + "%" : null, note: hitRate?.target !== null && hitRate?.target !== undefined ? "目标: ≥" + String(hitRate.target) + "%" : undefined },
      { label: taoSearch?.label || "淘搜指数加总", value: taoSearch?.value ?? null, note: taoSearch?.target !== null && taoSearch?.target !== undefined ? "目标: " + String(taoSearch.target) : undefined },
    ];
  }, [findKpi]);

  const wipesBudgetDonutData = useMemo((): ChartDatum[] => {
    if (!wipesBudgetAllocTable?.rows) return [];
    return wipesBudgetAllocTable.rows
      .filter((r) => !isSummaryRow(String(r.channel || "")))
      .map((r, idx) => ({
        id: String(r.channel),
        label: String(r.channel),
        value: safeNum(r.budget),
        color: idx === 0 ? CAMPAIGN_PALETTE.primary : idx === 1 ? CAMPAIGN_PALETTE.purple : CAMPAIGN_PALETTE.gold,
      }));
  }, [wipesBudgetAllocTable]);

  const wipesPlacementsData = useMemo((): PlacementRecord[] => {
    return extractWipesPlacements(wipesPlacementsTable);
  }, [wipesPlacementsTable]);

  const wipesDailyTargetBullets = useMemo((): ComparisonDatum[] => {
    return kpis
      .filter((k) => k.id.startsWith("wipes-online-daily-") && k.target !== null)
      .map((k) => ({
        label: k.label.replace(/^日常种草\s*[·•-]\s*/, ""),
        actual: k.value,
        target: k.target,
        unit: k.unit,
        direction: k.direction,
        comparison: k.comparison,
      }));
  }, [kpis]);

  const wipesDocTargetBullets = useMemo((): ComparisonDatum[] => {
    return kpis
      .filter((k) => k.id.startsWith("wipes-online-doc-") && k.target !== null)
      .map((k) => ({
        label: k.label.replace(/^医生专家\s*[·•-]\s*/, ""),
        actual: k.value,
        target: k.target,
        unit: k.unit,
        direction: k.direction,
        comparison: k.comparison,
      }));
  }, [kpis]);

  const activeHeaderPeriod = useMemo(() => {
    if (projectId === "meiling") {
      if (activeSnapshot === "double11-1018") return meilingExecutionTable?.period || "双11大促执行期（截至10月18日累计）";
      if (activeSnapshot === "history-618") return meiling618KpiTable?.period || "2026年618大促（已结案）";
    }
    if (projectId === "kailas") {
      if (activeSnapshot === "daily-1018") return kailasBudgetLinesTable?.period || "10.16–10.18 日报";
      if (activeSnapshot === "q3-summary") return kailasQ3BudgetTable?.period || "7.16-9.27 Q3";
    }
    if (projectId === "winner-wipes") {
      if (activeSnapshot === "daily-1019") return wipesBudgetAllocTable?.period || "10.19 日报";
      if (activeSnapshot === "kpi-sheet") {
        const t = findTable("wipes-kpi-comparison-table");
        return t?.period || "飞书底表快照";
      }
    }
    return reportPeriod;
  }, [projectId, activeSnapshot, meilingExecutionTable, meiling618KpiTable, kailasBudgetLinesTable, kailasQ3BudgetTable, wipesBudgetAllocTable, findTable, reportPeriod]);

  // 严格按当前图表关联提取底层明细表，职责分离，不全量平铺
  const activeDetailTables = useMemo((): CampaignTable[] => {
    let list: (CampaignTable | undefined)[] = [];
    if (projectId === "kailas") {
      list = activeSnapshot === "daily-1018"
        ? [kailasBudgetLinesTable, kailasFsPlacementsTable]
        : [kailasQ3BudgetTable, findTable("kailas-unlocked-performance-JPKUX9")];
    } else if (projectId === "meiling") {
      list = activeSnapshot === "double11-1018"
        ? [meilingExecutionTable, meilingFourLinesTable]
        : [meiling618KpiTable, findTable("meiling-kpi-unlocked-kpi-618")];
    } else if (projectId === "winner-wipes") {
      list = activeSnapshot === "daily-1019"
        ? [wipesBudgetAllocTable, wipesPlacementsTable]
        : [findTable("wipes-kpi-comparison-table")];
    } else {
      list = tables.slice(0, 2);
    }
    return list.filter((t): t is CampaignTable => Boolean(t && t.rows && t.rows.length > 0));
  }, [projectId, activeSnapshot, kailasBudgetLinesTable, kailasFsPlacementsTable, kailasQ3BudgetTable, meilingExecutionTable, meilingFourLinesTable, meiling618KpiTable, wipesBudgetAllocTable, wipesPlacementsTable, findTable, tables]);

  const dynamicInsight = useMemo(() => {
    if (projectId === "kailas") {
      if (activeSnapshot === "daily-1018") {
        const overRuns = kailasBudgetLinesComparison.filter(
          (d) => d.actual !== null && d.target !== null && d.actual > d.target
        );
        const validCpuv = kailasFsPlacementsData.filter((r) => r.cpuv !== null);
        const lowestCpuv = validCpuv.length > 0 ? [...validCpuv].sort((a, b) => (a.cpuv || 0) - (b.cpuv || 0))[0] : null;
        const parts: string[] = [];
        if (overRuns.length > 0) {
          parts.push(overRuns.map((r) => `${r.label}超支 ${(r.actual! - r.target!).toLocaleString()}元`).join("；"));
        } else {
          parts.push("各预算行当前未见超支记录");
        }
        if (lowestCpuv?.cpuv !== null && lowestCpuv?.cpuv !== undefined) {
          parts.push(`版位中${lowestCpuv.name}转化成本最低(${lowestCpuv.cpuv}元/UV)`);
        }
        return `10.16–10.18 日报现金口径：${parts.join("，")}。FS版位排除汇总，UGC版位独立核算。`;
      }
      const q3Spend = findKpi("kailas-unlocked-kpi-budget");
      return `Q3双周会小结口径 (含返点)：规划预算 ${q3Spend?.target?.toLocaleString() || "—"}元，实际消耗 ${q3Spend?.value?.toLocaleString() || "—"}元。`;
    }

    if (projectId === "meiling") {
      if (activeSnapshot === "double11-1018") {
        const validGmvRows = meilingFourLinesData.filter((r) => r.gmv !== null);
        const bestGmv = validGmvRows.length > 0 ? [...validGmvRows].sort((a, b) => (b.gmv || 0) - (a.gmv || 0))[0] : null;
        return `双11大促执行（截至10月18日累计）：各渠道按调整预算执行；四线转化中${bestGmv ? `${bestGmv.name}产出最高(${bestGmv.gmv?.toLocaleString()}元，ROI: ${bestGmv.roi ?? "—"})` : "各链路独立核算"}。`;
      }
      const roi618 = findKpi("meiling-unlocked-kpi-618-roi");
      return `618大促已结案归档：全案ROI为 ${roi618?.value || "—"}（目标 ${roi618?.target || "—"}），供大促策略历史参考。`;
    }

    if (projectId === "winner-wipes") {
      if (activeSnapshot === "daily-1019") {
        const validCpuv = wipesPlacementsData.filter((r) => r.cpuv !== null);
        const bestPlacement = validCpuv.length > 0 ? [...validCpuv].sort((a, b) => (a.cpuv || 0) - (b.cpuv || 0))[0] : null;
        return `稳健酒精湿巾10.19日报口径：${bestPlacement ? `${bestPlacement.name}成本最低(${bestPlacement.cpuv}元/UV)` : "各版位分化核算"}。视频真实消耗入账。`;
      }
      const validTargets = wipesDailyTargetBullets.filter((d) => d.actual !== null && d.target !== null);
      const unknownCount = wipesDailyTargetBullets.length - validTargets.length;
      const notMet = validTargets.filter(
        (d) => (d.direction === "lower" ? d.actual! > d.target! : d.actual! < d.target!)
      );

      let statusDesc = "";
      if (validTargets.length === 0) {
        statusDesc = `暂无有效目标基准可比对${unknownCount > 0 ? `（${unknownCount}项待补目标值）` : ""}`;
      } else if (notMet.length > 0) {
        const notMetStr = notMet.map((m) => `${m.label}(实际${m.actual}${m.unit || ""} 目标${m.target})`).join("、");
        statusDesc = `日常种草中存在偏差项：${notMetStr}${unknownCount > 0 ? `；另有${unknownCount}项待补目标` : ""}`;
      } else {
        statusDesc = `已比对的${validTargets.length}项已设目标指标均达成${unknownCount > 0 ? `；另有${unknownCount}项待补目标` : ""}`;
      }

      return `飞书底表快照考核（未注明确切截止日期）：${statusDesc}，详见标靶图。`;
    }

    return `当前项目业务周期: ${activeHeaderPeriod}。核心数据基于最新入账记录动态呈现，缺值保持留白。`;
  }, [projectId, activeSnapshot, kailasBudgetLinesComparison, kailasFsPlacementsData, meilingFourLinesData, wipesPlacementsData, wipesDailyTargetBullets, findKpi, activeHeaderPeriod]);

  const activeDailyDataset = useMemo(() => {
    if (projectId === "kailas" && activeSnapshot === "daily-1018") return kailasDailyDataset;
    if (projectId === "meiling" && activeSnapshot === "double11-1018") return meilingDailyDataset;
    if (projectId === "winner-wipes" && activeSnapshot === "daily-1019") return wipesDailyDataset;
    return undefined;
  }, [projectId, activeSnapshot, kailasDailyDataset, meilingDailyDataset, wipesDailyDataset]);
  const activeMetrics = useMemo(() => {
    if (projectId === "kailas") return activeSnapshot === "daily-1018" ? kailasDailyMetrics : kailasQ3Metrics;
    if (projectId === "meiling") return activeSnapshot === "double11-1018" ? meilingDouble11Metrics : meiling618Metrics;
    if (projectId === "winner-wipes") return activeSnapshot === "daily-1019" ? wipesDailyMetrics : wipesSheetMetrics;
    return kpis.slice(0, 4).map((k) => ({ label: k.label, value: k.value, unit: k.unit, note: k.period }));
  }, [projectId, activeSnapshot, kailasDailyMetrics, kailasQ3Metrics, meilingDouble11Metrics, meiling618Metrics, wipesDailyMetrics, wipesSheetMetrics, kpis]);

  return (
    <div className="ca-page" role="main" aria-label={name + " 营销战役总览"}>
      {/* 1. Header (紧凑元信息 toolbar + 周期说明 + 业务快照切换器) */}
      <header className="ca-header bd-toolbar-compact">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">数据总览</h2>
            <span className="ca-header-badge">营销复盘</span>
            <span className="ca-header-subtitle">{activeHeaderPeriod}</span>
          </div>
        </div>

        <div className="ca-overview-selector-wrap">
          <span className="ca-overview-selector-label">业务快照:</span>
          <div className="ca-snapshot-pills" role="radiogroup" aria-label="选择业务分析快照">
            {projectId === "kailas" && (
              <>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "daily-1018" ? "active" : "")}
                  onClick={() => setActiveSnapshot("daily-1018")}
                  role="radio"
                  aria-checked={activeSnapshot === "daily-1018"}
                >
                  10.18 日报 (现金预算)
                </button>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "q3-summary" ? "active" : "")}
                  onClick={() => setActiveSnapshot("q3-summary")}
                  role="radio"
                  aria-checked={activeSnapshot === "q3-summary"}
                >
                  Q3 双周会小结 (含返点)
                </button>
              </>
            )}

            {projectId === "meiling" && (
              <>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "double11-1018" ? "active" : "")}
                  onClick={() => setActiveSnapshot("double11-1018")}
                  role="radio"
                  aria-checked={activeSnapshot === "double11-1018"}
                >
                  双11最新预算与四线 (截至10.18)
                </button>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "history-618" ? "active" : "")}
                  onClick={() => setActiveSnapshot("history-618")}
                  role="radio"
                  aria-checked={activeSnapshot === "history-618"}
                >
                  618 历史复盘 (参考)
                </button>
              </>
            )}

            {projectId === "winner-wipes" && (
              <>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "daily-1019" ? "active" : "")}
                  onClick={() => setActiveSnapshot("daily-1019")}
                  role="radio"
                  aria-checked={activeSnapshot === "daily-1019"}
                >
                  日常种草与计划预算 (10.19日报)
                </button>
                <button
                  type="button"
                  className={"ca-snapshot-btn " + (activeSnapshot === "kpi-sheet" ? "active" : "")}
                  onClick={() => setActiveSnapshot("kpi-sheet")}
                  role="radio"
                  aria-checked={activeSnapshot === "kpi-sheet"}
                >
                  KPI目标对照
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. 核心指标条：严格 4 个紧凑指标，单行排布不折行挤占图表 */}
      <MetricStrip items={activeMetrics} />

      {/* 3. 首屏核心主体图表 (每图注明明确周期与口径，绝不混加) */}
      <div className="ca-grid" role="region" aria-label="核心业务图表分析">
        {/* ---------------- 凯乐石 KAILAS ---------------- */}
        {projectId === "kailas" && activeSnapshot === "daily-1018" && (
          <>
            <ChartPanel
              title="现金预算分配与执行进度 (实际 vs 计划)"
              subtitle="10.16–10.18 日报口径 · 现金预算对比 (元)"
            >
              <BudgetComparisonChart data={kailasBudgetLinesComparison} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="FS 版位 CPM 与 CPUV 投放效率"
              subtitle="10.16–10.18 日报口径 · 左轴 CPM (元/千次曝光) vs 右轴 CPUV (元/UV)"
            >
              <CampaignComboChart
                rows={kailasFsPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "cpm", label: "千次曝光成本 (CPM)", unit: "元/千次曝光", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "cpuv", label: "访客转化成本 (CPUV)", unit: "元/UV", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.purple },
                ]}
                xKey="name"
                title="FS 版位 CPM 与 CPUV 效率"
                height={220}
              />
            </ChartPanel>

            <ChartPanel
              title="FS 版位消耗与 UV 引流规模"
              subtitle="10.16–10.18 日报口径 · 排除汇总项 · 左轴 消耗 (元) vs 右轴 活跃 UV (人)"
            >
              <CampaignComboChart
                rows={kailasFsPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "spend", label: "版位消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "uv", label: "站外活跃 UV", unit: "人", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="FS 版位消耗与 UV 规模"
                height={220}
              />
            </ChartPanel>

            {kailasDailyInfo && (
                <ChartPanel
                  title={`${kailasDailyDataset?.label || "FUGA大坡王10月投放日流水走势"} (独立日流水)`}
                  subtitle={`独立日流水 · ${kailasDailyInfo.rangeText} · 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                >
                  <CampaignComboChart
                    rows={kailasDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                    ]}
                    xKey="date"
                    title="投放日流水消耗与展现走势"
                    height={220}
                  />
                </ChartPanel>
            )}
          </>
        )}

        {projectId === "kailas" && activeSnapshot === "q3-summary" && (
          <>
            <ChartPanel
              title="Q3 阶段预算规划 vs 实际消耗 (含返点)"
              subtitle="7.16-9.27 Q3阶段小结 · 费用项规划与实际对比 (元)"
            >
              <BudgetComparisonChart data={kailasQ3BudgetComparison} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="Q3 核心考核指标达成目标标靶"
              subtitle="7.16-9.27 Q3双周会小结口径 · 目标值 vs 实际完成"
            >
              <TargetBulletChart data={kailasQ3TargetBullets} />
            </ChartPanel>

            {kailasQ3PerfTable && kailasQ3PerfTable.rows.length > 0 && (
              <ChartPanel
                title="Q3 阶段细分指标达成与进度明细"
                subtitle="7.16-9.27 Q3双周会小结内嵌表 · 考核目标与实际完成对照"
              >
                <div className="ca-table-wrap">
                  <table className="ca-table">
                    <thead>
                      <tr>
                        {kailasQ3PerfTable.columns.map((c) => (
                          <th key={c.key} style={{ textAlign: c.align || "left" }}>{c.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kailasQ3PerfTable.rows.map((r, idx) => (
                        <tr key={idx}>
                          {kailasQ3PerfTable.columns.map((c) => (
                            <td key={c.key} style={{ textAlign: c.align || "left" }}>
                              {r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartPanel>
            )}

            <ChartPanel
              title="FS 版位 CPM 与 CPUV 投放效率对照"
              subtitle="10.16–10.18 日报口径参考 · 左轴 CPM (元/千次曝光) vs 右轴 CPUV (元/UV)"
            >
              <CampaignComboChart
                rows={kailasFsPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "cpm", label: "千次曝光成本 (CPM)", unit: "元/千次曝光", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "cpuv", label: "访客转化成本 (CPUV)", unit: "元/UV", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.purple },
                ]}
                xKey="name"
                title="FS 版位 CPM 与 CPUV 效率"
                height={220}
              />
            </ChartPanel>
          </>
        )}

        {/* ---------------- 美菱 MEILING ---------------- */}
        {projectId === "meiling" && activeSnapshot === "double11-1018" && (
          <>
            <ChartPanel
              title="双11渠道预算执行进度 (采购形式 · 回流渠道)"
              subtitle="双11大促截至10.18快照 · 调整预算对比 (元)"
            >
              <BudgetComparisonChart data={meilingBudgetAggregatedData} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="四线任务组累计产出 GMV 与综合 ROI"
              subtitle="四线投放累计截至10.18 · 左轴 GMV (元) vs 右轴 KFS ROI (倍) · 独立核算"
            >
              <CampaignComboChart
                rows={meilingFourLinesData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "gmv", label: "四线累计 GMV", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "roi", label: "综合产出比 (KFS ROI)", unit: "倍", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="四线 GMV 与 ROI"
                height={220}
              />
            </ChartPanel>

            <ChartPanel
              title="四线达人费用 (K) 与广告消耗 (FS) 结构"
              subtitle="四线投放累计截至10.18 · 支出结构对比 (元)"
            >
              <CampaignComboChart
                rows={meilingFourLinesData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "kSpend", label: "达人发文合作 (K费用)", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
                  { key: "fsSpend", label: "投流广告支出 (FS消耗)", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                ]}
                xKey="name"
                title="四线 K 与 FS 支出结构"
                height={220}
              />
            </ChartPanel>

            {meilingDailyInfo && (
                <ChartPanel
                  title={`${meilingDailyDataset?.label || "天猫种草分日流水走势"} (独立日流水)`}
                  subtitle={`独立日流水 · ${meilingDailyInfo.rangeText} · 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                >
                  <CampaignComboChart
                    rows={meilingDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                    ]}
                    xKey="date"
                    title="分日消耗与展现走势"
                    height={220}
                  />
                </ChartPanel>
            )}
          </>
        )}

        {projectId === "meiling" && activeSnapshot === "history-618" && (
          <>
            <ChartPanel
              title="618 大促结案考核达成对照 (历史参考)"
              subtitle="2026年618大促历史复盘 (已结案)"
            >
              <TargetBulletChart data={meiling618BulletData} />
            </ChartPanel>
          </>
        )}

        {/* ---------------- 稳健酒精湿巾 WINNER-WIPES ---------------- */}
        {projectId === "winner-wipes" && activeSnapshot === "daily-1019" && (
          <>
            <ChartPanel
              title="日报计划预算分配结构"
              subtitle="10.19 日报规划预算分配 (元)"
            >
              <DonutChart data={wipesBudgetDonutData} unit="元" centerLabel="计划预算合计" />
            </ChartPanel>

            <ChartPanel
              title="分版位互动成本 (CPE) 与访客成本 (CPUV)"
              subtitle="10.19 日报口径 · 左轴 CPE (元/次) vs 右轴 CPUV (元/UV)"
            >
              <CampaignComboChart
                rows={wipesPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "cpe", label: "互动成本 (CPE)", unit: "元/次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "cpuv", label: "访客转化成本 (CPUV)", unit: "元/UV", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.purple },
                ]}
                xKey="name"
                title="分版位 CPE 与 CPUV"
                height={220}
              />
            </ChartPanel>

            <ChartPanel
              title="分版位投放消耗与点击率对比"
              subtitle="10.19 日报口径 · 视频/搜索/信息 · 左轴 消耗 (元) vs 右轴 点击率 (%)"
            >
              <CampaignComboChart
                rows={wipesPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "spend", label: "版位消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "ctr", label: "点击率 (CTR)", unit: "%", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="分版位消耗与点击率"
                height={220}
              />
            </ChartPanel>

            {wipesDailyInfo && (
                <ChartPanel
                  title={`${wipesDailyDataset?.label || "玉米湿巾投放日趋势"} (独立日流水)`}
                  subtitle={`独立日流水 · ${wipesDailyInfo.rangeText} · 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                >
                  <CampaignComboChart
                    rows={wipesDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                    ]}
                    xKey="date"
                    title="投放日流水消耗与展现走势"
                    height={220}
                  />
                </ChartPanel>
            )}
          </>
        )}

        {projectId === "winner-wipes" && activeSnapshot === "kpi-sheet" && (
          <>
            <ChartPanel
              title="日常种草核心考核达成 (全量 7 项)"
              subtitle="飞书底表快照 · 目标值 vs 实际完成"
            >
              <TargetBulletChart data={wipesDailyTargetBullets} />
            </ChartPanel>

            <ChartPanel
              title="医生专家板块考核达成 (全量 4 项)"
              subtitle="飞书底表快照 · 目标值 vs 实际完成"
            >
              <TargetBulletChart data={wipesDocTargetBullets} />
            </ChartPanel>

            <ChartPanel
              title="日报计划预算分配结构"
              subtitle="10.19 日报规划预算分配 (元)"
            >
              <DonutChart data={wipesBudgetDonutData} unit="元" centerLabel="计划预算合计" />
            </ChartPanel>

            <ChartPanel
              title="分版位互动成本 (CPE) 与访客成本 (CPUV)"
              subtitle="10.19 日报口径 · 左轴 CPE (元/次) vs 右轴 CPUV (元/UV)"
            >
              <CampaignComboChart
                rows={wipesPlacementsData as unknown as Record<string, unknown>[]}
                series={[
                  { key: "cpe", label: "互动成本 (CPE)", unit: "元/次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "cpuv", label: "访客转化成本 (CPUV)", unit: "元/UV", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.purple },
                ]}
                xKey="name"
                title="分版位 CPE 与 CPUV"
                height={220}
              />
            </ChartPanel>
          </>
        )}
      </div>

      {/* 3.1 战役增强面板 (各项目总览 Rich 扩展分析卡) */}
      <CampaignEnrichmentPanels dashboard={dashboard} section="overview" activeSnapshot={activeSnapshot} />

      {/* 4. 底部业务洞察 (从真实数据动态派生，无硬编码虚假结论) */}
      <section className="ca-insight" aria-label="战役业务解读">
        <h4 className="ca-insight-title">💡 战役分析与核心观察</h4>
        <p className="ca-insight-text">{dynamicInsight}</p>
      </section>

      {/* 5. 快速导航操作区 (仅保留专职投流 / 内容跳转，移除重复设置链接) */}
      <div className="ca-quick-links-bar">
        <span style={{ color: "#64748b" }}>专项工作台直达:</span>
        <div className="ca-quick-links-group">
          <Link href={"/projects/" + projectId + "/ads"} className="ca-nav-link">
            <span>📊 投流分析看板</span>
            <span>→</span>
          </Link>
          <Link href={"/projects/" + projectId + "/content"} className="ca-nav-link">
            <span>✍️ 内容与达人管理</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* 6. 底层明细表格 (仅展示当前图表关联表，完整呈现全部行不静默截断) */}
      {activeDetailTables.length > 0 && (
        <details className="ca-details-collapse">
          <summary className="ca-details-summary">
            <span>查看关联业务明细数据 (当前看板对应 {activeDetailTables.length + (activeDailyDataset ? 1 : 0)} 项数据源，点击展开)</span>
          </summary>
          <div className="ca-details-body">
            {activeDetailTables.map((t) => (
              <div key={t.id} className="ca-table-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, color: "#1e293b" }}>{t.title}</strong>
                  {t.period && <span style={{ fontSize: 11, color: "#64748b" }}>周期: {t.period}</span>}
                </div>
                <table className="ca-table">
                  <thead>
                    <tr>
                      {t.columns.map((c) => (
                        <th key={c.key} style={{ textAlign: c.align || "left" }}>
                          {c.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, rIdx) => (
                      <tr key={rIdx}>
                        {t.columns.map((c) => (
                          <td key={c.key} style={{ textAlign: c.align || "left" }}>
                            {r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {activeDailyDataset && (
              <div className="ca-table-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 13, color: "#1e293b" }}>{activeDailyDataset.label} (独立分日流水)</strong>
                    <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>共 {activeDailyDataset.rows.length} 日记录</span>
                  </div>
                  {activeDailyDataset.period && <span style={{ fontSize: 11, color: "#64748b" }}>周期: {activeDailyDataset.period}</span>}
                </div>
                <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#475569" }}>
                    分日流水数据来源于独立分日数据集，包含消耗、展现、互动等完整时序。
                  </span>
                  <Link href={`/projects/${projectId}?tab=daily`} className="ca-nav-link" style={{ fontSize: 12 }}>
                    <span>前往「分日」工作台查看全量表格 →</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* 7. 页面底栏 (缺日期展示'未注明'，绝不虚构日期) */}
      <footer className="ca-footer-date">
        数据资料更新日期: {updatedAt ? new Date(updatedAt).toLocaleString("zh-CN") : "未注明"}
      </footer>
    </div>
  );
}

export default CampaignOverviewPage;
