import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 1. Load and transpile lib/industry-v2-analyzer.ts into isolated VM context
const source = fs.readFileSync(new URL('../lib/industry-v2-analyzer.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const mod = { exports: {} };
vm.runInNewContext(`(function(module, exports, require) {
  ${code}
})`)(mod, mod.exports, (name) => {
  throw new Error(`Unexpected require in pure analyzer test: ${name}`);
});

const {
  analyzeIndustryV2,
  detectProjectCategory,
  getFansTier,
  deduplicateNotes,
  getDatesInRange,
  getWeekday,
  noteShanghaiDate,
  PROJECT_DICTIONARIES,
  TITLE_PATTERNS,
} = mod.exports;

console.log('--- Starting Industry V2 Analyzer Comprehensive Test Suite ---');

// Base fixtures helper
function createBaseConfig(overrides = {}) {
  return {
    projectId: 'test-project',
    spu: '测试SPU',
    brand: '本品',
    scopeKey: 'brand:test',
    categoryKeyword: '行业类目',
    competitorKeywords: ['竞品A', '竞品B'],
    historyDays: 14,
    dailyEnabled: true,
    queries: [
      { id: 'q_own', kind: 'own', label: '本品词', keyword: '本品 测试SPU' },
      { id: 'q_category', kind: 'category', label: '品类词', keyword: '行业类目' },
      { id: 'q_comp', kind: 'competitor', label: '竞品词', keyword: '竞品A' },
    ],
    ...overrides,
  };
}

function createNote(id, overrides = {}) {
  return {
    noteId: id,
    title: `测试笔记标题 ${id}`,
    content: `测试笔记正文 ${id}`,
    url: `https://www.xiaohongshu.com/explore/${id}`,
    coverUrl: null,
    publishedAt: '2026-10-10T12:00:00Z',
    publishedDate: '2026-10-10',
    brand: '本品',
    creatorId: `creator_${id}`,
    creatorName: `博主_${id}`,
    fans: 15000,
    creatorRegion: '广东',
    creatorGender: '女',
    taxonomy1: null,
    taxonomy2: null,
    format: 'image',
    commercial: false,
    promoted: false,
    impressions: 1000,
    reads: 200,
    interactions: 50,
    likes: 40,
    comments: 5,
    collects: 5,
    quotedPrice: 2000,
    capturedAt: '2026-10-11T00:00:00Z',
    queryIds: ['q_own'],
    ...overrides,
  };
}

// -------------------------------------------------------------
// Test 1: 0 vs null & interactions source field (not likes)
// -------------------------------------------------------------
console.log('Running Test 1: 0 vs null behavior...');
{
  const config = createBaseConfig({
    queries: [{ id: 'q1', kind: 'own', label: '本品', keyword: '本品' }],
  });
  const dates = getDatesInRange('2026-10-01', '2026-10-03'); // 3 days

  // Day 1: complete, 0 notes published
  // Day 2: failed coverage, 0 notes published
  // Day 3: partial coverage, 1 note published with interactions: 0
  const coverage = [
    { queryId: 'q1', date: '2026-10-01', status: 'complete', fetched: 0, reportedTotal: 0, pages: 1, error: null },
    { queryId: 'q1', date: '2026-10-02', status: 'failed', fetched: 0, reportedTotal: null, pages: 0, error: 'network error' },
    { queryId: 'q1', date: '2026-10-03', status: 'partial', fetched: 1, reportedTotal: 10, pages: 1, error: null },
  ];

  const noteDay3 = createNote('n_day3', {
    publishedDate: '2026-10-03',
    interactions: 0, // Genuine 0 interactions
    likes: 9999, // Should NOT substitute interactions
    queryIds: ['q1'],
  });

  const report = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-03',
    notes: [noteDay3],
    coverage,
  });

  // Day 1: complete coverage, 0 records -> legal 0
  const trendD1 = report.trend.find(t => t.date === '2026-10-01');
  assert.ok(trendD1, 'Day 1 should exist in trend');
  assert.equal(trendD1.complete, true);
  assert.equal(trendD1.notes, 0, 'Complete day with 0 records must be 0, not null');
  assert.equal(trendD1.commercial, 0);
  assert.equal(trendD1.promoted, 0);
  assert.equal(trendD1.interactions, 0);

  // Day 2: incomplete coverage, 0 records -> must be null
  const trendD2 = report.trend.find(t => t.date === '2026-10-02');
  assert.ok(trendD2, 'Day 2 should exist in trend');
  assert.equal(trendD2.complete, false);
  assert.equal(trendD2.notes, null, 'Incomplete day without records must be null, not 0');
  assert.equal(trendD2.commercial, null);
  assert.equal(trendD2.promoted, null);
  assert.equal(trendD2.interactions, null);

  // Day 3: incomplete coverage, but has 1 note -> notes = 1, complete = false
  const trendD3 = report.trend.find(t => t.date === '2026-10-03');
  assert.ok(trendD3, 'Day 3 should exist in trend');
  assert.equal(trendD3.complete, false);
  assert.equal(trendD3.notes, 1);
  assert.equal(trendD3.interactions, 0, 'Genuine 0 interactions preserved');

  // Note with interactions: null vs interactions: 0 in summary
  assert.equal(report.summary.interactions.known, 1);
  assert.equal(report.summary.interactions.value, 0, 'Interactions value is 0, not substituted by likes (9999)');

  // Check note with interactions === null
  const reportNullInteractions = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-01',
    notes: [createNote('n_null', { interactions: null, likes: 500, publishedDate: '2026-10-01' })],
    coverage: [{ queryId: 'q1', date: '2026-10-01', status: 'complete', fetched: 1, reportedTotal: 1, pages: 1, error: null }],
  });
  assert.equal(reportNullInteractions.summary.interactions.known, 0);
  assert.equal(reportNullInteractions.summary.interactions.value, null, 'When interactions is null, metric value is null even if likes exist');

  // Case 1e: Complete day with notes that have all unknown metrics (commercial, promoted, interactions are null)
  const noteAllUnknown1 = createNote('n_unk_1', { publishedDate: '2026-10-01', interactions: null, commercial: null, promoted: null, queryIds: ['q1'] });
  const noteAllUnknown2 = createNote('n_unk_2', { publishedDate: '2026-10-01', interactions: null, commercial: null, promoted: null, queryIds: ['q1'] });
  const reportCompleteAllUnknown = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-01',
    notes: [noteAllUnknown1, noteAllUnknown2],
    coverage: [{ queryId: 'q1', date: '2026-10-01', status: 'complete', fetched: 2, reportedTotal: 2, pages: 1, error: null }],
  });
  const trendAllUnknown = reportCompleteAllUnknown.trend[0];
  assert.equal(trendAllUnknown.complete, true);
  assert.equal(trendAllUnknown.notes, 2);
  assert.equal(trendAllUnknown.commercial, null, 'Complete day with all unknown commercial must be null, not 0');
  assert.equal(trendAllUnknown.promoted, null, 'Complete day with all unknown promoted must be null, not 0');
  assert.equal(trendAllUnknown.interactions, null, 'Complete day with all unknown interactions must be null, not 0');
}
console.log('✓ Test 1 Passed: 0 vs null behavior verified.');

