import { runtimeVars, warmWorkerEnv } from '@/lib/runtime-env';
void warmWorkerEnv();
import { requireProjectAccess, getAuthenticatedUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';
const value = (input: unknown) => String(input ?? '').trim();
const runtime = () => runtimeVars();

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError('请先登录', 401);

  await ensureSchema();
  const params = new URL(request.url).searchParams;
  const rawProject = params.get('projectId');

  let project = '';
  if (rawProject) {
    const access = await requireProjectAccess(request, rawProject, 'read');
    if (!access.ok) return jsonError(access.error!, access.status!);
    project = access.context!.projectId;
  }

  const sql = `SELECT id,project_id AS projectId,provider,name,base_url AS baseUrl,enabled,config_json AS configJson,status,last_tested_at AS lastTestedAt,last_error AS lastError,updated_at AS updatedAt FROM integrations ${project ? 'WHERE project_id=?' : ''} ORDER BY updated_at DESC`;
  const result = project ? await db().prepare(sql).bind(project).all() : await db().prepare(sql).all();
  const r = runtime();
  return Response.json({
    ok: true,
    integrations: result.results,
    credentialStatus: {
      redtrend: Boolean(r.XHS_BASE_URL),
      oss: Boolean(r.OSS_ACCESS_KEY_ID && r.OSS_ACCESS_KEY_SECRET && r.OSS_ENDPOINT && r.OSS_BUCKET && r.OSS_COOKIE_OBJECT),
      feishu: Boolean(r.FEISHU_APP_ID && r.FEISHU_APP_SECRET),
      keystone: Boolean(r.KEYSTONE_API_KEY),
    },
  });
}

async function probe(provider: string, baseUrl: string) {
  const r = runtime();
  if (provider === 'feishu') {
    if (!r.FEISHU_APP_ID || !r.FEISHU_APP_SECRET) throw new Error('飞书应用凭证未配置');
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: r.FEISHU_APP_ID, app_secret: r.FEISHU_APP_SECRET }),
    });
    const payload = (await response.json()) as { code?: number; msg?: string };
    if (!response.ok || payload.code) throw new Error(payload.msg || `HTTP ${response.status}`);
    return;
  }
  if (provider === 'oss') {
    if (!(r.OSS_ACCESS_KEY_ID && r.OSS_ACCESS_KEY_SECRET && r.OSS_ENDPOINT && r.OSS_BUCKET && r.OSS_COOKIE_OBJECT)) throw new Error('OSS Cookie 池凭证不完整');
    return;
  }
  if (provider === 'keystone') {
    if (!r.KEYSTONE_API_KEY) throw new Error('Keystone API Key 未配置到托管环境');
    const url = `${(baseUrl || r.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1').replace(/\/$/, '')}/models`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${r.KEYSTONE_API_KEY}`, Accept: 'application/json' } });
    const payload = (await response.json()) as { data?: Array<{ id: string }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
    const models = (payload.data || []).map((x) => x.id);
    const textModel = r.KEYSTONE_MODEL || 'gpt-5.6-terra';
    if (!models.includes(textModel)) throw new Error(`连接成功，但未发现指定文本模型 ${textModel}`);
    return;
  }
  if (!baseUrl) throw new Error('接口地址未配置');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(baseUrl, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json,text/plain,*/*' } });
    if (response.status >= 500) throw new Error(`服务返回 HTTP ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
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
  const d1 = db();
  const action = value(body.action);
  const id = value(body.id);
  const provider = value(body.provider);
  const name = value(body.name);
  const baseUrl = value(body.baseUrl);
  const enabled = body.enabled === false ? 0 : 1;
  const configJson = typeof body.configJson === 'string' ? body.configJson : JSON.stringify(body.configJson || {});
  const now = new Date().toISOString();

  if (action === 'test') {
    if (!provider) return jsonError('缺少 provider 参数');
    try {
      await probe(provider, baseUrl);
      await d1.prepare(`UPDATE integrations SET status='连接正常',last_tested_at=?,last_error='',updated_at=? WHERE id=? AND project_id=?`).bind(now, now, id, project).run();
      await logAction('测试外部连接', provider, id, '测试成功', project);
      return Response.json({ ok: true, status: '连接正常', testedAt: now });
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接测试失败';
      await d1.prepare(`UPDATE integrations SET status='连接失败',last_tested_at=?,last_error=?,updated_at=? WHERE id=? AND project_id=?`).bind(now, message, now, id, project).run();
      await logAction('测试外部连接', provider, id, `测试失败: ${message}`, project);
      return Response.json({ ok: false, status: '连接失败', error: message, testedAt: now }, { status: 400 });
    }
  }

  if (action === 'save') {
    if (!id || !provider || !name) return jsonError('请填写连接 ID、服务提供方和名称');
    await d1
      .prepare(
        `INSERT INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,'未检测',?,?) ON CONFLICT(id) DO UPDATE SET
      provider=excluded.provider,name=excluded.name,base_url=excluded.base_url,enabled=excluded.enabled,config_json=excluded.config_json,updated_at=excluded.updated_at`
      )
      .bind(id, project, provider, name, baseUrl, enabled, configJson, now, now)
      .run();
    await logAction('保存外部集成', provider, id, name, project);
    return Response.json({ ok: true, id });
  }

  return jsonError('不支持的操作');
}
