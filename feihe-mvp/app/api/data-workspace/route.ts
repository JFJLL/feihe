import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { parseNumericValue } from '@/lib/numeric-values';
import { parseProjectDate } from '@/lib/date-values';
import type { DatasetQuality, DatasetUse, WorkspaceSource, SourceRun } from '@/lib/types/data-workspace';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const projectId = access.context!.projectId;
  try {
    const datasets = await getProjectDatasets(projectId);
    const d1 = db();
    const [sources, runs, legacyRuns, cards, bindings] = await Promise.all([
      d1.prepare('SELECT id,name,type,spreadsheet,sheet_id AS sheetId,range,status,last_error AS lastError,last_synced_at AS lastSyncedAt,last_row_count AS lastRowCount,sync_frequency AS syncFrequency,schedule_enabled AS scheduleEnabled,is_paused AS isPaused FROM data_sources WHERE project_id=? ORDER BY updated_at DESC').bind(projectId).all<WorkspaceSource>(),
      d1.prepare('SELECT j.id,j.source_id AS sourceId,COALESCE(s.name,j.source_id) AS sourceName,j.status,j.rows_read AS rowsRead,j.rows_imported AS rowsImported,j.rows_failed AS rowsFailed,j.error_summary AS errorSummary,j.started_at AS startedAt,j.finished_at AS finishedAt,j.request_scope AS scope,j.requested_range AS range FROM sync_jobs j LEFT JOIN data_sources s ON s.id=j.source_id AND s.project_id=j.project_id WHERE j.project_id=? ORDER BY j.started_at DESC LIMIT 100').bind(projectId).all<SourceRun>(),
      d1.prepare("SELECT j.id,'' AS sourceId,j.title AS sourceName,CASE WHEN j.status='已完成' THEN 'success' WHEN j.status='失败' THEN 'failed' ELSE 'pending' END AS status,j.total AS rowsRead,j.succeeded AS rowsImported,j.failed AS rowsFailed,j.message AS errorSummary,j.created_at AS startedAt,j.finished_at AS finishedAt FROM jobs j WHERE j.project_id=? AND j.type='feishu_sync' AND NOT EXISTS (SELECT 1 FROM sync_jobs s WHERE s.id=j.id AND s.project_id=j.project_id) ORDER BY j.created_at DESC LIMIT 100").bind(projectId).all<SourceRun>(),
      d1.prepare('SELECT id,title,config_json AS configJson FROM dashboard_cards WHERE project_id=? ORDER BY sort_order').bind(projectId).all<{ id: string; title: string; configJson: string }>(),
      d1.prepare('SELECT m.id,m.name,b.source_id AS sourceId FROM metric_definitions m JOIN metric_bindings b ON b.metric_id=m.id AND b.project_id=m.project_id WHERE m.project_id=?').bind(projectId).all<{ id: string; name: string; sourceId: string }>(),
    ]);
    const uses: DatasetUse[] = [];
    for (const card of cards.results) {
      try {
        const config = JSON.parse(card.configJson);
        const dataset = datasets.find(d => d.id === config.datasetId || d.sourceId === config.datasetId);
        if (dataset) uses.push({ id: card.id, name: card.title, kind: 'card', datasetId: dataset.id });
      } catch { /* A legacy malformed card is not advertised as a valid binding. */ }
    }
    for (const binding of bindings.results) {
      const dataset = datasets.find(d => d.sourceId === binding.sourceId || d.id === binding.sourceId);
      if (dataset && !uses.some(use => use.kind === 'metric' && use.id === binding.id && use.datasetId === dataset.id)) uses.push({ id: binding.id, name: binding.name, kind: 'metric', datasetId: dataset.id });
    }
    let quality: DatasetQuality | undefined;
    const requested = url.searchParams.get('datasetId');
    if (requested) {
      const dataset = datasets.find(d => d.id === requested);
      if (!dataset) return jsonError('数据集不存在或不属于当前项目', 404);
      const records = await d1.prepare('SELECT data_json AS dataJson FROM dataset_rows WHERE project_id=? AND dataset_id=?').bind(projectId, dataset.id).all<{ dataJson: string }>();
      const rows = records.results.map(record => JSON.parse(record.dataJson) as Record<string, unknown>);
      quality = { datasetId: dataset.id, version: dataset.version, checkedRows: rows.length, fields: dataset.columns.map(column => {
        let missing = 0, invalid = 0;
        for (const row of rows) {
          const value = row[column.key];
          if (value === null || value === undefined || String(value).trim() === '') { missing++; continue; }
          if (column.type === 'number' && parseNumericValue(value) === null
            || column.type === 'date' && parseProjectDate(value) === null
            || column.type === 'boolean' && typeof value !== 'boolean') invalid++;
        }
        return { key: column.key, name: column.name, type: column.type, missing, invalid };
      }) };
    }
    return Response.json({ ok: true, projectId, datasets, sources: sources.results.map(source => ({ ...source,
      datasetIds: datasets.filter(dataset => dataset.sourceId === source.id).map(dataset => dataset.id),
      uses: uses.filter(use => datasets.find(dataset => dataset.id === use.datasetId)?.sourceId === source.id),
    })), uses, runs: [...runs.results, ...legacyRuns.results].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 100), quality }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '数据工作台读取失败', 500); }
}
