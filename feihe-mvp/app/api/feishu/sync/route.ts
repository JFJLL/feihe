import { envVar } from '@/lib/runtime-env';
import { requireProjectAccess, jsonError, type ProjectAuthContext } from '@/lib/api-auth';
import { importRows, type ImportKind, type ImportRow } from '@/lib/import-rows';
import { failJob, finishJob, logAction, startJob } from '@/lib/ops';
import { db, ensureSchema } from '@/lib/db';
import { readFeishuData, syncFeishuSpreadsheets } from '@/lib/feishu-sync';
import { FEISHU_DOCUMENTS } from '@/lib/feishu-model';
import { inspectFeishuSpreadsheet, inspectFeishuBitableFields } from '@/lib/feishu-detector';
import { normalizeBitableFields, spreadsheetColumn } from '@/lib/feishu-values';
export { normalizeBitableValue, normalizeBitableFields } from '@/lib/feishu-values';
import type { MappingContext } from '@/lib/field-mapping';
type SyncBody = { spreadsheet?: string; sheetId?: string; range?: string; kind?: ImportKind; projectId?: string; sourceId?: string; all?: boolean; mappingJson?: string };

export const dynamic = 'force-dynamic';

async function syncHistoricalSources(context: ProjectAuthContext) {
  if (!context.canWrite) return jsonError('权限不足：只读成员不可同步', 403);
  try {
    const result = await syncFeishuSpreadsheets(context.projectId);
    await logAction('飞书历史表格同步', 'qicui', context.projectId, result.message, context.projectId, context.user.userId);
    return Response.json({ ...result, actorUserId: context.user.userId, error: result.ok ? undefined : result.message });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '飞书全量同步失败', 500);
  }
}

export async function GET(request: Request) {
  const rawProject = new URL(request.url).searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  return Response.json(await readFeishuData(project), { headers: { 'Cache-Control': 'no-store' } });
}

async function resolveWikiNode(wikiToken: string, token: string): Promise<{ obj_type: string; obj_token: string } | null> {
  try {
    const nodeRes = await fetch('https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=' + wikiToken, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const nodeData = (await nodeRes.json()) as { data?: { node?: { obj_type?: string; obj_token?: string } } };
    if (nodeData.data?.node?.obj_token) {
      return {
        obj_type: nodeData.data.node.obj_type || 'sheet',
        obj_token: nodeData.data.node.obj_token,
      };
    }
  } catch {}
  return null;
}

async function fetchAccessToken(): Promise<string> {
  const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: envVar('FEISHU_APP_ID'), app_secret: envVar('FEISHU_APP_SECRET') }),
  });
  const tokenData = (await tokenResponse.json()) as { code?: number; msg?: string; tenant_access_token?: string };
  if (!tokenResponse.ok || tokenData.code || !tokenData.tenant_access_token) {
    throw new Error(tokenData.msg || '获取飞书访问凭证失败');
  }
  return tokenData.tenant_access_token;
}

