import { requireProjectAccess, jsonError } from '../../../lib/api-auth';
import { isCampaignProject } from '../../../lib/campaign-catalog';
import {
  getIndustryConfig,
  saveIndustryConfig,
  getLatestIndustrySnapshot,
  listIndustryTasks,
  invalidateIndustrySnapshot,
} from '../../../lib/industry-db';
import {
  resolveProjectIndustryMeta,
} from '../../../lib/industry-service';
import { getIndustryV2Report, queueIndustryV2 } from '../../../lib/industry-v2-service';
import { saveIndustryV2Config, IndustryConfigError } from '../../../lib/industry-v2-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') || '';
  if (!projectId) return jsonError('缺少 projectId 参数', 400);

  const access = await requireProjectAccess(request, projectId);
  if (!access.ok) return jsonError(access.error || '无权访问该项目', access.status || 403);

  if (!isCampaignProject(projectId)) {
    return jsonError('当前项目不是营销复盘项目，未开通行业分析模块', 403);
  }

  try {
    const meta = await resolveProjectIndustryMeta(projectId);
    const config = await getIndustryConfig(projectId);
    const effectiveSpu = meta.spu;

    const snapshot = await getLatestIndustrySnapshot(projectId, effectiveSpu);
    const history = await listIndustryTasks(projectId, 5);

    // liveVerified strictly from valid snapshot provenance
    const liveVerified = Boolean(snapshot?.provenance?.liveVerified);
    const canWrite = Boolean(access.context?.canWrite);

    return Response.json({
      ok: true,
      projectId,
      spu: effectiveSpu,
      brand: meta.brand,
      category: meta.category,
      projectName: meta.name,
      isConfigured: Boolean(effectiveSpu),
      canWrite,
      config: config || {
        projectId,
        spu: effectiveSpu,
        category: meta.category,
        brand: meta.brand,
        keywords: [effectiveSpu].filter(Boolean),
        competitorBrands: [],
        provider: 'pgy',
        dailySyncEnabled: true,
        lastStatus: effectiveSpu ? 'idle' : 'missing_spu',
        updatedAt: new Date().toISOString(),
      },
      snapshot,
      history,
      liveVerified,
      ...await getIndustryV2Report(projectId, new Date(), url.searchParams.get('queryId') || undefined),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof IndustryConfigError) return jsonError(error.message, 400);
    return jsonError('获取行业分析数据失败，请稍后重试', 500);
  }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonError('请使用 JSON 请求', 415);
  const origin = request.headers.get('origin');
  const allowedOrigin = process.env.SITE_ORIGIN || new URL(request.url).origin;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== allowedOrigin)) return jsonError('不允许跨站修改', 403);
  try {
    let body: Record<string, unknown> | null = null;
    try {
      body = await request.json();
    } catch {
      return jsonError('请求体必须是有效的 JSON 格式', 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError('请求体格式不正确', 400);
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) return jsonError('缺少 projectId 参数', 400);

    const access = await requireProjectAccess(request, projectId, 'write');
    if (!access.ok) return jsonError(access.error || '无权修改该项目配置', access.status || 403);

    if (!isCampaignProject(projectId)) {
      return jsonError('当前项目未开通行业分析模块', 403);
    }

    const action = typeof body.action === 'string' ? body.action : 'trigger_sync';

    if (action === 'save_config_v2') {
      try {
        const configV2 = await saveIndustryV2Config(projectId, body);
        if (configV2.spu) await queueIndustryV2(projectId, new Date(), false);
        return Response.json({ ok: true, configV2, message: '检索配置已保存，历史采集已排队' });
      } catch (error) {
        if (error instanceof IndustryConfigError) return jsonError(error.message, 400);
        throw error;
      }
    }
    if (action === 'enqueue_v2' || action === 'trigger_sync') {
      try {
        const queued = await queueIndustryV2(projectId);
        return Response.json({ ok: true, queued: true, ...queued, message: '已加入后台采集队列；按日渐进补齐，同一检索任务不重复抓取' });
      } catch (error) {
        if (error instanceof IndustryConfigError) return jsonError(error.message, 400);
        throw error;
      }
    }
    if (action === 'save_config') {
      let validatedCompetitors: string[] | undefined = undefined;
      if (body.competitorBrands !== undefined) {
        if (!Array.isArray(body.competitorBrands)) {
          return jsonError('competitorBrands 必须为数组', 400);
        }
        if (body.competitorBrands.length > 20) {
          return jsonError('竞品品牌数量最多支持 20 个', 400);
        }
        validatedCompetitors = [];
        for (const item of body.competitorBrands) {
          if (typeof item !== 'string') {
            return jsonError('竞品品牌名称必须是字符串', 400);
          }
          const trimmed = item.trim();
          if (trimmed.length > 60) {
            return jsonError('单品牌名称长度不能超过 60 个字符', 400);
          }
          if (trimmed) validatedCompetitors.push(trimmed);
        }
      }

      let validatedDailySync: boolean | undefined = undefined;
      if (body.dailySyncEnabled !== undefined) {
        if (typeof body.dailySyncEnabled !== 'boolean') {
          return jsonError('dailySyncEnabled 必须是布尔值', 400);
        }
        validatedDailySync = body.dailySyncEnabled;
      }

      const meta = await resolveProjectIndustryMeta(projectId);
      const updated = await saveIndustryConfig(projectId, {
        spu: meta.spu,
        brand: meta.brand,
        category: meta.category,
        competitorBrands: validatedCompetitors,
        dailySyncEnabled: validatedDailySync,
      });
      return Response.json({ ok: true, config: updated, message: '配置已更新' });
    }

    if (action === 'invalidate') {
      const oldSpu = typeof body.oldSpu === 'string' ? body.oldSpu.trim() : '';
      const newSpu = typeof body.newSpu === 'string' ? body.newSpu.trim() : '';
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 100) : '用户手动废弃旧分析快照';
      await invalidateIndustrySnapshot(projectId, oldSpu, newSpu, reason);
      return Response.json({ ok: true, message: '旧分析结果已废弃' });
    }

    return jsonError('不支持的 action 类型', 400);
  } catch {
    return jsonError('操作处理失败，请稍后重试', 500);
  }
}
