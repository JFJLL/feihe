import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';
const csv = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return '\ufeff暂无数据\n'; const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return `\ufeff${keys.map(cell).join(',')}\n${rows.map((row) => keys.map((key) => cell(row[key])).join(',')).join('\n')}`;
};

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema(); const params=new URL(request.url).searchParams; const type=params.get('type')||'notes'; const project=projectId(params.get('projectId')); const d1=db();
  const queries: Record<string, string> = {
    notes: `SELECT n.id AS 笔记ID,n.title AS 标题,n.author AS 博主,n.url AS 链接,pn.source_type AS 来源,pn.product_scope AS 产品范围,pn.comment_total AS 评论数,pn.positive_count AS 正向,pn.negative_count AS 负向,pn.question_count AS 问询,pn.brand_mention_top5 AS 前排品牌提及率,pn.status AS 验收状态,pn.last_fetched_at AS 最近抓取 FROM notes n JOIN project_notes pn ON pn.note_id=n.id WHERE pn.project_id=? ORDER BY COALESCE(pn.last_fetched_at,n.published_at) DESC`,
    comments: `SELECT note_id AS 笔记ID,content AS 评论,author AS 用户,sentiment AS 情感,category AS 分类,action AS 建议动作,treatment_status AS 处理状态,treatment_method AS 处理方式,last_seen_at AS 最近出现,disappeared_at AS 消失时间 FROM key_comments WHERE project_id=? ORDER BY last_seen_at DESC`,
    supplier: `SELECT note_id AS 笔记ID,note_url AS 链接,creator AS 博主,planned_content AS 计划评论,comment_format AS 评论形式,visibility AS 外显状态,matched_content AS 实际外显,verified_at AS 核验时间 FROM supplier_comments WHERE project_id=? ORDER BY id`,
    jobs: `SELECT title AS 任务,type AS 类型,status AS 状态,total AS 总量,succeeded AS 成功,failed AS 失败,message AS 结果,created_at AS 开始时间,finished_at AS 完成时间 FROM jobs WHERE project_id=? ORDER BY created_at DESC`,
  };
  if (!queries[type]) return jsonError('不支持的导出类型');
  const result = await d1.prepare(queries[type]).bind(project).all<Record<string, unknown>>();
  return new Response(csv(result.results || []), { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="insight-${project}-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
