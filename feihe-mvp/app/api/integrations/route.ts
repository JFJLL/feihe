import { runtimeVars, warmWorkerEnv } from '@/lib/runtime-env';
void warmWorkerEnv();
import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic='force-dynamic';
const value=(input:unknown)=>String(input??'').trim();
const runtime=()=>runtimeVars();

export async function GET(request:Request){
  if(!(await apiUser()))return jsonError('请先登录',401);await ensureSchema();const params=new URL(request.url).searchParams;const project=params.get('projectId');
  const sql=`SELECT id,project_id AS projectId,provider,name,base_url AS baseUrl,enabled,config_json AS configJson,status,last_tested_at AS lastTestedAt,last_error AS lastError,updated_at AS updatedAt FROM integrations ${project?'WHERE project_id=?':''} ORDER BY updated_at DESC`;
  const result=project?await db().prepare(sql).bind(projectId(project)).all():await db().prepare(sql).all();const r=runtime();
  return Response.json({ok:true,integrations:result.results,credentialStatus:{redtrend:Boolean(r.XHS_BASE_URL),oss:Boolean(r.OSS_ACCESS_KEY_ID&&r.OSS_ACCESS_KEY_SECRET&&r.OSS_ENDPOINT&&r.OSS_BUCKET&&r.OSS_COOKIE_OBJECT),feishu:Boolean(r.FEISHU_APP_ID&&r.FEISHU_APP_SECRET),keystone:Boolean(r.KEYSTONE_API_KEY)}});
}

async function probe(provider:string,baseUrl:string){
  const r=runtime();
  if(provider==='feishu'){
    if(!r.FEISHU_APP_ID||!r.FEISHU_APP_SECRET)throw new Error('飞书应用凭证未配置');
    const response=await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:r.FEISHU_APP_ID,app_secret:r.FEISHU_APP_SECRET})});
    const payload=await response.json() as {code?:number;msg?:string};if(!response.ok||payload.code)throw new Error(payload.msg||`HTTP ${response.status}`);return;
  }
  if(provider==='oss'){
    if(!(r.OSS_ACCESS_KEY_ID&&r.OSS_ACCESS_KEY_SECRET&&r.OSS_ENDPOINT&&r.OSS_BUCKET&&r.OSS_COOKIE_OBJECT))throw new Error('OSS Cookie 池凭证不完整');return;
  }
  if(provider==='keystone'){
    if(!r.KEYSTONE_API_KEY)throw new Error('Keystone API Key 未配置到托管环境');
    const url=`${(baseUrl||r.KEYSTONE_BASE_URL||'https://keystonehk.ai/v1').replace(/\/$/,'')}/models`;
    const response=await fetch(url,{headers:{Authorization:`Bearer ${r.KEYSTONE_API_KEY}`,Accept:'application/json'}});const payload=await response.json() as {data?:Array<{id:string}>;error?:{message?:string}};
    if(!response.ok)throw new Error(payload.error?.message||`HTTP ${response.status}`);const models=(payload.data||[]).map(x=>x.id),textModel=r.KEYSTONE_MODEL||'gpt-5.6-terra';if(!models.includes(textModel))throw new Error(`连接成功，但未发现指定文本模型 ${textModel}`);return;
  }
  if(!baseUrl)throw new Error('接口地址未配置');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch(baseUrl,{method:'GET',signal:controller.signal,headers:{Accept:'application/json,text/plain,*/*'}});if(response.status>=500)throw new Error(`服务返回 HTTP ${response.status}`);}finally{clearTimeout(timer)}
}

export async function POST(request:Request){
  if(!(await apiUser(true)))return jsonError('请先登录',401);
  try{const body=await request.json() as Record<string,unknown>;const action=value(body.action);const project=projectId(body.projectId);await ensureSchema();const d1=db();const now=new Date().toISOString();
    if(action==='save'){
      const id=value(body.id)||crypto.randomUUID();const provider=value(body.provider)||'redtrend';const name=value(body.name)||provider;let config='{}';try{config=typeof body.configJson==='string'?JSON.stringify(JSON.parse(body.configJson)):JSON.stringify(body.configJson||{});}catch{return jsonError('接口配置必须是合法 JSON')}
      await d1.prepare(`INSERT INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,name=excluded.name,base_url=excluded.base_url,enabled=excluded.enabled,config_json=excluded.config_json,updated_at=excluded.updated_at`).bind(id,project,provider,name,value(body.baseUrl),body.enabled===false?0:1,config,'未检测',now,now).run();
      await logAction(value(body.id)?'更新工具集成':'新增工具集成','integration',id,`${name} · ${provider}`,project);return Response.json({ok:true,id});
    }
    if(action==='delete'){
      const id=value(body.id);await d1.prepare('DELETE FROM integrations WHERE id=? AND project_id=?').bind(id,project).run();await logAction('删除工具集成','integration',id,'工具接口配置已删除',project);return Response.json({ok:true});
    }
    if(action==='test'){
      const id=value(body.id);const row=await d1.prepare('SELECT provider,base_url AS baseUrl FROM integrations WHERE id=? AND project_id=?').bind(id,project).first<{provider:string;baseUrl:string}>();if(!row)return jsonError('集成不存在',404);
      try{await probe(row.provider,row.baseUrl);await d1.prepare(`UPDATE integrations SET status='连接正常',last_tested_at=?,last_error='',updated_at=? WHERE id=?`).bind(now,now,id).run();await logAction('检测工具集成','integration',id,'连接正常',project);return Response.json({ok:true,status:'连接正常'});}catch(error){const message=error instanceof Error?error.message:'连接失败';await d1.prepare(`UPDATE integrations SET status='连接失败',last_tested_at=?,last_error=?,updated_at=? WHERE id=?`).bind(now,message,now,id).run();return jsonError(message,502)}
    }
    return jsonError('不支持的集成操作');
  }catch(error){return jsonError(error instanceof Error?error.message:'集成操作失败',500)}
}
