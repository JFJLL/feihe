import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';

Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/card-display-unit', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const config = await vite.ssrLoadModule('/lib/metrics/config.ts');
const { evaluateMetricRows } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const columns = [{ key: 'completion', name: '完成率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }, { key: 'amount', name: '金额', type: 'number' }];
const datasets = [{ id: 'display', columns }];
const rows = [{ completion: 0.005, amount: 10 }, { completion: 0.015, amount: 20 }];

test('auto percent configuration cannot stay bound to an ordinary amount field', () => {
  const errors = config.validateCardConfig({ datasetId: 'display', aggregation: 'avg', field: 'amount', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'auto' }, datasets);
  assert.ok(errors.some(e => e.includes('自动') && e.includes('百分')));
});
for (const aggregation of ['count', 'nonempty_count', 'distinct_count']) {
  test(`${aggregation}: percentage results are rejected by configuration validation`, () => {
    const errors = config.validateCardConfig({ datasetId: 'display', aggregation, field: aggregation === 'count' ? '' : 'completion', format: 'percent', unit: '%', percentScale: 'fraction' }, datasets);
    assert.ok(errors.some(e => e.includes('计数')));
  });
  test(`${aggregation}: engine must not format quantity2 as200percent`, () => {
    const metric = evaluateMetricRows({ aggregation, field: aggregation === 'count' ? '' : 'completion', format: 'percent', unit: '%', percentScale: 'fraction' }, rows);
    assert.equal(metric.value, null);
    assert.equal(metric.status, 'needs_configuration');
  });
}
const fresh = { datasetId: 'display', aggregation: 'avg', format: 'number', unit: '', displayOrigin: 'auto' };
const change = (card, action) => config.transitionCardConfig(card, action, columns);
test('automatic average field cycle inherits only applicable units without touching data', () => {
  const percent = change(fresh, { kind: 'field', field: 'completion' });
  assert.equal(evaluateMetricRows(percent, rows).formattedValue, '1.0%');
  const amount = change(percent, { kind: 'field', field: 'amount' });
  assert.equal(amount.format, 'number'); assert.equal(amount.unit, ''); assert.equal(amount.percentScale, undefined);
  assert.equal(evaluateMetricRows(amount, rows).formattedValue, '15');
  assert.equal(evaluateMetricRows(change(amount, { kind: 'field', field: 'completion' }), rows).formattedValue, '1.0%');
  assert.equal(percent.field, 'completion'); assert.equal(fresh.field, undefined);
  assert.deepEqual(rows, [{ completion: 0.005, amount: 10 }, { completion: 0.015, amount: 20 }]);
});
test('average and count aggregation cycles preserve the selected field and clear percentage semantics', () => {
  let card = change(fresh, { kind: 'field', field: 'completion' });
  const duplicateRows = [{ completion: 0.005 }, { completion: 0.005 }, { completion: 0.015 }, { completion: null }];
  for (const [aggregation, expected] of [['nonempty_count', '3'], ['distinct_count', '2'], ['avg', '0.8%'], ['nonempty_count', '3'], ['sum', '2.5%'], ['distinct_count', '2'], ['avg', '0.8%']]) {
    card = change(card, { kind: 'aggregation', aggregation });
    assert.equal(card.field, 'completion');
    assert.equal(evaluateMetricRows(card, duplicateRows).formattedValue, expected);
    assert.deepEqual(config.validateCardConfig(card, datasets), []);
    if (config.isCountAggregation(aggregation)) { assert.equal(card.unit, ''); assert.equal(card.percentScale, undefined); }
  }
});
test('manual compatible currency and compact preferences survive scalar field and aggregation changes', () => {
  const amount = change(fresh, { kind: 'field', field: 'amount' });
  const currency = change(amount, { kind: 'display', patch: { format: 'currency' } });
  const total = change(currency, { kind: 'aggregation', aggregation: 'sum' });
  assert.equal(total.format, 'currency'); assert.equal(total.unit, '元'); assert.equal(total.displayOrigin, 'manual');
  assert.equal(evaluateMetricRows(total, rows).formattedValue, '¥30.00');
  const compact = change(total, { kind: 'display', patch: { format: 'compact' } });
  const count = change(compact, { kind: 'aggregation', aggregation: 'nonempty_count' });
  assert.equal(count.format, 'compact'); assert.equal(count.unit, ''); assert.equal(count.displayOrigin, 'manual');
  assert.equal(evaluateMetricRows(count, rows).formattedValue, '2');
  assert.equal(change(compact, { kind: 'field', field: 'completion' }).format, 'compact');
});
test('manual percentage on a different unknown-unit field requires confirmation', () => {
  let card = change(fresh, { kind: 'field', field: 'completion' });
  card = change(card, { kind: 'display', patch: { format: 'percent' } });
  const moved = change(card, { kind: 'field', field: 'amount' });
  assert.equal(moved.displayNeedsConfirmation, true);
  assert.ok(config.validateCardConfig(moved, datasets).some(e => e.includes('确认')));
  assert.equal(evaluateMetricRows(moved, rows).value, null);
  const fixed = change(moved, { kind: 'display', patch: { format: 'number' } });
  assert.equal(fixed.displayNeedsConfirmation, false); assert.equal(fixed.percentScale, undefined);
  assert.equal(evaluateMetricRows(fixed, rows).formattedValue, '15');
});
test('legacy percent preferences remain explicit and known source scale mismatches are blocked', () => {
  const legacy = { datasetId: 'display', aggregation: 'avg', field: 'completion', format: 'percent', unit: '%', percentScale: 'fraction' };
  const moved = change(legacy, { kind: 'field', field: 'amount' });
  assert.equal(moved.displayOrigin, 'manual'); assert.equal(moved.format, 'percent'); assert.equal(moved.displayNeedsConfirmation, true);
  assert.ok(config.validateCardConfig({ ...legacy, percentScale: 'percentage_points' }, datasets).some(e => e.includes('存储口径')));
  assert.ok(config.validateCardConfig({ ...legacy, percentScale: undefined }, datasets).some(e => e.includes('确认百分比')));
});
test('dataset switch and incompatible currency count conversions clear source-bound units', () => {
  const percent = change(fresh, { kind: 'field', field: 'completion' });
  const moved = change(percent, { kind: 'dataset', datasetId: 'other' });
  assert.equal(moved.aggregation, 'count'); assert.equal(moved.field, ''); assert.equal(moved.format, 'number'); assert.equal(moved.percentScale, undefined);
  const currency = change(change(fresh, { kind: 'field', field: 'amount' }), { kind: 'display', patch: { format: 'currency' } });
  const count = change(currency, { kind: 'aggregation', aggregation: 'nonempty_count' });
  assert.equal(count.format, 'number'); assert.equal(count.unit, '');
  assert.ok(config.resultDisplayErrors({ aggregation: 'count', format: 'number', unit: '元' }).some(e => e.includes('计数')));
});
test('ratio transitions retain intrinsic percentage points, paired/independent coverage, and no field-derived scale', () => {
  const card = change(change(fresh, { kind: 'field', field: 'completion' }), { kind: 'aggregation', aggregation: 'ratio' });
  assert.equal(card.format, 'percent'); assert.equal(card.unit, '%'); assert.equal(card.percentScale, undefined);
  const metric = evaluateMetricRows({ ...card, numField: 'n', denField: 'd' }, [{ n: 1, d: 200 }]);
  assert.equal(metric.formattedValue, '0.5%');
  assert.equal(evaluateMetricRows({ ...card, ratioBasis: 'independent', numField: 'n', denField: 'd' }, [{ n: 10, d: null }, { n: null, d: 100 }, { n: 20, d: 100 }]).value, 15);
});
test('leaving a ratio clears intrinsic percentage units even on a legacy card without provenance', () => {
  const legacy = { datasetId: 'display', aggregation: 'ratio', numField: 'n', denField: 'd', format: 'percent', unit: '%', displayOrigin: 'manual', ratioBasis: 'independent' };
  const average = change(legacy, { kind: 'aggregation', aggregation: 'avg' });
  assert.equal(average.unit, ''); assert.equal(average.format, 'number'); assert.equal(average.percentScale, undefined); assert.equal(average.ratioBasis, undefined);
  assert.equal(evaluateMetricRows(change(average, { kind: 'field', field: 'amount' }), rows).formattedValue, '15');
});
test('legacy compatible compact preferences survive cleanup of an unused percentage scale', () => {
  const legacy = { datasetId: 'display', aggregation: 'avg', field: 'completion', format: 'compact', unit: '%', percentScale: 'fraction' };
  const count = change(legacy, { kind: 'aggregation', aggregation: 'nonempty_count' });
  assert.equal(count.format, 'compact'); assert.equal(count.unit, ''); assert.equal(count.percentScale, undefined); assert.equal(count.displayOrigin, 'manual');
  assert.equal(evaluateMetricRows(count, rows).formattedValue, '2');
  assert.deepEqual(config.validateCardConfig(count, datasets), []);
});
test('removing an explicitly entered percent unit also removes its inactive scale', () => {
  const count = { datasetId: 'display', aggregation: 'nonempty_count', field: 'completion', format: 'number', unit: '%', percentScale: 'fraction', displayOrigin: 'manual' };
  assert.ok(config.validateCardConfig(count, datasets).some(e => e.includes('计数')));
  const cleared = change(count, { kind: 'display', patch: { unit: '' } });
  assert.equal(cleared.percentScale, undefined); assert.deepEqual(config.validateCardConfig(cleared, datasets), []);
  assert.equal(evaluateMetricRows(cleared, rows).formattedValue, '2');
});