// -------------------------------------------------------------
// Test 2: Coverage不足环比null & 14天完整环比计算
// -------------------------------------------------------------
console.log('Running Test 2: Coverage & WoW (环比近7vs前7) rules...');
{
  const config = createBaseConfig({
    queries: [{ id: 'q1', kind: 'own', label: '本品', keyword: '本品' }],
  });

  // Case 2a: Period < 14 days (e.g. 10 days) -> noteChange is null
  const dates10 = getDatesInRange('2026-10-01', '2026-10-10');
  const cov10 = dates10.map(d => ({
    queryId: 'q1', date: d, status: 'complete', fetched: 1, reportedTotal: 1, pages: 1, error: null,
  }));
  const notes10 = dates10.map((d, i) => createNote(`n10_${i}`, { publishedDate: d, queryIds: ['q1'] }));
  const report10 = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-10', notes: notes10, coverage: cov10 });
  assert.equal(report10.summary.noteChange, null, 'Period < 14 days must yield null noteChange');
  assert.match(report10.summary.changeReason, /不足 14 天/);

  // Case 2b: 14 days, but 1 day has status !== 'complete'
  const dates14 = getDatesInRange('2026-10-01', '2026-10-14');
  const cov14Incomplete = dates14.map((d, i) => ({
    queryId: 'q1',
    date: d,
    status: i === 4 ? 'failed' : 'complete',
    fetched: 1, reportedTotal: 1, pages: 1, error: i === 4 ? 'err' : null,
  }));
  const report14Incomplete = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-14', notes: [], coverage: cov14Incomplete });
  assert.equal(report14Incomplete.summary.noteChange, null, 'Incomplete 14 days coverage must yield null noteChange');
  assert.match(report14Incomplete.summary.changeReason, /未完整/);

  // Case 2c: 14 days, all complete! Prior 7 days: 10 notes, Recent 7 days: 15 notes.
  // 10-01 to 10-07: 10 notes. 10-08 to 10-14: 15 notes.
  const cov14Complete = dates14.map(d => ({
    queryId: 'q1', date: d, status: 'complete', fetched: 2, reportedTotal: 2, pages: 1, error: null,
  }));
  const notesPrior = Array.from({ length: 10 }, (_, i) => createNote(`np_${i}`, { publishedDate: '2026-10-03', queryIds: ['q1'] }));
  const notesRecent = Array.from({ length: 15 }, (_, i) => createNote(`nr_${i}`, { publishedDate: '2026-10-10', queryIds: ['q1'] }));
  const report14Complete = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-14',
    notes: [...notesPrior, ...notesRecent],
    coverage: cov14Complete,
  });
  assert.equal(report14Complete.summary.noteChange, 0.5, '(15 - 10) / 10 = 0.5 (+50%)');
  assert.match(report14Complete.summary.changeReason, /\+50\.0%/);

  // Case 2d: 14 days, all complete, prior 7 days has 0 notes, recent 7 days has 5 notes
  const report14PriorZero = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-14',
    notes: Array.from({ length: 5 }, (_, i) => createNote(`nr_${i}`, { publishedDate: '2026-10-10', queryIds: ['q1'] })),
    coverage: cov14Complete,
  });
  assert.equal(report14PriorZero.summary.noteChange, null, 'Prior 7 days with 0 notes must yield null change with reason');
  assert.match(report14PriorZero.summary.changeReason, /基数为零|0/);
}
console.log('✓ Test 2 Passed: Coverage & WoW rules verified.');

