'use client';
import type { IndustrySnapshot } from '@/lib/industry-types';

export function IndustryCharts({ snapshot }: { snapshot: IndustrySnapshot }) {
  const brands = [...snapshot.competitorComparison].sort((a, b) => b.noteCount - a.noteCount).slice(0, 7);
  const maxBrand = Math.max(1, ...brands.map(b => b.noteCount));
  const dated = snapshot.recentNotes.filter(n => n.pubTime);
  const counts = new Map<string, number>();
  for (const note of dated) {
    const date = note.pubTime!.slice(0, 10);
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  const days = [...counts].sort(([a], [b]) => a.localeCompare(b));
  const peak = Math.max(1, ...days.map(([, n]) => n));
  return <div className="industry-chart-grid">
    <section className="industry-chart-card" aria-label="品牌样本构成">
      <header><h3>品牌样本构成</h3><p>当前 SPU 搜索样本中的品牌归因，不代表市场份额</p></header>
      <div className="industry-brand-bars">{brands.map(b => <div className="industry-brand-row" key={b.brand}>
        <span title={b.brand}>{b.brand}</span><div className="industry-track"><i style={{ width: `${b.noteCount / maxBrand * 100}%`, background: b.isOurBrand ? 'var(--industry-teal)' : b.brand === '未识别品牌' ? '#8b8d98' : '#ffc53d' }} /></div><strong>{b.noteCount}<small> 篇</small></strong>
      </div>)}</div>
      <footer>展示前 {brands.length} 个归因品牌 · 未识别样本单列，不默认计为本品</footer>
    </section>
    <section className="industry-chart-card" aria-label="样本发布时间分布">
      <header><h3>样本发布时间分布</h3><p>展示明细中的 {dated.length} 篇有日期笔记，非全网分日新增量</p></header>
      {days.length ? <div className="industry-date-chart" role="img" aria-label={days.map(([d,n]) => `${d}：${n}篇`).join('；')}>
        {days.map(([date, n], index) => <div className="industry-date-column" key={date} title={`${date} · ${n}篇`}>
          <div><span>{n}</span><i style={{ height: `${Math.max(3, n / peak * 140)}px` }} /></div>
          <small>{(index % Math.max(1, Math.ceil(days.length / 6)) === 0 && index < days.length - 2) || index === days.length - 1 ? date.slice(5) : ''}</small>
        </div>)}
      </div> : <p className="industry-chart-empty">源数据未返回可用发布时间</p>}
      <footer>采集日期 {snapshot.dateKey} · 查询近 30 天 · 按热度排序的有限样本</footer>
    </section>
  </div>;
}
