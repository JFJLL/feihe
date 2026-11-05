"use client";

import React, { useState, useMemo } from "react";
import type { CampaignDashboard, CampaignTable } from "../../lib/campaign-types";
import {
  MetricStrip,
  type MetricStripItem,
  ChartPanel,
  HorizontalBarChart,
  DonutChart,
  TargetBulletChart,
  ChartDatum,
  ComparisonDatum,
} from "./CampaignCharts";
import { CampaignEnrichmentPanels } from "./CampaignEnrichmentPanels";
import "./campaign-analytics.css";
import "./CampaignOverviewPage.css";
import "./campaign-content.css";

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
  const [actionFilter, setActionFilter] = useState<"all" | "growth" | "cost">("all");
  const [doneActions, setDoneActions] = useState<Record<string, boolean>>({});

  const tagClassMap: Record<string, string> = {
    "策略调优": "tag-ok",
    "渠道放量": "tag-ok",
    "成本压降": "tag-warn",
    "止损观察": "tag-danger",
    "大促节点": "tag-warn",
  };

  const normalizedActions = useMemo(() => {
    const rawItems = actions?.items || [];
    return rawItems.map((raw, idx) => {
      const title = typeof raw === "string" ? raw : raw.title || "";
      const desc = typeof raw === "object" ? raw.description || "" : "";
      const rawObj = typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const rawTag = rawObj && typeof rawObj.tag === "string" ? rawObj.tag : "";
      const rawDate = rawObj && typeof rawObj.date === "string" ? rawObj.date : "";

      let tag = rawTag;
      let category: "growth" | "cost" | "other" = "other";
      let day = "19";
      const month = "OCT";

      if (/按CPUV|暂停放大|高跑量/i.test(title)) {
        tag = tag || "策略调优";
        category = "cost";
        day = "19";
      } else if (/京东对投|星伴|放量/i.test(title)) {
        tag = tag || "渠道放量";
        category = "growth";
        day = "19";
      } else if (/品类|攻略词|调低/i.test(title)) {
        tag = tag || "成本压降";
        category = "cost";
        day = "18";
      } else if (/高消耗|低ROI|止损|观察/i.test(title)) {
        tag = tag || "止损观察";
        category = "cost";
        day = "18";
      } else if (/天猫|大促|节点|铺量/i.test(title)) {
        tag = tag || "大促节点";
        category = "growth";
        day = "17";
      } else {
        if (/放量|大促|节点|铺量|渠道/.test(title + desc)) {
          tag = tag || "渠道放量";
          category = "growth";
        } else if (/成本|出价|压降|调低/.test(title + desc)) {
          tag = tag || "成本压降";
          category = "cost";
        } else if (/暂停|止损|低ROI|预警/.test(title + desc)) {
          tag = tag || "止损观察";
          category = "cost";
        } else {
          tag = tag || "策略调优";
          category = "other";
        }
        if (rawDate) {
          const match = rawDate.match(/(\d{1,2})$/);
          if (match) day = match[1];
        } else {
          day = String(Math.max(1, 19 - idx));
        }
      }

      if (category === "other") {
        if (tag === "渠道放量" || tag === "大促节点") category = "growth";
        else if (tag === "成本压降" || tag === "止损观察" || tag === "策略调优") category = "cost";
      }

      const tagClass = tagClassMap[tag] || "tag-neutral";
      const id = (rawObj && typeof rawObj.id === "string" ? rawObj.id : null) || `act-${idx}`;
      return { id, title, description: desc, tag, tagClass, month, day, category };
    });
  }, [actions]);

  const filteredActions = useMemo(() => {
    if (actionFilter === "growth") return normalizedActions.filter((a) => a.category === "growth");
    if (actionFilter === "cost") return normalizedActions.filter((a) => a.category === "cost");
    return normalizedActions;
  }, [normalizedActions, actionFilter]);

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

  const stripItems = useMemo((): MetricStripItem[] => {
    let rawItems: MetricStripItem[];
    if (projectId === "meiling") {
      const rate = meilingTotal !== null && meilingTotal > 0 && meilingPublished !== null
        ? ((meilingPublished / meilingTotal) * 100).toFixed(1)
        : "—";
      rawItems = [
        { label: "确认合作达人总数", value: meilingTotal ?? "—", unit: "位", note: "基准确认达人总数", badge: "合作达人" },
        { label: "已发布上线", value: meilingPublished ?? "—", unit: "位", note: `同口径占比 ${rate}%`, badge: "已上线" },
        { label: "待品牌审核", value: meilingBrandReview ?? "—", unit: "位", note: "等待品牌终审环节", badge: "待审核" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod, badge: "动作清单" },
      ];
    } else if (projectId === "kailas") {
      const actual = kailasKpi?.value !== undefined ? kailasKpi.value : null;
      const target = kailasKpi?.target !== undefined ? kailasKpi.target : null;
      const pending = target !== null && actual !== null ? Math.max(0, target - actual) : null;
      const rate = target !== null && target > 0 && actual !== null ? ((actual / target) * 100).toFixed(1) : "—";
      rawItems = [
        { label: "规划发布目标", value: target ?? "—", unit: "篇", note: "Q3 阶段双周会计划", badge: "发布目标" },
        { label: "实际已发布", value: actual ?? "—", unit: "篇", note: `截至9.27 达成率 ${rate}%`, badge: "实际发布" },
        { label: "待推进上线", value: pending ?? "—", unit: "篇", note: "剩余排期执行", badge: "待推进" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod, badge: "动作清单" },
      ];
    } else if (projectId === "winner-wipes") {
      const { total, kol, koc } = wipesCounts;
      rawItems = [
        { label: "全量已发布篇数", value: total ?? "—", unit: "篇", note: "周报统计发布总量", badge: "全量发布" },
        { label: "KOL 达人发布", value: kol ?? "—", unit: "篇", note: "核心种草达人", badge: "KOL矩阵" },
        { label: "KOC 达人发布", value: koc ?? "—", unit: "篇", note: "长尾矩阵达人", badge: "KOC矩阵" },
        { label: "日报记录动作", value: actions?.items?.length || 0, unit: "项", note: reportPeriod, badge: "动作清单" },
      ];
    } else {
      rawItems = [
        { label: "执行表格数", value: tables.length, unit: "张", note: "关联数据源", badge: "数据源" },
        { label: "待办动作数", value: actions?.items?.length || 0, unit: "项", note: reportPeriod, badge: "动作清单" },
        { label: "业务监测点", value: kpis.length, unit: "项", note: "核心考核指标", badge: "监测节点" },
        { label: "统计周期天数", value: reportPeriod ? 1 : 0, unit: "期", note: reportPeriod, badge: "执行周期" },
      ];
    }

    const defaultBadges = ["品牌", "引流", "商销", "达人"] as const;
    return rawItems.map((item, idx) => ({
      ...item,
      badge: item.badge || defaultBadges[idx % 4],
      category: (["brand", "cid", "commerce", "creators"] as const)[idx % 4],
    }));
  }, [projectId, meilingTotal, meilingPublished, meilingBrandReview, actions, kailasKpi, wipesCounts, tables, reportPeriod, kpis]);

  const activeTable = useMemo((): CampaignTable | undefined => {
    if (projectId === "meiling") return distTab === "platform" ? meilingSpilloverTable : meilingProductTable;
    if (projectId === "kailas") return kailasTable;
    if (projectId === "winner-wipes") return wipesProgressTable;
    return tables[0];
  }, [projectId, distTab, meilingSpilloverTable, meilingProductTable, wipesProgressTable, kailasTable, tables]);

  const displayPeriod = activeTable?.period || reportPeriod;

  return (
    <div
      className="ca-page"
      data-project-id={projectId}
      data-source-file={`projects/${projectId}/transform.ts`}
      data-section-id="campaign-content-page"
    >
      <header className="ca-header bd-toolbar-compact">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">内容管理</h2>
            <span className="ca-header-period-pill" style={{ fontSize: "12px", color: "#60646c", background: "#f9f9fb", border: "0.5px solid #d9d9e0", padding: "2px 8px", borderRadius: "4px" }}>
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

      {/* 达人执行漏斗与发布结构大卡片 (24px padding, 28px间距) */}
      <div className="ca-section-macro-card">
        <MetricStrip items={stripItems} />

        {/* 01 章节头: 达人执行漏斗与发布结构 */}
        <div className="ca-chapter-header">
          <div className="ca-chapter-title-group">
            <span className="ca-chapter-badge">01</span>
            <div className="ca-chapter-heading">
              <h2 className="ca-chapter-title">达人执行漏斗与发布结构</h2>
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

        {/* 凯乐石专属: 左右双栏 (6:6 Bento 对称布局) */}
        {projectId === "kailas" && (
          <div className="ca-grid">
            <ChartPanel title="Q3 笔记全量发布进度" subtitle="Q3 阶段双周会小结（截至9.27）规划目标对照">
              <TargetBulletChart data={kailasBulletData} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px dashed var(--border-subtle, #E6E3DC)",
                }}
              >
                <div
                  style={{
                    background: "var(--bg-subtle, #FAF9F5)",
                    border: "1px solid var(--border-subtle, #E6E3DC)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>已发布实绩</span>
                  <strong className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--brand-primary, #0F5E52)" }}>
                    59 <small style={{ fontSize: 11, fontWeight: 500, color: "#8A847C" }}>/ 70篇</small>
                  </strong>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted, #8A847C)" }}>截至9.27双周会小结</span>
                </div>
                <div
                  style={{
                    background: "var(--bg-subtle, #FAF9F5)",
                    border: "1px solid var(--border-subtle, #E6E3DC)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>目标达成率</span>
                  <strong className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-quaternary, #C87D20)" }}>
                    84.3%
                  </strong>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted, #8A847C)" }}>待发布储备 11 篇</span>
                </div>
                <div
                  style={{
                    background: "var(--bg-subtle, #FAF9F5)",
                    border: "1px solid var(--border-subtle, #E6E3DC)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>合作总金额</span>
                  <strong className="num" style={{ fontSize: 18, fontWeight: 800, color: "#1C1917" }}>
                    ¥540,500
                  </strong>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted, #8A847C)" }}>篇均采买 ¥7,721</span>
                </div>
              </div>
            </ChartPanel>

            <ChartPanel title="达人选号流转漏斗与方向配比" subtitle="初筛池、复筛池、执行表登记与三大内容方向构成">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <div style={{ background: "var(--bg-subtle, #FAF9F5)", border: "1px solid var(--border-subtle, #E6E3DC)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ height: 4, background: "var(--border-subtle, #E6E3DC)", borderRadius: 999, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ width: "100%", height: "100%", background: "var(--brand-primary, #0F5E52)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>01 初筛候选池</span>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #1C1917)", margin: "3px 0" }}>1,530<small style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-muted, #8A847C)", marginLeft: 2 }}>位</small></div>
                  <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "rgba(15, 94, 82, 0.1)", color: "var(--brand-primary, #0F5E52)" }}>独立海选池</span>
                  </div>
                </div>

                <div style={{ background: "var(--bg-subtle, #FAF9F5)", border: "1px solid var(--border-subtle, #E6E3DC)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ height: 4, background: "var(--border-subtle, #E6E3DC)", borderRadius: 999, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ width: "68%", height: "100%", background: "var(--accent-tertiary, #2A6F97)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>02 复筛评估池</span>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #1C1917)", margin: "3px 0" }}>615<small style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-muted, #8A847C)", marginLeft: 2 }}>位</small></div>
                  <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "rgba(42, 111, 151, 0.1)", color: "var(--accent-tertiary, #2A6F97)" }}>评估池 40.2%</span>
                  </div>
                </div>

                <div style={{ background: "var(--bg-subtle, #FAF9F5)", border: "1px solid var(--border-subtle, #E6E3DC)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ height: 4, background: "var(--border-subtle, #E6E3DC)", borderRadius: 999, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ width: "42%", height: "100%", background: "var(--accent-quaternary, #C87D20)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>03 签约合作登记</span>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #1C1917)", margin: "3px 0" }}>70<small style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-muted, #8A847C)", marginLeft: 2 }}>篇</small></div>
                  <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "rgba(200, 125, 32, 0.12)", color: "var(--accent-quaternary, #C87D20)" }}>录用比 11.4%</span>
                  </div>
                </div>

                <div style={{ background: "var(--bg-subtle, #FAF9F5)", border: "1px solid var(--border-subtle, #E6E3DC)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ height: 4, background: "var(--border-subtle, #E6E3DC)", borderRadius: 999, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ width: "30%", height: "100%", background: "var(--accent-secondary, #D95D39)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>04 已发布上线</span>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #1C1917)", margin: "3px 0" }}>59<small style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-muted, #8A847C)", marginLeft: 2 }}>篇</small></div>
                  <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "rgba(217, 93, 57, 0.12)", color: "var(--accent-secondary, #D95D39)" }}>履约率 84.3%</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, background: "var(--bg-subtle, #FAF9F5)", border: "1px solid var(--border-subtle, #E6E3DC)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--text-primary, #1C1917)", marginBottom: 8 }}>
                  <span>三大内容方向签约配比（共 70 篇 / ¥54.05w）</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary, #6B655B)" }}>履约发布 59 篇</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, overflow: "hidden", display: "flex", background: "var(--border-subtle, #E6E3DC)", marginBottom: 8 }}>
                  <div style={{ width: "45.7%", background: "var(--brand-primary, #0F5E52)" }} title="时尚穿搭 45.7% (32篇)" />
                  <div style={{ width: "32.9%", background: "var(--accent-tertiary, #2A6F97)" }} title="跑山专业 32.9% (23篇)" />
                  <div style={{ width: "21.4%", background: "var(--accent-quaternary, #C87D20)" }} title="街头采访 21.4% (15篇)" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11, color: "var(--text-secondary, #6B655B)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-primary, #0F5E52)", flexShrink: 0 }} />
                    <span>时尚穿搭 <b>32篇</b> (45.7%) · ¥24.7w</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-tertiary, #2A6F97)", flexShrink: 0 }} />
                    <span>跑山专业 <b>23篇</b> (32.9%) · ¥17.8w</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-quaternary, #C87D20)", flexShrink: 0 }} />
                    <span>街头采访 <b>15篇</b> (21.4%) · ¥11.55w</span>
                  </div>
                </div>
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
            <ChartPanel title="内容效果目标对照" subtitle="底表快照 / 统计截止未注明">
              {wipesContentBulletData.length > 0 ? (
                <TargetBulletChart data={wipesContentBulletData} />
              ) : (
                <div className="ca-empty"><span className="ca-empty-title">暂无效果对照指标</span></div>
              )}
            </ChartPanel>
          </div>
        )}
      </div>

      <div id="ca-content-enrichment-slot" className="ca-content-enrichment-slot">
        <CampaignEnrichmentPanels dashboard={dashboard} section="content" />
      </div>

      {/* 日报动作记录 (展示原文日期与规划事项，不伪装实时任务执行状态) */}
      {normalizedActions.length > 0 && (
      <div className="ca-panel ca-section-macro-card">
        <div className="ca-panel-header">
          <div className="ca-panel-heading">
            <h3 className="ca-panel-title">
              <i className="fa-solid fa-clock-rotate-left" style={{ color: "#D95D39", marginRight: 8 }}></i>
              {projectId === "meiling" ? "美菱无霜冰箱 · 投流操盘调优动作日志 (Action Log)" : "投流与内容操盘调优动作日志 (Action Log)"}
            </h3>
            <p className="ca-panel-subtitle">
              记录周期：{reportPeriod} / 摘录自业务日报规划事项（支持分类切换与勾选完成归档）
            </p>
          </div>
          <div className="segmented-tabs" id="meilingFilterTabs" role="tablist">
            <button
              type="button"
              className={`seg-btn ${actionFilter === "all" ? "active" : ""}`}
              onClick={() => setActionFilter("all")}
            >
              全部动作 ({normalizedActions.length})
            </button>
            <button
              type="button"
              className={`seg-btn ${actionFilter === "growth" ? "active" : ""}`}
              onClick={() => setActionFilter("growth")}
            >
              放量与大促节点
            </button>
            <button
              type="button"
              className={`seg-btn ${actionFilter === "cost" ? "active" : ""}`}
              onClick={() => setActionFilter("cost")}
            >
              压降成本与止损
            </button>
          </div>
        </div>
        <div className="ca-panel-body">
          <div className="timeline-list" id="meilingTimelineList">
            {filteredActions.map((act) => {
              const isDone = Boolean(doneActions[act.id]);
              return (
                <label key={act.id} className={`timeline-item ${isDone ? "done" : ""}`}>
                  <input
                    type="checkbox"
                    className="tl-check"
                    checked={isDone}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDoneActions((prev) => ({ ...prev, [act.id]: checked }));
                    }}
                  />
                  <div className="tl-date-box">
                    <div className="d-month">{act.month}</div>
                    <div className="d-day num">{act.day}</div>
                  </div>
                  <div className="tl-content">
                    <div className="tl-head">
                      <span className="tl-title">{act.title}</span>
                      <span className={`semantic-tag ${act.tagClass}`}>{act.tag}</span>
                    </div>
                    {act.description && <div className="tl-desc">{act.description}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      )}

      <div className="ca-panel ca-section-macro-card">
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
