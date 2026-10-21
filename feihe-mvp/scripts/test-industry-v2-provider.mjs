import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 1. Load dependencies and transpile industry-brand.ts and industry-v2-provider.ts
const brandSource = fs.readFileSync(new URL('../lib/industry-brand.ts', import.meta.url), 'utf8');
const brandMod = { exports: {} };
vm.runInNewContext(
  `(function(module,exports){${ts.transpileModule(brandSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\n})`,
)(brandMod, brandMod.exports);

const providerSource = fs.readFileSync(new URL('../lib/industry-v2-provider.ts', import.meta.url), 'utf8');
const providerCode = ts.transpileModule(providerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const providerMod = { exports: {} };

const vmContext = Object.assign(Object.create(globalThis), {
  URL,
  Promise,
  console,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  Array,
  Object,
  Set,
  Map,
  Number,
  String,
  RegExp,
  Error,
});

vm.runInNewContext(
  `(function(module,exports,require){${providerCode}\n})`,
  vmContext,
)(providerMod, providerMod.exports, (name) => {
  if (name === './industry-brand') return brandMod.exports;
  if (name === './xhs') {
    return {
      searchIndustryNotesPage: async () => ({ total: 0, noteList: [] }),
    };
  }
  throw new Error(`Unexpected import in isolated test: ${name}`);
});

const {
  parseIndustryV2Note,
  fetchIndustryV2Query,
  parseShanghaiDate,
  parseCoverUrl,
  parseReportedTotal,
  isValidCalendarDate,
} = providerMod.exports;

assert.equal(typeof parseIndustryV2Note, 'function', 'parseIndustryV2Note must be exported');
assert.equal(typeof fetchIndustryV2Query, 'function', 'fetchIndustryV2Query must be exported');

console.log('--- Test Suite 1: Sanitizer & Date Utilities ---');
// Total parsing: '' or negative must be null, not 0
assert.equal(parseReportedTotal(''), null);
assert.equal(parseReportedTotal('  '), null);
assert.equal(parseReportedTotal(null), null);
assert.equal(parseReportedTotal(undefined), null);
assert.equal(parseReportedTotal('0'), 0);
assert.equal(parseReportedTotal(0), 0);
assert.equal(parseReportedTotal(100), 100);
assert.equal(parseReportedTotal('120'), 120);
assert.equal(parseReportedTotal(-5), null);

// Calendar date validation: reject invalid dates like 2026-02-31
assert.equal(isValidCalendarDate('2026-02-31'), false);
assert.equal(isValidCalendarDate('2026-04-31'), false);
assert.equal(isValidCalendarDate('2026-02-28'), true);
assert.equal(isValidCalendarDate('2026-10-21'), true);

// Shanghai timestamp ms & s verification
const parsedSec = parseShanghaiDate(1729468800); // 2024-10-21 00:00:00 UTC -> 08:00:00 Shanghai
assert.equal(parsedSec.publishedDate, '2024-10-21');
assert.match(parsedSec.publishedAt, /^2024-10-21T00:00:00/);

const parsedMs = parseShanghaiDate(1729468800000);
assert.equal(parsedMs.publishedDate, '2024-10-21');
assert.equal(parsedMs.publishedAt, parsedSec.publishedAt);

const parsedStr = parseShanghaiDate('2026-10-21 15:30:00');
assert.equal(parsedStr.publishedDate, '2026-10-21');
assert.equal(parsedStr.publishedAt, '2026-10-21T07:30:00.000Z');

// Invalid date in parseShanghaiDate must not loosely roll over
assert.equal(parseShanghaiDate('2026-02-31 10:00:00').publishedDate, null);

// Cover URL whitelist (https and xhscdn/xiaohongshu only)
assert.equal(parseCoverUrl('https://sns-img-qc.xhscdn.com/test.jpg'), 'https://sns-img-qc.xhscdn.com/test.jpg');
assert.equal(parseCoverUrl('https://ci.xiaohongshu.com/test.jpg'), 'https://ci.xiaohongshu.com/test.jpg');
assert.equal(parseCoverUrl('http://sns-img-qc.xhscdn.com/test.jpg'), null, 'http must be rejected');
assert.equal(parseCoverUrl('https://attacker.com/test.jpg'), null, 'non-xhs domains must be rejected');
assert.equal(parseCoverUrl('https://127.0.0.1/test.jpg'), null, 'private IPs must be rejected');

console.log('--- Test Suite 2: Pure Note Parser (Nested Protocol, Brand, Unknown Fields) ---');
const ownQuery = { id: 'q-own-1', kind: 'own', label: '凯乐石', keyword: '凯乐石' };
const competitorQuery = { id: 'q-comp-1', kind: 'competitor', label: '萨洛蒙', keyword: '萨洛蒙' };
const config = {
  projectId: 'p-test',
  brand: '凯乐石',
  spu: '凯乐石fuga',
  scopeKey: 'test-scope',
  categoryKeyword: '越野跑鞋',
  competitorKeywords: ['萨洛蒙'],
  historyDays: 7,
  dailyEnabled: true,
  queries: [ownQuery, competitorQuery],
};

// Real nested protocol object (ctmagic keyword_collector.py compatible)
const rawSolarNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a4b',
    title: '凯乐石FUGA 越野跑鞋测评',
    content: '真实上脚脚感超赞 #越野跑 #跑鞋推荐',
    imageUrl: 'https://sns-img-qc.xhscdn.com/test_cover.jpg',
    notePublishTime: '2026-10-21 14:00:00',
    taxonomy1: '运动户外',
    taxonomy2: '越野跑',
    noteType: 1, // 1 = image
    cooperNote: 1, // commercial
    isAdNote: 1, // promoted
    impNum: 50000,
    readNum: 12000,
    engageNum: 3500,
    favNum: 2100, // likes
    commentNum: 320,
    collectNum: 1080,
  },
  brandInfo: {
    brandName: '凯乐石FUGA',
  },
  userInfo: {
    userId: 'u_10086',
    nickName: '户外跑者小王',
    fansNum: 25000,
    location: '浙江 杭州',
    gender: '男',
    picturePrice: 1500,
    videoPrice: 2800,
  },
};

