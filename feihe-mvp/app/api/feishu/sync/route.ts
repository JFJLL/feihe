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

async function resolveSpreadsheetToken(value: string, token: string): Promise<string> {
  const wikiMatch = value.match(/wiki\/([a-zA-Z0-9]+)/);
  if (wikiMatch) {
    const wikiToken = wikiMatch[1];
    try {
      const nodeRes = await fetch('https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=' + wikiToken, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const nodeData = (await nodeRes.json()) as { data?: { node?: { obj_token?: string } } };
      if (nodeData.data?.node?.obj_token) return nodeData.data.node.obj_token;
    } catch {}
  }
  const sheetMatch = value.match(/sheets\/([a-zA-Z0-9]+)/);
  if (sheetMatch) return sheetMatch[1];
  return value.trim();
}

export async function POST(request: Request) {
  let body: { spreadsheet?: string; sheetId?: string; range?: string; kind?: ImportKind; projectId?: string; sourceId?: string; all?: boolean } = {};
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

  // 如果用户请求同步启萃全部飞书文档（一键更新）
  if (body.all || FEISHU_DOCUMENTS.some((d) => d.id === body.sourceId) || (!body.spreadsheet && !body.sheetId && !body.sourceId)) {
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
  let realSpreadsheetToken = '';
  const now = new Date().toISOString();

  // If sourceId is provided, enforce that the source belongs to the project
  let spreadsheet = body.spreadsheet || '';
  let sheetId = body.sheetId || '';
  let kind: ImportKind = body.kind || 'owned';
  let rangeStr = body.range || 'A1:AZ5000';

  if (sourceId) {
    const sourceRecord = await d1.prepare('SELECT * FROM data_sources WHERE id=? AND project_id=?').bind(sourceId, project).first<{
      spreadsheet: string;
      sheet_id: string;
      kind: string;
      range: string;
    }>();
    if (!sourceRecord) {
      return jsonError('数据源不存在或不属于当前项目', 404);
    }
    spreadsheet = spreadsheet || sourceRecord.spreadsheet;
    sheetId = sheetId || sourceRecord.sheet_id;
    kind = (sourceRecord.kind as ImportKind) || kind;
    rangeStr = sourceRecord.range || rangeStr;
    sourceName = (sourceRecord as any).name || sourceName;
  } else {
    // If setting up ad-hoc spreadsheet without registered source, require manage permission
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
    jobId = await startJob('feishu_sync', `飞书同步：${kind === 'owned' ? '自有笔记' : '供应商交付'}`, 0, project);
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: envVar('FEISHU_APP_ID'), app_secret: envVar('FEISHU_APP_SECRET') }),
    });
    const tokenData = (await tokenResponse.json()) as { code?: number; msg?: string; tenant_access_token?: string };
    if (!tokenResponse.ok || tokenData.code || !tokenData.tenant_access_token) {
      throw new Error(tokenData.msg || '获取飞书访问凭证失败');
    }

    const bitableMatch = spreadsheet.match(/(?:base|bitable)\/([a-zA-Z0-9_-]+)/);
    const isBitable = Boolean(bitableMatch) || String(sourceId).includes("bitable");
    let rows: ImportRow[] = [];

    if (isBitable) {
      const bitableAppToken = bitableMatch ? bitableMatch[1] : await resolveSpreadsheetToken(spreadsheet, tokenData.tenant_access_token);
      let pageToken = "";
      let hasMore = true;

      while (hasMore && rows.length < 5000) {
        const pageUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${bitableAppToken}/tables/${sheetId}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ""}`;
        const recRes = await fetch(pageUrl, {
          headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` },
        });
        const recData = (await recRes.json()) as { code?: number; msg?: string; data?: { has_more?: boolean; page_token?: string; items?: Array<{ fields?: Record<string, unknown> }> } };
        if (!recRes.ok || recData.code) {
          throw new Error(recData.msg || "读取飞书多维表格记录失败");
        }
        for (const item of recData.data?.items || []) {
          if (item.fields && typeof item.fields === "object") {
            rows.push(item.fields);
          }
        }
        hasMore = Boolean(recData.data?.has_more);
        pageToken = recData.data?.page_token || "";
      }
    } else {
      realSpreadsheetToken = await resolveSpreadsheetToken(spreadsheet, tokenData.tenant_access_token);
      const range = `${sheetId}!${rangeStr}`;
      const valuesResponse = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${realSpreadsheetToken}/values/${encodeURIComponent(range)}`, {
        headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` },
      });
      const valuesData = (await valuesResponse.json()) as { code?: number; msg?: string; data?: { valueRange?: { values?: unknown[][] } } };
      if (!valuesResponse.ok || valuesData.code) {
        throw new Error(valuesData.msg || "读取飞书表格失败");
      }

      const values = valuesData.data?.valueRange?.values || [];
      const headers = (values[0] || []).map(String);
      rows = values
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    }

    if (!rows.length) throw new Error('指定范围内没有可同步的数据');

    const result = await importRows(kind, rows, true, project, sourceId || 'feishu_sync', sourceName);

    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `同步 ${result.imported} 条` });
    await logAction('飞书表格同步', kind, realSpreadsheetToken, `${sheetId} · ${result.imported} 条`, project);

    if (sourceId) {
      await d1
        .prepare(`UPDATE data_sources SET status='已连接', last_synced_at=?, last_row_count=?, last_error='', updated_at=? WHERE id=? AND project_id=?`)
        .bind(now, result.imported, now, sourceId, project)
        .run();
    }

    // Record sync job execution
    await d1
      .prepare(`INSERT OR REPLACE INTO sync_jobs(id, project_id, source_id, status, rows_read, rows_imported, rows_failed, error_summary, started_at, finished_at) VALUES(?, ?, ?, 'success', ?, ?, ?, '', ?, ?)`)
      .bind(jobId || `sync-${Date.now()}`, project, sourceId || 'default', rows.length, result.imported, result.skipped, now, new Date().toISOString())
      .run();

    return Response.json({ ok: true, ...result, jobId });
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
