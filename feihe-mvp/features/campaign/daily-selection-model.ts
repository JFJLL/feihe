import type { CampaignDailyDataset } from "../../lib/campaign-daily";
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
      note: diff === 0 ? "前日为0 · 环比持平" : `${diff > 0 ? "+" : ""}${fmtNum(diff)}${unit} 较前日(基数0)`,
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
        caption: `所选日渠道总支出 ¥${fmtNum(sumChannelSpend)} · 各渠道占比明细`,
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
        caption: `所选日关键词指数总和 ${fmtNum(sumKw, 0)} · 各词指数占比`,
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
