import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { getCampaignDashboardSnapshot } from '@/lib/campaign-store';
import { getCampaignDailyDatasetsByProject } from '@/lib/campaign-daily-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return jsonError('缺少 projectId 参数', 400);
  }

  // 1. Authenticate user access to project (read permission required)
  const access = await requireProjectAccess(request, projectId, 'read');
  if (!access.ok) {
    return jsonError(access.error || '无权访问该项目', access.status || 403);
  }

  // 2. Enforce template requirement: must be campaign_review
  const project = access.context!.project;
  const templateId = String(project.template_id || '');
  if (templateId !== 'campaign_review') {
    return jsonError('该项目非轻量营销看板(campaign_review)模板', 400);
  }

  // 3. Read snapshot from project_settings (server DB read, NOT directly from static constants)
  try {
    const snapshot = await getCampaignDashboardSnapshot(projectId);
    if (!snapshot) {
      return jsonError('尚未接入资料', 404);
    }

    // 4. Attach only this project's daily datasets (strict project isolation, server-only)
    const dailyDatasets = getCampaignDailyDatasetsByProject(projectId);
    const enrichedDashboard = {
      ...snapshot,
      dailyDatasets,
    };

    return Response.json({
      ok: true,
      dashboard: enrichedDashboard,
      projectId,
      projectRole: access.context!.projectRole,
      canWrite: access.context!.canWrite,
      canManage: access.context!.canManage,
    });
  } catch (err) {
    console.error(`[campaign-dashboard] Failed to load snapshot for ${projectId}:`, err);
    return jsonError('看板快照格式异常，请重新导入', 500);
  }
}
