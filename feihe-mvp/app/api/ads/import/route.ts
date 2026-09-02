import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { projectId } from '@/lib/projects';

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
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { projectId?: string; rows?: Row[] };
    const project = projectId(body.projectId);
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 200) : [];
    if (!rows.length) return jsonError('没有可导入的数据');
    await ensureSchema();
    const d1 = db();
    const now = new Date().toISOString();
    const statements = [];
    for (const row of rows) {
      const metricDate = String(row.metricDate || '').slice(0, 10);
      const accountName = String(row.accountName || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate) || !accountName) return jsonError('行缺少 metricDate 或 accountName');
      const virtualSellerId = String(row.virtualSellerId || '');
      const id = `${project}:${metricDate}:${virtualSellerId || accountName}`;
      const raw = typeof row.rawJson === 'string' ? row.rawJson.slice(0, 20000) : '{}';
      statements.push(d1.prepare(`INSERT INTO paid_ad_metrics
        (id,project_id,metric_date,account_name,virtual_seller_id,rtb_advertiser_id,brand_name,spend,impressions,clicks,ctr,interactions,balance,raw_json,source,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          account_name=excluded.account_name, rtb_advertiser_id=excluded.rtb_advertiser_id, brand_name=excluded.brand_name,
          spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr,
          interactions=excluded.interactions, balance=excluded.balance, raw_json=excluded.raw_json,
          source=excluded.source, updated_at=excluded.updated_at`)
        .bind(id, project, metricDate, accountName, virtualSellerId,
          row.rtbAdvertiserId == null ? null : Math.trunc(num(row.rtbAdvertiserId)),
          String(row.brandName || ''), num(row.spend), Math.trunc(num(row.impressions)), Math.trunc(num(row.clicks)),
          num(row.ctr), Math.trunc(num(row.interactions)), num(row.balance), raw, 'partner_sub_page', now, now));
    }
    for (let i = 0; i < statements.length; i += 50) await d1.batch(statements.slice(i, i + 50));
    await logAction('导入聚光投放数据', 'paid_ads', project, `${rows.length} 行 · ${rows[0].metricDate}`, project);
    return Response.json({ ok: true, imported: rows.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '导入失败', 500);
  }
}
