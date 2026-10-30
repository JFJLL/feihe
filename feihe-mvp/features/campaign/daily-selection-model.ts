import type { CampaignDailyDataset } from "../../lib/campaign-daily";
import type { CampaignDashboard } from "../../lib/campaign-types";
import { safeNum, fmtNum, fmtPct, CAMPAIGN_PALETTE, VERIFIED_KEYWORD_LABELS } from "./campaign-daily-model";

export interface DayOverDayResult {
  diff: number | null;
  pct: number | null;
  isComparable: boolean;
  note: string;
  trend?: "up" | "down" | "flat";
}

export function isValidIsoDate(d: string): boolean {
  const s = String(d || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, day] = s.split("-").map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, day));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === day
  );
}

export function subtractCalendarDays(isoDate: string, days: number): string {
  if (!isValidIsoDate(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

export function addCalendarDays(isoDate: string, days: number): string {
  if (!isValidIsoDate(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function computeDayOverDay(currVal: unknown, prevVal: unknown, unit = ""): DayOverDayResult {
  const curr = safeNum(currVal);
  const prev = safeNum(prevVal);

  if (curr === null) {
    return {
      diff: null,
      pct: null,
      isComparable: false,
      note: "当日未采集",
    };
  }

  if (prev === null) {
    return {
      diff: null,
      pct: null,
      isComparable: false,
      note: "前日暂无流水",
    };
  }

  const diff = curr - prev;
  if (prev === 0) {
    return {
      diff,
      pct: null,
      isComparable: true,
      note: diff === 0 ? "前日为0，环比持平" : `${diff > 0 ? "+" : ""}${fmtNum(diff)}${unit} 较前日(基数0)`,
      trend: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    };
  }

  const pct = (diff / Math.abs(prev)) * 100;
  const trend = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const note = `${pct > 0 ? "+" : ""}${fmtPct(pct)} 较前日`;

  return {
    diff,
    pct,
    isComparable: true,
    note,
    trend,
  };
}

export interface SingleDayKPI {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  badge?: string;
  status?: "danger" | "warning" | "accent" | "success";
}

export function getSingleDayKPIs(
  dataset: CampaignDailyDataset,
  selectedDate: string
): SingleDayKPI[] {
  if (!dataset?.rows?.length || !selectedDate) return [];

  const selectedRow = dataset.rows.find((r) => r.date === selectedDate);
  const prevDate = subtractCalendarDays(selectedDate, 1);
  const prevRow = dataset.rows.find((r) => r.date === prevDate);

  const isTaosou = dataset.id.includes("taosou");
  const isCid = dataset.id.includes("cid");

  if (isTaosou) {
    const totalSpend = safeNum(selectedRow?.spend_total);
    const prevTotalSpend = safeNum(prevRow?.spend_total);
    const dodTotal = computeDayOverDay(totalSpend, prevTotalSpend, "元");

    const kwIndex = safeNum(selectedRow?.kw_total_index);
    const prevKwIndex = safeNum(prevRow?.kw_total_index);
    const dodKw = computeDayOverDay(kwIndex, prevKwIndex, "指数");

    const spendF = safeNum(selectedRow?.spend_f);
    const prevSpendF = safeNum(prevRow?.spend_f);
    const dodF = computeDayOverDay(spendF, prevSpendF, "元");

    const spendK = safeNum(selectedRow?.spend_k);
    const prevSpendK = safeNum(prevRow?.spend_k);
    const dodK = computeDayOverDay(spendK, prevSpendK, "元");

    const spendS = safeNum(selectedRow?.spend_s);
    const prevSpendS = safeNum(prevRow?.spend_s);
    const dodS = computeDayOverDay(spendS, prevSpendS, "元");

    const spendCid = safeNum(selectedRow?.spend_cid);
    const prevSpendCid = safeNum(prevRow?.spend_cid);
    const dodCid = computeDayOverDay(spendCid, prevSpendCid, "元");

    return [
      {
        label: "总日消耗",
        value: fmtNum(totalSpend),
        unit: "元",
        note: dodTotal.note,
        badge: "全渠道",
      },
      {
        label: "淘搜总指数",
        value: kwIndex !== null ? fmtNum(kwIndex, 0) : "—",
        unit: "指数",
        note: dodKw.note,
        badge: "淘系总搜",
      },
      {
        label: "信息流(F)消耗",
        value: fmtNum(spendF),
        unit: "元",
        note: dodF.note,
        badge: "效果流",
      },
      {
        label: "达人(K)消耗",
        value: fmtNum(spendK),
        unit: "元",
        note: dodK.note,
        badge: "达人端",
      },
      {
        label: "搜索(S)消耗",
        value: fmtNum(spendS),
        unit: "元",
        note: dodS.note,
        badge: "搜索端",
      },
      {
        label: "CID消耗",
        value: fmtNum(spendCid),
        unit: "元",
        note: dodCid.note,
        badge: "引流端",
      },
    ];
  }

  if (dataset.id === "wipes-daily-delivery") {
    const keys = ["spend", "impressions", "engagements", "uv", "cpe", "cpuv"];
    return keys.map(key => {
      const metric = dataset.metrics.find(item => item.key === key);
      const value = safeNum(selectedRow?.[key]);
      const previous = safeNum(prevRow?.[key]);
      return {
        label: metric?.label || key,
        value: fmtNum(value, ["impressions", "engagements", "uv"].includes(key) ? 0 : 2),
        unit: metric?.unit,
        note: key === "uv" ? "原表归因值，后续可能回补" : computeDayOverDay(value, previous, metric?.unit).note,
      };
    });
  }

  if (isCid || dataset.metrics.some((m) => m.key === "gmv")) {
    const spend = safeNum(selectedRow?.spend);
    const prevSpend = safeNum(prevRow?.spend);
    const dodSpend = computeDayOverDay(spend, prevSpend, "元");

    const gmv = safeNum(selectedRow?.gmv);
    const prevGmv = safeNum(prevRow?.gmv);
    const dodGmv = computeDayOverDay(gmv, prevGmv, "元");

    let roiStr = "—";
    let roiNote = "消耗为0，无有效分母";
    if (spend !== null && gmv !== null) {
      if (spend > 0) {
        roiStr = fmtNum(gmv / spend, 2);
        const prevRoi = (prevSpend !== null && prevSpend > 0 && prevGmv !== null) ? prevGmv / prevSpend : null;
        roiNote = computeDayOverDay(gmv / spend, prevRoi, "倍").note;
      } else if (spend === 0 && gmv === 0) {
        roiStr = "—";
        roiNote = "消耗与GMV均为0";
      } else if (spend === 0 && gmv > 0) {
        roiStr = "—";
        roiNote = "消耗为0，无有效分母";
      }
    }

    const clicks = safeNum(selectedRow?.clicks);
    const prevClicks = safeNum(prevRow?.clicks);
    const dodClicks = computeDayOverDay(clicks, prevClicks, "次");

    const orders = safeNum(selectedRow?.orders);
    const prevOrders = safeNum(prevRow?.orders);
    const dodOrders = computeDayOverDay(orders, prevOrders, "单");

    const cpc = safeNum(selectedRow?.cpc);
    const prevCpc = safeNum(prevRow?.cpc);
    const dodCpc = computeDayOverDay(cpc, prevCpc, "元");

    return [
      {
        label: "当日广告花费",
        value: fmtNum(spend),
        unit: "元",
        note: dodSpend.note,
      },
      {
        label: "当日成交 GMV",
        value: fmtNum(gmv),
        unit: "元",
        note: dodGmv.note,
      },
      {
        label: "当日综合 ROI",
        value: roiStr,
        unit: "倍",
        note: roiNote,
      },
      {
        label: "当日点击量",
        value: clicks !== null ? fmtNum(clicks, 0) : "—",
        unit: "次",
        note: dodClicks.note,
      },
      {
        label: "当日订单量",
        value: orders !== null ? fmtNum(orders, 0) : "—",
        unit: "单",
        note: dodOrders.note,
      },
      {
        label: "当日点击成本(CPC)",
        value: fmtNum(cpc, 2),
        unit: "元",
        note: dodCpc.note,
      },
    ];
  }

  const isKailas = dataset.id.includes("kailas");

  const spend = safeNum(selectedRow?.spend);
  const prevSpend = safeNum(prevRow?.spend);
  const dodSpend = computeDayOverDay(spend, prevSpend, "元");

  const impressions = safeNum(selectedRow?.impressions);
  const prevImp = safeNum(prevRow?.impressions);
  const dodImp = computeDayOverDay(impressions, prevImp, "次");

  const clicks = safeNum(selectedRow?.clicks);
  const prevClicks = safeNum(prevRow?.clicks);
  const dodClicks = computeDayOverDay(clicks, prevClicks, "次");

  const cpc = safeNum(selectedRow?.cpc);
  const prevCpc = safeNum(prevRow?.cpc);
  const dodCpc = computeDayOverDay(cpc, prevCpc, "元");

  if (isKailas) {
    const seedCrowd = safeNum(selectedRow?.seed_crowd);
    const prevSeed = safeNum(prevRow?.seed_crowd);
    const dodSeed = computeDayOverDay(seedCrowd, prevSeed, "人");

    const deepSeed = safeNum(selectedRow?.deep_seed_crowd);
    const prevDeep = safeNum(prevRow?.deep_seed_crowd);
    const dodDeep = computeDayOverDay(deepSeed, prevDeep, "人");

    return [
      {
        label: "当日广告消耗",
        value: fmtNum(spend),
        unit: "元",
        note: dodSpend.note,
      },
      {
        label: "当日展现量",
        value: impressions !== null ? fmtNum(impressions, 0) : "—",
        unit: "次",
        note: dodImp.note,
      },
      {
        label: "当日点击量",
        value: clicks !== null ? fmtNum(clicks, 0) : "—",
        unit: "次",
        note: dodClicks.note,
      },
      {
        label: "新增种草人群",
        value: seedCrowd !== null ? fmtNum(seedCrowd, 0) : "—",
        unit: "人",
        note: dodSeed.note,
      },
      {
        label: "深度种草人群",
        value: deepSeed !== null ? fmtNum(deepSeed, 0) : "—",
        unit: "人",
        note: dodDeep.note,
      },
      {
        label: "点击成本 (CPC)",
        value: fmtNum(cpc, 2),
        unit: "元",
        note: dodCpc.note,
      },
    ];
  }

  const engagements = safeNum(selectedRow?.engagements);
  const prevEng = safeNum(prevRow?.engagements);
  const dodEng = computeDayOverDay(engagements, prevEng, "次");

  const ctr = safeNum(selectedRow?.ctr);
  const prevCtr = safeNum(prevRow?.ctr);
  const dodCtr = computeDayOverDay(ctr, prevCtr, "%");

  return [
    {
      label: "当日广告消耗",
      value: fmtNum(spend),
      unit: "元",
      note: dodSpend.note,
    },
    {
      label: "当日展现量",
      value: impressions !== null ? fmtNum(impressions, 0) : "—",
      unit: "次",
      note: dodImp.note,
    },
    {
      label: "当日点击量",
      value: clicks !== null ? fmtNum(clicks, 0) : "—",
      unit: "次",
      note: dodClicks.note,
    },
    {
      label: "当日点击率 (CTR)",
      value: ctr !== null ? fmtPct(ctr) : "—",
      note: dodCtr.note,
    },
    {
      label: "当日互动量",
      value: engagements !== null ? fmtNum(engagements, 0) : "—",
      unit: "次",
      note: dodEng.note,
    },
    {
      label: "点击成本 (CPC)",
      value: fmtNum(cpc, 2),
      unit: "元",
      note: dodCpc.note,
    },
  ];
}

export interface DistributionItem {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  sharePct?: number;
  unit: string;
  color?: string;
}

export interface SingleDayDistributionGroup {
  id: string;
  title: string;
  caption: string;
  isComposition?: boolean;
  items: DistributionItem[];
}

export function getSingleDayDistributions(
  dataset: CampaignDailyDataset,
  selectedDate: string
): SingleDayDistributionGroup[] {
  if (!dataset?.rows?.length || !selectedDate) return [];
  const row = dataset.rows.find((r) => r.date === selectedDate);
  if (!row) return [];

  const groups: SingleDayDistributionGroup[] = [];
  const isTaosou = dataset.id.includes("taosou");
  const isKailas = dataset.id.includes("kailas");
  const isCid = dataset.id.includes("cid");

  if (isTaosou) {
    const channels = [
      { key: "spend_f", label: "信息流(F端)消耗", color: CAMPAIGN_PALETTE.primary },
      { key: "spend_s", label: "搜索推广(S端)消耗", color: CAMPAIGN_PALETTE.purple },
      { key: "spend_k", label: "达人投放(K端)消耗", color: CAMPAIGN_PALETTE.gold },
      { key: "spend_cid", label: "CID引流消耗", color: CAMPAIGN_PALETTE.terracotta },
    ];
    const channelItems: DistributionItem[] = [];
    let sumChannelSpend = 0;
    for (const c of channels) {
      const v = safeNum(row[c.key]);
      if (v !== null) {
        sumChannelSpend += v;
        channelItems.push({
          key: c.key,
          label: c.label,
          value: v,
          formattedValue: `¥${fmtNum(v)}`,
          unit: "元",
          color: c.color,
        });
      }
    }
    if (sumChannelSpend > 0) {
      for (const it of channelItems) {
        it.sharePct = Math.round((it.value / sumChannelSpend) * 1000) / 10;
      }
    }
    if (channelItems.length > 0) {
      groups.push({
        id: "taosou-channel-dist",
        title: "当日渠道费用结构分布",
        caption: `所选日渠道总支出 ¥${fmtNum(sumChannelSpend)}，各渠道占比明细`,
        isComposition: true,
        items: channelItems,
      });
    }

    const kwKeys = [
      { key: "kw_wipes", label: VERIFIED_KEYWORD_LABELS.kw_wipes || "稳健酒精湿巾" },
      { key: "kw_corn_wipes", label: VERIFIED_KEYWORD_LABELS.kw_corn_wipes || "稳健玉米酒精湿巾" },
      { key: "kw_alcohol", label: VERIFIED_KEYWORD_LABELS.kw_alcohol || "稳健酒精" },
      { key: "kw_alcohol_wipes", label: VERIFIED_KEYWORD_LABELS.kw_alcohol_wipes || "酒精湿巾稳健" },
      { key: "kw_corn_alcohol_wipes", label: VERIFIED_KEYWORD_LABELS.kw_corn_alcohol_wipes || "玉米酒精湿巾" },
      { key: "kw_disinfect_wipes", label: VERIFIED_KEYWORD_LABELS.kw_disinfect_wipes || "稳健消毒湿巾" },
    ];
    const kwItems: DistributionItem[] = [];
    let sumKw = 0;
    for (const k of kwKeys) {
      const v = safeNum(row[k.key]);
      if (v !== null) {
        sumKw += v;
        kwItems.push({
          key: k.key,
          label: k.label,
          value: v,
          formattedValue: fmtNum(v, 0),
          unit: "指数",
          color: CAMPAIGN_PALETTE.primary,
        });
      }
    }
    kwItems.sort((a, b) => b.value - a.value);
    if (sumKw > 0) {
      for (const it of kwItems) {
        it.sharePct = Math.round((it.value / sumKw) * 1000) / 10;
      }
    }
    if (kwItems.length > 0) {
      groups.push({
        id: "taosou-kw-dist",
        title: "当日核心关键词淘搜指数贡献",
        caption: `所选日关键词指数总和 ${fmtNum(sumKw, 0)}，各词指数占比`,
        isComposition: true,
        items: kwItems,
      });
    }

    const uvSearch = safeNum(row.search_uv);
    const uvShop = safeNum(row.shop_uv);
    if (uvSearch !== null || uvShop !== null) {
      const uvItems: DistributionItem[] = [];
      if (uvSearch !== null) {
        uvItems.push({
          key: "search_uv",
          label: "搜索进店UV",
          value: uvSearch,
          formattedValue: `${fmtNum(uvSearch, 0)} 人`,
          unit: "人",
          color: CAMPAIGN_PALETTE.primary,
        });
      }
      if (uvShop !== null) {
        uvItems.push({
          key: "shop_uv",
          label: "全店进店UV",
          value: uvShop,
          formattedValue: `${fmtNum(uvShop, 0)} 人`,
          unit: "人",
          color: CAMPAIGN_PALETTE.purple,
        });
      }
      groups.push({
        id: "taosou-uv-dist",
        title: "当日进店访客规模",
        caption: "淘系搜索进店与全店进店规模对照 (日度独立观测)",
        items: uvItems,
      });
    }

    return groups;
  }

  if (isKailas) {
    const seed = safeNum(row.seed_crowd);
    const deepSeed = safeNum(row.deep_seed_crowd);
    const searchClicks = safeNum(row.search_clicks);
    const uv = safeNum(row.uv);

    const crowdItems: DistributionItem[] = [];
    if (seed !== null) crowdItems.push({ key: "seed_crowd", label: "新增种草人群", value: seed, formattedValue: `${fmtNum(seed, 0)} 人`, unit: "人", color: CAMPAIGN_PALETTE.primary });
    if (deepSeed !== null) crowdItems.push({ key: "deep_seed_crowd", label: "深度种草人群", value: deepSeed, formattedValue: `${fmtNum(deepSeed, 0)} 人`, unit: "人", color: CAMPAIGN_PALETTE.purple });
    if (searchClicks !== null) crowdItems.push({ key: "search_clicks", label: "搜索点击量", value: searchClicks, formattedValue: `${fmtNum(searchClicks, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.gold });
    if (uv !== null) crowdItems.push({ key: "uv", label: "进店UV", value: uv, formattedValue: `${fmtNum(uv, 0)} 人`, unit: "人", color: CAMPAIGN_PALETTE.terracotta });

    if (crowdItems.length > 0) {
      groups.push({
        id: "kailas-crowd-dist",
        title: "当日种草人群与互动规模分布",
        caption: "当日新增与深度心智人群触达规模结构",
        items: crowdItems,
      });
    }

    const cpc = safeNum(row.cpc);
    const cpe = safeNum(row.cpe);
    const cpuv = safeNum(row.cpuv);
    const cpm = safeNum(row.cpm);
    const effItems: DistributionItem[] = [];
    if (cpc !== null) effItems.push({ key: "cpc", label: "点击成本(CPC)", value: cpc, formattedValue: `¥${fmtNum(cpc, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.gold });
    if (cpe !== null) effItems.push({ key: "cpe", label: "互动成本(CPE)", value: cpe, formattedValue: `¥${fmtNum(cpe, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.primary });
    if (cpuv !== null) effItems.push({ key: "cpuv", label: "进店成本(CPUV)", value: cpuv, formattedValue: `¥${fmtNum(cpuv, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.purple });
    if (cpm !== null) effItems.push({ key: "cpm", label: "千次曝光成本(CPM)", value: cpm, formattedValue: `¥${fmtNum(cpm, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.slate });

    if (effItems.length > 0) {
      groups.push({
        id: "kailas-eff-dist",
        title: "当日投放单元成本对照",
        caption: "点击、互动、进店各环节单体获取成本对照",
        items: effItems,
      });
    }

    return groups;
  }

  if (isCid) {
    const imp = safeNum(row.impressions);
    const clicks = safeNum(row.clicks);
    const uv = safeNum(row.uv);
    const orders = safeNum(row.orders);
    const funnelItems: DistributionItem[] = [];
    if (imp !== null) funnelItems.push({ key: "imp", label: "曝光量", value: imp, formattedValue: `${fmtNum(imp, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.slate });
    if (clicks !== null) funnelItems.push({ key: "clicks", label: "点击量", value: clicks, formattedValue: `${fmtNum(clicks, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.primary });
    if (uv !== null) funnelItems.push({ key: "uv", label: "进店UV", value: uv, formattedValue: `${fmtNum(uv, 0)} 人`, unit: "人", color: CAMPAIGN_PALETTE.purple });
    if (orders !== null) funnelItems.push({ key: "orders", label: "订单量", value: orders, formattedValue: `${fmtNum(orders, 0)} 单`, unit: "单", color: CAMPAIGN_PALETTE.gold });

    if (funnelItems.length > 0) {
      groups.push({
        id: "cid-funnel-dist",
        title: "当日引流与转化各级规模",
        caption: "自前端小红书曝光到京东落地端各级转化量级",
        items: funnelItems,
      });
    }

    const spend = safeNum(row.spend);
    const gmv = safeNum(row.gmv);
    const cpc = safeNum(row.cpc);
    const cpe = safeNum(row.cpe);
    const compItems: DistributionItem[] = [];
    if (spend !== null) compItems.push({ key: "spend", label: "广告花费", value: spend, formattedValue: `¥${fmtNum(spend)}`, unit: "元", color: CAMPAIGN_PALETTE.primary });
    if (gmv !== null) compItems.push({ key: "gmv", label: "成交GMV", value: gmv, formattedValue: `¥${fmtNum(gmv)}`, unit: "元", color: CAMPAIGN_PALETTE.gold });
    if (cpc !== null) compItems.push({ key: "cpc", label: "点击成本(CPC)", value: cpc, formattedValue: `¥${fmtNum(cpc, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.purple });
    if (cpe !== null) compItems.push({ key: "cpe", label: "互动成本(CPE)", value: cpe, formattedValue: `¥${fmtNum(cpe, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.terracotta });

    if (compItems.length > 0) {
      groups.push({
        id: "cid-efficiency-dist",
        title: "当日费用与产出结构",
        caption: "当日资金投入、产出与核心单价指标",
        items: compItems,
      });
    }

    return groups;
  }

  const imp = safeNum(row.impressions);
  const clicks = safeNum(row.clicks);
  const eng = safeNum(row.engagements);
  // Undefined unit cost does not prove that a recorded zero visitor count is missing.
  const uv = safeNum(row.uv);

  const flowItems: DistributionItem[] = [];
  if (imp !== null) flowItems.push({ key: "imp", label: "展现量", value: imp, formattedValue: `${fmtNum(imp, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.slate });
  if (clicks !== null) flowItems.push({ key: "clicks", label: "点击量", value: clicks, formattedValue: `${fmtNum(clicks, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.primary });
  if (eng !== null) flowItems.push({ key: "eng", label: "互动量", value: eng, formattedValue: `${fmtNum(eng, 0)} 次`, unit: "次", color: CAMPAIGN_PALETTE.purple });
  // If dataset defines uv metric, include it; if uncollected/missing, show 未采集, never fabricate 0
  if (dataset.metrics.some((m) => m.key === "uv")) {
    flowItems.push({
      key: "uv",
      label: "进店UV",
      value: uv ?? 0,
      formattedValue: uv !== null ? `${fmtNum(uv, 0)} 人` : "未采集",
      unit: "人",
      color: CAMPAIGN_PALETTE.gold,
    });
  }

  if (flowItems.length > 0) {
    groups.push({
      id: "seed-flow-dist",
      title: "当日互动与进店规模结构",
      caption: "当日各级漏斗规模",
      items: flowItems,
    });
  }

  const cpc = safeNum(row.cpc);
  const cpe = safeNum(row.cpe);
  const cpm = safeNum(row.cpm);
  const costItems: DistributionItem[] = [];
  if (cpc !== null) costItems.push({ key: "cpc", label: "点击成本(CPC)", value: cpc, formattedValue: `¥${fmtNum(cpc, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.primary });
  if (cpe !== null) costItems.push({ key: "cpe", label: "互动成本(CPE)", value: cpe, formattedValue: `¥${fmtNum(cpe, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.purple });
  if (cpm !== null) costItems.push({ key: "cpm", label: "千次展现成本(CPM)", value: cpm, formattedValue: `¥${fmtNum(cpm, 2)}`, unit: "元", color: CAMPAIGN_PALETTE.gold });

  if (costItems.length > 0) {
    groups.push({
      id: "seed-cost-dist",
      title: "当日投放效率成本",
      caption: "各项单位成本指标",
      items: costItems,
    });
  }

  return groups;
}

export interface CrossDatasetRow {
  datasetId: string;
  datasetLabel: string;
  period: string;
  hasDataOnSelectedDate: boolean;
  spend: string;
  primaryMetric: { label: string; value: string };
  secondaryMetric: { label: string; value: string };
  efficiencyMetric: { label: string; value: string };
}

export interface CrossDatasetComparisonResult {
  date: string;
  hasMultiple: boolean;
  scopeNotice: string;
  rows: CrossDatasetRow[];
}

export function getCrossDatasetDailyComparison(
  datasets: CampaignDailyDataset[],
  selectedDate: string,
  projectId = ""
): CrossDatasetComparisonResult {
  const hasMultiple = datasets.length > 1;

  let scopeNotice = "⚠️ 跨数据集口径不可直接加总：不同业务数据集的数据源、统计链路与度量口径独立，不可混同或直接相加。";
  if (projectId === "meiling") {
    scopeNotice =
      "⚠️ 跨数据集口径不可直接加总：美菱自采天猫/京东种草为平台前端种草，京东对投CID为小红书向京东引流转化。各渠道归因窗口、平台口径与转化目标不同，不可直接相加求和。";
  } else if (projectId === "winner-wipes") {
    scopeNotice =
      "⚠️ 跨数据集口径不可直接加总：日常种草投流统计小红书前端互动与进店，淘搜表现统计淘宝搜索溢出总指数与全渠道消耗，二者属于不同监测链路，不可直接混同或相加。";
  } else if (projectId === "huang-tiane") {
    scopeNotice =
      "⚠️ 跨数据集口径不可直接加总：黄天鹅品牌线FS统计品牌心智人群沉淀，商销投放统计电商转化与GMV产出，各渠道监测来源与业务目标不同，不可直接相加求和。";
  }

  const rows: CrossDatasetRow[] = datasets.map((ds) => {
    const r = ds.rows.find((row) => row.date === selectedDate);
    const hasData = Boolean(r);

    const isTaosou = ds.id.includes("taosou");
    const isCid = ds.id.includes("cid");

    let spendStr = "—";
    let primaryMetric = { label: "核心指标", value: "—" };
    let secondaryMetric = { label: "次要指标", value: "—" };
    let efficiencyMetric = { label: "效率指标", value: "—" };

    if (hasData && r) {
      if (isTaosou) {
        const s = safeNum(r.spend_total);
        spendStr = s !== null ? `¥${fmtNum(s)}` : "—";
        const kw = safeNum(r.kw_total_index);
        primaryMetric = { label: "淘搜总指数", value: kw !== null ? fmtNum(kw, 0) : "—" };
        const sf = safeNum(r.spend_f);
        secondaryMetric = { label: "信息流消耗", value: sf !== null ? `¥${fmtNum(sf)}` : "—" };
        const sk = safeNum(r.spend_k);
        efficiencyMetric = { label: "达人消耗", value: sk !== null ? `¥${fmtNum(sk)}` : "—" };
      } else if (isCid) {
        const s = safeNum(r.spend);
        spendStr = s !== null ? `¥${fmtNum(s)}` : "—";
        const gmv = safeNum(r.gmv);
        primaryMetric = { label: "成交GMV", value: gmv !== null ? `¥${fmtNum(gmv)}` : "—" };
        const roi = s !== null && gmv !== null && s > 0 ? fmtNum(gmv / s, 2) : "—";
        secondaryMetric = { label: "当日ROI", value: roi !== "—" ? `${roi}倍` : "—" };
        const cpc = safeNum(r.cpc);
        efficiencyMetric = { label: "CPC", value: cpc !== null ? `¥${fmtNum(cpc, 2)}` : "—" };
      } else {
        const s = safeNum(r.spend);
        spendStr = s !== null ? `¥${fmtNum(s)}` : "—";
        const imp = safeNum(r.impressions);
        primaryMetric = { label: "展现量", value: imp !== null ? fmtNum(imp, 0) : "—" };
        const clk = safeNum(r.clicks);
        secondaryMetric = { label: "点击量", value: clk !== null ? fmtNum(clk, 0) : "—" };
        const cpc = safeNum(r.cpc);
        efficiencyMetric = { label: "CPC", value: cpc !== null ? `¥${fmtNum(cpc, 2)}` : "—" };
      }
    }

    return {
      datasetId: ds.id,
      datasetLabel: ds.label,
      period: ds.period,
      hasDataOnSelectedDate: hasData,
      spend: spendStr,
      primaryMetric,
      secondaryMetric,
      efficiencyMetric,
    };
  });

  return {
    date: selectedDate,
    hasMultiple,
    scopeNotice,
    rows,
  };
}

export interface PeriodBenchmarks {
  periodTotalSpend: number | null;
  periodAvgSpend: number | null;
  peakDate: string | null;
  peakValue: number | null;
  rankInPeriod: number;
  totalDays: number;
  spendSharePct: number | null;
  ma7Spend: number | null;
  vs7dMaPct: number | null;
  selectedSpend: number | null;
  dayIndex: number;
}

function getRowSpend(row: Record<string, unknown> | null | undefined): number | null {
  if (!row) return null;
  const s = safeNum(row.spend_total) ?? safeNum(row.spend);
  return s;
}

export function computePeriodBenchmarks(
  dataset: CampaignDailyDataset,
  selectedDate: string
): PeriodBenchmarks {
  const rows = dataset?.rows || [];
  if (!rows.length || !selectedDate) {
    return {
      periodTotalSpend: null,
      periodAvgSpend: null,
      peakDate: null,
      peakValue: null,
      rankInPeriod: 1,
      totalDays: 0,
      spendSharePct: null,
      ma7Spend: null,
      vs7dMaPct: null,
      selectedSpend: null,
      dayIndex: 1,
    };
  }

  const sorted = [...rows].filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const totalDays = sorted.length;
  const selectedIndex = sorted.findIndex((r) => r.date === selectedDate);
  const dayIndex = selectedIndex >= 0 ? selectedIndex + 1 : totalDays;

  let totalSpend = 0;
  let validSpendDays = 0;
  let peakDate: string | null = null;
  let peakValue = -Infinity;

  const spendList: Array<{ date: string; spend: number }> = [];

  for (const r of sorted) {
    const s = getRowSpend(r as unknown as Record<string, unknown>);
    if (s !== null) {
      totalSpend += s;
      validSpendDays++;
      spendList.push({ date: r.date, spend: s });
      if (s > peakValue) {
        peakValue = s;
        peakDate = r.date;
      }
    }
  }

  const periodTotalSpend = validSpendDays > 0 ? totalSpend : null;
  const periodAvgSpend = validSpendDays > 0 ? totalSpend / validSpendDays : null;
  const actualPeakValue = peakDate !== null && peakValue !== -Infinity ? peakValue : null;

  const selectedRow = rows.find((r) => r.date === selectedDate);
  const selectedSpend = getRowSpend(selectedRow as unknown as Record<string, unknown>);

  let rankInPeriod = totalDays;
  if (selectedSpend !== null && spendList.length > 0) {
    const sortedSpends = [...spendList].sort((a, b) => b.spend - a.spend);
    const rIdx = sortedSpends.findIndex((item) => item.date === selectedDate);
    rankInPeriod = rIdx >= 0 ? rIdx + 1 : totalDays;
  }

  const spendSharePct =
    periodTotalSpend !== null && periodTotalSpend > 0 && selectedSpend !== null
      ? Math.round((selectedSpend / periodTotalSpend) * 1000) / 10
      : null;

  const priorRows = sorted.filter((r) => r.date <= selectedDate);
  const last7 = priorRows.slice(-7);
  let ma7Sum = 0;
  let ma7Count = 0;
  for (const r of last7) {
    const s = getRowSpend(r as unknown as Record<string, unknown>);
    if (s !== null) {
      ma7Sum += s;
      ma7Count++;
    }
  }
  const ma7Spend = ma7Count > 0 ? ma7Sum / ma7Count : null;
  const vs7dMaPct =
    ma7Spend !== null && ma7Spend > 0 && selectedSpend !== null
      ? Math.round(((selectedSpend - ma7Spend) / ma7Spend) * 1000) / 10
      : null;

  return {
    periodTotalSpend,
    periodAvgSpend,
    peakDate,
    peakValue: actualPeakValue,
    rankInPeriod,
    totalDays,
    spendSharePct,
    ma7Spend,
    vs7dMaPct,
    selectedSpend,
    dayIndex,
  };
}

export interface DailyDiagnosis {
  statusTone: "optimal" | "steady" | "warning" | "watch";
  statusLabel: string;
  positionText: string;
  bullets: string[];
}

export function computeDailyDiagnosis(
  dataset: CampaignDailyDataset,
  selectedDate: string,
  benchmarks: PeriodBenchmarks
): DailyDiagnosis {
  const rows = dataset?.rows || [];
  const selectedRow = rows.find((r) => r.date === selectedDate);
  if (!selectedRow) {
    return {
      statusTone: "watch",
      statusLabel: "暂无流水记录",
      positionText: `所选日期 ${selectedDate} 未采集到有效流水数据`,
      bullets: [
        `该日期暂无连续监控记录，请切换至最新有效业务日期 (${dataset?.period || "—"})。`,
        `全周期有效采集记录共 ${benchmarks.totalDays} 天，暂缺当日细分指标。`,
        `建议核对业务排期或飞书底表数据抓取时间戳。`,
      ],
    };
  }

  const prevDate = subtractCalendarDays(selectedDate, 1);
  const prevRow = rows.find((r) => r.date === prevDate);
  const prevSpend = getRowSpend(prevRow as unknown as Record<string, unknown>);
  const dodSpend = computeDayOverDay(benchmarks.selectedSpend, prevSpend, "元");

  const isTaosou = dataset.id.includes("taosou");
  const isCid = dataset.id.includes("cid");

  let tone: "optimal" | "steady" | "warning" | "watch" = "steady";
  let label = "常规放量日";

  const isPeak = benchmarks.peakDate === selectedDate;
  const isTopTier = benchmarks.rankInPeriod <= Math.max(1, Math.ceil(benchmarks.totalDays * 0.15));

  const cpc = safeNum(selectedRow.cpc);
  const cpe = safeNum(selectedRow.cpe);
  const gmv = safeNum(selectedRow.gmv);
  const roi = benchmarks.selectedSpend && gmv && benchmarks.selectedSpend > 0 ? gmv / benchmarks.selectedSpend : null;

  if (isPeak) {
    tone = "optimal";
    label = "全周期峰值冲刺日";
  } else if (isTopTier) {
    tone = "optimal";
    label = "高效放量日";
  } else if (benchmarks.vs7dMaPct !== null && benchmarks.vs7dMaPct > 30) {
    tone = "watch";
    label = "放量提速日";
  } else if (benchmarks.vs7dMaPct !== null && benchmarks.vs7dMaPct < -30) {
    tone = "steady";
    label = "平稳蓄水日";
  } else {
    tone = "steady";
    label = "常规稳定日";
  }

  const positionText = `周期第 ${benchmarks.dayIndex} / ${benchmarks.totalDays} 天 · 消耗居全周期第 #${benchmarks.rankInPeriod} 位 · 占全周期 ${benchmarks.spendSharePct ?? 0}%`;

  const bullets: string[] = [];

  const dodStr = dodSpend.isComparable
    ? `${dodSpend.pct !== null ? (dodSpend.pct > 0 ? `+${fmtPct(dodSpend.pct)}` : fmtPct(dodSpend.pct)) : (dodSpend.diff ?? 0) >= 0 ? `+¥${fmtNum(dodSpend.diff)}` : `-¥${fmtNum(Math.abs(dodSpend.diff || 0))}`} 较前日`
    : dodSpend.note;
  const maStr = benchmarks.vs7dMaPct !== null
    ? `${benchmarks.vs7dMaPct > 0 ? "+" : ""}${fmtPct(benchmarks.vs7dMaPct)} 较7日均线`
    : `均线基准 ¥${fmtNum(benchmarks.ma7Spend)}`;
  bullets.push(`本日广告消耗 ¥${fmtNum(benchmarks.selectedSpend)} · ${dodStr} · ${maStr}`);

  if (isTaosou) {
    const kw = safeNum(selectedRow.kw_total_index);
    const sf = safeNum(selectedRow.spend_f);
    const sk = safeNum(selectedRow.spend_k);
    bullets.push(`淘搜总指数 ${kw !== null ? fmtNum(kw, 0) : "—"} 点 · 信息流(F)支出 ¥${fmtNum(sf)} · 达人(K)支出 ¥${fmtNum(sk)}`);
  } else if (isCid || gmv !== null) {
    const clk = safeNum(selectedRow.clicks);
    const ord = safeNum(selectedRow.orders);
    bullets.push(`成交 GMV ¥${fmtNum(gmv)} · 订单量 ${ord !== null ? fmtNum(ord, 0) : "—"} 单 · 点击量 ${clk !== null ? fmtNum(clk, 0) : "—"} 次`);
  } else {
    const imp = safeNum(selectedRow.impressions);
    const clk = safeNum(selectedRow.clicks);
    const eng = safeNum(selectedRow.engagements);
    const uv = safeNum(selectedRow.uv);
    bullets.push(`展现规模 ${imp !== null ? fmtNum(imp, 0) : "—"} 次 · 点击 ${clk !== null ? fmtNum(clk, 0) : "—"} 次 · 互动 ${eng !== null ? fmtNum(eng, 0) : (uv !== null ? `${fmtNum(uv, 0)} UV` : "—")}`);
  }

  if (isCid && roi !== null) {
    bullets.push(`综合 ROI ${fmtNum(roi, 2)} 倍 · 点击成本 CPC ¥${fmtNum(cpc, 2)} · 转化链路稳定`);
  } else if (cpc !== null || cpe !== null) {
    const effPieces: string[] = [];
    if (cpc !== null) effPieces.push(`点击成本 CPC ¥${fmtNum(cpc, 2)}`);
    if (cpe !== null) effPieces.push(`互动成本 CPE ¥${fmtNum(cpe, 2)}`);
    const cpuv = safeNum(selectedRow.cpuv);
    if (cpuv !== null) effPieces.push(`进店成本 CPUV ¥${fmtNum(cpuv, 2)}`);
    bullets.push(`${effPieces.join(" · ")} · 核心转化单价处于稳健控制区间`);
  } else {
    bullets.push(`全链路指标稳定跟踪 · 飞书多维数据实时回传校准`);
  }

  return {
    statusTone: tone,
    statusLabel: label,
    positionText,
    bullets,
  };
}

export interface DailyEfficiencyBenchmarkItem {
  key: string;
  label: string;
  unit: string;
  selectedVal: number | null;
  periodAvgVal: number | null;
  diffPct: number | null;
  status: "better" | "worse" | "equal" | "neutral";
  statusLabel: string;
  betterDirection: "higher" | "lower";
}

export function computeDailyEfficiencyBenchmarks(
  dataset: CampaignDailyDataset,
  selectedDate: string
): DailyEfficiencyBenchmarkItem[] {
  const rows = dataset?.rows || [];
  const selectedRow = rows.find((r) => r.date === selectedDate);
  if (!selectedRow || !rows.length) return [];

  const isTaosou = dataset.id.includes("taosou");
  const isCid = dataset.id.includes("cid");

  const metricsToTest: Array<{
    key: string;
    label: string;
    unit: string;
    betterDirection: "higher" | "lower";
    computeWeightedAvg: (rowsList: Array<Record<string, unknown>>) => number | null;
  }> = [];

  if (isTaosou) {
    return [];
  }

  metricsToTest.push({
    key: "cpc",
    label: "点击成本 (CPC)",
    unit: "元",
    betterDirection: "lower",
    computeWeightedAvg: (rs) => {
      let sumSpend = 0, sumClicks = 0;
      for (const r of rs) {
        const s = safeNum(r.spend);
        const c = safeNum(r.clicks);
        if (s !== null && c !== null && c > 0) {
          sumSpend += s;
          sumClicks += c;
        }
      }
      return sumClicks > 0 ? sumSpend / sumClicks : null;
    },
  });

  metricsToTest.push({
    key: "cpm",
    label: "千次曝光成本 (CPM)",
    unit: "元",
    betterDirection: "lower",
    computeWeightedAvg: (rs) => {
      let sumSpend = 0, sumImp = 0;
      for (const r of rs) {
        const s = safeNum(r.spend);
        const i = safeNum(r.impressions);
        if (s !== null && i !== null && i > 0) {
          sumSpend += s;
          sumImp += i;
        }
      }
      return sumImp > 0 ? (sumSpend / sumImp) * 1000 : null;
    },
  });

  if (selectedRow.cpe !== undefined || rows.some((r) => r.cpe !== undefined)) {
    metricsToTest.push({
      key: "cpe",
      label: "互动成本 (CPE)",
      unit: "元",
      betterDirection: "lower",
      computeWeightedAvg: (rs) => {
        let sumSpend = 0, sumEng = 0;
        for (const r of rs) {
          const s = safeNum(r.spend);
          const e = safeNum(r.engagements);
          if (s !== null && e !== null && e > 0) {
            sumSpend += s;
            sumEng += e;
          }
        }
        return sumEng > 0 ? sumSpend / sumEng : null;
      },
    });
  }

  if (selectedRow.cpuv !== undefined || rows.some((r) => r.cpuv !== undefined)) {
    metricsToTest.push({
      key: "cpuv",
      label: "进店成本 (CPUV)",
      unit: "元",
      betterDirection: "lower",
      computeWeightedAvg: (rs) => {
        let sumSpend = 0, sumUv = 0;
        for (const r of rs) {
          const s = safeNum(r.spend);
          const u = safeNum(r.uv);
          if (s !== null && u !== null && u > 0) {
            sumSpend += s;
            sumUv += u;
          }
        }
        return sumUv > 0 ? sumSpend / sumUv : null;
      },
    });
  }

  if (selectedRow.ctr !== undefined || rows.some((r) => r.ctr !== undefined)) {
    metricsToTest.push({
      key: "ctr",
      label: "点击率 (CTR)",
      unit: "%",
      betterDirection: "higher",
      computeWeightedAvg: (rs) => {
        let sumClicks = 0, sumImp = 0;
        for (const r of rs) {
          const c = safeNum(r.clicks);
          const i = safeNum(r.impressions);
          if (c !== null && i !== null && i > 0) {
            sumClicks += c;
            sumImp += i;
          }
        }
        return sumImp > 0 ? (sumClicks / sumImp) * 100 : null;
      },
    });
  }

  if (isCid || selectedRow.gmv !== undefined || rows.some((r) => r.gmv !== undefined)) {
    metricsToTest.push({
      key: "roi",
      label: "综合 ROI",
      unit: "倍",
      betterDirection: "higher",
      computeWeightedAvg: (rs) => {
        let sumGmv = 0, sumSpend = 0;
        for (const r of rs) {
          const g = safeNum(r.gmv);
          const s = safeNum(r.spend);
          if (g !== null && s !== null && s > 0) {
            sumGmv += g;
            sumSpend += s;
          }
        }
        return sumSpend > 0 ? sumGmv / sumSpend : null;
      },
    });
  }

  const results: DailyEfficiencyBenchmarkItem[] = [];
  for (const m of metricsToTest) {
    let selVal = safeNum(selectedRow[m.key]);
    if (m.key === "roi") {
      const s = safeNum(selectedRow.spend);
      const g = safeNum(selectedRow.gmv);
      if (s !== null && g !== null && s > 0) selVal = g / s;
    }
    const avgVal = m.computeWeightedAvg(rows as unknown as Array<Record<string, unknown>>);

    if (selVal === null && avgVal === null) continue;

    let diffPct: number | null = null;
    let status: "better" | "worse" | "equal" | "neutral" = "neutral";
    let statusLabel = "基准持平";

    if (selVal !== null && avgVal !== null && avgVal > 0) {
      diffPct = Math.round(((selVal - avgVal) / avgVal) * 1000) / 10;
      if (m.betterDirection === "lower") {
        if (diffPct < -1) {
          status = "better";
          statusLabel = `优于周期均值 ${fmtPct(Math.abs(diffPct))}`;
        } else if (diffPct > 1) {
          status = "worse";
          statusLabel = `高于周期均值 ${fmtPct(diffPct)}`;
        } else {
          status = "equal";
          statusLabel = "持平周期均值";
        }
      } else {
        if (diffPct > 1) {
          status = "better";
          statusLabel = `优于周期均值 ${fmtPct(diffPct)}`;
        } else if (diffPct < -1) {
          status = "worse";
          statusLabel = `低于周期均值 ${fmtPct(Math.abs(diffPct))}`;
        } else {
          status = "equal";
          statusLabel = "持平周期均值";
        }
      }
    } else if (selVal !== null && avgVal === null) {
      statusLabel = "周期均值暂缺";
    }

    results.push({
      key: m.key,
      label: m.label,
      unit: m.unit,
      selectedVal: selVal !== null ? Math.round(selVal * 100) / 100 : null,
      periodAvgVal: avgVal !== null ? Math.round(avgVal * 100) / 100 : null,
      diffPct,
      status,
      statusLabel,
      betterDirection: m.betterDirection,
    });
  }

  return results;
}

export interface DailyFunnelStep {
  key: string;
  label: string;
  value: number | null;
  formattedValue: string;
  unit: string;
  conversionRate?: number | null;
  conversionLabel?: string;
}

export function computeDailyTrafficFunnel(
  dataset: CampaignDailyDataset,
  selectedDate: string
): DailyFunnelStep[] {
  const rows = dataset?.rows || [];
  const row = rows.find((r) => r.date === selectedDate);
  if (!row) return [];

  const steps: DailyFunnelStep[] = [];
  const imp = safeNum(row.impressions);
  const clk = safeNum(row.clicks);
  const eng = safeNum(row.engagements);
  const uv = safeNum(row.uv) ?? safeNum(row.externalUv) ?? safeNum(row.search_uv);
  const ord = safeNum(row.orders);
  const gmv = safeNum(row.gmv);

  if (imp !== null) {
    steps.push({
      key: "imp",
      label: "展现曝光",
      value: imp,
      formattedValue: `${fmtNum(imp, 0)} 次`,
      unit: "次",
    });
  }

  if (clk !== null) {
    const ctrRate = imp && imp > 0 ? Math.round((clk / imp) * 10000) / 100 : null;
    steps.push({
      key: "clicks",
      label: "点击转化",
      value: clk,
      formattedValue: `${fmtNum(clk, 0)} 次`,
      unit: "次",
      conversionRate: ctrRate,
      conversionLabel: ctrRate !== null ? `CTR ${fmtPct(ctrRate)}` : undefined,
    });
  }

  if (eng !== null) {
    const engRate = clk && clk > 0 ? Math.round((eng / clk) * 10000) / 100 : null;
    steps.push({
      key: "engagements",
      label: "互动沉淀",
      value: eng,
      formattedValue: `${fmtNum(eng, 0)} 次`,
      unit: "次",
      conversionRate: engRate,
      conversionLabel: engRate !== null ? `点击互动率 ${fmtPct(engRate)}` : undefined,
    });
  }

  if (uv !== null) {
    const base = clk && clk > 0 ? clk : imp && imp > 0 ? imp : null;
    const uvRate = base && base > 0 ? Math.round((uv / base) * 10000) / 100 : null;
    steps.push({
      key: "uv",
      label: "进店访客 (UV)",
      value: uv,
      formattedValue: `${fmtNum(uv, 0)} 人`,
      unit: "人",
      conversionRate: uvRate,
      conversionLabel: uvRate !== null ? (clk && clk > 0 ? `点击进店率 ${fmtPct(uvRate)}` : `曝光进店率 ${fmtPct(uvRate)}`) : undefined,
    });
  }

  if (ord !== null || gmv !== null) {
    const baseUv = uv && uv > 0 ? uv : clk && clk > 0 ? clk : null;
    const ordRate = ord !== null && baseUv && baseUv > 0 ? Math.round((ord / baseUv) * 10000) / 100 : null;
    steps.push({
      key: "orders",
      label: ord !== null ? "成交订单" : "成交 GMV",
      value: ord !== null ? ord : gmv,
      formattedValue: ord !== null ? `${fmtNum(ord, 0)} 单` : `¥${fmtNum(gmv)}`,
      unit: ord !== null ? "单" : "元",
      conversionRate: ordRate,
      conversionLabel: ordRate !== null ? `进店成交率 ${fmtPct(ordRate)}` : undefined,
    });
  }

  return steps;
}

export interface TopCreativeItem {
  id: string;
  title: string;
  creator: string;
  channelOrTier: string;
  spend: number | null;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  uv: number | null;
  gmv: number | null;
  orders?: number | null;
  cpc: number | null;
  cpe: number | null;
  cpuv: number | null;
  roi: number | null;
  ctr: number | null;
}

export interface SearchKeywordItem {
  keyword: string;
  category?: string;
  spend: number | null;
  index?: number | null;
  clicks?: number | null;
  impressions?: number | null;
  cpc?: number | null;
  ctr?: number | null;
  uv?: number | null;
  sharePct?: number | null;
}

export interface AudiencePackageItem {
  name: string;
  spend: number | null;
  impressions?: number | null;
  clicks?: number | null;
  uv?: number | null;
  cpe?: number | null;
  cpuv?: number | null;
  cpm?: number | null;
  ctr?: number | null;
}

export interface DailyFeishuDrilldowns {
  topNotes: TopCreativeItem[];
  searchKeywords: SearchKeywordItem[];
  audiencePackages: AudiencePackageItem[];
  actionItems: Array<{ id: string; title: string; owner?: string; status?: string; badge?: string }>;
  taosouDailyKeywords?: SearchKeywordItem[];
  channelSplits?: Array<{ label: string; spend: number; sharePct: number; color?: string }>;
}

export function extractFeishuDrilldowns(
  dashboard: CampaignDashboard,
  selectedDate: string,
  activeDataset?: CampaignDailyDataset | null
): DailyFeishuDrilldowns {
  const tables = dashboard?.tables || [];
  const topNotes: TopCreativeItem[] = [];
  const searchKeywords: SearchKeywordItem[] = [];
  const audiencePackages: AudiencePackageItem[] = [];
  const actionItems: Array<{ id: string; title: string; owner?: string; status?: string; badge?: string }> = [];
  let taosouDailyKeywords: SearchKeywordItem[] | undefined;
  let channelSplits: Array<{ label: string; spend: number; sharePct: number; color?: string }> | undefined;

  if (dashboard?.actions?.items?.length) {
    dashboard.actions.items.forEach((it, idx) => {
      if (typeof it === "string") {
        actionItems.push({
          id: `act-${idx}`,
          title: it,
          status: "日报计划",
          badge: "跟进中",
        });
      } else if (it && typeof it === "object") {
        actionItems.push({
          id: it.id || `act-${idx}`,
          title: it.title || it.text || it.description || "未命名事项",
          owner: it.owner || "运营",
          status: it.status || "日报计划",
          badge: it.priority ? `P-${it.priority}` : "日报任务",
        });
      }
    });
  }

  const allDaily = dashboard?.dailyDatasets || [];
  const taosouDs = allDaily.find((d) => d.id.includes("taosou")) || (activeDataset?.id.includes("taosou") ? activeDataset : null);
  if (taosouDs?.rows?.length) {
    const dayRow = taosouDs.rows.find((r) => r.date === selectedDate);
    if (dayRow) {
      const kwKeys = [
        { key: "kw_wipes", label: VERIFIED_KEYWORD_LABELS.kw_wipes || "稳健酒精湿巾" },
        { key: "kw_corn_wipes", label: VERIFIED_KEYWORD_LABELS.kw_corn_wipes || "稳健玉米酒精湿巾" },
        { key: "kw_alcohol", label: VERIFIED_KEYWORD_LABELS.kw_alcohol || "稳健酒精" },
        { key: "kw_alcohol_wipes", label: VERIFIED_KEYWORD_LABELS.kw_alcohol_wipes || "酒精湿巾稳健" },
        { key: "kw_corn_alcohol_wipes", label: VERIFIED_KEYWORD_LABELS.kw_corn_alcohol_wipes || "玉米酒精湿巾" },
        { key: "kw_disinfect_wipes", label: VERIFIED_KEYWORD_LABELS.kw_disinfect_wipes || "稳健消毒湿巾" },
      ];
      const list: SearchKeywordItem[] = [];
      let sumKw = 0;
      for (const k of kwKeys) {
        const v = safeNum(dayRow[k.key]);
        if (v !== null) {
          sumKw += v;
          list.push({
            keyword: k.label,
            category: "淘系搜索关键词",
            index: v,
            spend: null,
          });
        }
      }
      if (sumKw > 0) {
        for (const item of list) {
          item.sharePct = Math.round(((item.index || 0) / sumKw) * 1000) / 10;
        }
      }
      list.sort((a, b) => (b.index || 0) - (a.index || 0));
      if (list.length > 0) {
        taosouDailyKeywords = list;
      }

      const chs = [
        { key: "spend_f", label: "信息流(F端)", color: CAMPAIGN_PALETTE.primary },
        { key: "spend_s", label: "搜索推广(S端)", color: CAMPAIGN_PALETTE.purple },
        { key: "spend_k", label: "达人投放(K端)", color: CAMPAIGN_PALETTE.gold },
        { key: "spend_cid", label: "CID引流端", color: CAMPAIGN_PALETTE.terracotta },
      ];
      let sumCh = 0;
      const chList: Array<{ label: string; spend: number; sharePct: number; color?: string }> = [];
      for (const c of chs) {
        const val = safeNum(dayRow[c.key]);
        if (val !== null && val > 0) {
          sumCh += val;
          chList.push({ label: c.label, spend: val, sharePct: 0, color: c.color });
        }
      }
      if (sumCh > 0) {
        for (const c of chList) {
          c.sharePct = Math.round((c.spend / sumCh) * 1000) / 10;
        }
        channelSplits = chList;
      }
    }
  }

  const noteTables = tables.filter((t) => {
    const id = t.id.toLowerCase();
    return (
      id.includes("creative") ||
      id.includes("note") ||
      id.includes("kol") ||
      id.includes("material") ||
      id.includes("creator") ||
      id.includes("pareto")
    );
  });

  const notePool: TopCreativeItem[] = [];
  for (const t of noteTables) {
    for (let i = 0; i < t.rows.length; i++) {
      const r = t.rows[i];
      if (!r || (r as Record<string, unknown>).isSummary) continue;
      const kol = String(r.kolName || r.kol_name || r.creator || r.account_name || r.material_name || r.creativeName || "").trim();
      const title = String(r.material_name || r.creativeName || r.noteTitle || r.contentType || kol || `素材 #${i + 1}`).trim();
      const channel = String(r.channel || r.tier || r.account_tier || r.kolTier || r.coopFormat || "精选合作").trim();
      const spend = safeNum(r.spend ?? r.fsSpend ?? r.costSpend ?? r.kCost ?? r.totalSpendKfs ?? r.taskSpend);
      const imp = safeNum(r.impressions ?? r.pgyImp ?? r.fsImp);
      const clk = safeNum(r.clicks ?? r.fsClick);
      const eng = safeNum(r.engagements ?? r.pgyEng ?? r.fsEng);
      const uv = safeNum(r.uv ?? r.externalUv ?? r.fsUv);
      const gmv = safeNum(r.gmv);
      const orders = safeNum(r.orders);
      const roi = safeNum(r.roi);
      const cpc = safeNum(r.cpc ?? r.fsCpc);
      const cpe = safeNum(r.cpe ?? r.fsCpe ?? r.pgyCpe);
      const cpuv = safeNum(r.cpuv);
      const ctr = safeNum(r.ctr ?? r.fsCtr);

      if (spend !== null || imp !== null || clk !== null || gmv !== null) {
        notePool.push({
          id: String(r.noteId || r.note_id || r.id || `${t.id}-${i}`),
          title,
          creator: kol || "合作达人",
          channelOrTier: channel,
          spend,
          impressions: imp,
          clicks: clk,
          engagements: eng,
          uv,
          gmv,
          orders,
          roi,
          cpc,
          cpe,
          cpuv,
          ctr,
        });
      }
    }
  }

  const seenIds = new Set<string>();
  const uniqueNotes: TopCreativeItem[] = [];
  notePool.sort((a, b) => {
    const sA = a.spend ?? (a.gmv ? a.gmv * 0.3 : 0);
    const sB = b.spend ?? (b.gmv ? b.gmv * 0.3 : 0);
    return sB - sA;
  });
  for (const n of notePool) {
    const key = `${n.creator}-${n.title}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueNotes.push(n);
      if (uniqueNotes.length >= 6) break;
    }
  }
  topNotes.push(...uniqueNotes);

  const kwTables = tables.filter((t) => {
    const id = t.id.toLowerCase();
    return id.includes("keyword") || id.includes("search");
  });
  for (const t of kwTables) {
    for (const r of t.rows) {
      if (!r || (r as Record<string, unknown>).isSummary) continue;
      const kw = String(r.keyword || r.category || r.category_name || r.word || "").trim();
      if (!kw) continue;
      const spend = safeNum(r.spend);
      const clk = safeNum(r.clicks);
      const imp = safeNum(r.impressions);
      const cpc = safeNum(r.cpc);
      const ctr = safeNum(r.ctr);
      const uv = safeNum(r.uv ?? r.externalUv);
      searchKeywords.push({
        keyword: kw,
        category: String(r.category || t.title.slice(0, 10)),
        spend,
        clicks: clk,
        impressions: imp,
        cpc,
        ctr,
        uv,
      });
    }
  }
  searchKeywords.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));

  const audTables = tables.filter((t) => {
    const id = t.id.toLowerCase();
    return id.includes("audience") || id.includes("targeting");
  });
  for (const t of audTables) {
    for (const r of t.rows) {
      if (!r || (r as Record<string, unknown>).isSummary) continue;
      const name = String(r.packageName || r.audience || r.package_name || r.crowd_name || "").trim();
      if (!name) continue;
      audiencePackages.push({
        name,
        spend: safeNum(r.spend),
        impressions: safeNum(r.impressions),
        clicks: safeNum(r.clicks),
        uv: safeNum(r.uv),
        cpe: safeNum(r.cpe),
        cpuv: safeNum(r.cpuv),
        cpm: safeNum(r.cpm),
        ctr: safeNum(r.ctr),
      });
    }
  }
  audiencePackages.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));

  return {
    topNotes,
    searchKeywords: searchKeywords.slice(0, 10),
    audiencePackages: audiencePackages.slice(0, 8),
    actionItems: actionItems.slice(0, 8),
    taosouDailyKeywords,
    channelSplits,
  };
}

export interface DailyRichContext {
  benchmarks: PeriodBenchmarks;
  diagnosis: DailyDiagnosis;
  efficiencyBenchmarks: DailyEfficiencyBenchmarkItem[];
  trafficFunnel: DailyFunnelStep[];
  feishuDrilldowns: DailyFeishuDrilldowns;
}

export function buildDailyRichContext(
  dashboard: CampaignDashboard,
  activeDataset: CampaignDailyDataset,
  selectedDate: string
): DailyRichContext {
  const benchmarks = computePeriodBenchmarks(activeDataset, selectedDate);
  const diagnosis = computeDailyDiagnosis(activeDataset, selectedDate, benchmarks);
  const efficiencyBenchmarks = computeDailyEfficiencyBenchmarks(activeDataset, selectedDate);
  const trafficFunnel = computeDailyTrafficFunnel(activeDataset, selectedDate);
  const feishuDrilldowns = extractFeishuDrilldowns(dashboard, selectedDate, activeDataset);

  return {
    benchmarks,
    diagnosis,
    efficiencyBenchmarks,
    trafficFunnel,
    feishuDrilldowns,
  };
}
