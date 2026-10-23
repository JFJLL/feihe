"use client";

import React, { useState, useMemo } from "react";
import { StyledSelect } from "../../components/ui/StyledSelect";
import type { CampaignDashboard, CampaignTable } from "../../lib/campaign-types";
import {
  MetricStrip,
  ChartPanel,
  DonutChart,
  ScatterChart,
  BudgetComparisonChart,
  TargetBulletChart,
  ComparisonDatum,
  DualArenaChart,
  ButterflyCostChart,
  PlacementScorecardChart,
  LollipopRankChart,
  CAMPAIGN_PALETTE,
} from "./CampaignCharts";
import { CampaignComboChart } from "./CampaignComboChart";
import {
  safeNum,
  strictSum,
  isSummaryRow,
  extractKailasPlacements,
  extractWipesPlacements,
  extractMeilingFourLines,
  extractMeilingCidDaily,
  normalizeTableToPlacements,
  type PlacementRecord,
} from "./campaign-placement-model";
import "./campaign-analytics.css";
import "./campaign-combo.css";
import { CampaignEnrichmentPanels } from "./CampaignEnrichmentPanels";

export interface CampaignAdsPageProps {
  dashboard: CampaignDashboard;
}

const cleanTitle = (s: string) => s.replace(/\s*\([a-zA-Z0-9_-]+\)\s*$/, "").trim();

