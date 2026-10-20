"use client";

import React, { useState, useMemo } from "react";
import type { CampaignDashboard } from "../../lib/campaign-types";
import { MetricStrip, ChartPanel } from "./CampaignCharts";
import { CampaignComboChart } from "./CampaignComboChart";
import {
  resolveDailyDatasets,
  buildCalendarRows,
  subtractCalendarDays,
  getDatasetChartConfigs,
  computeSummaryMetrics,
  fmtNum,
  safeNum,
} from "./campaign-daily-model";
import "./campaign-analytics.css";
import "./campaign-combo.css";
import "./campaign-daily.css";

export interface CampaignDailyPageProps {
  dashboard: CampaignDashboard;
}

function formatDatasetDisplay(id: string, fallback: string): string {
  if (id === "meiling-daily-tm-seed") return "自采天猫种草";
  if (id === "meiling-daily-cid-jd" || id === "meiling-cid-daily-fallback") return "京东对投 CID";
  if (id === "meiling-daily-jd-seed") return "自采京东种草";
  if (id === "wipes-daily-delivery") return "日常种草";
  if (id === "wipes-daily-taosou" || id === "wipes-daily-taosearch") return "淘搜表现";
  if (id === "kailas-daily-fuga-creatives") return "凯乐石日常投放";
  return fallback;
}

