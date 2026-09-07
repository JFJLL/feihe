'use client';

import React, { useState } from 'react';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CompetitorIntelligenceSection } from './CompetitorIntelligenceSection';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function formatTenThousand(val: unknown) {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val).trim();
  if (str.endsWith("万")) {
    const n = parseFloat(str.slice(0, -1));
    return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) + "万" : str;
  }
  const clean = str.replace(/,/g, "");
  const n = parseFloat(clean);
  if (!Number.isFinite(n)) return str;
  const inTenThousand = Math.round((n / 10000) * 10) / 10;
  return inTenThousand.toFixed(1) + "万";
}
function parseRawValueToNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const str = String(val).trim();
  if (str.endsWith("万")) {
    const n = parseFloat(str.slice(0, -1));
    return Number.isFinite(n) ? n * 10000 : 0;
  }
  const clean = str.replace(/,/g, "");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}
function bestBrand(rows: AnalyticRow[], key: 'positive' | 'negative', inverse = false) {
  const valid = rows.filter((x) => num(x.comments) > 0);
  if (!valid.length) return '暂无足够评论样本。';
  const sorted = [...valid].sort(
    (a, b) => num(b[key]) / num(b.comments) - num(a[key]) / num(a.comments)
  );
  const row = sorted[0];
  return (
    String(row.brand) +
    ' 的' +
    (inverse ? '负向风险' : '正向口碑') +
    '占比最高，为 ' +
    pct(num(row[key]) / num(row.comments)) +
    '。'
  );
}