export function CampaignAdsPage({ dashboard }: CampaignAdsPageProps) {
  const { projectId, tables, kpis, reportPeriod, updatedAt } = dashboard;

  const views = useMemo(() => {
    if (projectId === "meiling") {
      return [
        { key: "four-lines", label: "全线投放与产出 (四线)", tableId: "meiling-four-lines" },
        { key: "cid-daily", label: "京东对投 CID 分日投放", tableId: "meiling-unlocked-double11-cid-daily" },
        { key: "kpi-78m", label: "7-8月 KPI 考核复盘", tableId: "meiling-kpi-unlocked-kpi-7-8m" },
        { key: "kpi-618", label: "618 历史复盘考核", tableId: "meiling-kpi-unlocked-kpi-618" },
        { key: "period-perf", label: "当期投放明细", tableId: "meiling-current-period-performance" },
      ];
    }
    if (projectId === "kailas") {
      return [
        { key: "fs-placements", label: "FS 版位投放效果 (视频/搜索/信息)", tableId: "kailas-fs-placements" },
        { key: "ugc-summary", label: "UGC 板块投放汇总", tableId: "kailas-ugc-summary" },
        { key: "budget-lines", label: "预算规划与执行情况", tableId: "kailas-budget-lines" },
      ];
    }
    if (projectId === "winner-wipes") {
      return [
        { key: "wipes-placements", label: "分版位投放效果 (视频/搜索/信息)", tableId: "wipes-current-placements" },
        { key: "wipes-kpi", label: "底表 KPI 考核达成情况", tableId: "wipes-kpi-comparison-table" },
      ];
    }
    return tables.map((t) => ({ key: t.id, label: cleanTitle(t.title), tableId: t.id }));
  }, [projectId, tables]);

  const [stateKey, setStateKey] = useState<string>(views[0]?.key || "");
  const [showTable, setShowTable] = useState<boolean>(false);

  const activeKey = useMemo(() => {
    return views.find((v) => v.key === stateKey)?.key ?? views[0]?.key ?? "";
  }, [views, stateKey]);

  const activeView = useMemo(() => views.find((v) => v.key === activeKey) || views[0], [views, activeKey]);
  const activeTable = useMemo((): CampaignTable | undefined => tables.find((t) => t.id === activeView?.tableId) || tables[0], [tables, activeView]);

  const records = useMemo((): PlacementRecord[] => {
    if (!activeTable?.rows) return [];
    if (projectId === "meiling" && activeKey === "four-lines") {
      return extractMeilingFourLines(activeTable);
    }
    if (projectId === "kailas" && activeKey === "fs-placements") {
      return extractKailasPlacements(activeTable);
    }
    if (projectId === "winner-wipes" && activeKey === "wipes-placements") {
      return extractWipesPlacements(activeTable);
    }
    return normalizeTableToPlacements(activeTable);
  }, [activeTable, projectId, activeKey]);

  const targetBulletData = useMemo((): ComparisonDatum[] => {
    if (!activeTable?.rows) return [];
    if (!["kpi-78m", "kpi-618", "wipes-kpi"].includes(activeKey)) return [];
    return activeTable.rows
      .filter((r) => {
        const title = String(r.scope || (r.group ? `${r.group} ${r.kpiName}` : r.kpiName) || r.metric || "");
        return title && !isSummaryRow(title);
      })
      .map((r) => {
        const label = String(r.scope || (r.group ? `${r.group} ${r.kpiName}` : r.kpiName) || r.metric || "");
        const actual = safeNum(r.actual);
        const target = safeNum(r.target);
        const isCost = /CPC|CPE|CPUV|CPM|成本/i.test(label);
        const unit = isCost ? "元" : /率|ROI|进度|占比/i.test(label) ? (label.includes("ROI") ? "" : "%") : "次";
        return {
          label,
          actual,
          target,
          unit,
          direction: isCost ? ("lower" as const) : ("higher" as const),
        };
      })
      .filter((d) => d.target !== null);
  }, [activeTable, activeKey]);

  const stripItems = useMemo(() => {
    if (projectId === "meiling" && activeKey === "four-lines") {
      const fsTotal = strictSum(records.map((r) => r.fsSpend ?? r.spend));
      const kTotal = strictSum(records.map((r) => r.kSpend));
      const gmvTotal = strictSum(records.map((r) => r.gmv));
      const bestRoi = records.filter((r) => r.roi !== null).sort((a, b) => (b.roi || 0) - (a.roi || 0))[0];
      return [
        { label: "四线 FS 消耗合计", value: fsTotal !== null ? fsTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "投流广告支出总和" },
        { label: "四线 K 费用合计", value: kTotal !== null ? kTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "达人发文合作支出" },
        { label: "任务组 GMV 合计", value: gmvTotal !== null ? gmvTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "各任务组独立产出累加" },
        { label: "最高 ROI 任务组", value: bestRoi?.roi != null ? bestRoi.roi.toFixed(2) : "—", note: bestRoi?.name },
      ];
    }
    if (projectId === "meiling" && activeKey === "cid-daily") {
      const sumRow = activeTable?.rows?.find((r) => isSummaryRow(String(r.date || "")));
      const sumSpend = safeNum(sumRow?.spend);
      const sumGmv = safeNum(sumRow?.gmv);
      const sumOrders = safeNum(sumRow?.orders);
      const sumRoi = safeNum(sumRow?.roi);
      return [
        { label: "CID 3日广告消耗", value: sumSpend !== null ? sumSpend.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "纯广告支出" },
        { label: "CID 3日累计 GMV", value: sumGmv !== null ? sumGmv.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "30日归因成交GMV" },
        { label: "CID 3日累计 ROI", value: sumRoi !== null ? sumRoi.toFixed(2) : "—", note: "产出/广告消耗" },
        { label: "CID 累计成交订单", value: sumOrders !== null ? sumOrders.toLocaleString("zh-CN") : "—", unit: "单", note: "店铺成交总单量" },
      ];
    }
    if (targetBulletData.length > 0) {
      const validTargets = targetBulletData.filter((d) => d.actual !== null && d.target !== null);
      const achieved = validTargets.filter((d) => (d.direction === "lower" ? (d.actual ?? 0) <= (d.target ?? 0) : (d.actual ?? 0) >= (d.target ?? 0))).length;
      return [
        { label: "考核指标总数", value: targetBulletData.length, unit: "项", note: activeTable?.period || reportPeriod },
        { label: "达成指标项", value: achieved, unit: "项", note: `达成率 ${validTargets.length > 0 ? ((achieved / validTargets.length) * 100).toFixed(1) : 0}%` },
        { label: "待改进指标项", value: validTargets.length - achieved, unit: "项", note: "未达预期标准" },
        { label: "首项考核指标", value: targetBulletData[0]?.actual != null ? `${targetBulletData[0].actual}${targetBulletData[0].unit || ""}` : "—", note: `${targetBulletData[0]?.label || ""} (目标 ${targetBulletData[0]?.target}${targetBulletData[0]?.unit || ""})` },
      ];
    }
    if (projectId === "kailas") {
      const budgetKpi = kpis.find((k) => k.id === "kailas-budget-total");
      const spendKpi = kpis.find((k) => k.id === "kailas-spend-total");
      const maxSpend = records.slice().sort((a, b) => (b.spend || 0) - (a.spend || 0))[0];
      return [
        { label: "规划总现金预算", value: budgetKpi?.value?.toLocaleString("zh-CN") ?? "—", unit: "元", note: "日常现金预算目标" },
        { label: "累计总消耗", value: spendKpi?.value?.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) ?? "—", unit: "元", note: "含效果广告与种草" },
        { label: "最高消耗版位", value: maxSpend?.name || "—", note: maxSpend?.spend ? `${maxSpend.spend.toLocaleString("zh-CN")} 元` : undefined },
        { label: `${maxSpend?.name || "主力版位"} CPC`, value: maxSpend?.cpc != null ? maxSpend.cpc.toFixed(2) : "—", unit: "元", note: `${maxSpend?.name || ""}版位成本` },
      ];
    }
    if (projectId === "winner-wipes") {
      const cumSpend = kpis.find((k) => k.id === "wipes-cum-spend");
      const cidSpend = kpis.find((k) => k.id === "wipes-cid-spend");
      const cidRoi = kpis.find((k) => k.id === "wipes-cid-roi");
      const maxSpend = records.slice().sort((a, b) => (b.spend || 0) - (a.spend || 0))[0];
      return [
        { label: "日常种草累计消耗", value: cumSpend?.value?.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) ?? "—", unit: "元", note: "周期累计执行金额" },
        { label: "最高消耗投放版位", value: maxSpend?.name || "—", note: maxSpend?.spend ? `${maxSpend.spend.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 元` : undefined },
        { label: "CID 引流累计消耗", value: cidSpend?.value?.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) ?? "—", unit: "元", note: "跨平台引流记录" },
        { label: "CID 产出比 ROI", value: cidRoi?.value != null ? cidRoi.value.toFixed(2) : "—", note: "产出/广告消耗" },
      ];
    }
    const totalSpend = strictSum(records.map((r) => r.spend));
    return [
      { label: "当前视图总消耗", value: totalSpend !== null ? totalSpend.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: activeTable?.period || reportPeriod },
      { label: "有效数据行", value: records.length, unit: "项", note: "排除汇总项" },
      { label: "首项产出比", value: records[0]?.roi != null ? records[0].roi.toFixed(2) : "—", note: records[0]?.name },
      { label: "首项点击成本", value: records[0]?.cpc != null ? records[0].cpc.toFixed(2) : "—", unit: "元", note: records[0]?.name },
    ];
  }, [records, projectId, activeKey, activeTable, kpis, reportPeriod, targetBulletData]);

  const scatterPoints = useMemo(() => {
    return records
      .filter((r) => r.cpc !== null && r.ctr !== null)
      .map((r) => ({
        label: r.name,
        x: r.cpc!,
        y: r.ctr!,
        size: r.spend ?? null,
      }));
  }, [records]);

  const kailasBudgetComparisonData = useMemo((): ComparisonDatum[] => {
    if (projectId !== "kailas" || activeKey !== "budget-lines" || !activeTable?.rows) return [];
    return activeTable.rows.filter((r) => r.line && !isSummaryRow(String(r.line))).map((r) => ({
      label: String(r.line).replace(/\(.*\)/, "").trim(),
      target: safeNum(r.planned),
      actual: safeNum(r.spend),
      unit: "元",
      direction: "lower" as const,
    }));
  }, [projectId, activeKey, activeTable]);

  const meilingCidTrend = useMemo(() => {
    if (projectId !== "meiling" || activeKey !== "cid-daily" || !activeTable?.rows) return [];
    return extractMeilingCidDaily(activeTable);
  }, [projectId, activeKey, activeTable]);

  const cidScatterPoints = useMemo(() => {
    return meilingCidTrend
      .filter((r) => safeNum(r.cpc) !== null && safeNum(r.ctr) !== null)
      .map((r) => ({
        label: String(r.date),
        x: safeNum(r.cpc)!,
        y: safeNum(r.ctr)!,
        size: safeNum(r.spend) ?? null,
      }));
  }, [meilingCidTrend]);

  const displayPeriod = activeTable?.period || reportPeriod;
  const halfBullet = Math.ceil(targetBulletData.length / 2);

  return (
    <div className="ca-page">
      <header className="ca-header bd-toolbar-compact">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">投流分析</h2>
            <span className="ca-header-badge">投放看板</span>
            <div className="ca-header-view-group" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ca-palette-muted)" }}>分析视角：</span>
              <StyledSelect className="ca-toolbar-select" value={activeKey} onChange={(e) => setStateKey(e.target.value)} aria-label="投流数据视图切换">
                {views.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </StyledSelect>
            </div>
          </div>
          <span className="ca-header-subtitle">广告消耗结构、点击与转化效率对比及投放指标跟踪</span>
        </div>
        <div className="ca-header-meta">
          <span>业务周期：<strong>{displayPeriod}</strong></span>
          <span>更新时间：<strong>{new Date(updatedAt).toLocaleDateString("zh-CN")}</strong></span>
        </div>
      </header>

      <div className="ca-toolbar" style={{ display: "none" }} aria-hidden="true">
        <div className="ca-toolbar-group">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ca-palette-muted)" }}>分析视角：</span>
          <StyledSelect className="ca-toolbar-select" value={activeKey} onChange={(e) => setStateKey(e.target.value)} aria-label="投流数据视图切换">
            {views.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </StyledSelect>
        </div>
      </div>

      <MetricStrip items={stripItems} />

      {/* 01 章节头: 核心渠道与版位效能矩阵 */}
      <div className="ca-chapter-header">
        <div className="ca-chapter-title-group">
          <span className="ca-chapter-badge">01</span>
          <div className="ca-chapter-heading">
            <h3 className="ca-chapter-title">核心渠道与版位效能矩阵</h3>
            <span className="ca-chapter-desc">核心广告消耗结构、多维单位转化成本及四象限效率诊断</span>
          </div>
        </div>
        <div className="ca-chapter-meta">
          <span className="ca-chapter-period-tag">统计周期：{displayPeriod}</span>
        </div>
      </div>

      <div className="ca-grid">
        {targetBulletData.length > 0 ? (
          <>
            <ChartPanel title="KPI 目标达成对比 (第一组)" subtitle={`业务周期：${displayPeriod}`}>
              <TargetBulletChart data={targetBulletData.slice(0, halfBullet)} />
            </ChartPanel>
            <ChartPanel title="KPI 目标达成对比 (第二组)" subtitle={`业务周期：${displayPeriod}`}>
              <TargetBulletChart data={targetBulletData.slice(halfBullet)} />
            </ChartPanel>
          </>
        ) : kailasBudgetComparisonData.length > 0 ? (
          <>
            <ChartPanel title="预算规划与实际消耗对比" subtitle={`业务周期：${displayPeriod}`}>
              <BudgetComparisonChart data={kailasBudgetComparisonData} unit="元" />
            </ChartPanel>
            <ChartPanel title="各预算行消耗分布" subtitle={`业务周期：${displayPeriod}`}>
              <DonutChart
                data={records.filter((r) => r.spend !== null).map((r) => ({ id: r.id, label: r.name, value: r.spend }))}
                unit="元"
                centerLabel="预算执行"
              />
            </ChartPanel>
          </>
        ) : activeKey === "cid-daily" && meilingCidTrend.length > 0 ? (
          <>
            <ChartPanel title="CID 分日消耗、GMV 与 ROI" subtitle={`业务周期：${displayPeriod} · 左轴 消耗与GMV (元) vs 右轴 成交ROI (倍)`}>
              <CampaignComboChart
                rows={meilingCidTrend}
                series={[
                  { key: "spend", label: "广告消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "gmv", label: "成交 GMV", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
                  { key: "roi", label: "成交 ROI", unit: "倍", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="date"
                title="CID 消耗与 GMV/ROI 趋势"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="CID 流量点击规模与点击率" subtitle={`业务周期：${displayPeriod} · 左轴 点击量 (次) vs 右轴 点击率 (%)`}>
              <CampaignComboChart
                rows={meilingCidTrend}
                series={[
                  { key: "clicks", label: "点击量", unit: "次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "ctr", label: "点击率 (CTR)", unit: "%", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="date"
                title="CID 点击规模与点击率"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="CID 广告消耗与进店人数 (UV)" subtitle={`业务周期：${displayPeriod} · 左轴 消耗 (元) vs 右轴 进店人数 (人)`}>
              <CampaignComboChart
                rows={meilingCidTrend}
                series={[
                  { key: "spend", label: "广告消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "activeUv", label: "进店人数 (UV)", unit: "人", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="date"
                title="CID 消耗与进店人数"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="CID 分日效率分布" subtitle="横轴 点击成本 CPC (元)，纵轴 点击率 CTR (%)，气泡大小代表广告消耗金额">
              {cidScatterPoints.length > 0 ? (
                <ScatterChart data={cidScatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        ) : activeKey === "four-lines" ? (
          <>
            <ChartPanel title="四线全额投入 (K+FS) 与产出 GMV / ROI" subtitle={`业务周期：${displayPeriod} · 左轴 全额投入与GMV (元) vs 右轴 综合ROI (倍)`}>
              <CampaignComboChart
                rows={records as unknown as Record<string, unknown>[]}
                series={[
                  { key: "totalSpend", label: "全额投入 (K+FS)", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
                  { key: "gmv", label: "归因产出 (GMV)", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "roi", label: "综合产出比 (KFS ROI)", unit: "倍", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="四线投入与产出"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="四线点击成本 (CPC) 与访客成本 (CPUV) 双翼对比" subtitle={`业务周期：${displayPeriod} · 左翼 CPC (元/次) vs 右翼 CPUV (元/UV)`}>
              <ButterflyCostChart
                data={records.map((r) => ({
                  label: r.name,
                  leftVal: r.cpc ?? null,
                  rightVal: r.cpuv ?? null,
                  spend: r.fsSpend ?? r.spend ?? null,
                }))}
                leftLabel="前端点击成本 (CPC)"
                rightLabel="后端进店成本 (CPUV)"
                leftUnit="元"
                rightUnit="元"
              />
            </ChartPanel>
            <ChartPanel title="四线消耗结构与全链路效能评分卡" subtitle={`业务周期：${displayPeriod} · 消耗构成份额与全链路效能多维诊断矩阵`}>
              <PlacementScorecardChart
                rows={records.map((r) => ({
                  name: r.name,
                  spend: r.fsSpend ?? r.spend ?? null,
                  ctr: r.ctr ?? null,
                  cpc: r.cpc ?? null,
                  cpuv: r.cpuv ?? null,
                  gmv: r.gmv ?? null,
                  roi: r.roi ?? null,
                }))}
                mode="four-lines"
              />
            </ChartPanel>
            <ChartPanel title="点击成本与点击率四象限效率分布" subtitle="横轴 点击成本 CPC (元)，纵轴 点击率 CTR (%)，气泡大小代表广告消耗金额">
              {scatterPoints.length > 0 ? (
                <ScatterChart data={scatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        ) : activeKey === "fs-placements" || activeKey === "wipes-placements" ? (
          <>
            <ChartPanel title="版位广告消耗与点击率 (CTR)" subtitle={`业务周期：${displayPeriod} · 左轴 消耗 (元) vs 右轴 点击率 (%)`}>
              <CampaignComboChart
                rows={records as unknown as Record<string, unknown>[]}
                series={[
                  { key: "spend", label: "广告消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "ctr", label: "点击率 (CTR)", unit: "%", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="版位消耗与点击率"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="版位互动成本 (CPE) 与访客成本 (CPUV) 双翼对比" subtitle={`业务周期：${displayPeriod} · 左翼 CPE (元/次) vs 右翼 CPUV (元/UV)`}>
              <ButterflyCostChart
                data={records.map((r) => ({
                  label: r.name,
                  leftVal: r.cpe ?? null,
                  rightVal: r.cpuv ?? null,
                  spend: r.spend ?? null,
                }))}
                leftLabel="前端互动成本 (CPE)"
                rightLabel="后端进店成本 (CPUV)"
                leftUnit="元"
                rightUnit="元"
              />
            </ChartPanel>
            <ChartPanel title="分版位消耗份额与全维成本矩阵 (CPM / CPC / CPE / CPUV)" subtitle={`业务周期：${displayPeriod} · 消耗构成份额与 CPM / CPC / CPE / CPUV 全成本矩阵`}>
              <PlacementScorecardChart
                rows={records.map((r) => ({
                  name: r.name,
                  spend: r.spend ?? null,
                  ctr: r.ctr ?? null,
                  cpm: r.cpm ?? null,
                  cpc: r.cpc ?? null,
                  cpe: r.cpe ?? null,
                  cpuv: r.cpuv ?? null,
                }))}
                mode="placement"
              />
            </ChartPanel>
            <ChartPanel title="点击成本与点击率四象限效率分布" subtitle="横轴 点击成本 CPC (元)，纵轴 点击率 CTR (%)，气泡大小代表广告消耗金额">
              {scatterPoints.length > 0 ? (
                <ScatterChart data={scatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        ) : (
          <>
            <ChartPanel title="投放消耗与点击率对比" subtitle={`业务周期：${displayPeriod} · 左轴 消耗 (元) vs 右轴 点击率 (%)`}>
              <CampaignComboChart
                rows={records as unknown as Record<string, unknown>[]}
                series={[
                  { key: "spend", label: "广告消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
                  { key: "ctr", label: "点击率 (CTR)", unit: "%", axis: "right", kind: "point", color: CAMPAIGN_PALETTE.gold },
                ]}
                xKey="name"
                title="消耗与点击率"
                height={220}
              />
            </ChartPanel>
            <ChartPanel title="版位互动成本 (CPE) 与访客成本 (CPUV) 双翼对比" subtitle={`业务周期：${displayPeriod} · 左翼 CPE (元/次) vs 右翼 CPUV (元/UV)`}>
              <ButterflyCostChart
                data={records.map((r) => ({
                  label: r.name,
                  leftVal: r.cpe ?? r.cpc ?? null,
                  rightVal: r.cpuv ?? null,
                  spend: r.spend ?? null,
                }))}
                leftLabel={records.some((r) => r.cpe !== null && r.cpe !== undefined) ? "互动成本 (CPE)" : "点击成本 (CPC)"}
                rightLabel="访客转化成本 (CPUV)"
                leftUnit="元"
                rightUnit="元"
              />
            </ChartPanel>
            <ChartPanel title="分版位消耗份额与全维成本矩阵" subtitle={`业务周期：${displayPeriod} · 消耗构成份额与成本评分矩阵`}>
              <PlacementScorecardChart
                rows={records.map((r) => ({
                  name: r.name,
                  spend: r.spend ?? null,
                  ctr: r.ctr ?? null,
                  cpm: r.cpm ?? null,
                  cpc: r.cpc ?? null,
                  cpe: r.cpe ?? null,
                  cpuv: r.cpuv ?? null,
                }))}
                mode="placement"
              />
            </ChartPanel>
            <ChartPanel title="点击成本与点击率四象限效率分布" subtitle="横轴 CPC (元)，纵轴 CTR (%)，气泡大小代表消耗金额">
              {scatterPoints.length > 0 ? (
                <ScatterChart data={scatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        )}
      </div>

      {/* 深入分析扩展接入区（Ohm 交付的真实深入分析组件） */}
      <div id="ca-ads-enrichment-slot" className="ca-ads-enrichment-slot">
        <CampaignEnrichmentPanels dashboard={dashboard} section="ads" />
      </div>

      <div className="ca-panel">
        <div className="ca-panel-header">
          <div className="ca-panel-heading">
            <h3 className="ca-panel-title">{cleanTitle(activeTable?.title || "报表明细")}</h3>
            <p className="ca-panel-subtitle">业务周期：{displayPeriod}</p>
          </div>
          <button type="button" className="ca-toolbar-btn" onClick={() => setShowTable(!showTable)}>
            {showTable ? "收起明细" : `展开明细 (${activeTable?.rows?.length || 0} 行)`}
          </button>
        </div>
        {showTable && activeTable && (
          <div className="ca-panel-body">
            <div className="ca-table-wrap">
              <table className="ca-table">
                <thead>
                  <tr>{activeTable.columns.map((c) => <th key={c.key} style={{ textAlign: c.align || "left" }}>{c.title}</th>)}</tr>
                </thead>
                <tbody>
                  {activeTable.rows.map((row, idx) => (
                    <tr key={idx}>
                      {activeTable.columns.map((c) => (
                        <td key={c.key} style={{ textAlign: c.align || "left" }}>
                          {row[c.key] !== null && row[c.key] !== undefined && row[c.key] !== "" ? String(row[c.key]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

