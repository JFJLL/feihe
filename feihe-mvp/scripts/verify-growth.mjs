import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

// Execute the actual route SQL, not a second implementation of normalization.
const route = fs.readFileSync(new URL('../app/api/dashboard/route.ts', import.meta.url), 'utf8');
const sql = route.match(/bind\(`(SELECT CASE WHEN p\.brand[\s\S]*?)`\)\.all\(\)/)?.[1];
assert.ok(sql, 'actual dashboard brand SQL must be found');
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE notes(id TEXT PRIMARY KEY);
  CREATE TABLE project_notes(note_id TEXT,project_id TEXT,product_scope TEXT,comment_total INTEGER,positive_count INTEGER,negative_count INTEGER,question_count INTEGER);
  CREATE TABLE note_profiles(note_id TEXT,brand TEXT,read_count REAL,interaction_count REAL,note_price REAL);`);
const add = (id, brand, scope = '本品', project = 'test', metrics = [100, 10, 20]) => {
  db.prepare('INSERT INTO notes VALUES(?)').run(id);
  db.prepare('INSERT INTO project_notes VALUES(?,?,?,?,?,?,?)').run(id, project, scope, 10, 6, 2, 1);
  if (brand !== undefined) db.prepare('INSERT INTO note_profiles VALUES(?,?,?,?,?)').run(id, brand, ...metrics);
};
['启萃', '飞鹤启萃', '飞鹤', '本品', '', null, undefined].forEach((brand, i) => add('own' + i, brand));
['', null, undefined].forEach((brand, i) => add('unknown' + i, brand, '竞品', 'test', [null, null, null]));
add('zero', '零值品牌', '竞品', 'test', [0, 0, 0]);
add('partialA', '部分指标', '竞品', 'test', [100, null, 100]);
add('partialB', '部分指标', '竞品', 'test', [null, 10, null]);
for (let i = 0; i < 13; i++) add('other' + i, '竞品' + i, '竞品');
add('outside', '飞鹤', '本品', 'another-project');
const execute = scope => db.prepare(sql.replace('${where}', ' WHERE pn.project_id=?' + (scope ? ' AND pn.product_scope=?' : ''))).all(...(scope ? ['test', scope] : ['test']));
const brands = execute();
const own = brands.filter(r => r.brand === '启萃');
assert.equal(own.length, 1, 'all own aliases produce one row');
assert.equal(own[0].notes, 7);
assert.equal(own[0].comments, 70);
assert.equal(own[0].positive, 42);
assert.equal(own[0].negative, 14);
assert.equal(own[0].question, 7);
assert.equal(own[0].interactions, 60);
assert.equal(own[0].interactionSamples, 6);
assert.equal(own[0].pairedReads, 600);
assert.equal(own[0].pairedCost, 120);
const unknown = brands.find(r => r.brand === '其他竞品');
assert.equal(unknown.notes, 3);
assert.equal(unknown.interactions, null, 'absent metrics remain null');
assert.equal(brands.find(r => r.brand === '零值品牌').interactions, 0);
assert.equal(brands.find(r => r.brand === '部分指标').pairedReads, null, 'do not divide unpaired observations');
assert.equal(brands.find(r => r.brand === '部分指标').pairedCost, null);
assert.equal(brands.length, 17, 'all brands retained, not truncated to 12');
assert.equal(brands.reduce((s, r) => s + r.notes, 0), 26);
assert.equal(brands.reduce((s, r) => s + r.comments, 0), 260);
assert.equal(execute('竞品').some(r => r.brand === '启萃'), false);
// Demonstrate that the same fixture catches the original SQLite alias collision.
const broken = db.prepare(sql.replace('${where}', ' WHERE pn.project_id=?').replace('GROUP BY 1', 'GROUP BY brand')).all('test');
assert.ok(broken.filter(r => r.brand === '启萃').length > 1);
db.close();

const vite = await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
try {
  const m = await vite.ssrLoadModule('/features/growth/metrics.ts');
  for (const value of [null, undefined, '', '  ', NaN, Infinity, '12abc', '—']) assert.equal(m.numeric(value), null);
  assert.equal(m.numeric('1.2万'), 12000);
  assert.equal(m.numeric('1,200'), 1200);
  assert.equal(m.display(0), '0');
  assert.equal(m.display(null), '—');
  assert.equal(m.compactMetric(35087956), '3508.8万');
  assert.equal(m.compactMetric(null), '—');
  assert.equal(m.compactMetric(0), '0');
  assert.equal(m.ratio(0, 100), 0);
  assert.equal(m.ratio(null, 100), null);
  assert.equal(m.ratio(10, 0), null);
  assert.equal(m.change(null, 100), null);
  assert.equal(m.change(0, 100), -1);
  assert.equal(m.change(10, 0), null);
  for (let month = 2; month <= 12; month++) {
    assert.equal(m.previousMonth(String(month).padStart(2, '0') + '月'), String(month - 1).padStart(2, '0') + '月');
  }
  assert.equal(m.previousMonth('01月'), null, 'yearless January must not infer a previous year');
  assert.equal(m.previousMonth('2026-01'), '2025-12');
  assert.equal(m.previousMonth('2026-08'), '2026-07');
  for (const invalid of ['', '00月', '13月', '2026-00', '2026-13']) assert.equal(m.previousMonth(invalid), null);
  assert.equal(m.completeSum([0, null]), null);
  assert.equal(m.completeSum([]), null);
  assert.equal(m.completeSum([0, 0]), 0);
  const { GrowthSampleBoard } = await vite.ssrLoadModule('/features/growth/GrowthSampleBoard.tsx');
  const html = renderToStaticMarkup(React.createElement(GrowthSampleBoard, {notes:[{id:'zero',interactionCount:0},{id:'missing',interactionCount:null}],threshold:100}));
  assert.ok(html.includes('50.0%'), 'real zero counts as measured for coverage');
  assert.ok(!html.includes('NaN'));
  const { sampleDirection } = await vite.ssrLoadModule('/features/growth/directions.ts');
  assert.equal(sampleDirection({category1:'https://example.com/profile?id=123',category2:'喂养经验'}), '喂养经验');
  assert.equal(sampleDirection({category1:'一级',category2:'二级'}), '二级');
  assert.equal(sampleDirection({category1:'有效方向',category2:'http://example.com'}), '有效方向');
  for (const category1 of ['https://example.com', 'HTTP://example.com', ' ', '超'.repeat(41), 'k\uFFFDZt\uFFFD\uFFFDQ?']) assert.equal(sampleDirection({category1}), '分类待核对');
  assert.equal(sampleDirection({category1:'k\uFFFDZt',category2:'有效方向'}), '有效方向');
  assert.equal(sampleDirection({category1:'有效方向',category2:'k\uFFFDZt'}), '有效方向');
  const badDirections = renderToStaticMarkup(React.createElement(GrowthSampleBoard, {notes:[
    {id:'url',category1:'https://example.com/private-token',interactionCount:20},
    {id:'long',category1:'超'.repeat(80),interactionCount:0},
    {id:'blank',category1:' ',interactionCount:null},
    {id:'garbled',category1:'k\uFFFDZt\uFFFD\uFFFDQ?',interactionCount:20},
    {id:'good',category1:'https://example.com',category2:'喂养经验',interactionCount:200},
  ],threshold:100}));
  assert.ok(badDirections.includes('分类待核对：<strong>4</strong>'));
  assert.ok(!badDirections.includes('\uFFFD'), 'garbled classification does not reach the direction chart or table');
  assert.ok(!badDirections.includes('https://') && !badDirections.includes('超'.repeat(41)), 'invalid raw classification never reaches display');
  assert.ok(badDirections.includes('有效方向样本贡献') && badDirections.includes('100.0%'));
  assert.ok(badDirections.includes('overflow-wrap:anywhere') && badDirections.includes('overflow-x:auto'), 'long labels wrap inside a horizontally scrollable table');
  const { CompetitorAnalysis } = await vite.ssrLoadModule('/features/growth/CompetitorAnalysis.tsx');
  const monthHtml = competitor => renderToStaticMarkup(React.createElement(CompetitorAnalysis, {data:{analytics:{brands:[]},feishu:{search:[],competitor}}}));
  const july = {month:'07月',brand:'月报测试品牌',sheetId:'same-source',value:100};
  const august = {...july,month:'08月',value:150};
  assert.ok(monthHtml([july,august]).includes('<td>50.0%</td>'), 'real NN月 rows calculate previous-month growth');
  for (const records of [
    [august],
    [july,july,august],
    [july,august,august],
    [{...july,sheetId:'other-source'},august],
    [{...july,brand:'other-brand'},august],
    [{...july,value:0},august],
    [{...july,value:null},august],
    [{...july,month:'2025-12'},{...august,month:'01月'}],
  ]) assert.ok(!monthHtml(records).includes('<td>50.0%</td>'), 'missing, duplicate, unmatched or unusable baselines cannot produce growth');
  const empty = renderToStaticMarkup(React.createElement(CompetitorAnalysis, {data:{analytics:{brands:[]},feishu:{search:[],competitor:[]}}}));
  assert.ok(empty.includes('暂无品牌样本'));
  assert.ok(!empty.includes('双端搜索聚合'));
  const rendered = renderToStaticMarkup(React.createElement(CompetitorAnalysis, {data:{analytics:{brands},feishu:{search:[{date:'2026-09-02',lingxi:null,spotlight:0},{date:'2026-09-01',lingxi:100,spotlight:100}],competitor:[]}}}));
  assert.ok(rendered.includes('-100.0%'));
  assert.ok(!rendered.includes('NaN'));
  assert.equal((rendered.match(/data-brand="启萃"/g) || []).length, 1, 'SQL-normalized own brand renders exactly one card');
  assert.equal((rendered.match(/<td><strong>启萃<\/strong><\/td>/g) || []).length, 1, 'same normalized brand renders exactly one detail row');
  assert.ok(rendered.indexOf('品牌竞争格局') < rendered.indexOf('品牌样本份额与内容效率'), 'cards and charts precede the detail table');
  const { BrandLandscape } = await vite.ssrLoadModule('/features/growth/BrandLandscape.tsx');
  const singleBrand = renderToStaticMarkup(React.createElement(BrandLandscape, {brands:[{brand:'启萃',notes:10,interactions:35087956,interactionSamples:10,comments:0}]}));
  assert.ok(singleBrand.includes('100.0%'), 'single brand retains an explicit sample share');
  assert.ok(singleBrand.includes('3508.8万') && singleBrand.includes('35,087,956'), 'compact readout retains exact value in title');
  assert.ok(singleBrand.includes('笔记样本构成') && singleBrand.includes('已记录互动贡献'));
  const zeroBrand = renderToStaticMarkup(React.createElement(BrandLandscape, {brands:[{brand:'zero',notes:0,interactions:0},{brand:'missing',notes:0,interactions:null}]}));
  assert.ok(zeroBrand.includes('暂无可计算的互动贡献'));
  assert.ok(!zeroBrand.includes('<svg'), 'zero denominator produces no fabricated chart');
  assert.ok(zeroBrand.includes('未提供') && zeroBrand.includes('zero：0互动'));
  const { KeywordRadar, keywordMatches } = await vite.ssrLoadModule('/features/growth/KeywordRadar.tsx');
  assert.equal(keywordMatches({title:'启萃'}, '  '), false);
  assert.equal(keywordMatches({title:'启萃'}, ' 启萃 '), true);
  const growth = {watchKeywords:[],inspirations:[],seedNoteIds:[],thresholds:{breakoutInteractions:100,seedScore:60}};
  const props = {data:{notes:[]},growth,rules:{brands:[],competitors:[]},save:async()=>{},projectId:'test'};
  const radar = renderToStaticMarkup(React.createElement(KeywordRadar, props));
  assert.ok(radar.includes('尚未设置观察关键词'));
  assert.ok(radar.includes('暂无高热笔记'));
  const commercialRadar = renderToStaticMarkup(React.createElement(KeywordRadar, {...props,data:{notes:[{id:'commercial-note',title:'商业样本',sourceType:'commercial',category1:'k\uFFFDZt',interactionCount:200}]}}));
  assert.ok(commercialRadar.includes('<i>商业笔记</i>'), 'commercial source is localized on high-heat cards');
  assert.ok(!commercialRadar.includes('\uFFFD'), 'thumbnail and direction text also reject garbled classification');
  const { InspirationLibrary } = await vite.ssrLoadModule('/features/growth/InspirationLibrary.tsx');
  const inspiration = renderToStaticMarkup(React.createElement(InspirationLibrary, props));
  assert.ok(inspiration.includes('暂无高热样本'));
  assert.ok(!inspiration.includes('NaN'));
  const { CompetitorIntelligenceSection } = await vite.ssrLoadModule('/features/growth/CompetitorIntelligenceSection.tsx');
  const intelligence = renderToStaticMarkup(React.createElement(CompetitorIntelligenceSection, {intelligence:{
    updatedAt:'test',snapshotMonth:'2026-08',months:['2026-08'],
    brands:[{id:'zero',name:'零值品牌'},{id:'missing',name:'缺失品牌'}],
    performance:[],creatorMix:[],formatMix:[],tagNames:['喂养'],
    contentMix:[{brand:'zero',month:'2026-08',tag:'喂养',count:0}],productStrategies:[],actions:[],searchFlow:[],
  }}));
  assert.ok(intelligence.includes('<td>喂养</td><td>0</td><td>—</td><td>—</td>'), 'matrix keeps measured zero, missing, and incomplete total distinct');
  console.log('PASS growth: real SQLite normalization, totals, scope, >12 brands, paired metrics, missing/zero and component rendering');
} finally { await vite.close(); }
