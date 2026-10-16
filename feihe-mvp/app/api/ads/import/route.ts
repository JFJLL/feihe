import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

type Row = {
  metricDate?: string;
  accountName?: string;
  virtualSellerId?: string;
  rtbAdvertiserId?: number | null;
  brandName?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  interactions?: number;
  balance?: number;
  rawJson?: string;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export async function POST(request: Request) {
  let body: { rows?: Row[]; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    await ensureSchema();
    const d1 = db();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return jsonError('没有可导入的数据');

    const now = new Date().toISOString();
    const statements: Array<{ run(): Promise<unknown> }> = [];

    for (const r of rows) {
      const metricDate = String(r.metricDate || '').trim();
      if (!metricDate) continue;
      const accountName = String(r.accountName || '').trim();
      const virtualSellerId = String(r.virtualSellerId || '').trim();
      const id = `${project}:${metricDate}:${virtualSellerId || accountName || crypto.randomUUID().slice(0, 8)}`;

      statements.push(
        d1
          .prepare(
            `INSERT INTO paid_ad_metrics(id, project_id, metric_date, account_name, virtual_seller_id, rtb_advertiser_id, brand_name, spend, impressions, clicks, ctr, interactions, balance, raw_json, source, created_at, updated_at)
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_import', ?, ?)
          ON CONFLICT(id) DO UPDATE SET
          spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr, interactions=excluded.interactions, balance=excluded.balance, updated_at=excluded.updated_at`
          )
          .bind(
            id,
            project,
            metricDate,
            accountName,
            virtualSellerId,
            r.rtbAdvertiserId ?? null,
            String(r.brandName || '').trim(),
            num(r.spend),
            Math.round(num(r.impressions)),
            Math.round(num(r.clicks)),
            num(r.ctr),
            Math.round(num(r.interactions)),
            num(r.balance),
            typeof r.rawJson === 'string' ? r.rawJson : '{}',
            now,
            now
          )
      );
    }

    if (statements.length > 0) {
      await d1.prepare('BEGIN TRANSACTION').run();
      try {
        for (let i = 0; i < statements.length; i += 80) {
          await d1.batch(statements.slice(i, i + 80));
        }
        await d1.prepare('COMMIT').run();
      } catch (e) {
        try { await d1.prepare('ROLLBACK').run(); } catch {}
        throw e;
      }
    }

    await logAction('导入投放指标', 'paid_ads', '', `导入 ${statements.length} 条日度投放数据`, project);
    return Response.json({ ok: true, imported: statements.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '导入投放指标失败', 500);
  }
}