// -------------------------------------------------------------
// Test 3: Project-specific dictionaries across 4 distinct projects
// -------------------------------------------------------------
console.log('Running Test 3: Four distinct project dictionaries...');
{
  // Project 1: 鸡蛋 (huang-tiane / egg)
  // Expects: 食谱 / 早餐 / 健身 / 安全与营养; No medical efficacy claims
  const eggConfig = createBaseConfig({
    projectId: 'huang-tiane',
    spu: '可生食鸡蛋',
    brand: '黄天鹅',
    categoryKeyword: '鸡蛋',
  });
  assert.equal(detectProjectCategory(eggConfig), 'egg');
  const eggNotes = [
    createNote('egg_1', { title: '减脂期高蛋白早餐牛油果煎蛋食谱', content: '美味溏心蛋做法教程' }),
    createNote('egg_2', { title: '给宝宝做辅食！可生食无菌生食标准，安全与营养更放心', content: '高品质沙门氏菌检测严格' }),
    createNote('egg_3', { title: '晨起健身元气早餐，水波蛋吐司', content: '低脂控卡料理' }),
    createNote('egg_4', { title: '无匹配词日常随笔', content: '今天天气不错' }),
  ];
  const eggReport = analyzeIndustryV2({ config: eggConfig, from: '2026-10-01', to: '2026-10-05', notes: eggNotes, coverage: [] });
  const eggScenes = eggReport.content.scenes.map(s => s.label);
  const eggSelling = eggReport.content.sellingPoints.map(s => s.label);
  assert.ok(eggScenes.includes('食谱'), 'Egg scenes must include 食谱');
  assert.ok(eggScenes.includes('早餐'), 'Egg scenes must include 早餐');
  assert.ok(eggScenes.includes('健身'), 'Egg scenes must include 健身');
  assert.ok(eggScenes.includes('未识别场景'), 'Egg scenes must include 未识别场景');
  assert.ok(eggSelling.includes('安全与营养'), 'Egg selling points must include 安全与营养');
  assert.ok(eggSelling.includes('未识别卖点'), 'Egg selling points must include 未识别卖点');
  // Verify egg_4 is classified under unclassified
  const eggUnclassifiedScene = eggReport.content.scenes.find(s => s.label === '未识别场景');
  assert.ok(eggUnclassifiedScene.evidenceIds.includes('egg_4'));
  // Verify no medical claims
  for (const a of eggReport.actions) {
    assert.ok(!a.title.includes('治疗') && !a.finding.includes('降血压'), 'No medical claims allowed in actions');
  }

  // Project 2: 跑鞋 (kailas / running shoes)
  // Expects: 越野 / 赛事 / 训练 / 测评 / 穿搭
  const shoesConfig = createBaseConfig({
    projectId: 'kailas',
    spu: 'FUGA-EX3越野跑鞋',
    brand: '凯乐石',
    categoryKeyword: '越野跑鞋',
  });
  assert.equal(detectProjectCategory(shoesConfig), 'shoes');
  const shoesNotes = [
    createNote('sh_1', { title: '崇礼百公里越野赛跑山拉练，日常训练跑量拉满', content: '碎石山地实测' }),
    createNote('sh_2', { title: '山系机能城市户外穿搭OOTD分享', content: '复古造型搭配' }),
    createNote('sh_3', { title: 'V底防滑抓地深度实测测评！红黑榜优缺点上脚开箱', content: '缓震回弹中底表现' }),
  ];
  const shoesReport = analyzeIndustryV2({ config: shoesConfig, from: '2026-10-01', to: '2026-10-05', notes: shoesNotes, coverage: [] });
  const shoeScenes = shoesReport.content.scenes.map(s => s.label);
  const shoeSelling = shoesReport.content.sellingPoints.map(s => s.label);
  assert.ok(shoeScenes.includes('越野'), 'Shoes scenes must include 越野');
  assert.ok(shoeScenes.includes('赛事'), 'Shoes scenes must include 赛事');
  assert.ok(shoeScenes.includes('训练'), 'Shoes scenes must include 训练');
  assert.ok(shoeScenes.includes('穿搭'), 'Shoes scenes must include 穿搭');
  assert.ok(shoeSelling.includes('测评'), 'Shoes selling points must include 测评');

  // Project 3: 冰箱 (meiling / fridge)
  // Expects: 保鲜 / 嵌入 / 容量 / 装修 / 能耗
  const fridgeConfig = createBaseConfig({
    projectId: 'meiling',
    spu: '冻鲜生500',
    brand: '美菱',
    categoryKeyword: '冰箱',
  });
  assert.equal(detectProjectCategory(fridgeConfig), 'fridge');
  const fridgeNotes = [
    createNote('fr_1', { title: '小户型极简法式家装新房厨房装修橱柜定制', content: '极简齐平效果' }),
    createNote('fr_2', { title: '超薄零嵌平嵌设计，微缝底部散热', content: '90度直角开门' }),
    createNote('fr_3', { title: '500L大容量多门分区储鲜，肉类水润恒温冷冻保鲜', content: '囤货无压力' }),
    createNote('fr_4', { title: '一级能效双变频静音低能耗，省电又安静', content: '实测耗电情况' }),
  ];
  const fridgeReport = analyzeIndustryV2({ config: fridgeConfig, from: '2026-10-01', to: '2026-10-05', notes: fridgeNotes, coverage: [] });
  const fridgeScenes = fridgeReport.content.scenes.map(s => s.label);
  const fridgeSelling = fridgeReport.content.sellingPoints.map(s => s.label);
  assert.ok(fridgeScenes.includes('装修'), 'Fridge scenes must include 装修');
  assert.ok(fridgeSelling.includes('保鲜'), 'Fridge selling points must include 保鲜');
  assert.ok(fridgeSelling.includes('嵌入'), 'Fridge selling points must include 嵌入');
  assert.ok(fridgeSelling.includes('容量'), 'Fridge selling points must include 容量');
  assert.ok(fridgeSelling.includes('能耗'), 'Fridge selling points must include 能耗');

  // Project 4: 酒精湿巾 (winner-wipes / alcohol wipes)
  // Expects: 出行 / 家庭 / 办公 / 材质 / 消毒 / 便携
  const wipesConfig = createBaseConfig({
    projectId: 'winner-wipes',
    spu: '玉米酒精湿巾',
    brand: '稳健',
    categoryKeyword: '酒精湿巾',
  });
  assert.equal(detectProjectCategory(wipesConfig), 'wipes');
  const wipesNotes = [
    createNote('wp_1', { title: '出差旅行随身出行，飞机高铁随手包必备', content: '便携随身装' }),
    createNote('wp_2', { title: '居家家庭日常清洁，客厅桌面玩具擦拭', content: '干净卫生' }),
    createNote('wp_3', { title: '工位办公电脑键盘手机屏幕消杀', content: '办公室常备' }),
    createNote('wp_4', { title: '纯棉植物纤维加厚材质，柔韧不掉絮', content: '亲肤触感' }),
    createNote('wp_5', { title: '75度酒精杀菌消毒，灭菌防护速干', content: '安全卫生' }),
    createNote('wp_6', { title: '单片独立便携轻巧包装，方便携带', content: '小包随手带' }),
  ];
  const wipesReport = analyzeIndustryV2({ config: wipesConfig, from: '2026-10-01', to: '2026-10-05', notes: wipesNotes, coverage: [] });
  const wipeScenes = wipesReport.content.scenes.map(s => s.label);
  const wipeSelling = wipesReport.content.sellingPoints.map(s => s.label);
  assert.ok(wipeScenes.includes('出行'), 'Wipes scenes must include 出行');
  assert.ok(wipeScenes.includes('家庭'), 'Wipes scenes must include 家庭');
  assert.ok(wipeScenes.includes('办公'), 'Wipes scenes must include 办公');
  assert.ok(wipeSelling.includes('材质'), 'Wipes selling points must include 材质');
  assert.ok(wipeSelling.includes('消毒'), 'Wipes selling points must include 消毒');
  assert.ok(wipeSelling.includes('便携'), 'Wipes selling points must include 便携');
}
console.log('✓ Test 3 Passed: All four project dictionaries verified.');