// Test 2.1: Full valid note parsing with brand normalization
const parsedOwn = parseIndustryV2Note(rawSolarNote, {
  query: ownQuery,
  config,
  targetDate: '2026-10-21',
  capturedAt: '2026-10-21T10:00:00.000Z',
});
assert(parsedOwn !== null, 'Note must parse successfully');
assert.equal(parsedOwn.noteId, '64a1b2c3d4e5f60718293a4b');
assert.equal(parsedOwn.title, '凯乐石FUGA 越野跑鞋测评');
assert.equal(parsedOwn.content, '真实上脚脚感超赞 #越野跑 #跑鞋推荐');
assert.equal(parsedOwn.url, 'https://www.xiaohongshu.com/explore/64a1b2c3d4e5f60718293a4b');
assert.equal(parsedOwn.coverUrl, 'https://sns-img-qc.xhscdn.com/test_cover.jpg');
assert.equal(parsedOwn.publishedDate, '2026-10-21');
assert.equal(parsedOwn.brand, '凯乐石', '凯乐石FUGA must normalize to 凯乐石 for own query');
assert.equal(parsedOwn.format, 'image');
assert.equal(parsedOwn.commercial, true);
assert.equal(parsedOwn.promoted, true);
assert.equal(parsedOwn.impressions, 50000);
assert.equal(parsedOwn.reads, 12000);
assert.equal(parsedOwn.interactions, 3500);
assert.equal(parsedOwn.likes, 2100);
assert.equal(parsedOwn.comments, 320);
assert.equal(parsedOwn.collects, 1080);
assert.equal(parsedOwn.creatorId, 'u_10086');
assert.equal(parsedOwn.creatorName, '户外跑者小王');
assert.equal(parsedOwn.fans, 25000);
assert.equal(parsedOwn.creatorRegion, '浙江 杭州');
assert.equal(parsedOwn.creatorGender, '男');
assert.equal(parsedOwn.taxonomy1, '运动户外');
assert.equal(parsedOwn.taxonomy2, '越野跑');
assert.equal(parsedOwn.quotedPrice, 1500, 'Image note should quote picturePrice');
assert.deepEqual([...parsedOwn.queryIds], ['q-own-1']);

// Test 2.2: Competitor query brand non-pollution & queryIds preservation
const rawCompNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a4c',
    title: '萨洛蒙大迫杰同款跑鞋',
    noteType: 2, // video
    notePublishTime: '2026-10-21 16:00:00',
  },
  brandInfo: {
    brandName: '萨洛蒙',
  },
  userInfo: {
    userId: 'u_20001',
    videoPrice: 4000,
  },
};
const parsedComp = parseIndustryV2Note(rawCompNote, competitorQuery, config, '2026-10-21');
assert.equal(parsedComp.brand, '萨洛蒙', 'Competitor brand must NOT be forced to our brand');
assert.equal(parsedComp.format, 'video');
assert.equal(parsedComp.quotedPrice, 4000, 'Video note should quote videoPrice');
assert.deepEqual([...parsedComp.queryIds], ['q-comp-1']);