export function CompetitorAnalysis({ data, onSwitchTab }: { data: Dashboard; onSwitchTab?: (tab: string) => void }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const monthly = data.feishu?.competitor || [];
  const months = [...new Set(monthly.map(r=>r.month))].sort();
  const month = months.includes(selectedMonth) ? selectedMonth : months.at(-1) || '';
  const brands = data.analytics?.brands || [];
  const maxComments = Math.max(1, ...brands.map((x) => num(x.comments)));

  const totalBrandComments = brands.reduce((sum, b) => sum + num(b.comments), 0);
  const totalBrandNotes = brands.reduce((sum, b) => sum + num(b.notes), 0);
  const totalBrandInteractions = brands.reduce((sum, b) => sum + num(b.interactions), 0);
  const leadBrand = brands[0];

  // 灵犀与聚光指数大盘衍生计算
  const searchData = data.feishu?.search || [];
  const latestSearch = searchData[searchData.length - 1] || { date: '—', lingxi: null, spotlight: null };
  const prevSearch = searchData[searchData.length - 2] || null;
  const lingxiVal = num(latestSearch.lingxi);
  const spotlightVal = num(latestSearch.spotlight);
  const totalSearchVal = lingxiVal + spotlightVal;
  const prevLingxi = prevSearch ? num(prevSearch.lingxi) : null;
  const lingxiDelta = prevLingxi !== null && prevLingxi > 0 ? Math.round(((lingxiVal - prevLingxi) / prevLingxi) * 1000) / 10 : null;
  const prevSpotlight = prevSearch ? num(prevSearch.spotlight) : null;
  const spotlightDelta = prevSpotlight !== null && prevSpotlight > 0 ? Math.round(((spotlightVal - prevSpotlight) / prevSpotlight) * 1000) / 10 : null;

  // 飞书月报当月各品牌搜索指数排行
  const currentMonthPoints = monthly.filter((r) => r.month === month).map((r) => ({
    ...r,
    numericVal: parseRawValueToNumber(r.value),
  })).sort((a, b) => b.numericVal - a.numericVal);
  const maxMonthVal = Math.max(1, ...currentMonthPoints.map((x) => x.numericVal));
  const totalMonthSearch = currentMonthPoints.reduce((s, x) => s + x.numericVal, 0);

  return (
    <div className="stack animate-fade-in">
      {/* 顶部指标卡 (统一项目总览马卡龙风格) */}
      <div className="reference-daily-grid">
        <article className="pastel-card pastel-blue reference-kpi">
          <div className="stat-head">
            <span>启萃灵犀搜索指数</span>
            <span className="section-mini-tag tag-blue">最新日度</span>
          </div>
          <div className="stat-value">{compact(lingxiVal)}<small> 指数</small></div>
          <div className="reference-kpi-meta">日期：{latestSearch.date || '—'}</div>
          <div className="reference-kpi-delta">{lingxiDelta !== null ? (lingxiDelta >= 0 ? `较前日 +${lingxiDelta}%` : `较前日 ${lingxiDelta}%`) : '灵犀大盘指数'}</div>
        </article>
        <article className="pastel-card pastel-teal reference-kpi">
          <div className="stat-head">
            <span>启萃聚光搜索指数</span>
            <span className="section-mini-tag tag-teal">商投大盘</span>
          </div>
          <div className="stat-value">{compact(spotlightVal)}<small> 指数</small></div>
          <div className="reference-kpi-meta">日期：{latestSearch.date || '—'}</div>
          <div className="reference-kpi-delta">{spotlightDelta !== null ? (spotlightDelta >= 0 ? `较前日 +${spotlightDelta}%` : `较前日 ${spotlightDelta}%`) : '聚光广告大盘'}</div>
        </article>
        <article className="pastel-card pastel-green reference-kpi">
          <div className="stat-head">
            <span>双端搜索聚合大盘</span>
            <span className="section-mini-tag tag-green">全域需求</span>
          </div>
          <div className="stat-value">{compact(totalSearchVal)}<small> 综合</small></div>
          <div className="reference-kpi-meta">灵犀自然 + 聚光商业检索</div>
          <div className="reference-kpi-delta">大盘搜索心智强盛</div>
        </article>
        <article className="pastel-card pastel-purple reference-kpi">
          <div className="stat-head">
            <span>竞品月报全网搜索池</span>
            <span className="section-mini-tag tag-purple">{month || '月度'}大盘</span>
          </div>
          <div className="stat-value">{formatTenThousand(totalMonthSearch)}<small></small></div>
          <div className="reference-kpi-meta">{currentMonthPoints[0] ? `月榜首位：${currentMonthPoints[0].brand}` : '竞品月报跨端追踪'}</div>
          <div className="reference-kpi-delta">{currentMonthPoints.length} 个重点品线纳管</div>
        </article>
      </div>

      <div className="workspace-two-col competitor-source-grid">
      <DashboardSection title="飞书月报 · 品牌搜索指数全盘与份额" eyebrow="MONTHLY SEARCH" desc="各品牌工作表的月度搜索指数，统一以万为单位展示，并附带大盘占比与横向对比排行榜。" extra={<label>月份 <select aria-label="竞品月报月份" value={month} onChange={e=>setSelectedMonth(e.target.value)}>{[...months].reverse().map(m=><option key={m} value={m}>{m}{m===months.at(-1)?' (最新)':''}</option>)}</select></label>}>
        {monthly.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                <span>{month} 品牌搜索热度横向排行榜 (Top 6)</span>
                <span>搜索指数 (万) · 占比份额</span>
              </div>
              {currentMonthPoints.slice(0, 6).map((item, idx) => {
                const pctOfTotal = totalMonthSearch > 0 ? Math.round((item.numericVal / totalMonthSearch) * 1000) / 10 : 0;
                const barRatio = maxMonthVal > 0 ? Math.max(4, Math.round((item.numericVal / maxMonthVal) * 100)) : 0;
                const isTop1 = idx === 0;
                return (
                  <div key={item.brand + item.sheetId} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: isTop1 ? 700 : 500, color: isTop1 ? '#1e3a8a' : '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.brand}>
                      {idx + 1}. {item.brand}
                    </span>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${barRatio}%`, height: '100%', background: isTop1 ? '#1e6091' : '#38bdf8', borderRadius: '4px' }} />
                    </div>
                    <span style={{ textAlign: 'right', fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>
                      {formatTenThousand(item.value)} <small style={{ color: '#64748b', fontWeight: 400 }}>({pctOfTotal}%)</small>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>品牌 / 品线</th>
                    <th>{month} 搜索指数</th>
                    <th>大盘份额</th>
                    <th>数据来源</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthPoints.map((r, i) => {
                    const pctOfTotal = totalMonthSearch > 0 ? Math.round((r.numericVal / totalMonthSearch) * 1000) / 10 : 0;
                    return (
                      <tr key={r.sheetId + r.brand + i}>
                        <td><strong>{r.brand}</strong></td>
                        <td><strong style={{ color: '#1e6091' }}>{formatTenThousand(r.value)}</strong></td>
                        <td><span className="section-mini-tag tag-blue">{pctOfTotal}%</span></td>
                        <td>
                          <a href={`https://yimeichuanbo.feishu.cn/wiki/J8bnw5Mx4inxbukp2HYcgjMznJg?sheet=${r.sheetId}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0284c7' }}>
                            打开工作表 ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title="尚未同步竞品月报" text="点击页面顶部同步最新数据，读取各品牌已填写的月份。" />
        )}
      </DashboardSection>
      <DashboardSection title="启萃 · 站内搜索指数趋势" desc="来自周趋势底表，灵犀与聚光指数分别展示。">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '11.5px', color: '#0369a1' }}>灵犀自然搜索最新</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>{compact(lingxiVal)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>自然搜索意图大盘</div>
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '11.5px', color: '#6d28d9' }}>聚光商业搜索最新</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#7c3aed', marginTop: '2px' }}>{compact(spotlightVal)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>商业投放联动大盘</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '11.5px', color: '#15803d' }}>双端搜索聚合总和</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>{compact(totalSearchVal)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>大盘全域搜索池</div>
          </div>
        </div>
        <TimeSeriesChart rows={(data.feishu?.search||[]).slice(-30).map(r=>({...r}))} title="启萃搜索指数" unit="" series={[{key:'lingxi',label:'灵犀',color:'#0284c7'},{key:'spotlight',label:'聚光',color:'#8b5cf6'}]}/>
      </DashboardSection>
      </div>

      {/* 品牌竞争格局卡片 */}
      <DashboardSection
        eyebrow="BRAND LANDSCAPE"
        title="品牌竞争格局"
        desc="横向对比本品与各核心竞品在评论声量、正向率与风险率的综合表现。"
      >
        {brands.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {brands.slice(0, 6).map((row, index) => {
              const comments = num(row.comments);
              const positive = num(row.positive);
              const negative = num(row.negative);
              const posRate = comments ? Math.round((positive / comments) * 1000) / 10 : 0;
              const negRate = comments ? Math.round((negative / comments) * 1000) / 10 : 0;
              const isOwn = String(row.brand).includes('飞鹤') || String(row.brand).includes('启萃') || String(row.brand).includes('本品');
              return (
                <div
                  key={String(row.brand) + '-' + index}
                  style={{
                    background: '#ffffff',
                    border: isOwn ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: isOwn ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isOwn ? '#eff6ff' : '#f1f5f9',
                          color: isOwn ? '#1d4ed8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        {String(row.brand).slice(0, 1)}
                      </span>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>{String(row.brand)}</strong>
                    </div>
                    {isOwn ? (
                      <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        本品重点
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                        TOP 0{index + 1}
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{compact(comments)}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>评论声量</span>
                    </div>
                    {/* 声量进度条 */}
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: Math.max(6, (comments / maxComments) * 100) + '%',
                          background: isOwn ? 'linear-gradient(90deg, #3b82f6, #1d4ed8)' : '#94a3b8',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', borderTop: '1px dashed #f1f5f9', paddingTop: '10px' }}>
                    <span>{num(row.notes)} 篇笔记</span>
                    <span>{compact(row.interactions)} 互动</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>正向率：</span>
                      <strong style={{ color: '#16a34a' }}>{comments ? posRate + '%' : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>风险率：</span>
                      <strong style={{ color: negRate > 5 ? '#dc2626' : '#64748b' }}>{comments ? negRate + '%' : '—'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="暂无竞品数据" text="关键词扫描或添加竞品后将自动生成品牌竞争格局。" />
        )}
      </DashboardSection>

      {/* 品牌横向对比数据明细 */}
      <DashboardSection
        eyebrow="CROSS BRAND COMPARISON"
        title="品牌横向对比明细表"
        desc="多维度拆解品牌内容篇数、评论声量、口碑正负比、阅读与互动效率指标。"
      >
        <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th>品牌 / 关键词</th>
                <th>笔记数</th>
                <th>评论声量</th>
                <th>正向口碑率</th>
                <th>负向风险率</th>
                <th>累计阅读</th>
                <th>累计互动</th>
                <th>预估费用</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((row, index) => {
                const comments = num(row.comments);
                const isOwn = String(row.brand).includes('飞鹤') || String(row.brand).includes('启萃') || String(row.brand).includes('本品');
                return (
                  <tr key={String(row.brand) + '-' + index} style={isOwn ? { background: '#f8fbff' } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: isOwn ? '#1d4ed8' : '#0f172a' }}>{String(row.brand)}</strong>
                        {isOwn && (
                          <StatusBadge status="本品" theme="blue" />
                        )}
                      </div>
                    </td>
                    <td><strong>{num(row.notes)}</strong></td>
                    <td><strong>{compact(comments)}</strong></td>
                    <td>
                      <span style={{ fontWeight: 600, color: comments ? '#16a34a' : '#94a3b8' }}>
                        {comments ? pct(num(row.positive) / comments) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: comments && (num(row.negative) / comments > 0.05) ? '#dc2626' : '#64748b' }}>
                        {comments ? pct(num(row.negative) / comments) : '—'}
                      </span>
                    </td>
                    <td>{compact(row.reads)}</td>
                    <td><strong>{compact(row.interactions)}</strong></td>
                    <td>{num(row.cost) ? '¥' + compact(row.cost) : '—'}</td>
                  </tr>
                );
              })}
              {!brands.length && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="暂无对比明细" text="导入或扫描竞品数据后在此呈现全维度矩阵。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* 竞品策略解读与机会洞察 */}
      <DashboardSection
        eyebrow="STRATEGY MAP"
        title="竞品策略解读与机会洞察"
        desc="基于横向声量格局提炼的策略洞察，指导下一步选题流转与机会跟进。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>声量领先格局</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {brands[0]
                ? String(brands[0].brand) + ' 当前覆盖 ' + num(brands[0].notes) + ' 篇、' + compact(brands[0].comments) + ' 条评论，处于声量优势位。建议持续关注其高热内容方向。'
                : '扫描竞品关键词后生成声量格局诊断。'}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>✨</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>口碑优势归属</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {bestBrand(brands, 'positive')}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>风险与拦截机会</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {bestBrand(brands, 'negative', true)}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>🎯</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>下一步建议动作</strong>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                可下钻同品牌的高热内容切角，结合机会雷达快速沉淀灵感选题。
              </p>
            </div>
            {onSwitchTab && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => onSwitchTab('radar')}
                  className="btn-link"
                  style={{ fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >
                  前往机会雷达追踪关键词 →
                </button>
              </div>
            )}
          </div>
        </div>
      </DashboardSection>

      {/* 补充全盘竞品月报深层情报：商单投入、达人矩阵、14大内容切角热力、品线战略与动作时间轴 */}
      <CompetitorIntelligenceSection intelligence={data.feishu?.intelligence} />
    </div>
  );
}
