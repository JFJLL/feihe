import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const project = process.argv[process.argv.indexOf('--project') + 1];
if (!process.argv.includes('--project') || !['kailas', 'meiling', 'winner-wipes', 'huang-tiane'].includes(project)) throw Error('Specify a supported --project');
process.env.LOCAL_DB_NO_SEED = 'true';
const vite = await createServer({ root, configFile: false, cacheDir: path.join(root, 'node_modules/.vite/industry-rebuild'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', resolve: { alias: { '@': root } } });
try {
  const { db } = await vite.ssrLoadModule('/lib/db.ts');
  const { analyzeIndustryNotes } = await vite.ssrLoadModule('/lib/industry-analyzer.ts');
  const { saveIndustrySnapshot } = await vite.ssrLoadModule('/lib/industry-db.ts');
  const d = db();
  const meta = await d.prepare('SELECT spu,brand FROM projects WHERE id=?').bind(project).first();
  const row = await d.prepare("SELECT * FROM industry_snapshots WHERE project_id=? AND spu=? AND status='ready' ORDER BY created_at DESC LIMIT 1").bind(project, meta?.spu || '').first();
  if (!row) throw Error('No current ready snapshot; no changes made');
  const previous = JSON.parse(row.summary_json);
  const provenance = JSON.parse(row.provenance_json);
  const records = (await d.prepare("SELECT * FROM industry_notes WHERE project_id=? AND spu=? AND date(fetched_at,'+8 hours')=?").bind(project, meta.spu, row.date_key).all()).results;
  if (records.length !== previous.totalNotes || !provenance.liveVerified) throw Error('Original record count/provenance mismatch; no changes made');
  const notes = records.map(n => ({ id:n.id, noteId:n.note_id, title:n.title, bloggerName:n.blogger_name, coverUrl:n.cover_url, noteUrl:n.note_url, pubTime:n.pub_time, likedCount:n.liked_count, commentCount:n.comment_count, collectedCount:n.collected_count, brand:n.brand, isOurBrand:Boolean(n.is_our_brand), nature:n.nature, sourceProvider:n.source_provider, fetchedAt:n.fetched_at }));
  const rebuilt = analyzeIndustryNotes({ projectId:project, spu:meta.spu, brand:meta.brand, competitorBrands:[], notes, dateKey:row.date_key, provider:provenance.provider, liveVerified:true });
  if (rebuilt.summary.totalNotes !== previous.totalNotes || rebuilt.summary.totalInteractions !== previous.totalInteractions) throw Error('Raw totals changed; no changes made');
  const plan = { project, records:records.length, beforeShare:previous.ourBrandShare, afterShare:rebuilt.summary.ourBrandShare, apply };
  if (apply) await saveIndustrySnapshot({ ...rebuilt, id:row.id, provenance, createdAt:row.created_at });
  console.log(JSON.stringify(plan));
} finally { await vite.close(); }
