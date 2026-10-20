"use client";

import React, { useState, useMemo } from "react";
import type { CampaignDashboard } from "../../lib/campaign-types";
import {
  getCampaignDailyDatasets,
  type CampaignDailyDataset,
  type CampaignDailyMetric,
} from "../../lib/campaign-daily";
import { TimeSeriesChart } from "../../components/ui/TimeSeriesChart";
import {
  CAMPAIGN_PALETTE,
  MetricStrip,
  ChartPanel,
} from "./CampaignCharts";
import "./campaign-analytics.css";
import "./CampaignDailyPage.css";

export interface CampaignDailyPageProps {
  dashboard: CampaignDashboard;
}

type ChartRow = { date: string; [key: string]: string | number | null };

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "—" || s === "null" || s === "undefined") return null;
  const cleaned = s.replace(/[,¥%]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(val: unknown, maxDigits = 2): string {
  const n = safeNum(val);
  if (n === null) return "—";
  return n.toLocaleString("zh-CN", { maximumFractionDigits: maxDigits });
}

// 判定指标是否为可累加的绝对量指标 (只有消耗、点击、曝光、订单等才可求和；CPC/CTR/ROI/CPUV/UV绝不可求和)
function isAdditiveMetric(key: string): boolean {
  const k = key.toLowerCase();
  return /^(spend|spend_total|spend_k|spend_f|spend_s|spend_cid|impressions|clicks|engagements|orders|search_clicks|creatives_count)$/.test(k);
}

// 计算日历天偏移 (支持跨月份准确计算日历日期)
function subtractCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// 生成两日期之间完整的连续日历日期序列
function generateCalendarDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * 解析分日数据集：
 * 1. 优先读取 Boole 落盘的真实分日数据集 (Kailas/Wipes/Meiling 创意与投放流水)；
 * 2. 美菱默认优先选用样本期更长的主流种草流水 (天猫19天/京东20天)，CID 明确标注 30日归因单子渠道；
 * 3. 若处于补齐过渡期，自底表动态提取，确保不中断。
 */
function resolveDatasets(dashboard: CampaignDashboard): CampaignDailyDataset[] {
  const fromContract = getCampaignDailyDatasets(dashboard);
  if (fromContract && fromContract.length > 0) {
    // 美菱优先推荐长业务期的自采天猫/京东种草流水，CID 3天明确标注
    if (dashboard.projectId === "meiling") {
      const tmSeed = fromContract.find((d) => d.id === "meiling-daily-tm-seed");
      const jdSeed = fromContract.find((d) => d.id === "meiling-daily-jd-seed");
      const cid = fromContract.find((d) => d.id === "meiling-daily-cid-jd");
      const rest = fromContract.filter((d) => d.id !== "meiling-daily-tm-seed" && d.id !== "meiling-daily-jd-seed" && d.id !== "meiling-daily-cid-jd");

      const reordered: CampaignDailyDataset[] = [];
      if (tmSeed) reordered.push({ ...tmSeed, label: "自采天猫种草日流水 (19天 · 推荐)" });
      if (jdSeed) reordered.push({ ...jdSeed, label: "自采京东种草日流水 (20天)" });
      if (cid) reordered.push({ ...cid, label: "京东对投CID日表现 (3天 · 30日归因 · 单子渠道)" });
      return [...reordered, ...rest];
    }
    return fromContract;
  }

  const fallback: CampaignDailyDataset[] = [];
  if (dashboard.projectId === "meiling") {
    const cidTable = dashboard.tables?.find((t) => t.id === "meiling-unlocked-double11-cid-daily");
    if (cidTable?.rows) {
      const validRows = cidTable.rows
        .filter((r) => {
          const d = String(r.date || "");
          return d && !/(合计|总计|汇总)/.test(d);
        })
        .map((r) => ({
          date: String(r.date || "").replace(/\//g, "-"),
          spend: safeNum(r.spend),
          impressions: safeNum(r.impressions),
          clicks: safeNum(r.clicks),
          interactions: safeNum(r.interactions),
          activeUv: safeNum(r.activeUv),
          cpc: safeNum(r.cpc),
          gmv: safeNum(r.gmv),
        }));

      if (validRows.length > 0) {
        const sorted = [...validRows].sort((a, b) => a.date.localeCompare(b.date));
        fallback.push({
          id: "meiling-cid-daily-fallback",
          label: "京东对投CID日表现 (3天 · 30日归因 · 单子渠道)",
          period: `${sorted[0].date} ~ ${sorted[sorted.length - 1].date}`,
          note: "京东对投CID分日流水 (30日归因 · 单子渠道)",
          metrics: [
            { key: "spend", label: "广告花费", unit: "元" },
            { key: "clicks", label: "点击量", unit: "次" },
            { key: "impressions", label: "曝光量", unit: "次" },
            { key: "activeUv", label: "进店UV", unit: "人" },
            { key: "cpc", label: "点击成本 (CPC)", unit: "元" },
          ],
          rows: sorted,
        });
      }
    }
  }
  return fallback;
}

export function CampaignDailyPage({ dashboard }: CampaignDailyPageProps) {
  const { name } = dashboard;
  const datasets = useMemo(() => resolveDatasets(dashboard), [dashboard]);

  // 派生选择状态，避免 useEffect 中同步 setState 产生 lint 警告
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const activeDataset = useMemo((): CampaignDailyDataset | null => {
    if (!datasets.length) return null;
    return datasets.find((d) => d.id === selectedDatasetId) || datasets[0];
  }, [datasets, selectedDatasetId]);

  const [selectedMetricKey, setSelectedMetricKey] = useState<string>("");
  const activeMetric = useMemo((): CampaignDailyMetric | null => {
    if (!activeDataset?.metrics.length) return null;
    return activeDataset.metrics.find((m) => m.key === selectedMetricKey) || activeDataset.metrics[0];
  }, [activeDataset, selectedMetricKey]);

  // 小额/比率类指标识别 (CPC/CPUV/CPE/ROI/CTR/CPM) 精确到 2 位小数，防止默认 Math.round 出现重复 0/1 刻度
  const isSmallScaleMetric = useMemo(() => {
    if (!activeMetric) return false;
    const k = activeMetric.key.toLowerCase();
    const u = activeMetric.unit || "";
    return /cpc|cpuv|cpe|roi|ctr/i.test(k) || u === "%" || (u === "元" && /cost|cpc|cpuv|cpe/i.test(k));
  }, [activeMetric]);

  const dailyValueFormatter = useMemo(() => {
    if (!isSmallScaleMetric) return undefined;
    return (v: number) => {
      if (v === 0) return "0";
      return v < 10 ? v.toFixed(2) : v.toFixed(1);
    };
  }, [isSmallScaleMetric]);

  // 日期范围处理：优先近可用业务日期范围
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

  // 日期区间筛选与日历补齐（缺失日插入 null 让 TimeSeriesChart 真实断开，绝不补零或连跨缺日）
  const chartAndTableRows = useMemo((): ChartRow[] => {
    if (!activeDataset?.rows || !startDate || !endDate) return [];
    const rowMap = new Map<string, ChartRow>();
    for (const r of activeDataset.rows) {
      if (r.date) rowMap.set(r.date, r);
    }

    const calendarDates = generateCalendarDates(startDate, endDate);
    return calendarDates.map((dateStr) => {
      const existing = rowMap.get(dateStr);
      if (existing) {
        return existing;
      }
      // 缺日插入包含 date 与 null 指标的空记录，驱动 TimeSeriesChart 路径断开
      const emptyRow: ChartRow = { date: dateStr };
      for (const m of activeDataset.metrics) {
        emptyRow[m.key] = null;
      }
      return emptyRow;
    });
  }, [activeDataset, startDate, endDate]);

  // 仅包含有效源数据的行 (供表格降序展示)
  const presentTableRows = useMemo(() => {
    return chartAndTableRows.filter((r) => {
      return activeDataset?.metrics.some((m) => safeNum(r[m.key]) !== null);
    });
  }, [chartAndTableRows, activeDataset]);

  // 快捷区间处理：按日历天回溯 6 天 / 13 天
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

  // 当前指标业务统计 Strip：严格区分可加与非可加指标
  const metricStats = useMemo(() => {
    if (!presentTableRows.length || !activeMetric) return null;
    const isAdditive = isAdditiveMetric(activeMetric.key);

    const validEntries = presentTableRows
      .map((r) => ({ date: String(r.date), val: safeNum(r[activeMetric.key]) }))
      .filter((e): e is { date: string; val: number } => e.val !== null);

    if (!validEntries.length) return null;

    const values = validEntries.map((e) => e.val);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxEntry = validEntries.find((e) => e.val === maxVal);
    const minEntry = validEntries.find((e) => e.val === minVal);

    // 最新日值 (按日期排序最近一天)
    const latestEntry = [...validEntries].sort((a, b) => b.date.localeCompare(a.date))[0];

    if (isAdditive) {
      const sumVal = values.reduce((a, b) => a + b, 0);
      return {
        isAdditive: true,
        item1Label: "区间累计总额",
        item1Value: fmtNum(sumVal),
        item1Note: `${validEntries.length}个有效记录日累计`,
        item2Label: "单日最高峰值",
        item2Value: fmtNum(maxVal),
        item2Note: maxEntry ? `于 ${maxEntry.date}` : undefined,
        item3Label: "单日最低谷值",
        item3Value: fmtNum(minVal),
        item3Note: minEntry ? `于 ${minEntry.date}` : undefined,
        item4Label: "记录天数",
        item4Value: `${validEntries.length}`,
        item4Note: `区间跨度: ${startDate} ~ ${endDate}`,
      };
    }

    // 非可加指标 (CPC / CTR / ROI / CPUV / UV / 指数等) 绝不显示累计总和或普通平均
    return {
      isAdditive: false,
      item1Label: `最新日值 (${latestEntry?.date || "最新"})`,
      item1Value: fmtNum(latestEntry?.val),
      item1Note: "单日指标不按区间累加",
      item2Label: "单日最低值",
      item2Value: fmtNum(minVal),
      item2Note: minEntry ? `于 ${minEntry.date}` : undefined,
      item3Label: "单日最高值",
      item3Value: fmtNum(maxVal),
      item3Note: maxEntry ? `于 ${maxEntry.date}` : undefined,
      item4Label: "有效记录天数",
      item4Value: `${validEntries.length}`,
      item4Note: "比率与独立访客按单日核对",
    };
  }, [presentTableRows, activeMetric, startDate, endDate]);

  // 诚实空态处理：无真实分日源时绝不绘制全零走势
  if (!datasets.length || !activeDataset || !activeDataset.rows.length) {
    return (
      <div className="ca-page" role="main" aria-label={`${name} 分日趋势`}>
        <header className="ca-header">
          <div className="ca-header-heading">
            <div className="ca-header-title-row">
              <h1 className="ca-header-title">{name} · 分日看板</h1>
              <span className="ca-header-badge">逐日趋势</span>
            </div>
            <p className="ca-header-subtitle">
              严格基于真实日期采集，缺失断流不作虚假补零拟合
            </p>
          </div>
        </header>

        <div className="ca-daily-empty-box">
          <div className="ca-daily-empty-icon">📅</div>
          <h3 className="ca-daily-empty-title">当前项目暂无逐日分日流水记录</h3>
          <p className="ca-daily-empty-desc">
            根据业务源表审核结果，本项目当前为阶段性小结/日报聚合切片，未收录连续日级别流水；
            系统秉持诚实数据原则，不以全零连线绘制虚假趋势图。项目总览与考核指标看板正常服务。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ca-page" role="main" aria-label={`${name} 分日趋势看板`}>
      {/* 1. Header (单行 h1 + 周期说明 + 数据集切换) */}
      <header className="ca-header">
        <div className="ca-header-heading">
          <div className="ca-header-title-row">
            <h1 className="ca-header-title">{name} · 分日趋势看板</h1>
            <span className="ca-header-badge">逐日流水</span>
            <span className="ca-header-subtitle">
              {activeDataset.label} ({activeDataset.period})
            </span>
          </div>
        </div>

        {datasets.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ca-filter-label">数据流水:</span>
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
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* 2. 交互式筛选工具栏 (单指标切换 + 真实日历日期区间筛选) */}
      <div className="ca-daily-toolbar" role="toolbar" aria-label="图表筛选工具栏">
        <div className="ca-filter-section">
          <span className="ca-filter-label">分析指标:</span>
          <div className="ca-metric-pills" role="radiogroup" aria-label="选择图表分析指标">
            {activeDataset.metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`ca-metric-pill-btn ${activeMetric?.key === m.key ? "active" : ""}`}
                onClick={() => setSelectedMetricKey(m.key)}
                role="radio"
                aria-checked={activeMetric?.key === m.key}
              >
                {m.label} {m.unit ? `(${m.unit})` : ""}
              </button>
            ))}
          </div>
        </div>

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
      </div>

      {/* 3. 当前指标区间统计 Strip (4 核心指标，非可加指标不求和) */}
      {metricStats && activeMetric && (
        <MetricStrip
          items={[
            {
              label: metricStats.item1Label,
              value: metricStats.item1Value,
              unit: activeMetric.unit,
              note: metricStats.item1Note,
            },
            {
              label: metricStats.item2Label,
              value: metricStats.item2Value,
              unit: activeMetric.unit,
              note: metricStats.item2Note,
            },
            {
              label: metricStats.item3Label,
              value: metricStats.item3Value,
              unit: activeMetric.unit,
              note: metricStats.item3Note,
            },
            {
              label: metricStats.item4Label,
              value: metricStats.item4Value,
              unit: "天",
              note: metricStats.item4Note,
            },
          ]}
        />
      )}

      {/* 4. 核心时间序列折线图 (TimeSeriesChart，缺日断开不连线或补0) */}
      {activeMetric && (
        <ChartPanel
          title={`${activeDataset.label} - ${activeMetric.label} 趋势`}
          subtitle={`统计区间: ${startDate} ~ ${endDate} · 单位: ${activeMetric.unit || "—"}`}
          actions={
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              共 {presentTableRows.length} 个采集样本
            </span>
          }
        >
          <TimeSeriesChart
            rows={chartAndTableRows}
            series={[
              {
                key: activeMetric.key,
                label: activeMetric.label,
                color: CAMPAIGN_PALETTE.primary,
              },
            ]}
            title={`${activeDataset.label} - ${activeMetric.label} 趋势`}
            unit={activeMetric.unit || ""}
            height={260}
            valueFormatter={dailyValueFormatter}
          />
        </ChartPanel>
      )}

      {/* 5. 分日数据真实明细表格 (按日期降序排列) */}
      <ChartPanel
        title={`${activeDataset.label} 分日明细记录`}
        subtitle="按日期降序排列 · 缺值保持留白 (—)"
        actions={
          <span style={{ fontSize: 11.5, color: "#64748b" }}>
            当前筛选区间内包含 {presentTableRows.length} 条有效流水
          </span>
        }
      >
        <div className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr>
                <th>日期</th>
                {activeDataset.metrics.map((m) => (
                  <th
                    key={m.key}
                    style={{
                      textAlign: "right",
                      color: m.key === activeMetric?.key ? CAMPAIGN_PALETTE.primary : undefined,
                      fontWeight: m.key === activeMetric?.key ? "700" : undefined,
                    }}
                  >
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
                    所选日期区间无记录
                  </td>
                </tr>
              ) : (
                [...presentTableRows].reverse().map((row) => (
                  <tr key={String(row.date)}>
                    <td style={{ fontWeight: "600", color: "#1e293b" }}>{row.date}</td>
                    {activeDataset.metrics.map((m) => {
                      const raw = row[m.key];
                      const valStr = fmtNum(raw);
                      const isHighlight = m.key === activeMetric?.key;
                      return (
                        <td
                          key={m.key}
                          style={{
                            textAlign: "right",
                            fontWeight: isHighlight ? "600" : "400",
                            color: isHighlight ? CAMPAIGN_PALETTE.primary : undefined,
                          }}
                        >
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
      </ChartPanel>

      {/* 6. 页脚精简说明 (绝不展示来源管理或 source URL) */}
      <footer className="ca-footer-date">
        业务统计区间: {activeDataset.period} · 提取时间: 2026-10-19
      </footer>
    </div>
  );
}

export default CampaignDailyPage;
