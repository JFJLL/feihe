import { calendarDay } from '../business-daily/adapter';
import type { ConversationCapture, ConversationComment } from './types';
type Vendor = { read:(kind:'detail'|'roots'|'replies',noteId:string,query?:Record<string,string>)=>Promise<Record<string,unknown>>;pageSize:number };
const count=(v:unknown)=>v!==null && v!==undefined && v!=='' && Number.isSafeInteger(Number(v)) && Number(v)>=0 ? Number(v):null;
const id=(v:Record<string,unknown>)=>{const raw=v.idStr ?? v.commentId ?? v.id;return typeof raw==='number' && !Number.isSafeInteger(raw) ? '' : String(raw ?? '');};
function map(v:Record<string,unknown>,depth:1|2,parentId:string|null,userMap:Record<string,Record<string,unknown>>={}):ConversationComment {
  const rawUserId=String(v.userIdStr || v.userId || '');
  const userInfo=userMap[rawUserId] || (v.user || v.author || {}) as Record<string,unknown>;
  const authorName=String(userInfo.userNickName || userInfo.nickname || userInfo.nickName || userInfo.name || v.author || '');
  return {id:id(v),parentId,depth,content:String(v.content || ''),author:authorName,createdAt:v.createTime ? String(v.createTime):null,replyCount:count(v.subCommentCount),visibility:v.isFolded===true ? 'folded':v.frontVisible===true ? 'front_visible':'api_visible',evidence:v.isFolded===true ? '本次接口显式isFolded=true':v.frontVisible===true ? '本次接口显式frontVisible=true':'本次API返回；尚未证明平台前台可见'};
}
export async function collectConversation(noteId:string,vendor:Vendor,options:{maxRequests?:number;wait?:()=>Promise<void>}={}):Promise<ConversationCapture> {
  const comments:ConversationComment[]=[],issues:string[]=[],roots:Array<Record<string,unknown>>=[];const seen=new Set<string>();let reportedRoots:number|null=null,offset='',requests=0;
  const capturedAt=new Date().toISOString();let note:ConversationCapture['note'];
  const read=async(kind:'detail'|'roots'|'replies',query:Record<string,string>={})=>{if(++requests>(options.maxRequests ?? 100) || Date.now()-Date.parse(capturedAt)>4*60000)throw new Error('本批评论请求上限');if(options.wait)await options.wait();else await new Promise(r=>setTimeout(r,350));return vendor.read(kind,noteId,query);};
  try {const detail=await read('detail'),raw=(detail.noteDetail || detail.note || detail) as Record<string,unknown>;note={title:String(raw.title || ''),content:String(raw.content || raw.desc || ''),author:String(raw.name || (raw.user as Record<string,unknown>)?.nickname || ''),publishedDay:calendarDay(raw.publishTime || raw.createTime || raw.time)};}catch{issues.push('本次笔记正文未读取，保留已存档内容');}
  let rootsComplete=false;
  while(true){
    const data=await read('roots',{offset,pageSize:String(vendor.pageSize),l2PageSize:String(vendor.pageSize)});
    const total=count(data.l1CommentTotal);if(total!==null){if(reportedRoots!==null && total!==reportedRoots)issues.push('采集期间主评论总数变化');reportedRoots=total;}
    if(!Array.isArray(data.l1Comments))throw new Error('主评论接口响应不完整');
    const batch=data.l1Comments as Record<string,unknown>[];let added=0;
    for(const item of batch){const c=item.comment as Record<string,unknown>;if(!c || !id(c)){issues.push('存在缺少稳定ID的主评论');continue;}if(!seen.has(id(c))){seen.add(id(c));roots.push(item);added++;}}
    if(reportedRoots!==null && roots.length>=reportedRoots && data.hasMore!==true){rootsComplete=true;break;}
    if(!batch.length){rootsComplete=reportedRoots!==null && roots.length===reportedRoots;break;}
    const next=id((batch.at(-1)?.comment || {}) as Record<string,unknown>);
    if(!added || !next || next===offset){issues.push('主评论分页没有前进');break;}offset=next;
  }
  let repliesComplete=true;
  for(const item of roots){
    const root=item.comment as Record<string,unknown>,parent=id(root);
    const userMap=(item.userMap || {}) as Record<string,Record<string,unknown>>;
    comments.push(map(root,1,null,userMap));
    const expected=count(root.subCommentCount),children=new Map<string,Record<string,unknown>>();
    for(const value of (Array.isArray(item.l1L2Comments) ? item.l1L2Comments:[]) as Record<string,unknown>[])if(id(value))children.set(id(value),value);else issues.push('回复缺少稳定ID');
    let childOffset=children.size ? [...children.keys()].at(-1)!:'';
    let replyUserMap=userMap;
    if(expected===null)repliesComplete=false;
    while(expected!==null && children.size<expected){
      const data=await read('replies',{offset:childOffset,l1CommentId:parent,pageSize:String(vendor.pageSize)});
      if(data.userMap)replyUserMap={...replyUserMap,...(data.userMap as Record<string,Record<string,unknown>>)};
      if(!Array.isArray(data.l2Comments)){issues.push('回复接口响应不完整');repliesComplete=false;break;}
      const batch=data.l2Comments as Record<string,unknown>[];let added=0;
      for(const c of batch)if(id(c) && !children.has(id(c))){children.set(id(c),c);added++;}
      const next=batch.length ? id(batch.at(-1)!):'';
      if(!added || !next || next===childOffset){issues.push('回复分页不足或没有前进');repliesComplete=false;break;}childOffset=next;
    }
    for(const c of children.values())comments.push(map(c,2,parent,replyUserMap));if(expected!==null && children.size!==expected)repliesComplete=false;
  }
  if(!rootsComplete)issues.push('主评论数量未完整核对');if(!repliesComplete)issues.push('回复数量未完整核对');
  return {noteId,capturedAt,complete:rootsComplete && repliesComplete && !issues.some(x=>/分页|总数变化|稳定ID|数量|响应/.test(x)),platformTotal:reportedRoots,totalScope:reportedRoots!==null ? 'roots':'unknown',reportedRoots,comments,issues,note};
}
