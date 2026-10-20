/**
 * daily-diagnostics-model.ts
 *
 * Pure data transformations for Campaign Daily Diagnostics:
 * 1. Cumulative Spend vs Cumulative Output:
 *    - Strict prefix accumulation: accumulates strictly until first missing date, subsequent values null
 *    - No implicit zero-filling, no jumping over gaps
 *    - hasValidData requires spendPrefixCount > 0 && (!outputKey || outputPrefixCount > 0) && series >= 2
 *    - Preserves decimal precision on indices and GMV (no Math.round)
 * 2. Date x Metric Intensity Heatmap:
 *    - Accessible button cells with tabIndex, onFocus, onClick, and stable readout
 *    - Distinct palette per metric, gray on missing
 * 3. Daily Scale vs Cost Paired Scatter:
 *    - Accepts valid non-negative numbers (>= 0), preserving real 0 cost/ROI
 *    - Dynamic unit formatting on both axes (no hardcoded currency symbols on impressions)
 * 4. Weekly Pacing Scale + Weighted Efficiency:
 *    - Strict sum: weekSpend valid only when validDays === calendarDays in selected range
 *    - Weighted efficiency valid only when all days in the week range have valid numerator and denominator
 *    - Partial-week subsets show "—" and coverage, never disguised as whole-week total
 */

import type {
  CampaignDailyDataset,
  CampaignDailyMetric,
} from '../../lib/campaign-daily';
import { safeNum, fmtNum, CAMPAIGN_PALETTE, type ComboSeries } from './campaign-daily-model';

// ============================================================================
// 1. Cumulative Spend vs Output
// ============================================================================

export interface CumulativeTrendResult {
  rows: Array<Record<string, unknown>>;
  series: ComboSeries[];
  spendKey: string;
  outputKey: string;
  outputLabel: string;
  outputUnit: string;
  outputAxis: 'left' | 'right';
  spendPrefixCount: number;
  outputPrefixCount: number;
  totalDays: number;
  hasValidData: boolean;
}