// -------------------------------------------------------------
// Test 4: queryoverlap deduplication & comparison independent samples
// -------------------------------------------------------------
console.log('Running Test 4: query overlap deduplication...');
{
  const config = createBaseConfig();
  // Same noteId fetched from two queries: q_own and q_category
  const rawNote1 = createNote('shared_note_01', { queryIds: ['q_own'], impressions: 1000 });
  const rawNote2 = createNote('shared_note_01', { queryIds: ['q_category'], impressions: 1000 });
  const uniqueNote3 = createNote('unique_note_02', { queryIds: ['q_comp'], impressions: 2000 });

  const report = analyzeIndustryV2({
    config,
    from: '2026-10-01',
    to: '2026-10-05',
    notes: [rawNote1, rawNote2, uniqueNote3],
    coverage: [],
  });

  // Total deduplicated notes in summary must be 2 (not 3!)
  assert.equal(report.summary.notes, 2, 'Shared note must be deduplicated in summary');
  assert.equal(report.notes.length, 2);

  // Merged queryIds on the shared note
  const dedupedShared = report.notes.find(n => n.noteId === 'shared_note_01');
  assert.ok(dedupedShared.queryIds.includes('q_own'));
  assert.ok(dedupedShared.queryIds.includes('q_category'));

  // In comparison: each query retains its independent sample
  const compOwn = report.comparison.find(c => c.query.id === 'q_own');
  const compCat = report.comparison.find(c => c.query.id === 'q_category');
  const compComp = report.comparison.find(c => c.query.id === 'q_comp');

  assert.equal(compOwn.notes, 1, 'q_own has 1 note');
  assert.equal(compCat.notes, 1, 'q_category has 1 note');
  assert.equal(compComp.notes, 1, 'q_comp has 1 note');

  // Independent comparison sum (1 + 1 + 1 = 3) > summary notes (2) because overlap is not summed as total market!
  const sumComparisonNotes = compOwn.notes + compCat.notes + compComp.notes;
  assert.equal(sumComparisonNotes, 3);
  assert.ok(sumComparisonNotes > report.summary.notes, 'Comparison sum exceeds deduplicated summary notes as expected');
}
console.log('✓ Test 4 Passed: Query overlap deduplication verified.');

