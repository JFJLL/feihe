'use client';

import { useCallback, useEffect, useState } from 'react';

type LingxiCategory = {
  name: string;
  code: string;
  searchNum: number;
  noteNum: number;
  brandNum: number;
  demand: string;
  supply: string;
  color: string;
};

type LingxiBrand = {
  rank: number;
  name: string;
  id: string;
  searchNum: number;
  readRate: number;
  impRate: number;
  share: number;
};

type LingxiSpu = {
  rank: number;
  name: string;
  brand: string;
  searchNum: number;
  readRate: number;
  impRate: number;
};

export type LingxiTrackData = {
  ok: boolean;
  source: string;
  category: string;
  period: { start: string; end: string };
  subMarket: string;
  benchmarks: { avgSearchNum: number; avgNoteNum: number; avgBrandCount: number };
  marketOpportunities: LingxiCategory[];
  brandRankings: LingxiBrand[];
  spuRankings: LingxiSpu[];
  syncedAt: string;
};

type LingxiResponse = LingxiTrackData | { ok: false; error?: string };

const SUB_MARKETS = [
  '母婴出行',
  '婴幼儿配方奶粉',
  '宝宝零辅食',
  '哺乳喂养',
  '童装童鞋',
  '尿裤湿巾',
  '洗护清洁',
  '孕产妇用品',
  '玩具乐器',
  '早教益智',
  '母婴服务',
  '青少年用品',
  '其他母婴用品',
];

