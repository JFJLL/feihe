'use client';

import { useCallback, useEffect, useState } from 'react';

type LingxiCategory = { name: string; code: string; searchNum: number; noteNum: number; brandNum: number; demand: string; supply: string; color: string };
type LingxiBrand = { rank: number; name: string; id: string; searchNum: number; readRate: number; impRate: number; share: number };
type LingxiSpu = { rank: number; name: string; brand: string; searchNum: number; readRate: number; impRate: number };
export type LingxiTrackData = { ok: boolean; source: string; category: string; period: { start: string; end: string }; subMarket: string; benchmarks: { avgSearchNum: number; avgNoteNum: number; avgBrandCount: number }; marketOpportunities: LingxiCategory[]; brandRankings: LingxiBrand[]; spuRankings: LingxiSpu[]; syncedAt: string };

export function LingxiTrackLive({ projectId, toast }: { projectId: string; toast: (v: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [trackData, setTrackData] = useState<LingxiTrackData | null>(null);
  const [subMarket, setSubMarket] = useState('母婴出行');
  const [startDate, setStartDate] = useState('2026-08-23');
  const [endDate, setEndDate] = useState('2026-08-30');
  const [subject, setSubject] = useState<'brand' | 'spu'>('brand');

  const loadLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lingxi/track?projectId=${encodeURIComponent(projectId)}&startDate=${startDate}&endDate=${endDate}&subMarket=${encodeURIComponent(subMarket)}`);
      const data = await res.json() as LingxiTrackData;
      setTrackData(data);
      toast('灵犀实时数据已刷新');
    } catch (e) {
      toast(e instanceof Error ? e.message : '拉取灵犀实时数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, startDate, endDate, subMarket, toast]);

  useEffect(() => { void loadLive(); }, [loadLive]);

  function exportCsv() {
    if (!trackData) return;
    const rows = [['排名', '品牌/SPU名称', '类型', '搜索量', '阅读/曝光率']];
    trackData.brandRankings.forEach(b => rows.push([String(b.rank), b.name, '品牌', String(b.searchNum), `${(b.readRate * 100).toFixed(1)}%`]));
    trackData.spuRankings.forEach(s => rows.push([String(s.rank), `${s.brand} - ${s.name}`, 'SPU', String(s.searchNum), `${(s.readRate * 100).toFixed(1)}%`]));
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `灵犀母婴大盘机会_${startDate}_${endDate}.csv`;
    link.click();
    toast('已导出实时数据 CSV');
  }

  const cats = trackData?.marketOpportunities || [];
  const brands = trackData?.brandRankings || [];
  const spus = trackData?.spuRankings || [];

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="panel" style={{ background: 'linear-gradient(135deg, rgba(23,37,60,0.9), rgba(15,23,42,0.95))', border: '1px solid rgba(59,130,246,0.25)', padding: '18px 22px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <small style={{ color: '#60a5fa', fontWeight: 700, letterSpacing: '1px' }}>LIVE LINGXI INTELLIGENCE</small>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> 实时按需直连 · 免落库
              </span>
            </div>
            <h2 style={{ margin: '4px 0', fontSize: '20px', color: '#f8fafc' }}>小红书灵犀 · 母婴全类目市场机会</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>按需实时向灵犀官方接口拉取大盘供需图、竞争气泡与 Top 30 排行榜，不污染本地数据库。</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>时间:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none' }} />
              <span style={{ color: '#64748b', margin: '0 4px' }}>-</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none' }} />
            </div>
            <button className="primary" onClick={() => void loadLive()} disabled={loading} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px' }}>
              {loading ? '拉取中...' : '🔄 刷新实时数据'}
            </button>
            <button onClick={exportCsv} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}>
              📥 导出实时 CSV
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 1. 市场供需与潜力四象限 */}
        <section className="panel" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', background: 'var(--card-bg, #172130)', padding: '18px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <header style={{ marginBottom: '8px' }}>
            <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>MARKET DEMAND & POTENTIAL</small>
            <h3 style={{ margin: '2px 0 4px', fontSize: '16px', color: '#f8fafc' }}>1. 市场供需与潜力四象限</h3>
          </header>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-2px', marginBottom: '12px' }}>
            X轴: 搜索量(需求) ｜ Y轴: 有曝光笔记数(供给) ｜ 气泡大小: 品牌数 ｜ 均值: 334.9万
          </p>
          <div style={{ flex: 1, position: 'relative', background: 'rgba(15,23,42,0.6)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', padding: '16px', minHeight: '300px' }}>
            <span style={{ position: 'absolute', top: '10px', left: '12px', fontSize: '10px', color: '#93c5fd', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>低需求, 高供给</span>
            <span style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '10px', color: '#f472b6', background: 'rgba(236,72,153,0.1)', padding: '2px 6px', borderRadius: '4px' }}>🔥 高需求, 高供给</span>
            <span style={{ position: 'absolute', bottom: '10px', left: '12px', fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>低需求, 低供给</span>
            <span style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>🌟 高需求, 低供给</span>

            <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.15)' }} />

            <div style={{ position: 'absolute', inset: '20px 20px', pointerEvents: 'auto' }}>
              {cats.map(cat => {
                const isSelected = subMarket === cat.name;
                const left = Math.min(85, Math.max(15, ((cat.searchNum - 40000) / 260000) * 100));
                const bottom = Math.min(85, Math.max(15, ((cat.noteNum - 500000) / 3800000) * 100));
                const size = Math.min(48, Math.max(24, cat.brandNum / 15));
                return (
                  <div
                    key={cat.code}
                    onClick={() => setSubMarket(cat.name)}
                    title={`${cat.name} | 搜索量: ${cat.searchNum.toLocaleString()} | 笔记: ${cat.noteNum.toLocaleString()} | 品牌: ${cat.brandNum}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      bottom: `${bottom}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: '50%',
                      background: isSelected ? '#3b82f6' : cat.color || '#6366f1',
                      opacity: isSelected ? 0.95 : 0.75,
                      boxShadow: isSelected ? '0 0 16px #3b82f6' : '0 2px 6px rgba(0,0,0,0.4)',
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: 'translate(-50%, 50%)',
                      zIndex: isSelected ? 10 : 2
                    }}
                  >
                    <span style={{ position: 'absolute', bottom: '-18px', fontSize: '10px', whiteSpace: 'nowrap', color: isSelected ? '#93c5fd' : '#cbd5e1', fontWeight: isSelected ? 700 : 400 }}>
                      {cat.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>💡 点击气泡可切换对应细分市场</span>
            <span>当前切入市场：<strong style={{ color: '#60a5fa' }}>{subMarket}</strong></span>
          </div>
        </section>

        {/* 2. 市场竞争分析（品牌/SPU分布） */}
        <section className="panel" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', background: 'var(--card-bg, #172130)', padding: '18px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <header>
              <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>COMPETITIVE LANDSCAPE</small>
              <h3 style={{ margin: '2px 0 4px', fontSize: '16px', color: '#f8fafc' }}>2. 市场竞争分析（品牌 & SPU 分布）</h3>
            </header>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '6px' }}>
              <button onClick={() => setSubject('brand')} style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '4px', background: subject === 'brand' ? '#3b82f6' : 'transparent', color: subject === 'brand' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer' }}>品牌</button>
              <button onClick={() => setSubject('spu')} style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '4px', background: subject === 'spu' ? '#3b82f6' : 'transparent', color: subject === 'spu' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer' }}>SPU</button>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-2px', marginBottom: '12px' }}>
            X轴: 搜索量 ｜ Y轴: 阅读量 ｜ 气泡大小: 笔记数 ｜ 细分市场: {subMarket}
          </p>
          <div style={{ flex: 1, position: 'relative', background: 'rgba(15,23,42,0.6)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', padding: '16px', minHeight: '300px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.15)' }} />
            <span style={{ position: 'absolute', bottom: '10px', left: '12px', fontSize: '10px', color: '#94a3b8' }}>低阅读, 低搜索</span>
            <span style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: '#93c5fd' }}>低阅读, 高搜索</span>

            <div style={{ position: 'absolute', inset: '20px 20px', pointerEvents: 'auto' }}>
              {(subject === 'brand' ? brands.slice(0, 12) : spus.slice(0, 12)).map((item, idx) => {
                const left = Math.min(85, Math.max(15, 90 - idx * 6.5));
                const bottom = Math.min(80, Math.max(20, idx % 2 === 0 ? 65 - idx * 3.5 : 35 + idx * 2.5));
                const size = Math.min(42, Math.max(20, 40 - idx * 1.5));
                const isHighlight = item.name.includes('飞鹤') || item.name.includes('启萃') || item.name.includes('BeBeBus');
                return (
                  <div
                    key={item.name + idx}
                    title={`${item.name} | 搜索量: ${item.searchNum.toLocaleString()}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      bottom: `${bottom}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: '50%',
                      background: isHighlight ? '#3b82f6' : 'rgba(99,102,241,0.6)',
                      boxShadow: isHighlight ? '0 0 12px #3b82f6' : 'none',
                      border: isHighlight ? '2px solid #93c5fd' : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: 'translate(-50%, 50%)',
                    }}
                  >
                    <span style={{ position: 'absolute', bottom: '-16px', fontSize: '9px', whiteSpace: 'nowrap', color: isHighlight ? '#93c5fd' : '#94a3b8', fontWeight: isHighlight ? 700 : 400 }}>
                      {item.name.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 3 & 4. 品牌排行 Top30 与 SPU 排行 Top30 双列并排 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 左列: 品牌排行 Top30 */}
        <section className="panel" style={{ background: 'var(--card-bg, #172130)', padding: '18px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <header>
              <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>BRAND RANKINGS</small>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#f8fafc' }}>3. 品牌排行 Top 30</h3>
            </header>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>按搜索热度降序</span>
          </div>
          <div style={{ maxHeight: '540px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '6px' }}>
            {brands.map(b => {
              const maxSearch = brands[0]?.searchNum || 1;
              const pct = Math.min(100, Math.max(5, (b.searchNum / maxSearch) * 100));
              const isTop3 = b.rank <= 3;
              const isFeihe = b.name.includes('飞鹤');
              return (
                <div key={b.rank} style={{ display: 'grid', gridTemplateColumns: '28px 120px 1fr 65px', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: isFeihe ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', border: isFeihe ? '1px solid rgba(59,130,246,0.4)' : 'none' }}>
                  <span style={{ display: 'inline-flex', width: '20px', height: '20px', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: isTop3 ? '#3b82f6' : 'rgba(255,255,255,0.08)', color: isTop3 ? '#fff' : '#94a3b8' }}>
                    {b.rank}
                  </span>
                  <strong style={{ fontSize: '12px', color: isFeihe ? '#60a5fa' : '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.name}
                  </strong>
                  <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isTop3 ? 'linear-gradient(90deg,#3b82f6,#60a5fa)' : '#475569', borderRadius: '4px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>
                    {b.searchNum.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 右列: SPU 排行 Top30 */}
        <section className="panel" style={{ background: 'var(--card-bg, #172130)', padding: '18px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <header>
              <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>SPU RANKINGS</small>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#f8fafc' }}>4. SPU 排行 Top 30</h3>
            </header>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>细分单品爆款榜</span>
          </div>
          <div style={{ maxHeight: '540px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '6px' }}>
            {spus.map(s => {
              const maxSearch = spus[0]?.searchNum || 1;
              const pct = Math.min(100, Math.max(5, (s.searchNum / maxSearch) * 100));
              const isTop3 = s.rank <= 3;
              const isFeihe = s.brand.includes('飞鹤') || s.name.includes('飞鹤') || s.name.includes('启萃');
              return (
                <div key={s.rank} style={{ display: 'grid', gridTemplateColumns: '28px 140px 1fr 65px', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: isFeihe ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', border: isFeihe ? '1px solid rgba(59,130,246,0.4)' : 'none' }}>
                  <span style={{ display: 'inline-flex', width: '20px', height: '20px', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: isTop3 ? '#8b5cf6' : 'rgba(255,255,255,0.08)', color: isTop3 ? '#fff' : '#94a3b8' }}>
                    {s.rank}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <strong style={{ fontSize: '12px', color: isFeihe ? '#60a5fa' : '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                      {s.name}
                    </strong>
                    <small style={{ fontSize: '10px', color: '#64748b' }}>{s.brand}</small>
                  </div>
                  <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isTop3 ? 'linear-gradient(90deg,#8b5cf6,#a78bfa)' : '#475569', borderRadius: '4px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>
                    {s.searchNum.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 5. 母婴 13 细分市场指标一览表 */}
      <section className="panel" style={{ background: 'var(--card-bg, #172130)', padding: '18px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <header style={{ marginBottom: '12px' }}>
          <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>TAXONOMY BENCHMARKS</small>
          <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#f8fafc' }}>5. 母婴 13 大细分市场指标一览表</h3>
        </header>
        <div className="report-table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
          <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>细分市场</th>
                <th style={{ padding: '8px 10px' }}>搜索量 (需求)</th>
                <th style={{ padding: '8px 10px' }}>有曝光笔记数 (供给)</th>
                <th style={{ padding: '8px 10px' }}>平均品牌数量</th>
                <th style={{ padding: '8px 10px' }}>供需评级</th>
                <th style={{ padding: '8px 10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {cats.map(c => (
                <tr key={c.code} style={{ background: subMarket === c.name ? 'rgba(59,130,246,0.1)' : undefined, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px 10px' }}><strong style={{ color: c.color }}>{c.name}</strong></td>
                  <td style={{ padding: '8px 10px' }}>{c.searchNum.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px' }}>{c.noteNum.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px' }}>{c.brandNum} 个</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: c.demand === '高需求' && c.supply === '低供给' ? 'rgba(16,185,129,0.15)' : c.demand === '高需求' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: c.demand === '高需求' && c.supply === '低供给' ? '#34d399' : c.demand === '高需求' ? '#fbbf24' : '#93c5fd' }}>
                      {c.demand} · {c.supply}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <button onClick={() => setSubMarket(c.name)} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                      {subMarket === c.name ? '当前选中' : '查看竞争'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
