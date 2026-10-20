"use client";

import React, { useState, useMemo } from "react";
import type { CampaignDashboard, CampaignTable } from "../../lib/campaign-types";
import {
  MetricStrip,
  ChartPanel,
  HorizontalBarChart,
  DonutChart,
  ScatterChart,
  BudgetComparisonChart,
  TargetBulletChart,
  ChartDatum,
  ComparisonDatum,
} from "./CampaignCharts";
import { TimeSeriesChart } from "../../components/ui/TimeSeriesChart";
import "./campaign-analytics.css";

export interface CampaignAdsPageProps {
  dashboard: CampaignDashboard;
}

const isSummary = (s: string) => /(汇总|总计|合计)/.test(s);
const cleanTitle = (s: string) => s.replace(/\s*\([a-zA-Z0-9_-]+\)\s*$/, "").trim();

const parseNum = (v: unknown): number | null => {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const clean = v.replace(/[,元%次件]/g, "").trim();
    if (!clean || clean === "/" || clean === "-") return null;
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  }
  return null;
};

const sumAll = (arr: (number | null)[]): number | null => {
  if (!arr.length || arr.some((v) => v === null)) return null;
  return (arr as number[]).reduce((a, b) => a + b, 0);
};

export function CampaignAdsPage({ dashboard }: CampaignAdsPageProps) {
  const { projectId, tables, kpis, reportPeriod, updatedAt, name: projectName } = dashboard;

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

  const [activeKey, setActiveKey] = useState<string>(views[0]?.key || "");
  const [cidMetric, setCidMetric] = useState<"spend" | "activeUv">("spend");
  const [showTable, setShowTable] = useState<boolean>(false);

  const activeView = useMemo(() => views.find((v) => v.key === activeKey) || views[0], [views, activeKey]);
  const activeTable = useMemo((): CampaignTable | undefined => tables.find((t) => t.id === activeView?.tableId) || tables[0], [tables, activeView]);

  const records = useMemo(() => {
    if (!activeTable?.rows) return [];
    return activeTable.rows
      .filter((r) => {
        const title = String(r.name || r.placement || r.channel || r.line || r.dimension || r.kpiName || r.metric || r.date || "");
        return title && !isSummary(title);
      })
      .map((r, idx) => {
        const name = String(r.name || r.placement || r.channel || r.line || (r.group ? `${r.group}-${r.kpiName}` : r.kpiName) || r.metric || r.dimension || r.date || `项目${idx + 1}`);
        const ctrStr = typeof r.ctr === "string" ? r.ctr.replace("%", "").trim() : r.ctr;
        return {
          id: `${name}-${idx}`,
          name,
          spend: parseNum(r.spend ?? r.fsSpend ?? r.actual),
          kSpend: parseNum(r.kSpend),
          cpc: parseNum(r.cpc),
          ctr: parseNum(ctrStr),
          gmv: parseNum(r.gmv ?? r.cidGmv ?? r.totalGmv),
          roi: parseNum(r.roi ?? r.fsRoi ?? r.kfsRoi ?? r.totalRoi),
          orders: parseNum(r.orders),
          uv: parseNum(r.uv ?? r.activeUv),
        };
      });
  }, [activeTable]);

  const targetBulletData = useMemo((): ComparisonDatum[] => {
    if (!activeTable?.rows) return [];
    if (!["kpi-78m", "kpi-618", "wipes-kpi"].includes(activeKey)) return [];
    return activeTable.rows
      .filter((r) => {
        const actualStr = String(r.actual || "");
        return actualStr && actualStr !== "/" && actualStr !== "-" && !actualStr.includes("考核") && !actualStr.includes("未");
      })
      .map((r) => {
        const label = String(r.scope || (r.group ? `${r.group} ${r.kpiName}` : r.kpiName) || r.metric || "");
        const actual = parseNum(r.actual);
        const target = parseNum(r.target);
        const isCost = /CPC|CPE|CPUV|CPM|成本/i.test(label);
        const unit = isCost ? "元" : /率|ROI|进度|占比/i.test(label) ? (label.includes("ROI") ? "" : "%") : "次";
        return { label, actual, target, unit, direction: isCost ? ("lower" as const) : ("higher" as const) };
      })
      .filter((d) => d.actual !== null && d.target !== null);
  }, [activeTable, activeKey]);

  const stripItems = useMemo(() => {
    if (projectId === "meiling" && activeKey === "four-lines") {
      const fsTotal = sumAll(records.map((r) => r.spend));
      const kTotal = sumAll(records.map((r) => r.kSpend));
      const gmvTotal = sumAll(records.map((r) => r.gmv));
      const bestRoi = records.filter((r) => r.roi !== null).sort((a, b) => (b.roi || 0) - (a.roi || 0))[0];
      return [
        { label: "四线 FS 消耗合计", value: fsTotal !== null ? fsTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "投流广告支出总和" },
        { label: "四线 K 费用合计", value: kTotal !== null ? kTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "达人发文合作支出" },
        { label: "任务组 GMV 合计", value: gmvTotal !== null ? gmvTotal.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: "各任务组独立产出累加" },
        { label: "最高 ROI 任务组", value: bestRoi?.roi?.toFixed(2) ?? "—", note: bestRoi?.name },
      ];
    }
    if (projectId === "meiling" && activeKey === "cid-daily") {
      const sumRow = activeTable?.rows?.find((r) => isSummary(String(r.date || "")));
      return [
        { label: "CID 3日广告消耗", value: parseNum(sumRow?.spend)?.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) ?? "—", unit: "元", note: "10/16-10/18 纯广告支出" },
        { label: "CID 3日累计 GMV", value: parseNum(sumRow?.gmv)?.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) ?? "—", unit: "元", note: "30日归因成交GMV" },
        { label: "CID 3日累计 ROI", value: parseNum(sumRow?.roi)?.toFixed(2) ?? "—", note: "产出/广告消耗" },
        { label: "CID 累计成交订单", value: parseNum(sumRow?.orders) ?? "—", unit: "笔", note: "店铺成交总单量" },
      ];
    }
    if (targetBulletData.length > 0) {
      const achieved = targetBulletData.filter((d) => (d.direction === "lower" ? (d.actual ?? 0) <= (d.target ?? 0) : (d.actual ?? 0) >= (d.target ?? 0))).length;
      return [
        { label: "考核指标总数", value: targetBulletData.length, unit: "项", note: activeTable?.period || reportPeriod },
        { label: "达成指标项", value: achieved, unit: "项", note: `达成率 ${((achieved / targetBulletData.length) * 100).toFixed(1)}%` },
        { label: "待改进指标项", value: targetBulletData.length - achieved, unit: "项", note: "未达预期标准" },
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
        { label: `${maxSpend?.name || "主力版位"} CPC`, value: maxSpend?.cpc?.toFixed(2) ?? "—", unit: "元", note: `${maxSpend?.name || ""}版位成本` },
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
        { label: "CID 产出比 ROI", value: cidRoi?.value?.toFixed(2) ?? "—", note: "产出/广告消耗" },
      ];
    }
    const totalSpend = sumAll(records.map((r) => r.spend));
    return [
      { label: "当前视图总消耗", value: totalSpend !== null ? totalSpend.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "—", unit: "元", note: activeTable?.period || reportPeriod },
      { label: "有效数据行", value: records.length, unit: "项", note: "排除汇总项" },
      { label: "首项产出比", value: records[0]?.roi?.toFixed(2) ?? "—", note: records[0]?.name },
      { label: "首项点击成本", value: records[0]?.cpc?.toFixed(2) ?? "—", unit: "元", note: records[0]?.name },
    ];
  }, [records, projectId, activeKey, activeTable, kpis, reportPeriod, targetBulletData]);

  const spendChartData = useMemo((): ChartDatum[] => records.filter((r) => r.spend !== null).map((r) => ({ id: r.id, label: r.name, value: r.spend, detail: `消耗: ${r.spend?.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 元${r.ctr ? ` | CTR: ${r.ctr}%` : ""}` })), [records]);

  const scatterPoints = useMemo(() => records.filter((r) => r.cpc !== null && r.ctr !== null).map((r) => ({ label: r.name, x: r.cpc, y: r.ctr, size: r.spend })), [records]);

  const kailasBudgetComparisonData = useMemo((): ComparisonDatum[] => {
    if (projectId !== "kailas" || activeKey !== "budget-lines" || !activeTable?.rows) return [];
    return activeTable.rows.filter((r) => r.line && !isSummary(String(r.line))).map((r) => ({
      label: String(r.line).replace(/\(.*\)/, "").trim(),
      target: parseNum(r.planned),
      actual: parseNum(r.spend),
      unit: "元",
      direction: "lower" as const,
    }));
  }, [projectId, activeKey, activeTable]);

  const meilingCidTrend = useMemo(() => {
    if (projectId !== "meiling" || activeKey !== "cid-daily" || !activeTable?.rows) return [];
    return activeTable.rows
      .filter((r) => r.date && !isSummary(String(r.date)))
      .map((r) => ({
        date: String(r.date),
        spend: parseNum(r.spend),
        activeUv: parseNum(r.activeUv),
      }));
  }, [projectId, activeKey, activeTable]);

  const displayPeriod = activeTable?.period || reportPeriod;
  const halfBullet = Math.ceil(targetBulletData.length / 2);

  return (
    <div className="ca-page">
      <header className="ca-header">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h1 className="ca-header-title">投流分析</h1>
            <span className="ca-header-badge">{projectName}</span>
          </div>
          <p className="ca-header-subtitle">广告消耗结构、点击与转化效率对比及投放指标跟踪</p>
        </div>
        <div className="ca-header-meta">
          <span>业务周期：<strong>{displayPeriod}</strong></span>
          <span>更新时间：<strong>{new Date(updatedAt).toLocaleDateString("zh-CN")}</strong></span>
        </div>
      </header>

      <div className="ca-toolbar">
        <div className="ca-toolbar-group">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ca-palette-muted)" }}>分析视角：</span>
          <select className="ca-toolbar-select" value={activeKey} onChange={(e) => setActiveKey(e.target.value)} aria-label="投流数据视图切换">
            {views.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <MetricStrip items={stripItems} />

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
        ) : meilingCidTrend.length > 0 ? (
          <>
            <ChartPanel
              title="CID 分日投放走势"
              subtitle="30日归因分日走势 (10/16–10/18)"
              actions={
                <div className="ca-toolbar-group">
                  <button type="button" className={`ca-toolbar-btn ${cidMetric === "spend" ? "ca-toolbar-btn-primary" : ""}`} onClick={() => setCidMetric("spend")}>广告消耗 (元)</button>
                  <button type="button" className={`ca-toolbar-btn ${cidMetric === "activeUv" ? "ca-toolbar-btn-primary" : ""}`} onClick={() => setCidMetric("activeUv")}>进店人数 (人)</button>
                </div>
              }
            >
              <TimeSeriesChart
                rows={meilingCidTrend}
                series={cidMetric === "spend" ? [{ key: "spend", label: "广告消耗", color: "#2c7168" }] : [{ key: "activeUv", label: "进店人数", color: "#b88a45" }]}
                unit={cidMetric === "spend" ? "元" : "人"}
                title="CID 分日走势"
                height={190}
              />
            </ChartPanel>
            <ChartPanel title="点击成本与点击率效率分布" subtitle="横轴 CPC (元)，纵轴 CTR (%)，气泡大小代表消耗金额">
              {scatterPoints.length > 0 ? (
                <ScatterChart data={scatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        ) : (
          <>
            <ChartPanel title="投放消耗结构" subtitle={`业务周期：${displayPeriod}`}>
              {spendChartData.length > 0 ? (
                <HorizontalBarChart data={spendChartData} unit="元" height={190} />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无消耗对比数据</span></div>
              )}
            </ChartPanel>
            <ChartPanel title="点击成本与点击率效率分布" subtitle="横轴 CPC (元)，纵轴 CTR (%)，气泡大小代表消耗金额">
              {scatterPoints.length > 0 ? (
                <ScatterChart data={scatterPoints} xLabel="点击成本 CPC (元)" yLabel="点击率 CTR (%)" />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">当前无效率对比坐标</span></div>
              )}
            </ChartPanel>
          </>
        )}
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