export function LingxiTrackLive({
  projectId,
  toast,
}: {
  projectId: string;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [loading, setLoading] = useState(false);
  const [trackData, setTrackData] = useState<LingxiTrackData | null>(null);
  const [subMarket, setSubMarket] = useState('母婴出行');
  const [startDate, setStartDate] = useState('2026-08-23');
  const [endDate, setEndDate] = useState('2026-08-30');
  const [subject, setSubject] = useState<'brand' | 'spu'>('brand');

  const loadLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        '/api/lingxi/track?projectId=' +
          encodeURIComponent(projectId) +
          '&startDate=' +
          startDate +
          '&endDate=' +
          endDate +
          '&subMarket=' +
          encodeURIComponent(subMarket)
      );

      if (!res.ok) {
        let errMessage = 'HTTP ' + res.status;
        try {
          const errData = (await res.json()) as { error?: string };
          if (errData?.error) errMessage = errData.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage);
      }

      const data = (await res.json()) as LingxiResponse;
      if (!data || data.ok === false) {
        throw new Error(('error' in data && data.error) || '灵犀接口返回失败');
      }

      setTrackData(data);
      toast('灵犀实时数据已刷新', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '拉取灵犀实时数据失败', 'error');
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
    (trackData.brandRankings || []).forEach((b) =>
      rows.push([
        String(b.rank),
        b.name,
        '品牌',
        String(b.searchNum),
        (b.readRate * 100).toFixed(1) + '%',
      ])
    );
    (trackData.spuRankings || []).forEach((s) =>
      rows.push([
        String(s.rank),
        s.brand + ' - ' + s.name,
        'SPU',
        String(s.searchNum),
        (s.readRate * 100).toFixed(1) + '%',
      ])
    );
    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '灵犀母婴大盘机会_' + subMarket + '_' + startDate + '_' + endDate + '.csv';
    link.click();
    toast('已导出实时数据 CSV', 'success');
  }

  const cats = trackData?.marketOpportunities || [];
  const brands = trackData?.brandRankings || [];
  const spus = trackData?.spuRankings || [];

  return (
    <div className="stack">
      {/* 顶部控制与时间切换 */}
      <section className="panel" style={{ background: '#ffffff' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <small style={{ color: 'var(--primary-blue)', fontWeight: 700, letterSpacing: '1px' }}>
                LIVE LINGXI INTELLIGENCE
              </small>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(16,185,129,0.1)',
                  color: '#059669',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <i
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                  }}
                />{' '}
                实时按需直连 · 免落库
              </span>
            </div>
            <h2 style={{ margin: '4px 0', fontSize: '18px', color: 'var(--text-main)' }}>
              小红书灵犀 · 母婴全类目市场机会
            </h2>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
              按需实时向灵犀官方接口拉取大盘供需图、竞争气泡与 Top 30 排行榜，不污染本地数据库。
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-line)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '6px' }}>
                时间:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <span style={{ color: '#94a3b8', margin: '0 4px' }}>-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
            <button
              className="primary"
              onClick={() => void loadLive()}
              disabled={loading}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              {loading ? '同步中…' : '🔄 刷新实时数据'}
            </button>
            <button
              onClick={exportCsv}
              disabled={!trackData}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                color: 'var(--text-main)',
                border: '1px solid var(--border-line)',
                cursor: 'pointer',
              }}
            >
              📥 导出实时 CSV
            </button>
          </div>
        </div>

        {/* 13 个细分市场切换 */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
          <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', display: 'block', marginBottom: '8px' }}>
            细分赛道快捷切换（共 13 个母婴细分市场）：
          </small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUB_MARKETS.map((m) => {
              const isSelected = subMarket === m;
              return (
                <button
                  key={m}
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: isSelected ? 'var(--primary-blue)' : '#f8fafc',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    border: '1px solid ' + (isSelected ? 'var(--primary-blue)' : 'var(--border-line)'),
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  onClick={() => setSubMarket(m)}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 大盘基准指标卡 */}
      {trackData?.benchmarks && (
        <div className="status-grid">
          <article className="status-card good">
            <b>{Number(trackData.benchmarks.avgSearchNum || 0).toLocaleString()}</b>
            <span>大盘平均搜索量</span>
            <small>细分赛道基准需求</small>
          </article>
          <article className="status-card base">
            <b>{Number(trackData.benchmarks.avgNoteNum || 0).toLocaleString()}</b>
            <span>大盘笔记供给量</span>
            <small>内容竞争基准</small>
          </article>
          <article className="status-card warn">
            <b>{Number(trackData.benchmarks.avgBrandCount || 0)}</b>
            <span>活跃入局品牌数</span>
            <small>市场竞争饱和度</small>
          </article>
        </div>
      )}

      {/* 供需四象限与竞争分布二维视图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 1. 市场供需与潜力四象限 */}
        <section className="panel" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
          <header style={{ marginBottom: '8px' }}>
            <small style={{ color: 'var(--primary-blue)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>
              MARKET DEMAND & POTENTIAL
            </small>
            <h3 style={{ margin: '2px 0 4px', fontSize: '16px', color: 'var(--text-main)' }}>
              1. 市场供需与潜力四象限
            </h3>
          </header>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-2px', marginBottom: '12px' }}>
            X轴: 搜索量(需求) ｜ Y轴: 有曝光笔记数(供给) ｜ 气泡大小: 品牌数
          </p>
          <div
            style={{
              flex: 1,
              position: 'relative',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid var(--border-line)',
              padding: '16px',
              minHeight: '300px',
              overflow: 'hidden',
            }}
          >
            {/* 象限指示标签 */}
            <span
              style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                fontSize: '10.5px',
                color: '#2563eb',
                background: 'rgba(37,99,235,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              低需求, 高供给（竞争白热）
            </span>
            <span
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                fontSize: '10.5px',
                color: '#db2777',
                background: 'rgba(219,39,119,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              🔥 高需求, 高供给（核心战场）
            </span>
            <span
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '12px',
                fontSize: '10.5px',
                color: '#64748b',
                background: 'rgba(100,116,139,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              低需求, 低供给（小众长尾）
            </span>
            <span
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '12px',
                fontSize: '10.5px',
                color: '#059669',
                background: 'rgba(5,150,105,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              🌟 高需求, 低供给（蓝海机会）
            </span>

            {/* 十字基准线 */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                right: '0',
                height: '1px',
                borderTop: '1px dashed #cbd5e1',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                bottom: '0',
                width: '1px',
                borderLeft: '1px dashed #cbd5e1',
              }}
            />

            {/* 气泡 */}
            <div style={{ position: 'absolute', inset: '28px 24px', pointerEvents: 'auto' }}>
              {cats.map((cat) => {
                const isSelected = subMarket === cat.name;
                const left = Math.min(85, Math.max(15, ((cat.searchNum - 40000) / 260000) * 100));
                const bottom = Math.min(85, Math.max(15, ((cat.noteNum - 500000) / 3800000) * 100));
                const size = Math.min(46, Math.max(22, cat.brandNum / 16));
                return (
                  <div
                    key={cat.code}
                    onClick={() => setSubMarket(cat.name)}
                    title={
                      cat.name +
                      ' | 搜索量: ' +
                      cat.searchNum.toLocaleString() +
                      ' | 笔记: ' +
                      cat.noteNum.toLocaleString() +
                      ' | 品牌: ' +
                      cat.brandNum
                    }
                    style={{
                      position: 'absolute',
                      left: left + '%',
                      bottom: bottom + '%',
                      width: size + 'px',
                      height: size + 'px',
                      borderRadius: '50%',
                      background: isSelected ? '#1d4ed8' : cat.color || '#3b82f6',
                      opacity: isSelected ? 0.95 : 0.75,
                      boxShadow: isSelected
                        ? '0 0 0 3px rgba(37,99,235,0.3), 0 4px 12px rgba(29,78,216,0.3)'
                        : '0 2px 6px rgba(0,0,0,0.1)',
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: 'translate(-50%, 50%)',
                      zIndex: isSelected ? 10 : 2,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-18px',
                        fontSize: '10px',
                        whiteSpace: 'nowrap',
                        color: isSelected ? '#1d4ed8' : '#475569',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {cat.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            style={{
              marginTop: '12px',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>💡 点击气泡可直接切换细分市场</span>
            <span>
              当前细分市场：<strong style={{ color: 'var(--primary-blue)' }}>{subMarket}</strong>
            </span>
          </div>
        </section>

        {/* 2. 市场竞争分析（品牌/SPU分布） */}
        <section className="panel" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <header>
              <small style={{ color: 'var(--primary-blue)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>
                COMPETITIVE LANDSCAPE
              </small>
              <h3 style={{ margin: '2px 0 4px', fontSize: '16px', color: 'var(--text-main)' }}>
                2. 市场竞争分析（品牌 & SPU 分布）
              </h3>
            </header>
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '2px',
                borderRadius: '6px',
              }}
            >
              <button
                onClick={() => setSubject('brand')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  background: subject === 'brand' ? 'var(--primary-blue)' : 'transparent',
                  color: subject === 'brand' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                品牌
              </button>
              <button
                onClick={() => setSubject('spu')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  background: subject === 'spu' ? 'var(--primary-blue)' : 'transparent',
                  color: subject === 'spu' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                SPU
              </button>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-2px', marginBottom: '12px' }}>
            X轴: 搜索量 ｜ Y轴: 曝光/阅读率 ｜ 气泡大小: 市场占比 ｜ 当前赛道: {subMarket}
          </p>
          <div
            style={{
              flex: 1,
              position: 'relative',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid var(--border-line)',
              padding: '16px',
              minHeight: '300px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                right: '0',
                height: '1px',
                borderTop: '1px dashed #cbd5e1',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                bottom: '0',
                width: '1px',
                borderLeft: '1px dashed #cbd5e1',
              }}
            />
            <span style={{ position: 'absolute', bottom: '10px', left: '12px', fontSize: '10px', color: '#94a3b8' }}>
              低转化, 低搜索
            </span>
            <span style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: 'var(--primary-blue)' }}>
              高转化, 高搜索
            </span>

            <div style={{ position: 'absolute', inset: '28px 24px', pointerEvents: 'auto' }}>
              {(subject === 'brand' ? brands.slice(0, 14) : spus.slice(0, 14)).map((item, idx) => {
                const left = Math.min(85, Math.max(15, 90 - idx * 6));
                const bottom = Math.min(80, Math.max(20, idx % 2 === 0 ? 68 - idx * 3.5 : 32 + idx * 2.8));
                const size = Math.min(42, Math.max(20, 38 - idx * 1.2));
                const isHighlight =
                  item.name.includes('飞鹤') || item.name.includes('启萃') || item.name.includes('卓睿');
                return (
                  <div
                    key={item.name + idx}
                    title={item.name + ' | 搜索量: ' + item.searchNum.toLocaleString()}
                    style={{
                      position: 'absolute',
                      left: left + '%',
                      bottom: bottom + '%',
                      width: size + 'px',
                      height: size + 'px',
                      borderRadius: '50%',
                      background: isHighlight ? '#1d4ed8' : '#64748b',
                      opacity: isHighlight ? 0.95 : 0.7,
                      boxShadow: isHighlight ? '0 0 12px rgba(29,78,216,0.35)' : '0 1px 4px rgba(0,0,0,0.1)',
                      border: isHighlight ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: 'translate(-50%, 50%)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-16px',
                        fontSize: '9.5px',
                        whiteSpace: 'nowrap',
                        color: isHighlight ? '#1d4ed8' : '#64748b',
                        fontWeight: isHighlight ? 700 : 400,
                      }}
                    >
                      {item.name.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 3 & 4. 品牌排行 Top 30 与 SPU 排行 Top 30 双列并排 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 左列: 品牌排行 Top 30 */}
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <header>
              <small style={{ color: 'var(--primary-blue)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>
                BRAND RANKINGS
              </small>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: 'var(--text-main)' }}>
                3. 品牌排行 Top 30
              </h3>
            </header>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>按搜索热度降序</span>
          </div>
          <div
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '6px',
            }}
          >
            {brands.slice(0, 30).map((b) => {
              const maxSearch = brands[0]?.searchNum || 1;
              const pct = Math.min(100, Math.max(5, (b.searchNum / maxSearch) * 100));
              const isTop3 = b.rank <= 3;
              const isHighlight = b.name.includes('飞鹤') || b.name.includes('启萃');
              return (
                <div
                  key={b.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 120px 1fr 70px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: isHighlight ? 'rgba(37,99,235,0.08)' : '#f8fafc',
                    border: isHighlight ? '1px solid rgba(37,99,235,0.3)' : '1px solid var(--border-light)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      width: '20px',
                      height: '20px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: isTop3 ? 'var(--primary-blue)' : '#e2e8f0',
                      color: isTop3 ? '#fff' : '#64748b',
                    }}
                  >
                    {b.rank}
                  </span>
                  <strong
                    style={{
                      fontSize: '12px',
                      color: isHighlight ? 'var(--primary-blue)' : 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.name}
                  </strong>
                  <div
                    style={{
                      position: 'relative',
                      height: '7px',
                      background: '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: pct + '%',
                        background: isTop3 ? 'var(--primary-blue)' : '#94a3b8',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {b.searchNum.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 右列: SPU 排行 Top 30 */}
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <header>
              <small style={{ color: 'var(--primary-blue)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>
                SPU RANKINGS
              </small>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: 'var(--text-main)' }}>
                4. SPU 排行 Top 30
              </h3>
            </header>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>细分单品爆款榜</span>
          </div>
          <div
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '6px',
            }}
          >
            {spus.slice(0, 30).map((s) => {
              const maxSearch = spus[0]?.searchNum || 1;
              const pct = Math.min(100, Math.max(5, (s.searchNum / maxSearch) * 100));
              const isTop3 = s.rank <= 3;
              const isHighlight =
                s.brand.includes('飞鹤') || s.name.includes('飞鹤') || s.name.includes('启萃');
              return (
                <div
                  key={s.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 140px 1fr 70px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: isHighlight ? 'rgba(37,99,235,0.08)' : '#f8fafc',
                    border: isHighlight ? '1px solid rgba(37,99,235,0.3)' : '1px solid var(--border-light)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      width: '20px',
                      height: '20px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: isTop3 ? '#7c3aed' : '#e2e8f0',
                      color: isTop3 ? '#fff' : '#64748b',
                    }}
                  >
                    {s.rank}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <strong
                      style={{
                        fontSize: '12px',
                        color: isHighlight ? 'var(--primary-blue)' : 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={s.name}
                    >
                      {s.name}
                    </strong>
                    <small style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.brand}</small>
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: '7px',
                      background: '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: pct + '%',
                        background: isTop3 ? '#7c3aed' : '#94a3b8',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {s.searchNum.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 5. 母婴 13 细分市场指标一览表 */}
      <section className="panel">
        <header style={{ marginBottom: '12px' }}>
          <small style={{ color: 'var(--primary-blue)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>
            TAXONOMY BENCHMARKS
          </small>
          <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: 'var(--text-main)' }}>
            5. 母婴 13 大细分市场指标一览表
          </h3>
        </header>
        <div className="report-table-wrap" style={{ marginTop: '12px' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>细分市场</th>
                <th>搜索量 (需求)</th>
                <th>有曝光笔记数 (供给)</th>
                <th>平均品牌数量</th>
                <th>供需评级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr
                  key={c.code}
                  style={{
                    background: subMarket === c.name ? 'rgba(37,99,235,0.06)' : undefined,
                  }}
                >
                  <td>
                    <strong style={{ color: c.color || 'var(--text-main)' }}>{c.name}</strong>
                  </td>
                  <td>{c.searchNum.toLocaleString()}</td>
                  <td>{c.noteNum.toLocaleString()}</td>
                  <td>{c.brandNum} 个</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background:
                          c.demand === '高需求' && c.supply === '低供给'
                            ? 'rgba(16,185,129,0.1)'
                            : c.demand === '高需求'
                            ? 'rgba(245,158,11,0.1)'
                            : 'rgba(37,99,235,0.1)',
                        color:
                          c.demand === '高需求' && c.supply === '低供给'
                            ? '#059669'
                            : c.demand === '高需求'
                            ? '#d97706'
                            : '#2563eb',
                        fontWeight: 600,
                      }}
                    >
                      {c.demand} · {c.supply}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setSubMarket(c.name)}
                      style={{
                        fontSize: '11.5px',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        color: subMarket === c.name ? 'var(--primary-blue)' : 'var(--text-main)',
                        border: '1px solid ' + (subMarket === c.name ? 'var(--primary-blue)' : 'var(--border-line)'),
                        cursor: 'pointer',
                        fontWeight: subMarket === c.name ? 600 : 400,
                      }}
                    >
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