// Test 2.3: Competitor query with empty/unknown raw brand
const rawCompEmptyBrand = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a4d',
    title: '越野鞋鞋评',
    notePublishTime: '2026-10-21 16:00:00',
  },
  brandInfo: {}, // no brand
};
const parsedCompEmpty = parseIndustryV2Note(rawCompEmptyBrand, competitorQuery, config, '2026-10-21');
assert.equal(parsedCompEmpty.brand, '未识别品牌', 'Empty raw brand must become 未识别品牌');
assert.deepEqual([...parsedCompEmpty.queryIds], ['q-comp-1'], 'Must retain queryIds for independent sample comparison');

// Test 2.4: Unknown values MUST be null, NEVER default to 0
const rawSparseNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a4e',
    title: '极简笔记测试',
    notePublishTime: '2026-10-21 12:00:00',
    impNum: null,
    readNum: undefined,
    engageNum: '',
    favNum: '--',
    commentNum: null,
    collectNum: undefined,
    cooperNote: null,
    isAdNote: null,
  },
  userInfo: {
    fansNum: null,
    picturePrice: null,
  },
};
const parsedSparse = parseIndustryV2Note(rawSparseNote, ownQuery, config, '2026-10-21');
assert.equal(parsedSparse.impressions, null, 'Unknown impNum must be null');
assert.equal(parsedSparse.reads, null, 'Unknown readNum must be null');
assert.equal(parsedSparse.interactions, null, 'Unknown engageNum must be null');
assert.equal(parsedSparse.likes, null, 'Unknown favNum must be null');
assert.equal(parsedSparse.comments, null, 'Unknown comments must be null');
assert.equal(parsedSparse.collects, null, 'Unknown collects must be null');
assert.equal(parsedSparse.fans, null, 'Unknown fans must be null');
assert.equal(parsedSparse.quotedPrice, null, 'Unknown quotedPrice must be null');
assert.equal(parsedSparse.commercial, null, 'Unknown commercial must be null');
assert.equal(parsedSparse.promoted, null, 'Unknown promoted must be null');
assert.equal(parsedSparse.taxonomy1, null);
assert.equal(parsedSparse.taxonomy2, null);
assert.equal(parsedSparse.creatorId, null);
assert.equal(parsedSparse.creatorName, null);
assert.equal(parsedSparse.creatorRegion, null);
assert.equal(parsedSparse.creatorGender, null);
assert.equal(parsedSparse.coverUrl, null);

// Test 2.5: Explicit 0 value must be preserved as 0, not converted to null
const rawZeroNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a4f',
    title: '零指标笔记',
    notePublishTime: '2026-10-21 12:00:00',
    favNum: 0,
    readNum: 0,
    cooperNote: 0,
    isAdNote: 0,
  },
  userInfo: {
    fansNum: 0,
  },
};
const parsedZero = parseIndustryV2Note(rawZeroNote, ownQuery, config, '2026-10-21');
assert.equal(parsedZero.likes, 0, 'Explicit 0 likes must be 0');
assert.equal(parsedZero.reads, 0, 'Explicit 0 reads must be 0');
assert.equal(parsedZero.fans, 0, 'Explicit 0 fans must be 0');
assert.equal(parsedZero.commercial, false, '0 cooperNote must be false');
assert.equal(parsedZero.promoted, false, '0 isAdNote must be false');

// Test 2.6: URL safety & 24 hex noteId validation
assert.equal(parseIndustryV2Note({ noteInfo: { noteId: '../../bad', title: 'bad' } }, ownQuery, config), null);
assert.equal(parseIndustryV2Note({ noteInfo: { noteId: 'short123', title: 'bad' } }, ownQuery, config), null);
assert.equal(parseIndustryV2Note({ noteInfo: { noteId: '1234567890abcdef1234567z', title: 'bad' } }, ownQuery, config), null);
assert.notEqual(parseIndustryV2Note({ noteInfo: { noteId: '1234567890abcdef12345678', title: 'good' } }, ownQuery, config), null);

// Test 2.7: Wrongday out-of-bounds date filtering
const wrongDayNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a50',
    title: '昨天发布的笔记',
    notePublishTime: '2026-10-20 23:59:59',
  },
};
assert.equal(
  parseIndustryV2Note(wrongDayNote, ownQuery, config, '2026-10-21'),
  null,
  'Wrong day note must be filtered out when targetDate is specified',
);

