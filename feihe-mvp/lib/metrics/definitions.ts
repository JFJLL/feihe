import { db, ensureSchema } from '../db';
import { getProjectDatasets } from '../datasets';
import { validateCardConfig, resultUnitKey, type CardMetricConfig } from './config';
import type { ProjectAuthContext } from '../api-auth';

export type DefinitionVersion = { version: number; config: CardMetricConfig; name: string; at: string; actor: string };
type Protocol = { kind: 'reusable_metric'; scope: 'project' | 'standard_template'; version: number; saveToken: string; versions: DefinitionVersion[]; standardId?: string; standardVersion?: number };
type Row = { id: string; projectId: string; key: string; name: string; description: string; filterJson: string };
export type ReusableMetric = Omit<Row, 'filterJson'> & Protocol & { config: CardMetricConfig; datasetName: string; impact: { cards: number; reports: number } };
export class DefinitionError extends Error {
  constructor(message: string, public status = 400, public serverVersion?: number) { super(message); }
}
export function definitionProtocol(value?: string): Protocol | null {
  try { const data = JSON.parse(value || '{}'); return data.kind === 'reusable_metric' && Array.isArray(data.versions) && Number.isInteger(data.version) ? data as Protocol : null; } catch { return null; }
}
const select = 'SELECT id,project_id AS projectId,key,name,description,filter_json AS filterJson FROM metric_definitions';
export function standardNamespace(orgId: string) { return '@standards:' + orgId; }
export function canonicalCardReference(card: CardMetricConfig) {
  if (!card.metricId) return card;
  return { metricId: card.metricId, metricVersionPolicy: card.metricVersionPolicy || 'latest',
    ...(card.metricVersionPolicy === 'pinned' ? { metricVersion: card.metricVersion } : {}),
    groupBy: card.groupBy, from: card.from, to: card.to, rangePolicy: card.rangePolicy, target: card.target, targetMetricVersion: card.targetMetricVersion };
}
export async function getDefinition(projectId: string, id: string) {
  await ensureSchema();
  const row = await db().prepare(select + ' WHERE project_id=? AND id=?').bind(projectId, id).first<Row>();
  const protocol = definitionProtocol(row?.filterJson);
  if (!row || !protocol) throw new DefinitionError('指标不存在或不属于当前项目', 404);
  return { row, protocol };
}
export async function resolveCardDefinition(projectId: string, card: CardMetricConfig): Promise<{ config: CardMetricConfig; definition?: { id: string; version: number; name: string; policy: string } }> {
  if (!card.metricId) return { config: card };
  if (card.metricVersionPolicy && !['latest', 'pinned'].includes(card.metricVersionPolicy)) throw new DefinitionError('不支持的指标版本策略');
  const { row, protocol } = await getDefinition(projectId, card.metricId);
  if (protocol.scope !== 'project') throw new DefinitionError('标准模板需要先绑定本项目数据源');
  const version = card.metricVersionPolicy === 'pinned' ? card.metricVersion : protocol.version;
  const snapshot = protocol.versions.find(item => item.version === version);
  if (!snapshot) throw new DefinitionError('指标版本不存在', 409, protocol.version);
  if (card.target !== undefined && card.targetMetricVersion !== undefined) {
    const confirmed = protocol.versions.find(item => item.version === card.targetMetricVersion);
    if (!confirmed || resultUnitKey(confirmed.config) !== resultUnitKey(snapshot.config)) throw new DefinitionError('指标结果单位已变化，请重新确认目标后发布');
  }
  const config = { ...snapshot.config, metricId: undefined, metricVersionPolicy: undefined, metricVersion: undefined,
    id: card.id, title: card.title || snapshot.name, type: card.type || 'metric_card',
    groupBy: card.groupBy !== undefined ? card.groupBy : snapshot.config.groupBy,
    target: card.target, targetMetricVersion: card.targetMetricVersion, rangePolicy: card.rangePolicy,
    ...(card.from !== undefined || card.to !== undefined ? { from: card.from, to: card.to } : {}),
  };
  return { config, definition: { id: row.id, version: snapshot.version, name: snapshot.name, policy: card.metricVersionPolicy || 'latest' } };
}
function canonicalConfig(input: CardMetricConfig, name: string): CardMetricConfig {
  return { title: name, type: 'metric_card', datasetId: input.datasetId, mode: 'custom', metric: 'custom', aggregation: input.aggregation,
    field: input.field, numField: input.numField, denField: input.denField, groupBy: input.groupBy, dateField: input.dateField,
    from: input.from, to: input.to, unit: input.unit, format: input.format, missingPolicy: input.missingPolicy,
    ratioBasis: input.ratioBasis, percentScale: input.percentScale, displayOrigin: input.displayOrigin, displayNeedsConfirmation: input.displayNeedsConfirmation };
}
export async function metricImpact(projectId: string, metricId: string) {
  const [cards, reports] = await Promise.all([
    db().prepare('SELECT config_json AS configJson FROM dashboard_cards WHERE project_id=?').bind(projectId).all<{ configJson: string }>(),
    db().prepare('SELECT report_spec_json AS spec FROM report_versions WHERE project_id=?').bind(projectId).all<{ spec: string }>(),
  ]);
  return { cards: cards.results.filter(item => { try { return JSON.parse(item.configJson).metricId === metricId; } catch { return false; } }).length,
    reports: reports.results.filter(item => { try { return (JSON.parse(item.spec).metrics || []).some((metric: { metricId?: string }) => metric.metricId === metricId); } catch { return false; } }).length };
}
export async function listReusableMetrics(projectId: string) {
  await ensureSchema();
  const [rows, datasets] = await Promise.all([db().prepare(select + ' WHERE project_id=? ORDER BY updated_at DESC').bind(projectId).all<Row>(), getProjectDatasets(projectId)]);
  const metrics: ReusableMetric[] = [];
  for (const row of rows.results) {
    const protocol = definitionProtocol(row.filterJson); if (!protocol) continue;
    const config = protocol.versions.find(item => item.version === protocol.version)?.config; if (!config) continue;
    metrics.push({ id: row.id, projectId: row.projectId, key: row.key, name: row.name, description: row.description, ...protocol, config,
      datasetName: datasets.find(dataset => dataset.id === config.datasetId)?.name || (protocol.scope === 'standard_template' ? '待绑定项目来源' : '来源已移除'), impact: await metricImpact(projectId, row.id) });
  }
  return metrics;
}
type MetricSaveInput = { id?: string; name?: string; description?: string; config?: CardMetricConfig; expectedVersion?: number; standardId?: string; standardVersion?: number };
export async function prepareReusableMetric(context: ProjectAuthContext, body: MetricSaveInput, catalog = false, guard = { condition: '1', values: [] as unknown[] }) {
  if (!context.canManage || catalog && !context.isPlatformAdmin) throw new DefinitionError('没有维护此指标的权限', 403);
  const projectId = catalog ? standardNamespace(context.user.orgId) : context.projectId;
  const name = String(body.name || '').trim(); if (!name || name.length > 100) throw new DefinitionError('请填写100字以内的指标名称');
  if (!body.config || body.config.metricId) throw new DefinitionError('请提交完整的指标定义');
  const config = canonicalConfig(body.config, name);
  if (!catalog) {
    const datasets = await getProjectDatasets(projectId);
    const dataset = datasets.find(item => item.id === config.datasetId || item.sourceId === config.datasetId);
    if (dataset) config.datasetId = dataset.id;
    const errors = validateCardConfig(config, datasets, true);
    if (errors.length) throw new DefinitionError(errors.join('；'));
  } else { // A template carries rules, never customer authorization, a dataset or a real target/period.
    delete config.datasetId; delete config.from; delete config.to;
  }
  let standardId = body.standardId, standardVersion = body.standardVersion;
  if (standardId) {
    const standard = await getDefinition(standardNamespace(context.user.orgId), standardId);
    const snapshot = standard.protocol.versions.find(item => item.version === standardVersion);
    if (!snapshot) throw new DefinitionError('标准模板版本已变化，请重新确认', 409, standard.protocol.version);
    const rules = ['aggregation', 'missingPolicy', 'ratioBasis', 'unit', 'format', 'percentScale'] as const;
    if (rules.some(key => snapshot.config[key] !== config[key])) { standardId = undefined; standardVersion = undefined; }
  }
  const id = body.id || projectId + ':metric:' + crypto.randomUUID();
  if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0)) throw new DefinitionError('指标版本必须为非负整数');
  const oldRow = await db().prepare(select + ' WHERE id=?').bind(id).first<Row>();
  if (oldRow && oldRow.projectId !== projectId) throw new DefinitionError('不能修改其他项目的指标', 403);
  const old = definitionProtocol(oldRow?.filterJson);
  if (oldRow && !old) throw new DefinitionError('历史定义请先显式确认来源与口径，不能直接覆盖', 409);
  if (old && body.expectedVersion !== old.version) throw new DefinitionError('指标已被其他成员修改，请保留草稿并重新确认', 409, old.version);
  const version = (old?.version || 0) + 1, now = new Date().toISOString();
  const protocol: Protocol = { kind: 'reusable_metric', scope: catalog ? 'standard_template' : 'project', version, saveToken: crypto.randomUUID(),
    versions: [...old?.versions || [], { version, config, name, at: now, actor: context.user.userId }], standardId, standardVersion };
  const json = JSON.stringify(protocol), key = oldRow?.key || 'shared_' + crypto.randomUUID().replaceAll('-', '');
  const formula = config.aggregation === 'ratio' ? config.numField + '/' + config.denField : config.field || '';
  const statements = [db().prepare("INSERT INTO metric_definitions(id,project_id,key,name,description,unit,aggregation,formula,format,filter_json,is_standard,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE " + guard.condition + " ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,unit=excluded.unit,aggregation=excluded.aggregation,formula=excluded.formula,format=excluded.format,filter_json=excluded.filter_json,is_standard=excluded.is_standard,updated_at=excluded.updated_at WHERE metric_definitions.project_id=excluded.project_id AND metric_definitions.filter_json=?")
    .bind(id, projectId, key, name, String(body.description ?? oldRow?.description ?? ''), config.unit || '', config.aggregation || 'count', formula, config.format || 'number', json, catalog || standardId ? 1 : 0, now, now, ...guard.values, oldRow?.filterJson || '')];
  if (!catalog) {
    const dataset = (await getProjectDatasets(projectId)).find(item => item.id === config.datasetId)!;
    statements.push(db().prepare("INSERT INTO metric_bindings(id,project_id,metric_id,source_id,source_field,dimensions_json,transform_json,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM metric_definitions WHERE id=? AND project_id=? AND filter_json=?) AND " + guard.condition + " ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id,source_field=excluded.source_field,dimensions_json=excluded.dimensions_json,transform_json=excluded.transform_json,updated_at=excluded.updated_at")
      .bind(id + ':binding', projectId, id, dataset.sourceId, config.field || config.numField || '', JSON.stringify([config.dateField, config.groupBy].filter(Boolean)), JSON.stringify({ datasetId: dataset.id, metricId: id, version }), now, now, id, projectId, json, ...guard.values));
  }
  statements.push(db().prepare('INSERT INTO action_logs(project_id,action,target_type,target_id,detail,created_at,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM metric_definitions WHERE id=? AND project_id=? AND filter_json=?) AND ' + guard.condition)
    .bind(context.projectId, catalog ? '维护标准指标模板' : '保存共享指标定义', 'metric_definition', id, name + ' v' + version, now, context.user.userId, id, projectId, json, ...guard.values));
  return { id, json, statements, confirm: async () => {
    const confirmed = await getDefinition(projectId, id);
    if (confirmed.protocol.saveToken !== protocol.saveToken) throw new DefinitionError('指标并发版本发生变化，请保留草稿', 409, confirmed.protocol.version);
    return { id, version, key, config, standardId, standardVersion };
  } };
}
export async function saveReusableMetric(context: ProjectAuthContext, body: MetricSaveInput, catalog = false) {
  const prepared = await prepareReusableMetric(context, body, catalog);
  await db().batch(prepared.statements);
  return prepared.confirm();
}