// -------------------------------------------------------------
// Test 5: 商业合作 != 投流推广 (3 independent states each)
// -------------------------------------------------------------
console.log('Running Test 5: Commercial vs Promoted three states...');
{
  const config = createBaseConfig();
  const notes = [
    createNote('n_comm_organic', { commercial: true, promoted: false }),
    createNote('n_nat_promoted', { commercial: false, promoted: true }),
    createNote('n_unknown', { commercial: null, promoted: null }),
    createNote('n_nat_organic', { commercial: false, promoted: false }),
  ];

  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });

  const commDist = report.traffic.commercialVsNatural;
  const promDist = report.traffic.promotedVsOrganic;

  assert.equal(commDist.find(d => d.label === '商业合作').count, 1);
  assert.equal(commDist.find(d => d.label === '自然内容').count, 2);
  assert.equal(commDist.find(d => d.label === '未知性质').count, 1);

  assert.equal(promDist.find(d => d.label === '投流推广').count, 1);
  assert.equal(promDist.find(d => d.label === '非投流/自然流量').count, 2);
  assert.equal(promDist.find(d => d.label === '未知投流').count, 1);

  // Rates: known = 3, value = 1/3 (0.3333)
  assert.equal(report.summary.commercialRate.known, 3);
  assert.equal(report.summary.commercialRate.value, 0.3333);
  assert.equal(report.summary.promotedRate.known, 3);
  assert.equal(report.summary.promotedRate.value, 0.3333);
}
console.log('✓ Test 5 Passed: Commercial != Promoted 3-state logic verified.');

// -------------------------------------------------------------
// Test 6: fans缺失 & 达人层级阈值一致性
// -------------------------------------------------------------
console.log('Running Test 6: Fans missing & consistent tier thresholds...');
{
  assert.equal(getFansTier(null), '未知粉丝数');
  assert.equal(getFansTier(undefined), '未知粉丝数');
  assert.equal(getFansTier(1200000), '超头部(>100万)');
  assert.equal(getFansTier(600000), '头部(50万-100万)');
  assert.equal(getFansTier(300000), '腰部(20万-50万)');
  assert.equal(getFansTier(50000), '精选(3万-20万)');
  assert.equal(getFansTier(10000), 'KOC(5000-3万)');
  assert.equal(getFansTier(2000), '素人(<5000)');

  const config = createBaseConfig();
  const notes = [
    createNote('n_nofans', { fans: null }),
    createNote('n_koc', { fans: 12000 }),
    createNote('n_super', { fans: 2000000 }),
  ];
  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });

  const tierUnknown = report.creators.tiers.find(t => t.label === '未知粉丝数');
  assert.ok(tierUnknown, 'Tier 未知粉丝数 must exist');
  assert.equal(tierUnknown.count, 1);
  assert.ok(tierUnknown.evidenceIds.includes('n_nofans'));
}
console.log('✓ Test 6 Passed: Fans missing tier handling verified.');

