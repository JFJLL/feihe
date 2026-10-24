"use client";

import React, { useState, useMemo, useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import type { CampaignDashboard } from "../../lib/campaign-types";
import { CustomDatePicker } from "../../components/ui/CustomDatePicker";
import { MetricStrip, ChartPanel } from "./CampaignCharts";
import { CustomSelect } from "../../components/ui/CustomSelect";
import {
  resolveDailyDatasets,
  fmtNum,
  CAMPAIGN_PALETTE,
} from "./campaign-daily-model";
import {
  getSingleDayKPIs,
  getSingleDayDistributions,
  getCrossDatasetDailyComparison,
  subtractCalendarDays,
  addCalendarDays,
  isValidIsoDate,
} from "./daily-selection-model";
import "./campaign-analytics.css";
import "./campaign-combo.css";
import "./campaign-daily.css";
import "./CampaignDailyPage.css";

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
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const quickToggleRef = useRef<HTMLButtonElement>(null);
  const quickDropdownRef = useRef<HTMLDivElement>(null);

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
  const selectedIndex = allAvailableDates.indexOf(selectedDate);
  const dayProgressLabel =
    selectedIndex >= 0
      ? `共 ${allAvailableDates.length} 个有效采集日 / 当前第 ${selectedIndex + 1}/${allAvailableDates.length} 日`
      : `共 ${allAvailableDates.length} 个有效采集日`;

  // Close quick picker when clicking outside
  useEffect(() => {
    if (!quickPickerOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        quickDropdownRef.current &&
        !quickDropdownRef.current.contains(e.target as Node) &&
        quickToggleRef.current &&
        !quickToggleRef.current.contains(e.target as Node)
      ) {
        setQuickPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [quickPickerOpen]);

  // Focus management when quick picker opens
  useEffect(() => {
    if (!quickPickerOpen) return;
    const timer = setTimeout(() => {
      if (!quickDropdownRef.current) return;
      const targetBtn =
        quickDropdownRef.current.querySelector<HTMLButtonElement>(".ca-quick-date-item.active") ||
        quickDropdownRef.current.querySelector<HTMLButtonElement>(".ca-quick-date-item") ||
        quickDropdownRef.current.querySelector<HTMLButtonElement>(".ca-quick-dates-close");
      targetBtn?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [quickPickerOpen]);

  const handleQuickDropdownKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setQuickPickerOpen(false);
      quickToggleRef.current?.focus();
    }
  };

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

  // Step date helpers
  const handleStepDay = (step: -1 | 1) => {
    const current = selectedDate || maxAvailableDate;
    if (!current) return;
    const next = step === -1 ? subtractCalendarDays(current, 1) : addCalendarDays(current, 1);
    if (next) {
      updateUrl({ day: next });
    }
  };

  // Active row on the selected date
  const selectedRow = useMemo(() => {
    if (!activeDataset?.rows || !selectedDate) return null;
    return activeDataset.rows.find((r) => r.date === selectedDate) || null;
  }, [activeDataset, selectedDate]);

  const isDateMissing = !selectedRow;

  // Selected Day Core KPIs with Day-over-Day comparisons
  const summaryMetrics = useMemo(() => {
    if (!activeDataset || !selectedDate) return [];
    return getSingleDayKPIs(activeDataset, selectedDate);
  }, [activeDataset, selectedDate]);

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

  // Secondary switch for Winner Wipes delivery vs taosou
  const isWipes = activeDataset?.id.startsWith("wipes-daily-");
  const alternateWipesId =
    activeDataset?.id === "wipes-daily-delivery"
      ? "wipes-daily-taosou"
      : activeDataset?.id === "wipes-daily-taosou"
      ? "wipes-daily-delivery"
      : null;
  const alternateWipesLabel =
    activeDataset?.id === "wipes-daily-delivery"
      ? "切换到淘搜表现 →"
      : "← 返回日常种草";

  // Honest empty state when no daily datasets exist (e.g. qicui or unconfigured projects)
  if (!datasets.length || !activeDataset || !activeDataset.rows.length) {
    return (
      <div className="ca-page ca-daily-page" role="main" aria-label={`${name} 分日看板`}>
        <header className="ca-header bd-toolbar-compact">
          <div className="ca-header-heading">
            <div className="ca-header-title-row">
              <h2 className="ca-header-title">分日看板</h2>
            </div>
            <p className="ca-header-subtitle">
              项目暂无逐日分日流水记录
            </p>
          </div>
        </header>

        <div className="ca-daily-empty-box">
          <div className="ca-daily-empty-icon">📅</div>
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
      {/* 1. Header & Daily Toolbar Integrated Compact Console */}
      <header className="ca-header bd-toolbar-compact ca-daily-header-console">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">分日看板</h2>
            <span className="ca-header-subtitle">
              {formatDatasetDisplay(activeDataset.id, activeDataset.label)} ({activeDataset.period})
            </span>
          </div>
        </div>

        <div className="ca-dataset-picker-wrap">
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

          {isWipes && alternateWipesId && (
            <button
              type="button"
              className="ca-btn-switch-dataset"
              onClick={() => {
                updateUrl({ dataset: alternateWipesId });
              }}
              title="切换关联分日分析视角"
            >
              {alternateWipesLabel}
            </button>
          )}
        </div>
      </header>

      {/* 2. 单日期控制工具栏 (全项目统一单日选择，支持前后日步进与最新日期) */}
      <div className="ca-daily-toolbar ca-daily-toolbar-docked" role="toolbar" aria-label="分日分析工具栏">
        <div className="ca-filter-section">
          <span className="ca-filter-label">业务日期:</span>
          <div className="ca-date-single-box">
            <button
              type="button"
              className="ca-btn-date-step"
              onClick={() => handleStepDay(-1)}
              aria-label="前一日"
              title="切换至前一日"
            >
              ← 前一日
            </button>
            <div className="ca-date-input-wrap">
              <CustomDatePicker
                id="ca-daily-date-picker"
                ariaLabel="选择业务日期"
                title="选择或输入业务日期"
                placeholder="选择或输入日期"
                value={selectedDate || ""}
                min={minAvailableDate}
                max={maxAvailableDate}
                className="ca-daily-custom-date-picker"
                onValueChange={(val) => {
                  if (val && isValidIsoDate(val)) {
                    updateUrl({ day: val });
                  } else if (!val) {
                    updateUrl({ day: "" });
                  }
                }}
              />
              <button
                ref={quickToggleRef}
                type="button"
                className={`ca-btn-quick-dates-toggle ${quickPickerOpen ? "active" : ""}`}
                onClick={() => setQuickPickerOpen((prev) => !prev)}
                title="展开全量有效业务日速选面板"
                aria-label="快速选日"
                aria-expanded={quickPickerOpen}
                aria-controls="ca-quick-dates-dropdown"
              >
                📅 快捷选日
              </button>
            </div>
            <button
              type="button"
              className="ca-btn-date-step"
              onClick={() => handleStepDay(1)}
              aria-label="后一日"
              title="切换至后一日"
            >
              后一日 →
            </button>

            {quickPickerOpen && allAvailableDates.length > 0 && (
              <div
                ref={quickDropdownRef}
                id="ca-quick-dates-dropdown"
                className="ca-quick-dates-dropdown"
                role="menu"
                aria-label="有效业务日速选面板"
                onKeyDown={handleQuickDropdownKeyDown}
              >
                <div className="ca-quick-dates-header">
                  <span className="ca-quick-dates-title">有效采集日速选 ({allAvailableDates.length}日)</span>
                  <button
                    type="button"
                    className="ca-quick-dates-close"
                    onClick={() => {
                      setQuickPickerOpen(false);
                      quickToggleRef.current?.focus();
                    }}
                    aria-label="关闭"
                  >
                    ✕
                  </button>
                </div>
                <div className="ca-quick-dates-grid">
                  {allAvailableDates.map((d, idx) => {
                    const isSelected = d === selectedDate;
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`ca-quick-date-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          updateUrl({ day: d });
                          setQuickPickerOpen(false);
                          quickToggleRef.current?.focus();
                        }}
                      >
                        <span className="ca-quick-date-idx">{idx + 1}</span>
                        <span className="ca-quick-date-val">{d}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {maxAvailableDate && selectedDate !== maxAvailableDate && (
            <button
              type="button"
              className="ca-btn-reset"
              onClick={() => updateUrl({ day: maxAvailableDate })}
              title="切换至最新记录日"
            >
              最新日期 ({maxAvailableDate})
            </button>
          )}
        </div>

        <div className="ca-daily-status-meta">
          {isDateMissing ? (
            <span style={{ fontSize: 12, color: "#ce2c31", fontWeight: 600 }}>
              ⚠️ 该日期暂无流水记录 / {dayProgressLabel}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#008573", fontWeight: 500 }}>
              ● {dayProgressLabel} / 区间 {activeDataset.period}
            </span>
          )}
        </div>
      </div>

      {/* 3. 缺日明确诚实空态 (绝不静默替换为最新日期) */}
      {isDateMissing && (
        <div className="ca-daily-empty-box" role="alert">
          <div className="ca-daily-empty-icon">📅</div>
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
          {summaryMetrics.length > 0 && (
            <MetricStrip items={summaryMetrics} />
          )}

          {/* 当日分布与结构面板 (无虚假小时曲线，聚焦单日结构与跨数据集横向对照) */}
        <div className="ca-daily-grid">
          {/* 5.1 单日分布与结构组 */}
          {distributions.map((dist) => (
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
        </div>
        </div>
      )}

      {/* 6. 真实数据全量明细表格 (默认收起在 details 内部，所选日高亮突出) */}
      <details className="ca-daily-details-panel">
        <summary className="ca-daily-details-summary">
          <div className="ca-daily-details-summary-title">
            <span className="ca-daily-details-icon">📊</span>
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
