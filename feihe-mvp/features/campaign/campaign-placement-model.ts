import type { CampaignTable, CampaignTableRow } from '../../lib/campaign-types';

/**
 * Safely parses any number without parseFloat substring coercions.
 * Strictly returns finite number or null. Does not turn empty/dashes into 0.
 */
export function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) && !isNaN(val) ? val : null;
  }
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (s === '' || s === '-' || s === '—' || s === '/' || s === 'null' || s === 'undefined') return null;
  if (/^(未达标|考核中|未注明|待考核|待核算|#N\/A|#REF!|#VALUE!|#DIV\/0!)$/.test(s)) return null;
  const cleaned = s.replace(/[,¥￥元%次件人单篇]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && !isNaN(n) ? n : null;
}

/**
 * Sums an array strictly: returns null if any value is missing/non-finite or array is empty.
 */
export function strictSum(numbers: (number | null | undefined)[]): number | null {
  if (!numbers.length) return null;
  for (const n of numbers) {
    if (n === null || n === undefined || !Number.isFinite(n) || isNaN(n)) return null;
  }
  return (numbers as number[]).reduce((a, b) => a + b, 0);
}

/**
 * Strict addition: returns a + b only if both a and b are non-null finite numbers.
 */
export function strictAdd(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || !Number.isFinite(a) || isNaN(a)) return null;
  if (b === null || b === undefined || !Number.isFinite(b) || isNaN(b)) return null;
  return a + b;
}

/**
 * Detects summary/total rows (合计, 总计, 汇总).
 */
export function isSummaryRow(label?: unknown): boolean {
  return Boolean(label && /(合计|总计|汇总)/.test(String(label)));
}

export interface PlacementRecord {
  id: string;
  name: string;
  spend: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  cpe?: number | null;
  uv?: number | null;
  cpuv?: number | null;
  kSpend?: number | null;
  fsSpend?: number | null;
  totalSpend?: number | null;
  gmv?: number | null;
  roi?: number | null;
  orders?: number | null;
  raw?: Record<string, unknown>;
}

/**
 * Kailas FS Placements:
 * Excludes summary row (汇总).
 * UGC is strictly separated in kailas-ugc-summary table and NOT mixed into FS placements.
 */
export function extractKailasPlacements(table?: CampaignTable | null): PlacementRecord[] {
  if (!table?.rows) return [];
  return table.rows
    .filter((r) => {
      const p = String(r.placement || r.name || '');
      return p && !isSummaryRow(p);
    })
    .map((r, idx) => {
      const name = String(r.placement || r.name || `版位${idx + 1}`).trim();
      return {
        id: `kailas-fs-${name}-${idx}`,
        name,
        spend: safeNum(r.spend),
        impressions: safeNum(r.impressions),
        clicks: safeNum(r.clicks),
        ctr: safeNum(r.ctr),
        cpc: safeNum(r.cpc),
        cpm: safeNum(r.cpm),
        cpe: safeNum(r.cpe),
        uv: safeNum(r.uv),
        cpuv: safeNum(r.cpuv),
        raw: r,
      };
    });
}

/**
 * Winner Wipes 3 Placements:
 * Preserves real video spend 27786.34 and explicit CPE / CPUV.
 * Never infers missing clicks or UV via rounded cost.
 */
export function extractWipesPlacements(table?: CampaignTable | null): PlacementRecord[] {
  if (!table?.rows) return [];
  return table.rows
    .filter((r) => {
      const name = String(r.name || r.placement || '');
      return name && !isSummaryRow(name);
    })
    .map((r, idx) => {
      const name = String(r.name || r.placement || `版位${idx + 1}`).trim();
      return {
        id: `wipes-${name}-${idx}`,
        name,
        spend: safeNum(r.spend),
        impressions: safeNum(r.impressions),
        clicks: safeNum(r.clicks),
        ctr: safeNum(r.ctr),
        cpc: safeNum(r.cpc),
        cpm: safeNum(r.cpm),
        cpe: safeNum(r.cpe),
        uv: safeNum(r.uv),
        cpuv: safeNum(r.cpuv),
        raw: r,
      };
    });
}

/**
 * Meiling Four Lines:
 * Total spend (K+FS) strictly computed only if both K and FS spend are valid numbers.
 * Clear GMV attribution and KFS ROI.
 */
export function extractMeilingFourLines(table?: CampaignTable | null): PlacementRecord[] {
  if (!table?.rows) return [];
  return table.rows
    .filter((r) => {
      const name = String(r.name || '');
      return name && !isSummaryRow(name);
    })
    .map((r, idx) => {
      const name = String(r.name || `任务组${idx + 1}`).trim();
      const kSpend = safeNum(r.kSpend);
      const fsSpend = safeNum(r.fsSpend);
      const totalSpend = (kSpend !== null && fsSpend !== null) ? Number((kSpend + fsSpend).toFixed(2)) : null;
      return {
        id: `meiling-line-${name}-${idx}`,
        name,
        kSpend,
        fsSpend,
        totalSpend,
        spend: fsSpend, // 明确保留投流广告支出FS消耗口径，与CPC/CTR一致
        cpc: safeNum(r.cpc),
        ctr: safeNum(r.ctr),
        cpuv: safeNum(r.cpuv),
        cpm: safeNum(r.cpm),
        cpe: safeNum(r.cpe),
        uv: safeNum(r.uv),
        gmv: safeNum(r.gmv),
        roi: safeNum(r.kfsRoi ?? r.roi),
        raw: r,
      };
    });
}

/**
 * Meiling CID Daily Rows:
 * Excludes summary rows. Real spend + gmv + ROI daily combo keys.
 * Does not coerce missing clicks/UV via rounded cost.
 */
export function extractMeilingCidDaily(table?: CampaignTable | null): Record<string, unknown>[] {
  if (!table?.rows) return [];
  return table.rows
    .filter((r) => {
      const d = String(r.date || '');
      return d && !isSummaryRow(d);
    })
    .map((r) => ({
      date: String(r.date),
      spend: safeNum(r.spend),
      impressions: safeNum(r.impressions),
      clicks: safeNum(r.clicks),
      ctr: safeNum(r.ctr),
      cpc: safeNum(r.cpc),
      cpm: safeNum(r.cpm),
      engagements: safeNum(r.engagements),
      cpe: safeNum(r.cpe),
      orders: safeNum(r.orders),
      gmv: safeNum(r.gmv),
      roi: safeNum(r.roi),
      uv: safeNum(r.uv ?? r.activeUv),
      activeUv: safeNum(r.activeUv ?? r.uv),
    }));
}

/**
 * Generic fallback normalizer for any placement/performance table in ads view.
 */
export function normalizeTableToPlacements(table?: CampaignTable | null): PlacementRecord[] {
  if (!table?.rows) return [];
  return table.rows
    .filter((r) => {
      const title = String(r.name || r.placement || r.channel || r.line || r.dimension || r.kpiName || r.metric || r.date || '');
      return title && !isSummaryRow(title);
    })
    .map((r, idx) => {
      const name = String(r.name || r.placement || r.channel || r.line || (r.group ? `${r.group}-${r.kpiName}` : r.kpiName) || r.metric || r.dimension || r.date || `项${idx + 1}`).trim();
      const kSpend = safeNum(r.kSpend);
      const fsSpend = safeNum(r.fsSpend ?? r.spend ?? r.actual);
      const total = (kSpend !== null && fsSpend !== null) ? Number((kSpend + fsSpend).toFixed(2)) : null;
      return {
        id: `${name}-${idx}`,
        name,
        spend: fsSpend,
        kSpend,
        fsSpend,
        totalSpend: total,
        impressions: safeNum(r.impressions),
        clicks: safeNum(r.clicks),
        cpc: safeNum(r.cpc),
        cpm: safeNum(r.cpm),
        cpe: safeNum(r.cpe),
        ctr: safeNum(r.ctr),
        gmv: safeNum(r.gmv ?? r.cidGmv ?? r.totalGmv),
        roi: safeNum(r.roi ?? r.fsRoi ?? r.kfsRoi ?? r.totalRoi),
        orders: safeNum(r.orders),
        uv: safeNum(r.uv ?? r.activeUv),
        cpuv: safeNum(r.cpuv),
        raw: r,
      };
    });
}
