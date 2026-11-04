"use client";

import React, { useMemo, useCallback, useSyncExternalStore, useState, useEffect } from "react";
import type { CampaignDashboard } from "../../lib/campaign-types";
import { DayNavigator } from "../../components/ui/DayNavigator";
import { MetricStrip, ChartPanel, HealthArcGauge, ExecutiveBulletCard } from "./CampaignCharts";
import { CampaignComboChart, type ComboSeries } from "./CampaignComboChart";
import { CustomSelect } from "../../components/ui/CustomSelect";
import {
  resolveDailyDatasets,
  fmtNum,
  fmtPct,
  CAMPAIGN_PALETTE,
  buildCalendarRows,
} from "./campaign-daily-model";
import {
  getSingleDayKPIs,
  getSingleDayDistributions,
  getCrossDatasetDailyComparison,
  isValidIsoDate,
  buildDailyRichContext,
} from "./daily-selection-model";
import { CampaignDailyDiagnostics } from "./CampaignDailyDiagnostics";
import "./campaign-analytics.css";
import "./campaign-combo.css";
import "./campaign-daily.css";
import "./CampaignDailyPage.css";

/**
 * Multi-Tone Editorial & Botanical Accents (5-color palette from ai_studio_code.html)
 */
export const AI_STUDIO_PALETTE = {
  pine: "#0F5E52",        // Pine
  terracotta: "#D95D39",  // Terracotta
  mineralBlue: "#2E6F8E", // Mineral Blue
  harvestOchre: "#C87D20",// Harvest Ochre
  sage: "#5B8266",        // Sage
} as const;

export const AI_STUDIO_COLOR_ARRAY = [
  AI_STUDIO_PALETTE.pine,
  AI_STUDIO_PALETTE.terracotta,
  AI_STUDIO_PALETTE.mineralBlue,
  AI_STUDIO_PALETTE.harvestOchre,
  AI_STUDIO_PALETTE.sage,
];

export interface CampaignDailyPageProps {
  dashboard: CampaignDashboard;
}

export function normalizeDatasetLabel(label: string): string {
  if (!label) return "";
  return label.replace(/\s*[·•・]\s*/g, " / ").trim();
}

export function formatDatasetDisplay(id: string, fallback: string): string {
  if (id === "meiling-daily-tm-seed") return "自采天猫种草";
  if (id === "meiling-daily-cid-jd" || id === "meiling-cid-daily-fallback") return "京东对投 CID";
  if (id === "meiling-daily-jd-seed") return "自采京东种草";
  if (id === "wipes-daily-delivery") return "日常种草";
  if (id === "wipes-daily-taosou" || id === "wipes-daily-taosearch") return "淘搜表现";
  if (id === "kailas-daily-fuga-creatives") return "凯乐石日常投放";
  return normalizeDatasetLabel(fallback);
}

function subscribeToUrl(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", callback);
  window.addEventListener("app:context-change", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("app:context-change", callback);
  };
}

function getUrlSearchSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function getServerUrlSearchSnapshot(): string {
  return "";
}

