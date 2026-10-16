import { requireProjectAccess, jsonError } from '../../../lib/api-auth';
import { DailyError } from '../../../lib/business-daily/store';
import { saveSyncTask, syncStatus, taskAction, type SyncSpec } from '../../../lib/business-sync/store';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams, projectId = p.get('projectId') || '';
  const access = await requireProjectAccess(request, projectId);
  if (!access.ok) return jsonError(access.error!, access.status);
  try {
    const offset = Number(p.get('offset') || 0), limit = Number(p.get('limit') || 30);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new DailyError('分页参数无效');
    return Response.json({ ok: true, ...await syncStatus(projectId, offset, limit) });
  } catch (e) { return jsonError(e instanceof Error ? e.message : '同步状态读取失败', e instanceof DailyError ? e.status : 500); }
}
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try { const value = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); b = value as Record<string, unknown>; } catch { return jsonError('JSON格式无效'); }
  const access = await requireProjectAccess(request, b.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status);
  try {
    const projectId = access.context!.projectId;
    if (b.action === 'save') {
      if (typeof b.name !== 'string' || !b.spec || typeof b.spec !== 'object' || Array.isArray(b.spec)) throw new DailyError('任务名称及来源配置必填');
      return Response.json({ ok: true, ...await saveSyncTask(projectId, b.name, b.spec as SyncSpec, Number(b.intervalMinutes || 360), Number(b.expectedVersion || 0)) });
    }
    if (!['pause','resume','queue'].includes(String(b.action)) || typeof b.taskId !== 'string') throw new DailyError('同步操作无效');
    return Response.json({ ok: true, ...await taskAction(projectId, b.taskId, b.action as 'pause' | 'resume' | 'queue', String(b.requestId || ''), typeof b.from === 'string' ? b.from : undefined, typeof b.to === 'string' ? b.to : undefined) });
  } catch (e) { return jsonError(e instanceof Error ? e.message : '同步操作失败', e instanceof DailyError ? e.status : 500); }
}
