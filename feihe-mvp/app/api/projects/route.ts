import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';
const text = (value: unknown) => String(value || '').trim();
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || `project-${crypto.randomUUID().slice(0, 8)}`;

export async function GET() {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema(); const d1 = db();
  const [projects, sources] = await Promise.all([
    d1.prepare(`SELECT p.id,p.name,p.spu,p.brand,p.category,p.description,p.status,p.color,p.start_at AS startAt,p.end_at AS endAt,
      p.updated_at AS updatedAt,COUNT(DISTINCT pn.note_id) AS noteCount,
      SUM(CASE WHEN pn.status='符合且能汇报' THEN 1 ELSE 0 END) AS reportableCount
      FROM projects p LEFT JOIN project_notes pn ON pn.project_id=p.id GROUP BY p.id ORDER BY CASE p.status WHEN '进行中' THEN 0 ELSE 1 END,p.updated_at DESC`).all(),
    d1.prepare(`SELECT id,project_id AS projectId,type,name,spreadsheet,sheet_id AS sheetId,range,kind,
      sync_frequency AS syncFrequency,status,last_synced_at AS lastSyncedAt,last_row_count AS lastRowCount,mapping_json AS mappingJson,last_error AS lastError,updated_at AS updatedAt
      FROM data_sources ORDER BY updated_at DESC`).all(),
  ]);
  return Response.json({ ok: true, projects: projects.results, sources: sources.results });
}

export async function POST(request: Request) {
  const user = await apiUser(true); if (!user) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as Record<string, unknown>; await ensureSchema(); const d1 = db(); const now = new Date().toISOString();
    const action = text(body.action);
    if (action === 'create') {
      const name = text(body.name); const spu = text(body.spu); if (!name || !spu) return jsonError('请填写项目名称和 SPU 名称');
      let id = slug(text(body.id) || `${spu}-${Date.now().toString(36)}`); const exists = await d1.prepare('SELECT id FROM projects WHERE id=?').bind(id).first(); if (exists) id = `${id}-${Date.now().toString(36).slice(-4)}`;
      await d1.prepare(`INSERT INTO projects(id,name,spu,brand,category,description,status,color,start_at,end_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,name,spu,text(body.brand),text(body.category),text(body.description),'进行中',text(body.color)||'#1769d5',text(body.startAt)||null,text(body.endAt)||null,user.userId,now,now).run();
      const pipelines = [['viral','口碑爆文维护',200],['value_scan','价值内容扫描',60],['commercial','商业内容执行',300]] as const;
      await d1.batch(pipelines.map(([key,label,target])=>d1.prepare(`INSERT INTO project_pipelines(id,project_id,key,name,target_count) VALUES(?,?,?,?,?)`).bind(`${id}:${key}`,id,key,label,target)));
      const rules = { brands: [text(body.brand),spu].filter(Boolean), competitors: [], positiveWords: ['好用','推荐','喜欢','有效','值得'], negativeWords: ['不好','踩雷','失望','问题','投诉'], questionWords: ['吗','怎么','多少','哪里买'], sellingWords: ['出售','加微','低价出'], irrelevantWords: ['互赞','打卡','路过'], deleteCompetitorMentions: false };
      await d1.batch([
        d1.prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)`).bind(`${id}:rules`,id,'rules',JSON.stringify(rules),now),
        d1.prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)`).bind(`${id}:acceptance`,id,'acceptance',JSON.stringify({reportCount:200,baseCount:30,brandTopRate:.4,freshnessHours:24,supplierSimilarity:.58}),now),
      ]);
      return Response.json({ ok: true, id });
    }
    if (action === 'update') {
      const id = projectId(body.projectId);
      await d1.prepare(`UPDATE projects SET name=?,spu=?,brand=?,category=?,description=?,status=?,color=?,start_at=?,end_at=?,updated_at=? WHERE id=?`)
        .bind(text(body.name),text(body.spu),text(body.brand),text(body.category),text(body.description),text(body.status)||'进行中',text(body.color)||'#1769d5',text(body.startAt)||null,text(body.endAt)||null,now,id).run();
      return Response.json({ ok: true, id });
    }
    if (action === 'save_source') {
      const project = projectId(body.projectId); const id = text(body.id) || crypto.randomUUID(); const name = text(body.name); if (!name) return jsonError('请填写数据源名称');
      let mapping='{}';try{mapping=typeof body.mappingJson==='string'?JSON.stringify(JSON.parse(body.mappingJson)):JSON.stringify(body.mappingJson||{});}catch{return jsonError('字段映射必须是合法 JSON')}
      await d1.prepare(`INSERT INTO data_sources(id,project_id,type,name,spreadsheet,sheet_id,range,kind,sync_frequency,status,mapping_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,CASE WHEN ?!='' AND ?!='' THEN '已连接' ELSE '未连接' END,?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,spreadsheet=excluded.spreadsheet,sheet_id=excluded.sheet_id,range=excluded.range,kind=excluded.kind,sync_frequency=excluded.sync_frequency,status=excluded.status,mapping_json=excluded.mapping_json,updated_at=excluded.updated_at`)
        .bind(id,project,text(body.type)||'feishu_sheet',name,text(body.spreadsheet),text(body.sheetId),text(body.range)||'A1:AZ5000',text(body.kind)||'owned',text(body.syncFrequency)||'manual',text(body.spreadsheet),text(body.sheetId),mapping,now,now).run();
      return Response.json({ ok: true, id });
    }
    if (action === 'remove_source') {
      const id = text(body.id); const project = projectId(body.projectId); if (!id) return jsonError('缺少数据源 ID');
      await d1.prepare('DELETE FROM data_sources WHERE id=? AND project_id=?').bind(id,project).run();
      return Response.json({ ok: true });
    }
    return jsonError('不支持的操作');
  } catch (error) { return jsonError(error instanceof Error ? error.message : '项目操作失败', 500); }
}
