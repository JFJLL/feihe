import { requireProjectAccess, jsonError } from '../../../lib/api-auth';
import { confirmDaily, configureBusiness, businessConfig, DailyError, readDaily, sourceRows, dailySummary, dailyDetail, currentBundle, type BusinessConfig } from '../../../lib/business-daily/store';
import { documentDays, weeklyPoints } from '../../../lib/business-daily/adapter';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams, projectId = p.get('projectId') || '';
  const access = await requireProjectAccess(request, projectId);
  if (!access.ok) return jsonError(access.error!, access.status);
  try {
    if (p.get('action') === 'config') {
      return Response.json({ ok: true, config: await businessConfig(projectId), canWrite: access.context!.canWrite });
    }
    if (p.has('sourceKey')) {
      const offset = Number(p.get('offset') || 0), limit = Number(p.get('limit') || 50);
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new DailyError('分页参数无效');
      return Response.json({ ok: true, ...await sourceRows(projectId, p.get('sourceKey')!, offset, limit, p.get('captureId') || undefined) });
    }
    let day = p.get('day');
    if (!day) {
      const bundle = await currentBundle(projectId, true);
      const narrativeDays = documentDays(bundle.document);
      const latestReportDay = [...narrativeDays.keys()].sort().at(-1) || null;
      const weeklyDays = bundle.tables.filter(s => s.role === 'weekly').flatMap(weeklyPoints).filter(p => p.adSpend.value !== null).map(p => p.date).sort();
      const latestCompleteDay = weeklyDays.at(-1) || null;
      day = latestReportDay || latestCompleteDay || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    }
    const rawView = await readDaily(projectId, day, p.get('mode') || 'latest', p.get('from') || undefined, p.get('to') || undefined);
    if (p.has('part')) return Response.json({ ok: true, ...dailyDetail(rawView, p.get('part')!, p.get('tableTitle') || '', Number(p.get('offset') || 0), Number(p.get('limit') || 20), p.get('fingerprint') || '') });
    const sum = dailySummary(rawView);
    const view = p.get('summary') === '1' ? sum : { ...rawView, highlights: sum.highlights, sectionMetadata: sum.sectionMetadata, noteCount: sum.noteCount };
    return Response.json({ ok: true, view });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '日报读取失败', error instanceof DailyError ? error.status : 400); }
}
export async function POST(request: Request) {
  let body: Record<string, unknown>; try { const value = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; } catch { return jsonError('无效JSON'); }
  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status);
  try {
    if (body.action === 'configure') {
      const conf = body.config as BusinessConfig;
      if (!conf || typeof conf !== 'object') throw new DailyError('配置内容必填');
      return Response.json({ ok: true, ...await configureBusiness(access.context!.projectId, conf, Number(body.expectedVersion || 0)) });
    }
    if (body.action !== 'confirm') throw new DailyError('不支持的日报操作');
    if (typeof body.day !== 'string' || typeof body.fingerprint !== 'string') throw new DailyError('日报日期和版本必填');
    return Response.json({ ok: true, ...await confirmDaily(access.context!.projectId, body.day, body.fingerprint, access.context!.user.userId) });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '日报确认失败', error instanceof DailyError ? error.status : 500); }
}
