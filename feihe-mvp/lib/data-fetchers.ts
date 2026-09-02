// 智能看板的数据获取层：按 QueryPlan 从项目库与外部数据源拉取事实数据。
// 外部源：IPSCG 素材系统（小红书关键词抓取），数据源 ID 形如 {project}:ipscg。

export type IpScgNote = {
  noteId: string; keyword: string; title: string; content: string;
  nickname: string; pubTime: string; likedCount: number; collectedCount: number;
  commentCount: number; shareCount: number; noteUrl: string; tagList: string;
};

const IPSCG_BASE = 'http://117.78.5.18:8080/ips-api/yimei';

export async function fetchIpScgTasks(timeoutMs = 8000): Promise<Array<{ taskId: string; taskName: string }>> {
  const res = await fetch(`${IPSCG_BASE}/getKeywordTaskList?format=json&page=1&pageSize=100`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`IPSCG 任务列表 HTTP ${res.status}`);
  const j = await res.json() as { yimeiCrawlerKeywordTaskList?: Array<{ taskId: string; taskName: string }> };
  return j.yimeiCrawlerKeywordTaskList || [];
}

export async function fetchIpScgNotes(taskId: string, maxRows = 40, timeoutMs = 12000): Promise<IpScgNote[]> {
  const res = await fetch(`${IPSCG_BASE}/selectKeywordResults?format=json&page=1&pageSize=${Math.min(200, maxRows)}&taskId=${encodeURIComponent(taskId)}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`IPSCG 结果 HTTP ${res.status}`);
  const j = await res.json() as { yimeiCommonAppList?: Array<Record<string, unknown>> };
  return (j.yimeiCommonAppList || []).map((raw) => ({
    noteId: String(raw.noteId || ''),
    keyword: String(raw.keyword || ''),
    title: String(raw.title || ''),
    content: String(raw.content || '').slice(0, 500),
    nickname: String(raw.nickname || ''),
    pubTime: String(raw.pubTime || ''),
    likedCount: Number(raw.likedCount || 0),
    collectedCount: Number(raw.collectedCount || 0),
    commentCount: Number(raw.commentCount || 0),
    shareCount: Number(raw.shareCount || 0),
    noteUrl: String(raw.noteUrl || ''),
    tagList: String(raw.tagList || ''),
  }));
}
