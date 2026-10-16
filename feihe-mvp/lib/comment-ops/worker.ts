import { db } from '../db';
import { createProjectCommentRequester } from '../xhs';
import { safeSyncError } from '../business-sync/store';
import { collectConversation } from './collect';
import { ensureCommentOpsSchema, storeConversation } from './store';
export async function runCommentJobs(limit=1) {
  await ensureCommentOpsSchema();const now=new Date().toISOString();
  const jobs=await db().prepare("SELECT * FROM business_comment_jobs WHERE status IN ('queued','retry','running') AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY next_run_at LIMIT ?").bind(now,now,limit).all<{id:string;project_id:string;note_id:string;attempts:number}>();
  const results=[];
  for(const job of jobs.results){
    const token=crypto.randomUUID();await db().prepare("UPDATE business_comment_jobs SET status='running',lease_token=?,lease_expires_at=?,updated_at=? WHERE id=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)").bind(token,new Date(Date.now()+6*60000).toISOString(),now,job.id,now).run();
    const owns=async()=>Boolean(await db().prepare('SELECT id FROM business_comment_jobs WHERE id=? AND project_id=? AND lease_token=? AND lease_expires_at>?').bind(job.id,job.project_id,token,new Date().toISOString()).first());if(!await owns())continue;
    try{
      const project=await db().prepare('SELECT status,is_archived FROM projects WHERE id=?').bind(job.project_id).first<{status:string;is_archived:number}>();if(!project || project.is_archived || project.status==='已归档')throw new Error('项目已归档，采集已停止');
      const capture=await collectConversation(job.note_id,await createProjectCommentRequester(job.project_id));if(!await owns())continue;
      await storeConversation(job.project_id,capture);const status=capture.complete ? 'success':'partial';
      await db().prepare('UPDATE business_comment_jobs SET status=?,updated_at=?,lease_token=NULL,lease_expires_at=NULL,error=?,attempts=attempts+1 WHERE id=? AND lease_token=?').bind(status,new Date().toISOString(),capture.issues.join('；'),job.id,token).run();results.push({id:job.id,status,comments:capture.comments.length});
    }catch(e){const error=safeSyncError(e),retriable=!/未配置|多个账号|已归档/.test(error) && job.attempts<2;await db().prepare('UPDATE business_comment_jobs SET status=?,updated_at=?,next_run_at=?,lease_token=NULL,lease_expires_at=NULL,error=?,attempts=attempts+1 WHERE id=? AND lease_token=?').bind(retriable ? 'retry':'failed',new Date().toISOString(),new Date(Date.now()+2**(job.attempts+1)*60000).toISOString(),error,job.id,token).run();results.push({id:job.id,status:retriable ? 'retry':'failed',error});}
  }
  return results;
}
