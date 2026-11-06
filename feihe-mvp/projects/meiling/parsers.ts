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
