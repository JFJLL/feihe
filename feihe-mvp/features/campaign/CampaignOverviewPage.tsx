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
  HorizontalBarChart,
  DonutChart,
  BudgetComparisonChart,
  TargetBulletChart,
  type ChartDatum,
  type ComparisonDatum,
  CAMPAIGN_PALETTE,
} from "./CampaignCharts";
import "./campaign-analytics.css";
import "./CampaignOverviewPage.css";

export interface CampaignOverviewPageProps {
  dashboard: CampaignDashboard;
}

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "—" || s === "null" || s === "undefined") return null;
  const cleaned = s.replace(/[,¥%]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function strictSum(numbers: (number | null)[]): number | null {
  if (!numbers.length) return null;
  for (const n of numbers) {
    if (n === null || !Number.isFinite(n)) return null;
  }
  return (numbers as number[]).reduce((a, b) => a + b, 0);
}

const isSummaryRow = (label?: string): boolean => Boolean(label && /(合计|总计|汇总)/.test(label));

export function CampaignOverviewPage({ dashboard }: CampaignOverviewPageProps) {
  const { projectId, name, reportPeriod, updatedAt, kpis = [], tables = [] } = dashboard;

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

  const kailasDailyMetrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const totalPlanned = findKpi("kailas-budget-total");
    const totalSpend = findKpi("kailas-spend-total");
    const progress = findKpi("kailas-budget-progress");
    const remaining = findKpi("kailas-budget-remaining");

    return [
      { label: totalPlanned?.label || "规划总预算", value: totalPlanned?.value ?? null, unit: totalPlanned?.unit || "元", note: totalPlanned?.period },
      { label: totalSpend?.label || "累计总消耗", value: totalSpend?.value ?? null, unit: totalSpend?.unit || "元", note: totalSpend?.note },
      { label: progress?.label || "预算执行进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.note },
      { label: remaining?.label || "预算差额", value: remaining?.value ?? null, unit: remaining?.unit || "元", note: remaining?.note },
    ];
  }, [findKpi]);

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

  const kailasFsCpuvData = useMemo((): ChartDatum[] => {
    if (!kailasFsPlacementsTable?.rows) return [];
    return kailasFsPlacementsTable.rows
      .filter((r) => !isSummaryRow(String(r.placement || "")) && safeNum(r.cpuv) !== null)
      .map((r) => ({
        id: String(r.placement),
        label: String(r.placement) + "版位",
        value: safeNum(r.cpuv),
        detail: safeNum(r.ctr) !== null ? "CTR: " + String(safeNum(r.ctr)) + "%" : undefined,
        color: String(r.placement).includes("搜索") ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.purple,
      }));
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

  const meilingDouble11Metrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const spendKpi = findKpi("meiling-unlocked-kpi-d11-actual-spend");
    const progressKpi = findKpi("meiling-unlocked-kpi-d11-progress");
    const publishedKpi = findKpi("meiling-online-published-count");
    const confirmedKpi = findKpi("meiling-online-confirmed-total");

    const summaryRow = meilingExecutionTable?.rows.find(
      (r) => isSummaryRow(String(r.model || "")) || isSummaryRow(String(r.series || ""))
    );
    const budgetVal = spendKpi?.target ?? safeNum(summaryRow?.newBudget);
    const actualVal = spendKpi?.value ?? safeNum(summaryRow?.actualSpend);

    const nonSummaryRows = (meilingFourLinesTable?.rows || []).filter((r) => !isSummaryRow(String(r.name || "")));
    const fourLinesGmv = strictSum(nonSummaryRows.map((r) => safeNum(r.gmv)));

    return [
      { label: "双11调整后总预算", value: budgetVal, unit: "元", note: "10.18快照调整预算口径" },
      { label: spendKpi?.label || "截至10.18消耗", value: actualVal, unit: "元", note: spendKpi?.period },
      { label: progressKpi?.label || "大促消耗进度", value: progressKpi?.value !== null && progressKpi?.value !== undefined ? String(progressKpi.value) + "%" : null, note: "截至10.18累计" },
      { label: "四线产出 GMV 总额", value: fourLinesGmv, unit: "元", note: publishedKpi?.value ? "线上已发布 " + String(publishedKpi.value) + " 篇 (母集 " + String(confirmedKpi?.value || "—") + " 位)" : undefined },
    ];
  }, [meilingExecutionTable, meilingFourLinesTable, findKpi]);

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

  const meilingFourLinesGmvData = useMemo((): ChartDatum[] => {
    if (!meilingFourLinesTable?.rows) return [];
    return meilingFourLinesTable.rows
      .filter((r) => !isSummaryRow(String(r.name || "")))
      .map((r) => ({
        id: String(r.name),
        label: String(r.name),
        value: safeNum(r.gmv),
        detail: safeNum(r.kfsRoi) !== null ? "ROI: " + String(safeNum(r.kfsRoi)) : undefined,
        color: String(r.name).includes("自采") ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.gold,
      }));
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

  const wipesDailyMetrics = useMemo((): Array<{ label: string; value: string | number | null; unit?: string; note?: string }> => {
    const cumSpend = findKpi("wipes-cum-spend");
    const progress = findKpi("wipes-cum-progress");
    const cpuvT2 = findKpi("wipes-cum-cpuv-t2");
    const newCust = findKpi("wipes-cum-new-cust");

    return [
      { label: cumSpend?.label || "日常种草累计消耗", value: cumSpend?.value ?? null, unit: cumSpend?.unit || "元", note: cumSpend?.period },
      { label: progress?.label || "日常种草进度", value: progress?.value !== null && progress?.value !== undefined ? String(progress.value) + "%" : null, note: progress?.target !== null && progress?.target !== undefined ? "目标: " + String(progress.target) + "%" : undefined },
      { label: cpuvT2?.label || "CPUV(T-2)", value: cpuvT2?.value !== null && cpuvT2?.value !== undefined ? "¥" + String(cpuvT2.value) : null, note: cpuvT2?.period },
      { label: newCust?.label || "新客占比", value: newCust?.value !== null && newCust?.value !== undefined ? String(newCust.value) + "%" : null, note: newCust?.period },
    ];
  }, [findKpi]);

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

  const wipesPlacementCpuvData = useMemo((): ChartDatum[] => {
    if (!wipesPlacementsTable?.rows) return [];
    return wipesPlacementsTable.rows
      .filter((r) => !isSummaryRow(String(r.name || "")) && safeNum(r.cpuv) !== null)
      .map((r) => ({
        id: String(r.name),
        label: String(r.name) + "版位",
        value: safeNum(r.cpuv),
        detail: safeNum(r.ctr) !== null ? "CTR: " + String(safeNum(r.ctr)) + "%" : undefined,
        color: String(r.name).includes("视频") ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.purple,
      }));
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
        const validCpuv = kailasFsCpuvData.filter((r) => r.value !== null);
        const lowestCpuv = validCpuv.length > 0 ? [...validCpuv].sort((a, b) => (a.value || 0) - (b.value || 0))[0] : null;
        const parts: string[] = [];
        if (overRuns.length > 0) {
          parts.push(overRuns.map((r) => `${r.label}超支 ${(r.actual! - r.target!).toLocaleString()}元`).join("；"));
        } else {
          parts.push("各预算行当前未见超支记录");
        }
        if (lowestCpuv?.value !== null && lowestCpuv?.value !== undefined) {
          parts.push(`版位中${lowestCpuv.label}转化成本最低(${lowestCpuv.value}元/UV)`);
        }
        return `10.16–10.18 日报现金口径：${parts.join("，")}。UGC版位无UV数据已保持留白。`;
      }
      const q3Spend = findKpi("kailas-unlocked-kpi-budget");
      return `Q3双周会小结口径 (含返点)：规划预算 ${q3Spend?.target?.toLocaleString() || "—"}元，实际消耗 ${q3Spend?.value?.toLocaleString() || "—"}元。`;
    }

    if (projectId === "meiling") {
      if (activeSnapshot === "double11-1018") {
        const validGmvRows = meilingFourLinesGmvData.filter((r) => r.value !== null);
        const bestGmv = validGmvRows.length > 0 ? [...validGmvRows].sort((a, b) => (b.value || 0) - (a.value || 0))[0] : null;
        return `双11大促执行（截至10月18日累计）：各渠道按调整预算执行；四线转化中${bestGmv ? `${bestGmv.label}产出最高(${bestGmv.value?.toLocaleString()}元，${bestGmv.detail || ""})` : "各链路独立核算"}。`;
      }
      const roi618 = findKpi("meiling-unlocked-kpi-618-roi");
      return `618大促已结案归档：全案ROI为 ${roi618?.value || "—"}（目标 ${roi618?.target || "—"}），供大促策略历史参考。`;
    }

    if (projectId === "winner-wipes") {
      if (activeSnapshot === "daily-1019") {
        const validCpuv = wipesPlacementCpuvData.filter((r) => r.value !== null);
        const bestPlacement = validCpuv.length > 0 ? [...validCpuv].sort((a, b) => (a.value || 0) - (b.value || 0))[0] : null;
        return `稳健酒精湿巾10.19日报口径：${bestPlacement ? `${bestPlacement.label}成本最低(${bestPlacement.value}元/UV，${bestPlacement.detail || ""})` : "各版位分化核算"}。底表KPI统计截止未注明，待业务核对。`;
      }
      const notMet = wipesDailyTargetBullets.filter(
        (d) => d.actual !== null && d.target !== null && (d.direction === "lower" ? d.actual > d.target : d.actual < d.target)
      );
      return `飞书底表快照考核（未注明确切截止日期）：日常种草中包含${notMet.map((m) => `${m.label}(实际${m.actual}${m.unit || ""} 目标${m.target})`).join("、") || "全部达标"}等偏差项，详见标靶图。`;
    }

    return `当前项目业务周期: ${activeHeaderPeriod}。核心数据基于最新入账记录动态呈现，缺值保持留白。`;
  }, [projectId, activeSnapshot, kailasBudgetLinesComparison, kailasFsCpuvData, meilingFourLinesGmvData, wipesPlacementCpuvData, wipesDailyTargetBullets, findKpi, activeHeaderPeriod]);

  const activeMetrics = useMemo(() => {
    if (projectId === "kailas") return activeSnapshot === "daily-1018" ? kailasDailyMetrics : kailasQ3Metrics;
    if (projectId === "meiling") return activeSnapshot === "double11-1018" ? meilingDouble11Metrics : meiling618Metrics;
    if (projectId === "winner-wipes") return activeSnapshot === "daily-1019" ? wipesDailyMetrics : wipesSheetMetrics;
    return kpis.slice(0, 4).map((k) => ({ label: k.label, value: k.value, unit: k.unit, note: k.period }));
  }, [projectId, activeSnapshot, kailasDailyMetrics, kailasQ3Metrics, meilingDouble11Metrics, meiling618Metrics, wipesDailyMetrics, wipesSheetMetrics, kpis]);

  return (
    <div className="ca-page" role="main" aria-label={name + " 营销战役总览"}>
      {/* 1. Header (单行 h1 + 周期说明 + 业务快照切换器) */}
      <header className="ca-header">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h1 className="ca-header-title">{name} · 战役总览</h1>
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
                  日常种草与今日预算 (10.19日报)
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
              title="FS 版位千次曝光与 UV 转化成本"
              subtitle="10.16–10.18 日报口径 · 单位转化成本 (元/UV)"
            >
              <HorizontalBarChart data={kailasFsCpuvData} unit="元/UV" />
            </ChartPanel>
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
              subtitle="四线投放累计截至10.18 · GMV 单位元 · 各链路独立核算"
            >
              <HorizontalBarChart data={meilingFourLinesGmvData} unit="元" />
            </ChartPanel>
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
              title="今日规划预算分配结构"
              subtitle="10.19 日报规划预算分配 (元)"
            >
              <DonutChart data={wipesBudgetDonutData} unit="元" centerLabel="今日总预算" />
            </ChartPanel>

            <ChartPanel
              title="分版位投放效率 CPUV 对比"
              subtitle="10.19 日报分版位投放效果 · 单位转化成本 (元/UV)"
            >
              <HorizontalBarChart data={wipesPlacementCpuvData} unit="元/UV" />
            </ChartPanel>
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
          </>
        )}
      </div>

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
            <span>查看关联业务明细数据 (当前看板对应 {activeDetailTables.length} 张表，点击展开)</span>
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
