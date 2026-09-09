import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import vm from 'node:vm';
import ts from 'typescript';

process.env.LOCAL_DB_PATH=':memory:';
process.env.LOCAL_DB_NO_SEED='true';

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const m = await vite.ssrLoadModule('/lib/dashboard-display.ts');
  assert.equal(m.contentDirectionLabel('11-1v1转奶'), '1v1转奶');
  assert.equal(m.contentDirectionLabel('3-追肉场景'), '追肉场景');
  assert.equal(m.contentDirectionLabel('A2-1V1转奶'), 'A2-1V1转奶');
  assert.equal(m.contentDirectionLabel(null), '未标注');
  assert.deepEqual(m.aggregateTopics([{name:'转奶',count:5},{name:'转奶',count:2},{name:'其他',count:20}]), {words:[{text:'转奶',count:7}],unclassified:20});
  const rows = [{date:'1',a:null},{date:'2',a:0},{date:'3',a:null},{date:'4',a:5},{date:'5',a:null}];
  assert.deepEqual(m.trimEmptyTrendEdges(rows,['a']), rows.slice(1,4), 'real zeros and internal gaps remain');
  assert.deepEqual(m.trimEmptyTrendEdges(rows,['b']), []);
  assert.deepEqual(m.boxStatistics([0,0,0,10]), {min:0,q1:0,median:0,q3:2.5,max:10,count:4});
  assert.equal(m.boxStatistics([4]).median,4);
  const charts = await vite.ssrLoadModule('/features/overview/AdvancedCharts.tsx');
  const markup = renderToStaticMarkup(React.createElement(charts.BoxPlotChart,{groups:[{label:'KOC',values:[0,10]}],unit:'互动'}));
  assert.match(markup,/tabindex="0"/i);
  assert.match(markup,/KOC，2 篇，中位数 5/);
  assert.match(markup,/height:260px/);

  // Execute the production note query against >500 records, preserving project scope.
  const source = fs.readFileSync(new URL('../app/api/dashboard/route.ts',import.meta.url),'utf8');
  const query = source.match(/bind\(`(SELECT n\.id,n\.url,n\.author,n\.title,[\s\S]*?)`\)\.all\(\)/)[1];
  const db = new DatabaseSync(':memory:');
  const aliases = { n:'notes',pn:'project_notes',p:'note_profiles' };
  for (const [alias,table] of Object.entries(aliases)) {
    const columns = [...new Set([...query.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`,'g'))].map(x=>x[1]))];
    if(alias==='pn') columns.push('project_id');
    db.exec(`CREATE TABLE ${table} (${[...new Set(columns)].map(x=>x+' TEXT').join(',')})`);
  }
  for(let i=0;i<751;i++) {
    db.prepare('INSERT INTO notes(id,title) VALUES(?,?)').run(String(i),'note '+i);
    db.prepare('INSERT INTO project_notes(note_id,project_id) VALUES(?,?)').run(String(i),i===750?'other':'qicui');
  }
  const result = db.prepare(query.replace('${where}',' WHERE pn.project_id=?')).all('qicui');
  assert.equal(result.length,750,'all project notes beyond page 500');
  assert.equal(new Set(result.map(r=>r.id)).size,750);
  assert.equal(result.some(r=>r.id==='750'),false);
  db.close();
  // Exercise the actual route and its normalization CTE, including observed zero
  // vs missing source metrics, across more than 500 notes.
  const dbmod = await vite.ssrLoadModule('/lib/db.ts');
  await dbmod.ensureSchema();
  const sql = dbmod.db();
  for(let i=0;i<750;i++) {
    await sql.prepare('INSERT INTO notes(id,url) VALUES(?,?)').bind('full-'+i,'https://example.test/'+i).run();
    await sql.prepare('INSERT INTO project_notes(id,project_id,note_id,added_at) VALUES(?,?,?,?)').bind('test:'+i,'full-test','full-'+i,'2026-01-01').run();
  }
  for(const [id,json] of [[0,JSON.stringify({read_count:0,interaction_count:null})],[1,null]]) {
    await sql.prepare('INSERT INTO note_profiles(note_id,source_metrics_json,updated_at) VALUES(?,?,?)').bind('full-'+id,json,'2026-09-09').run();
  }
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const require=name=>({
    '@/lib/api-auth':{apiUser:async()=>true,jsonError:(error,status)=>Response.json({error},{status})},
    '@/lib/db':dbmod,'@/lib/projects':{projectId:v=>v||'qicui'},
    '@/lib/feishu-sync':{readFeishuData:async()=>({})},
  })[name];
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{Response,URL,URLSearchParams})(require,mod,mod.exports);
  const response=await mod.exports.GET(new Request('http://localhost/api/dashboard?projectId=full-test&fresh=1'));
  const payload=await response.json();
  assert.equal(response.status,200,JSON.stringify(payload));
  assert.equal(payload.notes.length,750);
  assert.equal(payload.metrics.noteCount,750);
  assert.equal(payload.notes.find(n=>n.id==='full-0').readCount,0);
  assert.equal(payload.notes.find(n=>n.id==='full-0').interactionCount,null);
  assert.equal(payload.notes.find(n=>n.id==='full-1').readCount,null,'legacy default is not proof of an observed zero');
  console.log('PASS feedback: full notes SQL, project isolation, prefixes, merged topics, zero/gap domains, box quantiles and accessible compact rendering');
} finally { await vite.close(); }