// -------------------------------------------------------------
// Test 7: creatorId去重不用同名合并 & unknown creator独立统计
// -------------------------------------------------------------
console.log('Running Test 7: Creator deduplication & unknown creators...');
{
  const config = createBaseConfig();
  const notes = [
    createNote('n_c1', { creatorId: 'id_001', creatorName: '同名博主', interactions: 100 }),
    createNote('n_c2', { creatorId: 'id_002', creatorName: '同名博主', interactions: 200 }),
    createNote('n_c1_repeat', { creatorId: 'id_001', creatorName: '同名博主', interactions: 300 }),
    createNote('n_unknown_1', { creatorId: null, creatorName: null }),
    createNote('n_unknown_2', { creatorId: 'unknown', creatorName: '未识别达人' }),
  ];

  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });

  // id_001 and id_002 are 2 distinct known creators, even though they share the same name
  assert.equal(report.creators.top.length, 2);
  assert.ok(report.creators.top.some(c => c.id === 'id_001'));
  assert.ok(report.creators.top.some(c => c.id === 'id_002'));

  // Repeat creators: id_001 has 2 notes -> repeatCreators = 1
  assert.equal(report.creators.repeatCreators, 1);

  // Unknown creators: n_unknown_1 and n_unknown_2 -> unknownCreators = 2 notes missing ID
  assert.equal(report.creators.unknownCreators, 2, 'unknownCreators tracks notes with missing ID');

  // Summary creators: ONLY unique known creator IDs (2), does not treat missing ID notes as independent creators
  assert.equal(report.summary.creators, 2, 'Summary creators must strictly count known creator IDs');
  assert.equal(report.comparison[0].creators, 2, 'Comparison creators must strictly count known creator IDs');
}
console.log('✓ Test 7 Passed: Creator ID deduplication verified.');

// -------------------------------------------------------------
// Test 8: 报价不能sum为实际消耗 & ROI不做
// -------------------------------------------------------------
console.log('Running Test 8: Quotation without sum / ROI...');
{
  const config = createBaseConfig();
  const notes = [
    createNote('n_price1', { creatorId: 'c1', quotedPrice: 5000 }),
    createNote('n_price2', { creatorId: 'c2', quotedPrice: 8000 }),
  ];
  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });

  // Check that summary does not contain a fake spend sum or ROI
  assert.equal(report.summary.spend, undefined);
  assert.equal(report.summary.roi, undefined);

  // Verify limitation note states this explicitly
  assert.ok(report.limitations.some(l => l.includes('达人报价为公开采买参考价，不能直接累加为实际结算消耗，报告未计算 ROI')));
}
console.log('✓ Test 8 Passed: Quoted price and ROI boundary verified.');

// -------------------------------------------------------------
// Test 9: 行动建议2-4条，真实统计依据 + evidenceIds可点击，数据缺少时给出采集改善建议
// -------------------------------------------------------------
console.log('Running Test 9: Actionable recommendations (2-4 items, evidenceIds, empty fallback)...');
{
  const config = createBaseConfig();

  // Case 9a: Empty notes -> exactly 2 actions for collection improvements
  const reportEmpty = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: [], coverage: [] });
  assert.ok(reportEmpty.actions.length >= 2 && reportEmpty.actions.length <= 4, 'Actions count must be 2-4');
  assert.ok(reportEmpty.actions.some(a => a.id.includes('collection') || a.id.includes('improve')));
  for (const a of reportEmpty.actions) {
    assert.ok(['high', 'medium'].includes(a.priority));
    assert.ok(a.basis.length > 0);
  }

  // Case 9b: Real notes -> actions with real evidenceIds and basis
  const sampleNotes = [
    createNote('n_act_1', { title: '超棒的高蛋白早餐煎蛋食谱教程', format: 'video', interactions: 500, commercial: true }),
    createNote('n_act_2', { title: '高蛋白健身水煮蛋食谱', format: 'video', interactions: 800, commercial: true }),
    createNote('n_act_3', { title: '早餐随手拍图文', format: 'image', interactions: 30, commercial: false }),
    createNote('n_act_4', { title: '早餐随手拍图文2', format: 'image', interactions: 40, commercial: false }),
    createNote('n_act_5', { title: '早餐随手拍图文3', format: 'image', interactions: 50, commercial: false }),
    createNote('n_act_6', { title: '早餐随手拍图文4', format: 'image', interactions: 60, commercial: false }),
  ];
  const dates = getDatesInRange('2026-10-01', '2026-10-05');
  const coverage = dates.flatMap(d => config.queries.map(q => ({
    queryId: q.id, date: d, status: 'complete', fetched: 2, reportedTotal: 2, pages: 1, error: null,
  })));

  const reportWithNotes = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: sampleNotes, coverage });
  assert.ok(reportWithNotes.actions.length >= 2 && reportWithNotes.actions.length <= 4, 'Actions count must be 2-4');
  for (const a of reportWithNotes.actions) {
    assert.ok(['high', 'medium'].includes(a.priority));
    assert.ok(a.evidenceIds.length > 0, 'Real notes must provide non-empty evidenceIds');
    for (const eid of a.evidenceIds) {
      assert.ok(sampleNotes.some(n => n.noteId === eid), `EvidenceId ${eid} must point to a real note`);
    }
    assert.ok(a.basis.includes('篇'), 'Basis must reference real note counts');
    const fullText = `${a.title} ${a.finding} ${a.suggestion} ${a.basis}`;
    assert.ok(!fullText.includes('用户停留'), 'Must not claim user dwell time');
    assert.ok(!fullText.includes('信息效率'), 'Must not claim information efficiency');
    assert.ok(!fullText.includes('口碑基础良好'), 'Must not claim reputation good from low commercial rate');
    assert.ok(!fullText.includes('预算倾斜'), 'Must not make premature budget shift assertions');
  }
}
console.log('✓ Test 9 Passed: Actionable recommendations verified.');

