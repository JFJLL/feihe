import assert from 'node:assert';
function matchSources(content, sources) {
  if (!sources || sources.length === 0) return null;
  const lower = content.toLowerCase();
  const keyMatches = sources.filter(s => {
    const k = s.key?.trim().toLowerCase();
    return Boolean(k && lower.includes(k));
  });
  let matched = [];
  if (keyMatches.length > 0) {
    const seenKeys = new Set();
    matched = keyMatches.filter(s => {
      if (seenKeys.has(s.key)) return false;
      seenKeys.add(s.key);
      return true;
    });
  } else {
    const nameMatches = sources.filter(s => {
      const n = s.name?.trim();
      return Boolean(n && n !== s.key && content.includes(n));
    });
    if (nameMatches.length > 0) {
      const seenNames = new Set();
      matched = nameMatches.filter(s => {
        if (seenNames.has(s.name)) return false;
        seenNames.add(s.name);
        return true;
      });
    } else {
      const seenUrls = new Set();
      matched = sources.filter(s => {
        if (s.url && content.includes(s.url) && !seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          return true;
        }
        return false;
      });
    }
  }
  return matched.length > 0 ? matched : null;
}
const mockSources = [
  { key: 'weekly-q3', name: '启萃周趋势底表 (Q3)', url: 'https://yimeichuanbo.feishu.cn/wiki/SVwkw52kZiSlLEkQuaNcHvrynGg', records: 100 },
  { key: 'weekly-q4', name: '启萃周趋势底表 (Q4)', url: 'https://yimeichuanbo.feishu.cn/wiki/SVwkw52kZiSlLEkQuaNcHvrynGg', records: 150 },
  { key: 'budget_plan-2026-10-13', name: '预算规划', url: 'https://yimeichuanbo.feishu.cn/wiki/DuDUwwmkXiMv1Gk47qxcUcTY', records: 50 }
];
const reply1 = '根据 weekly-q4 记录，2026-10-13 广告投放消耗为 275,326.74 元 (row 19, col 50)。';
const res1 = matchSources(reply1, mockSources);
console.log('Test 1 res:', res1?.map(s => s.key));
assert.strictEqual(res1?.length, 1);
assert.strictEqual(res1[0].key, 'weekly-q4');
const reply2 = '根据 weekly-q3 数据，历史消耗记录为 123,456.00 元。';
const res2 = matchSources(reply2, mockSources);
console.log('Test 2 res:', res2?.map(s => s.key));
assert.strictEqual(res2?.length, 1);
assert.strictEqual(res2[0].key, 'weekly-q3');
const reply3 = '详情请查阅项目底表：https://yimeichuanbo.feishu.cn/wiki/SVwkw52kZiSlLEkQuaNcHvrynGg';
const res3 = matchSources(reply3, mockSources);
console.log('Test 3 res:', res3?.map(s => s.key));
assert.strictEqual(res3?.length, 1);
const reply4 = '未查询到相关业务指标，请核实日期。';
const res4 = matchSources(reply4, mockSources);
console.log('Test 4 res:', res4);
assert.strictEqual(res4, null);
console.log('ALL MATCHING UNIT TESTS PASSED!');