console.log('--- Test Suite 3: fetchIndustryV2Query Integration & Mock Scenarios ---');

// Test 3.1: Happy path single page
const happyMock = async (kw, date, pageNum, pageSize) => {
  assert.equal(pageNum, 1);
  assert.equal(kw, '凯乐石');
  assert.equal(date, '2026-10-21');
  return {
    total: 2,
    noteList: [rawSolarNote, rawZeroNote],
  };
};
const happyResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { maxPages: 3 }, happyMock);
assert.equal(happyResult.ok, true);
assert.equal(happyResult.pages, 1);
assert.equal(happyResult.reportedTotal, 2);
assert.equal(happyResult.truncated, false);
assert.equal(happyResult.notes.length, 2);
assert.equal(happyResult.error, null);

// Test 3.2: Deduplication across pages
const dedupMock = async (kw, date, pageNum) => {
  if (pageNum === 1) {
    return {
      total: 3,
      noteList: [rawSolarNote, rawZeroNote],
    };
  }
  if (pageNum === 2) {
    return {
      total: 3,
      noteList: [rawZeroNote, rawCompNote], // rawZeroNote repeated!
    };
  }
  return { total: 3, noteList: [] };
};
const dedupResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { maxPages: 3, pageSize: 2 }, dedupMock);
assert.equal(dedupResult.ok, true);
assert.equal(dedupResult.pages, 2);
assert.equal(dedupResult.reportedTotal, 3);
assert.equal(dedupResult.notes.length, 3, 'Duplicate notes must be deduplicated to 3 unique notes');

// Test 3.3: Missing total handling (never treat as 0 or infinite loop)
let missingTotalCalls = 0;
const missingTotalMock = async (kw, date, pageNum) => {
  missingTotalCalls++;
  if (pageNum === 1) {
    return {
      // total is omitted!
      noteList: [rawSolarNote],
    };
  }
  return { noteList: [] };
};
const missingTotalResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { maxPages: 3, pageSize: 1 }, missingTotalMock);
assert.equal(missingTotalResult.ok, true);
assert.equal(missingTotalResult.reportedTotal, null, 'Missing total must be null, NOT 0');
assert.equal(missingTotalCalls, 2, 'Must stop when empty array received, not loop infinitely');
assert.equal(missingTotalResult.notes.length, 1);

// Test 3.4: Upstream empty array (valid) vs structural error
const emptyArrayMock = async () => ({ total: 0, noteList: [] });
const emptyResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, emptyArrayMock);
assert.equal(emptyResult.ok, true);
assert.equal(emptyResult.notes.length, 0);
assert.equal(emptyResult.error, null);
assert.equal(emptyResult.pages, 1);

const malformedMock = async () => ({ total: 10, noteList: 'not-an-array' });
const malformedResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, malformedMock);
assert.equal(malformedResult.ok, false);
assert.match(malformedResult.error, /上游返回结构不兼容/);

// Test 3.5: Pagination truncation (bounded by maxPages)
const largeMock = async (kw, date, pageNum) => {
  return {
    total: 300,
    noteList: Array.from({ length: 60 }, (_, i) => ({
      noteInfo: {
        noteId: `64a1b2c3d4e5f6071829${String(pageNum * 100 + i).padStart(4, '0')}`,
        title: `Page ${pageNum} Item ${i}`,
        notePublishTime: '2026-10-21 10:00:00',
      },
    })),
  };
};
const truncResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { maxPages: 2 }, largeMock);
assert.equal(truncResult.ok, true);
assert.equal(truncResult.pages, 2, 'Must stop at maxPages (2)');
assert.equal(truncResult.reportedTotal, 300);
assert.equal(truncResult.notes.length, 120);
assert.equal(truncResult.truncated, true, 'Result must be marked truncated when reportedTotal > fetched');

// Test 3.6: Partial failure (HTTP 500 on page 2) retains page 1 notes with ok=false
let fail500Calls = 0;
const fail500Mock = async (kw, date, pageNum) => {
  fail500Calls++;
  if (pageNum === 1) {
    return {
      total: 50,
      noteList: [rawSolarNote, rawZeroNote],
    };
  }
  throw new Error('HTTP 500: Internal Server Error with token: super_secret_123');
};
const failResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { maxPages: 3, pageSize: 2 }, fail500Mock);
assert.equal(failResult.ok, false, 'Fetch must not report success on 500 error');
assert.equal(failResult.notes.length, 2, 'Page 1 notes must be retained');
assert.equal(failResult.pages, 1, 'Completed pages count must be preserved');
assert.equal(failResult.truncated, true);
assert.equal(failResult.error, '上游小红书/蒲公英接口请求异常，请检查服务端凭据或网络配置', 'Fixed error must be used on catch');
assert(!failResult.error.includes('super_secret_123'), 'Secrets must not be logged in error message');

