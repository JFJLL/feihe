// @ts-nocheck
import {
  extractDataRows,
  excelSerialToIsoDate,
  safeParseNum,
  strictRatio,
  strictSum,
  validateCapture,
  computeFileDigest,
} from '@/lib/core/transform-kit';

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
    const sheet_subtotal = safeParseNum(r[12]);
    const spend_channels = [spend_k, spend_f, spend_s, spend_cid].filter((n) => n !== null);
    const spend_total = sheet_subtotal !== null ? sheet_subtotal : (spend_channels.length > 0 ? strictSum(spend_channels) : null);

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
