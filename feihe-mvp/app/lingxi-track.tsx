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
      const data = (await res.json()) as LingxiTrackData;
      setTrackData(data);
      toast('灵犀实时数据已刷新');
    } catch (e) {
      toast(e instanceof Error ? e.message : '拉取灵犀实时数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, startDate, endDate, subMarket, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLive();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadLive]);

  function exportCsv() {
    if (!trackData) return;
    const rows = [['排名', '品牌/SPU名称', '类型', '搜索量', '阅读/曝光率']];
    trackData.brandRankings.forEach((b) => rows.push([String(b.rank), b.name, '品牌', String(b.searchNum), `${(b.readRate * 100).toFixed(1)}%`]));
    trackData.spuRankings.forEach((s) => rows.push([String(s.rank), `${s.brand} - ${s.name}`, 'SPU', String(s.searchNum), `${(s.readRate * 100).toFixed(1)}%`]));
    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lingxi_${subMarket}_${startDate}_${endDate}.csv`;
    a.click();
  }

  const opps = trackData?.marketOpportunities || [];
  const brands = trackData?.brandRankings || [];
  const spus = trackData?.spuRankings || [];

  return (
    <div className="panel lingxi-track-wrap">
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <small>LIVE DATA BRIDGE</small>
          <h2>灵犀赛道实时洞察（母婴行业大盘）</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            数据来源：灵犀开放平台 · 免落库直连
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => void loadLive()} disabled={loading}>
            {loading ? '正在同步…' : '🔄 刷新实时数据'}
          </button>
          <button onClick={exportCsv} disabled={!trackData}>
            📥 导出大盘数据 CSV
          </button>
        </div>
      </div>

      <div className="filterbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
        <label>
          细分赛道：
          <select value={subMarket} onChange={(e) => setSubMarket(e.target.value)}>
            {['母婴出行', '婴幼儿配方奶粉', '宝宝零辅食', '哺乳喂养', '童装童鞋', '尿裤湿巾', '洗护清洁', '孕产妇用品', '玩具乐器', '早教益智', '母婴服务', '青少年用品', '其他母婴用品'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          从：
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          至：
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>

      {trackData && (
        <div className="status-grid" style={{ marginTop: '16px' }}>
          <article className="status-card good">
            <b>{trackData.benchmarks.avgSearchNum.toLocaleString()}</b>
            <span>大盘平均搜索量</span>
            <small>细分赛道基准值</small>
          </article>
          <article className="status-card base">
            <b>{trackData.benchmarks.avgNoteNum.toLocaleString()}</b>
            <span>大盘笔记供给量</span>
            <small>内容竞争基准</small>
          </article>
          <article className="status-card warn">
            <b>{trackData.benchmarks.avgBrandCount}</b>
            <span>活跃入局品牌数</span>
            <small>市场竞争度</small>
          </article>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>供需矩阵洞察（细分品类蓝海/红海判定）</h3>
        <div className="matrix-table">
          <div className="matrix-head">
            <span>品类名称</span>
            <span>搜索需求</span>
            <span>笔记供给</span>
            <span>品牌数</span>
            <span>供需格局</span>
          </div>
          {opps.map((o) => (
            <div key={o.code}>
              <strong>{o.name}</strong>
              <span>{o.searchNum.toLocaleString()}</span>
              <span>{o.noteNum.toLocaleString()}</span>
              <span>{o.brandNum}</span>
              <span>
                <i className="pill" style={{ background: o.color + '22', color: o.color, border: '1px solid ' + o.color }}>
                  {o.demand}需 · {o.supply}供
                </i>
              </span>
            </div>
          ))}
          {!opps.length && <div className="empty">暂无供需数据</div>}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', margin: 0 }}>大盘高热竞争排行 Top 30</h3>
          <div className="section-tabs" style={{ marginBottom: 0, border: 0 }}>
            <button className={subject === 'brand' ? 'active' : ''} onClick={() => setSubject('brand')}>
              品牌榜
            </button>
            <button className={subject === 'spu' ? 'active' : ''} onClick={() => setSubject('spu')}>
              SPU 核心单品榜
            </button>
          </div>
        </div>

        <div className="data-table">
          <div className="tr th">
            <span>排名 / 名称</span>
            <span>搜索量</span>
            <span>曝光/阅读率</span>
            {subject === 'brand' && <span>行业份额</span>}
          </div>
          {subject === 'brand'
            ? brands.map((b) => (
                <div className="tr" key={b.id || b.rank}>
                  <span>
                    <b>#{b.rank}</b> {b.name}
                  </span>
                  <span>{b.searchNum.toLocaleString()}</span>
                  <span>{(b.readRate * 100).toFixed(1)}%</span>
                  <span>{(b.share * 100).toFixed(1)}%</span>
                </div>
              ))
            : spus.map((s) => (
                <div className="tr" key={s.rank + s.name}>
                  <span>
                    <b>#{s.rank}</b> {s.brand} - {s.name}
                  </span>
                  <span>{s.searchNum.toLocaleString()}</span>
                  <span>{(s.readRate * 100).toFixed(1)}%</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
