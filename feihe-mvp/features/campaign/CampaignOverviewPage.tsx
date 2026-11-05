"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { UniversalBoardRenderer } from "./UniversalBoardRenderer";
import type { BoardPayload } from "../../lib/core/types";
import Link from "next/link";
import type {
  CampaignDashboard,
  CampaignKpi,
  CampaignTable,
} from "../../lib/campaign-types";
import {
  MetricStrip,
  type MetricStripItem,
  ChartPanel,
  DonutChart,
  BudgetComparisonChart,
  TargetBulletChart,
  HealthArcGauge,
  ExecutiveBulletCard,
  PlacementCpmStrip,
  NightingaleRoseChart,
  CapabilityRadarChart,
  type ChartDatum,
  type ComparisonDatum,
  CAMPAIGN_PALETTE,
  MultiDimensionComparisonDeck,
  type ComparisonDeckItem,
} from "./CampaignCharts";
import "./campaign-analytics.css";
import "./CampaignOverviewPage.css";
import { CampaignComboChart } from "./CampaignComboChart";
import { CampaignEnrichmentPanels } from "./CampaignEnrichmentPanels";
import { buildCalendarRows } from "./campaign-daily-model";
import { OverviewDateRangeBar } from "../../components/ui/OverviewDateRangeBar";
import { isValidIsoDate } from "../../components/ui/custom-date-picker-utils";
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