export async function POST(request: Request) {
  let body: SyncBody = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  await ensureSchema();
  const d1 = db();

  // Top Bar or Full Project Sync
  if (body.all) {
    if (project === 'qicui') {
      return syncHistoricalSources(access.context!);
    } else {
      // Sync project-specific data sources
      const sourcesRes = await d1.prepare('SELECT * FROM data_sources WHERE project_id=? AND is_paused=0').bind(project).all<{ id: string; name: string }>();
      const sourcesList = sourcesRes.results || [];
      if (sourcesList.length === 0) {
        return Response.json({
          ok: false,
          needSetup: true,
          message: '当前项目尚未配置数据源，请前往「设置 - 数据源」绑定飞书表格',
        });
      }

      let totalImported = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const src of sourcesList) {
        try {
          const singleRes = await syncSingleSource(access.context!, { projectId: project, sourceId: src.id });
          const singleData = (await singleRes.json()) as { ok?: boolean; imported?: number; error?: string };
          if (singleData.ok) {
            totalImported += singleData.imported || 0;
          } else {
            failedCount++;
            errors.push(`${src.name}: ${singleData.error || '同步失败'}`);
          }
        } catch (err) {
          failedCount++;
          errors.push(`${src.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const allOk = failedCount === 0;
      return Response.json({
        ok: allOk,
        importedNotes: totalImported,
        sourcesUpdated: sourcesList.length - failedCount,
        errors: errors.length ? errors : undefined,
        message: allOk
          ? `已成功同步当前项目全部 ${sourcesList.length} 个数据源，共计读取 ${totalImported} 行数据`
          : `部分数据源同步异常 (${failedCount}/${sourcesList.length})：${errors.join('；')}`,
      });
    }
  }

  // Legacy Qicui built-in source fallback
  if (FEISHU_DOCUMENTS.some((d) => d.id === body.sourceId) || (!body.spreadsheet && !body.sheetId && !body.sourceId && project === 'qicui')) {
    return syncHistoricalSources(access.context!);
  }

  return syncSingleSource(access.context!, body);
}

export async function syncSingleSource(context: ProjectAuthContext, body: SyncBody) {
  const project = context.projectId;
  if (!context.canWrite) return jsonError('权限不足：只读成员不可同步', 403);
  await ensureSchema();
  const d1 = db();
  let jobId = '';
  const sourceId = body.sourceId || '';
  let sourceName = '飞书数据源';
  const now = new Date().toISOString();

  let spreadsheet = body.spreadsheet || '';
  let sheetId = body.sheetId || '';
  let kind: ImportKind = body.kind || 'general';
  let rangeStr = body.range || '';
  let mappingJson = body.mappingJson || '';
  let sourceType = '';

  if (sourceId) {
    const sourceRecord = await d1.prepare('SELECT * FROM data_sources WHERE id=? AND project_id=?').bind(sourceId, project).first<{
      spreadsheet: string;
      sheet_id: string;
      kind: string;
      range: string;
      name: string;
      type: string;
      mapping_json: string;
    }>();
    if (!sourceRecord) {
      return jsonError('数据源不存在或不属于当前项目', 404);
    }
    spreadsheet = sourceRecord.spreadsheet;
    sheetId = sourceRecord.sheet_id;
    kind = (sourceRecord.kind as ImportKind) || kind;
    rangeStr = sourceRecord.range || '';
    sourceName = sourceRecord.name || sourceName;
    sourceType = sourceRecord.type || '';
    mappingJson = sourceRecord.mapping_json || '';
  } else {
    if (!context.canManage) {
      return jsonError('仅项目管理员可直接配置外部表格链接', 403);
    }
  }

  if (!spreadsheet || !sheetId) {
    return jsonError('请填写飞书表格链接/Token与工作表 ID');
  }

  if (!envVar('FEISHU_APP_ID') || !envVar('FEISHU_APP_SECRET')) {
    return jsonError('飞书应用凭证尚未配置');
  }

  try {
    const tenantToken = await fetchAccessToken();
    jobId = await startJob('feishu_sync', `飞书同步：${sourceName}`, 0, project);

    // Resolve document type and token
    let isBitable = sourceType === 'feishu_bitable' || spreadsheet.includes('/base/') || spreadsheet.includes('/bitable/');
    let resolvedToken = '';

    const wikiMatch = spreadsheet.match(/wiki\/([a-zA-Z0-9_-]+)/);
    if (wikiMatch) {
      const node = await resolveWikiNode(wikiMatch[1], tenantToken);
      if (node) {
        resolvedToken = node.obj_token;
        if (node.obj_type === 'bitable') isBitable = true;
      }
    }

    if (!resolvedToken) {
      const bitableMatch = spreadsheet.match(/(?:base|bitable)\/([a-zA-Z0-9_-]+)/);
      if (bitableMatch) {
        resolvedToken = bitableMatch[1];
        isBitable = true;
      } else {
        const sheetMatch = spreadsheet.match(/sheets\/([a-zA-Z0-9_-]+)/);
        resolvedToken = sheetMatch ? sheetMatch[1] : spreadsheet.trim();
      }
    }

    let rows: ImportRow[] = [];
    let sourceSchema: Array<{ key: string; type: string }> | undefined;

    if (isBitable) {
      const bitableAppToken = resolvedToken;
      sourceSchema = await inspectFeishuBitableFields(bitableAppToken, sheetId, tenantToken);
      let pageToken = '';
      let hasMore = true;
      const visitedTokens = new Set<string>();
      const MAX_BITABLE_ROWS = 50000;

      while (hasMore) {
        if (pageToken) {
          if (visitedTokens.has(pageToken)) {
            throw new Error(`检测到多维表格分页重复死循环 (page_token: ${pageToken})`);
          }
          visitedTokens.add(pageToken);
        }

        const pageUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${bitableAppToken}/tables/${sheetId}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
        const recRes = await fetch(pageUrl, {
          headers: { Authorization: `Bearer ${tenantToken}` },
        });
        const recData = (await recRes.json()) as {
          code?: number;
          msg?: string;
          data?: {
            has_more?: boolean;
            page_token?: string;
            items?: Array<{ fields?: Record<string, unknown> }>;
          };
        };

        if (!recRes.ok || recData.code) {
          throw new Error(recData.msg || '读取飞书多维表格记录失败');
        }

        if (!recData.data || !Array.isArray(recData.data.items) || typeof recData.data.has_more !== 'boolean') throw new Error('多维表格分页响应缺少完整性标记，保留旧快照');
        if (recData.data.has_more && !recData.data.page_token) throw new Error('多维表格分页不完整：has_more=true 但缺少 page_token，保留旧快照');
        const items = recData.data.items;
        for (const item of items) {
          if (!item.fields || typeof item.fields !== 'object') throw new Error('多维表格记录缺少字段，保留旧快照');
          const normalized = normalizeBitableFields(item.fields);
          if (Object.keys(normalized).some(key => !sourceSchema?.some(f => f.key === key))) throw new Error('多维表格记录与字段结构不一致');
          rows.push(Object.fromEntries(sourceSchema.map(f => [f.key, normalized[f.key] ?? null])));
        }

        if (rows.length > MAX_BITABLE_ROWS) {
          throw new Error(`多维表格记录数超过单次同步上限 (${MAX_BITABLE_ROWS} 行)，请缩减数据范围`);
        }

        hasMore = Boolean(recData.data?.has_more);
        pageToken = recData.data?.page_token || '';
        if (hasMore && !pageToken) throw new Error('多维表格分页不完整：has_more=true 但缺少 page_token，保留旧快照');
      }
    } else {
      const realSpreadsheetToken = resolvedToken;
      const meta = await inspectFeishuSpreadsheet(realSpreadsheetToken, tenantToken);
      const sheet = meta.sheets.find(s => s.sheetId === sheetId);
      if (!sheet) throw new Error('工作表不存在，请重新检测链接');
      const ranges: string[] = [];
      if (rangeStr) ranges.push(rangeStr);
      else {
        if (!sheet.rowCount || !sheet.columnCount) throw new Error('缺少工作表行列总数，无法确认全表完整性');
        for (let start = 1; start <= sheet.rowCount; start += 1000) ranges.push('A' + start + ':' + spreadsheetColumn(sheet.columnCount) + Math.min(sheet.rowCount, start + 999));
      }
      const values: unknown[][] = [];
      for (const rangePart of ranges) {
        const range = sheetId + '!' + rangePart;
        const response = await fetch('https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/' + realSpreadsheetToken + '/values/' + encodeURIComponent(range), { headers: { Authorization: 'Bearer ' + tenantToken } });
        const data = await response.json() as { code?: number; msg?: string; data?: { valueRange?: { values?: unknown[][] } } };
        if (!response.ok || data.code || !data.data?.valueRange || !Array.isArray(data.data.valueRange.values)) throw new Error(data.msg || '电子表格范围读取不完整，保留旧快照');
        values.push(...data.data.valueRange.values);
      }
      const headers = (values[0] || []).map(String);
      if (!headers.length || headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) throw new Error('工作表表头为空或重名，请修正后同步');
      rows = values.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    }

    if (!rows.length) throw new Error('指定范围内没有可同步的数据');

    if (mappingJson) {
      const saved = JSON.parse(mappingJson) as { context?: MappingContext };
      if (saved.context) {
        const context = saved.context;
        const actualKeys = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
        const expectedKeys = context.fields.map(f => f.key).sort();
        if (context.projectId !== project || context.documentToken !== resolvedToken || context.sheetId !== sheetId || JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys) || (sourceSchema && context.fields.some(f => sourceSchema?.find(s => s.key === f.key)?.type !== f.type))) throw new Error('映射上下文或字段结构已变化，请重新检测并确认映射');
      }
    }
    const result = await importRows(kind, rows, true, project, sourceId || 'feishu_sync', sourceName, mappingJson);

    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `同步 ${result.imported} 条` });
    await logAction('飞书表格同步', kind, resolvedToken, `${sheetId} · ${result.imported} 条`, project, context.user.userId);

    if (sourceId) {
      await d1
        .prepare(`UPDATE data_sources SET status='已连接', last_synced_at=?, last_row_count=?, last_error='', updated_at=? WHERE id=? AND project_id=?`)
        .bind(now, result.imported, now, sourceId, project)
        .run();
    }

    await d1
      .prepare(`INSERT OR REPLACE INTO sync_jobs(id, project_id, source_id, status, rows_read, rows_imported, rows_failed, error_summary, started_at, finished_at) VALUES(?, ?, ?, 'success', ?, ?, ?, '', ?, ?)`)
      .bind(jobId || `sync-${Date.now()}`, project, sourceId || 'default', rows.length, result.imported, result.skipped, now, new Date().toISOString())
      .run();

    return Response.json({ ok: true, ...result, jobId, rowsRead: rows.length, scope: rangeStr ? 'limited_range' : 'full_table', range: rangeStr || undefined, actorUserId: context.user.userId });
  } catch (error) {
    if (jobId) await failJob(jobId, error instanceof Error ? error.message : '同步失败');
    if (sourceId) {
      try {
        await d1
          .prepare(`UPDATE data_sources SET status='同步失败', last_error=?, updated_at=? WHERE id=? AND project_id=?`)
          .bind(error instanceof Error ? error.message : '同步失败', now, sourceId, project)
          .run();
      } catch {}
    }
    return jsonError(error instanceof Error ? error.message : '同步失败', 500);
  }
}