export function CampaignDailyPage({ dashboard }: CampaignDailyPageProps) {
  const name = dashboard?.name || "项目";
  const datasets = useMemo(() => (dashboard ? resolveDailyDatasets(dashboard) : []), [dashboard]);

  // Selected dataset
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const activeDataset = useMemo(() => {
    if (!datasets.length) return null;
    return datasets.find((d) => d.id === selectedDatasetId) || datasets[0];
  }, [datasets, selectedDatasetId]);

  // Available dates for range clamping
  const allAvailableDates = useMemo(() => {
    if (!activeDataset?.rows) return [];
    return activeDataset.rows
      .map((r) => r.date)
      .filter(Boolean)
      .sort();
  }, [activeDataset]);

  const minAvailableDate = allAvailableDates[0] || "";
  const maxAvailableDate = allAvailableDates[allAvailableDates.length - 1] || "";

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const startDate = customStartDate || minAvailableDate;
  const endDate = customEndDate || maxAvailableDate;

  // 严格检查日期逆序：start > end 禁止出图，展示明确提示
  const isDateOrderInvalid = Boolean(startDate && endDate && startDate > endDate);

  // Calendar dates with missing gaps filled as null (lines break, zero distinct from null)
  const chartAndTableRows = useMemo(() => {
    if (isDateOrderInvalid) return [];
    return buildCalendarRows(activeDataset, startDate, endDate);
  }, [activeDataset, startDate, endDate, isDateOrderInvalid]);

  // Valid present rows for table (inspectable in details)
  const presentTableRows = useMemo(() => {
    if (!activeDataset || isDateOrderInvalid) return [];
    return chartAndTableRows.filter((r) => {
      return activeDataset.metrics.some((m) => safeNum(r[m.key]) !== null);
    });
  }, [chartAndTableRows, activeDataset, isDateOrderInvalid]);

  // 4 Fixed compact business summary metrics (传入完整 calendarRows，缺日不隐瞒)
  const summaryMetrics = useMemo(() => {
    if (!activeDataset || isDateOrderInvalid) return [];
    return computeSummaryMetrics(activeDataset, chartAndTableRows);
  }, [activeDataset, chartAndTableRows, isDateOrderInvalid]);

  // 3-5 multi-metric business combination chart configs (each axis same unit, >=2 series)
  const chartConfigs = useMemo(() => {
    if (!activeDataset || isDateOrderInvalid) return [];
    return getDatasetChartConfigs(activeDataset, chartAndTableRows);
  }, [activeDataset, chartAndTableRows, isDateOrderInvalid]);

  // Preset date shortcuts
  const handleQuickPreset = (preset: "all" | "7d" | "14d") => {
    if (!maxAvailableDate) return;
    if (preset === "all") {
      setCustomStartDate(minAvailableDate);
      setCustomEndDate(maxAvailableDate);
    } else if (preset === "7d") {
      setCustomStartDate(subtractCalendarDays(maxAvailableDate, 6));
      setCustomEndDate(maxAvailableDate);
    } else if (preset === "14d") {
      setCustomStartDate(subtractCalendarDays(maxAvailableDate, 13));
      setCustomEndDate(maxAvailableDate);
    }
  };

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
      <div className="ca-page" role="main" aria-label={`${name} 分日趋势`}>
        <header className="ca-header bd-toolbar-compact">
          <div className="ca-header-heading">
            <div className="ca-header-title-row">
              <h2 className="ca-header-title">分日看板</h2>
              <span className="ca-header-badge">逐日趋势</span>
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
    <div className="ca-page" role="main" aria-label={`${name} 分日趋势看板`}>
      {/* 1. Header (紧凑元信息 toolbar + 周期说明 + 数据集切换) */}
      <header className="ca-header bd-toolbar-compact">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h2 className="ca-header-title">分日看板</h2>
            <span className="ca-header-badge">多维业务比对</span>
            <span className="ca-header-subtitle">
              {formatDatasetDisplay(activeDataset.id, activeDataset.label)} ({activeDataset.period})
            </span>
          </div>
        </div>

        <div className="ca-dataset-picker-wrap">
          {datasets.length > 1 && (
            <div className="ca-dataset-picker-item">
              <span className="ca-filter-label">分析范围:</span>
              <select
                className="ca-dataset-select"
                value={activeDataset.id}
                onChange={(e) => {
                  setSelectedDatasetId(e.target.value);
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                aria-label="选择分日数据集"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDatasetDisplay(d.id, d.label)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isWipes && alternateWipesId && (
            <button
              type="button"
              className="ca-btn-switch-dataset"
              onClick={() => {
                setSelectedDatasetId(alternateWipesId);
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              title="切换关联分日分析视角"
            >
              {alternateWipesLabel}
            </button>
          )}
        </div>
      </header>

      {/* 2. 日期区间控制工具栏 (保留真实日历快捷与日期控制，已完全移除单指标选择胶囊) */}
      <div className="ca-daily-toolbar" role="toolbar" aria-label="分日分析工具栏">
        <div className="ca-filter-section">
          <span className="ca-filter-label">业务日期区间:</span>
          <div className="ca-date-range-box">
            <input
              type="date"
              className="ca-date-input"
              value={startDate}
              min={minAvailableDate}
              max={maxAvailableDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              aria-label="起始日期"
            />
            <span className="ca-date-sep">~</span>
            <input
              type="date"
              className="ca-date-input"
              value={endDate}
              min={minAvailableDate}
              max={maxAvailableDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              aria-label="结束日期"
            />
          </div>

          <button
            type="button"
            className="ca-btn-reset"
            onClick={() => handleQuickPreset("all")}
            title="重置为全量业务期"
          >
            全量 ({allAvailableDates.length}天)
          </button>
          {allAvailableDates.length > 7 && (
            <button
              type="button"
              className="ca-btn-reset"
              onClick={() => handleQuickPreset("7d")}
              title="按日历天回溯最近7天"
            >
              近7天
            </button>
          )}
          {allAvailableDates.length > 14 && (
            <button
              type="button"
              className="ca-btn-reset"
              onClick={() => handleQuickPreset("14d")}
              title="按日历天回溯最近14天"
            >
              近14天
            </button>
          )}
        </div>

        {!isDateOrderInvalid && (
          <div style={{ fontSize: 11.5, color: "#64748b" }}>
            有效采集 <strong>{presentTableRows.length}</strong> 天 · 日历跨度{" "}
            <strong>{chartAndTableRows.length}</strong> 天
          </div>
        )}
      </div>

      {/* 3. 日期逆序异常提示 */}
      {isDateOrderInvalid && (
        <div className="ca-daily-empty-box" role="alert">
          <div className="ca-daily-empty-icon">⚠️</div>
          <h3 className="ca-daily-empty-title">起始日期不能晚于结束日期</h3>
          <p className="ca-daily-empty-desc">
            当前选择的起始日期 ({startDate}) 晚于结束日期 ({endDate})，请调整有效日期范围。
          </p>
        </div>
      )}

      {/* 4. 空日期段明确空态 */}
      {!isDateOrderInvalid && (chartAndTableRows.length === 0 || presentTableRows.length === 0) && (
        <div className="ca-daily-empty-box">
          <div className="ca-daily-empty-icon">📅</div>
          <h3 className="ca-daily-empty-title">所选日期暂无记录</h3>
          <p className="ca-daily-empty-desc">
            所选日期区间内未包含任何采集记录，请调整日期区间。
          </p>
        </div>
      )}

      {/* 5. 4核心精炼业务指标 Strip (严格遵循业务加权与覆盖率，缺日留—) */}
      {!isDateOrderInvalid && chartAndTableRows.length > 0 && presentTableRows.length > 0 && (
        <MetricStrip items={summaryMetrics} />
      )}

      {/* 6. 多图联动业务面板 (默认2列等高约260px，奇数张最后一图跨两列) */}
      {!isDateOrderInvalid && chartAndTableRows.length > 0 && presentTableRows.length > 0 && (
        <div className="ca-daily-grid">
          {chartConfigs.map((cfg, idx) => {
            const isLastOdd = chartConfigs.length % 2 === 1 && idx === chartConfigs.length - 1;
            return (
              <div
                key={cfg.id}
                className={isLastOdd ? "ca-daily-panel ca-daily-panel-span-2" : "ca-daily-panel"}
              >
                <ChartPanel
                  title={cfg.title}
                  subtitle={
                    cfg.caption
                      ? `统计区间: ${startDate} ~ ${endDate} · ${cfg.caption}`
                      : `统计区间: ${startDate} ~ ${endDate}`
                  }
                  actions={
                    <span style={{ fontSize: 11.5, color: "#64748b" }}>
                      {cfg.series.length} 项联动指标
                    </span>
                  }
                >
                  <CampaignComboChart
                    rows={chartAndTableRows}
                    series={cfg.series}
                    xKey="date"
                    title={cfg.title}
                    height={260}
                    xLabel={cfg.xLabel}
                  />
                </ChartPanel>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. 真实数据全量明细表格 (默认收起在 details 内部，使图表视觉主导，展开可查验完整过滤行) */}
      {!isDateOrderInvalid && chartAndTableRows.length > 0 && presentTableRows.length > 0 && (
        <details className="ca-daily-details-panel">
          <summary className="ca-daily-details-summary">
            <div className="ca-daily-details-summary-title">
              <span className="ca-daily-details-icon">📊</span>
              <span>查看完整分日明细数据表</span>
              <span className="ca-daily-details-badge">共 {presentTableRows.length} 条有效记录</span>
            </div>
            <span className="ca-daily-details-hint">点击展开 / 收起明细</span>
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
                {presentTableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeDataset.metrics.length + 1}
                      style={{ textAlign: "center", padding: "24px 0", color: "#64748b" }}
                    >
                      所选日期暂无记录
                    </td>
                  </tr>
                ) : (
                  [...presentTableRows].reverse().map((row) => (
                    <tr key={String(row.date)}>
                      <td style={{ fontWeight: "600", color: "#1e293b" }}>{String(row.date)}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* 8. 页脚精简说明 */}
      <footer className="ca-footer-date">
        业务统计区间: {activeDataset.period}
      </footer>
    </div>
  );
}

export default CampaignDailyPage;