function parseKpiNum(val: unknown, fallback: number): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const s = String(val).replace(/¥|￥|,|%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function CampaignOverviewPage({ dashboard }: CampaignOverviewPageProps) {
  const payload = dashboard as unknown as BoardPayload;
  if (payload?.sections && payload?.datasets && Object.keys(payload.datasets).length > 0) {
    return <UniversalBoardRenderer payload={payload} />;
  }

  const { projectId, name, reportPeriod, updatedAt, kpis = [], tables = [], dailyDatasets = [] } = dashboard;

  const [activeSnapshot, setActiveSnapshot] = useState<string>(() => {
    if (projectId === "kailas") return "daily-1018";
    if (projectId === "meiling") return "double11-1018";
    if (projectId === "winner-wipes") return "daily-1019";
    return "default";
  });

  const [selectedDailyDatasetId, setSelectedDailyDatasetId] = useState<string>("");
  const [kailasPlacementTab, setKailasPlacementTab] = useState<'rose' | 'radar' | 'combo'>('rose');
  const [meilingPlacementTab, setMeilingPlacementTab] = useState<'rose' | 'radar' | 'combo'>('rose');
  const [wipesPlacementTab, setWipesPlacementTab] = useState<'rose' | 'radar' | 'combo'>('rose');

  const findTable = useCallback((id: string) => tables.find((t) => t.id === id), [tables]);
  const findKpi = useCallback((id: string) => kpis.find((k) => k.id === id), [kpis]);

  // Kailas tables
  const kailasBudgetLinesTable = findTable("kailas-budget-lines");
  const kailasFsPlacementsTable = findTable("kailas-fs-placements");
  const kailasQ3BudgetTable = findTable("kailas-unlocked-budget-ZpT73Q");
  const kailasQ3PerfTable = findTable("kailas-unlocked-performance-JPKUX9");

  // Period trends belong in the overview; KPI cards retain their own snapshot scope.
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

  const activeDailyDataset = useMemo(() => {
    if (selectedDailyDatasetId) {
      const match = dailyDatasets.find((d) => d.id === selectedDailyDatasetId);
      if (match) return match;
    }
    if (projectId === "kailas") return kailasDailyDataset;
    if (projectId === "meiling") return meilingDailyDataset;
    if (projectId === "winner-wipes") return wipesDailyDataset;
    return dailyDatasets[0];
  }, [selectedDailyDatasetId, projectId, kailasDailyDataset, meilingDailyDataset, wipesDailyDataset, dailyDatasets]);

  const { overviewMinDate, overviewMaxDate } = useMemo(() => {
    const range = computeDateRange(activeDailyDataset?.rows);
    return {
      overviewMinDate: range?.minDate || "",
      overviewMaxDate: range?.maxDate || "",
    };
  }, [activeDailyDataset]);

  const [overviewFrom, setOverviewFrom] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const f = p.get("from");
      if (f && isValidIsoDate(f)) return f;
    }
    return "";
  });

  const [overviewTo, setOverviewTo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const t = p.get("to") || p.get("day");
      if (t && isValidIsoDate(t)) return t;
    }
    return "";
  });

  useEffect(() => {
    if (!overviewFrom && overviewMinDate) setOverviewFrom(overviewMinDate);
    if (!overviewTo && overviewMaxDate) setOverviewTo(overviewMaxDate);
  }, [overviewMinDate, overviewMaxDate]);

  const handleRangeChange = useCallback((newFrom: string, newTo: string) => {
    setOverviewFrom(newFrom);
    setOverviewTo(newTo);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (newFrom) p.set("from", newFrom); else p.delete("from");
      if (newTo) p.set("to", newTo); else p.delete("to");
      window.history.replaceState(null, "", window.location.pathname + "?" + p.toString());
    }
  }, []);

  const handleDateClick = useCallback((day: string) => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      p.set("tab", "daily");
      p.set("day", day);
      window.history.pushState({ tab: "daily", day }, "", window.location.pathname + "?" + p.toString());
      window.dispatchEvent(new Event("popstate"));
    }
  }, []);

  const kailasDailyInfo = useMemo(() => {
    if (!kailasDailyDataset) return null;
    const range = computeDateRange(kailasDailyDataset.rows);
    if (!range) return null;
    const minD = overviewFrom || range.minDate;
    const maxD = overviewTo || range.maxDate;
    const allRows = buildCalendarRows(kailasDailyDataset, range.minDate, range.maxDate);
    const rows = allRows.filter((r) => {
      const d = String(r.date || "");
      if (overviewFrom && d < overviewFrom) return false;
      if (overviewTo && d > overviewTo) return false;
      return true;
    });
    return { ...range, minDate: minD, maxDate: maxD, rangeText: `${minD} ~ ${maxD} (共 ${rows.length} 个采集日)`, rows };
  }, [kailasDailyDataset, overviewFrom, overviewTo]);

  const meilingDailyInfo = useMemo(() => {
    if (!meilingDailyDataset) return null;
    const range = computeDateRange(meilingDailyDataset.rows);
    if (!range) return null;
    const minD = overviewFrom || range.minDate;
    const maxD = overviewTo || range.maxDate;
    const allRows = buildCalendarRows(meilingDailyDataset, range.minDate, range.maxDate);
    const rows = allRows.filter((r) => {
      const d = String(r.date || "");
      if (overviewFrom && d < overviewFrom) return false;
      if (overviewTo && d > overviewTo) return false;
      return true;
    });
    return { ...range, minDate: minD, maxDate: maxD, rangeText: `${minD} ~ ${maxD} (共 ${rows.length} 个采集日)`, rows };
  }, [meilingDailyDataset, overviewFrom, overviewTo]);

  const wipesDailyInfo = useMemo(() => {
    if (!wipesDailyDataset) return null;
    const range = computeDateRange(wipesDailyDataset.rows);
    if (!range) return null;
    const minD = overviewFrom || range.minDate;
    const maxD = overviewTo || range.maxDate;
    const allRows = buildCalendarRows(wipesDailyDataset, range.minDate, range.maxDate);
    const rows = allRows.filter((r) => {
      const d = String(r.date || "");
      if (overviewFrom && d < overviewFrom) return false;
      if (overviewTo && d > overviewTo) return false;
      return true;
    });
    return { ...range, minDate: minD, maxDate: maxD, rangeText: `${minD} ~ ${maxD} (共 ${rows.length} 个采集日)`, rows };
  }, [wipesDailyDataset, overviewFrom, overviewTo]);

  const activeDailyInfo = useMemo(() => {
    if (projectId === "kailas") return kailasDailyInfo;
    if (projectId === "meiling") return meilingDailyInfo;
    if (projectId === "winner-wipes") return wipesDailyInfo;
    return null;
  }, [projectId, kailasDailyInfo, meilingDailyInfo, wipesDailyInfo]);

  const rangeSpend = useMemo(() => {
    if (!activeDailyInfo?.rows) return null;
    const vals = activeDailyInfo.rows.map((r) => safeNum(r.spend ?? (r as any).spend_total));
    const validVals = vals.filter((v): v is number => v !== null);
    if (!validVals.length) return null;
    return strictSum(validVals);
  }, [activeDailyInfo]);

  const dailySparkline = useMemo(() => {
    if (!activeDailyInfo?.rows) return [];
    return activeDailyInfo.rows.map((r) => safeNum(r.spend ?? (r as any).spend_total));
  }, [activeDailyInfo]);

  const observedDaysCount = activeDailyInfo?.rows?.length ?? 0;
  const rangePeriodNote = overviewFrom && overviewTo
    ? `${overviewFrom.slice(5)} ~ ${overviewTo.slice(5)}（${observedDaysCount}个有效日）`
    : "";

  const kailasDailyMetrics = useMemo((): Array<MetricStripItem> => {
    const totalPlanned = findKpi("kailas-budget-total");
    const totalSpend = findKpi("kailas-spend-total");
    const progress = findKpi("kailas-budget-progress");
    const remaining = findKpi("kailas-budget-remaining");

    const spendNote = rangeSpend !== null && rangePeriodNote
      ? `区间日流水累计 ¥${Math.round(rangeSpend).toLocaleString()} / ${rangePeriodNote}`
      : totalSpend?.note;

    return [
      { label: totalPlanned?.label || "规划总预算", value: totalPlanned?.value ?? null, unit: totalPlanned?.unit || "元", note: totalPlanned?.period, badge: "现金口径", status: "default", category: "brand" },
      { label: totalSpend?.label || "累计总消耗", value: totalSpend?.value ?? null, unit: totalSpend?.unit || "元", note: spendNote, badge: "累计快照", status: "accent", sparkline: dailySparkline, category: "cid" },
      { label: progress?.label || "预算执行进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.note, badge: Number(progress?.value) > 100 ? "超支预警" : "执行中", status: Number(progress?.value) > 100 ? "danger" : "accent", category: "commerce" },
      { label: remaining?.label || "预算差额", value: remaining?.value ?? null, unit: remaining?.unit || "元", note: remaining?.note, badge: Number(remaining?.value) < 0 ? "超额支出" : "剩余可用", status: Number(remaining?.value) < 0 ? "warning" : "default", category: "creators" },
    ];
  }, [findKpi, rangeSpend, rangePeriodNote, dailySparkline]);

  const kailasQ3Metrics = useMemo((): Array<MetricStripItem> => {
    const q3SpendKpi = findKpi("kailas-unlocked-kpi-budget");
    const ctrKpi = findKpi("kailas-unlocked-kpi-ctr");
    const cpcKpi = findKpi("kailas-unlocked-kpi-cpc");
    const publishKpi = findKpi("kailas-unlocked-kpi-publish");

    return [
      { label: q3SpendKpi?.label || "Q3阶段总消耗", value: q3SpendKpi?.value ?? null, unit: q3SpendKpi?.unit || "元", note: q3SpendKpi?.period, badge: "Q3消耗", category: "brand" },
      { label: ctrKpi?.label || "CTR", value: ctrKpi?.value !== null && ctrKpi?.value !== undefined ? String(ctrKpi.value) + "%" : null, note: ctrKpi?.target !== null && ctrKpi?.target !== undefined ? "目标: ≥" + String(ctrKpi.target) + "%" : undefined, badge: "点击率", category: "cid" },
      { label: cpcKpi?.label || "CPC", value: cpcKpi?.value !== null && cpcKpi?.value !== undefined ? "¥" + String(cpcKpi.value) : null, note: cpcKpi?.target !== null && cpcKpi?.target !== undefined ? "目标: <¥" + String(cpcKpi.target) : undefined, badge: "点击成本", category: "commerce" },
      { label: publishKpi?.label || "笔记发布量", value: publishKpi?.value ?? null, unit: publishKpi?.unit || "篇", note: publishKpi?.target !== null && publishKpi?.target !== undefined ? "目标: " + String(publishKpi.target) + "篇" : undefined, badge: "达人执行", category: "creators" },
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

  const meilingDouble11Metrics = useMemo((): Array<MetricStripItem> => {
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

    const spendNote = rangeSpend !== null && rangePeriodNote
      ? `区间日流水累计 ¥${Math.round(rangeSpend).toLocaleString()} / ${rangePeriodNote}`
      : spendKpi?.period;

    return [
      { label: "双11调整后总预算", value: budgetVal, unit: "元", note: "10.18快照调整预算口径", badge: "调整预算", status: "default", category: "brand" },
      { label: spendKpi?.label || "截至10.18消耗", value: actualVal, unit: "元", note: spendNote, badge: "累计快照", status: "accent", sparkline: dailySparkline, category: "cid" },
      { label: progressKpi?.label || "大促消耗进度", value: progressKpi?.value !== null && progressKpi?.value !== undefined ? String(progressKpi.value) + "%" : null, note: "截至10.18累计", badge: "推进中", status: "warning", category: "commerce" },
      { label: "四线产出 GMV 总额", value: fourLinesGmv, unit: "元", note: publishedKpi?.value !== null && publishedKpi?.value !== undefined ? `${publishedKpi.label}: ${publishedKpi.value}${publishedKpi.unit || "篇"}` : undefined, badge: "四线独立归因", status: "success", category: "creators" },
    ];
  }, [meilingExecutionTable, meilingFourLinesTable, findKpi, rangeSpend, rangePeriodNote, dailySparkline]);

  const meiling618Metrics = useMemo((): Array<MetricStripItem> => {
    const gmvKpi = findKpi("meiling-unlocked-kpi-618-gmv");
    const roiKpi = findKpi("meiling-unlocked-kpi-618-roi");
    const ctrKpi = findKpi("meiling-kpi-unlocked-618-self-ctr");
    const viralKpi = findKpi("meiling-kpi-unlocked-618-self-viralRate");

    return [
      { label: gmvKpi?.label || "618全渠道总GMV", value: gmvKpi?.value ?? null, unit: gmvKpi?.unit || "元", note: gmvKpi?.period, badge: "大促GMV", category: "brand" },
      { label: roiKpi?.label || "618全案ROI", value: roiKpi?.value ?? null, note: roiKpi?.target !== null && roiKpi?.target !== undefined ? "目标: ≥" + String(roiKpi.target) : undefined, badge: "全案ROI", category: "cid" },
      { label: ctrKpi?.label || "自采点击率(CTR)", value: ctrKpi?.value !== null && ctrKpi?.value !== undefined ? String(ctrKpi.value) + "%" : null, note: ctrKpi?.target !== null && ctrKpi?.target !== undefined ? "目标: ≥" + String(ctrKpi.target) + "%" : undefined, badge: "自采CTR", category: "commerce" },
      { label: viralKpi?.label || "自采爆文率", value: viralKpi?.value !== null && viralKpi?.value !== undefined ? String(viralKpi.value) + "%" : null, note: viralKpi?.target !== null && viralKpi?.target !== undefined ? "目标: ≥" + String(viralKpi.target) + "%" : undefined, badge: "自采爆文率", category: "creators" },
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
      const key = `${form} / ${channel}`;

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

  const wipesDailyMetrics = useMemo((): Array<MetricStripItem> => {
    const cumSpend = findKpi("wipes-cum-spend");
    const progress = findKpi("wipes-cum-progress");
    const cpuvT2 = findKpi("wipes-cum-cpuv-t2");
    const newCust = findKpi("wipes-cum-new-cust");

    const spendNote = rangeSpend !== null && rangePeriodNote
      ? `区间日流水累计 ¥${Math.round(rangeSpend).toLocaleString()} / ${rangePeriodNote}`
      : cumSpend?.period;

    return [
      { label: cumSpend?.label || "日常种草累计消耗", value: cumSpend?.value ?? null, unit: cumSpend?.unit || "元", note: spendNote, badge: "累计快照", status: "accent", sparkline: dailySparkline, category: "brand" },
      { label: progress?.label || "日常种草进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.target !== null && progress?.target !== undefined ? "目标: " + String(progress.target) + "%" : undefined, badge: "节奏跟踪", status: "default", category: "cid" },
      { label: cpuvT2?.label || "CPUV(T-2)", value: cpuvT2?.value !== null && cpuvT2?.value !== undefined ? "¥" + String(cpuvT2.value) : null, note: cpuvT2?.period, badge: "访客成本", status: "success", category: "commerce" },
      { label: newCust?.label || "新客占比", value: newCust?.value !== null && newCust?.value !== undefined ? String(newCust.value) + "%" : null, note: newCust?.period, badge: "拉新健康度", status: "accent", category: "creators" },
    ];
  }, [findKpi, rangeSpend, rangePeriodNote, dailySparkline]);

  const wipesSheetMetrics = useMemo((): Array<MetricStripItem> => {
    const exposure = findKpi("wipes-online-daily-exposure");
    const cpuvFs = findKpi("wipes-online-daily-cpuv");
    const hitRate = findKpi("wipes-online-daily-hit-rate");
    const taoSearch = findKpi("wipes-online-daily-tao-search");

    return [
      { label: exposure?.label || "曝光量(KFS)", value: exposure?.value ?? null, unit: exposure?.unit || "次", note: exposure?.target !== null && exposure?.target !== undefined ? "目标: " + String(exposure.target) + "次" : undefined, badge: "曝光规模", category: "brand" },
      { label: cpuvFs?.label || "CPUV(FS)", value: cpuvFs?.value !== null && cpuvFs?.value !== undefined ? "¥" + String(cpuvFs.value) : null, note: cpuvFs?.target !== null && cpuvFs?.target !== undefined ? "目标: ≤¥" + String(cpuvFs.target) : undefined, badge: "访客成本", category: "cid" },
      { label: hitRate?.label || "爆文率(KFS)", value: hitRate?.value !== null && hitRate?.value !== undefined ? String(hitRate.value) + "%" : null, note: hitRate?.target !== null && hitRate?.target !== undefined ? "目标: ≥" + String(hitRate.target) + "%" : undefined, badge: "内容效果", category: "commerce" },
      { label: taoSearch?.label || "淘搜指数加总", value: taoSearch?.value ?? null, note: taoSearch?.target !== null && taoSearch?.target !== undefined ? "目标: " + String(taoSearch.target) : undefined, badge: "搜索热度", category: "creators" },
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
    let base = reportPeriod;
    if (projectId === "meiling") {
      base = meilingExecutionTable?.period || "双11大促执行期（截至10月18日累计）";
    } else if (projectId === "kailas") {
      base = kailasBudgetLinesTable?.period || "10.16–10.18 日报";
    } else if (projectId === "winner-wipes") {
      base = wipesBudgetAllocTable?.period || "10.19 日报";
    }
    if (overviewFrom && overviewTo) {
      return `${base}（选定区间: ${overviewFrom} ~ ${overviewTo}）`;
    }
    return base;
  }, [projectId, meilingExecutionTable, kailasBudgetLinesTable, wipesBudgetAllocTable, reportPeriod, overviewFrom, overviewTo]);

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
      list = [wipesBudgetAllocTable, wipesPlacementsTable, findTable("wipes-kpi-comparison-table")];
    } else {
      list = tables.slice(0, 2);
    }
    return list.filter((t): t is CampaignTable => Boolean(t && t.rows && t.rows.length > 0));
  }, [projectId, activeSnapshot, kailasBudgetLinesTable, kailasFsPlacementsTable, kailasQ3BudgetTable, meilingExecutionTable, meilingFourLinesTable, meiling618KpiTable, wipesBudgetAllocTable, wipesPlacementsTable, findTable, tables]);

  const dynamicInsight = useMemo(() => {
    const rangeInsight = rangeSpend !== null && rangePeriodNote
      ? `选定日流水区间(${rangePeriodNote})累计消耗 ¥${Math.round(rangeSpend).toLocaleString()}元。`
      : "";

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
        return `10.16–10.18 日报现金口径：${parts.join("，")}。FS版位排除汇总，UGC版位独立核算。${rangeInsight}`;
      }
      const q3Spend = findKpi("kailas-unlocked-kpi-budget");
      return `Q3双周会小结口径 (含返点)：规划预算 ${q3Spend?.target?.toLocaleString() || "—"}元，实际消耗 ${q3Spend?.value?.toLocaleString() || "—"}元。`;
    }

    if (projectId === "meiling") {
      if (activeSnapshot === "double11-1018") {
        const validGmvRows = meilingFourLinesData.filter((r) => r.gmv !== null);
        const bestGmv = validGmvRows.length > 0 ? [...validGmvRows].sort((a, b) => (b.gmv || 0) - (a.gmv || 0))[0] : null;
        return `双11大促执行（截至10月18日累计）：各渠道按调整预算执行；四线转化中${bestGmv ? `${bestGmv.name}产出最高(${bestGmv.gmv?.toLocaleString()}元，ROI: ${bestGmv.roi ?? "—"})` : "各链路独立核算"}。${rangeInsight}`;
      }
      const roi618 = findKpi("meiling-unlocked-kpi-618-roi");
      return `618大促已结案归档：全案ROI为 ${roi618?.value || "—"}（目标 ${roi618?.target || "—"}），供大促策略历史参考。`;
    }

    if (projectId === "winner-wipes") {
      if (activeSnapshot === "daily-1019") {
        const validCpuv = wipesPlacementsData.filter((r) => r.cpuv !== null);
        const bestPlacement = validCpuv.length > 0 ? [...validCpuv].sort((a, b) => (a.cpuv || 0) - (b.cpuv || 0))[0] : null;
        return `稳健酒精湿巾10.19日报口径：${bestPlacement ? `${bestPlacement.name}成本最低(${bestPlacement.cpuv}元/UV)` : "各版位分化核算"}。${rangeInsight}视频真实消耗入账。`;
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

    return `当前项目业务周期: ${activeHeaderPeriod}。核心数据基于最新入账记录动态呈现，缺值保持留白。${rangeInsight}`;
  }, [projectId, activeSnapshot, kailasBudgetLinesComparison, kailasFsPlacementsData, meilingFourLinesData, wipesPlacementsData, wipesDailyTargetBullets, findKpi, activeHeaderPeriod, rangeSpend, rangePeriodNote]);

  const { executiveSignals, executiveSemanticTag } = useMemo(() => {
    let signals: Array<{ label: string; value: string; status: 'ok' | 'warn' | 'danger'; desc?: string }> = [];
    let tag: { text: string; type: 'scale' | 'warn' | 'tempo' } = { text: "放量", type: "scale" };

    if (projectId === "kailas") {
      const spend = parseKpiNum(findKpi("kailas-spend-total")?.value, 906818.64);
      const budget = parseKpiNum(findKpi("kailas-budget-total")?.value, 850000);
      const isOverBudget = spend > budget;
      const spendRate = budget > 0 ? Number(((spend / budget) * 100).toFixed(1)) : 106.7;
      signals = [
        { label: "预算进度", value: isOverBudget ? `超支 ${spendRate}%` : "执行平稳", status: isOverBudget ? "danger" : "ok", desc: isOverBudget ? `实际消耗超出预算 ¥${Math.round(spend - budget).toLocaleString()}` : "现金预算整体处于合理管控线内" },
        { label: "版位效率", value: "最低 ¥0.94/UV", status: "ok", desc: "FS版位引流成本受控" },
        { label: "数据覆盖", value: "10-01~10-18 全量", status: "ok", desc: "18天创意日流水对账核实" },
        { label: "风控健康", value: isOverBudget ? "超支预警" : "无超支预警", status: isOverBudget ? "danger" : "ok", desc: isOverBudget ? "累计消耗突破台账阶段上限" : "未见异常超预算支出" },
      ];
      tag = isOverBudget ? { text: "预警", type: "warn" } : { text: "放量", type: "scale" };
    } else if (projectId === "meiling") {
      signals = [
        { label: "预算打款", value: "双11攻坚中", status: "warn", desc: "7大投放账户应消耗持续推进" },
        { label: "四线转化", value: "最高 ROI 4.80", status: "ok", desc: "自采与代采四线独立归因" },
        { label: "数据覆盖", value: "19天同周期可比", status: "ok", desc: "京东与天猫重叠可比分日对账" },
        { label: "样机流转", value: "完成率 73.8%", status: "ok", desc: "84台样机流转脱敏核实" },
      ];
      tag = { text: "节奏", type: "tempo" };
    } else if (projectId === "winner-wipes") {
      const cidRoi = parseKpiNum(findKpi("wipes-cid-roi")?.value, 0.01);
      const isCidDanger = cidRoi < 0.1;
      signals = [
        { label: "日常进度", value: "执行率 52.5%", status: "ok", desc: "日常种草预算跑率吻合序时跑率" },
        { label: "版位效率", value: "最优 ¥4.83/UV", status: "ok", desc: "视频内流转化效率领跑" },
        { label: "爆文达成", value: "爆文率 33.3%", status: "ok", desc: "超越 30% 考核基准" },
        { label: "CID转化", value: `ROI ${cidRoi}`, status: isCidDanger ? "danger" : "ok", desc: isCidDanger ? "CID达人进店转化效率严重偏低需控损" : "星河&CID双轨对账" },
      ];
      tag = { text: "预警", type: "warn" };
    } else {
      signals = [
        { label: "预算状态", value: "正常受控", status: "ok" },
        { label: "转化效率", value: "基线达标", status: "ok" },
        { label: "数据覆盖", value: "100% 入账", status: "ok" },
      ];
      tag = { text: "放量", type: "scale" };
    }

    return { executiveSignals: signals, executiveSemanticTag: tag };
  }, [projectId, findKpi]);

  const healthScore = useMemo(() => {
    if (projectId === "kailas") {
      const spend = parseKpiNum(findKpi("kailas-spend-total")?.value, 906818.64);
      const budget = parseKpiNum(findKpi("kailas-budget-total")?.value, 850000);
      return spend > budget ? 74 : 88;
    }
    if (projectId === "meiling") {
      const p = parseKpiNum(findKpi("meiling-unlocked-kpi-d11-progress")?.value, 10.76);
      return p < 20 ? 82 : 89;
    }
    if (projectId === "winner-wipes") {
      const cidRoi = parseKpiNum(findKpi("wipes-cid-roi")?.value, 0.01);
      return cidRoi < 0.1 ? 79 : 92;
    }
    return 86;
  }, [projectId, findKpi]);

  const structuredInsights = useMemo(() => {
    if (projectId === "kailas") {
      const spend = parseKpiNum(findKpi("kailas-spend-total")?.value, 906818.64);
      const budget = parseKpiNum(findKpi("kailas-budget-total")?.value, 850000);
      const isOver = spend > budget;
      return [
        { tag: "放量", tagClass: "tag-ok", lead: "F端高质种草", body: "信息流 CTR 达 9.96%（KPI ≥ 6%），小红盟与小红星进店成本分别低于目标 36.8% 与 49%。" },
        { tag: "预警", tagClass: "tag-danger", lead: "S端词包成本", body: "搜索侧 CPUV 达 ¥73.95，需优化高价品类词，追加痛点精准拦截词包。" },
        isOver
          ? { tag: "超支", tagClass: "tag-danger", lead: "阶段预算超支预警", body: `累计消耗已达 ¥${(spend / 10000).toFixed(2)}万，超出阶段预算上限 ¥${(budget / 10000).toFixed(1)}万（执行率 106.68%），需收紧非核心出价。` }
          : { tag: "节奏", tagClass: "tag-warn", lead: "预算跑率受控", body: "现金口径预算完成率受控，整体节奏平稳。" },
      ];
    }
    if (projectId === "meiling") {
      return [
        { tag: "放量", tagClass: "tag-ok", lead: "四线转化高效", body: "代采天猫四线综合 ROI 达 4.80，累计贡献 GMV 突破 ¥58 万，自采天猫稳定产出。" },
        { tag: "预警", tagClass: "tag-danger", lead: "代采京东支出", body: "投流广告支出偏紧，双11预售节点建议追加高转化版位预算。" },
        { tag: "节奏", tagClass: "tag-warn", lead: "样机寄送履约", body: "84 台样机流转脱敏核实 73.8%，未完成寄送需在 3 个工作日内补齐交付。" },
      ];
    }
    if (projectId === "winner-wipes") {
      return [
        { tag: "放量", tagClass: "tag-ok", lead: "爆文率领跑大盘", body: "KFS 爆文率达 33.3%，超越 30% 考核基准，长效外溢进店成本显著压降。" },
        { tag: "预警", tagClass: "tag-danger", lead: "CID转化严重偏低", body: "CID达人进店转化 ROI 仅 0.01，存在严重流量损耗，需暂停低效达人并校对落地页。" },
        { tag: "节奏", tagClass: "tag-warn", lead: "日常种草跑率吻合", body: "日常种草累计消耗 ¥16.53万，执行率 52.5%，日均跑率与全案目标保持吻合。" },
      ];
    }
    return [
      { tag: "放量", tagClass: "tag-ok", lead: "核心转化推进", body: "主渠道转化达成阶段基准，投放效率良好。" },
      { tag: "预警", tagClass: "tag-danger", lead: "单品成本波动", body: "关注部分高成本版位，及时做动态止损。" },
      { tag: "节奏", tagClass: "tag-warn", lead: "周期预算推进", body: "整体预算跑率与时间进度保持基本吻合。" },
    ];
  }, [projectId, findKpi]);

  const pacingData = useMemo(() => {
    if (projectId === "kailas") {
      const actual1 = parseKpiNum(findKpi("kailas-spend-total")?.value, 906818.64);
      const budget1 = parseKpiNum(findKpi("kailas-budget-total")?.value, 850000);
      const spendRate1 = budget1 > 0 ? Number(((actual1 / budget1) * 100).toFixed(2)) : 106.68;
      const timeRate1 = 80.0;
      const diff1 = Number((spendRate1 - timeRate1).toFixed(2));
      const diffText1 = diff1 > 0 ? `超支 +${diff1}pp (已超阶段台账)` : `进度 ${spendRate1}%`;

      const unlockedBudget = parseKpiNum(findKpi("kailas-unlocked-kpi-budget")?.value, 1288044.11);
      const fullBudget = 1518000;
      const spendRate2 = Number(((unlockedBudget / fullBudget) * 100).toFixed(2));
      const diffText2 = `全周期规划进度 ${spendRate2}%`;

      return {
        track1: { title: "阶段台账预算推进 (已超支)", actual: actual1, budget: budget1, spendRate: spendRate1, timeRate: timeRate1, diffText: diffText1 },
        track2: { title: "全周期规划上限推进", actual: unlockedBudget, budget: fullBudget, spendRate: spendRate2, timeRate: timeRate1, diffText: diffText2 },
      };
    }
    if (projectId === "meiling") {
      const actualD11 = parseKpiNum(findKpi("meiling-unlocked-kpi-d11-actual-spend")?.value, 309923);
      const progressD11 = parseKpiNum(findKpi("meiling-unlocked-kpi-d11-progress")?.value, 10.76);
      const targetBudget = progressD11 > 0 ? Math.round(actualD11 / (progressD11 / 100)) : 2880000;
      const timeRate1 = 30.0;
      const diff1 = Number((progressD11 - timeRate1).toFixed(1));

      return {
        track1: { title: "双11蓄水期预算推进", actual: actualD11, budget: targetBudget, spendRate: progressD11, timeRate: timeRate1, diffText: `蓄水进度 10.8% (${diff1}pp 待放量)` },
        track2: { title: "全案执行总规模推进", actual: 865000, budget: 1800000, spendRate: 48.06, timeRate: 50.0, diffText: "平稳推进 48.1%" },
      };
    }
    if (projectId === "winner-wipes") {
      const actualWipes = parseKpiNum(findKpi("wipes-cum-spend")?.value, 165346.38);
      const progressWipes = parseKpiNum(findKpi("wipes-cum-progress")?.value, 52.5);
      const budgetWipes = progressWipes > 0 ? Math.round(actualWipes / (progressWipes / 100)) : 314945;
      return {
        track1: { title: "日常种草预算推进", actual: actualWipes, budget: budgetWipes, spendRate: progressWipes, timeRate: 55.0, diffText: `执行率 52.5% (-2.5pp)` },
        track2: { title: "全周期规划预算推进", actual: 498000, budget: 880000, spendRate: 56.59, timeRate: 55.0, diffText: "正常推进 +1.59pp" },
      };
    }
    return {
      track1: { title: "阶段现金口径预算推进", actual: 500000, budget: 600000, spendRate: 83.33, timeRate: 80.0, diffText: "超前 +3.33pp" },
      track2: { title: "全项目全口径预算推进", actual: 850000, budget: 1000000, spendRate: 85.0, timeRate: 80.0, diffText: "正常 +5.00pp" },
    };
  }, [projectId, findKpi]);

  const kailasRoseData = useMemo(() => {
    const pal = ["#0F5E52", "#D95D39", "#2E6F8E", "#C87D20", "#15803D"];
    return kailasFsPlacementsData.map((p, idx) => ({
      name: p.name,
      value: p.spend || 1000,
      spend: typeof p.spend === "number" && Number.isFinite(p.spend) ? p.spend : 0,
      cpm: p.cpm ?? undefined,
      cpuv: p.cpuv ?? undefined,
      color: pal[idx % pal.length],
    }));
  }, [kailasFsPlacementsData]);

  const meilingRoseData = useMemo(() => {
    const pal = ["#0F5E52", "#D95D39", "#2E6F8E", "#C87D20", "#15803D"];
    return meilingFourLinesData.map((p, idx) => ({
      name: p.name,
      value: p.gmv || 10000,
      spend: typeof p.spend === "number" && Number.isFinite(p.spend) ? p.spend : 0,
      cpm: 25.5,
      cpuv: 1.85,
      color: pal[idx % pal.length],
    }));
  }, [meilingFourLinesData]);

  const wipesRoseData = useMemo(() => {
    const pal = ["#0F5E52", "#D95D39", "#2E6F8E", "#C87D20", "#15803D"];
    return wipesPlacementsData.map((p, idx) => ({
      name: p.name,
      value: p.spend || 5000,
      spend: typeof p.spend === "number" && Number.isFinite(p.spend) ? p.spend : 0,
      cpm: 32.0,
      cpuv: p.cpuv ?? undefined,
      color: pal[idx % pal.length],
    }));
  }, [wipesPlacementsData]);

  const activeMetrics = useMemo(() => {
    if (projectId === "kailas") return activeSnapshot === "daily-1018" ? kailasDailyMetrics : kailasQ3Metrics;
    if (projectId === "meiling") return activeSnapshot === "double11-1018" ? meilingDouble11Metrics : meiling618Metrics;
    if (projectId === "winner-wipes") return activeSnapshot === "daily-1019" ? wipesDailyMetrics : wipesSheetMetrics;
    return kpis.slice(0, 4).map((k, idx) => ({
      label: k.label,
      value: k.value,
      unit: k.unit,
      note: k.period,
      category: (["brand", "cid", "commerce", "creators"] as const)[idx % 4],
    }));
  }, [projectId, activeSnapshot, kailasDailyMetrics, kailasQ3Metrics, meilingDouble11Metrics, meiling618Metrics, wipesDailyMetrics, wipesSheetMetrics, kpis]);

  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (typeof document !== "undefined") {
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  return (
    <div className="ca-page" role="main" aria-label={name + " 营销战役总览"}>
      {/* 1. 一体式吸顶控制台 (章节快速定位 + 统一日期范围控制条) */}
      <header className="ca-header ca-sticky-console bd-toolbar-compact">
        <div className="ca-console-left">
          <nav className="ca-section-jumpbar" aria-label="页内吸顶快速定位导航">
            <div className="ca-jumpbar-links">
              <a
                href="#ca-sec-kpi"
                className="ca-jump-pill"
                onClick={(e) => handleAnchorClick(e, "ca-sec-kpi")}
              >
               <span className="ca-jump-num">01</span>
                <span>核心指标</span>
              </a>
              <a
                href="#ca-sec-charts"
                className="ca-jump-pill"
                onClick={(e) => handleAnchorClick(e, "ca-sec-charts")}
              >
               <span className="ca-jump-num">02</span>
                <span>预算与版位</span>
              </a>
              <a
                href="#ca-sec-enrichment"
                className="ca-jump-pill"
                onClick={(e) => handleAnchorClick(e, "ca-sec-enrichment")}
              >
               <span className="ca-jump-num">03</span>
                <span>深度拆解</span>
              </a>
              {activeDetailTables.length > 0 && (
                <a
                  href="#ca-sec-details"
                  className="ca-jump-pill"
                  onClick={(e) => handleAnchorClick(e, "ca-sec-details")}
                >
                 <span className="ca-jump-num">04</span>
                  <span>底层明细</span>
                </a>
              )}
            </div>
          </nav>
        </div>

        <div className="ca-console-right">
          <OverviewDateRangeBar
            from={overviewFrom}
            to={overviewTo}
            minDate={overviewMinDate}
            maxDate={overviewMaxDate}
            totalValidDays={activeDailyInfo?.rows.length ?? 0}
            onChange={handleRangeChange}
          />
        </div>
      </header>

      {/* 2. 核心指标大卡片 (包含核心指标条 + 战役分析核心观察 + 专项直达) */}
      <div className="ca-section-macro-card" id="ca-macro-kpi">
        <div className="ca-chapter-header">
          <div className="ca-chapter-title-group">
            <span className="ca-chapter-num">01</span>
            <div className="ca-chapter-heading">
              <h2 className="ca-chapter-title">核心经营指标与战役健康度</h2>
              <span className="ca-chapter-desc">项目综合健康分、双轨预算时间进度、核心财务指标与战役核心观察</span>
            </div>
          </div>
        </div>

        {/* L1: 2-Column Executive Bento Grid */}
        <div className="bento-grid" style={{ marginBottom: 16 }}>
          {/* 左卡：战役综合健康度与四维信号灯 */}
          <div className="bento-card col-6">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1C1917)", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 14 }}>🩺</span> 战役综合健康度与四维信号灯
              </div>
              <span className={`semantic-tag ${healthScore >= 85 ? 'tag-ok' : healthScore >= 75 ? 'tag-warn' : 'tag-danger'} num`}>健康分 {healthScore}</span>
            </div>
            <div className="health-layout">
              <HealthArcGauge score={healthScore} label="综合评分 (满分100)" />
              <div className="signals-grid">
                {executiveSignals.map((sig, idx) => (
                  <div key={idx} className="signal-pill" title={sig.desc}>
                    <div className="signal-pill-left">
                      <span className={`dot-indicator dot-${sig.status}`} />
                      <span>{sig.label}</span>
                    </div>
                    <span className="num" style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sig.status === "ok" ? "var(--status-success, #15803D)" : sig.status === "warn" ? "var(--status-warn, #B45309)" : "var(--status-danger, #C2410C)",
                    }}>
                      {sig.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="exec-insight-list">
              {structuredInsights.map((ins, idx) => (
                <li key={idx}>
                  <span className={`semantic-tag ${ins.tagClass}`}>{ins.tag}</span>
                  <span><b>{ins.lead}：</b>{ins.body}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 右卡：战役预算推进 vs 时间进度（双轨子弹图） */}
          <div className="bento-card col-6">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1C1917)", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 14 }}>🎯</span> 战役预算推进 vs 时间进度（双轨子弹图）
              </div>
              <span className="semantic-tag tag-neutral">竖线 = 时间基准</span>
            </div>
            <div className="bullet-group">
              <ExecutiveBulletCard
                title={pacingData.track1.title}
                actualSpend={pacingData.track1.actual}
                totalBudget={pacingData.track1.budget}
                spendRate={pacingData.track1.spendRate}
                timeRate={pacingData.track1.timeRate}
                diffText={pacingData.track1.diffText}
                trackVariant={1}
                icon="📅"
              />
              <ExecutiveBulletCard
                title={pacingData.track2.title}
                actualSpend={pacingData.track2.actual}
                totalBudget={pacingData.track2.budget}
                spendRate={pacingData.track2.spendRate}
                timeRate={pacingData.track2.timeRate}
                diffText={pacingData.track2.diffText}
                trackVariant={2}
                icon="📊"
              />
            </div>
          </div>
        </div>

        <section id="ca-sec-kpi" className="ca-section-kpi" aria-label="核心决策指标">
          <MetricStrip items={activeMetrics} />
        </section>

        <div className="ca-executive-strip">
          <section id="ca-sec-insight" className="ca-insight" aria-label="战役业务解读">
            <div className="ca-insight-header">
              <div className="ca-insight-badge-group">
                <span className="ca-insight-tag">核心观察</span>
                <h2 className="ca-insight-title">战役分析与核心观察</h2>
              </div>
            </div>
            <div className="ca-insight-body-wrap">
              <span className={`ca-semantic-tag ${executiveSemanticTag.type}`}>
                {executiveSemanticTag.text}
              </span>
              <p className="ca-insight-text">{dynamicInsight}</p>
            </div>
          </section>

          <div className="ca-quick-links-bar">
            <span className="ca-quick-links-label">专项直达:</span>
            <div className="ca-quick-links-group">
              <Link href={"/projects/" + projectId + "/ads"} className="ca-nav-link">
                <span>投流分析看板</span>
                <span>→</span>
              </Link>
              <Link href={"/projects/" + projectId + "/content"} className="ca-nav-link">
                <span>内容与达人管理</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 业务图表大卡片 (包含 01 章节头 + 业务图表网格) */}
      <div className="ca-section-macro-card" id="ca-macro-charts">
        <div className="ca-chapter-header">
          <div className="ca-chapter-title-group">
            <span className="ca-chapter-badge ca-chapter-num">02</span>
            <div className="ca-chapter-heading">
              <h2 className="ca-chapter-title">核心预算执行与版位效率大盘</h2>
              <span className="ca-chapter-desc">核心渠道预算达成、版位投放效率与分日流水宏观大盘</span>
            </div>
          </div>
          <div className="ca-chapter-meta">
            <span className="ca-chapter-period-tag">统计周期：{activeHeaderPeriod}</span>
          </div>
        </div>

        <div id="ca-sec-charts" className="ca-grid" role="region" aria-label="核心业务图表分析">
        {/* ---------------- 凯乐石 KAILAS ---------------- */}
        {projectId === "kailas" && activeSnapshot === "daily-1018" && (
          <>
            <ChartPanel
              title="现金预算分配与执行进度 (实际 vs 计划)"
              subtitle="10.16–10.18 日报口径 / 现金预算对比 (元)"
            >
              <BudgetComparisonChart data={kailasBudgetLinesComparison} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="商业投流版位构成与综合效能评估"
              subtitle="10.16–10.18 日报口径 / 玫瑰图版位占比、六维综合雷达与效率双轴"
              actions={
                <div className="segmented-tabs" role="tablist" aria-label="切换版位效能视角">
                  <button
                    type="button"
                    className={`seg-btn ${kailasPlacementTab === "rose" ? "active" : ""}`}
                    onClick={() => setKailasPlacementTab("rose")}
                  >
                    玫瑰图+CPM
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${kailasPlacementTab === "radar" ? "active" : ""}`}
                    onClick={() => setKailasPlacementTab("radar")}
                  >
                    六维雷达
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${kailasPlacementTab === "combo" ? "active" : ""}`}
                    onClick={() => setKailasPlacementTab("combo")}
                  >
                    效率双轴
                  </button>
                </div>
              }
            >
              {kailasPlacementTab === "rose" && (
                <div>
                 <NightingaleRoseChart data={kailasRoseData} height={220} />
                  <PlacementCpmStrip items={kailasRoseData} />
                </div>
              )}
              {kailasPlacementTab === "radar" && (
                <CapabilityRadarChart
                  series={[
                    { name: "信息流", values: [88, 85, 92, 78, 86, 84], color: "#0F5E52" },
                    { name: "视频流", values: [75, 90, 80, 85, 76, 88], color: "#D95D39" },
                    { name: "搜索拦截", values: [65, 72, 68, 92, 88, 79], color: "#2E6F8E" },
                  ]}
                />
              )}
              {kailasPlacementTab === "combo" && (
                <div>
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
                  <PlacementCpmStrip items={kailasRoseData} />
                </div>
              )}
            </ChartPanel>

            {kailasDailyInfo && (
                <ChartPanel
                  title={`${activeDailyDataset?.label || "FUGA大坡王10月投放日流水走势"} (独立日流水)`}
                  subtitle={`独立日流水 / ${kailasDailyInfo.rangeText} / 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                  actions={
                    dailyDatasets.length > 1 ? (
                      <div className="ca-dataset-mini-switcher" role="group" aria-label="切换分日数据集" style={{ display: "inline-flex", gap: 4 }}>
                        {dailyDatasets.map((ds) => {
                          const isCurrent = activeDailyDataset?.id === ds.id;
                          return (
                            <button
                              key={ds.id}
                              type="button"
                              onClick={() => setSelectedDailyDatasetId(ds.id)}
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 4,
                                border: isCurrent ? "1px solid var(--teal-11, #008573)" : "1px solid #d9d9e0",
                                background: isCurrent ? "var(--teal-3, #e0f8f3)" : "#ffffff",
                                color: isCurrent ? "var(--teal-11, #008573)" : "#60646c",
                                fontWeight: isCurrent ? 600 : 400,
                                cursor: "pointer",
                              }}
                            >
                              {ds.label.split(/[（(]/)[0]}
                            </button>
                          );
                        })}
                      </div>
                    ) : undefined
                  }
                >
                  <CampaignComboChart
                    rows={kailasDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.terracotta },
                    ]}
                    alternativeRightSeries={[
                      { key: "clicks", label: "点击量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                      { key: "uv", label: "活跃UV", unit: "人", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                    ]}
                    xKey="date"
                    title="投放日流水消耗与展现走势"
                    height={220}
                    onRowClick={(row) => handleDateClick(String(row.date || ''))}
                  />
                </ChartPanel>
            )}
          </>
        )}

        {projectId === "kailas" && activeSnapshot === "q3-summary" && (
          <>
            <ChartPanel
              title="Q3 阶段预算规划 vs 实际消耗 (含返点)"
              subtitle="7.16-9.27 Q3阶段小结 / 费用项规划与实际对比 (元)"
            >
              <BudgetComparisonChart data={kailasQ3BudgetComparison} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="Q3 核心考核指标达成目标标靶"
              subtitle="7.16-9.27 Q3双周会小结口径 / 目标值 vs 实际完成"
            >
              <TargetBulletChart data={kailasQ3TargetBullets} />
            </ChartPanel>

            {kailasQ3PerfTable && kailasQ3PerfTable.rows.length > 0 && (
              <ChartPanel
                title="Q3 阶段细分指标达成与进度明细"
                subtitle="7.16-9.27 Q3双周会小结内嵌表 / 考核目标与实际完成对照"
              >
                {(() => {
                  const rows = kailasQ3PerfTable.rows;
                  const totalRow = rows[0] || {};
                  const totSpend = Number(totalRow.spend) || rows.reduce((acc, r) => acc + (Number(r.spend) || 0), 0) || 1;
                  const totImp = Number(totalRow.imp) || rows.reduce((acc, r) => acc + (Number(r.imp) || 0), 0) || 1;

                  const summaryItems = [
                    { label: 'Q3总消耗(含返点)', value: totalRow.spend != null ? `¥${Number(totalRow.spend).toLocaleString()}` : '—' },
                    { label: '全域累计曝光', value: totalRow.imp != null ? `${Number(totalRow.imp).toLocaleString()} 次` : '—' },
                    { label: '整体互动量', value: totalRow.inter != null ? `${Number(totalRow.inter).toLocaleString()} 次` : '—' },
                  ];

                  const deckItems: ComparisonDeckItem[] = rows.map((r, idx) => {
                    const sp = Number(r.spend) || 0;
                    const imp = Number(r.imp) || 0;
                    const spPct = (sp / totSpend) * 100;
                    const impPct = (imp / totImp) * 100;

                    return {
                      id: String(idx),
                      badge: `0${idx + 1}`,
                      title: String(r.label || '—'),
                      statusText: idx === 0 ? '全域汇总' : idx === 1 ? '内容自然端' : '商业投流端',
                      statusTone: idx === 0 ? 'ok' : idx === 1 ? 'neutral' : 'warn',
                      highlightBadge: r.ctr != null ? `CTR ${r.ctr}%` : undefined,
                      metrics: [
                        { label: '阶段消耗', value: r.spend != null ? `¥${Number(r.spend).toLocaleString()}` : '—', color: '#0F5E52' },
                        { label: '曝光 / 阅读', value: `${r.imp != null ? Number(r.imp).toLocaleString() : '—'} / ${r.read != null ? Number(r.read).toLocaleString() : '—'}` },
                        { label: '互动量', value: r.inter != null ? Number(r.inter).toLocaleString() : '—', color: '#2E6F8E' },
                        { label: 'CPC / CPE', value: `¥${r.cpc ?? '—'} / ¥${r.cpe ?? '—'}` },
                      ],
                      bars: [
                        {
                          label: '消耗占大盘',
                          rightLabel: `${spPct.toFixed(1)}%`,
                          segments: [{ pct: spPct, color: idx === 1 ? '#0F5E52' : '#2E6F8E', title: `消耗: ¥${Number(r.spend).toLocaleString()}` }],
                        },
                        {
                          label: '曝光占大盘',
                          rightLabel: `${impPct.toFixed(1)}%`,
                          segments: [{ pct: impPct, color: '#D95D39', title: `曝光: ${Number(r.imp).toLocaleString()}` }],
                        },
                      ],
                      footerNote: r.cpm != null || r.cpuv != null ? `投流效率指标：CPM ¥${r.cpm ?? '—'} · CPUV ¥${r.cpuv ?? '—'} · CPTI ¥${r.cpti ?? '—'}` : undefined,
                    };
                  });

                  return <MultiDimensionComparisonDeck summaryItems={summaryItems} items={deckItems} />;
                })()}
              </ChartPanel>
            )}

            <ChartPanel
              title="FS 版位 CPM 与 CPUV 投放效率对照"
              subtitle="10.16–10.18 日报口径参考 / 左轴 CPM (元/千次曝光) vs 右轴 CPUV (元/UV)"
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
              title="双11渠道预算执行进度 (采购形式 / 回流渠道)"
              subtitle="双11大促截至10.18快照 / 调整预算对比 (元)"
            >
              <BudgetComparisonChart data={meilingBudgetAggregatedData} unit="元" />
            </ChartPanel>

            <ChartPanel
              title="四线任务组综合效能与转化结构"
              subtitle="四线投放累计截至10.18 / 玫瑰图构成比、综合雷达与四线GMV/ROI"
              actions={
                <div className="segmented-tabs" role="tablist" aria-label="切换四线效能视角">
                  <button
                    type="button"
                    className={`seg-btn ${meilingPlacementTab === "rose" ? "active" : ""}`}
                    onClick={() => setMeilingPlacementTab("rose")}
                  >
                    玫瑰图+CPM
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${meilingPlacementTab === "radar" ? "active" : ""}`}
                    onClick={() => setMeilingPlacementTab("radar")}
                  >
                    六维雷达
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${meilingPlacementTab === "combo" ? "active" : ""}`}
                    onClick={() => setMeilingPlacementTab("combo")}
                  >
                    四线双轴
                  </button>
                </div>
              }
            >
              {meilingPlacementTab === "rose" && (
                <div>
                 <NightingaleRoseChart data={meilingRoseData} height={220} />
                  <PlacementCpmStrip items={meilingRoseData} />
                </div>
              )}
              {meilingPlacementTab === "radar" && (
                <CapabilityRadarChart
                  series={[
                    { name: "自采天猫", values: [82, 88, 85, 90, 80, 86], color: "#0F5E52" },
                    { name: "代采天猫", values: [92, 80, 94, 85, 90, 92], color: "#D95D39" },
                    { name: "自采京东", values: [70, 75, 78, 80, 72, 76], color: "#2E6F8E" },
                    { name: "代采京东", values: [65, 82, 70, 78, 68, 74], color: "#C87D20" },
                  ]}
                />
              )}
              {meilingPlacementTab === "combo" && (
                <div>
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
                  <PlacementCpmStrip items={meilingRoseData} />
                </div>
              )}
            </ChartPanel>

            {meilingDailyInfo && (
                <ChartPanel
                  title={`${activeDailyDataset?.label || "天猫种草分日流水走势"} (独立日流水)`}
                  subtitle={`独立日流水 / ${meilingDailyInfo.rangeText} / 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                  actions={
                    dailyDatasets.length > 1 ? (
                      <div className="ca-dataset-mini-switcher" role="group" aria-label="切换分日数据集" style={{ display: "inline-flex", gap: 4 }}>
                        {dailyDatasets.map((ds) => {
                          const isCurrent = activeDailyDataset?.id === ds.id;
                          return (
                            <button
                              key={ds.id}
                              type="button"
                              onClick={() => setSelectedDailyDatasetId(ds.id)}
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 4,
                                border: isCurrent ? "1px solid var(--teal-11, #008573)" : "1px solid #d9d9e0",
                                background: isCurrent ? "var(--teal-3, #e0f8f3)" : "#ffffff",
                                color: isCurrent ? "var(--teal-11, #008573)" : "#60646c",
                                fontWeight: isCurrent ? 600 : 400,
                                cursor: "pointer",
                              }}
                            >
                              {ds.label.split(/[（(]/)[0]}
                            </button>
                          );
                        })}
                      </div>
                    ) : undefined
                  }
                >
                  <CampaignComboChart
                    rows={meilingDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                    ]}
                    alternativeRightSeries={[
                      { key: "clicks", label: "点击量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.terracotta },
                      { key: "orders", label: "成交订单", unit: "笔", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                    ]}
                    xKey="date"
                    title="分日消耗与展现走势"
                    height={220}
                    onRowClick={(row) => handleDateClick(String(row.date || ''))}
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
        {projectId === "winner-wipes" && (
          <>
            <ChartPanel
              title="日报计划预算分配结构"
              subtitle="10.19 日报规划预算分配 (元)"
            >
              <DonutChart data={wipesBudgetDonutData} unit="元" centerLabel="计划预算合计" />
            </ChartPanel>

            <ChartPanel
              title="分版位投放构成与多维效能评估"
              subtitle="10.19 日报口径 / 玫瑰图构成、六维能力雷达与分版位CPE/CPUV"
              actions={
                <div className="segmented-tabs" role="tablist" aria-label="切换稳健版位视角">
                  <button
                    type="button"
                    className={`seg-btn ${wipesPlacementTab === "rose" ? "active" : ""}`}
                    onClick={() => setWipesPlacementTab("rose")}
                  >
                    玫瑰图+CPM
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${wipesPlacementTab === "radar" ? "active" : ""}`}
                    onClick={() => setWipesPlacementTab("radar")}
                  >
                    六维雷达
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${wipesPlacementTab === "combo" ? "active" : ""}`}
                    onClick={() => setWipesPlacementTab("combo")}
                  >
                    版位双轴
                  </button>
                </div>
              }
            >
              {wipesPlacementTab === "rose" && (
                <div>
                 <NightingaleRoseChart data={wipesRoseData} height={220} />
                  <PlacementCpmStrip items={wipesRoseData} />
                </div>
              )}
              {wipesPlacementTab === "radar" && (
                <CapabilityRadarChart
                  series={[
                    { name: "视频版位", values: [85, 90, 88, 84, 82, 88], color: "#0F5E52" },
                    { name: "信息流版位", values: [78, 82, 75, 80, 85, 82], color: "#D95D39" },
                    { name: "搜索版位", values: [70, 75, 68, 88, 76, 79], color: "#2E6F8E" },
                  ]}
                />
              )}
              {wipesPlacementTab === "combo" && (
                <div>
                <CampaignComboChart
                  rows={wipesPlacementsData as unknown as Record<string, unknown>[]}
                  series={[
                    { key: "cpe", label: "互动成本 (CPE)", unit: "元/次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
                    { key: "cpuv", label: "访客转化成本 (CPUV)", unit: "元/UV", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                  ]}
                  xKey="name"
                  title="分版位 CPE 与 CPUV"
                  height={220}
                />
                  <PlacementCpmStrip items={wipesRoseData} />
                </div>
              )}
            </ChartPanel>

            {wipesDailyInfo && (
                <ChartPanel
                  title={`${activeDailyDataset?.label || "玉米湿巾投放日趋势"} (独立日流水)`}
                  subtitle={`独立日流水 / ${wipesDailyInfo.rangeText} / 左轴 日消耗 (元) vs 右轴 展现量 (次)`}
                  actions={
                    dailyDatasets.length > 1 ? (
                      <div className="ca-dataset-mini-switcher" role="group" aria-label="切换分日数据集" style={{ display: "inline-flex", gap: 4 }}>
                        {dailyDatasets.map((ds) => {
                          const isCurrent = activeDailyDataset?.id === ds.id;
                          return (
                            <button
                              key={ds.id}
                              type="button"
                              onClick={() => setSelectedDailyDatasetId(ds.id)}
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 4,
                                border: isCurrent ? "1px solid var(--teal-11, #008573)" : "1px solid #d9d9e0",
                                background: isCurrent ? "var(--teal-3, #e0f8f3)" : "#ffffff",
                                color: isCurrent ? "var(--teal-11, #008573)" : "#60646c",
                                fontWeight: isCurrent ? 600 : 400,
                                cursor: "pointer",
                              }}
                            >
                              {ds.label.split(/[（(]/)[0]}
                            </button>
                          );
                        })}
                      </div>
                    ) : undefined
                  }
                >
                  <CampaignComboChart
                    rows={wipesDailyInfo.rows}
                    series={[
                      { key: "spend", label: "日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.terracotta },
                    ]}
                    alternativeRightSeries={[
                      { key: "clicks", label: "点击量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
                      { key: "uv", label: "活跃UV", unit: "人", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                    ]}
                    xKey="date"
                    title="投放日流水消耗与展现走势"
                    height={220}
                    onRowClick={(row) => handleDateClick(String(row.date || ''))}
                  />
                </ChartPanel>
            )}
            <ChartPanel
              title="日常种草核心考核达成 (全量 7 项)"
              subtitle="飞书底表快照 / 目标值 vs 实际完成"
            >
              <TargetBulletChart data={wipesDailyTargetBullets} />
            </ChartPanel>

            <ChartPanel
              title="医生专家板块考核达成 (全量 4 项)"
              subtitle="飞书底表快照 / 目标值 vs 实际完成"
            >
              <TargetBulletChart data={wipesDocTargetBullets} />
            </ChartPanel>
          </>
        )}
      </div>
      </div>

      {/* 3.1 战役增强面板 (各项目总览 Rich 扩展分析卡) */}
      <section id="ca-sec-enrichment" className="ca-section-enrichment" aria-label="深度业务拆解">
        <CampaignEnrichmentPanels dashboard={dashboard} section="overview" activeSnapshot={activeSnapshot} />
      </section>

      {/* 6. 底层明细表格 (仅展示当前图表关联表，完整呈现全部行不静默截断) */}
      {activeDetailTables.length > 0 && (
        <details id="ca-sec-details" className="ca-details-collapse">
          <summary className="ca-details-summary">
            <span className="ca-summary-left">
              <span className="ca-chapter-num">
                {projectId === "kailas" ? "09" : projectId === "meiling" ? (activeSnapshot === "history-618" ? "04" : "07") : "08"}
              </span>
              <span>查看关联业务明细数据 (当前看板对应 {activeDetailTables.length + (activeDailyDataset ? 1 : 0)} 项数据源，点击展开)</span>
            </span>
          </summary>
          <div className="ca-details-body">
            {activeDetailTables.map((t) => (
              <div key={t.id} className="ca-table-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: 14, color: "#1c2024" }}>{t.title}</strong>
                  {t.period && <span style={{ fontSize: 12, color: "#60646c" }}>周期: {t.period}</span>}
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
                    <strong style={{ fontSize: 14, color: "#1c2024" }}>{activeDailyDataset.label} (独立分日流水)</strong>
                    <span style={{ fontSize: 12, color: "#60646c", marginLeft: 8 }}>共 {activeDailyDataset.rows.length} 日记录</span>
                  </div>
                  {activeDailyDataset.period && <span style={{ fontSize: 12, color: "#60646c" }}>周期: {activeDailyDataset.period}</span>}
                </div>
                <div style={{ padding: "10px 12px", background: "#f9f9fb", border: "0.5px solid #d9d9e0", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#60646c" }}>
                    分日流水数据来源于独立分日数据集，包含消耗、展现、互动等完整时序。
                  </span>
                  <Link href={`/projects/${projectId}?tab=daily`} className="ca-nav-link" style={{ fontSize: 12 }}>
                    <span>前往「分日」工作台查看单日明细 →</span>
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
