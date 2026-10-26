/**
 * lib/campaign-sync-parser.mjs
 *
 * Pure, side-effect-free parser and validation functions for Campaign Daily Datasets.
 *
 * Rules:
 * - Zero filesystem side-effects upon import
 * - Zero hardcoded paths or user directory dependencies
 * - Full payload & receipt validation (single sheet, range dimensions derived, row count, row width, truncated, has_more)
 * - Dynamic header mapping & index verification
 * - Strict 0 vs null differentiation (spend 0 / positive UV -> 0; 0 denominator -> null; missing -> null)
 * - Null propagation across sums: strictSum([a, b])
 * - Duplicate date rejection
 * - Total reconciliation assertions against raw "总计" rows
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

export function computeFileDigest(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function colLetterToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return index;
}

export function parseRangeDimensions(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const m = rangeStr.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const startCol = colLetterToIndex(m[1]);
  const startRow = parseInt(m[2], 10);
  const endCol = colLetterToIndex(m[3]);
  const endRow = parseInt(m[4], 10);
  return {
    expectedRows: endRow - startRow + 1,
    expectedCols: endCol - startCol + 1
  };
}

export function validateCapture(receipt, payload, expectedOptions = {}) {
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

export function excelSerialToIsoDate(serial) {
  const n = Number(serial);
  if (isNaN(n) || n <= 0) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}

export function safeParseNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/[¥￥,%\s]/g, '').trim();
  if (!s || s === '-' || s === '—' || s === '/' || s === 'null' || s === 'None' || s.startsWith('#')) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function strictRatio(numer, denom, digits = null) {
  if (numer === null || denom === null) return null;
  if (denom === 0) return null;
  if (numer === 0 && denom > 0) return 0;
  if (denom > 0) {
    const r = numer / denom;
    return digits !== null ? Number(r.toFixed(digits)) : r;
  }
  return null;
}

export function strictSum(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  let sum = 0;
  for (const n of numbers) {
    if (n === null || n === undefined || isNaN(n)) return null;
    sum += n;
  }
  return sum;
}

function extractDataRows(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.sheets) && input.sheets[0] && Array.isArray(input.sheets[0].data)) {
    return input.sheets[0].data;
  }
  throw new Error('PARSER_ERROR: Invalid table input, expected rows array or sheets payload');
}

export function parseWipesDelivery(input) {
  const rows = extractDataRows(input);
  if (rows.length < 3) {
    throw new Error('WIPES_DELIVERY: Insufficient rows in capture table');
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i];
    if (r && r[0] === '时间' && String(r[1]).includes('消费')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('WIPES_DELIVERY: Header row not found or headers mismatch');
  }

  const resultRows = [];
  const seenDates = new Set();
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (r[0] === '总计' || r[0] === '小计') {
      totalRow = r;
      continue;
    }
    const date = excelSerialToIsoDate(r[0]);
    if (!date) continue;

    if (seenDates.has(date)) {
      throw new Error(`WIPES_DELIVERY: Duplicate date encountered: ${date}`);
    }
    seenDates.add(date);

    const spend = safeParseNum(r[1]);
    const imp = safeParseNum(r[2]);
    const eng = safeParseNum(r[3]);
    const uv = safeParseNum(r[4]);
    const cpm = strictRatio(spend !== null ? spend * 1000 : null, imp, 2);
    const cpe = strictRatio(spend, eng, 2);
    const cpuv = strictRatio(spend, uv, 2);

    resultRows.push({
      date,
      spend: spend !== null ? Number(spend.toFixed(2)) : null,
      impressions: imp !== null ? Math.round(imp) : null,
      engagements: eng !== null ? Math.round(eng) : null,
      uv: uv !== null ? Math.round(uv) : null,
      cpm,
      cpe,
      cpuv
    });
  }

  resultRows.sort((a, b) => a.date.localeCompare(b.date));

  if (totalRow) {
    const expectedSpend = safeParseNum(totalRow[1]);
    const actualSpend = strictSum(resultRows.map((r) => r.spend));
    if (expectedSpend !== null && actualSpend !== null) {
      if (Math.abs(actualSpend - expectedSpend) >= 0.01) {
        throw new Error(`WIPES_DELIVERY: Spend total mismatch (actual ${actualSpend} vs expected ${expectedSpend})`);
      }
    }
  }

  return {
    rows: resultRows,
    period: resultRows.length > 0 ? `${resultRows[0].date} ~ ${resultRows[resultRows.length - 1].date}` : '',
    totalRow
  };
}

export function parseWipesTaosou(input) {
  const rows = extractDataRows(input);
  if (rows.length < 3) {
    throw new Error('WIPES_TAOSOU: Insufficient rows in capture table');
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i];
    if (r && r[0] === '日期' && String(r[1]).includes('稳健')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('WIPES_TAOSOU: Header row not found or headers mismatch');
  }

  let totalRow = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && (rows[i][0] === '总计' || rows[i][0] === '小计')) {
      totalRow = rows[i];
      break;
    }
  }

  const uvMap = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[14] === null || r[14] === undefined || r[14] === '') continue;
    const oVal = safeParseNum(r[14]);
    if (!oVal) continue;
    const str = String(Math.round(oVal));
    if (str.length === 8) {
      const iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
      uvMap.set(iso, {
        search_uv: safeParseNum(r[15]),
        shop_uv: safeParseNum(r[16]),
        redstar_uv: safeParseNum(r[17])
      });
    }
  }

  const resultRows = [];
  const seenDates = new Set();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || r[0] === '总计' || r[0] === '日期') continue;
    const date = excelSerialToIsoDate(r[0]);
    if (!date) continue;

    const bgEmpty = [1, 2, 3, 4, 5, 6].every((c) => r[c] === null || r[c] === undefined || r[c] === '');
    const ilEmpty = [8, 9, 10, 11].every((c) => r[c] === null || r[c] === undefined || r[c] === '');
    if (bgEmpty && ilEmpty) continue;

    if (seenDates.has(date)) {
      throw new Error(`WIPES_TAOSOU: Duplicate date encountered: ${date}`);
    }
    seenDates.add(date);

    const kw_wipes = safeParseNum(r[1]);
    const kw_corn_wipes = safeParseNum(r[2]);
    const kw_alcohol = safeParseNum(r[3]);
    const kw_alcohol_wipes = safeParseNum(r[4]);
    const kw_corn_alcohol_wipes = safeParseNum(r[5]);
    const kw_disinfect_wipes = safeParseNum(r[6]);
    const kw_total_index = strictSum([kw_wipes, kw_corn_wipes, kw_alcohol, kw_alcohol_wipes, kw_corn_alcohol_wipes, kw_disinfect_wipes]);

    const spend_k = safeParseNum(r[8]);
    const spend_f = safeParseNum(r[9]);
    const spend_s = safeParseNum(r[10]);
    const spend_cid = safeParseNum(r[11]);
    // strictSum: if any channel is missing/null, spend_total is null!
    const spend_total = strictSum([spend_k, spend_f, spend_s, spend_cid]);

    const uvs = uvMap.get(date) || { search_uv: null, shop_uv: null, redstar_uv: null };

    resultRows.push({
      date,
      kw_total_index,
      kw_wipes,
      kw_corn_wipes,
      kw_alcohol,
      kw_alcohol_wipes,
      kw_corn_alcohol_wipes,
      kw_disinfect_wipes,
      spend_k,
      spend_f,
      spend_s,
      spend_cid,
      spend_total,
      ...uvs
    });
  }

  resultRows.sort((a, b) => a.date.localeCompare(b.date));

  if (totalRow) {
    const expectedSpend = safeParseNum(totalRow[12]);
    const observedSpends = resultRows.map((r) => r.spend_total).filter((s) => s !== null);
    const actualObservedSpend = strictSum(observedSpends);
    if (expectedSpend !== null && actualObservedSpend !== null) {
      if (Math.abs(actualObservedSpend - expectedSpend) >= 0.01) {
        throw new Error(`WIPES_TAOSOU: Spend total mismatch (actual observed ${actualObservedSpend} vs expected ${expectedSpend})`);
      }
    }
  }

  return {
    rows: resultRows,
    period: resultRows.length > 0 ? `${resultRows[0].date} ~ ${resultRows[resultRows.length - 1].date}` : '',
    totalRow
  };
}

export function parseHuangCommerce(input) {
  const rows = extractDataRows(input);
  if (rows.length < 3) {
    throw new Error('HUANG_COMMERCE: Insufficient rows in capture table');
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i];
    if (r && r[0] === '时间' && String(r[1]).includes('消')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('HUANG_COMMERCE: Header row not found');
  }

  const resultRows = [];
  const seenDates = new Set();
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (r[0] === '总计' || r[0] === '小计') {
      totalRow = r;
      continue;
    }
    const date = excelSerialToIsoDate(r[0]);
    if (!date) continue;

    if (seenDates.has(date)) {
      throw new Error(`HUANG_COMMERCE: Duplicate date encountered: ${date}`);
    }
    seenDates.add(date);

    const spend = safeParseNum(r[1]);
    const uv = safeParseNum(r[2]);
    const cart = safeParseNum(r[4]);
    const orders = safeParseNum(r[6]);
    const gmv = safeParseNum(r[8]);
    const imp = safeParseNum(r[10]);
    const clicks = safeParseNum(r[11]);

    const engagements = null;
    const cpe = null;

    const roi = strictRatio(gmv, spend, 4);
    const cpuv = strictRatio(spend, uv, 4);
    const cost_per_cart = strictRatio(spend, cart, 4);
    const cost_per_order = strictRatio(spend, orders, 4);
    const aov = strictRatio(gmv, orders, 4);
    const cpc = strictRatio(spend, clicks, 4);
    const ctr = strictRatio(clicks !== null ? clicks * 100 : null, imp, 4);
    const cpm = strictRatio(spend !== null ? spend * 1000 : null, imp, 4);

    resultRows.push({
      date,
      spend: spend !== null ? Number(spend.toFixed(2)) : null,
      impressions: imp !== null ? Math.round(imp) : null,
      clicks: clicks !== null ? Math.round(clicks) : null,
      engagements,
      uv: uv !== null ? Math.round(uv) : null,
      cart: cart !== null ? Math.round(cart) : null,
      orders: orders !== null ? Math.round(orders) : null,
      gmv: gmv !== null ? Number(gmv.toFixed(2)) : null,
      roi,
      cpuv,
      cost_per_cart,
      cost_per_order,
      aov,
      cpc,
      ctr,
      cpm,
      cpe
    });
  }

  resultRows.sort((a, b) => a.date.localeCompare(b.date));

  if (totalRow) {
    const expectedSpend = safeParseNum(totalRow[1]);
    const actualSpend = strictSum(resultRows.map((r) => r.spend));
    if (expectedSpend !== null && actualSpend !== null) {
      if (Math.abs(actualSpend - expectedSpend) >= 0.01) {
        throw new Error(`HUANG_COMMERCE: Spend total mismatch (actual ${actualSpend} vs expected ${expectedSpend})`);
      }
    }
  }

  return {
    rows: resultRows,
    period: resultRows.length > 0 ? `${resultRows[0].date} ~ ${resultRows[resultRows.length - 1].date}` : '',
    totalRow
  };
}

export function parseHuangCid(input) {
  const rows = extractDataRows(input);
  if (rows.length < 13) {
    throw new Error('HUANG_CID: Insufficient rows in capture table');
  }

  const stdHeaderRow = rows[11];
  if (!stdHeaderRow || stdHeaderRow[0] !== '时间' || stdHeaderRow[1] !== '消耗') {
    throw new Error('HUANG_CID: Standard block header mismatch at row 11');
  }

  const simHeaderRow = rows[9];
  if (!simHeaderRow || simHeaderRow[12] !== '时间' || simHeaderRow[13] !== '消耗') {
    throw new Error('HUANG_CID: Simple block header mismatch at row 9');
  }

  const stdRows = [];
  const simRows = [];
  const stdSeenDates = new Set();
  const simSeenDates = new Set();
  let stdTotalRow = null;
  let simTotalRow = null;

  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (r[0] === '总计' || r[0] === '小计') {
      stdTotalRow = r;
      continue;
    }
    if (r[0] !== null && r[0] !== undefined && r[0] !== '') {
      const date = excelSerialToIsoDate(r[0]);
      if (date) {
        if (stdSeenDates.has(date)) {
          throw new Error(`HUANG_CID: Duplicate date in Standard block: ${date}`);
        }
        stdSeenDates.add(date);

        const spend = safeParseNum(r[1]);
        const ctrFraction = safeParseNum(r[2]);
        const ctr = ctrFraction !== null ? Number((ctrFraction * 100).toFixed(2)) : null;
        const cpc = safeParseNum(r[3]);
        const cpm = safeParseNum(r[4]);
        const orders = safeParseNum(r[5]);
        const gmv = safeParseNum(r[6]);
        const roi = safeParseNum(r[7]);
        const uv = safeParseNum(r[8]);
        const cpuv = safeParseNum(r[9]);
        const aov = safeParseNum(r[10]);

        stdRows.push({
          date,
          spend: spend !== null ? Number(spend.toFixed(2)) : null,
          ctr,
          cpc: cpc !== null ? Number(cpc.toFixed(2)) : null,
          cpm: cpm !== null ? Number(cpm.toFixed(2)) : null,
          orders: orders !== null ? Math.round(orders) : null,
          gmv: gmv !== null ? Number(gmv.toFixed(2)) : null,
          roi: roi !== null ? Number(roi.toFixed(2)) : null,
          uv: uv !== null ? Math.round(uv) : null,
          cpuv: cpuv !== null ? Number(cpuv.toFixed(2)) : null,
          aov: aov !== null ? Number(aov.toFixed(2)) : null
        });
      }
    }
  }

  for (let i = 10; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (r[12] === '总计' || r[12] === '小计') {
      simTotalRow = r;
      continue;
    }
    if (r[12] !== null && r[12] !== undefined && r[12] !== '') {
      const date = excelSerialToIsoDate(r[12]);
      if (date) {
        if (simSeenDates.has(date)) {
          throw new Error(`HUANG_CID: Duplicate date in Simple block: ${date}`);
        }
        simSeenDates.add(date);

        const spend = safeParseNum(r[13]);
        const ctrFraction = safeParseNum(r[14]);
        const ctr = ctrFraction !== null ? Number((ctrFraction * 100).toFixed(2)) : null;
        const cpc = safeParseNum(r[15]);
        const cpm = safeParseNum(r[16]);
        const orders = safeParseNum(r[17]);
        const gmv = safeParseNum(r[18]);
        const roi = safeParseNum(r[19]);
        const uv = safeParseNum(r[20]);
        const cpuv = safeParseNum(r[21]);
        const aov = safeParseNum(r[22]);

        simRows.push({
          date,
          spend: spend !== null ? Number(spend.toFixed(2)) : null,
          ctr,
          cpc: cpc !== null ? Number(cpc.toFixed(2)) : null,
          cpm: cpm !== null ? Number(cpm.toFixed(2)) : null,
          orders: orders !== null ? Math.round(orders) : null,
          gmv: gmv !== null ? Number(gmv.toFixed(2)) : null,
          roi: roi !== null ? Number(roi.toFixed(2)) : null,
          uv: uv !== null ? Math.round(uv) : null,
          cpuv: cpuv !== null ? Number(cpuv.toFixed(2)) : null,
          aov: aov !== null ? Number(aov.toFixed(2)) : null
        });
      }
    }
  }

  stdRows.sort((a, b) => a.date.localeCompare(b.date));
  simRows.sort((a, b) => a.date.localeCompare(b.date));

  if (stdTotalRow) {
    const expectedSpend = safeParseNum(stdTotalRow[1]);
    const actualSpend = strictSum(stdRows.map((r) => r.spend));
    if (expectedSpend !== null && actualSpend !== null) {
      if (Math.abs(actualSpend - expectedSpend) >= 0.01) {
        throw new Error(`HUANG_CID: Standard spend total mismatch (${actualSpend} vs ${expectedSpend})`);
      }
    }
  }

  if (simTotalRow) {
    const expectedSpend = safeParseNum(simTotalRow[13]);
    const actualSpend = strictSum(simRows.map((r) => r.spend));
    if (expectedSpend !== null && actualSpend !== null) {
      if (Math.abs(actualSpend - expectedSpend) >= 0.01) {
        throw new Error(`HUANG_CID: Simple spend total mismatch (${actualSpend} vs ${expectedSpend})`);
      }
    }
  }

  const stdMap = new Map(stdRows.map((r) => [r.date, r]));
  const simMap = new Map(simRows.map((r) => [r.date, r]));
  const allDates = Array.from(new Set([...stdMap.keys(), ...simMap.keys()])).sort();

  const totalRows = [];
  for (const date of allDates) {
    const std = stdMap.get(date);
    const sim = simMap.get(date);

    const spend = strictSum([std?.spend ?? null, sim?.spend ?? null]);
    const orders = strictSum([std?.orders ?? null, sim?.orders ?? null]);
    const gmv = strictSum([std?.gmv ?? null, sim?.gmv ?? null]);
    const uv = strictSum([std?.uv ?? null, sim?.uv ?? null]);

    const roi = strictRatio(gmv, spend, 4);
    const cpuv = strictRatio(spend, uv, 4);
    const aov = strictRatio(gmv, orders, 4);

    totalRows.push({
      date,
      spend: spend !== null ? Number(spend.toFixed(2)) : null,
      orders: orders !== null ? Math.round(orders) : null,
      gmv: gmv !== null ? Number(gmv.toFixed(2)) : null,
      uv: uv !== null ? Math.round(uv) : null,
      roi,
      cpuv,
      aov
    });
  }

  return {
    standard: {
      rows: stdRows,
      period: stdRows.length > 0 ? `${stdRows[0].date} ~ ${stdRows[stdRows.length - 1].date}` : '',
      totalRow: stdTotalRow
    },
    simple: {
      rows: simRows,
      period: simRows.length > 0 ? `${simRows[0].date} ~ ${simRows[simRows.length - 1].date}` : '',
      totalRow: simTotalRow
    },
    total: {
      rows: totalRows,
      period: totalRows.length > 0 ? `${totalRows[0].date} ~ ${totalRows[totalRows.length - 1].date}` : ''
    }
  };
}

export function parseMeilingPivot(input, options = {}) {
  const isCid = !!options.isCid;
  const rows = extractDataRows(input);
  if (rows.length < 3) {
    throw new Error('MEILING_PIVOT: Insufficient rows in capture table');
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i];
    if (r && r[0] === '时间' && (String(r[1]).includes('消') || String(r[1]).includes('耗'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('MEILING_PIVOT: Header row not found');
  }

  const resultRows = [];
  const seenDates = new Set();
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (r[0] === '总计' || r[0] === '小计') {
      totalRow = r;
      continue;
    }
    const date = excelSerialToIsoDate(r[0]);
    if (!date) continue;

    if (seenDates.has(date)) {
      throw new Error(`MEILING_PIVOT: Duplicate date encountered: ${date}`);
    }
    seenDates.add(date);

    const spend = safeParseNum(r[1]);
    const imp = safeParseNum(r[2]);
    const clicks = safeParseNum(r[3]);
    const ctr = strictRatio(clicks !== null ? clicks * 100 : null, imp, 2);
    const cpc = strictRatio(spend, clicks, 2);
    const cpm = strictRatio(spend !== null ? spend * 1000 : null, imp, 2);
    const eng = safeParseNum(r[7]);
    const cpe = strictRatio(spend, eng, 2);

    if (isCid) {
      const orders = safeParseNum(r[9]);
      const gmv = safeParseNum(r[10]);
      const roi = strictRatio(gmv, spend, 2);
      const uv = safeParseNum(r[12]);

      resultRows.push({
        date,
        spend: spend !== null ? Number(spend.toFixed(2)) : null,
        impressions: imp !== null ? Math.round(imp) : null,
        clicks: clicks !== null ? Math.round(clicks) : null,
        ctr,
        cpc,
        cpm,
        engagements: eng !== null ? Math.round(eng) : null,
        cpe,
        orders: orders !== null ? Math.round(orders) : null,
        gmv: gmv !== null ? Number(gmv.toFixed(2)) : null,
        roi,
        uv: uv !== null ? Math.round(uv) : null
      });
    } else {
      const uv = safeParseNum(r[9]);
      const cpuv = strictRatio(spend, uv, 2);

      resultRows.push({
        date,
        spend: spend !== null ? Number(spend.toFixed(2)) : null,
        impressions: imp !== null ? Math.round(imp) : null,
        clicks: clicks !== null ? Math.round(clicks) : null,
        ctr,
        cpc,
        cpm,
        engagements: eng !== null ? Math.round(eng) : null,
        cpe,
        uv: uv !== null ? Math.round(uv) : null,
        cpuv
      });
    }
  }

  resultRows.sort((a, b) => a.date.localeCompare(b.date));

  if (totalRow) {
    const expectedSpend = safeParseNum(totalRow[1]);
    const actualSpend = strictSum(resultRows.map((r) => r.spend));
    if (expectedSpend !== null && actualSpend !== null) {
      if (Math.abs(actualSpend - expectedSpend) >= 0.01) {
        throw new Error(`MEILING_PIVOT: Spend total mismatch (actual ${actualSpend} vs expected ${expectedSpend})`);
      }
    }
  }

  return {
    rows: resultRows,
    period: resultRows.length > 0 ? `${resultRows[0].date} ~ ${resultRows[resultRows.length - 1].date}` : '',
    totalRow
  };
}

export function parseHuangBrandRaw(input) {
  const rows = extractDataRows(input);
  if (rows.length < 10) {
    throw new Error('HUANG_BRAND_RAW: Insufficient rows in capture table');
  }

  const headers = rows[0];
  const headerMap = new Map();
  headers.forEach((h, idx) => headerMap.set(h, idx));

  const required = [
    '时间', '消费', '展现量', '点击量', '互动量',
    '视频5s播放量', '新增种草人群', '新增深度种草人群', '小红星站外活跃行为UV(30日归因)'
  ];
  for (const req of required) {
    if (!headerMap.has(req)) {
      throw new Error(`HUANG_BRAND_RAW: Missing required column header: "${req}"`);
    }
  }

  const timeCol = headerMap.get('时间');
  const spendCol = headerMap.get('消费');
  const impCol = headerMap.get('展现量');
  const clickCol = headerMap.get('点击量');
  const engCol = headerMap.get('互动量');
  const play5sCol = headerMap.get('视频5s播放量');
  const seedICol = headerMap.get('新增种草人群');
  const seedTiCol = headerMap.get('新增深度种草人群');
  const uvCol = headerMap.get('小红星站外活跃行为UV(30日归因)');

  const dailyMap = new Map();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dateRaw = r[timeCol];
    if (!dateRaw) continue;
    const date = excelSerialToIsoDate(dateRaw);
    if (!date) continue;

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        spend: 0,
        imp: 0,
        clicks: 0,
        eng: 0,
        plays_5s: 0,
        seed_i: 0,
        seed_ti: 0,
        uv: 0
      });
    }
    const acc = dailyMap.get(date);
    acc.spend = strictSum([acc.spend, safeParseNum(r[spendCol])]);
    acc.imp = strictSum([acc.imp, safeParseNum(r[impCol])]);
    acc.clicks = strictSum([acc.clicks, safeParseNum(r[clickCol])]);
    acc.eng = strictSum([acc.eng, safeParseNum(r[engCol])]);
    acc.plays_5s = strictSum([acc.plays_5s, safeParseNum(r[play5sCol])]);
    acc.seed_i = strictSum([acc.seed_i, safeParseNum(r[seedICol])]);
    acc.seed_ti = strictSum([acc.seed_ti, safeParseNum(r[seedTiCol])]);
    acc.uv = strictSum([acc.uv, safeParseNum(r[uvCol])]);
  }

  const resultRows = [];
  const sortedDates = Array.from(dailyMap.keys()).sort();

  for (const date of sortedDates) {
    const d = dailyMap.get(date);
    const spend = d.spend;
    const imp = d.imp;
    const clicks = d.clicks;
    const eng = d.eng;
    const plays_5s = d.plays_5s;
    const seed_i = d.seed_i;
    const seed_ti = d.seed_ti;
    const seed_total = (seed_i !== null && seed_ti !== null) ? seed_i + seed_ti : null;
    const uv = d.uv;

    const ctr = strictRatio(clicks !== null ? clicks * 100 : null, imp, 2);
    const cpc = strictRatio(spend, clicks, 2);
    const cpm = strictRatio(spend !== null ? spend * 1000 : null, imp, 2);
    const ctr_5s = strictRatio(plays_5s !== null ? plays_5s * 100 : null, imp, 2);
    const cpc_5s = strictRatio(spend, plays_5s, 2);
    const cpe = strictRatio(spend, eng, 2);
    const cpi = strictRatio(spend, seed_i, 2);
    const cpti = strictRatio(spend, seed_ti, 2);
    const cp_total = strictRatio(spend, seed_total, 2);
    const cpuv = strictRatio(spend, uv, 2);

    resultRows.push({
      date,
      spend: spend !== null ? Number(spend.toFixed(2)) : null,
      impressions: imp !== null ? Math.round(imp) : null,
      clicks: clicks !== null ? Math.round(clicks) : null,
      ctr,
      cpc,
      cpm,
      plays_5s: plays_5s !== null ? Math.round(plays_5s) : null,
      ctr_5s,
      cpc_5s,
      engagements: eng !== null ? Math.round(eng) : null,
      cpe,
      seed_i: seed_i !== null ? Math.round(seed_i) : null,
      cpi,
      seed_ti: seed_ti !== null ? Math.round(seed_ti) : null,
      cpti,
      seed_total: seed_total !== null ? Math.round(seed_total) : null,
      cp_total,
      uv: uv !== null ? Math.round(uv) : null,
      cpuv
    });
  }

  return {
    rows: resultRows,
    period: resultRows.length > 0 ? `${resultRows[0].date} ~ ${resultRows[resultRows.length - 1].date}` : ''
  };
}

export function rebuildHuangSummaryTables(brandDailyRows, commerceDailyRows) {
  const brandSpend = strictSum(brandDailyRows.map((r) => r.spend));
  const brandImp = strictSum(brandDailyRows.map((r) => r.impressions));
  const brandClicks = strictSum(brandDailyRows.map((r) => r.clicks));
  const brandEng = strictSum(brandDailyRows.map((r) => r.engagements));
  const brandPlays5s = strictSum(brandDailyRows.map((r) => r.plays_5s));
  const brandSeedI = strictSum(brandDailyRows.map((r) => r.seed_i));
  const brandSeedTi = strictSum(brandDailyRows.map((r) => r.seed_ti));
  const brandSeedTotal = brandSeedI !== null && brandSeedTi !== null ? brandSeedI + brandSeedTi : null;
  const brandUv = strictSum(brandDailyRows.map((r) => r.uv));

  const brandSummaryRow = {
    spend: brandSpend !== null ? Number(brandSpend.toFixed(2)) : null,
    impressions: brandImp !== null ? Math.round(brandImp) : null,
    clicks: brandClicks !== null ? Math.round(brandClicks) : null,
    ctr: strictRatio(brandClicks !== null ? brandClicks * 100 : null, brandImp, 2),
    cpc: strictRatio(brandSpend, brandClicks, 2),
    cpm: strictRatio(brandSpend !== null ? brandSpend * 1000 : null, brandImp, 2),
    plays_5s: brandPlays5s !== null ? Math.round(brandPlays5s) : null,
    ctr_5s: strictRatio(brandPlays5s !== null ? brandPlays5s * 100 : null, brandImp, 2),
    cpc_5s: strictRatio(brandSpend, brandPlays5s, 2),
    engagements: brandEng !== null ? Math.round(brandEng) : null,
    cpe: strictRatio(brandSpend, brandEng, 2),
    seed_i: brandSeedI !== null ? Math.round(brandSeedI) : null,
    cpi: strictRatio(brandSpend, brandSeedI, 2),
    seed_ti: brandSeedTi !== null ? Math.round(brandSeedTi) : null,
    cpti: strictRatio(brandSpend, brandSeedTi, 2),
    seed_total: brandSeedTotal !== null ? Math.round(brandSeedTotal) : null,
    cp_total: strictRatio(brandSpend, brandSeedTotal, 2),
    uv: brandUv !== null ? Math.round(brandUv) : null,
    cpuv: strictRatio(brandSpend, brandUv, 2),
    isSummary: true
  };

  const budgetVal = 565475.09;
  const brandBudgetRow = {
    budget: budgetVal,
    spend: brandSpend !== null ? Number(brandSpend.toFixed(2)) : null,
    reportedProgress: null,
    calculatedProgress: brandSpend !== null ? Number(((brandSpend / 565475.091) * 100).toFixed(4)) : null,
    isSummary: true
  };

  const commSpend = strictSum(commerceDailyRows.map((r) => r.spend));
  const commImp = strictSum(commerceDailyRows.map((r) => r.impressions));
  const commClicks = strictSum(commerceDailyRows.map((r) => r.clicks));
  const commUv = strictSum(commerceDailyRows.map((r) => r.uv));
  const commCart = strictSum(commerceDailyRows.map((r) => r.cart));
  const commOrders = strictSum(commerceDailyRows.map((r) => r.orders));
  const commGmv = strictSum(commerceDailyRows.map((r) => r.gmv));

  const commerceSummaryRow = {
    spend: commSpend !== null ? Number(commSpend.toFixed(2)) : null,
    impressions: commImp !== null ? Math.round(commImp) : null,
    clicks: commClicks !== null ? Math.round(commClicks) : null,
    engagements: null,
    uv: commUv !== null ? Math.round(commUv) : null,
    cart: commCart !== null ? Math.round(commCart) : null,
    orders: commOrders !== null ? Math.round(commOrders) : null,
    gmv: commGmv !== null ? Number(commGmv.toFixed(2)) : null,
    isSummary: true
  };

  return {
    brandSummary: brandSummaryRow,
    brandBudget: brandBudgetRow,
    commerceSummary: commerceSummaryRow
  };
}
