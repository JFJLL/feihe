import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/focused-unit', server: { middlewareMode: true }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const { parseNumericValue } = await vite.ssrLoadModule('/lib/numeric-values.ts');
const { evaluateMetricRows, formatMetricValue } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const { transformMappedRows } = await vite.ssrLoadModule('/lib/field-mapping.ts');

test('percent: tagged source text has a canonical fractional value', () => {
  for (const [text, fraction] of [['0%', 0], ['0.5%', 0.005], ['1%', 0.01], ['1.1%', 0.011], ['100%', 1], ['150%', 1.5]]) assert.equal(parseNumericValue(text), fraction);
});
test('percent: explicit percentage-point formatting has no threshold amplification', () => {
  for (const [value, expected] of [[0, '0.0%'], [0.5, '0.5%'], [1, '1.0%'], [1.1, '1.1%'], [100, '100.0%'], [150, '150.0%']]) assert.equal(formatMetricValue(value, 'percent', '%', 'percentage_points'), expected);
});
test('percent: tagged text and native values normalize exactly once', () => {
  const rules = [{ sourceField: 'p', targetField: 'p', type: 'number', numericUnit: 'percent', sourcePercentScale: 'percentage_points' }];
  const mapped = transformMappedRows([{ p: '0.5%' }, { p: 0.5 }], rules);
  assert.deepEqual(mapped.errors, []);
  assert.deepEqual(mapped.rows, [{ p: 0.005 }, { p: 0.005 }]);
});
test('percent: ordinary average is 1.0 percent in whole and groups', () => {
  const m = evaluateMetricRows({ aggregation: 'avg', field: 'p', format: 'percent', percentScale: 'fraction', groupBy: 'g' }, [{ p: 0.005, g: 'A' }, { p: 0.015, g: 'A' }]);
  assert.equal(m.formattedValue, '1.0%');
  assert.equal(m.groups[0].formattedValue, '1.0%');
});
const ratio = { aggregation: 'ratio', numField: 'n', denField: 'd' };
const holes = [{ n: 10, d: null, g: 'A' }, { n: null, d: 100, g: 'A' }];
test('ratio: complementary missing values have zero paired samples and no default rate', () => {
  const m = evaluateMetricRows(ratio, holes);
  assert.equal(m.value, null);
  assert.equal(m.sampleSize, 0);
  assert.equal(m.pairedValidCount, 0);
  assert.equal(m.numeratorValidCount, 1);
  assert.equal(m.denominatorValidCount, 1);
});
test('ratio: adding a complete record yields paired20 and explicit independent15', () => {
  const rows = [...holes, { n: 20, d: 100, g: 'B' }];
  const paired = evaluateMetricRows({ ...ratio, groupBy: 'g' }, rows);
  assert.equal(paired.value, 20);
  assert.equal(paired.sampleSize, 1);
  assert.equal(paired.groups[0].value, null);
  const independent = evaluateMetricRows({ ...ratio, ratioBasis: 'independent' }, rows);
  assert.equal(independent.value, 15);
  assert.equal(independent.numeratorValidCount, 2);
  assert.equal(independent.denominatorValidCount, 2);
  assert.equal(independent.pairedValidCount, 1);
  assert.equal(independent.sampleSize, 1);
});
test('ratio: explicit zero fill keeps observed pairs separate from imputed calculation rows', () => {
  const m = evaluateMetricRows({ ...ratio, missingPolicy: 'zero' }, holes);
  assert.equal(m.value, 10);
  assert.equal(m.pairedValidCount, 0);
  assert.equal(m.calculationSampleSize, 2);
  assert.equal(m.sampleSize, 0);
});
test('ratio: intrinsic ratio points still display small, unit and over100 rates', () => {
  for (const [n, d, text] of [[1, 200, '0.5%'], [1, 100, '1.0%'], [150, 100, '150.0%']]) assert.equal(evaluateMetricRows(ratio, [{ n, d }]).formattedValue, text);
});
test('percent: historical units require confirmation and never mutate the stored row', () => {
  const rows = [{ p: 0.5 }, { p: 1 }];
  const card = { aggregation: 'avg', field: 'p', unit: '%' };
  assert.equal(evaluateMetricRows(card, rows).status, 'needs_configuration');
  assert.equal(evaluateMetricRows({ ...card, percentScale: 'percentage_points' }, rows).formattedValue, '0.8%');
  assert.equal(evaluateMetricRows({ ...card, percentScale: 'fraction' }, rows).formattedValue, '75.0%');
  assert.deepEqual(rows, [{ p: 0.5 }, { p: 1 }]);
  assert.match(transformMappedRows([{ p: '0.5%' }], [{ sourceField: 'p', targetField: 'p', type: 'number' }]).errors.join(''), /历史值不会自动改写/);
});
test('percent: source numeric fractions, points and tagged scientific text normalize once', () => {
  for (const [scale, input] of [['fraction', 0.011], ['percentage_points', 1.1], ['fraction', '1.1%'], ['percentage_points', '1.1%'], ['fraction', '1.1e0%']]) {
    const mapped = transformMappedRows([{ p: input }], [{ sourceField: 'p', targetField: 'p', type: 'number', numericUnit: 'percent', sourcePercentScale: scale }]);
    assert.deepEqual(mapped.errors, []); assert.equal(mapped.rows[0].p, 0.011);
  }
});
test('ratio: true zero, all-null, absent, invalid and zero-denominator keep paired statistics', () => {
  for (const [rows, status, pairs] of [[[{ n: 0, d: 100 }], 'zero', 1], [[{ n: null, d: null }], 'empty', 0], [[{ d: 100 }], 'missing_field', 0], [[{ n: 'bad', d: 100 }], 'invalid_value', 0], [[{ n: 1, d: 0 }], 'zero_division', 1]]) {
    const m = evaluateMetricRows({ ...ratio, groupBy: 'g' }, rows);
    assert.equal(m.status, status); assert.equal(m.pairedValidCount, pairs); assert.equal(m.sampleSize, pairs);
    assert.equal(m.groups[0].status, status); assert.equal(m.groups[0].pairedValidCount, pairs);
  }
});
test('ratio: independent groups retain separate coverage and skip is distinct from zero fill', () => {
  const independent = evaluateMetricRows({ ...ratio, ratioBasis: 'independent', groupBy: 'g' }, holes);
  assert.equal(independent.value, 10); assert.equal(independent.sampleSize, 0);
  assert.equal(independent.groups[0].value, 10); assert.equal(independent.groups[0].pairedValidCount, 0);
  assert.equal(independent.numeratorCoverage, 0.5); assert.equal(independent.denominatorCoverage, 0.5);
  assert.equal(evaluateMetricRows(ratio, [{ d: 100 }]).value, null);
  assert.equal(evaluateMetricRows({ ...ratio, missingPolicy: 'zero' }, [{ d: 100 }]).value, 0);
  assert.equal(evaluateMetricRows({ ...ratio, missingPolicy: 'zero' }, [{ n: 'bad', d: 100 }]).status, 'invalid_value');
});
