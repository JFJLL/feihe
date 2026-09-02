import { env } from 'cloudflare:workers';
import { apiUser, jsonError } from '@/lib/api-auth';
import { importRows, type ImportKind, type ImportRow } from '@/lib/import-rows';
import { failJob, finishJob, logAction, startJob } from '@/lib/ops';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

function spreadsheetToken(value: string) {
  return value.match(/sheets\/([a-zA-Z0-9]+)/)?.[1] || value.trim();
}

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  let jobId = ''; let sourceId=''; let activeProject='qicui';
  try {
    const body = await request.json() as { spreadsheet?: string; sheetId?: string; range?: string; kind?: ImportKind; projectId?: string; sourceId?: string };
    const project=projectId(body.projectId);activeProject=project;sourceId=body.sourceId||'';
    if (!body.spreadsheet || !body.sheetId || !body.kind) return jsonError('请填写飞书表格链接/Token、工作表 ID 和同步类型');
    if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) return jsonError('飞书应用凭证尚未配置');
    jobId = await startJob('feishu_sync',`飞书同步：${body.kind === 'owned' ? '自有笔记' : '供应商交付'}`,0,project);
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }) });
    const tokenData = await tokenResponse.json() as { code?: number; msg?: string; tenant_access_token?: string };
    if (!tokenResponse.ok || tokenData.code || !tokenData.tenant_access_token) throw new Error(tokenData.msg || '获取飞书访问凭证失败');
    const range = `${body.sheetId}!${body.range || 'A1:AZ5000'}`;
    const valuesResponse = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken(body.spreadsheet)}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` } });
    const valuesData = await valuesResponse.json() as { code?: number; msg?: string; data?: { valueRange?: { values?: unknown[][] } } };
    if (!valuesResponse.ok || valuesData.code) throw new Error(valuesData.msg || '读取飞书表格失败');
    const values = valuesData.data?.valueRange?.values || []; const headers = (values[0] || []).map(String);
    const rows: ImportRow[] = values.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    if (!rows.length) throw new Error('指定范围内没有可同步的数据');
    const result = await importRows(body.kind,rows,true,project);
    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `同步 ${result.imported} 条` });
    await logAction('飞书表格同步',body.kind,spreadsheetToken(body.spreadsheet),`${body.sheetId} · ${result.imported} 条`,project);
    if(body.sourceId){await ensureSchema();await db().prepare(`UPDATE data_sources SET status='同步正常',last_synced_at=?,last_row_count=?,last_error='',updated_at=? WHERE id=? AND project_id=?`).bind(new Date().toISOString(),result.imported,new Date().toISOString(),body.sourceId,project).run();}
    return Response.json({ ok: true, ...result, jobId });
  } catch (error) {
    if (jobId) await failJob(jobId, error instanceof Error ? error.message : '同步失败');
    try { if(sourceId){await ensureSchema();await db().prepare(`UPDATE data_sources SET status='同步失败',last_error=?,updated_at=? WHERE id=? AND project_id=?`).bind(error instanceof Error?error.message:'同步失败',new Date().toISOString(),sourceId,activeProject).run();} } catch { /* preserve original error */ }
    return jsonError(error instanceof Error ? error.message : '同步失败', 500);
  }
}
