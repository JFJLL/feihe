/**
 * Standard Transformation & Reconciliation Toolkit
 *
 * Provides robust utilities for data extraction, numerical parsing,
 * ratio computations, total-row reconciliation, and categorization.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

export interface ExtractTableOptions {
  headerRowIndex?: number;
  skipTotalRows?: boolean;
  totalRowKeywords?: string[];
}

/**
 * Determines whether a given row or row values represent a total/subtotal summary row.
 */
export function isSummaryRow(row: Record<string, unknown> | unknown[]): boolean {
  const keywords = ['总计', '合计', '汇总', '平均', '整体', '小计', 'Total', 'TOTAL', 'Summary'];
  const values = Array.isArray(row) ? row : Object.values(row || {});
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (keywords.includes(s)) return true;
    for (const kw of keywords) {
      if (s.startsWith(kw) || s.endsWith(kw)) return true;
    }
  }
  return false;
}

/**
 * Normalizes various raw dates into ISO YYYY-MM-DD.
 */
export function toIsoDate(val: unknown, defaultYear = 2026): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (val > 30000 && val < 60000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  if (!s) return null;

  const fullMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullMatch) {
    const [, y, m, d] = fullMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const shortMatch = s.match(/^(\d{1,2})[-/.月](\d{1,2})日?/);
  if (shortMatch) {
    const [, m, d] = shortMatch;
    return `${defaultYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Strictly distinguishes between genuine 0 and missing/null/NaN/#DIV/0!
 */
export function strictNum(val: unknown, fallback: number | null = null): number | null {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s === '--' || s === '/' || s.startsWith('#') || s === 'null' || s === 'undefined') {
      return fallback;
    }
    const clean = s.replace(/¥|￥|,|元|次|人|条|个/g, '').trim();
    if (clean.endsWith('%')) {
      const num = Number(clean.slice(0, -1));
      return Number.isFinite(num) ? num / 100 : fallback;
    }
    const n = Number(clean);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Standard percent formatting helper adhering strictly to declared percentInput caliber.
 * Handles ratio (0.125 -> 12.5%), points (12.5 -> 12.5%), zero (0 -> 0%), and unobserved (null -> 未观测).
 */
export function formatPercentValue(
  val: unknown,
  percentInput: 'ratio' | 'points' = 'ratio',
  maxDecimals = 2
): string {
  if (val === null || val === undefined) return '未观测';
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s === '--' || s === 'null' || s === 'undefined') return '未观测';
    if (s.endsWith('%')) return s;
    const n = Number(s);
    if (!Number.isNaN(n)) {
      const pct = percentInput === 'points' ? n : n * 100;
      const formatted = pct.toFixed(maxDecimals).replace(/\.?0+$/, '');
      return `${formatted === '-0' ? '0' : formatted}%`;
    }
    return s;
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '未观测';
    const pct = percentInput === 'points' ? val : val * 100;
    const formatted = pct.toFixed(maxDecimals).replace(/\.?0+$/, '');
    return `${formatted === '-0' ? '0' : formatted}%`;
  }
  return '未观测';
}

/**
 * Computes safe ratio = numerator / denominator.
 */
export function strictRatio(
  numerator: unknown,
  denominator: unknown,
  precision = 4,
  inputMode: 'ratio' | 'points' = 'ratio'
): number | null {
  const num = strictNum(numerator);
  const den = strictNum(denominator);
  if (num === null || den === null || den === 0) return null;
  const raw = num / den;
  const multiplier = inputMode === 'points' ? 100 : 1;
  const result = raw * multiplier;
  return Number(result.toFixed(precision));
}

/**
 * Strictly sums numbers, distinguishing all-null/empty from zero.
 */
export function strictSum(values: unknown[]): number | null {
  let sum = 0;
  let hasValid = false;
  for (const v of values) {
    const n = strictNum(v);
    if (n !== null) {
      sum += n;
      hasValid = true;
    }
  }
  return hasValid ? sum : null;
}

/**
 * Reconciles an aggregated total with an explicit source "总计" value.
 */
export function reconcileTotals(
  computedSum: number | null,
  sourceTotal: number | null,
  label: string,
  warnings: string[],
  tolerance = 0.02
): void {
  if (computedSum === null || sourceTotal === null) return;
  if (sourceTotal === 0 && computedSum === 0) return;
  const diff = Math.abs(computedSum - sourceTotal);
  const base = Math.max(Math.abs(sourceTotal), 0.0001);
  const relDiff = diff / base;
  if (relDiff > tolerance) {
    const pct = (relDiff * 100).toFixed(1);
    warnings.push(
      `[对账警示] ${label} 聚合值 (${computedSum.toLocaleString()}) 与源表总计行 (${sourceTotal.toLocaleString()}) 偏差 ${pct}%，已保留清洗计算值并记录偏差。`
    );
  }
}

/**
 * Categorizes a string into keyword buckets based on priority ordered rules.
 */
export function bucketByKeywords<T extends string>(
  text: string,
  rules: Array<{ bucket: T; keywords: string[] }>,
  defaultBucket: T
): T {
  if (!text) return defaultBucket;
  const lower = text.toLowerCase();
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return rule.bucket;
      }
    }
  }
  return defaultBucket;
}

/**
 * Merges two arrays of entities by unique `id`.
 * Items from `incoming` override matching `id`s in `base`.
 */
export function mergeById<T extends { id: string }>(base: T[] = [], incoming: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function computeFileDigest(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return index;
}

export function parseRangeDimensions(rangeStr: string): { expectedRows: number; expectedCols: number } | null {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const m = rangeStr.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const startCol = colLetterToIndex(m[1]);
  const startRow = parseInt(m[2], 10);
  const endCol = colLetterToIndex(m[3]);
  const endRow = parseInt(m[4], 10);
  return {
    expectedRows: endRow - startRow + 1,
    expectedCols: endCol - startCol + 1,
  };
}

export function validateCapture(receipt: any, payload: any, expectedOptions: { expectedRange?: string } = {}): boolean {
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('CAPTURE_VALIDATION_FAILED: Receipt is missing or not an object');
  }
  if (receipt.ok !== true) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Receipt ok is not true (got ${receipt.ok})`);
  }
  if (!receipt.data || typeof receipt.data !== 'object') {
    throw new Error('CAPTURE_VALIDATION_FAILED: Receipt data payload is missing');
  }
  if (receipt.data.complete !== true) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Receipt complete is false or missing (complete=${receipt.data.complete})`);
  }
  if (receipt.data.truncated === true) {
    throw new Error('CAPTURE_VALIDATION_FAILED: Receipt indicates truncated=true');
  }
  if (receipt.data.has_more === true) {
    throw new Error('CAPTURE_VALIDATION_FAILED: Receipt indicates has_more=true');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('CAPTURE_VALIDATION_FAILED: Payload object is missing');
  }
  if (!Array.isArray(payload.sheets) || payload.sheets.length !== 1) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Expected payload.sheets to be single sheet array (got length ${payload?.sheets?.length})`);
  }
  if (payload.unread_sheets && Object.keys(payload.unread_sheets).length > 0) {
    throw new Error('CAPTURE_VALIDATION_FAILED: Payload contains unread_sheets');
  }

  const sheet = payload.sheets[0];
  if (!sheet || typeof sheet !== 'object') {
    throw new Error('CAPTURE_VALIDATION_FAILED: Sheet object is invalid');
  }
  if (sheet.truncated === true) {
    throw new Error('CAPTURE_VALIDATION_FAILED: Sheet object indicates truncated=true');
  }
  if (!Array.isArray(sheet.data) || sheet.data.length === 0) {
    throw new Error('CAPTURE_VALIDATION_FAILED: Sheet data is not a non-empty array');
  }

  if (expectedOptions.expectedRange && sheet.range !== expectedOptions.expectedRange) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Expected range ${expectedOptions.expectedRange}, got ${sheet.range}`);
  }

  const dims = parseRangeDimensions(sheet.range);
  if (!dims) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Unable to parse dimensions from range "${sheet.range}"`);
  }
  if (sheet.data.length !== dims.expectedRows) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Row count mismatch for range ${sheet.range}: expected ${dims.expectedRows} rows, got ${sheet.data.length}`);
  }
  if (Array.isArray(sheet.columns) && sheet.columns.length !== dims.expectedCols) {
    throw new Error(`CAPTURE_VALIDATION_FAILED: Column count mismatch for range ${sheet.range}: expected ${dims.expectedCols} columns, got ${sheet.columns.length}`);
  }
  for (let r = 0; r < sheet.data.length; r++) {
    if (!Array.isArray(sheet.data[r]) || sheet.data[r].length !== dims.expectedCols) {
      throw new Error(`CAPTURE_VALIDATION_FAILED: Row ${r} width mismatch for range ${sheet.range}: expected ${dims.expectedCols}, got ${sheet.data[r]?.length}`);
    }
  }

  return true;
}

export function excelSerialToIsoDate(serial: unknown): string | null {
  const n = Number(serial);
  if (isNaN(n) || n <= 0) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}

export function safeParseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/[¥￥,%\s]/g, '').trim();
  if (!s || s === '-' || s === '—' || s === '/' || s === 'null' || s === 'None' || s.startsWith('#')) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function extractDataRows(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.sheets) && input.sheets[0] && Array.isArray(input.sheets[0].data)) {
    return input.sheets[0].data;
  }
  throw new Error('PARSER_ERROR: Invalid table input, expected rows array or sheets payload');
}

/**
 * Extracts structured rows from raw table grid (2D array).
 */
export function extractTable(
  rawGrid: unknown[][],
  options: ExtractTableOptions = {}
): {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRow?: Record<string, unknown>;
} {
  if (!rawGrid || rawGrid.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerIdx = options.headerRowIndex ?? 0;
  const rawHeader = rawGrid[headerIdx] || [];
  const headers = rawHeader.map((h, i) => String(h || `col_${i}`).trim());

  const rows: Record<string, unknown>[] = [];
  let totalRow: Record<string, unknown> | undefined;

  for (let i = headerIdx + 1; i < rawGrid.length; i++) {
    const gridRow = rawGrid[i];
    if (!gridRow || gridRow.length === 0) continue;

    const obj: Record<string, unknown> = {};
    headers.forEach((h, colIdx) => {
      obj[h] = gridRow[colIdx] !== undefined ? gridRow[colIdx] : null;
    });

    if (isSummaryRow(obj)) {
      totalRow = obj;
      if (options.skipTotalRows !== false) {
        continue;
      }
    }

    rows.push(obj);
  }

  return { headers, rows, totalRow };
}

/**
 * Universal mapper: converts a CampaignDashboard object into a strict BoardPayload.
 * Guarantees dual-layer contract with datasets, sections, and analysisCards while
 * preserving legacy kpis, tables, and dailyDatasets for 100% backward compatibility.
 */
export function buildBoardPayloadFromCampaignDashboard(
  dashboard: {
    projectId: string;
    name: string;
    brand?: string;
    reportPeriod?: string;
    updatedAt?: string;
    kpis?: Array<{ id: string; label: string; value: number | null; unit?: string; target?: number | null; direction?: string }>;
    tables?: Array<{ id: string; title?: string; note?: string; sourceUrl?: string; columns?: Array<{ key: string; title?: string; label?: string; type?: string; align?: string; width?: number | string }>; rows?: Array<Record<string, unknown>> }>;
    dailyDatasets?: Array<{ id: string; label: string; metrics: Array<{ key: string; label: string; unit?: string }>; rows: Array<Record<string, unknown>> }>;
    sources?: Array<{ id: string; name: string; url?: string; status: string; detail?: string; fetchedAt?: string | null }>;
    warnings?: string[];
    actions?: { title: string; items: unknown[] };
  },
  manifest: {
    id: string;
    name: string;
    brand: string;
    spu?: string;
    category?: string;
    color?: string;
    defaultReportPeriod?: string;
    mode?: string;
    rendererMode?: 'universal' | 'legacy-campaign' | 'legacy-huang-tiane';
    legacyRendererMode?: 'legacy-campaign' | 'legacy-huang-tiane';
  },
  sections: import('./types').SectionSpec[] = [],
  analysisCards: Array<{ id: string; targetQueryIds: string[]; type?: 'insight' | 'warning' | 'action'; title: string; summary: string; recommendations?: string[]; severity?: 'info' | 'warning' | 'critical' | 'success' }> = []
): import('./types').BoardPayload {
  const datasets: Record<string, import('./types').DatasetTable> = {};
  const kpis = dashboard.kpis || [];
  const tables = dashboard.tables || [];
  const dailyDatasets = dashboard.dailyDatasets || [];

  // 1. summary_kpis
  const kpiRow: Record<string, unknown> = {};
  const kpiCols: import('./types').ColumnDef[] = [];

  for (const kpi of kpis) {
    const colKey = kpi.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const val = kpi.value;
    const isCurrency = kpi.unit === '元' || kpi.label.includes('预算') || kpi.label.includes('消耗') || kpi.label.includes('花费');
    const isPercent = kpi.unit === '%' || kpi.label.includes('率') || kpi.label.includes('比') || kpi.label.includes('ROI') || kpi.label.includes('进度');
    const isInteger = !isCurrency && !isPercent;
    const explicitPercentInput = (kpi as any).percentInput || (kpi.unit === '%' ? 'points' : isPercent ? 'points' : undefined);

    kpiCols.push({
      key: colKey,
      label: kpi.label,
      type: 'number',
      format: isPercent ? 'percent' : isCurrency ? 'currency' : 'integer',
      percentInput: explicitPercentInput,
      decimals: isInteger ? 0 : 2,
      displayUnits: kpi.unit || '',
      role: isPercent ? 'RATIO' : 'METRIC',
    });
    kpiRow[colKey] = val;
  }

  datasets['summary_kpis'] = {
    id: 'summary_kpis',
    name: '核心KPI指标库',
    description: '核心原子指标与达成进度',
    columns: kpiCols,
    rows: [kpiRow],
    totalRows: 1,
  };

  // 2. daily_flow
  if (dailyDatasets.length > 0) {
    const pDaily = dailyDatasets[0];
    const flowCols: import('./types').ColumnDef[] = [
      { key: 'date', label: '日期', type: 'date', role: 'TIMESTAMP' },
      ...pDaily.metrics.map(m => {
        const isCurr = m.unit === '元' || m.label.includes('消耗') || m.label.includes('花费');
        const isPct = m.unit === '%' || m.label.includes('率') || m.label.includes('CTR');
        return {
          key: m.key,
          label: m.label,
          type: 'number' as const,
          format: isPct ? 'percent' as const : isCurr ? 'currency' as const : 'integer' as const,
          percentInput: isPct ? 'points' as const : undefined,
          decimals: isPct ? 2 : isCurr ? 2 : 0,
          displayUnits: m.unit,
          role: isPct ? 'RATIO' as const : 'METRIC' as const,
        };
      }),
    ];

    const flowRows = pDaily.rows.map(r => {
      const out: Record<string, unknown> = { date: toIsoDate(r.date) };
      for (const m of pDaily.metrics) {
        out[m.key] = strictNum(r[m.key]);
      }
      return out;
    });

    datasets['daily_flow'] = {
      id: 'daily_flow',
      name: pDaily.label || '分日时序流',
      columns: flowCols,
      rows: flowRows,
      totalRows: flowRows.length,
    };

    for (const d of dailyDatasets) {
      if (!datasets[d.id]) {
        datasets[d.id] = {
          id: d.id,
          name: d.label || d.id,
          columns: [
            { key: 'date', label: '日期', type: 'date', role: 'TIMESTAMP' },
            ...(Array.isArray(d?.metrics) ? d.metrics : []).map(m => {
              const isPct = m.unit === '%' || m.label.includes('率') || m.label.includes('CTR') || m.label.includes('ROI');
              const isCurr = m.unit === '元' || m.label.includes('消耗') || m.label.includes('花费');
              return {
                key: m.key,
                label: m.label,
                type: 'number' as const,
                format: isPct ? 'percent' as const : isCurr ? 'currency' as const : 'integer' as const,
                percentInput: isPct ? 'points' as const : undefined,
                decimals: isPct ? 2 : isCurr ? 2 : 0,
                role: isPct ? 'RATIO' as const : 'METRIC' as const,
              };
            }),
          ],
          rows: d.rows || [],
          totalRows: (d.rows || []).length,
        };
      }
    }
  }

  // 3. Convert all tables
  for (const t of tables) {
    const columns: import('./types').ColumnDef[] = (t.columns || []).map(c => {
      const title = c.title || c.label || c.key || '';
      const isCurrency = c.type === 'currency' || title.includes('金额') || title.includes('消耗') || title.includes('预算') || title.includes('花费') || title.includes('单价');
      const isPercent = c.type === 'percent' || title.includes('率') || title.includes('比') || title.includes('ROI') || title.includes('进度');
      const isDate = c.type === 'date' || c.key.toLowerCase().includes('date') || title.includes('日期');
      const isNum = c.type === 'number' || isCurrency || isPercent;
      const explicitPercentInput = (c as any).percentInput || (isPercent ? 'points' : undefined);

      return {
        key: c.key,
        label: title,
        type: isDate ? 'date' : isNum ? 'number' : 'string',
        format: isPercent ? 'percent' : isCurrency ? 'currency' : isNum ? 'integer' : undefined,
        percentInput: explicitPercentInput,
        decimals: isPercent ? 2 : isCurrency ? 2 : isNum ? 0 : undefined,
        align: (c.align as 'left' | 'center' | 'right') || (isNum ? 'right' : 'left'),
        width: c.width,
      };
    });

    datasets[t.id] = {
      id: t.id,
      name: t.title || t.id,
      description: t.note,
      columns,
      rows: t.rows || [],
      totalRows: (t.rows || []).length,
      sourceUrl: t.sourceUrl,
    };
  }

  const finalSections = sections.length > 0 ? sections : [
    {
      id: 'summary-kpis',
      title: '核心业务指标组',
      layout: 'paired-metrics' as const,
      columns: 4,
      components: kpiCols.slice(0, 4).map(c => ({
        id: `kpi-${c.key}`,
        type: 'metric-card',
        title: c.label,
        query: 'summary_kpis',
        field: c.key,
        width: 'quarter' as const,
      })),
    },
  ];

  return {
    projectId: manifest.id,
    name: manifest.name,
    brand: manifest.brand,
    spu: manifest.spu,
    category: manifest.category,
    themeColor: manifest.color,
    themeId: (manifest as any).themeId || (dashboard as any).themeId,
    reportPeriod: dashboard.reportPeriod || manifest.defaultReportPeriod,
    mode: manifest.mode,
    rendererMode: manifest.rendererMode || 'universal',
    legacyRendererMode: (manifest as any).legacyRendererMode,
    datasets,
    sections: finalSections,
    analysisCards,
    warnings: dashboard.warnings || [],
    sources: (dashboard.sources || []) as import('./types').BoardSource[],
    actions: (dashboard.actions as any) || { title: '重点事项', items: [] },
    // Legacy mirrors
    kpis,
    tables,
    dailyDatasets,
  };
}
