import { runtimeVars, warmWorkerEnv } from '@/lib/runtime-env';
void warmWorkerEnv();
import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';
const text = (v: unknown) => String(v ?? '').trim();
const runtime = () => runtimeVars();
const safeJson = (value: unknown, fallback: string) => {
  try {
    return typeof value === 'string' ? JSON.stringify(JSON.parse(value)) : JSON.stringify(value ?? JSON.parse(fallback));
  } catch {
    throw new Error('JSON 配置格式不正确');
  }
};

async function keystoneCapability() {
  const r = runtime(),
    key = r.KEYSTONE_API_KEY || process.env.KEYSTONE_API_KEY,
    rawBase = r.KEYSTONE_BASE_URL || process.env.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1',
    base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase,
    textModel = r.KEYSTONE_MODEL || process.env.KEYSTONE_MODEL || 'gpt-5.6-terra',
    imageModel = r.KEYSTONE_IMAGE_MODEL || process.env.KEYSTONE_IMAGE_MODEL || 'gpt-image-2';
  if (!key) return { configured: false, status: '未配置密钥', models: [], textModels: [], imageModels: [], textModel, imageModel, baseUrl: base };
  try {
    const response = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    const payload = (await response.json()) as { data?: Array<{ id: string }>; error?: { message?: string }; message?: string };
    if (!response.ok) throw new Error(payload.error?.message || payload.message || `HTTP ${response.status}`);
    const models = (payload.data || []).map((x) => x.id),
      imageModels = models.filter((x) => /(image|video|sora|seedream|wan)/i.test(x)),
      textModels = models.filter((x) => !imageModels.includes(x)),
      textReady = models.includes(textModel),
      imageReady = models.includes(imageModel);
    return { configured: true, status: textReady ? (imageReady ? '文本与生图模型可用' : '文本模型可用 · 生图配置已保留') : '指定文本模型不可用', models, textModels, imageModels, textModel, imageModel, baseUrl: base };
  } catch (error) {
    return { configured: true, status: '连接失败', models: [], textModels: [], imageModels: [], textModel, imageModel, baseUrl: base, error: error instanceof Error ? error.message : '连接失败' };
  }
}