export function CampaignDailyPage({ dashboard }: CampaignDailyPageProps) {
  const name = dashboard?.name || "项目";
  const datasets = useMemo(() => (dashboard ? resolveDailyDatasets(dashboard) : []), [dashboard]);


  // Reactive URL search store: guarantees SSR/hydration compatibility and listens to back/forward
  const urlSearch = useSyncExternalStore(subscribeToUrl, getUrlSearchSnapshot, getServerUrlSearchSnapshot);
  const searchParams = useMemo(() => {
    if (typeof URLSearchParams !== "undefined") {
      return new URLSearchParams(urlSearch);
    }
    return { get: () => null } as unknown as URLSearchParams;
  }, [urlSearch]);
  const urlDayRaw = searchParams.get("day");
  const urlDay = urlDayRaw && isValidIsoDate(urlDayRaw) ? urlDayRaw : null;
  const urlDataset = searchParams.get("dataset") || null;

  // Active dataset derived from URL
  const activeDataset = useMemo(() => {
    if (!datasets.length) return null;
    if (urlDataset) {
      const match = datasets.find((d) => d.id === urlDataset);
      if (match) return match;
    }
    return datasets[0];
  }, [datasets, urlDataset]);

  // Available dates for active dataset
  const allAvailableDates = useMemo(() => {
    if (!activeDataset?.rows) return [];
    return activeDataset.rows
      .map((r) => r.date)
      .filter(Boolean)
      .sort();
  }, [activeDataset]);

  const minAvailableDate = allAvailableDates[0] || "";
  const maxAvailableDate = allAvailableDates[allAvailableDates.length - 1] || "";

  // Selected date: strictly adheres to URL if valid, otherwise falls back to latest observed day
  const selectedDate = urlDay !== null ? urlDay : maxAvailableDate;

  // URL state updater (pushes state and triggers context change event for reactive sync)
  const updateUrl = useCallback(
    (patch: { day?: string; dataset?: string }) => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (patch.day !== undefined) {
          if (patch.day) url.searchParams.set("day", patch.day);
          else url.searchParams.delete("day");
        }
        if (patch.dataset !== undefined) {
          if (patch.dataset) url.searchParams.set("dataset", patch.dataset);
          else url.searchParams.delete("dataset");
        }
        window.history.pushState(window.history.state, "", url);
        const ctx = {
          projectId: dashboard?.projectId,
          day: patch.day !== undefined ? patch.day : url.searchParams.get("day") || "",
          dataset: patch.dataset !== undefined ? patch.dataset : url.searchParams.get("dataset") || "",
          tab: "daily",
        };
        (window as unknown as { __ACTIVE_AGENT_CONTEXT__?: typeof ctx }).__ACTIVE_AGENT_CONTEXT__ = ctx;
        window.dispatchEvent(new CustomEvent("app:context-change", { detail: ctx }));
      } catch {
        // ignore history push errors
      }
    },
    [dashboard]
  );

  // Active row on the selected date
  const selectedRow = useMemo(() => {
    if (!activeDataset?.rows || !selectedDate) return null;
    return activeDataset.rows.find((r) => r.date === selectedDate) || null;
  }, [activeDataset, selectedDate]);

  const isDateMissing = !selectedRow;

  // Rich Analytical computed context (Benchmarks, Executive Diagnosis, Efficiency benchmarks, Traffic funnel, Feishu drilldowns)
  const richContext = useMemo(() => {
    if (!dashboard || !activeDataset || !selectedDate) return null;
    return buildDailyRichContext(dashboard, activeDataset, selectedDate);
  }, [dashboard, activeDataset, selectedDate]);

  const availableFeishuTabs = useMemo(() => {
    const list: Array<{ id: "keywords" | "audiences" | "actions"; label: string }> = [];
    const d = richContext?.feishuDrilldowns;
    if (d?.taosouDailyKeywords?.length || d?.searchKeywords?.length) {
      list.push({ id: "keywords", label: "搜索词与淘搜" });
    }
    if (d?.audiencePackages?.length) {
      list.push({ id: "audiences", label: "定向人群包" });
    }
    if (d?.actionItems?.length) {
      list.push({ id: "actions", label: "业务日报动作" });
    }
    return list;
  }, [richContext?.feishuDrilldowns]);

  const [feishuTab, setFeishuTab] = useState<"keywords" | "audiences" | "actions">("keywords");

  useEffect(() => {
    if (availableFeishuTabs.length > 0 && !availableFeishuTabs.some(t => t.id === feishuTab)) {
      setFeishuTab(availableFeishuTabs[0].id);
    }
  }, [availableFeishuTabs, feishuTab]);

  // Calendar rows for diagnostic module (safely handles gaps and cumulative pacing)
  const diagCalendarRows = useMemo(() => {
    if (!activeDataset || !minAvailableDate || !maxAvailableDate) return [];
    return buildCalendarRows(activeDataset, minAvailableDate, maxAvailableDate);
  }, [activeDataset, minAvailableDate, maxAvailableDate]);

  // Previous Day spend for pure DoD daily pacing
  const prevDaySpend = useMemo(() => {
    if (!activeDataset || !selectedDate) return null;
    const earlier = [...activeDataset.rows]
      .filter((r) => r.date && String(r.date) < selectedDate)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!earlier.length) return null;
    const prevRow = earlier[0] as Record<string, unknown>;
    const val = Number(prevRow.spend || prevRow.spend_total || 0);
    return Number.isFinite(val) && val > 0 ? val : null;
  }, [activeDataset, selectedDate]);

  // Selected Day Core KPIs with Day-over-Day comparisons
  const summaryMetrics = useMemo(() => {
    if (!activeDataset || !selectedDate) return [];
    const baseMetrics = getSingleDayKPIs(activeDataset, selectedDate);
    const rotatingCategories = ['brand', 'cid', 'commerce', 'creators', 'brand', 'cid'] as const;
    if (!activeDataset.rows || activeDataset.rows.length === 0) {
      return baseMetrics.map((m, idx) => ({
        ...m,
        category: rotatingCategories[idx % 6],
      }));
    }

    const sortedRows = [...activeDataset.rows]
      .filter((r) => r.date && String(r.date) <= selectedDate)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const recentObserved = sortedRows.slice(-7);

    return baseMetrics.map((m, idx) => {
      let key = "spend";
      if (m.label.includes("消耗") || m.label.includes("花费") || m.label.includes("支出")) {
        key = activeDataset.id.includes("taosou") ? "spend_total" : "spend";
      } else if (m.label.includes("展现")) {
        key = "impressions";
      } else if (m.label.includes("点击")) {
        key = "clicks";
      } else if (m.label.includes("GMV") || m.label.includes("成交")) {
        key = "gmv";
      } else if (m.label.includes("指数")) {
        key = "kw_total_index";
      } else if (m.label.includes("UV") || m.label.includes("访客") || m.label.includes("进店")) {
        key = "uv";
      } else if (m.label.includes("订单")) {
        key = "orders";
      } else if (m.label.includes("信息流")) {
        key = "spend_f";
      } else if (m.label.includes("搜索推广")) {
        key = "spend_s";
      } else if (m.label.includes("达人")) {
        key = "spend_k";
      } else if (m.label.includes("互动")) {
        key = "engagements";
      } else {
        key = idx === 0 ? "spend" : idx === 1 ? "impressions" : "clicks";
      }

      const spark = recentObserved.map((r) => {
        const v = (r as Record<string, unknown>)[key] ?? (r as Record<string, unknown>).spend ?? (r as Record<string, unknown>).spend_total ?? null;
        if (v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      });

      const hasValid = spark.some((v) => v !== null && v > 0);
      return {
        ...m,
        category: rotatingCategories[idx % 6],
        sparkline: hasValid ? spark : undefined,
      };
    });
  }, [activeDataset, selectedDate]);

  const trendComboSeries: ComboSeries[] = useMemo(() => {
    if (!activeDataset) return [];
    const isTaosou = activeDataset.id.includes("taosou");
    const isCid = activeDataset.id.includes("cid");

    if (isTaosou) {
      return [
        { key: "spend_total", label: "全渠道日消耗", unit: "元", axis: "left", kind: "bar", color: AI_STUDIO_PALETTE.pine },
        { key: "kw_total_index", label: "淘搜总指数", unit: "指数", axis: "right", kind: "line", color: AI_STUDIO_PALETTE.mineralBlue },
      ];
    }

    if (isCid) {
      return [
        { key: "spend", label: "日广告消耗", unit: "元", axis: "left", kind: "bar", color: AI_STUDIO_PALETTE.pine },
        { key: "gmv", label: "成交GMV", unit: "元", axis: "right", kind: "line", color: AI_STUDIO_PALETTE.terracotta },
      ];
    }

    return [
      { key: "spend", label: "日广告消耗", unit: "元", axis: "left", kind: "bar", color: AI_STUDIO_PALETTE.pine },
      { key: "impressions", label: "展现量", unit: "次", axis: "right", kind: "line", color: AI_STUDIO_PALETTE.mineralBlue },
    ];
  }, [activeDataset]);

  // Selected Day Distributions (Channel, Keywords, Crowd, Efficiency)
  const distributions = useMemo(() => {
    if (!activeDataset || !selectedDate) return [];
    return getSingleDayDistributions(activeDataset, selectedDate);
  }, [activeDataset, selectedDate]);

  // Cross-dataset comparisons for the selected date with explicit incompatible scopes
  const crossDataset = useMemo(() => {
    if (!datasets.length || !selectedDate) return null;
    return getCrossDatasetDailyComparison(datasets, selectedDate, dashboard?.projectId);
  }, [datasets, selectedDate, dashboard?.projectId]);

  // Honest empty state when no daily datasets exist (e.g. qicui or unconfigured projects)
  if (!datasets.length || !activeDataset || !activeDataset.rows.length) {
    return (
      <div className="ca-page ca-daily-page" role="main" aria-label={`${name} 分日看板`}>
        <div className="ca-daily-empty-box">
          <div className="ca-daily-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="ca-daily-empty-title">当前项目暂无逐日分日流水记录</h3>
          <p className="ca-daily-empty-desc">
            所选项目暂无连续日级别流水数据。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ca-page ca-daily-page" role="main" aria-label={`${name} 分日看板`}>
      {/* 1. 扁平整合单行工具栏：数据集选择与日期导航在同一平整白色工具栏 */}
      <header className="ca-header ca-daily-toolbar" role="toolbar" aria-label="分日分析工具栏">
        <div className="ca-daily-toolbar-main">
          {datasets.length > 1 && (
            <div className="ca-dataset-picker-item">
              <span className="ca-filter-label">分析范围:</span>
              <CustomSelect
                ariaLabel="选择分日数据集"
                value={activeDataset.id}
                onChange={(val) => {
                  updateUrl({ dataset: val });
                }}
                options={datasets.map((d) => ({
                  value: d.id,
                  label: formatDatasetDisplay(d.id, d.label),
                }))}
              />
            </div>
          )}

          <div className="ca-daily-nav-wrap">
            <span className="ca-filter-label">业务日期:</span>
            <DayNavigator
              id="ca-daily-date-picker"
              ariaLabel="选择业务日期"
              value={selectedDate || ""}
              min={minAvailableDate}
              max={maxAvailableDate}
              latestDate={maxAvailableDate}
              onChange={(val) => {
                if (val && isValidIsoDate(val)) {
                  updateUrl({ day: val });
                } else if (!val) {
                  updateUrl({ day: "" });
                }
              }}
            />
          </div>
        </div>

        <div className="ca-daily-status-meta">
          {isDateMissing && (
            <span className="ca-daily-meta-missing">该日期暂无流水记录</span>
          )}
          <span className="ca-daily-meta-item">数据截至 {maxAvailableDate || "—"}</span>
          <span className="ca-daily-meta-item">{allAvailableDates.length}个采集日</span>
        </div>
      </header>

      {/* 3. 缺日明确诚实空态 (绝不静默替换为最新日期) */}
      {isDateMissing && (
        <div className="ca-daily-empty-box" role="alert" style={{ marginTop: 12 }}>
          <div className="ca-daily-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="ca-daily-empty-title">所选日期 ({selectedDate}) 暂无流水记录</h3>
          <p className="ca-daily-empty-desc">
            当前数据集 ({formatDatasetDisplay(activeDataset.id, activeDataset.label)}) 在 {selectedDate} 未采集到有效流水数据。可用数据区间为 {activeDataset.period}。
          </p>
          {maxAvailableDate && (
            <button
              type="button"
              className="ca-btn-reset"
              onClick={() => updateUrl({ day: maxAvailableDate })}
              style={{ marginTop: 8 }}
            >
              切换至该数据集最新记录日期 ({maxAvailableDate})
            </button>
          )}
        </div>
      )}

      {/* 4. 当日核心指标与分布大卡片 (Macro Section Card, 28px间距) */}
      {!isDateMissing && (
        <div className="ca-section-macro-card">
          {/* L1 Daily Executive Bento Grid */}
          {richContext && (
            <div className="bento-grid" style={{ marginBottom: 16 }}>
              <div className="bento-card col-6 ca-health-card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="card-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1C1917)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 15 }}>🩺</span> 本日投流健康研判
                  </div>
                  <span className={`semantic-tag ${richContext.diagnosis.statusTone === 'optimal' || richContext.diagnosis.statusTone === 'steady' ? 'tag-ok' : richContext.diagnosis.statusTone === 'warning' ? 'tag-danger' : 'tag-warn'} num`}>
                    {richContext.diagnosis.statusLabel}
                  </span>
                </div>
                <div className="ca-health-bento-body">
                  <div className="ca-health-score-box">
                    <div className="ca-health-score-ring">
                      <span className="ca-health-score-val num">
                        {richContext.diagnosis.statusTone === 'optimal' ? 92 : richContext.diagnosis.statusTone === 'steady' ? 86 : richContext.diagnosis.statusTone === 'watch' ? 80 : 72}
                      </span>
                      <span className="ca-health-score-lbl">单日健康指数</span>
                    </div>
                    <span className="ca-health-pos-text">{richContext.diagnosis.positionText}</span>
                  </div>
                  <div className="ca-health-insights-list">
                    {richContext.diagnosis.bullets.slice(0, 3).map((b, idx) => (
                      <div key={idx} className="ca-health-insight-bullet">
                        <span className="ca-health-bullet-dot" />
                        <span className="ca-health-bullet-text">{b}</span>
                      </div>
                    ))}
                    <div className="ca-health-meta-strip">
                      <span className="ca-health-meta-chip">
                        7日均线对标: <strong>{richContext.benchmarks.vs7dMaPct !== null ? `${richContext.benchmarks.vs7dMaPct > 0 ? "+" : ""}${richContext.benchmarks.vs7dMaPct}%` : "—"}</strong>
                      </span>
                      <span className="ca-health-meta-chip">
                        周期峰值日: <strong>{richContext.benchmarks.peakDate ? richContext.benchmarks.peakDate.slice(5) : "—"}</strong>
                      </span>
                      <span className="ca-health-meta-chip">
                        数据覆盖: <strong>{allAvailableDates.length}日全量</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bento-card col-6">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="card-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1C1917)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 14 }}>🎯</span> 业务日消耗基准对标
                  </div>
                  <span className="semantic-tag tag-neutral">竖线 = 对标基准线 (100%)</span>
                </div>
                <div className="bullet-group">
                  <ExecutiveBulletCard
                    title="本日消耗 vs 7日移动均值"
                    actualSpend={Number(selectedRow?.spend || (selectedRow as any)?.spend_total || 0)}
                    totalBudget={Number(richContext.benchmarks.periodAvgSpend || 10000)}
                    spendRate={richContext.benchmarks.periodAvgSpend ? Math.round((Number(selectedRow?.spend || (selectedRow as any)?.spend_total || 0) / richContext.benchmarks.periodAvgSpend) * 100) : 100}
                    timeRate={100}
                    timeLabel="均值 100%"
                    trackVariant={1}
                    icon="📅"
                  />
                  <ExecutiveBulletCard
                    title={prevDaySpend !== null ? "本日消耗 vs 前一日环比 (DoD)" : "本日消耗 vs 周期日均"}
                    actualSpend={Number(selectedRow?.spend || (selectedRow as any)?.spend_total || 0)}
                    totalBudget={prevDaySpend ?? Number(richContext.benchmarks.periodAvgSpend || 10000)}
                    spendRate={
                      (prevDaySpend ?? richContext.benchmarks.periodAvgSpend)
                        ? Math.round((Number(selectedRow?.spend || (selectedRow as any)?.spend_total || 0) / (prevDaySpend ?? richContext.benchmarks.periodAvgSpend!)) * 100)
                        : 100
                    }
                    timeRate={100}
                    timeLabel={prevDaySpend !== null ? "前日基准 100%" : "均值 100%"}
                    trackVariant={2}
                    icon="📉"
                  />
                </div>
              </div>
            </div>
          )}

          {summaryMetrics.length > 0 && (
            <MetricStrip items={summaryMetrics} />
          )}

          {/* 当日分布与结构面板 (无虚假小时曲线，聚焦单日结构与跨数据集横向对照) */}
        <h2 className="sr-only">当日核心指标与分布</h2>
        <div className="ca-daily-grid">
          {/* 5.1 当日效率与成本基准对标 (Left Card) */}
          {richContext && richContext.efficiencyBenchmarks.length > 0 && (
            <div className="ca-daily-panel">
              <ChartPanel
                title="当日效率与成本基准对标"
                subtitle={`选定业务日 (${selectedDate}) 核心效率 vs 全周期平均水平`}
                actions={
                  <span style={{ fontSize: 12, color: "#60646c" }}>
                    {richContext.efficiencyBenchmarks.length} 项关键效能指标
                  </span>
                }
              >
                <div className="ca-eff-benchmark-list">
                  {richContext.efficiencyBenchmarks.map((item) => {
                    const markerPct = 66.6;
                    const fillPct = Math.min(
                      100,
                      Math.max(
                        4,
                        item.periodAvgVal && item.selectedVal
                          ? Math.round((item.selectedVal / (item.periodAvgVal * 1.5)) * 100)
                          : 50
                      )
                    );
                    const avgLabel =
                      item.unit === "元"
                        ? `均值 ¥${fmtNum(item.periodAvgVal, 2)}`
                        : `均值 ${fmtNum(item.periodAvgVal, 2)}${item.unit}`;

                    return (
                      <div key={item.key} className="ca-eff-item ca-eff-bench-item bullet-item">
                        <div className="ca-eff-row-header">
                          <div className="ca-eff-name-group">
                            <strong className="ca-eff-name">{item.label}</strong>
                            <span className={`ca-eff-status-pill ca-eff-${item.status}`}>
                              {item.statusLabel}
                            </span>
                          </div>
                          <div className="ca-eff-nums num">
                            <span className="ca-eff-today">
                              本日: <strong>{fmtNum(item.selectedVal, 2)}{item.unit}</strong>
                            </span>
                            <span className="ca-eff-avg">
                              周期均值: {fmtNum(item.periodAvgVal, 2)}{item.unit}
                            </span>
                          </div>
                        </div>
                        <div className="ca-eff-track-wrap">
                          <div className="ca-eff-track bullet-track">
                            <div
                              className={`ca-eff-fill ca-eff-fill-${item.status}`}
                              style={{ width: `${fillPct}%` }}
                            />
                            {item.periodAvgVal !== null && item.periodAvgVal !== undefined && (
                              <div
                                className="ca-eff-benchmark-marker ca-eff-bench-marker bullet-time-marker"
                                style={{ left: `${markerPct}%` }}
                                title={`周期均值基准线: ${avgLabel}`}
                              >
                                <span className="ca-eff-bench-marker-label bullet-time-label">
                                  {avgLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartPanel>
            </div>
          )}

          {/* 5.2 当日流量漏斗与跨渠道分流全景 (Right Card) */}
          {richContext && richContext.trafficFunnel.length > 0 && (
            <div className="ca-daily-panel">
              <ChartPanel
                title="当日流量转化漏斗与规模结构"
                subtitle={`业务日: ${selectedDate} / 展现曝光 → 互动沉淀 → 进店访客`}
                actions={
                  <span style={{ fontSize: 12, color: "#60646c" }}>
                    {richContext.trafficFunnel.length} 级链路转化
                  </span>
                }
              >
                <div className="ca-funnel-container">
                  <div className="ca-funnel-steps-grid">
                    {richContext.trafficFunnel.map((step, idx) => (
                      <div key={step.key} className="ca-funnel-step-card">
                        <div className="ca-funnel-step-top">
                          <span className="ca-funnel-step-idx">0{idx + 1}</span>
                          <span className="ca-funnel-step-name">{step.label}</span>
                        </div>
                        <strong className="ca-funnel-step-val">{step.formattedValue}</strong>
                        {step.conversionLabel && (
                          <span className="ca-funnel-step-rate">{step.conversionLabel}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 水平比例对照进度条 (Scale progress bars with relative proportions) */}
                  <div className="ca-dist-list">
                    {richContext.trafficFunnel.map((step, sIdx) => {
                      const maxVal = Math.max(...richContext.trafficFunnel.map((s) => s.value || 0), 1);
                      const logMax = Math.log10(maxVal + 10);
                      const logVal = Math.log10((step.value || 0) + 10);
                      const pct = step.value ? Math.min(100, Math.max(8, Math.round((logVal / logMax) * 100))) : 0;
                      const funnelPalette: Record<string, string> = {
                        imp: AI_STUDIO_PALETTE.sage,
                        clicks: AI_STUDIO_PALETTE.pine,
                        engagements: AI_STUDIO_PALETTE.harvestOchre,
                        eng: AI_STUDIO_PALETTE.harvestOchre,
                        uv: AI_STUDIO_PALETTE.mineralBlue,
                      };
                      const stepColor =
                        funnelPalette[step.key] ||
                        AI_STUDIO_COLOR_ARRAY[sIdx % AI_STUDIO_COLOR_ARRAY.length];
                      return (
                        <div key={step.key} className="ca-dist-item">
                          <div className="ca-dist-item-header">
                            <span className="ca-dist-label">{step.label}</span>
                            <div className="ca-dist-val-group">
                              <strong className="ca-dist-value num">{step.formattedValue}</strong>
                              {step.conversionLabel && (
                                <span className="ca-dist-share">{step.conversionLabel}</span>
                              )}
                            </div>
                          </div>
                          <div className="ca-dist-bar-track">
                            <div
                              className="ca-dist-bar-fill"
                              style={{ width: `${pct}%`, background: stepColor }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {richContext.feishuDrilldowns.channelSplits && richContext.feishuDrilldowns.channelSplits.length > 0 && (
                    <div className="ca-channel-split-section">
                      <span className="ca-sub-heading">当日渠道支出结构 (K/F/S/CID)</span>
                      <div className="ca-channel-split-bars">
                        {richContext.feishuDrilldowns.channelSplits.map((c, cIdx) => (
                          <div key={c.label} className="ca-channel-bar-item">
                            <div className="ca-channel-bar-info">
                              <span className="ca-channel-lbl">{c.label}</span>
                              <span className="ca-channel-amt num">¥{fmtNum(c.spend)} ({c.sharePct}%)</span>
                            </div>
                            <div className="ca-dist-bar-track">
                              <div className="ca-dist-bar-fill" style={{ width: `${c.sharePct}%`, background: c.color || AI_STUDIO_COLOR_ARRAY[cIdx % AI_STUDIO_COLOR_ARRAY.length] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ChartPanel>
            </div>
          )}

          {/* 5.3 兜底分布与结构 (仅在无富分析研判上下文时呈现，避免数据重复展现) */}
          {!richContext && distributions.map((dist) => (
            <div key={dist.id} className="ca-daily-panel">
              <ChartPanel
                title={dist.title}
                subtitle={`业务日期: ${selectedDate} / ${dist.caption}`}
                actions={
                  <span style={{ fontSize: 12, color: "#60646c" }}>
                    {dist.items.length} {dist.isComposition ? "项分布构成" : "项指标"}
                  </span>
                }
              >
                <div className="ca-dist-list">
                  {dist.items.map((it) => (
                    <div key={it.key} className="ca-dist-item">
                      <div className="ca-dist-item-header">
                        <span className="ca-dist-label">{it.label}</span>
                        <div className="ca-dist-val-group">
                          <strong className="ca-dist-value">{it.formattedValue}</strong>
                          {dist.isComposition && it.sharePct !== undefined && (
                            <span className="ca-dist-share">{it.sharePct}%</span>
                          )}
                        </div>
                      </div>
                      {dist.isComposition && it.sharePct !== undefined && (
                        <div className="ca-dist-bar-track">
                          <div
                            className="ca-dist-bar-fill"
                            style={{
                              width: it.sharePct > 0 ? `${Math.min(100, Math.max(0.5, it.sharePct))}%` : "0%",
                              background: it.color || CAMPAIGN_PALETTE.primary,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ChartPanel>
            </div>
          ))}

          {/* 5.2 当日跨数据集横向对照 (多数据集项目明确标注不相容口径，不混同相加) */}
          {crossDataset && crossDataset.hasMultiple && (
            <div className="ca-daily-panel ca-daily-panel-span-2">
              <ChartPanel
                title={`当日跨数据集横向对照 (${selectedDate})`}
                subtitle="同一业务日在不同采集底表中的表现 / 跨渠道横向对照"
                actions={
                  <span style={{ fontSize: 12, color: "#60646c" }}>
                    共 {datasets.length} 个独立数据集
                  </span>
                }
              >
                <div className="ca-cross-dataset-container">
                  <div className="ca-scope-notice-banner" role="note">
                    {crossDataset.scopeNotice}
                  </div>
                  <div className="ca-cross-dataset-cards">
                    {crossDataset.rows.map((row) => (
                      <div
                        key={row.datasetId}
                        className={`ca-cross-card ${row.datasetId === activeDataset.id ? "ca-cross-card-active" : ""}`}
                      >
                        <div className="ca-cross-card-head">
                          <strong className="ca-cross-card-title">{formatDatasetDisplay(row.datasetId, row.datasetLabel)}</strong>
                          {row.datasetId === activeDataset.id ? (
                            <span className="ca-cross-badge-active">当前查看</span>
                          ) : (
                            <button
                              type="button"
                              className="ca-btn-reset"
                              style={{ padding: "1px 6px", fontSize: 12 }}
                              onClick={() => updateUrl({ dataset: row.datasetId })}
                            >
                              切换至此表
                            </button>
                          )}
                        </div>
                        {!row.hasDataOnSelectedDate ? (
                          <div className="ca-cross-card-empty">
                            <span>当日未采集 / 无流水记录</span>
                            <small>覆盖区间: {row.period}</small>
                          </div>
                        ) : (
                          <div className="ca-cross-card-metrics">
                            <div className="ca-cross-metric-row">
                              <span className="ca-cross-metric-label">广告消耗/支出:</span>
                              <strong className="ca-cross-metric-val">{row.spend}</strong>
                            </div>
                            <div className="ca-cross-metric-row">
                              <span className="ca-cross-metric-label">{row.primaryMetric.label}:</span>
                              <strong className="ca-cross-metric-val">{row.primaryMetric.value}</strong>
                            </div>
                            <div className="ca-cross-metric-row">
                              <span className="ca-cross-metric-label">{row.secondaryMetric.label}:</span>
                              <strong className="ca-cross-metric-val">{row.secondaryMetric.value}</strong>
                            </div>
                            <div className="ca-cross-metric-row">
                              <span className="ca-cross-metric-label">{row.efficiencyMetric.label}:</span>
                              <strong className="ca-cross-metric-val">{row.efficiencyMetric.value}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </ChartPanel>
            </div>
          )}

          {/* 5.3 飞书源数据联动透视：高贡献素材 × 搜索词与人群 × 日报动作 */}
          {richContext && (
            <div className="ca-daily-panel ca-daily-panel-span-2">
              <div className="ca-feishu-enrichment-card">
                <div className="ca-feishu-card-header">
                  <div className="ca-feishu-header-title-wrap">
                    <span className="ca-feishu-badge">飞书源表深度联动</span>
                    <h3 className="ca-feishu-card-title">多维下钻透视：高贡献素材 × 搜索词与人群 × 日报动作</h3>
                  </div>
                  <span className="ca-feishu-header-meta">
                    提取自飞书多维底表 · 与所选业务日 ({selectedDate}) 实时联动
                  </span>
                </div>

                <div className="ca-feishu-dual-grid">
                  {/* Left: Top Performing Notes / Creatives */}
                  <div className={`ca-feishu-subpanel ${availableFeishuTabs.length === 0 ? "ca-feishu-subpanel-full" : ""}`}>
                    <div className="ca-feishu-subpanel-head">
                      <div className="ca-feishu-subpanel-title-group">
                        <span className="ca-feishu-subpanel-tag">素材排行</span>
                        <strong className="ca-feishu-subpanel-title">
                          战役高贡献达人与素材榜 (Top {richContext.feishuDrilldowns.topNotes.length})
                        </strong>
                      </div>
                      <span className="ca-feishu-subpanel-caption">按累计消耗/产出规模排序</span>
                    </div>
                    <div className="ca-feishu-notes-list">
                      {richContext.feishuDrilldowns.topNotes.length === 0 ? (
                        <div className="ca-feishu-empty-hint">当前项目飞书底表暂无达人素材明细</div>
                      ) : (
                        richContext.feishuDrilldowns.topNotes.map((note, idx) => (
                          <div key={note.id || idx} className="ca-feishu-note-row">
                            <span className={`ca-feishu-note-rank ca-rank-${idx + 1}`}>#{idx + 1}</span>
                            <div className="ca-feishu-note-main">
                              <div className="ca-feishu-note-meta">
                                <span className="ca-feishu-note-creator">{note.creator}</span>
                                <span className="ca-feishu-note-channel">{note.channelOrTier}</span>
                              </div>
                              <div className="ca-feishu-note-title" title={note.title}>{note.title}</div>
                              <div className="ca-feishu-note-metrics">
                                {note.spend !== null && (
                                  <span className="ca-fn-m">消耗: <strong>¥{fmtNum(note.spend)}</strong></span>
                                )}
                                {note.gmv !== null && (
                                  <span className="ca-fn-m">GMV: <strong>¥{fmtNum(note.gmv)}</strong></span>
                                )}
                                {note.roi !== null && (
                                  <span className="ca-fn-m">ROI: <strong>{fmtNum(note.roi, 2)}倍</strong></span>
                                )}
                                {note.clicks !== null && (
                                  <span className="ca-fn-m">点击: <strong>{fmtNum(note.clicks, 0)}</strong></span>
                                )}
                                {note.impressions !== null && (
                                  <span className="ca-fn-m">展现: <strong>{fmtNum(note.impressions, 0)}</strong></span>
                                )}
                                {note.uv !== null && (
                                  <span className="ca-fn-m">UV: <strong>{fmtNum(note.uv, 0)}</strong></span>
                                )}
                                {note.cpc !== null && (
                                  <span className="ca-fn-m">CPC: <strong>¥{fmtNum(note.cpc, 2)}</strong></span>
                                )}
                                {note.cpe !== null && (
                                  <span className="ca-fn-m">CPE: <strong>¥{fmtNum(note.cpe, 2)}</strong></span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right: Tabbed Keywords / Audiences / Actions */}
                  {availableFeishuTabs.length > 0 && (
                  <div className="ca-feishu-subpanel">
                    <div className="ca-feishu-subpanel-head">
                      <div className="ca-feishu-tabs" role="tablist">
                        {availableFeishuTabs.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={feishuTab === t.id}
                            className={`ca-feishu-tab-btn ${feishuTab === t.id ? "active" : ""}`}
                            onClick={() => setFeishuTab(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ca-feishu-tab-content">
                      {feishuTab === "keywords" && (
                        <div className="ca-feishu-kw-view">
                          {richContext.feishuDrilldowns.taosouDailyKeywords && richContext.feishuDrilldowns.taosouDailyKeywords.length > 0 && (
                            <div className="ca-taosou-day-kw-box">
                              <div className="ca-taosou-day-kw-title">
                                <span>所选日核心关键词淘搜指数贡献 ({selectedDate})</span>
                              </div>
                              <div className="ca-dist-list">
                                {richContext.feishuDrilldowns.taosouDailyKeywords.map((kw, kwIdx) => (
                                  <div key={kw.keyword} className="ca-dist-item">
                                    <div className="ca-dist-item-header">
                                      <span className="ca-dist-label">{kw.keyword}</span>
                                      <div className="ca-dist-val-group">
                                        <strong className="ca-dist-value num">{fmtNum(kw.index, 0)} 点</strong>
                                        {kw.sharePct !== undefined && <span className="ca-dist-share">{kw.sharePct}%</span>}
                                      </div>
                                    </div>
                                    {kw.sharePct !== undefined && (
                                      <div className="ca-dist-bar-track">
                                        <div className="ca-dist-bar-fill" style={{ width: `${kw.sharePct}%`, background: AI_STUDIO_COLOR_ARRAY[kwIdx % AI_STUDIO_COLOR_ARRAY.length] }} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="ca-general-kw-list">
                            <span className="ca-sub-heading">搜索词分类转化表现</span>
                            {richContext.feishuDrilldowns.searchKeywords.length === 0 ? (
                              <div className="ca-feishu-empty-hint">暂无独立搜索词底表记录</div>
                            ) : (
                              richContext.feishuDrilldowns.searchKeywords.map((k) => (
                                <div key={k.keyword} className="ca-kw-row">
                                  <div className="ca-kw-info">
                                    <strong className="ca-kw-text">{k.keyword}</strong>
                                    {k.category && <span className="ca-kw-cat">{k.category}</span>}
                                  </div>
                                  <div className="ca-kw-stats">
                                    {k.spend !== null && <span>消耗: <strong>¥{fmtNum(k.spend)}</strong></span>}
                                    {k.cpc !== null && <span>CPC: <strong>¥{fmtNum(k.cpc, 2)}</strong></span>}
                                    {k.ctr !== null && <span>CTR: <strong>{k.ctr}%</strong></span>}
                                    {k.uv !== null && <span>UV: <strong>{fmtNum(k.uv, 0)}</strong></span>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {feishuTab === "audiences" && (
                        <div className="ca-feishu-aud-list">
                          {richContext.feishuDrilldowns.audiencePackages.length === 0 ? (
                            <div className="ca-feishu-empty-hint">当前项目飞书底表暂无独立人群包记录</div>
                          ) : (
                            richContext.feishuDrilldowns.audiencePackages.map((aud) => (
                              <div key={aud.name} className="ca-aud-row">
                                <div className="ca-aud-name-wrap">
                                  <strong className="ca-aud-name">{aud.name}</strong>
                                </div>
                                <div className="ca-aud-stats">
                                  {aud.spend !== null && <span>消耗: <strong>¥{fmtNum(aud.spend)}</strong></span>}
                                  {aud.cpe !== null && <span>CPE: <strong>¥{fmtNum(aud.cpe, 2)}</strong></span>}
                                  {aud.cpuv !== null && <span>CPUV: <strong>¥{fmtNum(aud.cpuv, 2)}</strong></span>}
                                  {aud.clicks !== null && <span>点击: <strong>{fmtNum(aud.clicks, 0)}</strong></span>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {feishuTab === "actions" && (
                        <div className="ca-feishu-actions-list">
                          {richContext.feishuDrilldowns.actionItems.length === 0 ? (
                            <div className="ca-feishu-empty-hint">暂无记录的日报行动项</div>
                          ) : (
                            richContext.feishuDrilldowns.actionItems.map((act) => (
                              <div key={act.id} className="ca-act-item">
                                <div className="ca-act-bullet" />
                                <div className="ca-act-body">
                                  <div className="ca-act-header">
                                    <span className="ca-act-title">{act.title}</span>
                                    {act.owner && <span className="ca-act-owner">{act.owner}</span>}
                                  </div>
                                  <div className="ca-act-footer">
                                    <span className="ca-act-status">{act.status || "日报跟进"}</span>
                                    {act.badge && <span className="ca-act-badge">{act.badge}</span>}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* 5.5 全周期累计与高级诊断分析 (热力图 · 累计趋势 · 周度节奏) */}
      {!isDateMissing && diagCalendarRows.length > 0 && (
        <details className="ca-daily-details-panel ca-daily-diagnostics-details">
          <summary className="ca-daily-details-summary">
            <div className="ca-daily-details-summary-title">
              <span className="ca-daily-details-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M2 2v12h12V2H2zm10 10H4V4h8v8z" />
                </svg>
              </span>
              <span>全周期累计与宏观走势诊断 (跨期趋势分析，默认折叠)</span>
              <span className="ca-daily-details-badge">高级诊断</span>
            </div>
            <span className="ca-daily-details-hint">点击展开全期分析</span>
          </summary>
          <div style={{ padding: "16px 20px" }}>
            <CampaignDailyDiagnostics
              dataset={activeDataset}
              calendarRows={diagCalendarRows}
              startDate={minAvailableDate}
              endDate={maxAvailableDate}
            />
          </div>
        </details>
      )}

      {/* 6. 真实数据全量明细表格 (默认收起在 details 内部，所选日高亮突出) */}
      <details className="ca-daily-details-panel">
        <summary className="ca-daily-details-summary">
          <div className="ca-daily-details-summary-title">
            <span className="ca-daily-details-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M1 11h2v4H1zm4-4h2v8H5zm4-4h2v12H9zm4-2h2v14h-2z" />
              </svg>
            </span>
            <span>查看完整分日明细数据表</span>
            <span className="ca-daily-details-badge">共 {activeDataset.rows.length} 条流水记录</span>
          </div>
          <span className="ca-daily-details-hint">{`展开分日明细 (${activeDataset.rows.length} 条)`}</span>
        </summary>

        <div className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr>
                <th>日期</th>
                {activeDataset.metrics.map((m) => (
                  <th key={m.key} style={{ textAlign: "right" }}>
                    {m.label} {m.unit ? `(${m.unit})` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDataset.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeDataset.metrics.length + 1}
                    style={{ textAlign: "center", padding: "24px 0", color: "#60646c" }}
                  >
                    所选日期暂无记录
                  </td>
                </tr>
              ) : (
                [...activeDataset.rows].reverse().map((row) => {
                  const isSelected = row.date === selectedDate;
                  return (
                    <tr
                      key={String(row.date)}
                      className={isSelected ? "ca-table-row-selected" : undefined}
                      style={{ cursor: "pointer" }}
                      onClick={() => updateUrl({ day: String(row.date) })}
                      title={`点击切换到 ${String(row.date)}`}
                    >
                      <td style={{ fontWeight: isSelected ? "700" : "600", color: isSelected ? "#208368" : "#1c2024" }}>
                        {String(row.date)} {isSelected ? " (当前选中)" : ""}
                      </td>
                      {activeDataset.metrics.map((m) => {
                        const raw = row[m.key];
                        const valStr = fmtNum(raw);
                        return (
                          <td key={m.key} style={{ textAlign: "right" }}>
                            {valStr}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </details>

      {/* 7. 页脚精简说明 */}
      <footer className="ca-footer-date">
        业务统计区间: {activeDataset.period} / 当前分析日: {selectedDate || "未选定"}
      </footer>
    </div>
  );
}

export default CampaignDailyPage;
