import { db } from '../db';
import { noteArchive } from './store';
export async function checkNoteLinks(projectId:string,noteId:string,fetcher:typeof fetch=fetch) {
  const note=await noteArchive(projectId,noteId),evidence=[];let state:typeof note.linkState='uncertain';
  for(const url of note.links.slice(0,2)) {
    try{
      const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});
      const status=response.status;
      if(status===404 || status===410){evidence.push({status,result:'入口返回不存在'});continue;}
      if(status>=300 && status<400){evidence.push({status,result:'跳转入口，需要浏览器登录或人工校验'});continue;}
      const body=(await response.text()).slice(0,500000);
      if(status===200 && body.includes(noteId) && /<title>/.test(body) && !/验证码|请先登录|登录以查看/.test(body)){state='available';evidence.push({status,result:'页面返回笔记ID及标题，未发现登录/验证提示'});break;}
      evidence.push({status,result:'响应未能证明笔记可见'});
    }catch{evidence.push({status:null,result:'读取超时或不可达，不能据此认定原文删除'});}
  }
  if(evidence.length && evidence.every(e=>e.status===404 || e.status===410))state='unavailable';
  const now=new Date().toISOString();await db().batch([db().prepare('INSERT INTO business_note_link_checks VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),projectId,noteId,now,state,JSON.stringify(evidence)),db().prepare('UPDATE business_note_archives SET data_json=? WHERE project_id=? AND note_id=?').bind(JSON.stringify({...note,linkState:state,linkCheckedAt:now}),projectId,noteId)]);return {state,checkedAt:now,evidence};
}
