import { requireProjectAccess, jsonError } from "@/lib/api-auth";
import { db, ensureSchema } from "@/lib/db";
import { getProjectDatasets, saveDataset, type DatasetColumn } from "@/lib/datasets";
import { logAction } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawProject = url.searchParams.get("projectId");
  const access = await requireProjectAccess(request, rawProject, "read");
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const datasetId = url.searchParams.get("id");
  const datasets = await getProjectDatasets(project);

  if (datasetId) {
    const target = datasets.find((d) => d.id === datasetId);
    if (!target) return jsonError("数据集不存在", 404);

    await ensureSchema();
    const d1 = db();

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(url.searchParams.get("pageSize") || "15", 10)));
    const search = String(url.searchParams.get("search") || "").trim();
    const all = url.searchParams.get("all") === "true";
    const offset = (page - 1) * pageSize;

    let total = target.rowCount;
    let queryResults: Array<{ rowKey: string; dataJson: string }> = [];

    if (search) {
      const countRes = await d1
        .prepare("SELECT COUNT(*) AS total FROM dataset_rows WHERE dataset_id=? AND data_json LIKE ?")
        .bind(datasetId, "%" + search + "%")
        .first<{ total: number }>();
      total = Number(countRes?.total || 0);

      const rows = await d1
        .prepare("SELECT row_key AS rowKey, data_json AS dataJson FROM dataset_rows WHERE dataset_id=? AND data_json LIKE ? ORDER BY rowid ASC LIMIT ? OFFSET ?")
        .bind(datasetId, "%" + search + "%", pageSize, offset)
        .all<{ rowKey: string; dataJson: string }>();
      queryResults = rows.results || [];
    } else if (all) {
      const rows = await d1
        .prepare("SELECT row_key AS rowKey, data_json AS dataJson FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC")
        .bind(datasetId)
        .all<{ rowKey: string; dataJson: string }>();
      queryResults = rows.results || [];
      total = queryResults.length;
    } else {
      const countRes = await d1
        .prepare("SELECT COUNT(*) AS total FROM dataset_rows WHERE dataset_id=?")
        .bind(datasetId)
        .first<{ total: number }>();
      total = Number(countRes?.total ?? target.rowCount);

      const rows = await d1
        .prepare("SELECT row_key AS rowKey, data_json AS dataJson FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC LIMIT ? OFFSET ?")
        .bind(datasetId, pageSize, offset)
        .all<{ rowKey: string; dataJson: string }>();
      queryResults = rows.results || [];
    }

    const parsedRows = queryResults.map((r) => {
      try {
        return JSON.parse(r.dataJson);
      } catch {
        return {};
      }
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return Response.json({
      ok: true,
      dataset: {
        ...target,
        rowCount: target.rowCount || total,
        rows: parsedRows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          currentPageRows: parsedRows.length,
        },
      },
    });
  }

  return Response.json({ ok: true, datasets });
}

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    sourceId?: string;
    name?: string;
    rows?: Array<Record<string, unknown>>;
    columns?: DatasetColumn[];
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("无效的请求体");
  }

  const access = await requireProjectAccess(request, body.projectId, "write");
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return jsonError("没有可导入的数据行");

  try {
    const sourceId = body.sourceId || "manual_import";
    const name = body.name || "通用业务数据集";
    const saved = await saveDataset(project, sourceId, name, rows, body.columns);

    await logAction("导入数据集", "dataset", saved.id, name + " · 导入 " + rows.length + " 行", project);
    return Response.json({ ok: true, dataset: saved });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "保存数据集失败", 500);
  }
}
