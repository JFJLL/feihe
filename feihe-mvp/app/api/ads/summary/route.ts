import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireProjectAccess(request, params.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();
  const from = params.get('from');
  const to = params.get('to');
  const where = ['project_id=?'];
  const values: string[] = [project];
  if (from) { where.push('metric_date>=date(?)'); values.push(from); }
  if (to) { where.push('metric_date<=date(?)'); values.push(to); }
  const clause = ` WHERE ${where.join(' AND ')}`;

  const [totals, byAccount, byDate] = await Promise.all([
    d1.prepare(`SELECT COUNT(*) AS accounts, COALESCE(SUM(spend),0) AS spend, COALESCE(SUM(impressions),0) AS impressions,
      COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(interactions),0) AS interactions,
      CASE WHEN SUM(impressions)>0 THEN SUM(clicks)*1.0/SUM(impressions) ELSE 0 END AS ctr
      FROM paid_ad_metrics${clause}`).bind(...values).first(),
    d1.prepare(`SELECT account_name AS account, brand_name AS brand, spend, impressions, clicks, ctr, interactions, balance, metric_date AS metricDate
      FROM paid_ad_metrics${clause} ORDER BY metric_date DESC, spend DESC`).bind(...values).all(),
    d1.prepare(`SELECT metric_date AS date, SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
      SUM(interactions) AS interactions FROM paid_ad_metrics${clause} GROUP BY metric_date ORDER BY metric_date`).bind(...values).all(),
  ]);

  return Response.json({ ok: true, totals, byAccount: byAccount.results, byDate: byDate.results });
}
