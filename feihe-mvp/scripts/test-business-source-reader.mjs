import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readBusinessSource } from './business-source-reader.mjs';

function resolveOutput(args) {
  const index = args.indexOf('--output-path');
  const output = args[index + 1];
  return path.isAbsolute(output) ? output : path.join(os.tmpdir(), output);
}

const sourceUrl='https://example.test/report';
const spec={type:'feishu_document',sourceKey:'report',sourceUrl,year:2026};
const doc='<h1>10月14日</h1><sheet token="book" sheet-id="new"/><h1><b>10月13日</b></h1><sheet token="book" sheet-id="old"/><h1>10月1日</h1><sheet token="book" sheet-id="history"/>';
function vendor(options={}) {
  return async args => {
    if (args[0]==='docs') return {document:{content:doc,revision_id:options.changed && args.includes('outline') ? 2 : 1}};
    if (args[1]==='+workbook-info') return {revision:options.version ?? 10,sheets:['new','old','history'].map(sheet_id=>({sheet_id}))};
    const rows=[['时间节点','FS预算'],['10月1日',100]];
    await fs.writeFile(resolveOutput(args),JSON.stringify({sheets:[{range:options.badRows ? 'A1:B3':'A1:B2',data:rows}]}));
    return {complete:true,has_more:options.hasMore || false};
  };
}
test('manual backfill selects the requested historical heading, not the latest two dates; missing dates cannot report success',async()=>{
  const result=await readBusinessSource(spec,{project_id:'example'},{bindings:[]},{window_from:'2026-10-01',window_to:'2026-10-01'},vendor());
  assert.deepEqual(result.bundle.tables.map(t=>t.reportDay),['2026-10-01']);assert.equal(result.bundle.tables[0].sheetId,'history');
  await assert.rejects(()=>readBusinessSource(spec,{}, {bindings:[]},{window_from:'2026-10-02',window_to:'2026-10-02'},vendor()),/指定区间内未找到任何有效日报/);
});
test('incomplete rows, has_more, and changed document revisions never publish captures',async()=>{
  for(const options of [{badRows:true},{hasMore:true},{changed:true}])await assert.rejects(()=>readBusinessSource(spec,{}, {bindings:[]},null,vendor(options)));
});
test('unversioned source uses its content fingerprint and undated cumulative source rejects a daily backfill',async()=>{
  const result=await readBusinessSource(spec,{}, {bindings:[]},null,vendor({version:0}));assert.match(result.bundle.tables[0].version,/^unversioned-sha256:[a-f0-9]{64}$/);
  await assert.rejects(()=>readBusinessSource({type:'feishu_table',sourceKey:'cumulative',sourceUrl,sheetId:'new',role:'keywords'}, {}, {bindings:[]},{window_from:'2026-10-01',window_to:'2026-10-01'},vendor()),/日粒度/);
});

test('paged table reading seamlessly stitches chunks and preserves 0/null and source ordering', async () => {
  const totalRows = 2500;
  const pagedSpec = { type: 'feishu_table', sourceKey: 'large-table', sourceUrl: 'https://example.test/large', sheetId: 'pagedSheet', role: 'comment_register' };
  const generatedRows = Array.from({ length: totalRows }, (_, i) => [i === 0 ? 0 : i, i % 2 === 0 ? null : `val-${i}`, `row-${i}`]);
  const rangesRequested = [];

  const pagedVendor = async args => {
    if (args[1] === '+workbook-info') {
      return { revision: 42, sheets: [{ sheet_id: 'pagedSheet', row_count: totalRows, column_count: 3 }] };
    }
    const rangeIdx = args.indexOf('--range');
    const range = rangeIdx >= 0 ? args[rangeIdx + 1] : null;
    rangesRequested.push(range);

    const match = range?.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    const start = match ? Number(match[2]) : 1;
    const end = match ? Number(match[4]) : totalRows;
    const chunkRows = generatedRows.slice(start - 1, end);

    await fs.writeFile(resolveOutput(args), JSON.stringify({ sheets: [{ range, data: chunkRows }] }));
    return { complete: true, has_more: false };
  };

  const result = await readBusinessSource(pagedSpec, {}, { bindings: [] }, null, pagedVendor);
  assert.equal(result.rows, totalRows);
  assert.equal(result.bundle.tables[0].rows.length, totalRows);
  assert.equal(result.bundle.tables[0].rows[0][0], 0);
  assert.equal(result.bundle.tables[0].rows[0][1], null);
  assert.equal(result.bundle.tables[0].rows[2499][2], 'row-2499');
  assert.deepEqual(rangesRequested, ['A1:C1000', 'A1001:C2000', 'A2001:C2500']);
});