export function computeCumulativeTrend(
  dataset: CampaignDailyDataset,
  calendarRows: Array<Record<string, unknown>>
): CumulativeTrendResult {
  const totalDays = calendarRows.length;
  const metricMap = new Map<string, CampaignDailyMetric>();
  for (const m of dataset.metrics) {
    metricMap.set(m.key, m);
  }

  // Determine spend metric
  const spendKey = metricMap.has('spend_total') ? 'spend_total' : 'spend';

  // Determine output metric: GMV > engagements > clicks > impressions > kw_total_index > uv
  let outputKey = '';
  let outputLabel = '';
  let outputUnit = '';

  if (metricMap.has('gmv')) {
    outputKey = 'gmv';
    outputLabel = '成交GMV';
    outputUnit = '元';
  } else if (metricMap.has('orders')) {
    outputKey = 'orders';
    outputLabel = '订单量';
    outputUnit = '单';
  } else if (metricMap.has('engagements')) {
    outputKey = 'engagements';
    outputLabel = '互动量';
    outputUnit = '次';
  } else if (metricMap.has('clicks')) {
    outputKey = 'clicks';
    outputLabel = '点击量';
    outputUnit = '次';
  } else if (metricMap.has('kw_total_index')) {
    outputKey = 'kw_total_index';
    outputLabel = '淘搜总指数';
    outputUnit = '指数';
  } else if (metricMap.has('impressions')) {
    outputKey = 'impressions';
    outputLabel = '展现量';
    outputUnit = '次';
  } else if (metricMap.has('uv')) {
    outputKey = 'uv';
    const uvM = metricMap.get('uv');
    outputLabel = uvM?.label || '进店UV';
    outputUnit = uvM?.unit || '人';
  }

  let runningSpend = 0;
  let spendBroken = false;
  let spendPrefixCount = 0;

  let runningOutput = 0;
  let outputBroken = false;
  let outputPrefixCount = 0;

  const trendRows = calendarRows.map((r) => {
    const rawSpend = safeNum(r[spendKey]);
    const rawOutput = outputKey ? safeNum(r[outputKey]) : null;

    // Rule: Strict prefix accumulation.
    // Accumulates continuously from start date. As soon as a raw value is missing/null,
    // that series is marked broken and all subsequent dates yield null.
    let curCumSpend: number | null = null;
    if (!spendBroken) {
      if (rawSpend !== null) {
        runningSpend += rawSpend;
        curCumSpend = Number(runningSpend.toFixed(2));
        spendPrefixCount += 1;
      } else {
        spendBroken = true;
        curCumSpend = null;
      }
    }

    let curCumOutput: number | null = null;
    if (outputKey && !outputBroken) {
      if (rawOutput !== null) {
        runningOutput += rawOutput;
        curCumOutput = outputUnit === '元' || outputUnit === '指数'
          ? Number(runningOutput.toFixed(2))
          : Number(runningOutput.toFixed(1));
        outputPrefixCount += 1;
      } else {
        outputBroken = true;
        curCumOutput = null;
      }
    }

    return {
      date: r.date,
      cum_spend: curCumSpend,
      cum_output: curCumOutput,
    };
  });

  const outputAxis: 'left' | 'right' = outputUnit === '元' ? 'left' : 'right';

  const series: ComboSeries[] = [];
  if (spendPrefixCount > 0) {
    series.push({
      key: 'cum_spend',
      label: '累计消耗',
      unit: '元',
      axis: 'left',
      kind: 'line',
      color: CAMPAIGN_PALETTE.primary,
    });
  }

  if (outputKey && outputPrefixCount > 0) {
    series.push({
      key: 'cum_output',
      label: `累计${outputLabel}`,
      unit: outputUnit,
      axis: outputAxis,
      kind: 'line',
      color: CAMPAIGN_PALETTE.purple,
    });
  }

  const hasValidData = Boolean(
    spendPrefixCount > 0 &&
    (!outputKey || outputPrefixCount > 0) &&
    series.length >= 2 &&
    totalDays > 0
  );

  return {
    rows: trendRows,
    series,
    spendKey,
    outputKey,
    outputLabel,
    outputUnit,
    outputAxis,
    spendPrefixCount,
    outputPrefixCount,
    totalDays,
    hasValidData,
  };
}

// ============================================================================
// 2. Date x Metric Heatmap
// ============================================================================

export interface HeatmapCell {
  date: string;
  value: number | null;
  formatted: string;
  unit: string;
  intensity: number; // 0 to 1
  isMissing: boolean;
}

export interface HeatmapMetricRow {
  key: string;
  label: string;
  unit: string;
  themeColor: string;
  cells: HeatmapCell[];
  minVal: number | null;
  maxVal: number | null;
  validCount: number;
}

const HEATMAP_METRIC_COLORS: Record<string, string> = {
  spend: '#2c7168',        // Warm Teal
  spend_total: '#2c7168',
  spend_f: '#1e524b',
  spend_s: '#8273a3',
  spend_k: '#b88a45',
  impressions: '#8273a3',  // Soft Purple
  clicks: '#bd7964',       // Terracotta
  engagements: '#b88a45',  // Warm Gold
  gmv: '#c25953',          // Coral / Red
  orders: '#0284c7',       // Blue
  uv: '#8c9ba5',           // Slate
  activeUv: '#8c9ba5',
  cpc: '#d97706',          // Amber
  cpe: '#e11d48',          // Rose
  cpuv: '#ea580c',         // Orange
  roi: '#059669',          // Green
  kw_total_index: '#7c3aed',
};