// -------------------------------------------------------------
// Test 10: Title Patterns 规则匹配与未识别单列
// -------------------------------------------------------------
console.log('Running Test 10: Title patterns rule matching...');
{
  const config = createBaseConfig();
  const notes = [
    createNote('tp_1', { title: '新手保姆级抄作业攻略教程：怎么选避坑干货' }),
    createNote('tp_2', { title: '2026红黑榜盘点，好物推荐清单合集' }),
    createNote('tp_3', { title: '开箱上脚测评实测，真实反馈体验' }),
    createNote('tp_4', { title: '为什么大家都在焦虑？真的踩雷后悔了吗？' }),
    createNote('tp_5', { title: '沉浸式独居日常，治愈生活记录' }),
    createNote('tp_6', { title: '完全不含任何特征词的测试文本' }),
  ];
  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });
  const patterns = report.content.titlePatterns;

  const unclassified = patterns.find(p => p.label === '未识别句式');
  assert.ok(unclassified, '未识别句式 must be listed as standalone entry');
  assert.ok(unclassified.evidenceIds.includes('tp_6'), 'tp_6 must fall into 未识别句式');

  for (const p of patterns) {
    if (p.label !== '未识别句式') {
      assert.ok(p.label.includes('规则匹配'), 'Pattern label must indicate rule matching');
    }
  }
}
console.log('✓ Test 10 Passed: Title patterns rule matching verified.');

// -------------------------------------------------------------
// Test 11: Notes上限 10000 截断保护
// -------------------------------------------------------------
console.log('Running Test 11: Notes capping at 10000...');
{
  const config = createBaseConfig();
  const largeNotes = Array.from({ length: 10020 }, (_, i) => createNote(`big_n_${i}`));
  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: largeNotes, coverage: [] });
  assert.equal(report.notes.length, 10000, 'Notes list must be capped at 10000');
}
console.log('✓ Test 11 Passed: Notes capping at 10000 verified.');

// -------------------------------------------------------------
// Test 12: traffic.interactionRate 固定以 reads 为分母，严禁 fallback 到 impressions
// -------------------------------------------------------------
console.log('Running Test 12: traffic.interactionRate strictly uses reads without impressions fallback...');
{
  const config = createBaseConfig();
  // Case 12a: notes have impressions and interactions, but reads is null
  const noteNoReads = createNote('n_no_reads', { impressions: 10000, interactions: 500, reads: null });
  const reportNoReads = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: [noteNoReads], coverage: [] });
  assert.equal(reportNoReads.traffic.interactionRate.known, 0, 'When reads is null, interactionRate known must be 0');
  assert.equal(reportNoReads.traffic.interactionRate.value, null, 'Must NOT fallback to interactions/impressions (500/10000 = 0.05)!');

  // Case 12b: notes have reads = 0
  const noteZeroReads = createNote('n_zero_reads', { impressions: 1000, interactions: 50, reads: 0 });
  const reportZeroReads = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: [noteZeroReads], coverage: [] });
  assert.equal(reportZeroReads.traffic.interactionRate.known, 0);
  assert.equal(reportZeroReads.traffic.interactionRate.value, null);

  // Case 12c: paired valid reads and interactions
  const noteValid = createNote('n_valid_rate', { impressions: 1000, interactions: 45, reads: 300 });
  const reportValid = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: [noteValid], coverage: [] });
  assert.equal(reportValid.traffic.interactionRate.known, 1);
  assert.equal(reportValid.traffic.interactionRate.value, 0.15, '45 / 300 = 0.1500');
}
console.log('✓ Test 12 Passed: Fixed reads denominator for interactionRate verified.');

// -------------------------------------------------------------
// Test 13: 去重取同一个最新观测完整指标，不混合不同快照
// -------------------------------------------------------------
console.log('Running Test 13: deduplicateNotes picks complete latest snapshot without mixing...');
{
  const olderSnapshot = createNote('n_shared_target', {
    capturedAt: '2026-10-10T08:00:00Z',
    reads: 100,
    interactions: 10,
    impressions: 500,
    fans: 8888,
    queryIds: ['q_own'],
  });
  const newerSnapshot = createNote('n_shared_target', {
    capturedAt: '2026-10-10T16:00:00Z',
    reads: 350,
    interactions: 42,
    impressions: null, // In newer observation, impressions is null; MUST NOT be filled with older 500
    fans: 9999,
    queryIds: ['q_category'],
  });

  const deduped = deduplicateNotes([olderSnapshot, newerSnapshot]);
  assert.equal(deduped.length, 1);
  const note = deduped[0];
  assert.equal(note.capturedAt, '2026-10-10T16:00:00Z');
  assert.equal(note.reads, 350);
  assert.equal(note.interactions, 42);
  assert.equal(note.impressions, null, 'Must take newer snapshot metrics intact without filling null from older snapshot');
  assert.equal(note.fans, 9999);
  assert.ok(note.queryIds.includes('q_own'));
  assert.ok(note.queryIds.includes('q_category'));
}
console.log('✓ Test 13 Passed: Authoritative latest snapshot deduplication verified.');

