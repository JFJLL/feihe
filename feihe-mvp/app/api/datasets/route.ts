import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { getProjectDatasets, saveDataset, type DatasetColumn } from '@/lib/datasets';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawProject = url.searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const datasetId = url.searchParams.get('id');
  const datasets = await getProjectDatasets(project);

  if (datasetId) {
    const target = datasets.find((d) => d.id === datasetId);
    if (!target) return jsonError('数据集不存在', 404);

    await ensureSchema();
    const d1 = db();
    const rows = await d1
      .prepare('SELECT row_key AS rowKey, data_json AS dataJson FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC LIMIT 500')
      .bind(datasetId)
      .all<{ rowKey: string; dataJson: string }>();

    const parsedRows = (rows.results || []).map((r) => {
      try {
        return JSON.parse(r.dataJson);
      } catch {
        return {};
      }
    });

    return Response.json({
      ok: true,
      dataset: { ...target, rows: parsedRows },
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
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return jsonError('没有可导入的数据行');

  try {
    const sourceId = body.sourceId || 'manual_import';
    const name = body.name || '通用业务数据集';
    const saved = await saveDataset(project, sourceId, name, rows, body.columns);

    await logAction('导入数据集', 'dataset', saved.id, `${name} · 导入 ${rows.length} 行`, project);
    return Response.json({ ok: true, dataset: saved });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : '保存数据集失败', 500);
  }
}
