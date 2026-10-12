import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction, saveSetting } from '@/lib/ops';
import { invalidateOpsCache } from '@/app/api/ops/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    rules?: Record<string, unknown>;
    acceptance?: { reportCount?: number; baseCount?: number; brandTopRate?: number; freshnessHours?: number; supplierSimilarity?: number };
    goals?: { workTarget?: number; workCompleted?: number; monthlyTarget?: number; quarterlyTarget?: number; publishTarget?: number; budgetTarget?: number; commentTarget?: number };
    growth?: { watchKeywords?: Array<Record<string, unknown>>; inspirations?: Array<Record<string, unknown>>; seedNoteIds?: unknown[]; thresholds?: Record<string, unknown> };
    pipelines?: Array<Record<string, unknown>>;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    if (body.rules) await saveSetting('rules', body.rules, project);
    if (body.acceptance) {
      const value = {
        reportCount: Math.max(1, Number(body.acceptance.reportCount || 200)),
        baseCount: Math.max(1, Number(body.acceptance.baseCount || 30)),
        brandTopRate: Math.min(1, Math.max(0, Number(body.acceptance.brandTopRate ?? 0.4))),
        freshnessHours: Math.max(1, Number(body.acceptance.freshnessHours || 24)),
        supplierSimilarity: Math.min(1, Math.max(0.3, Number(body.acceptance.supplierSimilarity ?? 0.58))),
      };
      await saveSetting('acceptance', value, project);
    }
    if (body.goals) {
      await saveSetting(
        'goals',
        {
          workTarget: Math.max(0, Number(body.goals.workTarget || 0)),
          workCompleted: Math.max(0, Number(body.goals.workCompleted || 0)),
          monthlyTarget: Math.max(0, Number(body.goals.monthlyTarget || 0)),
          quarterlyTarget: Math.max(0, Number(body.goals.quarterlyTarget || 0)),
          publishTarget: Math.max(0, Number(body.goals.publishTarget || 0)),
          budgetTarget: Math.max(0, Number(body.goals.budgetTarget || 0)),
          commentTarget: Math.max(0, Number(body.goals.commentTarget || 0)),
        },
        project
      );
    }
    if (body.growth) {
      const thresholds = body.growth.thresholds || {};
      await saveSetting(
        'growth',
        {
          watchKeywords: (body.growth.watchKeywords || [])
            .slice(0, 80)
            .map((item, index) => ({
              id: String(item.id || `keyword-${index}`),
              keyword: String(item.keyword || '').trim().slice(0, 60),
              scope: String(item.scope || '项目观察'),
              source: String(item.source || '项目内容库'),
              status: String(item.status || 'tracking'),
              priority: Math.max(1, Math.min(5, Number(item.priority || 3))),
            }))
            .filter((item) => item.keyword),
          inspirations: (body.growth.inspirations || [])
            .slice(0, 300)
            .map((item, index) => ({
              id: String(item.id || `idea-${index}`),
              title: String(item.title || '').trim().slice(0, 160),
              keyword: String(item.keyword || '').trim().slice(0, 60),
              stage: String(item.stage || '候选'),
              reason: String(item.reason || '').trim().slice(0, 500),
              sourceNoteId: item.sourceNoteId ? String(item.sourceNoteId) : '',
              sourceType: String(item.sourceType || '人工维护'),
              owner: String(item.owner || '').trim().slice(0, 60),
            }))
            .filter((item) => item.title),
          seedNoteIds: (body.growth.seedNoteIds || []).slice(0, 300).map(String),
          thresholds: {
            breakoutInteractions: Math.max(1, Number(thresholds.breakoutInteractions || 1000)),
            seedScore: Math.max(0, Math.min(100, Number(thresholds.seedScore || 65))),
            ctr: Math.max(0, Math.min(1, Number(thresholds.ctr || 0.15))),
            cpuv: Math.max(0, Number(thresholds.cpuv || 0.7)),
          },
        },
        project
      );
    }
    if (Array.isArray(body.pipelines)) {
      await ensureSchema();
      const d1 = db();
      for (const item of body.pipelines.slice(0, 3)) {
        await d1
          .prepare('UPDATE project_pipelines SET target_count=?,delivered_count=?,budget=?,spent=? WHERE project_id=? AND key=?')
          .bind(
            Math.max(0, Number(item.targetCount || 0)),
            Math.max(0, Number(item.deliveredCount || 0)),
            Math.max(0, Number(item.budget || 0)),
            Math.max(0, Number(item.spent || 0)),
            project,
            String(item.key || '')
          )
          .run();
      }
    }
    await logAction('更新设置', 'project_settings', '', '更新规则/目标配置', project);
    invalidateOpsCache(project);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '保存设置失败', 500);
  }
}