export async function GET(request: Request) {
  const rawProject = new URL(request.url).searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  await ensureSchema();
  const d1 = db();

  const [accounts, endpoints, metrics, bindings, sources, integrations, runs, reports, assets, capability] = await Promise.all([
    d1.prepare(`SELECT id,project_id AS projectId,integration_id AS integrationId,external_id AS externalId,name,account_type AS accountType,status,metadata_json AS metadataJson,last_synced_at AS lastSyncedAt,last_error AS lastError,updated_at AS updatedAt FROM source_accounts WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,project_id AS projectId,integration_id AS integrationId,key,name,method,path,category,description,parameter_schema AS parameterSchema,response_schema AS responseSchema,enabled,last_tested_at AS lastTestedAt,last_error AS lastError,updated_at AS updatedAt FROM api_endpoints WHERE project_id=? ORDER BY category,name`).bind(project).all(),
    d1.prepare(`SELECT id,key,name,description,unit,aggregation,formula,format,aliases_json AS aliasesJson,updated_at AS updatedAt FROM metric_definitions WHERE project_id=? ORDER BY name`).bind(project).all(),
    d1.prepare(`SELECT b.id,b.metric_id AS metricId,m.name AS metricName,b.endpoint_id AS endpointId,e.name AS endpointName,b.source_id AS sourceId,s.name AS sourceName,b.source_field AS sourceField,b.dimensions_json AS dimensionsJson,b.transform_json AS transformJson,b.updated_at AS updatedAt FROM metric_bindings b LEFT JOIN metric_definitions m ON m.id=b.metric_id LEFT JOIN api_endpoints e ON e.id=b.endpoint_id LEFT JOIN data_sources s ON s.id=b.source_id WHERE b.project_id=? ORDER BY m.name`).bind(project).all(),
    d1.prepare(`SELECT id,name,type,kind,status,last_synced_at AS lastSyncedAt,last_row_count AS lastRowCount FROM data_sources WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,name,provider,base_url AS baseUrl,status,last_tested_at AS lastTestedAt,last_error AS lastError FROM integrations WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,prompt,status,engine,date_start AS dateStart,date_end AS dateEnd,progress,error,created_at AS createdAt,finished_at AS finishedAt FROM agent_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 10`).bind(project).all(),
    d1.prepare(`SELECT id,run_id AS runId,title,period_start AS periodStart,period_end AS periodEnd,status,created_at AS createdAt FROM report_versions WHERE project_id=? ORDER BY created_at DESC LIMIT 12`).bind(project).all(),
    d1.prepare(`SELECT id,file_name AS fileName,content_type AS contentType,size,status,summary_json AS summaryJson,created_at AS createdAt FROM uploaded_assets WHERE project_id=? ORDER BY created_at DESC LIMIT 20`).bind(project).all(),
    keystoneCapability(),
  ]);

  return Response.json({
    ok: true,
    accounts: accounts.results,
    endpoints: endpoints.results,
    metrics: metrics.results,
    bindings: bindings.results,
    sources: sources.results,
    integrations: integrations.results,
    runs: runs.results,
    reports: reports.results,
    assets: assets.results,
    keystone: capability,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  await ensureSchema();
  const action = text(body.action);
  const entity = text(body.entity);
  const id = text(body.id) || crypto.randomUUID();
  const now = new Date().toISOString();
  const d1 = db();

  try {
    if (action === 'delete') {
      const tables: Record<string, string> = { account: 'source_accounts', endpoint: 'api_endpoints', metric: 'metric_definitions', binding: 'metric_bindings' };
      const table = tables[entity];
      if (!table) return jsonError('不支持的数据地图对象');
      if (entity === 'metric') await d1.prepare('DELETE FROM metric_bindings WHERE project_id=? AND metric_id=?').bind(project, id).run();
      await d1.prepare(`DELETE FROM ${table} WHERE id=? AND project_id=?`).bind(id, project).run();
      await logAction('删除数据地图对象', entity, id, text(body.name), project);
      return Response.json({ ok: true });
    }

    if (action === 'probe_keystone') {
      const result = await keystoneCapability();
      const status = result.textModels.length ? '连接正常' : result.configured ? '缺少文本模型' : '未配置密钥';
      await d1.prepare(`UPDATE integrations SET status=?,last_tested_at=?,last_error=?,updated_at=? WHERE project_id=? AND provider='keystone'`).bind(status, now, result.error || '', now, project).run();
      return Response.json({ ok: true, ...result });
    }

    if (action !== 'save') return jsonError('不支持的操作');

    if (entity === 'account') {
      await d1.prepare(`INSERT INTO source_accounts(id,project_id,integration_id,external_id,name,account_type,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET integration_id=excluded.integration_id,external_id=excluded.external_id,name=excluded.name,account_type=excluded.account_type,status=excluded.status,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at`)
        .bind(id, project, text(body.integrationId) || null, text(body.externalId), text(body.name) || '新账户', text(body.accountType) || 'sub_account', text(body.status) || '未检测', safeJson(body.metadataJson, '{}'), now, now).run();
    } else if (entity === 'endpoint') {
      await d1.prepare(`INSERT INTO api_endpoints(id,project_id,integration_id,key,name,method,path,category,description,parameter_schema,response_schema,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET integration_id=excluded.integration_id,key=excluded.key,name=excluded.name,method=excluded.method,path=excluded.path,category=excluded.category,description=excluded.description,parameter_schema=excluded.parameter_schema,response_schema=excluded.response_schema,enabled=excluded.enabled,updated_at=excluded.updated_at`)
        .bind(id, project, text(body.integrationId) || null, text(body.key) || `endpoint_${Date.now()}`, text(body.name) || '新接口', text(body.method) || 'GET', text(body.path) || '/', text(body.category) || '数据查询', text(body.description), safeJson(body.parameterSchema, '{}'), safeJson(body.responseSchema, '{}'), body.enabled === false ? 0 : 1, now, now).run();
    } else if (entity === 'metric') {
      await d1.prepare(`INSERT INTO metric_definitions(id,project_id,key,name,description,unit,aggregation,formula,format,aliases_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET key=excluded.key,name=excluded.name,description=excluded.description,unit=excluded.unit,aggregation=excluded.aggregation,formula=excluded.formula,format=excluded.format,aliases_json=excluded.aliases_json,updated_at=excluded.updated_at`)
        .bind(id, project, text(body.key) || `metric_${Date.now()}`, text(body.name) || '新指标', text(body.description), text(body.unit), text(body.aggregation) || 'sum', text(body.formula), text(body.format) || 'number', safeJson(body.aliasesJson, '[]'), now, now).run();
    } else if (entity === 'binding') {
      await d1.prepare(`INSERT INTO metric_bindings(id,project_id,metric_id,endpoint_id,source_id,source_field,dimensions_json,transform_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET metric_id=excluded.metric_id,endpoint_id=excluded.endpoint_id,source_id=excluded.source_id,source_field=excluded.source_field,dimensions_json=excluded.dimensions_json,transform_json=excluded.transform_json,updated_at=excluded.updated_at`)
        .bind(id, project, text(body.metricId), text(body.endpointId) || null, text(body.sourceId) || null, text(body.sourceField), safeJson(body.dimensionsJson, '[]'), safeJson(body.transformJson, '{}'), now, now).run();
    } else {
      return jsonError('不支持的数据地图对象');
    }

    await logAction(text(body.id) ? '更新数据地图对象' : '新增数据地图对象', entity, id, text(body.name) || text(body.key), project);
    return Response.json({ ok: true, id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '数据地图操作失败', 500);
  }
}