test('revision change triggers retry and succeeds when revision stabilizes, or fails after 3 retries', async () => {
  const pagedSpec = { type: 'feishu_table', sourceKey: 'retry-table', sourceUrl: 'https://example.test/retry', sheetId: 'retrySheet', role: 'comment_register' };
  let callCount = 0;

  // Stabilizes on second attempt
  const stabilizingVendor = async args => {
    if (args[1] === '+workbook-info') {
      callCount++;
      // Attempt 1: before=1, after=2; Attempt 2: before=2, after=2
      const rev = callCount === 1 ? 1 : 2;
      return { revision: rev, sheets: [{ sheet_id: 'retrySheet', row_count: 10, column_count: 2 }] };
    }
    await fs.writeFile(resolveOutput(args), JSON.stringify({ sheets: [{ range: 'A1:B10', data: Array.from({ length: 10 }, (_, i) => [i, `v-${i}`]) }] }));
    return { complete: true, has_more: false };
  };

  const res = await readBusinessSource(pagedSpec, {}, { bindings: [] }, null, stabilizingVendor);
  assert.equal(res.rows, 10);

  // Always changing revision
  let revCounter = 0;
  const unstableVendor = async args => {
    if (args[1] === '+workbook-info') {
      return { revision: ++revCounter, sheets: [{ sheet_id: 'retrySheet', row_count: 10, column_count: 2 }] };
    }
    await fs.writeFile(resolveOutput(args), JSON.stringify({ sheets: [{ range: 'A1:B10', data: Array.from({ length: 10 }, (_, i) => [i, `v-${i}`]) }] }));
    return { complete: true, has_more: false };
  };
  await assert.rejects(() => readBusinessSource(pagedSpec, {}, { bindings: [] }, null, unstableVendor), /来源在读取过程中发生变化/);
});

test('range validation: strictly rejects inverted, out-of-bounds, or malformed range', async () => {
  const baseSpec = { type: 'feishu_table', sourceKey: 'range-test', sourceUrl, sheetId: 'sheet1', role: 'keywords' };
  const mockInvoke = async args => {
    if (args[1] === '+workbook-info') return { revision: 1, sheets: [{ sheet_id: 'sheet1', row_count: 100, column_count: 10 }] };
    return { complete: true };
  };

  // Inverted row: A10:B2
  await assert.rejects(
    () => readBusinessSource({ ...baseSpec, range: 'A10:B2' }, {}, { bindings: [] }, null, mockInvoke),
    /读取范围行号无效或倒置/
  );

  // Inverted col: C1:A10
  await assert.rejects(
    () => readBusinessSource({ ...baseSpec, range: 'C1:A10' }, {}, { bindings: [] }, null, mockInvoke),
    /读取范围列号倒置/
  );

  // Row out of bounds: A1:B101 (sheet has 100)
  await assert.rejects(
    () => readBusinessSource({ ...baseSpec, range: 'A1:B101' }, {}, { bindings: [] }, null, mockInvoke),
    /超出工作表总行数/
  );

  // Col out of bounds: A1:K50 (sheet has 10 cols, K is 11)
  await assert.rejects(
    () => readBusinessSource({ ...baseSpec, range: 'A1:K50' }, {}, { bindings: [] }, null, mockInvoke),
    /超出工作表总列数/
  );

  // Malformed: not A1 notation
  await assert.rejects(
    () => readBusinessSource({ ...baseSpec, range: 'invalid_range' }, {}, { bindings: [] }, null, mockInvoke),
    /读取范围格式无效/
  );
});

test('chunk validation: rejects chunk range mismatch or row column count mismatch', async () => {
  const pagedSpec = { type: 'feishu_table', sourceKey: 'large', sourceUrl, sheetId: 'sheet1', role: 'comment_register' };

  // Wrong range returned in chunk 2 (masquerading page 1 as page 2)
  const masqueradeVendor = async args => {
    if (args[1] === '+workbook-info') return { revision: 1, sheets: [{ sheet_id: 'sheet1', row_count: 1500, column_count: 2 }] };
    const range = args[args.indexOf('--range') + 1];
    // For chunk 1 (A1:B1000), return valid chunk 1.
    // For chunk 2 (A1001:B1500), maliciously return range A1:B1000 masquerading as chunk 2.
    const isChunk1 = range === 'A1:B1000';
    const returnedRange = isChunk1 ? 'A1:B1000' : 'A1:B1000';
    const rowCount = isChunk1 ? 1000 : 500;
    await fs.writeFile(resolveOutput(args), JSON.stringify({ sheets: [{ range: returnedRange, data: Array.from({ length: rowCount }, () => ['x', 'y']) }] }));
    return { complete: true };
  };
  await assert.rejects(
    () => readBusinessSource(pagedSpec, {}, { bindings: [] }, null, masqueradeVendor),
    /表格分片范围不匹配/
  );

  // Row column count mismatch
  const colMismatchVendor = async args => {
    if (args[1] === '+workbook-info') return { revision: 1, sheets: [{ sheet_id: 'sheet1', row_count: 1500, column_count: 3 }] };
    const range = args[args.indexOf('--range') + 1];
    const match = range.match(/(\d+):[A-Z]+(\d+)/);
    const count = Number(match[2]) - Number(match[1]) + 1;
    // Row only has 2 columns instead of 3
    const data = Array.from({ length: count }, () => ['a', 'b']);
    await fs.writeFile(resolveOutput(args), JSON.stringify({ sheets: [{ range, data }] }));
    return { complete: true };
  };
  await assert.rejects(
    () => readBusinessSource(pagedSpec, {}, { bindings: [] }, null, colMismatchVendor),
    /列数不匹配/
  );
});
