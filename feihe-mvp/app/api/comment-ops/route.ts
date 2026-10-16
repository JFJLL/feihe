import { requireProjectAccess, jsonError } from '../../../lib/api-auth';
import { DailyError } from '../../../lib/business-daily/store';
import {
  commentNoteDetail,
  correctComment,
  getCommentSettings,
  queueCommentCollection,
  readCommentQueue,
  saveCommentSettings,
  saveNoteReview,
} from '../../../lib/comment-ops/store';
import type { NoteReview, Sentiment } from '../../../lib/comment-ops/types';
import { checkNoteLinks } from '../../../lib/comment-ops/link-check';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const access = await requireProjectAccess(request, p.get('projectId'));
  if (!access.ok) return jsonError(access.error!, access.status);

  try {
    const projectId = access.context!.projectId;

    if (p.get('action') === 'settings') {
      const settings = await getCommentSettings(projectId);
      return Response.json({ ok: true, settings, canWrite: access.context!.canWrite });
    }

    if (p.get('noteId')) {
      const offset = Number(p.get('deliveryOffset') || 0);
      const limit = Number(p.get('deliveryLimit') || 20);
      const detail = await commentNoteDetail(projectId, p.get('noteId')!, offset, limit);
      return Response.json({ ok: true, ...detail, canWrite: access.context!.canWrite });
    }

    const month = p.get('month') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()).slice(0, 7);
    const queue = p.get('queue') || 'active';
    const offset = Number(p.get('offset') || 0);
    const limit = Number(p.get('limit') || 30);
    const queueData = await readCommentQueue(projectId, month, queue, offset, limit);
    return Response.json({ ok: true, ...queueData, canWrite: access.context!.canWrite });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : '巡查读取失败', e instanceof DailyError ? e.status : 500);
  }
}

export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    b = value as Record<string, unknown>;
  } catch {
    return jsonError('JSON格式无效');
  }

  const access = await requireProjectAccess(request, b.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status);

  try {
    const p = access.context!.projectId;
    const n = String(b.noteId || '');
    const actor = access.context!.user.userId;
    let result: unknown;

    if (b.action === 'save_settings') {
      result = await saveCommentSettings(p, {
        confidenceThreshold: b.confidenceThreshold as number,
        brands: b.brands as string[],
        competitors: b.competitors as string[],
      });
    } else if (b.action === 'collect') {
      result = await queueCommentCollection(p, n, String(b.requestId || ''), actor);
    } else if (b.action === 'review') {
      result = await saveNoteReview(p, n, b.review as NoteReview, actor);
    } else if (b.action === 'correct') {
      result = await correctComment(
        p,
        n,
        String(b.commentId || ''),
        {
          sentiment: b.sentiment as Sentiment,
          target: String(b.target || ''),
          reason: String(b.reason || ''),
          analysisId: String(b.analysisId || ''),
        },
        actor
      );
    } else if (b.action === 'check_link') {
      result = await checkNoteLinks(p, n);
    } else {
      throw new DailyError('巡查操作无效');
    }

    return Response.json({ ok: true, result });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : '巡查操作失败', e instanceof DailyError ? e.status : 500);
  }
}
