import { apiUser } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic='force-dynamic';
export async function GET(request:Request){if(!(await apiUser()))return new Response('请先登录',{status:401});await ensureSchema();const url=new URL(request.url),id=url.searchParams.get('id')||'',project=projectId(url.searchParams.get('projectId'));const row=await db().prepare('SELECT title,html FROM report_versions WHERE id=? AND project_id=?').bind(id,project).first<{title:string;html:string}>();if(!row)return new Response('报告不存在',{status:404});const download=url.searchParams.get('download')==='1';return new Response(row.html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(row.title)}.html`,'Cache-Control':'private, no-store'}})}
