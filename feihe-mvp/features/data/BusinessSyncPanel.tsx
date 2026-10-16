'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/hooks/use-project-data';
type Task = { id: string; name: string; state: string; next_run_at: string; last_success_at: string | null; business_through: string | null; last_error: string; retry_count: number; lease_expires_at: string | null };
type Run = { id: string; source_id: string; status: string; rows_read: number; rows_imported: number; error_summary: string; started_at: string; finished_at: string | null };
type Observation = { source_key: string; account_id: string; business_day: string; data_json: string; captured_at: string; run_id: string };
type BoundAccount = { id: string; external_id: string; name: string; metadata_json: string };
type Status = { tasks: Task[]; runs: Run[]; totalRuns: number; hasMore: boolean; worker: { online: boolean; lastSeenAt: string | null }; observations?: Observation[]; accounts?: BoundAccount[] };
const time = (v: string | null) => v ? new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '尚未成功';
export function BusinessSyncPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [revision, setRevision] = useState(0), [count, setCount] = useState(20), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [snapshot, setSnapshot] = useState<{ key: string; data?: Status; error?: string }>({ key: '' });
  const key = JSON.stringify({ projectId, revision, count }), current = snapshot.key === key ? snapshot : null;
  useEffect(() => {
    let valid = true;
    const load = () => api<Status>('/api/business-sync?' + new URLSearchParams({ projectId, limit: String(count) })).then(data => { if (valid) setSnapshot({ key, data }); }).catch(e => { if (valid) setSnapshot({ key, error: e instanceof Error ? e.message : '状态读取失败' }); });
    void load(); const timer = setInterval(load, 30000);
    return () => { valid = false; clearInterval(timer); };
  }, [projectId, key, count]);
  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const platform = String(fd.get('platform') || '');
    const accountId = String(fd.get('accountId') || '');
    const sourceKey = String(fd.get('sourceKey') || '').trim();
    const sourceUrl = String(fd.get('sourceUrl') || '').trim();
    const entityId = String(fd.get('entityId') || '').trim();
    const dimension = String(fd.get('dimension') || 'account');
    const refreshDays = Number(fd.get('refreshDays') || 7);
    const attributionDelayDays = Number(fd.get('attributionDelayDays') || 0);
    const intervalMinutes = Number(fd.get('intervalMinutes') || 360);
    if (!name || !platform || !accountId || !sourceKey || !sourceUrl || !entityId) { setNotice('请填写完整的任务绑定信息'); return; }
    setBusy('create'); setNotice('');
    try {
      const spec = { type: 'automation_platform' as const, sourceKey, sourceUrl, platform: platform as any, accountId, entityIds: [entityId], dimension, refreshDays, attributionDelayDays };
      await api('/api/business-sync', { method: 'POST', body: JSON.stringify({ projectId, action: 'save', name, spec, intervalMinutes }) });
      setRevision(n => n + 1); setNotice('新平台任务配置成功。'); (e.target as HTMLFormElement).reset();
    } catch (err) { setNotice(err instanceof Error ? err.message : '创建失败'); } finally { setBusy(''); }
  }
  async function action(task: Task, next: 'pause' | 'resume' | 'queue', from?: string, to?: string) {
    setBusy(task.id); setNotice('');
    try { await api('/api/business-sync', { method: 'POST', body: JSON.stringify({ projectId, taskId: task.id, action: next, requestId: crypto.randomUUID(), from, to }) }); setRevision(n => n + 1); setNotice(next === 'queue' ? '同步已排队，由后台执行。' : next === 'pause' ? '任务已暂停。' : '任务已恢复。'); }
    catch (e) { setNotice(e instanceof Error ? e.message : '操作失败'); } finally { setBusy(''); }
  }
  return <details className="bd-panel business-sync-panel" data-testid="business-sync-panel"><summary>数据自动更新与执行记录</summary>
    <p className="bd-caption">后台任务独立执行。失败保留最近成功数据；业务截至日期与执行时间分别记录。</p>
    {current?.data?.observations?.length ? <details><summary>平台只读核对观测记录（{current.data.observations.length}条）</summary><div className="bd-scroll"><table><thead><tr><th>来源键</th><th>账号ID</th><th>业务日期</th><th>捕获时间</th><th>观测摘要（客观核对源）</th></tr></thead><tbody>{current.data.observations.map((o, idx) => { let parsed: any = {}; try { parsed = JSON.parse(o.data_json); } catch {} return <tr key={idx}><td>{o.source_key}</td><td>{o.account_id}</td><td>{o.business_day}</td><td>{time(o.captured_at)}</td><td><small>{parsed['消费'] ? '消费: ￥' + parsed['消费'] : ''} {parsed['阅读UV'] ? '阅读UV: ' + parsed['阅读UV'] : ''} {parsed['新客UV'] ? '新客UV: ' + parsed['新客UV'] : ''} {parsed['商家GMV'] ? 'GMV: ￥' + parsed['商家GMV'] : ''}</small></td></tr>; })}</tbody></table></div></details> : null}
    {current?.data && <p className="bd-caption">{current.data.worker.online ? '本地后台在线' : '本地后台未在线；排队任务等待worker启动'} · 生产定时任务尚未部署</p>}
    {notice && <p role="status">{notice}</p>}{current?.error && <p role="alert">{current.error}</p>}
    {!current ? <p>读取同步状态…</p> : !current.data?.tasks.length ? <p>本项目尚未配置后台更新任务。平台账号尚未验证的指标保持未连接。</p> : <div className="bd-scroll"><table><thead><tr>{['来源任务', '状态', '最近成功', '业务数据截至', '下次执行', '操作'].map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{current.data.tasks.map(t => <tr key={t.id}><td>{t.name}<small>{t.last_error || (t.retry_count ? `失败后第${t.retry_count}次重试` : '')}</small></td><td>{t.state === 'paused' ? '已暂停' : t.lease_expires_at ? '执行中' : t.last_error ? '等待重试' : t.last_success_at ? '已验证本地更新' : '待首次验证'}</td><td>{time(t.last_success_at)}</td><td>{t.business_through || '尚无观测'}</td><td>{t.state === 'paused' ? '已暂停' : time(t.next_run_at)}</td><td>{canManage && <><button disabled={Boolean(busy) || Boolean(t.lease_expires_at) || t.state === 'paused'} onClick={() => action(t, 'queue')}>执行一次</button><button disabled={Boolean(busy)} onClick={() => action(t, t.state === 'paused' ? 'resume' : 'pause')}>{t.state === 'paused' ? '恢复' : '暂停'}</button><Backfill task={t} disabled={Boolean(busy) || t.state === 'paused'} onRun={(from, to) => action(t, 'queue', from, to)} /></>}</td></tr>)}</tbody></table></div>}
    {current?.data?.runs.length ? <details><summary>执行日志（{current.data.totalRuns}次）</summary><div className="bd-scroll"><table><thead><tr><th>来源</th><th>状态</th><th>读取/写入</th><th>开始/完成</th><th>结果</th></tr></thead><tbody>{current.data.runs.map(r => <tr key={r.id}><td>{r.source_id}</td><td>{r.status}</td><td>{r.rows_read}/{r.rows_imported}</td><td>{time(r.started_at)}<br/>{r.finished_at ? time(r.finished_at) : '执行中'}</td><td>{r.error_summary || '成功'}</td></tr>)}</tbody></table></div>{current.data.hasMore && <button onClick={() => setCount(n => Math.min(100, n + 20))}>展开更多日志</button>}</details> : null}
    {canManage && <details><summary>新建/配置平台任务绑定</summary><form onSubmit={createTask} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', padding: '8px 0' }}><label>任务名称<input name="name" placeholder="例: 聚光-启萃日常-F" required /></label><label>平台<select name="platform"><option value="juguang">聚光 (小红书)</option><option value="jzt">京准通 (京东)</option><option value="taobao">淘宝星河 (阿里)</option></select></label><label>指定账号<select name="accountId">{current?.data?.accounts?.map(a => <option key={a.id} value={a.id}>{a.name} ({a.external_id})</option>)}</select></label><label>实体/计划/订单ID<input name="entityId" placeholder="实体ID" required /></label><label>来源键 (sourceKey)<input name="sourceKey" placeholder="juguang-f" required /></label><label>来源URL<input name="sourceUrl" placeholder="https://ad.xiaohongshu.com/..." required /></label><label>维度<select name="dimension"><option value="account">分账户/概览</option><option value="placement">投放位置</option><option value="order">订单维度</option></select></label><label>回刷天数<input type="number" name="refreshDays" defaultValue={7} min={1} max={90} /></label><label>归因延迟<input type="number" name="attributionDelayDays" defaultValue={0} min={0} max={30} /></label><button type="submit" disabled={busy === 'create'}>保存绑定</button></form></details>}
  </details>;
}
function Backfill({ task, disabled, onRun }: { task: Task; disabled: boolean; onRun: (from: string, to: string) => void }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  return <details><summary>按日期补跑</summary><label>开始日期<input type="date" aria-label={task.name + '补跑开始'} value={from} onChange={e => setFrom(e.target.value)} /></label><label>结束日期<input type="date" aria-label={task.name + '补跑结束'} value={to} onChange={e => setTo(e.target.value)} /></label><button disabled={disabled || !from || !to || from > to} onClick={() => onRun(from, to)}>提交补跑</button></details>;
}