export function computeMetricHeatmap(
  dataset: CampaignDailyDataset,
  calendarRows: Array<Record<string, unknown>>
): HeatmapMetricRow[] {
  const candidateMetrics = dataset.metrics.filter((m) => {
    return calendarRows.some((r) => safeNum(r[m.key]) !== null);
  });

  const selectedMetrics = candidateMetrics.slice(0, 6);

  return selectedMetrics.map((m, idx) => {
    const values = calendarRows
      .map((r) => safeNum(r[m.key]))
      .filter((v): v is number => v !== null);

    const minVal = values.length ? Math.min(...values) : null;
    const maxVal = values.length ? Math.max(...values) : null;
    const range = minVal !== null && maxVal !== null && maxVal > minVal ? maxVal - minVal : 1;

    const themeColor =
      HEATMAP_METRIC_COLORS[m.key] ||
      [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta][
        idx % 4
      ];

    const cells: HeatmapCell[] = calendarRows.map((r) => {
      const raw = safeNum(r[m.key]);
      const isMissing = raw === null;
      const intensity = isMissing || minVal === null ? 0 : Math.max(0.12, (raw - minVal) / range);

      return {
        date: String(r.date || ''),
        value: raw,
        formatted: fmtNum(raw),
        unit: m.unit || '',
        intensity: Number(intensity.toFixed(3)),
        isMissing,
      };
    });

    return {
      key: m.key,
      label: m.label,
      unit: m.unit || '',
      themeColor,
      cells,
      minVal,
      maxVal,
      validCount: values.length,
    };
  });
}

// ============================================================================
// 3. Daily Scale vs Cost Scatter
// ============================================================================

export interface ScaleCostPoint {
  label: string;
  date: string;
  detail?: string;
  x: number;
  y: number;
  size: number | null;
}

export interface ScaleCostScatterResult {
  points: ScaleCostPoint[];
  scaleKey: string;
  costKey: string;
  scaleLabel: string;
  costLabel: string;
  scaleUnit: string;
  costUnit: string;
  xLabel: string;
  yLabel: string;
  hasEnoughPoints: boolean;
}

export function computeScaleCostScatter(
  dataset: CampaignDailyDataset,
  calendarRows: Array<Record<string, unknown>>
): ScaleCostScatterResult {
  const metricMap = new Map<string, CampaignDailyMetric>();
  for (const m of dataset.metrics) {
    metricMap.set(m.key, m);
  }

  // Scale metric: spend > spend_total > impressions > clicks
  let scaleKey = 'spend';
  let scaleLabel = '日广告消耗';
  let scaleUnit = '元';
  if (metricMap.has('spend_total')) {
    scaleKey = 'spend_total';
    scaleLabel = '总日消耗';
    scaleUnit = '元';
  } else if (!metricMap.has('spend') && metricMap.has('impressions')) {
    scaleKey = 'impressions';
    scaleLabel = '日展现量';
    scaleUnit = '次';
  } else if (!metricMap.has('spend') && metricMap.has('clicks')) {
    scaleKey = 'clicks';
    scaleLabel = '日点击量';
    scaleUnit = '次';
  }

  // Cost / Efficiency metric: cpc > cpuv > cpe > cpm > roi
  let costKey = '';
  let costLabel = '';
  let costUnit = '';

  if (metricMap.has('cpc')) {
    costKey = 'cpc';
    costLabel = '点击成本 (CPC)';
    costUnit = '元';
  } else if (metricMap.has('cpuv')) {
    costKey = 'cpuv';
    costLabel = '访客成本 (CPUV)';
    costUnit = '元';
  } else if (metricMap.has('cpe')) {
    costKey = 'cpe';
    costLabel = '互动成本 (CPE)';
    costUnit = '元';
  } else if (metricMap.has('cpm')) {
    costKey = 'cpm';
    costLabel = '千次展现成本 (CPM)';
    costUnit = '元';
  } else if (metricMap.has('roi')) {
    costKey = 'roi';
    costLabel = '成交产出比 (ROI)';
    costUnit = '倍';
  }

  if (!costKey) {
    return {
      points: [],
      scaleKey,
      costKey: '',
      scaleLabel,
      costLabel: '单位效率',
      scaleUnit,
      costUnit: '',
      xLabel: `${scaleLabel} (${scaleUnit})`,
      yLabel: '单位效率',
      hasEnoughPoints: false,
    };
  }

  const points: ScaleCostPoint[] = [];

  for (const r of calendarRows) {
    const xVal = safeNum(r[scaleKey]);
    const yVal = safeNum(r[costKey]);

    // Accept valid numbers >= 0, preserving real 0 costs/ROI
    if (
      typeof xVal === 'number' &&
      Number.isFinite(xVal) &&
      xVal >= 0 &&
      typeof yVal === 'number' &&
      Number.isFinite(yVal) &&
      yVal >= 0
    ) {
      const xStr = scaleUnit === '元' ? `¥${fmtNum(xVal)}` : `${fmtNum(xVal)} ${scaleUnit}`;
      const yStr = costUnit === '元' ? `¥${fmtNum(yVal)}` : `${fmtNum(yVal)} ${costUnit}`;
       const shortDate = String(r.date || '').slice(5); // "MM-DD" short label for scatter point
       const fullDetail = `${r.date} · ${scaleLabel}: ${xStr} · ${costLabel}: ${yStr}`;
      points.push({
         label: shortDate,
        date: String(r.date),
         detail: fullDetail,
        x: xVal,
        y: yVal,
        size: 8,
      });
    }
  }

  return {
    points,
    scaleKey,
    costKey,
    scaleLabel,
    costLabel,
    scaleUnit,
    costUnit,
    xLabel: `${scaleLabel} (${scaleUnit})`,
    yLabel: `${costLabel} (${costUnit})`,
    hasEnoughPoints: points.length >= 2,
  };
}

