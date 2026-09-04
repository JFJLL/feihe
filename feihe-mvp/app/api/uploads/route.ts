import { blobDelete, blobPut } from '@/lib/blob-store';
import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic='force-dynamic';

export async function POST(request:Request){const user=await apiUser(true);if(!user)return jsonError('请先登录',401);try{await ensureSchema();const form=await request.formData();const file=form.get('file');if(!(file instanceof File))return jsonError('请选择文件');if(file.size>25*1024*1024)return jsonError('单个文件不能超过 25MB');const project=projectId(form.get('projectId'));const id=crypto.randomUUID();const key=`projects/${project}/agent-assets/${id}/${file.name}`;await blobPut(key,await file.arrayBuffer(),file.type||'application/octet-stream');let summary='{}';try{summary=JSON.stringify(JSON.parse(String(form.get('summary')||'{}')))}catch{}
  await db().prepare(`INSERT INTO uploaded_assets(id,project_id,file_name,content_type,size,r2_key,status,summary_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,project,file.name,file.type||'',file.size,key,'已上传',summary,user.userId,new Date().toISOString()).run();return Response.json({ok:true,id,fileName:file.name,size:file.size});
}catch(error){return jsonError(error instanceof Error?error.message:'上传失败',500)}}

export async function DELETE(request:Request){if(!(await apiUser(true)))return jsonError('请先登录',401);try{await ensureSchema();const {id,projectId:rawProject}=await request.json() as {id?:string;projectId?:string};const project=projectId(rawProject);const row=await db().prepare('SELECT r2_key AS r2Key FROM uploaded_assets WHERE id=? AND project_id=?').bind(String(id||''),project).first<{r2Key:string}>();if(!row)return jsonError('文件不存在',404);await blobDelete(row.r2Key);await db().prepare('DELETE FROM uploaded_assets WHERE id=? AND project_id=?').bind(String(id),project).run();return Response.json({ok:true});}catch(error){return jsonError(error instanceof Error?error.message:'删除失败',500)}}
