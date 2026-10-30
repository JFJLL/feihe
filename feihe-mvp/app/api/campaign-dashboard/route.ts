import { requireProjectAccess, jsonError } from "@/lib/api-auth";
import { getCampaignDashboardSnapshot } from "@/lib/campaign-store";
import { getCampaignDailyDatasetsByProject } from "@/lib/campaign-daily-server";
import {
  getCampaignEnrichment,
  mergeCampaignEnrichment,
  mergeById,
} from "@/lib/campaign-enrichment-server";
import {
  triggerCampaignLiveSync,
  isSnapshotStale,
  getFreshCampaignEnrichment,
  getFreshCampaignDailyDatasets,
} from "@/lib/campaign-live-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return jsonError("缺少 projectId 参数", 400);
  }

  // 1. Authenticate user access to project (read permission required)
  const access = await requireProjectAccess(request, projectId, "read");
  if (!access.ok) {
    return jsonError(access.error || "无权访问该项目", access.status || 403);
  }

  // 2. Enforce template requirement: must be campaign_review
  const project = access.context!.project;
  const templateId = String(project.template_id || "");
  if (templateId !== "campaign_review") {
    return jsonError("该项目非轻量营销看板(campaign_review)模板", 400);
  }

  // On-demand sync via ?fresh=1 or ?sync=1
  const shouldForceSync =
    url.searchParams.get("fresh") === "1" || url.searchParams.get("sync") === "1";
  if (shouldForceSync && access.context!.canWrite) {
    try {
      console.log(`[campaign-dashboard] On-demand live sync requested for ${projectId}...`);
      await triggerCampaignLiveSync(projectId, true);
    } catch (syncErr) {
      console.warn(`[campaign-dashboard] On-demand sync failed:`, syncErr);
    }
  }

  // 3. Read snapshot from project_settings (server DB read, NOT directly from static constants)
  try {
    const snapshot = await getCampaignDashboardSnapshot(projectId);
    if (!snapshot) {
      return jsonError("尚未接入资料", 404);
    }

    // Background non-blocking auto-sync if snapshot is older than 30 minutes
    if (isSnapshotStale(snapshot.updatedAt, 30) && !shouldForceSync) {
      console.log(
        `[campaign-dashboard] Snapshot for ${projectId} is stale (last updated: ${snapshot.updatedAt}), triggering non-blocking background auto-sync...`
      );
      triggerCampaignLiveSync(projectId).catch((err) => {
        console.error(`[campaign-dashboard] Background auto-sync error for ${projectId}:`, err);
      });
    }

    // 4. Attach only this project's daily datasets (strict project isolation, server-only)
    // Retain snapshot.dailyDatasets and merge with server daily datasets using mergeById
    const serverDailyDatasets =
      getFreshCampaignDailyDatasets(projectId) ||
      getCampaignDailyDatasetsByProject(projectId) ||
      [];
    const mergedDailyDatasets = mergeById(snapshot.dailyDatasets || [], serverDailyDatasets);
    const baseDashboard = {
      ...snapshot,
      dailyDatasets: mergedDailyDatasets,
    };

    // 5. Merge project enrichment (tables, sources, dailyDatasets)
    // Server-only whitelist read; id-overwrite; no DB writes; strict isolation
    const enrichment =
      getFreshCampaignEnrichment(projectId) ||
      getCampaignEnrichment(projectId);
    const finalDashboard = mergeCampaignEnrichment(baseDashboard, enrichment);

    return Response.json({
      ok: true,
      dashboard: finalDashboard,
      projectId,
      projectRole: access.context!.projectRole,
      canWrite: access.context!.canWrite,
      canManage: access.context!.canManage,
    });
  } catch (err) {
    console.error(`[campaign-dashboard] Failed to load snapshot for ${projectId}:`, err);
    return jsonError("看板快照格式异常，请重新导入", 500);
  }
}
