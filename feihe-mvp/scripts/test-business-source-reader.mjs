import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { readBusinessSource } from './business-source-reader.mjs';
const sourceUrl='https://example.test/report';
const spec={type:'feishu_document',sourceKey:'report',sourceUrl,year:2026};
const doc='<h1>10月14日</h1><sheet token="book" sheet-id="new"/><h1><b>10月13日</b></h1><sheet token="book" sheet-id="old"/><h1>10月1日</h1><sheet token="book" sheet-id="history"/>';
function vendor(options={}) {
  return async args => {
    if (args[0]==='docs') return {document:{content:doc,revision_id:options.changed && args.includes('outline') ? 2 : 1}};
    if (args[1]==='+workbook-info') return {revision:options.version ?? 10,sheets:['new','old','history'].map(sheet_id=>({sheet_id}))};
    const index=args.indexOf('--output-path'), output=args[index+1];
    const rows=[['时间节点','FS预算'],['10月1日',100]];
    await fs.writeFile(output,JSON.stringify({sheets:[{range:options.badRows ? 'A1:B3':'A1:B2',data:rows}]}));
    return {complete:true,has_more:options.hasMore || false};
  };
}
test('manual backfill selects the requested historical heading, not the latest two dates; missing dates cannot report success',async()=>{
  const result=await readBusinessSource(spec,{project_id:'example'},{bindings:[]},{window_from:'2026-10-01',window_to:'2026-10-01'},vendor());
  assert.deepEqual(result.bundle.tables.map(t=>t.reportDay),['2026-10-01']);assert.equal(result.bundle.tables[0].sheetId,'history');
  await assert.rejects(()=>readBusinessSource(spec,{}, {bindings:[]},{window_from:'2026-10-02',window_to:'2026-10-02'},vendor()),/没有指定/);
});
test('incomplete rows, has_more, and changed document revisions never publish captures',async()=>{
  for(const options of [{badRows:true},{hasMore:true},{changed:true}])await assert.rejects(()=>readBusinessSource(spec,{}, {bindings:[]},null,vendor(options)));
});
test('unversioned source uses its content fingerprint and undated cumulative source rejects a daily backfill',async()=>{
  const result=await readBusinessSource(spec,{}, {bindings:[]},null,vendor({version:0}));assert.match(result.bundle.tables[0].version,/^unversioned-sha256:[a-f0-9]{64}$/);
  await assert.rejects(()=>readBusinessSource({type:'feishu_table',sourceKey:'cumulative',sourceUrl,sheetId:'new',role:'keywords'}, {}, {bindings:[]},{window_from:'2026-10-01',window_to:'2026-10-01'},vendor()),/日粒度/);
});
