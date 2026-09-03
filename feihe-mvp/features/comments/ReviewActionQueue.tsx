'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/hooks/use-project-data';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
type QueueItem = { id: number; link: string; blogger: string; action: string; reason: string; sample: string[]; status: string };
const GROUPS: Array<{ key: string; title: string; desc: string }> = [
  { key: 'needReply', title: '需达人回复', desc: '用户问询无人接，达人24小时内回' },
  { key: 'needDelete', title: '需删除', desc: '负面/导流/不相关，按口径删' },
  { key: 'needSupplement', title: '需补充', desc: '正向不足30条，算缺口补量' },
];
export function ReviewActionQueue({ projectId }: { projectId: string }) {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('08-30');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  async function load(d: string) {
    setLoading(true);
    setNote('');
    try {
      const r = await api<{ ok: boolean; counts: Record<string, number>; items: QueueItem[] }>(
        '/api/review?projectId=' + encodeURIComponent(projectId) + '&date=' + encodeURIComponent(d) + '&items=1'
      );
      setCounts(r.counts || {});
      setItems(r.items || []);
      if (!(r.items || []).length) setNote(d + ' 暂无处置事项，说明当日判定全员达标。');
    } catch (e) {
      setItems([]);
      setNote(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api<{ ok: boolean; dates: string[] }>('/api/review?projectId=' + encodeURIComponent(projectId))
      .then((r) => {
        const ds = r.dates || [];
        setDates(ds);
        const pick = ds.includes('08-30') ? '08-30' : ds[ds.length - 1] || '08-30';
        setDate(pick);
        load(pick);
      })
      .catch(() => load('08-30'));
  }, [projectId]);
  async function resolve(id: number) {
    try {
      await api('/api/review', { method: 'POST', body: JSON.stringify({ projectId, action: 'resolve', id }) });
      setItems((list) => list.map((it) => (it.id === id ? { ...it, status: '已处理' } : it)));
    } catch (e) {
      setNote(e instanceof Error ? e.message : '更新失败');
    }
  }
  return (
    <section className="panel" id="review-queue">
      <PanelHead eyebrow="REVIEW QUEUE" title="判定处置队列" />
      <div className="filterbar">
        <select value={date} onChange={(e) => { setDate(e.target.value); load(e.target.value); }}>
          {dates.map((d) => (
            <option key={d} value={d}>{d} 判定批次</option>
          ))}
        </select>
        <button onClick={() => load(date)} disabled={loading}>{loading ? '判定中…' : '重新判定'}</button>
        <span>需回复 {counts.needReply || 0} · 需删除 {counts.needDelete || 0} · 需补充 {counts.needSupplement || 0}</span>
      </div>
      {note ? <p className="muted">{note}</p> : null}
      <div className="queue-grid">
        {GROUPS.map((g) => {
          const rows = items.filter((it) => it.action === g.key);
          return (
            <article className="queue-card" key={g.key}>
              <header>
                <strong>{g.title} {rows.length}</strong>
                <small>{g.desc}</small>
              </header>
              <div className="queue-list">
                {rows.length ? (
                  rows.map((it) => (
                    <div className="queue-row" key={it.id}>
                      <div className="queue-main">
                        <div><b>{it.blogger || '未知博主'}</b><span>{it.reason}</span></div>
                        {(it.sample || []).slice(0, 1).map((s, i) => (<p key={i}>“{s.slice(0, 60)}”</p>))}
                        <small><a href={it.link} target="_blank" rel="noreferrer">打开笔记 ↗</a> · {it.status}</small>
                      </div>
                      {it.status !== '已处理' ? (
                        <button onClick={() => resolve(it.id)}>已处理</button>
                      ) : (
                        <span className="done">已处理</span>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState title="本组无待办" text="当前日期该组判定全部通过。" />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
