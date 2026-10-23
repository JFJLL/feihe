"use client";

import React, { useState, useMemo } from "react";
import type { CampaignDashboard, CampaignTable } from "../../lib/campaign-types";
import {
  MetricStrip,
  ChartPanel,
  HorizontalBarChart,
  DonutChart,
  TargetBulletChart,
  ChartDatum,
  ComparisonDatum,
} from "./CampaignCharts";
import { CampaignEnrichmentPanels } from "./CampaignEnrichmentPanels";
import "./campaign-analytics.css";

export interface CampaignContentPageProps {
  dashboard: CampaignDashboard;
}

const isSummary = (s: string) => /(汇总|总计|合计)/.test(s);
const cleanTitle = (s: string) => s.replace(/\s*\([a-zA-Z0-9_-]+\)\s*$/, "").trim();

const parseNum = (v: unknown): number | null => {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const clean = v.replace(/[^\d]/g, "").trim();
    if (!clean) return null;
    const n = parseInt(clean, 10);
    return isNaN(n) ? null : n;
  }
  return null;
};

export function CampaignContentPage({ dashboard }: CampaignContentPageProps) {
  const { projectId, tables, kpis, actions, reportPeriod, updatedAt } = dashboard;
  const [distTab, setDistTab] = useState<"platform" | "product">("platform");
  const [showTable, setShowTable] = useState<boolean>(false);

  const meilingStatusTable = useMemo(() => tables.find((t) => t.id === "meiling-online-execution-status"), [tables]);
  const meilingSpilloverTable = useMemo(() => tables.find((t) => t.id === "meiling-online-spillover-distribution"), [tables]);
  const meilingProductTable = useMemo(() => tables.find((t) => t.id === "meiling-online-product-distribution"), [tables]);
  const wipesProgressTable = useMemo(() => tables.find((t) => t.id === "wipes-execution-progress-table"), [tables]);
  const kailasTable = useMemo(() => tables.find((t) => t.id === "kailas-unlocked-budget-ZpT73Q"), [tables]);

  const meilingStages = useMemo(() => {
    if (!meilingStatusTable?.rows) return [];
    return meilingStatusTable.rows
      .filter((r) => r.stage && !isSummary(String(r.stage)))
      .map((r) => ({
        stage: String(r.stage),
        count: parseNum(r.count),
        ratio: String(r.ratio || ""),
      }));
  }, [meilingStatusTable]);

  const meilingTotal = useMemo(() => {
    const sumRow = meilingStatusTable?.rows?.find((r) => isSummary(String(r.stage || "")));
    const parsedSum = parseNum(sumRow?.count);
    if (parsedSum !== null) return parsedSum;
    const counts = meilingStages.map((s) => s.count);
    if (counts.some((c) => c === null)) return null;
    return (counts as number[]).reduce((a, b) => a + b, 0);
  }, [meilingStatusTable, meilingStages]);

  const meilingPublished = useMemo(() => {
    return meilingStages.find((s) => s.stage === "已发布")?.count ?? null;
  }, [meilingStages]);

  const meilingBrandReview = useMemo(() => {
    return meilingStages.find((s) => s.stage === "品牌审核中")?.count ?? null;
  }, [meilingStages]);

  const meilingStageChartData = useMemo((): ChartDatum[] => {
    return meilingStages.map((s) => ({
      id: s.stage,
      label: s.stage,
      value: s.count,
      detail: s.count !== null ? `${s.count} 位 (${s.ratio})` : "—",
    }));
  }, [meilingStages]);

  const meilingPlatformData = useMemo((): ChartDatum[] => {
    if (!meilingSpilloverTable?.rows) return [];
    return meilingSpilloverTable.rows
      .filter((r) => r.platform && !isSummary(String(r.platform)))
      .map((r) => ({
        id: String(r.platform),
        label: String(r.platform),
        value: parseNum(r.count),
        detail: r.count !== null ? `${r.count} 位 (${r.ratio || ""})` : "—",
      }));
  }, [meilingSpilloverTable]);

  const meilingProductData = useMemo((): ChartDatum[] => {
    if (!meilingProductTable?.rows) return [];
    return meilingProductTable.rows
      .filter((r) => r.productGroup && !isSummary(String(r.productGroup)))
      .map((r) => ({
        id: String(r.productGroup),
        label: String(r.productGroup).replace(" 系列", ""),
        value: parseNum(r.count),
        detail: r.count !== null ? `${r.count} 位 (${r.ratio || ""})` : "—",
      }));
  }, [meilingProductTable]);

  const kailasKpi = useMemo(() => kpis.find((k) => k.id === "kailas-unlocked-kpi-publish"), [kpis]);

  const kailasBulletData = useMemo((): ComparisonDatum[] => {
    if (!kailasKpi) return [];
    return [
      {
        label: kailasKpi.label || "笔记发布量",
        actual: kailasKpi.value !== undefined ? kailasKpi.value : null,
        target: kailasKpi.target !== undefined ? kailasKpi.target : null,
        unit: kailasKpi.unit || "篇",
        direction: "higher",
        comparison: kailasKpi.comparison,
      },
    ];
  }, [kailasKpi]);

  const wipesCounts = useMemo(() => {
    if (!wipesProgressTable?.rows) return { total: null, kol: null, koc: null };
    let total: number | null = null, kol: number | null = null, koc: number | null = null;
    for (const r of wipesProgressTable.rows) {
      const metric = String(r.metric || "");
      const val = parseNum(r.publishedCount);
      if (metric.includes("全量")) total = val;
      else if (metric.includes("KOL")) kol = val;
      else if (metric.includes("KOC")) koc = val;
    }
    return { total, kol, koc };
  }, [wipesProgressTable]);

  const wipesDonutData = useMemo((): ChartDatum[] => {
    const { kol, koc } = wipesCounts;
    if (kol === null && koc === null) return [];
    return [
      { id: "kol", label: "KOL 矩阵达人", value: kol, color: "var(--ca-palette-primary)", detail: `${kol} 篇` },
      { id: "koc", label: "KOC 矩阵达人", value: koc, color: "var(--ca-palette-purple)", detail: `${koc} 篇` },
    ];
  }, [wipesCounts]);

  // 稳健湿巾内容 KPI 目标对照 (日常爆文率与医生专家曝光/互动/成本)
  const wipesContentBulletData = useMemo((): ComparisonDatum[] => {
    const targetIds = [
      "wipes-online-daily-hit-rate",
      "wipes-online-doc-exposure",
      "wipes-online-doc-interaction",
      "wipes-online-doc-cpe",
    ];
    return targetIds
      .map((id) => kpis.find((k) => k.id === id))
      .filter((k): k is NonNullable<typeof k> => Boolean(k && k.target !== null && k.value !== null))
      .map((k) => ({
        label: k.label.replace(/^.*?·\s*/, ""),
        actual: k.value,
        target: k.target,
        unit: k.unit,
        direction: k.direction,
        comparison: k.comparison,
      }));
  }, [kpis]);

  const stripItems = useMemo(() => {
    if (projectId === "meiling") {
      const rate = meilingTotal !== null && meilingTotal > 0 && meilingPublished !== null
        ? ((meilingPublished / meilingTotal) * 100).toFixed(1)
        : "—";
      return [
        { label: "二核确认母集", value: meilingTotal ?? "—", unit: "位", note: "基准确认达人总数" },
        { label: "已发布上线", value: meilingPublished ?? "—", unit: "位", note: `同口径占比 ${rate}%` },
        { label: "待品牌审核", value: meilingBrandReview ?? "—", unit: "位", note: "等待品牌终审环节" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod },
      ];
    }
    if (projectId === "kailas") {
      const actual = kailasKpi?.value !== undefined ? kailasKpi.value : null;
      const target = kailasKpi?.target !== undefined ? kailasKpi.target : null;
      const pending = target !== null && actual !== null ? Math.max(0, target - actual) : null;
      const rate = target !== null && target > 0 && actual !== null ? ((actual / target) * 100).toFixed(1) : "—";
      return [
        { label: "规划发布目标", value: target ?? "—", unit: "篇", note: "Q3 阶段双周会计划" },
        { label: "实际已发布", value: actual ?? "—", unit: "篇", note: `截至9.27 达成率 ${rate}%` },
        { label: "待推进上线", value: pending ?? "—", unit: "篇", note: "剩余排期执行" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod },
      ];
    }
    if (projectId === "winner-wipes") {
      const { total, kol, koc } = wipesCounts;
      return [
        { label: "全量已发布篇数", value: total ?? "—", unit: "篇", note: "周报统计发布总量" },
        { label: "KOL 达人发布", value: kol ?? "—", unit: "篇", note: "核心种草达人" },
        { label: "KOC 达人发布", value: koc ?? "—", unit: "篇", note: "长尾矩阵达人" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod },
      ];
    }
    return [
      { label: "执行表格数", value: tables.length, unit: "张", note: "关联数据源" },
      { label: "待办动作数", value: actions?.items?.length || 0, unit: "项", note: reportPeriod },
    ];
  }, [projectId, meilingTotal, meilingPublished, meilingBrandReview, actions, kailasKpi, wipesCounts, tables, reportPeriod]);

  const activeTable = useMemo((): CampaignTable | undefined => {
    if (projectId === "meiling") return distTab === "platform" ? meilingSpilloverTable : meilingProductTable;
    if (projectId === "kailas") return kailasTable;
    if (projectId === "winner-wipes") return wipesProgressTable;
    return tables[0];
  }, [projectId, distTab, meilingSpilloverTable, meilingProductTable, wipesProgressTable, kailasTable, tables]);

  const displayPeriod = activeTable?.period || reportPeriod;

  return (
    <div className="ca-page">
      <header className="ca-header bd-toolbar-compact">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">内容管理</h2>
            <span className="ca-header-badge">内容看板</span>
            <span className="ca-header-period-pill" style={{ fontSize: "11px", color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "4px" }}>
              统计周期：{displayPeriod}
            </span>
          </div>
          <span className="ca-header-subtitle">达人制作、流转库存分布、产品及渠道归属与业务行动清单</span>
        </div>
        <div className="ca-header-meta">
          <span>业务周期：<strong>{displayPeriod}</strong></span>
          <span>更新时间：<strong>{new Date(updatedAt).toLocaleDateString("zh-CN")}</strong></span>
        </div>
      </header>

      <MetricStrip items={stripItems} />

      {/* 01 章节头: 达人执行漏斗与发布结构 */}
      <div className="ca-chapter-header">
        <div className="ca-chapter-title-group">
          <span className="ca-chapter-badge">01</span>
          <div className="ca-chapter-heading">
            <h3 className="ca-chapter-title">达人执行漏斗与发布结构</h3>
            <span className="ca-chapter-desc">达人履约流转节点、内容矩阵配比与发布目标达成跟踪</span>
          </div>
        </div>
        <div className="ca-chapter-meta">
          <span className="ca-chapter-period-tag">统计周期：{displayPeriod}</span>
        </div>
      </div>

      {/* 美菱专属: 环节库存柱图 + 平台/产品分布 */}
      {projectId === "meiling" && (
        <div className="ca-grid">
          <ChartPanel title="各执行环节达人库存分布" subtitle="反映当前各流转节点滞留量（单位：位）">
            {meilingStageChartData.length > 0 ? (
              <HorizontalBarChart data={meilingStageChartData} unit="位" height={220} />
            ) : (
              <div className="ca-empty"><span className="ca-empty-title">暂无环节分布数据</span></div>
            )}
          </ChartPanel>
          <ChartPanel
            title={distTab === "platform" ? "外溢回流平台分布" : "主推产品型号分布"}
            subtitle="二核确认达人对应推广目标统计（单位：位）"
            actions={
              <div className="ca-toolbar-group">
                <button type="button" className={`ca-toolbar-btn ${distTab === "platform" ? "ca-toolbar-btn-primary" : ""}`} onClick={() => setDistTab("platform")}>平台</button>
                <button type="button" className={`ca-toolbar-btn ${distTab === "product" ? "ca-toolbar-btn-primary" : ""}`} onClick={() => setDistTab("product")}>产品</button>
              </div>
            }
          >
            <DonutChart
              data={distTab === "platform" ? meilingPlatformData : meilingProductData}
              unit="位"
              centerLabel={distTab === "platform" ? "平台分布" : "产品分布"}
            />
          </ChartPanel>
        </div>
      )}

      {/* 凯乐石专属: 单一全宽发布进度图 (不硬凑第二图) */}
      {projectId === "kailas" && (
        <div className="ca-grid-wide">
          <ChartPanel title="Q3 笔记全量发布进度" subtitle="Q3 阶段双周会小结（截至9.27）规划目标对照">
            <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>
              <TargetBulletChart data={kailasBulletData} />
            </div>
          </ChartPanel>
        </div>
      )}

      {/* 稳健湿巾专属: 发布构成 + 内容效果目标对照 (医生曝光未达标可见) */}
      {projectId === "winner-wipes" && (
        <div className="ca-grid">
          <ChartPanel title="达人矩阵发布结构" subtitle="KOL 与 KOC 细分占比">
            <DonutChart data={wipesDonutData} unit="篇" centerLabel={wipesCounts.total ? `共${wipesCounts.total}篇` : undefined} />
          </ChartPanel>
          <ChartPanel title="内容效果目标对照" subtitle="底表快照 · 统计截止未注明">
            {wipesContentBulletData.length > 0 ? (
              <TargetBulletChart data={wipesContentBulletData} />
            ) : (
              <div className="ca-empty"><span className="ca-empty-title">暂无效果对照指标</span></div>
            )}
          </ChartPanel>
        </div>
      )}

      <div id="ca-content-enrichment-slot" className="ca-content-enrichment-slot">
        <CampaignEnrichmentPanels dashboard={dashboard} section="content" />
      </div>

      {/* 日报动作记录 (展示原文日期与规划事项，不伪装实时任务执行状态) */}
      <div className="ca-panel">
        <div className="ca-panel-header">
          <div className="ca-panel-heading">
            <h3 className="ca-panel-title">日报动作记录</h3>
            <p className="ca-panel-subtitle">
              记录周期：{reportPeriod} · 摘录自业务日报规划事项（非任务流实时工单）
            </p>
          </div>
          <span className="ca-header-badge">共 {actions?.items?.length || 0} 项</span>
        </div>
        <div className="ca-panel-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(actions?.items || []).map((raw, idx) => {
              const title = typeof raw === "string" ? raw : raw.title || "";
              const desc = typeof raw === "object" ? raw.description || "" : "";
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--ca-palette-border)", borderRadius: "6px", gap: "2px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ca-palette-text)" }}>{title}</span>
                  {desc && <span style={{ fontSize: "11.5px", color: "var(--ca-palette-muted)", lineHeight: 1.4 }}>{desc}</span>}
                </div>
              );
            })}
          </div>
        </div>
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
