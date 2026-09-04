import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema, DEFAULT_PROJECT_ID } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic='force-dynamic';
const value=(input:unknown)=>String(input??'').trim();
const number=(input:unknown,fallback=0)=>{const n=Number(input);return Number.isFinite(n)?n:fallback};

export async function POST(request:Request){
  const user=await apiUser(true);if(!user)return jsonError('请先登录',401);
  try{
    const body=await request.json() as Record<string,unknown>;const action=value(body.action);const project=projectId(body.projectId);const d1=db();await ensureSchema();const now=new Date().toISOString();
    if(action==='project_delete'){
      if(project===DEFAULT_PROJECT_ID)return jsonError('默认项目不能删除，可将状态设为“已结束”');
      await d1.batch([
        d1.prepare('DELETE FROM project_notes WHERE project_id=?').bind(project),d1.prepare('DELETE FROM project_pipelines WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM project_settings WHERE project_id=?').bind(project),d1.prepare('DELETE FROM data_sources WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM integrations WHERE project_id=?').bind(project),d1.prepare('DELETE FROM review_rules WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM saved_reports WHERE project_id=?').bind(project),d1.prepare('DELETE FROM key_comments WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM source_accounts WHERE project_id=?').bind(project),d1.prepare('DELETE FROM api_endpoints WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM metric_bindings WHERE project_id=?').bind(project),d1.prepare('DELETE FROM metric_definitions WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM uploaded_assets WHERE project_id=?').bind(project),d1.prepare('DELETE FROM agent_steps WHERE run_id IN (SELECT id FROM agent_runs WHERE project_id=?)').bind(project),d1.prepare('DELETE FROM agent_runs WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM report_versions WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM comment_snapshots WHERE project_id=?').bind(project),d1.prepare('DELETE FROM supplier_comments WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM jobs WHERE project_id=?').bind(project),d1.prepare('DELETE FROM action_logs WHERE project_id=?').bind(project),
        d1.prepare('DELETE FROM projects WHERE id=?').bind(project),
      ]);return Response.json({ok:true});
    }
   if(action==='note_update'){
     const id=value(body.id);if(!id)return jsonError('缺少笔记 ID');
     const updates: string[] = [];
     const updateVals: unknown[] = [];
     if ('title' in body) { updates.push('title=?'); updateVals.push(value(body.title)); }
     if ('author' in body) { updates.push('author=?'); updateVals.push(value(body.author)); }
     if ('url' in body) { updates.push('url=?'); updateVals.push(value(body.url)); }
     if (updates.length > 0) {
       await d1.prepare(`UPDATE notes SET ${updates.join(',')} WHERE id=?`).bind(...updateVals, id).run();
     }
     const pnUpdates: string[] = [];
     const pnVals: unknown[] = [];
     if ('sourceType' in body) { pnUpdates.push('source_type=?'); pnVals.push(value(body.sourceType)); }
     if ('pipeline' in body) { pnUpdates.push('pipeline=?'); pnVals.push(value(body.pipeline)); }
     if ('level' in body) { pnUpdates.push('level=?'); pnVals.push(value(body.level)); }
     if ('productScope' in body) { pnUpdates.push('product_scope=?'); pnVals.push(value(body.productScope)); }
     if (pnUpdates.length > 0) {
       await d1.prepare(`UPDATE project_notes SET ${pnUpdates.join(',')} WHERE project_id=? AND note_id=?`).bind(...pnVals, project, id).run();
     }
     await logAction('更新笔记','note',id,'笔记基础资料已更新',project);
     return Response.json({ok:true});
   }
   if(action==='calibrate_acceptance'){
     const id=value(body.id);
     const newStatus=value(body.status);
     const reason=value(body.reason)||'人工校正验收状态';
     if(!id||!newStatus)return jsonError('缺少笔记 ID 或新状态');
     const oldRow=await d1.prepare('SELECT status FROM project_notes WHERE project_id=? AND note_id=?').bind(project,id).first<{status:string}>();
     const oldStatus=oldRow?.status||'待抓取';
     await d1.prepare('UPDATE project_notes SET status=? WHERE project_id=? AND note_id=?').bind(newStatus,project,id).run();
     await logAction('人工验收校正','acceptance',id,`原状态: ${oldStatus} -> 新状态: ${newStatus}，原因: ${reason}，操作人: ${user.displayName||user.userId}`,project);
     return Response.json({ok:true,oldStatus,newStatus});
   }
    if(action==='note_delete'){
      const id=value(body.id);if(!id)return jsonError('缺少笔记 ID');
      await d1.batch([d1.prepare('DELETE FROM project_notes WHERE project_id=? AND note_id=?').bind(project,id),d1.prepare('DELETE FROM key_comments WHERE project_id=? AND note_id=?').bind(project,id),d1.prepare('DELETE FROM comment_snapshots WHERE project_id=? AND note_id=?').bind(project,id)]);
      const remaining=await d1.prepare('SELECT COUNT(*) AS count FROM project_notes WHERE note_id=?').bind(id).first<{count:number}>();
      if(!Number(remaining?.count||0))await d1.batch([d1.prepare('DELETE FROM note_profiles WHERE note_id=?').bind(id),d1.prepare('DELETE FROM notes WHERE id=?').bind(id)]);
      await logAction('移出笔记','note',id,'笔记已从当前项目移除',project);return Response.json({ok:true});
    }
    if(action==='comment_update'){
      const id=value(body.id);await d1.prepare(`UPDATE key_comments SET sentiment=?,category=?,action=?,treatment_status=?,treatment_method=? WHERE id=? AND project_id=?`)
        .bind(value(body.sentiment)||'中立',value(body.category)||'其他',value(body.nextAction)||value(body.actionName)||'保留观察',value(body.treatmentStatus)||'待处理',value(body.treatmentMethod)||null,id,project).run();
      await logAction('更新评论判定','comment',id,'情感、分类或处置状态已修改',project);return Response.json({ok:true});
    }
    if(action==='comment_delete'){
      const id=value(body.id);await d1.prepare('DELETE FROM key_comments WHERE id=? AND project_id=?').bind(id,project).run();await logAction('移除关键评论','comment',id,'从关键评论清单移除',project);return Response.json({ok:true});
    }
    if(action==='supplier_upsert'){
      const id=number(body.id);const noteId=value(body.noteId);const content=value(body.plannedContent);if(!noteId||!content)return jsonError('请填写笔记 ID 和计划评论');
      if(id)await d1.prepare(`UPDATE supplier_comments SET note_url=?,creator=?,planned_content=?,comment_format=?,visibility=?,matched_content=? WHERE id=? AND project_id=?`).bind(value(body.noteUrl),value(body.creator),content,value(body.commentFormat),value(body.visibility)||'待核验',value(body.matchedContent)||null,id,project).run();
      else await d1.prepare(`INSERT INTO supplier_comments(project_id,external_key,note_id,note_url,creator,planned_content,comment_format,visibility) VALUES(?,?,?,?,?,?,?,?)`).bind(project,`${project}:${noteId}:${crypto.randomUUID()}`,noteId,value(body.noteUrl),value(body.creator),content,value(body.commentFormat),value(body.visibility)||'待核验').run();
      await logAction(id?'更新供应商评论':'新增供应商评论','supplier',String(id||noteId),content.slice(0,50),project);return Response.json({ok:true});
    }
    if(action==='supplier_delete'){
      const id=number(body.id);await d1.prepare('DELETE FROM supplier_comments WHERE id=? AND project_id=?').bind(id,project).run();await logAction('删除供应商评论','supplier',String(id),'供应商评论记录已删除',project);return Response.json({ok:true});
    }
    if(action==='pipeline_upsert'){
      const key=value(body.key)||value(body.id)||crypto.randomUUID().slice(0,8);const id=`${project}:${key}`;
      await d1.prepare(`INSERT INTO project_pipelines(id,project_id,key,name,target_count,delivered_count,budget,spent) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,target_count=excluded.target_count,delivered_count=excluded.delivered_count,budget=excluded.budget,spent=excluded.spent`)
        .bind(id,project,key,value(body.name)||'新执行主线',Math.max(0,number(body.targetCount)),Math.max(0,number(body.deliveredCount)),Math.max(0,number(body.budget)),Math.max(0,number(body.spent))).run();
      await logAction('保存执行主线','pipeline',key,value(body.name),project);return Response.json({ok:true,key});
    }
    if(action==='pipeline_delete'){
      const key=value(body.key)||value(body.id);await d1.prepare('DELETE FROM project_pipelines WHERE project_id=? AND key=?').bind(project,key).run();await logAction('删除执行主线','pipeline',key,'执行主线已删除',project);return Response.json({ok:true});
    }
    if(action==='job_upsert'){
      const id=value(body.id)||crypto.randomUUID();
      await d1.prepare(`INSERT INTO jobs(id,project_id,type,title,status,progress,total,succeeded,failed,message,created_at,finished_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,progress=excluded.progress,total=excluded.total,succeeded=excluded.succeeded,failed=excluded.failed,message=excluded.message,finished_at=excluded.finished_at`)
        .bind(id,project,value(body.type)||'manual',value(body.title)||'手工任务',value(body.status)||'待开始',number(body.progress),number(body.total),number(body.succeeded),number(body.failed),value(body.message),now,value(body.status)==='已完成'?now:null).run();
      await logAction(value(body.id)?'更新任务':'创建任务','job',id,value(body.title),project);return Response.json({ok:true,id});
    }
    if(action==='job_delete'){
      const id=value(body.id);await d1.prepare('DELETE FROM jobs WHERE id=? AND project_id=?').bind(id,project).run();await logAction('删除任务','job',id,'任务记录已删除',project);return Response.json({ok:true});
    }
    if(action==='rule_upsert'){
      const id=value(body.id)||crypto.randomUUID();
      await d1.prepare(`INSERT INTO review_rules(id,project_id,name,keywords,sentiment,category,action,priority,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,keywords=excluded.keywords,sentiment=excluded.sentiment,category=excluded.category,action=excluded.action,priority=excluded.priority,enabled=excluded.enabled,updated_at=excluded.updated_at`)
        .bind(id,project,value(body.name)||'补充规则',value(body.keywords),value(body.sentiment)||'中立',value(body.category)||'自定义规则',value(body.nextAction)||value(body.actionName)||'保留观察',number(body.priority,100),body.enabled===false?0:1,now,now).run();
      await logAction(value(body.id)?'更新补充规则':'新增补充规则','rule',id,value(body.name),project);return Response.json({ok:true,id});
    }
    if(action==='rule_delete'){
      const id=value(body.id);await d1.prepare('DELETE FROM review_rules WHERE id=? AND project_id=?').bind(id,project).run();await logAction('删除补充规则','rule',id,'规则已删除',project);return Response.json({ok:true});
    }
    if(action==='report_upsert'){
      const id=value(body.id)||crypto.randomUUID();const summary=typeof body.summary==='string'?body.summary:JSON.stringify(body.summary||{});
      await d1.prepare(`INSERT INTO saved_reports(id,project_id,title,period_start,period_end,status,summary_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,period_start=excluded.period_start,period_end=excluded.period_end,status=excluded.status,summary_json=excluded.summary_json,updated_at=excluded.updated_at`)
        .bind(id,project,value(body.title)||'项目动态复盘',value(body.periodStart)||null,value(body.periodEnd)||null,value(body.status)||'草稿',summary,user.userId,now,now).run();
      await logAction(value(body.id)?'更新报告':'保存报告','report',id,value(body.title),project);return Response.json({ok:true,id});
    }
    if(action==='report_delete'){
      const id=value(body.id);await d1.prepare('DELETE FROM saved_reports WHERE id=? AND project_id=?').bind(id,project).run();await logAction('删除报告','report',id,'保存报告已删除',project);return Response.json({ok:true});
    }
    return jsonError('不支持的资源操作');
  }catch(error){return jsonError(error instanceof Error?error.message:'资源操作失败',500)}
}
