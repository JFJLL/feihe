import { createServer } from 'vite';
import path from 'node:path';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: {
    alias: { '@': path.resolve('D:/download/pic-vec/feihe-platform-v3/feihe-mvp') },
root: path.resolve('D:/download/pic-vec/feihe-platform-v3/feihe-mvp'),
  },
});

const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
await ensureSchema();
const d1 = db();
const now = new Date().toISOString();

console.log('Seeding rich test data into local.db for UI verification...');

const projectId = 'internal-ops-activity';
const dsId = 'ds-internal-ops-activity-leads';
const sourceId = 'src-offline-leads';

// 1. Data Source with Visual Field Mapping JSON
const mappingRules = [
  { sourceField: '序号', targetField: '序号', type: 'number', isKey: true, required: true, nullPolicy: 'zero' },
  { sourceField: '门店渠道', targetField: '门店渠道', type: 'text', nullPolicy: 'null' },
  { sourceField: '到店咨询量', targetField: '咨询人数', type: 'number', nullPolicy: 'zero' },
  { sourceField: '签约订单量', targetField: '成交人数', type: 'number', nullPolicy: 'zero' },
  { sourceField: '业务日期', targetField: '业务日期', type: 'date', isDate: true, nullPolicy: 'null' },
  { sourceField: '执行状态', targetField: '执行状态', type: 'text', nullPolicy: 'empty' },
];

await d1.prepare(`INSERT OR REPLACE INTO data_sources(
  id, project_id, type, name, spreadsheet, sheet_id, range, kind, sync_frequency, status, last_synced_at, last_row_count, mapping_json, last_error, created_at, updated_at
) VALUES(
  ?, ?, 'feishu_bitable', '华北区重点门店咨询与签约数据表',
  'https://yimeichuanbo.feishu.cn/wiki/wikcnHub7291?sheet=tblLeads2026', 'tblLeads2026', 'A1:AZ5000',
  'general', 'manual', '已连接', ?, 501, ?, '', ?, ?
)`).bind(sourceId, projectId, now, JSON.stringify(mappingRules), now, now).run();

// 2. 501 Rows Dataset: 500 rows with 咨询=1, 成交=0; 1 row with 咨询=100, 成交=100
const columns = [
  { key: '序号', name: '序号', type: 'number' },
  { key: '门店渠道', name: '门店渠道', type: 'text' },
  { key: '咨询人数', name: '咨询人数', type: 'number' },
  { key: '成交人数', name: '成交人数', type: 'number' },
  { key: '业务日期', name: '业务日期', type: 'date' },
  { key: '执行状态', name: '执行状态', type: 'text' },
];

await d1.prepare(`INSERT OR REPLACE INTO datasets(
  id, project_id, source_id, name, schema_json, row_count, version, created_at, updated_at
) VALUES(
  ?, ?, ?, '华北全渠道咨询与签约汇总集 (501样本)', ?, 501, 1, ?, ?
)`).bind(dsId, projectId, sourceId, JSON.stringify(columns), now, now).run();

// Clear and insert 501 rows
await d1.prepare('DELETE FROM dataset_rows WHERE dataset_id=?').bind(dsId).run();

const channels = ['北京海淀旗舰店', '天津滨海中心店', '石家庄万达专柜', '太原亲贤体验馆'];
const statements = [];

for (let i = 1; i <= 500; i++) {
  const ch = channels[(i - 1) % channels.length];
  const rowObj = {
    '序号': i,
    '门店渠道': ch,
    '咨询人数': 1,
    '成交人数': 0,
    '业务日期': `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    '执行状态': i % 3 === 0 ? '已完成' : '进行中',
  };
  statements.push(
    d1.prepare(`INSERT INTO dataset_rows(
      id, dataset_id, project_id, source_id, row_key, data_json, created_at, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`).bind(`${dsId}:r${i}`, dsId, projectId, sourceId, String(i), JSON.stringify(rowObj), now, now)
  );
}

// Row 501: High impact row (100 inquiries, 100 conversions)
const row501Obj = {
  '序号': 501,
  '门店渠道': '北京海淀旗舰店',
  '咨询人数': 100,
  '成交人数': 100,
  '业务日期': '2026-10-12',
  '执行状态': '已完成',
};
statements.push(
  d1.prepare(`INSERT INTO dataset_rows(
    id, dataset_id, project_id, source_id, row_key, data_json, created_at, updated_at
  ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`).bind(`${dsId}:r501`, dsId, projectId, sourceId, '501', JSON.stringify(row501Obj), now, now)
);

for (let i = 0; i < statements.length; i += 80) {
  await d1.batch(statements.slice(i, i + 80));
}

// 3. Dashboard and Cards
const dashId = `dash-${projectId}-default`;
await d1.prepare(`INSERT OR REPLACE INTO dashboards(
  id, project_id, name, is_default, version, layout_json, status, created_at, updated_at
) VALUES(?, ?, '默认工作台看板', 1, 2, '[]', 'published', ?, ?)`).bind(dashId, projectId, now, now).run();

await d1.prepare('DELETE FROM dashboard_cards WHERE dashboard_id=?').bind(dashId).run();

const cards = [
  {
    id: 'card-total-inquiries',
    title: '全渠道到店咨询人数',
    type: 'metric_card',
    metric: 'consultation_total',
    config: { datasetId: dsId, field: '咨询人数', aggregation: 'sum', unit: '人' },
    sortOrder: 0,
  },
  {
    id: 'card-total-orders',
    title: '全渠道签约订单人数',
    type: 'metric_card',
    metric: 'conversion_total',
    config: { datasetId: dsId, field: '成交人数', aggregation: 'sum', unit: '人' },
    sortOrder: 1,
  },
  {
    id: 'card-conversion-rate',
    title: '整体加权成交转化率',
    type: 'progress_card',
    metric: 'conversion_rate',
    config: { datasetId: dsId, numField: '成交人数', denField: '咨询人数', aggregation: 'ratio', unit: '%', format: 'percent' },
    sortOrder: 2,
  },
  {
    id: 'card-channel-breakdown',
    title: '各主要渠道转化率与签约量',
    type: 'breakdown',
    metric: 'conversion_rate',
    config: { datasetId: dsId, numField: '成交人数', denField: '咨询人数', aggregation: 'ratio', groupBy: '门店渠道', unit: '%' },
    sortOrder: 3,
  },
];

for (const c of cards) {
  await d1.prepare(`INSERT INTO dashboard_cards(
    id, dashboard_id, project_id, title, type, metric_keys_json, config_json, sort_order, created_at, updated_at
  ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    c.id,
    dashId,
    projectId,
    c.title,
    c.type,
    JSON.stringify([c.metric]),
    JSON.stringify(c.config),
    c.sortOrder,
    now,
    now
  ).run();
}

// Update project onboarding status to 'ready'
await d1.prepare(`UPDATE projects SET onboarding_status='ready', updated_at=? WHERE id=?`).bind(now, projectId).run();
await d1.prepare(`INSERT OR REPLACE INTO project_onboarding(project_id, current_step, completed_steps_json, selected_template_id, updated_at)
  VALUES(?, 'ready', '["template","source","first_sync","metrics","members"]', 'general_workbench', ?)`).bind(projectId, now).run();

console.log('✅ Successfully seeded 501-record dataset and dashboard cards for internal-ops-activity in local.db!');
process.exit(0);
