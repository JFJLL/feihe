import { classifyComment, DEFAULT_RULES, normalizeText, type ClassificationRules, type CommentInput } from './classify';
import { DEFAULT_PROJECT_ID, db, ensureSchema } from './db';
import { getSetting } from './ops';
import { projectId } from './projects';

export function noteIdFrom(value: string) {
  const matches = value.match(/[0-9a-f]{24}/ig);
  return matches?.at(-1) || value.trim();
}

export async function saveFetchedComments(noteId: string, comments: CommentInput[], l1Count: number, l2Count: number, project = DEFAULT_PROJECT_ID) {
  await ensureSchema();
  const d1 = db();
  const currentProject = projectId(project);
  const now = new Date().toISOString();
  const rules = await getSetting<ClassificationRules>('rules', DEFAULT_RULES, currentProject);
  const acceptance = await getSetting('acceptance', { reportCount: 200, baseCount: 30, brandTopRate: .4 }, currentProject);
  const customRules = await d1.prepare(`SELECT keywords,sentiment,category,action FROM review_rules
    WHERE project_id=? AND enabled=1 ORDER BY priority ASC,created_at ASC`).bind(currentProject).all<{keywords:string;sentiment:string;category:string;action:string}>();
  const classified = comments.map((comment) => {
    const result = classifyComment(comment, rules);
    const matched = (customRules.results||[]).find((rule)=>rule.keywords.split(/[，,\n]+/).map((x)=>x.trim()).filter(Boolean).some((word)=>comment.content.includes(word)));
    if (matched) {
      result.sentiment=matched.sentiment||result.sentiment; result.category=matched.category||result.category; result.action=matched.action||result.action;
      if(result.sentiment==='问询') result.isQuestion=true;
      if(result.sentiment==='负向') result.isNegative=true;
      if(result.sentiment==='正向') result.isPositive=true;
    }
    return { comment, result };
  });
  const positive = classified.filter((x) => x.result.sentiment === '正向').length;
  const negative = classified.filter((x) => x.result.sentiment === '负向').length;
  const question = classified.filter((x) => x.result.isQuestion).length;
  const irrelevant = classified.filter((x) => x.result.irrelevant || x.result.onlyEmoji || x.result.isSelling).length;
  const l1 = classified.filter((x) => !x.comment.parentId);
  const top5 = l1.slice(0, 5);
  const brandMentionTop5 = top5.length ? top5.filter((x) => x.result.hasBrand).length / top5.length : 0;
  const total = comments.length;
  const status = total >= acceptance.reportCount && brandMentionTop5 >= acceptance.brandTopRate ? '符合且能汇报' : total >= acceptance.baseCount ? '符合基础要求' : `不够${acceptance.baseCount}条需补充`;

  const existing = await d1.prepare('SELECT id FROM key_comments WHERE project_id=? AND note_id = ? AND disappeared_at IS NULL').bind(currentProject,noteId).all<{ id: string }>();
  const liveIds = new Set(comments.map((comment) => `${currentProject}:${comment.id}`));
  const disappeared = (existing.results || []).filter((row) => !liveIds.has(row.id));
  for (let i = 0; i < disappeared.length; i += 80) {
    await d1.batch(disappeared.slice(i, i + 80).map((row) => d1.prepare('UPDATE key_comments SET disappeared_at = ?, last_seen_at = ? WHERE id = ?').bind(now, now, row.id)));
  }

  const keyRows = classified.filter((x) => x.result.action !== '保留观察' || x.result.hasBrand || x.result.competitor);
  const keyIds = new Set(keyRows.map((x) => `${currentProject}:${x.comment.id}`));
  const noLongerKey = (existing.results || []).filter((row) => liveIds.has(row.id) && !keyIds.has(row.id));
  for (let i = 0; i < noLongerKey.length; i += 80) {
    await d1.batch(noLongerKey.slice(i, i + 80).map((row) => d1.prepare('DELETE FROM key_comments WHERE id = ?').bind(row.id)));
  }
  for (let i = 0; i < keyRows.length; i += 50) {
    await d1.batch(keyRows.slice(i, i + 50).map(({ comment, result }) => d1.prepare(`INSERT INTO key_comments
      (id,project_id,note_id,parent_id,content,author,created_at,sentiment,category,action,treatment_status,first_seen_at,last_seen_at,disappeared_at,reply_count)
      VALUES(?,?,?,?,?,?,?,?,?,?,'待处理',?,?,NULL,?)
      ON CONFLICT(id) DO UPDATE SET content=excluded.content,sentiment=excluded.sentiment,category=excluded.category,action=excluded.action,last_seen_at=excluded.last_seen_at,disappeared_at=NULL,reply_count=excluded.reply_count`)
      .bind(`${currentProject}:${comment.id}`,currentProject,noteId,comment.parentId || null,comment.content,comment.author || '',comment.createdAt || null,result.sentiment,result.category,result.action,now,now,comment.replyCount || 0)));
  }
  await d1.batch([
    d1.prepare(`INSERT INTO notes(id,last_fetched_at,comment_total,positive_count,negative_count,question_count,brand_mention_top5,status)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_fetched_at=excluded.last_fetched_at,comment_total=excluded.comment_total,positive_count=excluded.positive_count,negative_count=excluded.negative_count,question_count=excluded.question_count,brand_mention_top5=excluded.brand_mention_top5,status=excluded.status`)
      .bind(noteId, now, total, positive, negative, question, brandMentionTop5, status),
    d1.prepare(`INSERT INTO project_notes(id,project_id,note_id,status,last_fetched_at,comment_total,positive_count,negative_count,question_count,brand_mention_top5,added_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_fetched_at=excluded.last_fetched_at,
      comment_total=excluded.comment_total,positive_count=excluded.positive_count,negative_count=excluded.negative_count,
      question_count=excluded.question_count,brand_mention_top5=excluded.brand_mention_top5`)
      .bind(`${currentProject}:${noteId}`,currentProject,noteId,status,now,total,positive,negative,question,brandMentionTop5,now),
    d1.prepare(`INSERT INTO comment_snapshots(project_id,note_id,captured_at,l1_count,l2_count,total_count,positive_count,negative_count,question_count,irrelevant_count) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(currentProject,noteId,now,l1Count,l2Count,total,positive,negative,question,irrelevant),
  ]);
  return { total, positive, negative, question, irrelevant, brandMentionTop5, status, keyCount: keyRows.length, disappeared: disappeared.length };
}

export function similarity(a: string, b: string) {
  const x = normalizeText(a); const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if ((x.includes(y) || y.includes(x)) && Math.min(x.length, y.length) / Math.max(x.length, y.length) > .6) return .9;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const gx = grams(x); const gy = grams(y); let same = 0;
  for (const gram of gx) if (gy.has(gram)) same += 1;
  return same / Math.max(1, gx.size + gy.size - same);
}
