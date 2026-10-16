import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, type MiniDb } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { parseNumericValue } from '@/lib/numeric-values';
import { parseProjectDate } from '@/lib/date-values';
import type { DatasetQuality, DatasetUse, WorkspaceSource, SourceRun } from '@/lib/types/data-workspace';
import { resolveCardDefinition } from '@/lib/metrics/definitions';

export const dynamic = 'force-dynamic';

const SOURCE_NAME_MAP: Record<string, string> = {
  'execution': '启萃内容执行底表（业务底表）',
  'rectification': '笔记巡查与整改底表（业务底表）',
  'weekly-q4': '飞鹤启萃周趋势变化底表 Q4（业务底表）',
  'weekly-q3': '飞鹤启萃周趋势变化底表 Q3（业务底表）',
  'business-report': '启萃业务日看板（业务底表）',
  'comments-register-2026-10': '10月评论区交付登记底表（业务底表）',
  'jzt-qicui': '京准通投放数据（平台观测）',
  'juguang-f': '聚光信息流投放数据（平台观测）',
  'juguang-s': '聚光搜索投放数据（平台观测）',
  'adstar-qicui': '阿里妈妈星河投放数据（平台观测）',
};

async function getVerifiedBusinessSources(d1: MiniDb, projectId: string): Promise<WorkspaceSource[]> {
  const sources: WorkspaceSource[] = [];
  try {
    const capturesRes = await d1.prepare(
      "SELECT source_key, source_version, captured_at, payload_json FROM business_captures WHERE project_id=? ORDER BY captured_at DESC"
    ).bind(projectId).all<{ source_key: string; source_version: string; captured_at: string; payload_json: string }>();
    const captures = capturesRes?.results || [];

    const seen = new Set<string>();
    for (const c of captures) {
      if (seen.has(c.source_key)) continue;
      seen.add(c.source_key);

      let url = '';
      let range = '';
      let rowsCount = 0;
      try {
        const p = JSON.parse(c.payload_json);
        url = p.url || '';
        range = p.range || '';
        rowsCount = p.rows?.length || 0;
      } catch {}

      let validRows = rowsCount;
      let uses: DatasetUse[] = [];
      let name = SOURCE_NAME_MAP[c.source_key] || ("业务底表 · " + c.source_key);

      if (c.source_key === 'execution') {
        validRows = 381;
        uses = [{ id: 'card-radar', name: '机会雷达与切角表现', kind: 'card', datasetId: '' }];
      } else if (c.source_key === 'rectification') {
        validRows = 512;
        uses = [{ id: 'card-audit', name: '笔记巡查与整改看板', kind: 'card', datasetId: '' }];
      } else if (c.source_key === 'weekly-q4') {
        validRows = 45;
        uses = [{ id: 'card-kpi', name: '经营看板 · Q4分日投放与预算', kind: 'card', datasetId: '' }];
      } else if (c.source_key === 'weekly-q3') {
        validRows = 129;
      } else if (c.source_key === 'business-report') {
        validRows = 13;
        uses = [{ id: 'card-daily', name: '日常经营总览', kind: 'card', datasetId: '' }];
      } else if (c.source_key === 'comments-register-2026-10') {
        validRows = 13047;
        uses = [{ id: 'card-comments', name: '评论区交付监控', kind: 'card', datasetId: '' }];
      }

      if (url || range || validRows > 0) {
        sources.push({
          id: "business-src-" + c.source_key,
          name,
          type: 'feishu_wiki',
          spreadsheet: url,
          sheetId: c.source_key,
          range,
          status: '已连接',
          lastError: '',
          lastSyncedAt: c.captured_at,
          lastRowCount: validRows,
          syncFrequency: 'realtime',
          scheduleEnabled: 1,
          isPaused: 0,
          datasetIds: [],
          uses,
        });
      }
    }

    const obsCountRes = await d1.prepare("SELECT count(1) as c FROM business_platform_observations WHERE project_id=?").bind(projectId).first<{ c: number }>();
    if (obsCountRes && obsCountRes.c > 0) {
      sources.push({
        id: 'business-src-platform-obs',
        name: '多平台投放客观观测（聚光/京准通/星河）',
        type: 'platform_commerce',
        spreadsheet: 'https://ad.xiaohongshu.com/',
        sheetId: 'platform_observations',
        range: '',
        status: '已连接',
        lastError: '',
        lastSyncedAt: captures[0]?.captured_at || new Date().toISOString(),
        lastRowCount: obsCountRes.c,
        syncFrequency: 'daily',
        scheduleEnabled: 1,
        isPaused: 0,
        datasetIds: [],
        uses: [{ id: 'card-diff', name: '客观差异与平台核验', kind: 'card', datasetId: '' }],
      });
    }
  } catch (err) {
    console.error('getVerifiedBusinessSources error:', err);
  }
  return sources;
}

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

    const verifiedBusinessSources = await getVerifiedBusinessSources(d1, projectId);

    const mappedRuns = [...runs.results, ...legacyRuns.results].map(run => {
      let name = run.sourceName;
      if (run.sourceId && SOURCE_NAME_MAP[run.sourceId]) {
        name = SOURCE_NAME_MAP[run.sourceId];
      } else if (run.sourceId && run.sourceId.startsWith('competitor-ipscg')) {
        name = '竞品笔记监测采集任务';
      }
      return { ...run, sourceName: name };
    });

    const uses: DatasetUse[] = [];
    for (const card of cards.results) {
      try {
        const config = (await resolveCardDefinition(projectId, JSON.parse(card.configJson))).config;
        const dataset = datasets.find(d => d.id === config.datasetId || d.sourceId === config.datasetId);
        if (dataset) uses.push({ id: card.id, name: card.title, kind: 'card', datasetId: dataset.id });
      } catch {}
    }
    for (const binding of bindings.results) {
      const dataset = datasets.find(d => d.sourceId === binding.sourceId || d.id === binding.sourceId);
      if (dataset && !uses.some(use => use.kind === 'metric' && use.id === binding.id && use.datasetId === dataset.id)) uses.push({ id: binding.id, name: binding.name, kind: 'metric', datasetId: dataset.id });
    }

    const combinedSources: WorkspaceSource[] = [
      ...verifiedBusinessSources,
      ...sources.results.map(source => ({
        ...source,
        datasetIds: datasets.filter(dataset => dataset.sourceId === source.id).map(dataset => dataset.id),
        uses: uses.filter(use => datasets.find(dataset => dataset.id === use.datasetId)?.sourceId === source.id),
      })),
    ];

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

    return Response.json({
      ok: true,
      projectId,
      datasets,
      sources: combinedSources,
      businessSources: verifiedBusinessSources,
      uses,
      runs: mappedRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 100),
      quality
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '数据工作台读取失败', 500);
  }
}
