import type { CampaignDashboard } from "../../lib/campaign-types";
import type {
  CampaignDailyDataset,
  CampaignDailyMetric,
} from "../../lib/campaign-daily";
import { getCampaignDailyDatasets } from "../../lib/campaign-daily";

export type ComboSeriesKind = "bar" | "line" | "point";
export type ComboAxis = "left" | "right";

export type ComboSeries = {
  key: string;
  label: string;
  unit: string;
  axis: ComboAxis;
  kind: ComboSeriesKind;
  color?: string;
};

export interface DailyChartConfig {
  id: string;
  title: string;
  caption: string;
  series: ComboSeries[];
  isPrimary?: boolean;
  height?: number;
  xLabel?: string;
}

export interface SummaryMetricItem {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export const CAMPAIGN_PALETTE = {
  primary: "#2c7168",
  purple: "#8273a3",
  gold: "#b88a45",
  terracotta: "#bd7964",
  slate: "#8c9ba5",
  deepTeal: "#1e524b",
  coral: "#c25953",
  warmBg: "#f6f5f2",
  borderWarm: "#e6e3dc",
} as const;

export const VERIFIED_KEYWORD_LABELS: Record<string, string> = {
  kw_wipes: "稳健酒精湿巾",
  kw_corn_wipes: "稳健玉米酒精湿巾",
  kw_alcohol: "稳健酒精",
  kw_alcohol_wipes: "酒精湿巾稳健",
  kw_corn_alcohol_wipes: "玉米酒精湿巾",
  kw_disinfect_wipes: "稳健消毒湿巾",
};

export function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "—" || s === "null" || s === "undefined") return null;
  const cleaned = s.replace(/[,¥%]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(val: unknown, maxDigits = 2): string {
  const n = safeNum(val);
  if (n === null) return "—";
  return n.toLocaleString("zh-CN", { maximumFractionDigits: maxDigits });
}

export function fmtPct(val: unknown, maxDigits = 1): string {
  const n = safeNum(val);
  if (n === null) return "—";
  return `${n.toLocaleString("zh-CN", { maximumFractionDigits: maxDigits })}%`;
}

export function subtractCalendarDays(isoDate: string, days: number): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/**
 * 生成两日期间的日历序列。
 * 禁止静默调换逆序范围，当 start > end 时严格返回空数组。
 */
export function generateCalendarDates(start: string, end: string): string[] {
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return [];
  }
  if (start > end) {
    return [];
  }
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

export function resolveDailyDatasets(dashboard: CampaignDashboard): CampaignDailyDataset[] {
  const fromContract = getCampaignDailyDatasets(dashboard);
  if (fromContract && fromContract.length > 0) {
    if (dashboard.projectId === "meiling") {
      const tmSeed = fromContract.find((d) => d.id === "meiling-daily-tm-seed");
      const jdSeed = fromContract.find((d) => d.id === "meiling-daily-jd-seed");
      const cid = fromContract.find((d) => d.id === "meiling-daily-cid-jd");
      const rest = fromContract.filter(
        (d) => d.id !== "meiling-daily-tm-seed" && d.id !== "meiling-daily-jd-seed" && d.id !== "meiling-daily-cid-jd"
      );

      const reordered: CampaignDailyDataset[] = [];
      if (tmSeed) {
        reordered.push({
          ...tmSeed,
          label: `自采天猫种草日流水 (${tmSeed.rows.length}天 · 推荐)`,
        });
      }
      if (jdSeed) {
        reordered.push({
          ...jdSeed,
          label: `自采京东种草日流水 (${jdSeed.rows.length}天)`,
        });
      }
      if (cid) {
        reordered.push({
          ...cid,
          label: `京东对投CID日表现 (${cid.rows.length}天 · 30日归因 · 单子渠道)`,
        });
      }
      return [...reordered, ...rest];
    }
    return fromContract;
  }

  const fallback: CampaignDailyDataset[] = [];
  if (dashboard.projectId === "meiling") {
    const cidTable = dashboard.tables?.find((t: { id: string }) => t.id === "meiling-unlocked-double11-cid-daily");
    if (cidTable?.rows) {
      const validRows = cidTable.rows
        .filter((r: Record<string, unknown>) => {
          const d = String(r.date || "");
          return d && !/(合计|总计|汇总)/.test(d);
        })
        .map((r: Record<string, unknown>) => ({
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
          label: `京东对投CID日表现 (${sorted.length}天 · 30日归因 · 单子渠道)`,
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

export function buildCalendarRows(
  dataset: CampaignDailyDataset | null | undefined,
  startDate: string,
  endDate: string
): Array<Record<string, unknown>> {
  if (!dataset?.rows?.length || !startDate || !endDate || startDate > endDate) return [];
  const rowMap = new Map<string, Record<string, unknown>>();
  for (const r of dataset.rows) {
    if (r.date) {
      const cleanRow: Record<string, unknown> = { date: r.date };
      for (const [k, v] of Object.entries(r)) {
        cleanRow[k] = k === "date" ? v : safeNum(v);
      }
      rowMap.set(r.date, cleanRow);
    }
  }

  const calendarDates = generateCalendarDates(startDate, endDate);
  return calendarDates.map((dateStr) => {
    const existing = rowMap.get(dateStr);
    if (existing) return existing;
    const emptyRow: Record<string, unknown> = { date: dateStr };
    for (const m of dataset.metrics) {
      emptyRow[m.key] = null;
    }
    return emptyRow;
  });
}

function hasAnyValidValue(rows: Array<Record<string, unknown>>, key: string): boolean {
  return rows.some((r) => {
    const v = safeNum(r[key]);
    return v !== null;
  });
}

export function validateAxisUnits(series: ComboSeries[]): boolean {
  const leftUnits = new Set<string>();
  const rightUnits = new Set<string>();
  for (const s of series) {
    if (s.axis === "left") leftUnits.add(s.unit);
    else rightUnits.add(s.unit);
  }
  return leftUnits.size <= 1 && rightUnits.size <= 1;
}

export function filterActiveSeries(
  series: ComboSeries[],
  rows: Array<Record<string, unknown>>
): ComboSeries[] {
  return series.filter((s) => hasAnyValidValue(rows, s.key));
}

export function getDatasetChartConfigs(
  dataset: CampaignDailyDataset,
  filteredRows: Array<Record<string, unknown>>
): DailyChartConfig[] {
  const dsId = dataset.id;
  const isCid = dsId.includes("cid");
  const isTaosou = dsId.includes("taosou");
  const isKailas = dsId.includes("kailas");

  const metricMap = new Map<string, CampaignDailyMetric>();
  for (const m of dataset.metrics) {
    metricMap.set(m.key, m);
  }

  const configs: DailyChartConfig[] = [];

  if (isTaosou) {
    // 1. Primary: spend_total 元 (bars) + kw_total_index 指数 (line right)
    const primarySeries: ComboSeries[] = [
      { key: "spend_total", label: "总日消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "kw_total_index", label: "淘搜总指数", unit: "指数", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activePrimary = filterActiveSeries(primarySeries, filteredRows);
    if (activePrimary.length >= 2) {
      configs.push({
        id: "taosou-primary",
        title: "淘搜总指数与总消耗走势",
        caption: "同步观察淘搜总指数与总消耗走势，趋势仅供参考，不代表因果关系。",
        series: activePrimary,
        isPrimary: true,
        height: 300,
        xLabel: "日期",
      });
    }

    // 2. Multi-keyword lines (同指数, all left axis, kw_total_index NOT in this chart, no duplicate total)
    const kwMetricCandidates: Array<{ key: string; label: string }> = [];
    for (const m of dataset.metrics) {
      if (m.key.startsWith("kw_") && m.key !== "kw_total_index") {
        kwMetricCandidates.push({ key: m.key, label: m.label || VERIFIED_KEYWORD_LABELS[m.key] || m.key });
      }
    }
    if (filteredRows.length > 0) {
      for (const k of Object.keys(filteredRows[0])) {
        if (k.startsWith("kw_") && k !== "kw_total_index" && !kwMetricCandidates.some((c) => c.key === k)) {
          kwMetricCandidates.push({ key: k, label: VERIFIED_KEYWORD_LABELS[k] || k });
        }
      }
    }

    const kwColorPalette = [
      CAMPAIGN_PALETTE.primary,
      CAMPAIGN_PALETTE.purple,
      CAMPAIGN_PALETTE.gold,
      CAMPAIGN_PALETTE.terracotta,
      CAMPAIGN_PALETTE.deepTeal,
      CAMPAIGN_PALETTE.slate,
      CAMPAIGN_PALETTE.coral,
      "#3b82f6",
    ];

    const kwSeries: ComboSeries[] = kwMetricCandidates.slice(0, 8).map((c, idx) => ({
      key: c.key,
      label: c.label,
      unit: "指数",
      axis: "left",
      kind: "line",
      color: kwColorPalette[idx % kwColorPalette.length],
    }));
    const activeKw = filterActiveSeries(kwSeries, filteredRows);
    if (activeKw.length >= 2) {
      configs.push({
        id: "taosou-keywords",
        title: "各关键词淘搜指数走势",
        caption: "对比各关键词的每日淘搜指数走势。",
        series: activeKw,
        height: 280,
        xLabel: "日期",
      });
    }

    // 3. Grouped bars: K/F/S/CID 分渠道消耗 (同元, left axis, spend_total not double counted)
    const channelSeries: ComboSeries[] = [
      { key: "spend_k", label: "K端达人消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.gold },
      { key: "spend_f", label: "F端信息流消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "spend_s", label: "S端搜索推广消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
      { key: "spend_cid", label: "CID端消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.terracotta },
    ];
    const activeChannels = filterActiveSeries(channelSeries, filteredRows);
    if (activeChannels.length >= 2) {
      configs.push({
        id: "taosou-channels",
        title: "各渠道分日消耗分布",
        caption: "对比各渠道（达人K端、信息流F端、搜索S端、CID端）的每日消耗。",
        series: activeChannels,
        height: 280,
        xLabel: "日期",
      });
    }

    // 4. search_uv + shop_uv (搜索进店UV与全店总UV双线, 同轴人, 明确日UV非跨日去重, 不含redstar_uv)
    const uvSeries: ComboSeries[] = [
      { key: "search_uv", label: "搜索进店UV", unit: "人", axis: "left", kind: "line", color: CAMPAIGN_PALETTE.primary },
      { key: "shop_uv", label: "进店总UV", unit: "人", axis: "left", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activeUv = filterActiveSeries(uvSeries, filteredRows);
    if (activeUv.length >= 2) {
      configs.push({
        id: "taosou-uv-flow",
        title: "搜索进店UV与进店总UV",
        caption: "对比每日搜索进店UV与全店总UV（按日统计，非跨日去重，不包含30日归因的redstar_uv）。",
        series: activeUv,
        height: 280,
        xLabel: "日期",
      });
    }

    return configs;
  }

  if (isCid) {
    // 1. Primary: spend & GMV bars 同元 + ROI line 倍 (right)
    const primarySeries: ComboSeries[] = [
      { key: "spend", label: "广告花费", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "gmv", label: "成交GMV", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.gold },
      { key: "roi", label: "成交ROI", unit: "倍", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activePrimary = filterActiveSeries(primarySeries, filteredRows);
    if (activePrimary.length >= 2) {
      configs.push({
        id: "cid-primary",
        title: "京东对投CID - 花费、成交GMV与ROI",
        caption: "对比每日广告花费、30日归因成交GMV与归因成交ROI。",
        series: activePrimary,
        isPrimary: true,
        height: 300,
        xLabel: "日期",
      });
    }

    // 2. Clicks & CTR: clicks 次 (bars) + CTR % (line right)
    const clickSeries: ComboSeries[] = [
      { key: "clicks", label: "点击量", unit: "次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "ctr", label: "点击率", unit: "%", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activeClicks = filterActiveSeries(clickSeries, filteredRows);
    if (activeClicks.length >= 2) {
      configs.push({
        id: "cid-clicks",
        title: "CID 点击量与点击率 (CTR)",
        caption: "对比每日CID点击量与点击率 (CTR) 的数值。",
        series: activeClicks,
        height: 280,
        xLabel: "日期",
      });
    }

    // 3. Orders & UV: orders 单 (bar) + UV 人 (line right, 显式归因)
    const orderSeries: ComboSeries[] = [
      { key: "orders", label: "订单量", unit: "单", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.gold },
      { key: "uv", label: "进店UV (30日归因)", unit: "人", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.primary },
    ];
    const activeOrders = filterActiveSeries(orderSeries, filteredRows);
    if (activeOrders.length >= 2) {
      configs.push({
        id: "cid-orders",
        title: "CID 订单量与进店UV (30日归因)",
        caption: "对比每日CID订单量与进店访客 (UV) 的数值。",
        series: activeOrders,
        height: 280,
        xLabel: "日期",
      });
    }

    // 4. 4th chart only if data available: engagements & CPE
    if (metricMap.has("engagements") && metricMap.has("cpe")) {
      const engSeries: ComboSeries[] = [
        { key: "engagements", label: "互动量", unit: "次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
        { key: "cpe", label: "CPE", unit: "元", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.terracotta },
      ];
      const activeEng = filterActiveSeries(engSeries, filteredRows);
      if (activeEng.length >= 2) {
        configs.push({
          id: "cid-engagements",
          title: "CID 互动量与单次互动成本 (CPE)",
          caption: "对比每日CID渠道的互动量与单次互动成本 (CPE)。",
          series: activeEng,
          height: 280,
          xLabel: "日期",
        });
      }
    }

    return configs;
  }

  // Normal Paid Datasets & Wipes Delivery
  // 1. Primary: spend 元 (bars) + impressions 次 (line right)
  const spendMetric = metricMap.get("spend");
  const impMetric = metricMap.get("impressions");
  if (spendMetric && impMetric) {
    const primarySeries: ComboSeries[] = [
      { key: "spend", label: spendMetric.label || "广告消耗", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "impressions", label: impMetric.label || "展现量", unit: "次", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activePrimary = filterActiveSeries(primarySeries, filteredRows);
    if (activePrimary.length >= 2) {
      configs.push({
        id: "normal-primary",
        title: "广告消耗与曝光",
        caption: "同时查看每日消耗与展现量的变化。",
        series: activePrimary,
        isPrimary: true,
        height: 300,
        xLabel: "日期",
      });
    }
  }

  // 2. Efficiency: CPC 元 + CTR % (when both exist)
  if (metricMap.has("cpc") && metricMap.has("ctr")) {
    const effSeries: ComboSeries[] = [
      { key: "cpc", label: "点击成本 (CPC)", unit: "元", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.gold },
      { key: "ctr", label: "点击率 (CTR)", unit: "%", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.primary },
    ];
    const activeEff = filterActiveSeries(effSeries, filteredRows);
    if (activeEff.length >= 2) {
      configs.push({
        id: "normal-efficiency",
        title: "点击成本 (CPC) 与点击率 (CTR)",
        caption: "对比每日点击成本 (CPC) 与点击率 (CTR) 的变动。",
        series: activeEff,
        height: 280,
        xLabel: "日期",
      });
    }
  }

  // 3. Engagement: engagements 次 (bars) + CPE 元 (line right)
  if (metricMap.has("engagements") && metricMap.has("cpe")) {
    const engSeries: ComboSeries[] = [
      { key: "engagements", label: "互动量", unit: "次", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.primary },
      { key: "cpe", label: "互动成本 (CPE)", unit: "元", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.terracotta },
    ];
    const activeEng = filterActiveSeries(engSeries, filteredRows);
    if (activeEng.length >= 2) {
      configs.push({
        id: "normal-engagements",
        title: "互动量与单次互动成本 (CPE)",
        caption: "对比每日互动总量与单次互动成本 (CPE) 的走势。",
        series: activeEng,
        height: 280,
        xLabel: "日期",
      });
    }
  }

  // 4. Reach & UV: UV 人 (bars) + CPUV 元 (line right)
  if (metricMap.has("uv") && metricMap.has("cpuv")) {
    const uvSeries: ComboSeries[] = [
      { key: "uv", label: "进店UV (30日归因)", unit: "人", axis: "left", kind: "bar", color: CAMPAIGN_PALETTE.purple },
      { key: "cpuv", label: "访客获取成本 (CPUV)", unit: "元", axis: "right", kind: "line", color: CAMPAIGN_PALETTE.gold },
    ];
    const activeUv = filterActiveSeries(uvSeries, filteredRows);
    if (activeUv.length >= 2) {
      configs.push({
        id: "normal-uv",
        title: "进店访客 (UV) 与访客获取成本 (CPUV)",
        caption: "对比每日进店访客 (UV) 与单次进店访客成本 (CPUV)。",
        series: activeUv,
        height: 280,
        xLabel: "日期",
      });
    }
  }

  // Kailas additionally: seed_crowd & deep_seed_crowd 2 lines 同人 (nested, not stacked)
  if (isKailas && metricMap.has("seed_crowd") && metricMap.has("deep_seed_crowd")) {
    const crowdSeries: ComboSeries[] = [
      { key: "seed_crowd", label: "新增种草人群", unit: "人", axis: "left", kind: "line", color: CAMPAIGN_PALETTE.primary },
      { key: "deep_seed_crowd", label: "深度种草人群", unit: "人", axis: "left", kind: "line", color: CAMPAIGN_PALETTE.purple },
    ];
    const activeCrowd = filterActiveSeries(crowdSeries, filteredRows);
    if (activeCrowd.length >= 2) {
      configs.push({
        id: "kailas-seed-crowd",
        title: "新增种草人群与深度种草人群",
        caption: "同时查看每日新增种草人群与深度种草人群的数值。",
        series: activeCrowd,
        height: 280,
        xLabel: "日期",
      });
    }
  }

  return configs;
}

/**
 * 严格求和工具：
 * 接收完整的 calendarRows（包含缺日）。
 * 若区间内任一日期缺值（null），不以 0 充数，保留 "—" 并标注实际覆盖天数；
 * 仅当全区间所有日期均有值时才输出完整总额。
 */
export function computeStrictSum(
  rows: Array<Record<string, unknown>>,
  key: string
): { sum: number | null; validCount: number; totalCount: number; isComplete: boolean } {
  const totalCount = rows.length;
  if (totalCount === 0) {
    return { sum: null, validCount: 0, totalCount: 0, isComplete: false };
  }

  let total = 0;
  let validCount = 0;
  let hasNull = false;

  for (const r of rows) {
    const v = safeNum(r[key]);
    if (v !== null) {
      total += v;
      validCount += 1;
    } else {
      hasNull = true;
    }
  }

  if (validCount === 0 || hasNull) {
    return {
      sum: null,
      validCount,
      totalCount,
      isComplete: false,
    };
  }

  return {
    sum: total,
    validCount,
    totalCount,
    isComplete: true,
  };
}

export function computeSummaryMetrics(
  dataset: CampaignDailyDataset,
  calendarRows: Array<Record<string, unknown>>
): SummaryMetricItem[] {
  const isTaosou = dataset.id.includes("taosou");
  const totalDays = calendarRows.length;

  if (isTaosou) {
    const spendStrict = computeStrictSum(calendarRows, "spend_total");
    const kwValues = calendarRows.map((r) => safeNum(r.kw_total_index)).filter((v): v is number => v !== null);
    const maxKwIndex = kwValues.length ? Math.max(...kwValues) : null;
    const latestRow = [...calendarRows].filter((r) => safeNum(r.kw_total_index) !== null).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const latestIndex = latestRow ? safeNum(latestRow.kw_total_index) : null;

    const fSpendStrict = computeStrictSum(calendarRows, "spend_f");
    const kSpendStrict = computeStrictSum(calendarRows, "spend_k");

    return [
      {
        label: "周期累计总消耗",
        value: spendStrict.isComplete && spendStrict.sum !== null ? fmtNum(spendStrict.sum) : "—",
        unit: "元",
        note: spendStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${spendStrict.validCount}/${totalDays} 天 (含缺日)`,
      },
      {
        label: "淘搜总指数峰值",
        value: maxKwIndex !== null ? fmtNum(maxKwIndex, 0) : "—",
        unit: "指数",
        note: latestRow ? `最新: ${fmtNum(latestIndex, 0)} (${String(latestRow.date).slice(5)})` : "无有效指数记录",
      },
      {
        label: "信息流(F端)累计消耗",
        value: fSpendStrict.isComplete && fSpendStrict.sum !== null ? fmtNum(fSpendStrict.sum) : "—",
        unit: "元",
        note: fSpendStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${fSpendStrict.validCount}/${totalDays} 天`,
      },
      {
        label: "达人(K端)累计消耗",
        value: kSpendStrict.isComplete && kSpendStrict.sum !== null ? fmtNum(kSpendStrict.sum) : "—",
        unit: "元",
        note: kSpendStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${kSpendStrict.validCount}/${totalDays} 天`,
      },
    ];
  }

  // 1. Spend sum
  const spendStrict = computeStrictSum(calendarRows, "spend");

  // 2. Reach sum (impressions)
  const hasImp = dataset.metrics.some((m) => m.key === "impressions");
  const impStrict = hasImp ? computeStrictSum(calendarRows, "impressions") : null;

  // 3. Interactions sum (engagements or clicks)
  const hasEng = dataset.metrics.some((m) => m.key === "engagements");
  const hasClicks = dataset.metrics.some((m) => m.key === "clicks");
  const engStrict = hasEng
    ? computeStrictSum(calendarRows, "engagements")
    : hasClicks
    ? computeStrictSum(calendarRows, "clicks")
    : null;
  const interactionLabel = hasEng ? "周期互动总量" : "周期点击总量";

  // 4. Weighted cost metric
  // 严格区分：0消耗/正点击可得出CPC为0；CPC字段存在但分母为0或缺失则显示"—"，绝不跨指标偷换成其他成本
  let fourthMetric: SummaryMetricItem;

  if (dataset.id.includes("cid") && dataset.metrics.some((m) => m.key === "gmv")) {
    const gmvStrict = computeStrictSum(calendarRows, "gmv");
    if (spendStrict.isComplete && gmvStrict.isComplete && spendStrict.sum !== null && gmvStrict.sum !== null) {
      if (spendStrict.sum === 0) {
        fourthMetric = {
          label: "周期归因 ROI",
          value: "—",
          unit: "倍",
          note: "消耗为0，无有效分母",
        };
      } else {
        const roi = gmvStrict.sum / spendStrict.sum;
        fourthMetric = {
          label: "周期归因 ROI",
          value: fmtNum(roi, 2),
          unit: "倍",
          note: `30日归因成交GMV ${fmtNum(gmvStrict.sum)}元 / 总花费`,
        };
      }
    } else {
      fourthMetric = {
        label: "周期归因 ROI",
        value: "—",
        unit: "倍",
        note: `已覆盖 ${Math.min(spendStrict.validCount, gmvStrict.validCount)}/${totalDays} 天 (含缺日)`,
      };
    }
  } else if (hasClicks) {
    const clicksStrict = computeStrictSum(calendarRows, "clicks");
    if (spendStrict.isComplete && clicksStrict.isComplete && spendStrict.sum !== null && clicksStrict.sum !== null) {
      if (clicksStrict.sum === 0) {
        fourthMetric = {
          label: "综合加权 CPC",
          value: "—",
          unit: "元/次",
          note: "点击量为0，无有效分母",
        };
      } else {
        // 0消耗 / 正点击 => CPC = 0.00
        const cpc = spendStrict.sum / clicksStrict.sum;
        fourthMetric = {
          label: "综合加权 CPC",
          value: fmtNum(cpc, 2),
          unit: "元/次",
          note: "区间总消耗 / 区间总点击 (完整统计)",
        };
      }
    } else {
      fourthMetric = {
        label: "综合加权 CPC",
        value: "—",
        unit: "元/次",
        note: `已覆盖 ${Math.min(spendStrict.validCount, clicksStrict.validCount)}/${totalDays} 天 (含缺日未全计入)`,
      };
    }
  } else if (dataset.metrics.some((m) => m.key === "cpuv")) {
    const uvStrict = computeStrictSum(calendarRows, "uv");
    if (spendStrict.isComplete && uvStrict.isComplete && spendStrict.sum !== null && uvStrict.sum !== null) {
      if (uvStrict.sum === 0) {
        fourthMetric = {
          label: "综合加权 CPUV",
          value: "—",
          unit: "元/人",
          note: "访客量为0，无有效分母",
        };
      } else {
        const cpuv = spendStrict.sum / uvStrict.sum;
        fourthMetric = {
          label: "综合加权 CPUV",
          value: fmtNum(cpuv, 2),
          unit: "元/人",
          note: "总消耗 / 归因UV求和 (非跨日去重)",
        };
      }
    } else {
      fourthMetric = {
        label: "综合加权 CPUV",
        value: "—",
        unit: "元/人",
        note: `已覆盖 ${Math.min(spendStrict.validCount, uvStrict.validCount)}/${totalDays} 天 (含缺日未全计入)`,
      };
    }
  } else {
    fourthMetric = {
      label: "单位成本指标",
      value: "—",
      unit: "元",
      note: "无对应成本定义",
    };
  }

  return [
    {
      label: "周期累计总消耗",
      value: spendStrict.isComplete && spendStrict.sum !== null ? fmtNum(spendStrict.sum) : "—",
      unit: "元",
      note: spendStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${spendStrict.validCount}/${totalDays} 天 (含缺日未全计入)`,
    },
    {
      label: "周期展现总量",
      value: impStrict && impStrict.isComplete && impStrict.sum !== null ? fmtNum(impStrict.sum, 0) : "—",
      unit: "次",
      note: impStrict ? (impStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${impStrict.validCount}/${totalDays} 天`) : "无展现指标",
    },
    {
      label: interactionLabel,
      value: engStrict && engStrict.isComplete && engStrict.sum !== null ? fmtNum(engStrict.sum, 0) : "—",
      unit: "次",
      note: engStrict ? (engStrict.isComplete ? `${totalDays}天完整统计` : `已覆盖 ${engStrict.validCount}/${totalDays} 天`) : "无互动指标",
    },
    fourthMetric,
  ];
}