// -------------------------------------------------------------
// Test 14: limitations说明（累计互动、分页cap、非受众画像）与 action规则采样说明
// -------------------------------------------------------------
console.log('Running Test 14: Limitations cumulative interaction, cap caveats & audience distinction...');
{
  const config = createBaseConfig();
  const notes = [
    createNote('n_lim_1', { fans: 25000, interactions: 200 }),
    createNote('n_lim_2', { fans: 25000, interactions: 300 }),
    createNote('n_lim_3', { fans: 25000, interactions: 400 }),
    createNote('n_lim_4', { fans: 25000, interactions: 500 }),
    createNote('n_lim_5', { fans: 25000, interactions: 600 }),
  ];
  const report = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes, coverage: [] });

  // Verify limitations wording
  assert.ok(report.limitations.some(l => l.includes('抓取时刻的累计总互动') && l.includes('而非该日期当天产生的新增互动增量')));
  assert.ok(report.limitations.some(l => l.includes('maxPages cap') || l.includes('分页上限')));
  assert.ok(report.limitations.some(l => l.includes('固定以阅读数（reads）为分母')));
  assert.ok(report.limitations.some(l => l.includes('非受众人口属性或粉丝画像')));

  // Verify actions explicit sample scope and creator tier vs persona disclaimer
  const tierAction = report.actions.find(a => a.id === 'act-creator-tier-pacing');
  if (tierAction) {
    assert.ok(tierAction.finding.includes('非受众画像') || tierAction.finding.includes('样本'));
    assert.ok(tierAction.basis.includes('非受众画像') || tierAction.basis.includes('采样范围'));
  }
}
console.log('✓ Test 14 Passed: Limitations and actions disclaimers verified.');

// -------------------------------------------------------------
// Test 15: expectedCoverage queries 为 0 时不应乘 max 1
// -------------------------------------------------------------
console.log('Running Test 15: expectedCoverage with empty queries...');
{
  const config = createBaseConfig({ queries: [] });
  const reportEmptyQueries = analyzeIndustryV2({ config, from: '2026-10-01', to: '2026-10-05', notes: [], coverage: [] });
  assert.equal(reportEmptyQueries.coverage.expected, 0, 'When queries is empty and coverage is empty, expected must be 0, not 5*1');
}
console.log('✓ Test 15 Passed: expectedCoverage with empty queries verified.');

console.log('Running Test 16: Shanghai date helper & category precise match...');
{
  const noteLateUTC = { publishedDate: null, publishedAt: '2026-10-10T18:30:00Z' };
  assert.equal(noteShanghaiDate(noteLateUTC), '2026-10-11', '18:30 UTC must roll over to next day 02:30 in Shanghai (+08:00)');

  const noteWithDate = { publishedDate: '2026-10-10', publishedAt: '2026-10-10T18:30:00Z' };
  assert.equal(noteShanghaiDate(noteWithDate), '2026-10-10', 'Explicit publishedDate takes precedence');

  const cakeConfig = createBaseConfig({ projectId: 'dessert-proj', spu: '提拉米苏蛋糕', brand: '好利来', categoryKeyword: '烘焙甜点' });
  assert.equal(detectProjectCategory(cakeConfig), 'general', '蛋糕 must not falsely trigger egg dictionary');

  const leatherShoesConfig = createBaseConfig({ projectId: 'shoe-proj', spu: '商务男士皮鞋', brand: '奥康', categoryKeyword: '皮鞋正装' });
  assert.equal(detectProjectCategory(leatherShoesConfig), 'general', '皮鞋 must not falsely trigger running shoes dictionary');

  assert.equal(detectProjectCategory(createBaseConfig({ projectId: 'huang-tiane' })), 'egg');
  assert.equal(detectProjectCategory(createBaseConfig({ projectId: 'kailas' })), 'shoes');
  assert.equal(detectProjectCategory(createBaseConfig({ projectId: 'meiling' })), 'fridge');
  assert.equal(detectProjectCategory(createBaseConfig({ projectId: 'winner-wipes' })), 'wipes');
}
console.log('✓ Test 16 Passed: Shanghai date helper & category precise match verified.');

console.log('\n======================================================');
console.log('ALL 16 TEST SUITES PASSED STRICTLY AND COMPLETELY!');
console.log('======================================================');
