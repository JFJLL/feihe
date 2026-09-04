import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { DEFAULT_RULES } from '@/lib/classify';
import { getSetting } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

type CacheEntry = { json: string; timestamp: number };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10_000;

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema();
  const d1 = db();
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const visibility = url.searchParams.get('visibility') || '';
  const cacheKey = `ops:${project}:${visibility}`;

  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return new Response(cached.json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        'X-Cache': 'HIT',
      },
    });
  }

  const supplierSql = `SELECT id,note_id AS noteId,note_url AS noteUrl,creator,planned_content AS plannedContent,
    comment_format AS commentFormat,visibility,matched_content AS matchedContent,verified_at AS verifiedAt
    FROM supplier_comments WHERE project_id=? ${visibility ? 'AND visibility=?' : ''} ORDER BY COALESCE(verified_at,'') DESC,id DESC LIMIT 120`;

  const [
    jobs,
    logs,
    supplier,
    supplierFeatures,
    categories,
    rules,
    acceptance,
    goals,
    growth,
    reviewRules,
    reports,
  ] = await Promise.all([
    d1.prepare('SELECT id,type,title,status,progress,total,succeeded,failed,message,created_at AS createdAt,finished_at AS finishedAt FROM jobs WHERE project_id=? ORDER BY created_at DESC LIMIT 40').bind(project).all(),
    d1.prepare('SELECT id,action,target_type AS targetType,target_id AS targetId,detail,created_at AS createdAt FROM action_logs WHERE project_id=? ORDER BY created_at DESC LIMIT 60').bind(project).all(),
    visibility ? d1.prepare(supplierSql).bind(project, visibility).all() : d1.prepare(supplierSql).bind(project).all(),
    d1.prepare(`SELECT visibility,COUNT(*) AS count,ROUND(AVG(LENGTH(planned_content)),1) AS avgLength,
      ROUND(AVG(CASE WHEN planned_content LIKE '%，%' OR planned_content LIKE '%,%' THEN 1.0 ELSE 0 END)*100,1) AS commaRate,
      ROUND(AVG(CASE WHEN LENGTH(planned_content)>=18 OR planned_content GLOB '*[0-9]*' THEN 1.0 ELSE 0 END)*100,1) AS detailRate
      FROM supplier_comments WHERE project_id=? AND visibility!='待核验' GROUP BY visibility`).bind(project).all(),
    d1.prepare(`SELECT category,sentiment,COUNT(*) AS count FROM key_comments WHERE project_id=? AND disappeared_at IS NULL GROUP BY category,sentiment ORDER BY count DESC LIMIT 12`).bind(project).all(),
    getSetting('rules', DEFAULT_RULES, project),
    getSetting('acceptance', { reportCount: 200, baseCount: 30, brandTopRate: 0.4, freshnessHours: 24, supplierSimilarity: 0.58 }, project),
    getSetting('goals', { workTarget: 0, workCompleted: 0, publishTarget: 0, budgetTarget: 0, commentTarget: 0 }, project),
    getSetting('growth', { watchKeywords: [], inspirations: [], seedNoteIds: [], thresholds: { breakoutInteractions: 1000, seedScore: 65, ctr: 0.15, cpuv: 0.7 } }, project),
    d1.prepare(`SELECT id,name,keywords,sentiment,category,action,priority,enabled,updated_at AS updatedAt FROM review_rules WHERE project_id=? ORDER BY priority,updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,title,period_start AS periodStart,period_end AS periodEnd,status,summary_json AS summaryJson,created_at AS createdAt,updated_at AS updatedAt FROM saved_reports WHERE project_id=? ORDER BY updated_at DESC LIMIT 30`).bind(project).all(),
  ]);

  const payload = {
    ok: true,
    jobs: jobs.results,
    logs: logs.results,
    supplier: supplier.results,
    supplierFeatures: supplierFeatures.results,
    categories: categories.results,
    reviewRules: reviewRules.results,
    reports: reports.results,
    settings: { rules, acceptance, goals, growth },
  };

  const jsonStr = JSON.stringify(payload);
  memoryCache.set(cacheKey, { json: jsonStr, timestamp: Date.now() });

  return new Response(jsonStr, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    },
  });
}

