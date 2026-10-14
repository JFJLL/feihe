import { db } from './db';
import { getProjectDatasets, type Dataset } from './datasets';
import { resolveCardDefinition, getDefinition, prepareReusableMetric, DefinitionError } from './metrics/definitions';
import { CARD_PRESENTATIONS, validateCardConfig, transitionCardConfig, type CardMetricConfig, type MetricColumn } from './metrics/config';
import { evaluateCardMetric } from './metrics/engine';
import type { ProjectAuthContext } from './api-auth';
import { defaultBusinessDomain, fieldRoleErrors, type FieldRoles } from './metrics/recommendations';
import { validateBusinessRecords } from './business-records';

export type StructureBlueprint = {
  kind: 'project_structure_v1'; sourceProjectId: string; templateId: string; revision: string;
  groups: Array<{ key: string; label: string; fields: MetricColumn[] }>;
  metrics: Array<{ key: string; groupKey: string; name: string; config: CardMetricConfig }>;
  cards: Array<{ key: string; metricKey: string; title: string; type: string; groupBy?: string; requiresTarget: boolean }>;
  omittedCards: number;
  business?: { kind: 'dataset_ad' | 'dataset_content' | 'dataset_comment'; groupKey: string; roles: FieldRoles; metricKeys: Record<string, string> };
};
export type StructureBindings = Record<string, { datasetId: string; datasetVersion: number; fields: Record<string, string> }>;
export type StructureChoices = { bindings?: StructureBindings; selectedCards?: string[]; targets?: Record<string, number>; percentConfirmations?: Record<string, 'fraction' | 'percentage_points'> };
type AppliedStructure = StructureChoices & { choiceHash: string; cards: CardMetricConfig[]; at: string };
type StoredStructure = StructureBlueprint & { applied?: AppliedStructure };
const RULE_KEYS = ['aggregation', 'field', 'numField', 'denField', 'groupBy', 'dateField', 'missingPolicy', 'ratioBasis', 'unit', 'format', 'percentScale', 'displayOrigin'] as const;
function portableConfig(config: CardMetricConfig): CardMetricConfig {
  return { mode: 'custom', metric: 'custom', ...Object.fromEntries(RULE_KEYS.filter(key => config[key] !== undefined).map(key => [key, config[key]])) };
}
async function fingerprint(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function loadStructureBlueprint(context: ProjectAuthContext): Promise<StructureBlueprint> {
  const projectId = context.projectId, datasets = await getProjectDatasets(projectId);
  const board = await db().prepare("SELECT id,version FROM dashboards WHERE project_id=? AND status='published' ORDER BY is_default DESC,updated_at DESC LIMIT 1").bind(projectId).first<{ id: string; version: number }>();
  if (!board) throw new DefinitionError('请先发布来源项目的团队看板，再复用结构');
  const rows = await db().prepare('SELECT id,title,type,config_json AS config FROM dashboard_cards WHERE project_id=? AND dashboard_id=? ORDER BY sort_order').bind(projectId, board.id).all<{ id: string; title: string; type: string; config: string }>();
  const groups: StructureBlueprint['groups'] = [], metrics: StructureBlueprint['metrics'] = [], cards: StructureBlueprint['cards'] = [];
  const groupIds = new Map<string, string>(), aliases = new Map<string, string>(); let omittedCards = 0;
  function addFields(groupKey: string, keys: Array<string | undefined>, dataset: Dataset) {
    const group = groups.find(item => item.key === groupKey)!;
    for (const key of keys.filter(Boolean)) {
      const field = dataset.columns.find(column => column.key === key);
      if (field && !group.fields.some(column => column.key === key)) group.fields.push({ key: field.key, name: field.name, type: field.type, numericUnit: field.numericUnit, percentScale: field.percentScale });
    }
  }
  async function metricFor(config: CardMetricConfig, alias: string, name: string) {
    const resolved = await resolveCardDefinition(projectId, config);
    const dataset = datasets.find(item => item.id === resolved.config.datasetId || item.sourceId === resolved.config.datasetId);
    if (!dataset || !resolved.config.aggregation) throw new DefinitionError('历史业务组件需要单独配置，不能隐式复制来源');
    const check = validateCardConfig({ ...resolved.config, type: 'metric_card', target: undefined, targetMetricVersion: undefined }, datasets);
    if (check.length) throw new DefinitionError(check.join('；'));
    let groupKey = groupIds.get(dataset.id);
    if (!groupKey) { groupKey = 'g' + (groups.length + 1); groupIds.set(dataset.id, groupKey); groups.push({ key: groupKey, label: '来源' + (groups.length + 1), fields: [] }); }
    const effectiveAlias = alias + ':' + (resolved.definition?.version || 0);
    let metricKey = aliases.get(effectiveAlias);
    if (!metricKey) {
      metricKey = 'm' + (metrics.length + 1); aliases.set(effectiveAlias, metricKey);
      let definitionConfig = resolved.config;
      if (config.metricId) { const definition = await getDefinition(projectId, config.metricId); definitionConfig = definition.protocol.versions.find(version => version.version === resolved.definition!.version)!.config; }
      metrics.push({ key: metricKey, groupKey, name: resolved.definition?.name || name, config: portableConfig(definitionConfig) });
    }
    addFields(groupKey, [resolved.config.field, resolved.config.numField, resolved.config.denField, resolved.config.dateField, resolved.config.groupBy], dataset);
    return { metricKey, groupKey, config: resolved.config };
  }
  for (const row of rows.results) {
    try {
      if (!CARD_PRESENTATIONS.some(presentation => presentation.type === row.type)) throw new Error('Unsupported component');
      const config = JSON.parse(row.config) as CardMetricConfig;
      const metric = await metricFor(config, config.metricId || 'card:' + row.id, row.title);
      cards.push({ key: 'c' + (cards.length + 1), metricKey: metric.metricKey, title: row.title, type: row.type, groupBy: metric.config.groupBy, requiresTarget: row.type === 'progress_card' });
    } catch { omittedCards++; }
  }
  if (!cards.length) throw new DefinitionError('已发布看板没有可复用的指标卡；历史业务组件仍留在原项目');
  let business: StructureBlueprint['business'];
  const domain = defaultBusinessDomain(String(context.project.template_id));
  const setting = domain ? await db().prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(projectId, 'analytics:' + domain).first<{ value: string }>() : null;
  if (setting) {
    const binding = JSON.parse(setting.value) as { kind: string; roles: FieldRoles; metricIds: Record<string, string> };
    if (binding.kind === 'dataset_' + domain) {
      const metricKeys: Record<string, string> = {}; let groupKey = '';
      for (const role of Object.keys(binding.metricIds)) {
        const mapped = await metricFor({ metricId: binding.metricIds[role] }, binding.metricIds[role], role);
        if (groupKey && groupKey !== mapped.groupKey) throw new DefinitionError('专属业务配置跨来源，需在新项目重新配置');
        groupKey = mapped.groupKey; metricKeys[role] = mapped.metricKey;
      }
      const dataset = datasets.find(item => groupIds.get(item.id) === groupKey)!;
      const roles = Object.fromEntries(Object.entries(binding.roles).filter(([, field]) => Boolean(field))) as FieldRoles;
      addFields(groupKey, Object.values(roles), dataset); business = { kind: binding.kind as NonNullable<StructureBlueprint['business']>['kind'], groupKey, roles, metricKeys };
    }
  }
  const clean = { kind: 'project_structure_v1' as const, sourceProjectId: projectId, templateId: String(context.project.template_id || 'general_workbench'), groups, metrics, cards, omittedCards, business };
  return { ...clean, revision: await fingerprint({ ...clean, boardVersion: board.version }) };
}
export async function storedStructure(projectId: string) {
  const row = await db().prepare("SELECT value FROM project_settings WHERE project_id=? AND key='structure_blueprint'").bind(projectId).first<{ value: string }>();
  if (!row) return null;
  const blueprint = JSON.parse(row.value) as StoredStructure;
  if (blueprint.kind !== 'project_structure_v1') throw new DefinitionError('结构配置格式无效');
  return { raw: row.value, blueprint };
}
export function initialStructureBindings(blueprint: StructureBlueprint, datasets: Dataset[], preferred = ''): StructureBindings {
  return Object.fromEntries(blueprint.groups.map(group => {
    const dataset = datasets.find(item => item.id === preferred) || datasets.find(item => group.fields.every(field => item.columns.some(column => column.key === field.key && column.type === field.type))) || datasets[0];
    return [group.key, { datasetId: dataset?.id || '', datasetVersion: dataset?.version || 0, fields: Object.fromEntries(group.fields.map(field => [field.key, dataset?.columns.find(column => column.key === field.key && column.type === field.type)?.key || ''])) }];
  }));
}
export function planStructure(blueprint: StructureBlueprint, datasets: Dataset[], choices: StructureChoices) {
  if (choices.bindings && (typeof choices.bindings !== 'object' || Array.isArray(choices.bindings)) || choices.selectedCards && (!Array.isArray(choices.selectedCards) || choices.selectedCards.some(key => typeof key !== 'string'))) throw new DefinitionError('字段对应或卡片选择格式无效');
  const bindings = choices.bindings || initialStructureBindings(blueprint, datasets), selected = choices.selectedCards || blueprint.cards.map(card => card.key), errors: string[] = [];
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(key => !blueprint.cards.some(card => card.key === key))) errors.push('请选择有效的卡片结构');
  const requiredMetrics = new Set([...blueprint.cards.filter(card => selected.includes(card.key)).map(card => card.metricKey), ...Object.values(blueprint.business?.metricKeys || {})]);
  const configured = blueprint.metrics.filter(metric => requiredMetrics.has(metric.key)).map(metric => {
    const binding = bindings[metric.groupKey], dataset = datasets.find(item => item.id === binding?.datasetId);
    if (!dataset) { errors.push(metric.name + '：请选择新项目自己的数据集'); return { ...metric, config: metric.config }; }
    if (!binding.fields || typeof binding.fields !== 'object' || Array.isArray(binding.fields)) throw new DefinitionError('字段对应格式无效');
    if (binding.datasetVersion !== dataset.version) errors.push('来源数据已更新，请重新读取字段后确认');
    let config: CardMetricConfig = { ...metric.config, title: metric.name, type: 'metric_card', datasetId: dataset.id };
    for (const key of ['field', 'numField', 'denField', 'dateField', 'groupBy'] as const) if (config[key]) {
      const original = config[key]!; config[key] = binding.fields[original] || '';
      if (!config[key]) errors.push(metric.name + '：请对应模板字段 ' + original);
    }
    if (metric.config.field) config = transitionCardConfig(config, { kind: 'field', field: config.field || '' }, dataset.columns);
    if (config.aggregation !== 'ratio' && (config.format === 'percent' || config.unit === '%')) {
      const field = dataset.columns.find(column => column.key === config.field);
      if (field?.numericUnit === 'percent') config.percentScale = field.percentScale;
      else if (choices.percentConfirmations?.[metric.key]) { config.percentScale = choices.percentConfirmations[metric.key]; config.displayOrigin = 'manual'; config.displayNeedsConfirmation = false; }
      else { config.displayNeedsConfirmation = true; errors.push(metric.name + '：新字段没有百分比元数据，请明确确认百分比数值口径'); }
    }
    errors.push(...validateCardConfig(config, datasets, true).map(error => metric.name + '：' + error));
    return { ...metric, config };
  });
  const cards = blueprint.cards.filter(card => selected.includes(card.key)).map(card => {
    const metric = configured.find(metric => metric.key === card.metricKey)!, binding = bindings[metric.groupKey];
    const config: CardMetricConfig = { ...metric.config, title: card.title, type: card.type, rangePolicy: 'project', groupBy: card.groupBy ? binding?.fields[card.groupBy] || '' : metric.config.groupBy,
      ...(card.requiresTarget ? { target: choices.targets?.[card.key] } : {}) };
    if (card.requiresTarget && config.target === undefined) errors.push(card.title + '：请填写本项目自己的目标，原项目目标未复制');
    errors.push(...validateCardConfig(config, datasets, true).map(error => card.title + '：' + error));
    return { ...card, config };
  });
  return { bindings, selectedCards: selected, configured, cards, errors: [...new Set(errors)] };
}
export async function applyStructure(context: ProjectAuthContext, revision: string, choices: StructureChoices) {
  const stored = await storedStructure(context.projectId);
  if (!stored || stored.blueprint.revision !== revision) throw new DefinitionError('待复用结构已变化，请重新读取后确认', 409);
  const choiceHash = await fingerprint(choices);
  if (stored.blueprint.applied) {
    if (stored.blueprint.applied.choiceHash !== choiceHash) throw new DefinitionError('此结构已确认，请从指标和看板页面调整，不能覆盖已用配置', 409);
    return stored.blueprint.applied.cards;
  }
  const datasets = await getProjectDatasets(context.projectId), plan = planStructure(stored.blueprint, datasets, choices);
  if (Object.values(plan.bindings).some(binding => datasets.some(dataset => dataset.id === binding.datasetId && dataset.version !== binding.datasetVersion))) throw new DefinitionError('来源数据已更新，请重新读取实际字段后确认，当前选择仍可保留', 409);
  if (plan.errors.length) throw new DefinitionError(plan.errors.join('；'));
  if (stored.blueprint.business) {
    const business = stored.blueprint.business, binding = plan.bindings[business.groupKey], dataset = datasets.find(item => item.id === binding.datasetId)!;
    const roles = Object.fromEntries(Object.entries(business.roles).map(([role, field]) => [role, binding.fields[field]])) as FieldRoles;
    const errors = fieldRoleErrors(dataset, roles); if (errors.length) throw new DefinitionError(errors.join('；'));
    await validateBusinessRecords(dataset, business.kind.slice(8) as 'ad' | 'content' | 'comment', roles);
  }
  const usedDatasets = [...new Set(plan.configured.map(metric => metric.config.datasetId!))].map(id => datasets.find(dataset => dataset.id === id)!);
  const guard = { condition: "EXISTS(SELECT 1 FROM project_settings WHERE project_id=? AND key='structure_blueprint' AND value=?)" + usedDatasets.map(() => ' AND EXISTS(SELECT 1 FROM datasets WHERE id=? AND project_id=? AND version=?)').join(''), values: [context.projectId, stored.raw, ...usedDatasets.flatMap(dataset => [dataset.id, context.projectId, dataset.version])] as unknown[] };
  const prepared = [];
  for (const metric of plan.configured) prepared.push(await prepareReusableMetric(context, { id: context.projectId + ':structure:' + metric.key, name: metric.name, config: metric.config, expectedVersion: 0 }, false, guard));
  const cards = plan.cards.map(card => ({ id: 'structure-' + context.projectId + '-' + card.key, title: card.title, type: card.type, metricId: context.projectId + ':structure:' + card.metricKey, metricVersionPolicy: 'latest' as const, rangePolicy: 'project' as const,
    groupBy: card.config.groupBy, ...(card.requiresTarget ? { target: card.config.target, targetMetricVersion: 1 } : {}) }));
  const now = new Date().toISOString(), statements = prepared.flatMap(metric => metric.statements);
  if (stored.blueprint.business) {
    const business = stored.blueprint.business, binding = plan.bindings[business.groupKey];
    const value = { kind: business.kind, datasetId: binding.datasetId, roles: Object.fromEntries(Object.entries(business.roles).map(([role, field]) => [role, binding.fields[field]])), metricIds: Object.fromEntries(Object.entries(business.metricKeys).map(([role, key]) => [role, context.projectId + ':structure:' + key])), confirmedDatasetVersion: binding.datasetVersion };
    const settingKey = 'analytics:' + business.kind.slice(8);
    statements.push(db().prepare('INSERT INTO project_settings(id,project_id,key,value,updated_at) SELECT ?,?,?,?,? WHERE ' + guard.condition + ' ON CONFLICT(id) DO NOTHING').bind(context.projectId + ':' + settingKey, context.projectId, settingKey, JSON.stringify(value), now, ...guard.values));
  }
  const applied: AppliedStructure = { ...choices, choiceHash, cards, at: now };
  const guards = prepared.map(() => 'EXISTS(SELECT 1 FROM metric_definitions WHERE id=? AND project_id=? AND filter_json=?)').join(' AND ');
  statements.push(db().prepare("UPDATE project_settings SET value=?,updated_at=? WHERE project_id=? AND key='structure_blueprint' AND value=? AND " + guard.condition + ' AND ' + guards)
    .bind(JSON.stringify({ ...stored.blueprint, applied }), now, context.projectId, stored.raw, ...guard.values, ...prepared.flatMap(metric => [metric.id, context.projectId, metric.json])));
  await db().batch(statements);
  const confirmed = await storedStructure(context.projectId);
  if (confirmed?.blueprint.applied?.choiceHash !== choiceHash) throw new DefinitionError('结构或数据在确认期间发生变化，请重新读取；已有修改不会被覆盖', 409);
  for (const metric of prepared) await metric.confirm();
  return confirmed.blueprint.applied.cards;
}
export async function structurePreviews(projectId: string, plan: ReturnType<typeof planStructure>, datasets: Dataset[]) {
  return Promise.all(plan.cards.map(async card => {
    const errors = validateCardConfig(card.config, datasets, true);
    if (errors.length) return { key: card.key, title: card.title, preview: null, error: errors.join('；') };
    try { return { key: card.key, title: card.title, preview: await evaluateCardMetric(projectId, card.config), error: '' }; }
    catch (error) { return { key: card.key, title: card.title, preview: null, error: error instanceof Error ? error.message : '试算失败' }; }
  }));
}
