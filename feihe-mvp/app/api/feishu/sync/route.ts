import { envVar } from '@/lib/runtime-env';
import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { importRows, type ImportKind, type ImportRow } from '@/lib/import-rows';
import { failJob, finishJob, logAction, startJob } from '@/lib/ops';
import { db, ensureSchema } from '@/lib/db';
import { readFeishuData, syncFeishuSpreadsheets } from '@/lib/feishu-sync';
import { FEISHU_DOCUMENTS } from '@/lib/feishu-model';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rawProject = new URL(request.url).searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  return Response.json(await readFeishuData(project), { headers: { 'Cache-Control': 'no-store' } });
}

export function normalizeBitableValue(val: unknown): unknown {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((v) => normalizeBitableValue(v)).filter((v) => v !== '').join(', ');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.text !== undefined) return normalizeBitableValue(obj.text);
    if (obj.name !== undefined) return normalizeBitableValue(obj.name);
    if (obj.label !== undefined) return normalizeBitableValue(obj.label);
    if (obj.link !== undefined) return String(obj.link);
    if (obj.value !== undefined) return normalizeBitableValue(obj.value);
    if (obj.en_name) return String(obj.name || obj.en_name);
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }
  return String(val);
}

export function normalizeBitableFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = normalizeBitableValue(v);
  }
  return result;
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
  let body: { spreadsheet?: string; sheetId?: string; range?: string; kind?: ImportKind; projectId?: string; sourceId?: string; all?: boolean; mappingJson?: string } = {};
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
      try {
        const result = await syncFeishuSpreadsheets(project);
        return Response.json({ ...result, error: result.ok ? undefined : result.message });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : '飞书全量同步失败', 500);
      }
    } else {
      // Sync project-specific data sources
      const sourcesRes = await d1.prepare('SELECT * FROM data_sources WHERE project_id=? AND is_paused=0').bind(project).all<any>();
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
          const syncUrl = new URL(request.url);
          const singleReq = new Request(syncUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project,
              sourceId: src.id,
              spreadsheet: src.spreadsheet,
              sheetId: src.sheet_id,
              kind: src.kind,
              range: src.range,
            }),
          });
          const singleRes = await POST(singleReq);
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
    try {
      const result = await syncFeishuSpreadsheets(project);
      return Response.json({ ...result, error: result.ok ? undefined : result.message });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : '飞书全量同步失败', 500);
    }
  }

  let jobId = '';
  let sourceId = body.sourceId || '';
  let sourceName = '飞书数据源';
  const now = new Date().toISOString();

  let spreadsheet = body.spreadsheet || '';
  let sheetId = body.sheetId || '';
  let kind: ImportKind = body.kind || 'general';
  let rangeStr = body.range || 'A1:AZ5000';
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
    spreadsheet = spreadsheet || sourceRecord.spreadsheet;
    sheetId = sheetId || sourceRecord.sheet_id;
    kind = (sourceRecord.kind as ImportKind) || kind;
    rangeStr = sourceRecord.range || rangeStr;
    sourceName = sourceRecord.name || sourceName;
    sourceType = sourceRecord.type || '';
    mappingJson = mappingJson || sourceRecord.mapping_json || '';
  } else {
    if (!access.context!.canManage) {
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

    if (isBitable) {
      const bitableAppToken = resolvedToken;
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

        const items = recData.data?.items || [];
        for (const item of items) {
          if (item.fields && typeof item.fields === 'object') {
            rows.push(normalizeBitableFields(item.fields));
          }
        }

        if (rows.length > MAX_BITABLE_ROWS) {
          throw new Error(`多维表格记录数超过单次同步上限 (${MAX_BITABLE_ROWS} 行)，请缩减数据范围`);
        }

        hasMore = Boolean(recData.data?.has_more);
        pageToken = recData.data?.page_token || '';
        if (hasMore && !pageToken) break;
      }
    } else {
      const realSpreadsheetToken = resolvedToken;
      const range = `${sheetId}!${rangeStr}`;
      const valuesResponse = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${realSpreadsheetToken}/values/${encodeURIComponent(range)}`, {
        headers: { Authorization: `Bearer ${tenantToken}` },
      });
      const valuesData = (await valuesResponse.json()) as { code?: number; msg?: string; data?: { valueRange?: { values?: unknown[][] } } };
      if (!valuesResponse.ok || valuesData.code) {
        throw new Error(valuesData.msg || '读取飞书表格失败');
      }

      const values = valuesData.data?.valueRange?.values || [];
      const headers = (values[0] || []).map(String);
      rows = values
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? '').trim()))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    }

    if (!rows.length) throw new Error('指定范围内没有可同步的数据');

    const result = await importRows(kind, rows, true, project, sourceId || 'feishu_sync', sourceName, mappingJson);

    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `同步 ${result.imported} 条` });
    await logAction('飞书表格同步', kind, resolvedToken, `${sheetId} · ${result.imported} 条`, project);

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

    return Response.json({ ok: true, ...result, jobId, rowsRead: rows.length });
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