// ============================================================================
// 4. Weekly Pacing & Weighted Efficiency
// ============================================================================

export interface WeeklyPacingRow {
  weekLabel: string;
  startDate: string;
  endDate: string;
  calendarDays: number;
  validDays: number;
  isFullCalendarWeek: boolean;
  isCompleteInSpan: boolean;
  weekSpend: number | null;
  weekOutput: number | null;
  weightedEfficiency: number | null;
  efficiencyLabel: string;
  efficiencyUnit: string;
  coverageNote: string;
}

export interface WeeklyPacingResult {
  weeks: WeeklyPacingRow[];
  chartRows: Array<Record<string, unknown>>;
  series: ComboSeries[];
  hasValidData: boolean;
}

function getIsoWeekYear(dateStr: string): { weekNumber: number; year: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, year: date.getUTCFullYear() };
}

export function computeWeeklyPacing(
  dataset: CampaignDailyDataset,
  calendarRows: Array<Record<string, unknown>>
): WeeklyPacingResult {
  if (!calendarRows.length) {
    return { weeks: [], chartRows: [], series: [], hasValidData: false };
  }

  const metricMap = new Map<string, CampaignDailyMetric>();
  for (const m of dataset.metrics) {
    metricMap.set(m.key, m);
  }

  const spendKey = metricMap.has('spend_total') ? 'spend_total' : 'spend';

  let divisorKey = '';
  let effLabel = '';
  let effUnit = '';
  let isRoi = false;

  if (metricMap.has('gmv')) {
    divisorKey = 'gmv';
    effLabel = '周加权ROI';
    effUnit = '倍';
    isRoi = true;
  } else if (metricMap.has('clicks')) {
    divisorKey = 'clicks';
    effLabel = '周加权CPC';
    effUnit = '元/次';
  } else if (metricMap.has('uv')) {
    divisorKey = 'uv';
    const uvM = metricMap.get('uv');
    effLabel = '周加权CPUV';
    effUnit = `元/${uvM?.unit || '人'}`;
  } else if (metricMap.has('engagements')) {
    divisorKey = 'engagements';
    effLabel = '周加权CPE';
    effUnit = '元/次';
  }

  // Group dates by ISO week
  const weekGroups = new Map<string, Array<Record<string, unknown>>>();

  for (const r of calendarRows) {
    const dStr = String(r.date || '');
    if (!dStr) continue;
    const { weekNumber, year } = getIsoWeekYear(dStr);
    const wKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    if (!weekGroups.has(wKey)) {
      weekGroups.set(wKey, []);
    }
    weekGroups.get(wKey)!.push(r);
  }

  const weeks: WeeklyPacingRow[] = [];
  const chartRows: Array<Record<string, unknown>> = [];

  for (const [wKey, rows] of Array.from(weekGroups.entries())) {
    // calendarDays is the number of days belonging to this week in the user's selected range
    const calendarDays = rows.length;
    const validSpendRows = rows.filter((r) => safeNum(r[spendKey]) !== null);
    const validDays = validSpendRows.length;

    // Distinct separation:
    // 1. isFullCalendarWeek: whether this week has 7 days in the selected range
    // 2. isCompleteInSpan: whether all days in the selected span have valid data (no missing data)
    const isFullCalendarWeek = calendarDays === 7;
    const isCompleteInSpan = validDays === calendarDays && calendarDays > 0;

    let weekSpend: number | null = null;
    if (isCompleteInSpan) {
      const sum = validSpendRows.reduce((acc, r) => acc + (safeNum(r[spendKey]) || 0), 0);
      weekSpend = Number(sum.toFixed(2));
    }

    let weekOutput: number | null = null;
    let weightedEfficiency: number | null = null;

    if (divisorKey) {
      // Weighted efficiency requirement:
      // Requires EVERY date in this week's selected span to have both spend and divisor non-null.
      const allDaysHaveBoth = rows.every(
        (r) => safeNum(r[spendKey]) !== null && safeNum(r[divisorKey]) !== null
      );

      if (allDaysHaveBoth && isCompleteInSpan) {
        const mSpend = rows.reduce((acc, r) => acc + (safeNum(r[spendKey]) || 0), 0);
        const mDivisor = rows.reduce((acc, r) => acc + (safeNum(r[divisorKey]) || 0), 0);
        weekOutput = Number(mDivisor.toFixed(2));

        if (isRoi) {
          if (mSpend === 0) {
            weightedEfficiency = null; // zero denominator
          } else {
            weightedEfficiency = Number((mDivisor / mSpend).toFixed(2));
          }
        } else {
          if (mDivisor === 0) {
            weightedEfficiency = null; // zero denominator
          } else {
            weightedEfficiency = Number((mSpend / mDivisor).toFixed(2));
          }
        }
      }
    }

    const startD = String(rows[0].date).slice(5);
    const endD = String(rows[rows.length - 1].date).slice(5);
    const label = `${wKey.slice(5)} (${startD}~${endD})`;

    let coverageNote = '';
    if (isCompleteInSpan) {
      coverageNote = isFullCalendarWeek ? '7天整周完整' : `${calendarDays}天区间内完整(非整周)`;
    } else {
      coverageNote = `覆盖 ${validDays}/${calendarDays} 天 (含缺日)`;
    }

    const weekRow: WeeklyPacingRow = {
      weekLabel: label,
      startDate: String(rows[0].date),
      endDate: String(rows[rows.length - 1].date),
      calendarDays,
      validDays,
      isFullCalendarWeek,
      isCompleteInSpan,
      weekSpend,
      weekOutput,
      weightedEfficiency,
      efficiencyLabel: effLabel,
      efficiencyUnit: effUnit,
      coverageNote,
    };

    weeks.push(weekRow);

    chartRows.push({
      week: label,
      week_spend: weekSpend,
      weighted_eff: weightedEfficiency,
    });
  }

  const series: ComboSeries[] = [
    {
      key: 'week_spend',
      label: '周累计消耗',
      unit: '元',
      axis: 'left',
      kind: 'bar',
      color: CAMPAIGN_PALETTE.primary,
    },
  ];

  if (effLabel) {
    series.push({
      key: 'weighted_eff',
      label: effLabel,
      unit: effUnit,
      axis: 'right',
      kind: 'line',
      color: CAMPAIGN_PALETTE.gold,
    });
  }

  return {
    weeks,
    chartRows,
    series,
    hasValidData: weeks.some((w) => w.weekSpend !== null),
  };
}
