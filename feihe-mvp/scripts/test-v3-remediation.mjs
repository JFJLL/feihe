import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/v3-unit', server: { middlewareMode: true }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const { evaluateCardMetric } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const { POST } = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const { applyFieldMapping } = await vite.ssrLoadModule('/lib/import-rows.ts');
const { evaluateMetricRows } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const { inferColumnType } = await vite.ssrLoadModule('/lib/column-types.ts');
const { transformMappedRows, mappingContextMatches } = await vite.ssrLoadModule('/lib/field-mapping.ts');
const { validateCardConfig } = await vite.ssrLoadModule('/lib/metrics/config.ts');
const dataset = await saveDataset('v3-test', 'tasks', '三条任务', [{ task: 'a' }, { task: 'b' }, { task: 'c' }]);

test('unit: custom + count + empty field counts three records', async () => {
  const result = await evaluateCardMetric('v3-test', { datasetId: dataset.id, metric: 'custom', aggregation: 'count', field: '' });
  assert.equal(result.value, 3);
});
test('API: count preview uses the real stored three records', async () => {
  const response = await POST(new Request('http://localhost/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'v3-test', action: 'evaluate', card: { datasetId: dataset.id, metric: 'custom', aggregation: 'count', field: '' } }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).metric.value, 3);
});

test('unit: explicit aggregation overrides old task_total binding', async () => {
  const ds = await saveDataset('v3-test', 'numeric', '金额', [{ amount: 10 }, { amount: 20 }]);
  assert.equal((await evaluateCardMetric('v3-test', { datasetId: ds.id, metric: 'task_total', aggregation: 'sum', field: 'amount' })).value, 30);
});
test('unit: global and grouped average share valid samples', async () => {
  const ds = await saveDataset('v3-test', 'avg', '平均', [{ amount: 10, group: 'A' }, { amount: null, group: 'A' }]);
  const m = await evaluateCardMetric('v3-test', { datasetId: ds.id, metric: 'custom', aggregation: 'avg', field: 'amount', groupBy: 'group' });
  assert.equal(m.value, 10);
  assert.equal(m.groups[0].value, 10);
  assert.equal(m.sampleSize, 1);
  assert.equal(m.groups[0].count, 1);
});
for (const [label, numerator] of [['absent', undefined], ['null', null], ['invalid', 'nonsense']]) {
  test(`unit: ${label} numerator must not become 0%`, async () => {
    const row = { denominator: 100 };
    if (numerator !== undefined) row.numerator = numerator;
    const ds = await saveDataset('v3-test', `ratio-${label}`, label, [row]);
    assert.equal((await evaluateCardMetric('v3-test', { datasetId: ds.id, aggregation: 'ratio', numField: 'numerator', denField: 'denominator' })).value, null);
  });
}

test('unit: record, nonempty and distinct counts are different operations', () => {
  const rows = [{ x: 'same' }, { x: 'same' }, { x: null }];
  assert.equal(evaluateMetricRows({ aggregation: 'count' }, rows).value, 3);
  assert.equal(evaluateMetricRows({ aggregation: 'nonempty_count', field: 'x' }, rows).value, 2);
  assert.equal(evaluateMetricRows({ aggregation: 'distinct_count', field: 'x' }, rows).value, 1);
  assert.equal(evaluateMetricRows({ aggregation: 'nonempty_count', field: 'x' }, [{ x: 0 }]).value, 1);
});
test('unit: missing, all-null, actual zero, invalid numeric and zero denominator stay distinct', () => {
  const card = { aggregation: 'ratio', numField: 'n', denField: 'd' };
  assert.equal(evaluateMetricRows(card, [{ d: 100 }]).status, 'missing_field');
  assert.equal(evaluateMetricRows(card, [{ n: null, d: 100 }]).status, 'empty');
  assert.equal(evaluateMetricRows(card, [{ n: 0, d: 100 }]).formattedValue, '0.0%');
  assert.equal(evaluateMetricRows(card, [{ n: 'NaN', d: 100 }]).status, 'invalid_value');
  assert.equal(evaluateMetricRows(card, [{ n: 1, d: 0 }]).status, 'zero_division');
  assert.equal(evaluateMetricRows({ ...card, missingPolicy: 'zero' }, [{ d: 100 }]).formattedValue, '0.0%');
  assert.equal(evaluateMetricRows(card, [{ n: 0.5, d: 100 }]).formattedValue, '0.5%');
});
test('unit: explicit zero fill applies identically to grouped and whole averages', () => {
  const metric = evaluateMetricRows({ aggregation: 'avg', field: 'x', groupBy: 'g', missingPolicy: 'zero' }, [{ x: 10, g: 'A' }, { x: null, g: 'A' }]);
  assert.equal(metric.value, 5);
  assert.equal(metric.groups[0].value, 5);
  assert.equal(metric.groups[0].count, 2);
});
test('unit: inference considers all observed values and never fills blanks', () => {
  assert.equal(inferColumnType(['12', 'not a number']), 'text');
  assert.equal(inferColumnType(['12', null, '13']), 'number');
  const result = transformMappedRows([{ x: '12' }, { x: '' }], [{ sourceField: 'x', targetField: 'x', type: 'number', nullPolicy: 'null' }]);
  assert.deepEqual(result.rows, [{ x: 12 }, { x: null }]);
});
test('unit: shared mapping preview matches stored values and preserved column metadata', async () => {
  const rows = [{ source: '100', flag: '是', retained: 'keep' }];
  const rules = [{ sourceField: 'source', targetField: ' amount ', type: 'number' }, { sourceField: 'flag', targetField: 'confirmed', type: 'boolean' }];
  const preview = transformMappedRows(rows, rules);
  assert.deepEqual(preview.rows, [{ amount: 100, confirmed: true, retained: 'keep' }]);
  const { importRows } = await vite.ssrLoadModule('/lib/import-rows.ts');
  await importRows('general', rows, true, 'v3-test', 'mapped', 'mapped', JSON.stringify(rules));
  const { GET: datasetsGet } = await vite.ssrLoadModule('/app/api/datasets/route.ts');
  const storedResponse = await datasetsGet(new Request('http://localhost/api/datasets?projectId=v3-test&id=ds-v3-test-mapped&all=true'));
  const stored = (await storedResponse.json()).dataset;
  assert.deepEqual(stored.rows, preview.rows);
  assert.deepEqual(stored.columns.map(c => c.key).sort(), ['amount', 'confirmed', 'retained']);
});
test('unit: mapping context changes for project, document, sheet or schema', () => {
  const context = { projectId: 'p', documentToken: 'doc', sheetId: 'A', fields: [{ key: 'x', type: 'number' }] };
  assert.equal(mappingContextMatches(context, { ...context }), true);
  for (const changed of [{ projectId: 'q' }, { documentToken: 'other' }, { sheetId: 'B' }, { fields: [{ key: 'x', type: 'text' }] }]) {
    assert.equal(mappingContextMatches(context, { ...context, ...changed }), false);
  }
});
test('unit: card validation covers dataset, numeric types, ratio, grouping and date compatibility', () => {
  const datasets = [{ id: 'ds', columns: [{ key: 'x', name: '金额', type: 'number' }, { key: 'text', name: '文字', type: 'text' }] }];
  const valid = { title: '金额', type: 'metric_card', datasetId: 'ds', aggregation: 'sum', field: 'x' };
  assert.deepEqual(validateCardConfig(valid, datasets, true), []);
  for (const changed of [{ datasetId: 'other' }, { field: 'missing' }, { field: 'text' }, { aggregation: 'ratio', field: '', numField: 'x' }, { type: 'breakdown' }, { from: '2026-10-01' }, { aggregation: 'count' }, { type: 'unknown' }]) {
    assert.ok(validateCardConfig({ ...valid, ...changed }, datasets, true).length > 0, JSON.stringify(changed));
  }
});
test('unit: date range includes noon on end day and excludes next midnight and undated rows', async () => {
  const ds = await saveDataset('v3-test', 'dates', '日期', [{ date: '2026-10-01T12:00:00+08:00' }, { date: '2026-10-02T00:00:00+08:00' }, { task: 'undated' }]);
  assert.equal((await evaluateCardMetric('v3-test', { datasetId: ds.id, aggregation: 'count', dateField: 'date', from: '2026-10-01', to: '2026-10-01' })).value, 1);
});
for (const [label, rows, rules, message] of [
  ['required', [{ value: '' }], [{ sourceField: 'value', targetField: 'value', required: true }], /必填/],
  ['duplicate key', [{ value: '1' }, { value: '1' }], [{ sourceField: 'value', targetField: 'value', isKey: true }], /重复/],
  ['invalid date', [{ value: '2026-02-30' }], [{ sourceField: 'value', targetField: 'value', type: 'date' }], /日期/],
  ['unknown boolean', [{ value: '也许' }], [{ sourceField: 'value', targetField: 'value', type: 'boolean' }], /布尔/],
  ['duplicate target', [{ a: '1', b: '2' }], [{ sourceField: 'a', targetField: 'x' }, { sourceField: 'b', targetField: 'x' }], /重名/],
  ['invalid number with zero fill', [{ value: 'abc' }], [{ sourceField: 'value', targetField: 'value', type: 'number', nullPolicy: 'zero' }], /数值/],
]) {
  test(`unit: mapping rejects ${label}`, () => assert.throws(() => applyFieldMapping(rows, rules), message));
}

test('unit: malformed numeric text is not coerced into legitimate zero', () => {
  for (const value of ['%', '¥', '1,23', '1￥2', true, Infinity]) {
    assert.throws(() => applyFieldMapping([{ x: value }], [{ sourceField: 'x', targetField: 'x', type: 'number' }]), /数值/);
  }
});
test('unit: zoneless timestamps preserve milliseconds and invalid epochs fail', async () => {
  const { parseProjectDate } = await vite.ssrLoadModule('/lib/date-values.ts');
  assert.equal(new Date(parseProjectDate('2026-10-01T12:34:56.123', 'Asia/Shanghai')).toISOString(), '2026-10-01T04:34:56.123Z');
  assert.equal(parseProjectDate(1e20), null);
  assert.equal(parseProjectDate('2026-03-08T02:30:00', 'America/New_York'), null);
});
test('unit: unsupported and malformed mapping options are explicitly rejected', () => {
  for (const rules of [[{}], [null], [{ sourceField: 'x', targetField: 'x', type: 'unsupported' }], [{ sourceField: 'x', targetField: 'x', nullPolicy: 'skip' }]]) {
    assert.ok(transformMappedRows([{ x: '1' }], rules).errors.length);
  }
});

test('unit: date mapping preserves ISO fractional seconds and normalizes only calendar separators', () => {
  const iso = '2026-10-01T12:00:00.123+08:00';
  const mapped = transformMappedRows([{ date: iso }, { date: '2026/10/01' }], [{ sourceField: 'date', targetField: 'business_day', type: 'date' }]);
  assert.deepEqual(mapped.errors, []);
  assert.equal(mapped.rows[0].business_day, iso);
  assert.equal(mapped.rows[1].business_day, '2026-10-01');
});

test('unit: legacy minimum and maximum definitions retain their aggregation semantics', () => {
  const rows = [{ amount: 10 }, { amount: null }, { amount: 20 }];
  assert.equal(evaluateMetricRows({ aggregation: 'min', field: 'amount' }, rows).value, 10);
  assert.equal(evaluateMetricRows({ aggregation: 'max', field: 'amount' }, rows).value, 20);
  assert.equal(evaluateMetricRows({ aggregation: 'max', field: 'amount' }, rows).sampleSize, 2);
});
