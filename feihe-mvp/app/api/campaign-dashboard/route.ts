import { requireProjectAccess, jsonError } from "@/lib/api-auth";
import { getCampaignDashboardSnapshot } from "@/lib/campaign-store";
import { isSnapshotStale } from "@/lib/campaign-live-sync";
import { runProjectSync } from "@/lib/core/sync-runner";
import { getProjectManifest, buildProjectBoard } from "@/lib/core/registry";
import { buildBoardPayloadFromCampaignDashboard } from "@/lib/core/transform-kit";

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

  // 2. Enforce template requirement: must be campaign_review or content_marketing
  const project = access.context!.project;
  const templateId = String(project.template_id || "");
  if (templateId !== "campaign_review" && templateId !== "content_marketing") {
    return jsonError("该项目非轻量营销看板(campaign_review)模板", 400);
  }

  // 3. On-demand sync via ?fresh=1 or ?sync=1
  const shouldForceSync =
    url.searchParams.get("fresh") === "1" || url.searchParams.get("sync") === "1";
  if (shouldForceSync && access.context!.canWrite) {
    try {
      console.log(`[campaign-dashboard] On-demand live sync requested for ${projectId}...`);
      await runProjectSync(projectId, { force: true });
    } catch (syncErr) {
      console.warn(`[campaign-dashboard] On-demand sync failed:`, syncErr);
    }
  }

  // 4. Single-track board loading & output
  try {
    const snapshot = await getCampaignDashboardSnapshot(projectId);
    if (!snapshot) {
      // Try building from registry if manifest exists
      const manifest = getProjectManifest(projectId);
      if (manifest) {
        const board = await buildProjectBoard(projectId);
        if (board) {
          return Response.json({
            ok: true,
            dashboard: board,
            projectId,
            projectRole: access.context!.projectRole,
            canWrite: access.context!.canWrite,
            canManage: access.context!.canManage,
          });
        }
      }
      return jsonError("尚未接入资料", 404);
    }

    // Background non-blocking auto-sync if snapshot is older than 30 minutes
    if (isSnapshotStale(snapshot.updatedAt, 30) && !shouldForceSync) {
      runProjectSync(projectId, { force: true }).catch((err) => {
        console.error(`[campaign-dashboard] Background auto-sync error for ${projectId}:`, err);
      });
    }

    let finalDashboard: unknown = null;
    const manifest = getProjectManifest(projectId);
    if (manifest) {
      try {
        finalDashboard = await buildProjectBoard(projectId);
      } catch (err) {
        console.warn(`[campaign-dashboard] buildProjectBoard fallback for ${projectId}:`, err);
      }
    }

    if (!finalDashboard) {
      finalDashboard = buildBoardPayloadFromCampaignDashboard(
        snapshot,
        manifest || {
          id: projectId,
          name: projectId,
          brand: projectId,
        }
      );
    }

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