// Test 3.7: Wrongday filtering inside fetchIndustryV2Query
const mixedDayMock = async () => ({
  total: 2,
  noteList: [rawSolarNote, wrongDayNote],
});
const mixedDayResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, mixedDayMock);
assert.equal(mixedDayResult.ok, true);
assert.equal(mixedDayResult.notes.length, 1, 'Wrong day note must be filtered out');
assert.equal(mixedDayResult.notes[0].noteId, rawSolarNote.noteInfo.noteId);
assert.match(mixedDayResult.error, /已过滤 1 篇异常\/越界样本/);

// Test 3.6b: Injected response with non-zero code must also fail with ok=false
const codeErrorMock = async () => ({
  code: -1,
  msg: 'upstream session invalid',
  data: { noteList: [rawSolarNote] },
});
const codeErrorResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, codeErrorMock);
assert.equal(codeErrorResult.ok, false, 'Non-zero response code must report ok=false');
assert.equal(codeErrorResult.truncated, true);
assert.equal(codeErrorResult.error, '上游小红书/蒲公英接口请求异常，请检查服务端凭据或网络配置');

// Test 3.8: All raw notes filtered out due to wrong day or bad IDs -> failure with ok=false
const allFilteredMock = async () => ({
  total: 5,
  noteList: [wrongDayNote, { noteInfo: { noteId: '../../bad', notePublishTime: '2026-10-21' } }],
});
const allFilteredResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, allFilteredMock);
assert.equal(allFilteredResult.ok, false, 'Must not report ok=true when all notes filtered out');
assert.equal(allFilteredResult.truncated, true);
assert.match(allFilteredResult.error, /全部（2 篇）因结构不符或发布日期越界被过滤（有效 0 篇）/);

// Test 3.9: Invalid calendar date 2026-02-31 rejected immediately
const badDateResult = await fetchIndustryV2Query(ownQuery, '2026-02-31', config, {});
assert.equal(badDateResult.ok, false);
assert.match(badDateResult.error, /无效采集日期/);

// Test 3.10: Short or empty page with reportedTotal > notes must be truncated=true
const shortPageMock = async () => ({
  total: 100,
  noteList: [rawSolarNote], // Only 1 returned despite total 100
});
const shortPageResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, { pageSize: 60 }, shortPageMock);
assert.equal(shortPageResult.ok, true);
assert.equal(shortPageResult.notes.length, 1);
assert.equal(shortPageResult.reportedTotal, 100);
assert.equal(shortPageResult.truncated, true, 'Short page with reportedTotal > fetched must be truncated');

// Test 3.11: Item missing publishedDate is retained as unknown but batch marked truncated
const missingDateNote = {
  noteInfo: {
    noteId: '64a1b2c3d4e5f60718293a77',
    title: '缺少日期笔记',
    notePublishTime: null,
  },
};
const missingDateMock = async () => ({
  total: 2,
  noteList: [rawSolarNote, missingDateNote],
});
const missingDateResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, missingDateMock);
assert.equal(missingDateResult.ok, true);
assert.equal(missingDateResult.notes.length, 2, 'Note with missing date retained');
assert.equal(missingDateResult.notes.find(n => n.noteId === '64a1b2c3d4e5f60718293a77').publishedDate, null);
assert.equal(missingDateResult.truncated, true, 'Batch with missing date notes must be marked truncated/partial');
assert.match(missingDateResult.error, /缺失发布日期/);

// Test 3.12: Mixed valid & out-of-bounds notes with no total (total: null) must be marked partial (truncated=true)
const mixedNoTotalMock = async () => ({
  total: null,
  noteList: [rawSolarNote, wrongDayNote],
});
const mixedNoTotalResult = await fetchIndustryV2Query(ownQuery, '2026-10-21', config, {}, mixedNoTotalMock);
assert.equal(mixedNoTotalResult.ok, true);
assert.equal(mixedNoTotalResult.notes.length, 1, 'Only valid note should be kept');
assert.equal(mixedNoTotalResult.reportedTotal, null);
assert.equal(mixedNoTotalResult.truncated, true, 'Filtered out-of-bounds notes with null total must be marked truncated/partial');
assert.match(mixedNoTotalResult.error, /已过滤 1 篇异常\/越界样本/);

console.log('\nAll Industry V2 Provider tests passed successfully!');
