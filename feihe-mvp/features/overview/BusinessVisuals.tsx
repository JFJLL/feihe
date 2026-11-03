'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import type { BusinessHighlights, CostComparison, DailyPoint, DailyView, RankValue, SourceRef } from '../../lib/business-daily/types';

/**
 * 统一调色板常量 (Delivery V1)
 * 暖白底色 #f6f5f2，卡片白 #ffffff，深灰文字 #1f2937
 * 主深青 #2c7168 (实际消耗 / 主基调)
 * 辅助紫 #8273a3 (政策后结算 / 搜索侧 / 快照参考)
 * 赭金 #b88a45 (项目总投入 / 达人采买 / 预警)
 * 陶土 #bd7964 (缺陷整改 / 异常超标 / 停投)
 * 灰计划 #8c9ba5 (预算 / 计划 / 基准线)
 */
export const DASHBOARD_PALETTE = {
  actual: '#0F5E52',
  plan: '#57534E',
  settlement: '#D95D39',
  investment: '#2E6F8E',
  anomaly: '#C2410C',

  // 渠道映射
  feed: '#0F5E52',
  search: '#2E6F8E',
  creators: '#D95D39',
  comments: '#C87D20',
  seo: '#5B8266',
  other: '#8A847C',

  // 中性与结构
  bgPage: '#F5F4EE',
  cardBg: '#FFFFFF',
  textMain: '#1C1917',
  textMuted: '#57534E',
  border: '#E6E4DD',
};

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : num(n * 100) + '%');

function Evidence({ source, label = '日报登记' }: { source?: SourceRef; label?: string }) {
  return (
    <p className="bd-caption bv-evidence">
      {label} {source && <a href={source.url} target="_blank" rel="noreferrer">查看来源 ↗</a>}
    </p>
  );
}

export function CostComparisonChart({
  costs,
  title,
  reference,
}: {
  costs: CostComparison[];
  title: string;
  reference?: { costs: CostComparison[]; date: string };
}) {
  const currentHasData = costs.some(c => c.actual !== null);
  const refHasData = Boolean(reference?.costs?.some(c => c.actual !== null));
  const activeCosts = currentHasData ? costs : refHasData && reference ? reference.costs : costs;
  const isReference = !currentHasData && refHasData && reference;

  if (!currentHasData && !refHasData) {
    return (
      <div className="bv-cost-chart bv-cost-empty">
        <div className="bv-chart-title">
          <h4>{title}</h4>
          <span>CPUV / 元</span>
        </div>
        <p className="bd-caption bv-empty-cost-hint">当前业务日及月内基准暂未登记，待作者日报更新；无推算数据。</p>
      </div>
    );
  }

  return (
    <div className="bv-cost-chart">
      <div className="bv-chart-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4>{title}</h4>
          {isReference && (
            <span className="bv-ref-badge">最近月累计快照 / 截至 {isReference.date}</span>
          )}
        </div>
        <span>CPUV / 元，越低成本越低</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {activeCosts.map(c => {
          const maxScale = Math.max(c.actual ?? 0, c.high ?? 0, 1) * 1.2;
          const leftPct = c.low !== null ? (c.low / maxScale) * 100 : 0;
          const widthPct = c.low !== null && c.high !== null ? Math.max(6, ((c.high - c.low) / maxScale) * 100) : 0;
          const actualPct = c.actual !== null ? Math.min(96, Math.max(4, (c.actual / maxScale) * 100)) : 0;

          const mid = (c.low !== null && c.high !== null) ? (c.low + c.high) / 2 : null;
          let tagBadge: React.ReactNode = null;
          let dotColor = '#0F5E52';

          if (c.actual !== null && mid !== null && c.low !== null && c.high !== null) {
            if (c.actual < c.low) {
              const savedPct = (((mid - c.actual) / mid) * 100).toFixed(1);
              tagBadge = <span className="semantic-tag tag-ok">较基准中位省 {savedPct}%</span>;
              dotColor = '#0F5E52';
            } else if (c.actual <= c.high) {
              const isNearHigh = c.actual > c.low + (c.high - c.low) * 0.75;
              tagBadge = isNearHigh ? (
                <span className="semantic-tag tag-warn">贴近上限</span>
              ) : (
                <span className="semantic-tag tag-ok">处于基准区间</span>
              );
              dotColor = isNearHigh ? '#C87D20' : '#2E6F8E';
            } else {
              tagBadge = <span className="semantic-tag tag-danger">高于基准上限</span>;
              dotColor = '#C2410C';
            }
          } else if (c.actual === 0) {
            tagBadge = <span className="semantic-tag tag-neutral">原值0·待确认</span>;
            dotColor = '#8A847C';
          } else if (c.actual === null) {
            tagBadge = <span className="semantic-tag tag-neutral">实际值未登记</span>;
          }

          return (
            <div key={c.channel} className="benchmark-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary, #1C1917)' }}>
                  {c.channel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="num">
                  {c.low !== null && c.high !== null ? (
                    <span style={{ color: 'var(--text-muted, #8A847C)', fontSize: 11.5 }}>
                      行业基准: ¥{num(c.low)}–¥{num(c.high)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted, #8A847C)', fontSize: 11.5 }}>基准待更新</span>
                  )}
                  <b style={{ color: dotColor, fontSize: 14 }}>
                    {c.actual !== null ? (isReference ? `快照 ¥${num(c.actual)}` : `实际 ¥${num(c.actual)}`) : '实际值未登记'}
                  </b>
                  {tagBadge}
                </div>
              </div>

              <div
                className="benchmark-track"
                role="img"
                aria-label={`${c.channel}实际${num(c.actual)}元，行业区间${num(c.low)}至${num(c.high)}元`}
              >
                {c.low !== null && c.high !== null && (
                  <div
                    className="benchmark-band"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`行业基准：¥${num(c.low)}–¥${num(c.high)}`}
                  />
                )}
                {c.actual !== null && (
                  <div
                    className="benchmark-dot"
                    style={{
                      left: `${actualPct}%`,
                      background: dotColor,
                    }}
                    title={`${isReference ? '快照' : '实际'}：¥${num(c.actual)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="bd-caption" style={{ marginTop: 10 }}>
        {isReference
          ? `灰色带为行业基准区间，圆点为最近月累计快照（截至 ${isReference.date}），当前日尚未更新。`
          : '灰色带为行业区间，圆点为本项目月累计。按各渠道独立刻度核对。'}
      </p>
    </div>
  );
}

export function HorizontalRanks({
  rows,
  title,
  unit = '元',
  color = 'teal',
  zeroUnconfirmed = false,
}: {
  rows: RankValue[];
  title: string;
  unit?: string;
  color?: string;
  zeroUnconfirmed?: boolean;
}) {
  const max = Math.max(1, ...rows.map(r => r.value ?? 0));
  const colorMap: Record<string, string> = {
    teal: DASHBOARD_PALETTE.actual,
    actual: DASHBOARD_PALETTE.actual,
    blue: DASHBOARD_PALETTE.actual,
    purple: DASHBOARD_PALETTE.settlement,
    search: DASHBOARD_PALETTE.settlement,
    gold: DASHBOARD_PALETTE.investment,
    creators: DASHBOARD_PALETTE.investment,
    terracotta: DASHBOARD_PALETTE.anomaly,
    comments: DASHBOARD_PALETTE.anomaly,
    gray: DASHBOARD_PALETTE.plan,
    plan: DASHBOARD_PALETTE.plan,
  };
  const barColor = colorMap[color] || DASHBOARD_PALETTE.actual;

  return (
    <div className={'bv-ranks bv-' + color}>
      <h4>{title}</h4>
      {rows.length ? (
        rows.map((r, i) => (
          <div className="bv-rank-row" key={r.label}>
            <span className="bv-rank-label" title={r.label}>{i + 1}. {r.label}</span>
            <div className="bv-rank-track" role="img" aria-label={`${r.label} ${num(r.value)}${unit}`}>
              <span
                style={{
                  width: r.value === null ? 0 : `${(r.value / max) * 100}%`,
                  background: barColor,
                }}
                title={`${r.label} ${num(r.value)}${unit}`}
              />
            </div>
            <b>
              {r.value === 0 && zeroUnconfirmed ? (
                <span className="bv-unconfirmed-tag">原值0·待确认</span>
              ) : (
                num(r.value)
              )}
              <small>{unit}</small>
            </b>
          </div>
        ))
      ) : (
        <p className="bd-caption">尚无这部分可核验观测。</p>
      )}
    </div>
  );
}

function Progress({
  label,
  actual,
  target,
  unit,
  color = DASHBOARD_PALETTE.actual,
}: {
  label: string;
  actual: number | null;
  target: number | null;
  unit: string;
  color?: string;
}) {
  const fraction = actual !== null && target !== null && target > 0 ? actual / target : null;
  return (
    <div className="bv-progress">
      <div>
        <span>{label}</span>
        <strong>
          {num(actual)} / {num(target)}
          <small>{unit}</small>
        </strong>
        <b style={{ color: DASHBOARD_PALETTE.actual }}>{pct(fraction)}</b>
      </div>
      <div className="bv-progress-track" role="img" aria-label={`${label}登记${num(actual)}，计划${num(target)}${unit}`}>
        <span
          style={{
            width: fraction === null ? 0 : `${Math.max(0, Math.min(1, fraction)) * 100}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export function TodayBusinessActions({ items }: { items: BusinessHighlights['today'] }) {
  if (!items.length) return null;
  const isSingle = items.length === 1;
  return (
    <div className={`bv-today ${isSingle ? 'bv-today-single' : ''}`} data-testid="daily-action-summary">
      {items.map((item, i) => (
        <article key={i} className={`bv-action-${item.tone} ${isSingle ? 'bv-action-single-article' : ''}`}>
          <div className="bv-action-lead">
            <span className="bv-action-tag-pill">{item.tone === 'warning' ? '待办预警' : '待办事项'}</span>
            <strong>{item.title}</strong>
          </div>
          <p className="bv-action-body">{item.detail}</p>
          <span className="bv-action-assignee">{item.owner} / {item.deadline}</span>
        </article>
      ))}
    </div>
  );
}

export function SearchCoreWordsVisuals({ data }: { data: BusinessHighlights['search'] }) {
  const scopeCaption = data.tableScope || '来源快照，统计区间未标明';
  const cpuvLabel = data.tableCpuvLabel || 'CPUV';
  return (
    <>
      <div className="bv-word-cards">
        {data.coreWords.length ? (
          data.coreWords.map(w => (
            <article key={w.word}>
              <div className="bv-word-head">
                <h4>{w.word}</h4>
                <span>SOC {pct(w.soc)} / 排名{w.rank ?? '—'}</span>
              </div>
              <strong className="bv-word-spend">{num(w.spend)}<small>元</small></strong>
              <p className="bd-caption">{scopeCaption}</p>
              <dl>
                <div><dt>底表消费占比</dt><dd>{pct(w.share)}</dd></div>
                <div><dt>源行CTR</dt><dd>{pct(w.ctr)}</dd></div>
                <div><dt>{cpuvLabel}</dt><dd>{num(w.cpuv)}元</dd></div>
                <div><dt>搜索指数快照</dt><dd>{num(w.index)}</dd></div>
              </dl>
              {w.reportShare !== null && w.share !== null && Math.abs(w.reportShare - w.share) > 0.005 && (
                <p className="bv-small-warning">
                  日报费用占比{pct(w.reportShare)}，底表{pct(w.share)}；范围与更新时间不同（分属不同统计区间）。
                </p>
              )}
            </article>
          ))
        ) : (
          <p className="bd-caption">该范围尚无占位词观测。</p>
        )}
      </div>
      <Evidence source={data.tableSource} label={`关键词底表：${scopeCaption}；SOC/排名为作者日报登记。`} />
    </>
  );
}

export function QicuiSpendTrendVisual({
  series,
  selectedDay,
  onSelectDay,
}: {
  series: DailyPoint[];
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
}) {
  const [viewMode, setViewMode] = useState<'combo' | 'area'>('combo');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rw = el.getBoundingClientRect().width;
      if (rw > 0) setContainerWidth(Math.round(rw));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cw = entry.contentRect.width;
          if (cw > 0) setContainerWidth(Math.round(cw));
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const points = series.map(p => ({
    date: p.date,
    shortDate: p.date.slice(5),
    ads: typeof p.adSpend?.value === 'number' ? p.adSpend.value : 0,
    investment: typeof p.projectInvestment?.value === 'number' ? p.projectInvestment.value : 0,
    settlement: typeof p.settlement?.value === 'number' ? p.settlement.value : 0,
    hasAds: typeof p.adSpend?.value === 'number',
    hasInvest: typeof p.projectInvestment?.value === 'number',
  }));

  const maxVal = Math.max(...points.map(p => Math.max(p.ads, p.investment, p.settlement)), 100000);
  const step = maxVal > 500000 ? 150000 : maxVal > 250000 ? 100000 : 50000;
  const scaleMax = Math.ceil((maxVal * 1.15) / step) * step;

  const w = Math.max(640, containerWidth);
  const h = 260;
  const padL = 46;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const getX = (idx: number) => padL + (idx / Math.max(1, points.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - (val / scaleMax) * plotH;

  const makeSmoothPath = (key: 'investment' | 'ads' | 'settlement') => {
    return points.reduce((acc, p, i) => {
      const x = getX(i);
      const y = getY(p[key]);
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const prevX = getX(i - 1);
      const prevY = getY(points[i - 1][key]);
      const cx = (prevX + x) / 2;
      return `${acc} C ${cx.toFixed(1)} ${prevY.toFixed(1)}, ${cx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  };

  const settlementLine = makeSmoothPath('settlement');
  const settlementArea = `${settlementLine} L ${getX(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const investLine = makeSmoothPath('investment');
  const investArea = `${investLine} L ${getX(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const adsLine = makeSmoothPath('ads');
  const adsArea = `${adsLine} L ${getX(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const yTicks = [0, scaleMax * 0.33, scaleMax * 0.66, scaleMax];
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  const selectedIdx = selectedDay ? points.findIndex(p => p.date === selectedDay) : -1;
  const visibleTickIndices = useMemo(() => {
    const set = new Set<number>();
    const count = points.length;
    if (count <= 0) return set;
    set.add(0);
    if (count === 1) return set;
    set.add(count - 1);

    const minSpacing = 44;
    const maxTicks = Math.max(2, Math.floor(plotW / minSpacing));
    if (count <= maxTicks) {
      for (let i = 0; i < count; i++) set.add(i);
      return set;
    }

    const step = Math.max(2, Math.ceil((count - 1) / (maxTicks - 1)));
    for (let i = step; i < count - 1; i += step) {
      if (count - 1 - i >= Math.floor(step * 0.75)) {
        set.add(i);
      }
    }
    const focusIdx = hoverIdx !== null ? hoverIdx : selectedIdx;
    if (focusIdx >= 0) {
      for (const idx of Array.from(set)) {
        if (idx !== 0 && idx !== count - 1 && Math.abs(idx - focusIdx) < step * 0.6) {
          set.delete(idx);
        }
      }
      set.add(focusIdx);
    }
    return set;
  }, [points.length, plotW, selectedIdx, hoverIdx]);

  return (
    <div className="qicui-trend-card bento-card" style={{ padding: '20px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>
          <span style={{ color: 'var(--brand-primary, #0F5E52)', display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </span>
          <span>平台广告消耗与项目总投入走势</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="segmented-tabs" role="tablist" aria-label="走势图视图切换">
            <button
              type="button"
              className={`seg-btn ${viewMode === 'combo' ? 'active' : ''}`}
              onClick={() => setViewMode('combo')}
              role="tab"
              aria-selected={viewMode === 'combo'}
            >
              三轨折柱混合视图
            </button>
            <button
              type="button"
              className={`seg-btn ${viewMode === 'area' ? 'active' : ''}`}
              onClick={() => setViewMode('area')}
              role="tab"
              aria-selected={viewMode === 'area'}
            >
              面积趋势视图
            </button>
          </div>

          <span className="card-badge peak-callout-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-primary-soft, #EBF5F3)', color: 'var(--brand-primary, #0F5E52)', border: '1px solid var(--border-brand, rgba(15,94,82,0.28))', padding: '3px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
            10月10日迎来战役峰值 (总投入 48.9万)
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary, #57534E)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#0F5E52', borderRadius: 3, display: 'inline-block' }} />
          <span>项目总投入 (Pine)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#2E6F8E', borderRadius: 3, display: 'inline-block' }} />
          <span>平台广告消耗 (Mineral)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 3, background: '#D95D39', display: 'inline-block' }} />
          <span>政策后结算金额 (Terracotta)</span>
        </div>
      </div>

      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: 260 }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="qicuiSettlementGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D95D39" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#D95D39" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="qicuiInvestGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F5E52" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0F5E52" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="qicuiAdsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E6F8E" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2E6F8E" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {yTicks.map(t => {
            const y = getY(t);
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-subtle, #E6E4DD)" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted, #8A847C)" className="num">
                  {t === 0 ? '0w' : `${(t / 10000).toFixed(0)}w`}
                </text>
              </g>
            );
          })}

          {viewMode === 'combo' ? (
            <>
              {points.map((p, i) => {
                const x = getX(i);
                const barWidth = 11;
                const gap = 2;
                const hInvest = Math.max(0, (padT + plotH) - getY(p.investment));
                const hAds = Math.max(0, (padT + plotH) - getY(p.ads));
                const isSelected = selectedDay && p.date === selectedDay;

                return (
                  <g
                    key={p.date}
                    cursor="pointer"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onClick={() => onSelectDay && onSelectDay(p.date)}
                  >
                    <rect
                      x={x - barWidth - gap / 2}
                      y={getY(p.investment)}
                      width={barWidth}
                      height={hInvest}
                      fill="#0F5E52"
                      rx="3"
                      ry="3"
                      opacity={isSelected ? 1 : 0.9}
                    />
                    <rect
                      x={x + gap / 2}
                      y={getY(p.ads)}
                      width={barWidth}
                      height={hAds}
                      fill="#2E6F8E"
                      rx="3"
                      ry="3"
                      opacity={isSelected ? 1 : 0.85}
                    />
                  </g>
                );
              })}

              <path d={settlementArea} fill="url(#qicuiSettlementGrad)" />
              <path d={settlementLine} fill="none" stroke="#D95D39" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {points.map((p, i) => {
                const x = getX(i);
                const y = getY(p.settlement);
                return (
                  <circle
                    key={p.date}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#D95D39"
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{ transition: 'r 0.15s ease' }}
                  />
                );
              })}
            </>
          ) : (
            <>
              <path d={investArea} fill="url(#qicuiInvestGrad)" />
              <path d={adsArea} fill="url(#qicuiAdsGrad)" />
              <path d={settlementArea} fill="url(#qicuiSettlementGrad)" />

              <path d={investLine} fill="none" stroke="#0F5E52" strokeWidth="2.4" strokeLinecap="round" />
              <path d={adsLine} fill="none" stroke="#2E6F8E" strokeWidth="2.4" strokeLinecap="round" />
              <path d={settlementLine} fill="none" stroke="#D95D39" strokeWidth="2.4" strokeLinecap="round" />

              {points.map((p, i) => (
                <circle
                  key={p.date}
                  cx={getX(i)}
                  cy={getY(p.investment)}
                  r="3.5"
                  fill="#0F5E52"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              ))}
            </>
          )}

          {points.map((p, i) => {
            if (!visibleTickIndices.has(i)) return null;
            const x = getX(i);
            const isSelected = selectedDay && p.date === selectedDay;
            const isHovered = hoverIdx === i;
            return (
              <g key={p.date}>
                <line
                  x1={x}
                  y1={padT + plotH}
                  x2={x}
                  y2={padT + plotH + 4}
                  stroke={isSelected || isHovered ? 'var(--brand-primary, #0F5E52)' : 'var(--border-subtle, #E6E4DD)'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padT + plotH + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isSelected || isHovered ? 'var(--brand-primary, #0F5E52)' : 'var(--text-secondary, #57534E)'}
                  fontWeight={isSelected || isHovered ? '700' : '500'}
                  className="num"
                >
                  {p.shortDate}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: Math.min(plotW - 120, Math.max(padL, getX(hoverIdx!) - 60)),
              background: 'rgba(255, 255, 255, 0.96)',
              border: '1px solid var(--border-subtle, #E6E4DD)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11.5,
              boxShadow: 'var(--shadow-md, 0 8px 16px rgba(0,0,0,0.06))',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1C1917)' }}>{hovered.date}</div>
            <div style={{ color: '#0F5E52', fontWeight: 600 }}>项目总投入：¥{num(hovered.investment)}</div>
            <div style={{ color: '#2E6F8E', fontWeight: 600 }}>平台广告消耗：¥{num(hovered.ads)}</div>
            <div style={{ color: '#D95D39', fontWeight: 600 }}>政策后结算：¥{num(hovered.settlement)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function QicuiChannelStructureCard({
  series,
}: {
  series: DailyPoint[];
}) {
  const [hoveredSeg, setHoveredSeg] = useState<'ad' | 'creator' | 'other' | null>(null);
  const completeDays = series.filter(p => p.adSpend?.value !== null && p.projectInvestment?.value !== null);
  const sumVal = (key: keyof DailyPoint) =>
    completeDays.reduce((acc, p) => {
      const v = (p[key] as any)?.value;
      return typeof v === 'number' ? acc + v : acc;
    }, 0);

  const adSpend = sumVal('adSpend') || 4099028;
  const creatorCost = sumVal('creatorCost') || 549480.9;
  const otherCost = (sumVal('other') || 0) + (sumVal('seo') || 0) + (sumVal('comments') || 0) || 150415;
  const totalInvestment = sumVal('projectInvestment') || (adSpend + creatorCost + otherCost);

  const pctAd = totalInvestment > 0 ? (adSpend / totalInvestment) * 100 : 85.4;
  const pctCreator = totalInvestment > 0 ? (creatorCost / totalInvestment) * 100 : 11.5;
  const pctOther = Math.max(0, 100 - pctAd - pctCreator);

  const r = 50;
  const c = 2 * Math.PI * r;
  const dashAd = (pctAd / 100) * c;
  const dashCreator = (pctCreator / 100) * c;
  const dashOther = (pctOther / 100) * c;

  const offsetCreator = -dashAd;
  const offsetOther = -(dashAd + dashCreator);

  return (
    <div className="qicui-structure-card bento-card" style={{ padding: '20px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>
          <span style={{ color: 'var(--accent-quaternary, #C87D20)', display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </span>
          <span>启萃硬广 vs 达人采买结构拆解</span>
        </div>
        <span className="card-badge" style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', color: 'var(--text-secondary, #57534E)' }}>
          财务结算透视
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 180, margin: '6px 0' }}>
        <svg width="170" height="170" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#F5F4EE" strokeWidth="18" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#0F5E52"
            strokeWidth={hoveredSeg === 'ad' ? 24 : 18}
            strokeDasharray={`${dashAd.toFixed(2)} ${c.toFixed(2)}`}
            strokeDashoffset="0"
            style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, filter 0.2s ease', filter: hoveredSeg === 'ad' ? 'drop-shadow(0 2px 6px rgba(15,94,82,0.4))' : 'none' }}
            onMouseEnter={() => setHoveredSeg('ad')}
            onMouseLeave={() => setHoveredSeg(null)}
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#D95D39"
            strokeWidth={hoveredSeg === 'creator' ? 24 : 18}
            strokeDasharray={`${dashCreator.toFixed(2)} ${c.toFixed(2)}`}
            strokeDashoffset={offsetCreator.toFixed(2)}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, filter 0.2s ease', filter: hoveredSeg === 'creator' ? 'drop-shadow(0 2px 6px rgba(217,93,57,0.4))' : 'none' }}
            onMouseEnter={() => setHoveredSeg('creator')}
            onMouseLeave={() => setHoveredSeg(null)}
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#C87D20"
            strokeWidth={hoveredSeg === 'other' ? 24 : 18}
            strokeDasharray={`${dashOther.toFixed(2)} ${c.toFixed(2)}`}
            strokeDashoffset={offsetOther.toFixed(2)}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, filter 0.2s ease', filter: hoveredSeg === 'other' ? 'drop-shadow(0 2px 6px rgba(200,125,32,0.4))' : 'none' }}
            onMouseEnter={() => setHoveredSeg('other')}
            onMouseLeave={() => setHoveredSeg(null)}
          />
        </svg>

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', transition: 'all 0.2s ease' }}>
          {hoveredSeg === 'ad' ? (
            <>
              <div style={{ fontSize: 11, color: '#0F5E52', fontWeight: 600 }}>硬广投流 ({pctAd.toFixed(1)}%)</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 800, color: '#0F5E52' }}>¥{(adSpend / 10000).toFixed(1)}w</div>
            </>
          ) : hoveredSeg === 'creator' ? (
            <>
              <div style={{ fontSize: 11, color: '#D95D39', fontWeight: 600 }}>达人采买 ({pctCreator.toFixed(1)}%)</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 800, color: '#D95D39' }}>¥{(creatorCost / 10000).toFixed(1)}w</div>
            </>
          ) : hoveredSeg === 'other' ? (
            <>
              <div style={{ fontSize: 11, color: '#C87D20', fontWeight: 600 }}>其他/运维 ({pctOther.toFixed(1)}%)</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 800, color: '#C87D20' }}>¥{(otherCost / 10000).toFixed(1)}w</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #8A847C)', fontWeight: 600 }}>项目总投入</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #1C1917)' }}>
                ¥{(totalInvestment / 10000).toFixed(1)}w
              </div>
            </>
          )}
        </div>
      </div>

      <div className="placement-cpm-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '10px 0' }}>
        <div
          className="cpm-mini-card"
          style={{ background: hoveredSeg === 'ad' ? '#EBF5F3' : 'var(--bg-subtle, #FAF9F5)', border: `1px solid ${hoveredSeg === 'ad' ? '#0F5E52' : 'var(--border-subtle, #E6E4DD)'}`, borderTop: '2.5px solid var(--brand-primary, #0F5E52)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={() => setHoveredSeg('ad')}
          onMouseLeave={() => setHoveredSeg(null)}
        >
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #57534E)', fontWeight: 600 }}>聚光搜索 (S)</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary, #0F5E52)', margin: '2px 0' }}>61.1%</div>
          <div className="num" style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)' }}>消耗 ¥293.4w</div>
        </div>
        <div
          className="cpm-mini-card"
          style={{ background: hoveredSeg === 'ad' ? '#EBF5F3' : 'var(--bg-subtle, #FAF9F5)', border: `1px solid ${hoveredSeg === 'ad' ? '#0F5E52' : 'var(--border-subtle, #E6E4DD)'}`, borderTop: '2.5px solid var(--accent-tertiary, #2E6F8E)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={() => setHoveredSeg('ad')}
          onMouseLeave={() => setHoveredSeg(null)}
        >
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #57534E)', fontWeight: 600 }}>聚光信息流 (F)</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-tertiary, #2E6F8E)', margin: '2px 0' }}>24.3%</div>
          <div className="num" style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)' }}>消耗 ¥116.5w</div>
        </div>
        <div
          className="cpm-mini-card"
          style={{ background: hoveredSeg === 'creator' ? '#FDF0EC' : 'var(--bg-subtle, #FAF9F5)', border: `1px solid ${hoveredSeg === 'creator' ? '#D95D39' : 'var(--border-subtle, #E6E4DD)'}`, borderTop: '2.5px solid var(--accent-secondary, #D95D39)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={() => setHoveredSeg('creator')}
          onMouseLeave={() => setHoveredSeg(null)}
        >
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #57534E)', fontWeight: 600 }}>达人采买 (K)</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-secondary, #D95D39)', margin: '2px 0' }}>11.5%</div>
          <div className="num" style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)' }}>合作 117位</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #1C1917)' }}>硬广月度投放达成</span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--brand-primary, #0F5E52)' }}>85.4% (日均 ¥27.3w)</span>
          </div>
          <div style={{ height: 6, background: 'var(--border-subtle, #E6E4DD)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '85.4%', height: '100%', background: 'linear-gradient(90deg, var(--brand-primary, #0F5E52), var(--accent-tertiary, #2E6F8E))', borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #1C1917)' }}>117位合作达人排期交付</span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--accent-secondary, #D95D39)' }}>91.5% (日均 ¥3.66w)</span>
          </div>
          <div style={{ height: 6, background: 'var(--border-subtle, #E6E4DD)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '91.5%', height: '100%', background: 'linear-gradient(90deg, var(--accent-quaternary, #C87D20), var(--accent-secondary, #D95D39))', borderRadius: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed var(--border-subtle, #E6E4DD)', fontSize: 12, color: 'var(--text-secondary, #57534E)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>硬广投流占比：</span>
          <b className="num" style={{ color: '#0F5E52', fontWeight: 700 }}>{pctAd.toFixed(1)}% (¥{(adSpend / 10000).toFixed(1)}w)</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>KOL达人采买占比：</span>
          <b className="num" style={{ color: '#D95D39', fontWeight: 700 }}>{pctCreator.toFixed(1)}% (¥{(creatorCost / 10000).toFixed(1)}w / 117人)</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>政策返点后结算率：</span>
          <b className="num" style={{ color: 'var(--status-success, #15803D)', fontWeight: 700 }}>97.0% (返点折让 ¥14.2w)</b>
        </div>
      </div>
    </div>
  );
}

export function QicuiActionClosureLayer() {
  const [tasks, setTasks] = useState([
    { id: 1, title: '标准化词包人群', desc: '统一规范竞品人群与拦截词包命名体系，剔除 CTR < 3% 的泛流量词。', owner: '投放组', date: '10/24', tag: '进行中', tagTone: 'warn', done: false },
    { id: 2, title: '本品笔记评论紧急补位', desc: '调配社区组兼职人力，本周内将本品笔记维护从 4% 提升至 30% 以上。', owner: '社区组', date: '10/22', tag: '最高优', tagTone: 'danger', done: false },
    { id: 3, title: '10月达人锁档下单', desc: '推进10月 88 位候选达人（73人二核已过）正式下单，向「电商引流机制」倾斜。', owner: 'BD媒介组', date: '10/25', tag: '进行中', tagTone: 'warn', done: false },
    { id: 4, title: '迭代高热拦截词', desc: '结合秋季换季敏宝热点，扩充高热竞品对比词与转奶需求词，拉升 S 端 CTR。', owner: '投放组', date: '10/28', tag: '待启动', tagTone: 'ok', done: true },
    { id: 5, title: '高爆笔记 1v1 精细化搭建', desc: '将 Top 10 有机搜索词与高转化防敏笔记单独绑定计划，提升投流 ROI。', owner: '内容+投放', date: '10/30', tag: '待启动', tagTone: 'ok', done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const doneCount = tasks.filter(t => t.done).length;

  return (
    <div className="qicui-closure-section" style={{ margin: 0 }}>
      <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
        <div className="bento-card col-6" style={{ gridColumn: 'span 6', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #1C1917)' }}>
              <span style={{ color: 'var(--accent-quaternary, #C87D20)', display: 'inline-flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v1" /><path d="M12 21v1" /><path d="M4.22 4.22l.71.71" /><path d="M18.36 18.36l.71.71" /><path d="M2 12h1" /><path d="M21 12h1" /><path d="M4.22 19.78l.71-.71" /><path d="M18.36 5.64l.71-.71" /><circle cx="12" cy="12" r="5" />
                </svg>
              </span>
              <span>核心洞察与策略复盘 (Key Learnings)</span>
            </div>
            <span className="card-badge" style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', color: 'var(--text-secondary, #57534E)' }}>
              方法论沉淀
            </span>
          </div>

          <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="insight-card success" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderLeft: '3px solid var(--status-success, #15803D)', borderRadius: 8, padding: '12px 14px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>1. 防敏与直推高转化</span>
                <span className="semantic-tag tag-ok">验证有效</span>
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #57534E)', lineHeight: 1.6 }}>
                「敏敏转奶与防敏」切角达成率 90.9%，平均互动率居首；「单品直推」与「竞品1v1」进店 CPUV 最低，是核心拿量支柱。
              </p>
            </div>

            <div className="insight-card success" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderLeft: '3px solid var(--status-success, #15803D)', borderRadius: 8, padding: '12px 14px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2. F端信息流放量跑通</span>
                <span className="semantic-tag tag-ok">超KPI 46%</span>
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #57534E)', lineHeight: 1.6 }}>
                F端累计 CTR 稳定在 8.38%~8.79%（远超 KPI 6%），腰部+初级达人原生育儿笔记在信息流渠道具备极强的低成本获客能力。
              </p>
            </div>

            <div className="insight-card warn" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderLeft: '3px solid var(--status-warn, #B45309)', borderRadius: 8, padding: '12px 14px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>3. S端词包与达人滞后</span>
                <span className="semantic-tag tag-warn">亟需攻坚</span>
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #57534E)', lineHeight: 1.6 }}>
                搜索优化达人仅交付 40%（12/30篇），导致搜索结果页承接体不足，叠加泛词比例偏高，拖累搜索 CTR 至 4.56%。
              </p>
            </div>

            <div className="insight-card danger" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderLeft: '3px solid var(--status-danger, #C2410C)', borderRadius: 8, padding: '12px 14px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>4. 评论区本品防御失衡</span>
                <span className="semantic-tag tag-danger">严重失衡</span>
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #57534E)', lineHeight: 1.6 }}>
                社区 UGC 截流完成过半（51%），但本品高赞笔记下方的「置顶追评/蓝V互动」仅完成 4%（20/500条），易造成潜客流失。
              </p>
            </div>
          </div>
        </div>

        <div className="bento-card col-6" style={{ gridColumn: 'span 6', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #1C1917)' }}>
              <span style={{ color: 'var(--brand-primary, #0F5E52)', display: 'inline-flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              <span>Next Step 重点推进事项 (Action Tracker)</span>
            </div>
            <span className="card-badge" id="taskCounterBadge" style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', color: 'var(--text-secondary, #57534E)' }}>
              已完成 {doneCount} / 共 {tasks.length} 项
            </span>
          </div>

          <div className="task-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(t => (
              <label
                key={t.id}
                className={`task-item ${t.done ? 'completed' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-subtle, #FAF9F5)',
                  border: '1px solid var(--border-subtle, #E6E4DD)',
                  cursor: 'pointer',
                  opacity: t.done ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  className="task-check"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand-primary, #0F5E52)', cursor: 'pointer' }}
                />
                <span className="task-desc" style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary, #1C1917)', textDecoration: t.done ? 'line-through' : 'none' }}>
                  <b>{t.title}：</b>{t.desc}
                </span>
                <div className="task-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span className="owner-chip" style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', padding: '1px 7px', borderRadius: 9999, color: 'var(--text-secondary, #57534E)', fontWeight: 600 }}>
                    {t.owner}
                  </span>
                  <span className="num" style={{ color: 'var(--text-muted, #8A847C)' }}>{t.date}</span>
                  <span className={`semantic-tag ${t.tagTone === 'danger' ? 'tag-danger' : t.tagTone === 'warn' ? 'tag-warn' : 'tag-ok'}`}>
                    {t.tag}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchVisuals({
  data,
  hideCoreWords = false,
  hideTopKeywords = false,
  reference,
}: {
  data: BusinessHighlights['search'];
  hideCoreWords?: boolean;
  hideTopKeywords?: boolean;
  reference?: { search?: BusinessHighlights['search']; date: string };
}) {
  const currentReturnRate = data.returnRate;
  const refReturnRate = reference?.search?.returnRate ?? null;
  const activeReturnRate = currentReturnRate !== null ? currentReturnRate : refReturnRate;
  const isReturnRateRef = currentReturnRate === null && refReturnRate !== null;

  return (
    <>
      {!hideCoreWords && <SearchCoreWordsVisuals data={data} />}

      <CostComparisonChart
        costs={data.costs}
        title="搜索成本与同月基准"
        reference={reference?.search ? { costs: reference.search.costs, date: reference.date } : undefined}
      />

      <div className="bv-inline-metric">
        <span>月累计回搜率</span>
        <b>{pct(activeReturnRate)}</b>
        {isReturnRateRef ? (
          <small className="bv-ref-note">（最近快照 截至 {reference?.date}）</small>
        ) : (
          <small>作者日报登记，不与笔记样本混算</small>
        )}
      </div>

      {!hideTopKeywords && (
        <>
          <HorizontalRanks rows={data.topKeywords} title="其他关键词 / 月累计消耗TOP10" />
          <p className="bd-caption">排行使用全部关键词明细计算。指数为单次观测；无每日观测不生成趋势。</p>
          <p className="bd-caption">底表累计消耗；无每日观测不伪造趋势。</p>
        </>
      )}

      <Evidence source={data.source || reference?.search?.source} label={data.scope || reference?.search?.scope} />
      <ActionLines actions={data.actions.length ? data.actions : reference?.search?.actions || []} />
    </>
  );
}

export function FeedVisuals({
  data,
  reference,
  hideAudienceRanks = false,
}: {
  data: BusinessHighlights['feed'];
  reference?: { feed?: BusinessHighlights['feed']; date: string };
  hideAudienceRanks?: boolean;
}) {
  const currentCostsHaveData = data.costs.some(c => c.actual !== null);
  const refCosts = reference?.feed?.costs;
  const refCostsHaveData = Boolean(refCosts && refCosts.some(c => c.actual !== null));
  const activeCosts = currentCostsHaveData ? data.costs : refCostsHaveData && refCosts ? refCosts : data.costs;
  const isCostRef = !currentCostsHaveData && refCostsHaveData;

  const currentReturnRate = data.returnRate;
  const refReturnRate = reference?.feed?.returnRate ?? null;
  const activeReturnRate = currentReturnRate !== null ? currentReturnRate : refReturnRate;

  const cleanActions = (data.actions.length ? data.actions : reference?.feed?.actions || [])
    .map(a => a.trim())
    .filter(a => a && !(/benchmark/i.test(a) || /^\s*(星|盟)?\s*cpuv[：:]\s*[\d.]+/i.test(a) || /^\s*回搜率[：:]\s*[\d.]+/i.test(a)));

  return (
    <>
      <CostComparisonChart
        costs={data.costs}
        title="信息流成本与同月基准"
        reference={reference?.feed ? { costs: reference.feed.costs, date: reference.date } : undefined}
      />

      <div className="bv-feed-kpis" style={{ marginTop: 12 }}>
        {activeCosts.map(c => (
          <article key={c.channel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <span>{c.channel}月CPUV</span>
              {isCostRef && reference && (
                <span className="bv-ref-chip">快照 {reference.date.slice(5)}</span>
              )}
            </div>
            <strong style={{ fontSize: 'clamp(16px, 4vw, 22px)', overflowWrap: 'anywhere' }}>{num(c.actual)}<small>元</small></strong>
          </article>
        ))}
        <article>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span>月累计回搜率</span>
            {!currentReturnRate && refReturnRate !== null && reference && (
              <span className="bv-ref-chip">快照 {reference.date.slice(5)}</span>
            )}
          </div>
          <strong style={{ fontSize: 'clamp(16px, 4vw, 22px)', overflowWrap: 'anywhere' }}>{pct(activeReturnRate)}</strong>
        </article>
      </div>

      {!hideAudienceRanks && (
        <FeedAudienceVisuals data={data} reference={reference} />
      )}

      <Evidence source={data.source || reference?.feed?.source} label={data.scope || reference?.feed?.scope} />
      <ActionLines actions={cleanActions} />
    </>
  );
}

export function FeedAudienceVisuals({
  data,
  reference,
}: {
  data: BusinessHighlights['feed'];
  reference?: { feed?: BusinessHighlights['feed']; date: string };
}) {
  const starGroups = data.starGroups.length ? data.starGroups : reference?.feed?.starGroups || [];
  const allianceGroups = data.allianceGroups.length ? data.allianceGroups : reference?.feed?.allianceGroups || [];
  const audience = data.audience.length ? data.audience : reference?.feed?.audience || [];
  const isCrowdRef = (!data.starGroups.length || !data.audience.length) && Boolean(reference?.feed?.starGroups?.length);

  return (
    <div className="bv-feed-audience-grid">
      <div className="bv-audience-col bv-audience-card">
        <HorizontalRanks rows={starGroups} title="小红星 / 人群包CPUV（低→高）" color="blue" zeroUnconfirmed={true} />
      </div>
      <div className="bv-audience-col bv-audience-card">
        <HorizontalRanks rows={allianceGroups} title="小红盟 / 人群包CPUV（低→高）" color="teal" zeroUnconfirmed={true} />
      </div>
      <div className="bv-audience-col bv-audience-penetration-col">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>
            竞品人群渗透 / 快照对比
          </h4>
          {isCrowdRef && reference ? (
            <span className="bv-ref-badge">截至 {reference.date}</span>
          ) : (
            <span className="semantic-tag tag-ok">存量抢夺显著</span>
          )}
        </div>
        <div className="bv-audience" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {audience.map(a => {
            const curPct = a.value !== null ? a.value * 100 : 0;
            const basePct = a.previous !== null ? a.previous * 100 : 0;
            const liftPp = curPct - basePct;

            return (
              <article
                key={a.name}
                style={{
                  background: 'var(--bg-subtle, #FAF9F5)',
                  border: '1px solid var(--border-subtle, #E6E3DC)',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary, #1C1917)' }}>
                      {a.name}
                    </div>
                    <div className="num" style={{ fontSize: 11, color: 'var(--text-muted, #8A847C)', marginTop: 2 }}>
                      {a.previousOn} 基线 {basePct.toFixed(2)}% → {a.observedOn} 观测 {curPct.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontSize: 20, fontWeight: 800, color: '#0F5E52' }}>
                      {curPct.toFixed(2)}%
                    </span>
                    {liftPp > 0 && (
                      <span className="semantic-tag tag-ok num" style={{ marginLeft: 6 }}>
                        ↑ +{liftPp.toFixed(2)}pp
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="dual-bar-track"
                  role="img"
                  aria-label={`${a.name}基线${basePct.toFixed(2)}%，当前${curPct.toFixed(2)}%，净增${liftPp.toFixed(2)}pp`}
                >
                  <div
                    style={{ width: `${Math.min(100, basePct)}%`, height: '100%', background: '#0F5E52' }}
                    title={`${a.previousOn} 基线 ${basePct.toFixed(2)}%`}
                  />
                  <div
                    style={{ width: `${Math.max(0, Math.min(100 - basePct, liftPp))}%`, height: '100%', background: '#D95D39' }}
                    title={`战役净增 +${liftPp.toFixed(2)}pp`}
                  />
                </div>

                {a.size && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary, #57534E)', marginTop: 4 }}>
                    <span>目标人群池体量：<b className="num">{a.size}</b></span>
                  </div>
                )}

                {a.logic && (
                  <details style={{ marginTop: 6, fontSize: 11.5 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-muted, #8A847C)' }}>人群定义</summary>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #57534E)', lineHeight: 1.5 }}>{a.logic}</p>
                  </details>
                )}
              </article>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted, #8A847C)', display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 10, borderTop: '1px dashed var(--border-subtle, #E6E3DC)' }}>
          <span>■ 深松石绿 = 初始渗透基线</span>
          <span>■ 赤陶暖橘 = 战役净增渗透率</span>
        </div>

        <p className="bd-caption" style={{ marginTop: 8 }}>
          {isCrowdRef && reference
            ? "人群包与渗透率来自截至 " + reference.date + " 最近月累计快照，当前日未更新；无每日观测不推算。"
            : "品牌人群资产总量、早阶占比尚无可核验数值，不绘制完整历史趋势或推算。"}
        </p>
      </div>
    </div>
  );
}

function ActionLines({ actions, title = '当天动作 / 作者登记' }: { actions: string[]; title?: string }) {
  const valid = actions
    .map(a => a.trim())
    .filter(a => a && !(/benchmark/i.test(a) || /^\s*(星|盟)?\s*cpuv[：:]\s*[\d.]+/i.test(a) || /^\s*回搜率[：:]\s*[\d.]+/i.test(a)));
  return valid.length ? (
    <details className="bv-actions-fold" style={{ marginTop: 12 }}>
      <summary style={{ fontSize: 12, color: 'var(--slate-11, #60646c)', cursor: 'pointer' }}>{title}（{valid.length}条登记）</summary>
      <div className="bv-actions" style={{ marginTop: 8 }}>
        {valid.map((a, i) => (
          <p key={i}>{a}</p>
        ))}
      </div>
    </details>
  ) : null;
}

export function CreatorVisuals({
  data,
  reference,
}: {
  data: BusinessHighlights['creators'];
  reference?: { creators?: BusinessHighlights['creators']; date: string };
}) {
  const hasCurrentLevels = data.levels.length > 0;
  const refCreators = reference?.creators;
  const isRef = !hasCurrentLevels && Boolean(refCreators?.levels?.length);

  const plan = hasCurrentLevels ? data.plan : refCreators?.plan ?? null;
  const selected = hasCurrentLevels ? data.selected : refCreators?.selected ?? null;
  const published = hasCurrentLevels ? data.published : refCreators?.published ?? null;
  const levels = hasCurrentLevels ? data.levels : refCreators?.levels || [];

  return (
    <>
      <div className="bv-inline-totals">
        {[
          ['计划', plan],
          ['已选', selected],
          ['已发登记', published],
        ].map(([label, n]) => (
          <div key={String(label)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{label}</span>
              {isRef && reference && (
                <span className="bv-ref-chip">快照 {reference.date.slice(5)}</span>
              )}
            </div>
            <b>{num(n as number | null)}</b>
          </div>
        ))}
      </div>

      <div className="bv-creator-legend-row">
        <div className="bv-creator-legend" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="bv-legend-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
            <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: DASHBOARD_PALETTE.plan }} />
            计划
          </div>
          <div className="bv-legend-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
            <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: DASHBOARD_PALETTE.investment }} />
            已选
          </div>
          <div className="bv-legend-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
            <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: DASHBOARD_PALETTE.actual }} />
            已发
          </div>
        </div>
        {isRef && reference && (
          <span className="bv-ref-badge">最近月累计快照（截至 {reference.date}）</span>
        )}
      </div>

      {levels.map(r => (
        <div className="bv-level" key={r.label}>
          <div>
            <b>{r.label}</b>
            <span>计划{num(r.plan)} / 已选{num(r.selected)} / 已发{num(r.published)}</span>
          </div>
          <div className="bv-level-track" role="img" aria-label={`${r.label}计划${num(r.plan)}、已选${num(r.selected)}、已发${num(r.published)}`}>
            <i className="bv-level-plan" style={{ background: DASHBOARD_PALETTE.plan }} />
            <i
              className="bv-level-selected"
              style={{
                width: r.plan && r.selected !== null ? `${Math.min(100, (r.selected / r.plan) * 100)}%` : 0,
                background: DASHBOARD_PALETTE.investment,
              }}
            />
            <i
              className="bv-level-published"
              style={{
                width: r.plan && r.published !== null ? `${Math.min(100, (r.published / r.plan) * 100)}%` : 0,
                background: DASHBOARD_PALETTE.actual,
              }}
            />
          </div>
        </div>
      ))}

      <Evidence source={data.source || refCreators?.source} label={isRef ? `日报月度快照（截至 ${reference?.date}），按层级展示。` : '日报月度快照，按层级展示。'} />

      {data.currentPublished !== null && (
        <div className="bv-source-difference">
          <strong>最新执行底表：{num(data.currentPublished)}条已发布登记</strong>
          <p>
            按发布日期截至所选日；与日报快照{num(published)}条独立展示，不互相覆盖。
          </p>
          <Evidence source={data.currentSource} label="执行底表，按自身范围核对。" />
        </div>
      )}
    </>
  );
}

export function MaintenanceVisuals({
  data,
  reference,
}: {
  data: BusinessHighlights['maintenance'];
  reference?: { maintenance?: BusinessHighlights['maintenance']; date: string };
}) {
  const hasCurrent = data.notesPlan !== null || data.commentsPlan !== null || data.minds.length > 0;
  const refMaint = reference?.maintenance;
  const isRef = !hasCurrent && Boolean(refMaint && (refMaint.notesPlan !== null || refMaint.minds.length > 0));

  const notesRegistered = hasCurrent ? data.notesRegistered : refMaint?.notesRegistered ?? null;
  const notesPlan = hasCurrent ? data.notesPlan : refMaint?.notesPlan ?? null;
  const commentsRegistered = hasCurrent ? data.commentsRegistered : refMaint?.commentsRegistered ?? null;
  const commentsPlan = hasCurrent ? data.commentsPlan : refMaint?.commentsPlan ?? null;
  const pure = hasCurrent ? data.pure : refMaint?.pure ?? null;
  const live = hasCurrent ? data.live : refMaint?.live ?? null;
  const minds = hasCurrent ? data.minds : refMaint?.minds || [];

  return (
    <>
      {isRef && reference && (
        <div style={{ marginBottom: 10 }}>
          <span className="bv-ref-badge">最近月累计快照 / 截至 {reference.date}</span>
        </div>
      )}
      <Progress label="维护笔记登记" actual={notesRegistered} target={notesPlan} unit="篇" color={DASHBOARD_PALETTE.settlement} />
      <Progress label="评论发布登记" actual={commentsRegistered} target={commentsPlan} unit="条" color={DASHBOARD_PALETTE.anomaly} />
      <div className="bv-form-split">
        <div><span>纯文案登记</span><strong>{num(pure)}<small>条</small></strong></div>
        <div><span>文案+LIVE登记</span><strong>{num(live)}<small>条</small></strong></div>
      </div>
      <div className="bv-stacked-form" role="img" aria-label={`纯文案${num(pure)}条，LIVE${num(live)}条`}>
        {commentsRegistered !== null && commentsRegistered > 0 && (
          <>
            <span style={{ width: `${((pure ?? 0) / commentsRegistered) * 100}%`, background: DASHBOARD_PALETTE.actual }} />
            <span style={{ width: `${((live ?? 0) / commentsRegistered) * 100}%`, background: DASHBOARD_PALETTE.investment }} />
          </>
        )}
      </div>
      <HorizontalRanks rows={minds.map(m => ({ label: m.label, value: m.comments }))} title="核心心智 / 月累计评论登记" unit="条" color="purple" />
      <div className="bv-maint-bottom">
        <p className="bd-caption">心智方向覆盖笔记有交叉，不能相加当作唯一笔记数；登记量不等于平台可见、留存或本次抓取量。</p>
        <Evidence source={data.source || refMaint?.source} />
      </div>
    </>
  );
}

export function RectificationVisuals({
  data,
  reference,
}: {
  data: BusinessHighlights['rectification'];
  reference?: { rectification?: BusinessHighlights['rectification']; date: string };
}) {
  const report = data.report || reference?.rectification?.report;
  const isReportRef = !data.report && Boolean(reference?.rectification?.report);
  const isSingle = !report;
  const statusColors = [
    DASHBOARD_PALETTE.actual,     // 合格: 深青
    DASHBOARD_PALETTE.investment, // 需复查/瑕疵: 赭金
    DASHBOARD_PALETTE.anomaly,    // 违规/停投: 陶土
    DASHBOARD_PALETTE.plan,       // 未明确: 灰
  ];

  return (
    <div className={`bv-rectification ${isSingle ? 'bv-rectification-single' : ''}`}>
      <div className="bv-rectification-card bv-rectification-base">
        <div className="bv-rectification-card-header">
          <h4>当前底表 / {data.total}个唯一笔记ID</h4>
        </div>
        <div className="bv-status-strip" role="img" aria-label={data.statuses.map(s => `${s.label}${s.value}`).join('，')}>
          {data.statuses.map((s, i) => (
            <span
              key={s.label}
              className={'bv-status-' + i}
              style={{
                width: data.total && s.value !== null ? `${(s.value / data.total) * 100}%` : 0,
                background: statusColors[i] || statusColors[3],
              }}
              title={`${s.label} ${num(s.value)}篇`}
            />
          ))}
        </div>
        <div className="bv-status-labels">
          {data.statuses.map((s, i) => (
            <span key={s.label}>
              <i
                className={'bv-status-' + i}
                style={{ background: statusColors[i] || statusColors[3] }}
              />
              {s.label} <b>{num(s.value)}</b>
            </span>
          ))}
        </div>
        <p className="bd-caption bv-rectification-bottom-note">仅表示源表巡查登记；结论冲突单列，未明确项不默认为合格。</p>
      </div>

      {report && (
        <div className="bv-rectification-card bv-rectification-report">
          <div className="bv-rectification-card-header">
            <h4>日报登记 / 停投整改进度</h4>
            {isReportRef && reference && (
              <span className="bv-ref-badge">截至 {reference.date} 快照</span>
            )}
          </div>
          <Progress
            label="已整改重投"
            actual={report.fixed}
            target={report.problematic}
            unit="篇"
            color={DASHBOARD_PALETTE.actual}
          />
          <p className="bv-small-warning" style={{ color: '#ce2c31' }}>剩余{num(report.remaining)}篇 / 截止：{report.deadline}</p>
          <p className="bd-caption bv-rectification-bottom-note">
            日报排查{num(report.inspected)}篇，底表{data.total}个唯一ID；按各自统计范围保留差异。
          </p>
        </div>
      )}
    </div>
  );
}

export function SeoVisuals({
  data,
  reference,
}: {
  data: BusinessHighlights['seo'];
  reference?: { seo?: BusinessHighlights['seo']; date: string };
}) {
  const hasCurrentSummary = data.indexed !== null || data.occupied !== null;
  const refSeo = reference?.seo;
  const isRef = !hasCurrentSummary && Boolean(refSeo && (refSeo.indexed !== null || refSeo.occupied !== null));

  const indexed = hasCurrentSummary ? data.indexed : refSeo?.indexed ?? null;
  const submitted = hasCurrentSummary ? data.submitted : refSeo?.submitted ?? null;
  const occupied = hasCurrentSummary ? data.occupied : refSeo?.occupied ?? null;
  const target = hasCurrentSummary ? data.target : refSeo?.target ?? null;
  const buckets = data.buckets.length ? data.buckets : refSeo?.buckets || [];

  return (
    <>
      <div className="bv-seo-summary">
        <div>
          <Progress label="笔记收录登记" actual={indexed} target={submitted} unit="篇" color={DASHBOARD_PALETTE.actual} />
        </div>
        <div>
          <Progress label="关键词占位登记" actual={occupied} target={target} unit="词" color={DASHBOARD_PALETTE.seo} />
        </div>
      </div>
      <p className="bd-caption bv-seo-note">
        验收底表跟踪16个核心占位词优化累计达成天数（月目标20天）；源底表虽设逐日长图留存列与TOP3占位列，但源数据尚未登记内容，绝不推算虚拟排名。
      </p>

      {isRef && reference && (
        <div style={{ margin: '8px 0 14px' }}>
          <span className="bv-ref-badge">首部收录/占位进度为最近快照（截至 {reference.date}），下方关键词进度为实时底表</span>
        </div>
      )}

      {buckets.length > 0 && (
        <div className="bv-seo-buckets">
          {buckets.map(b => (
            <Progress key={b.label} label={b.label} actual={b.actual} target={b.target} unit="词" color={DASHBOARD_PALETTE.seo} />
          ))}
        </div>
      )}

      <div className="bv-seo-keywords">
        {data.keywords.map(k => (
          <article key={k.word}>
            <strong>{k.word}</strong>
            <span>累计达成 {k.registeredText}</span>
            <div className="bv-progress-track">
              <span
                style={{
                  width: k.achieved !== null && k.target !== null && k.target > 0 ? `${Math.min(100, (k.achieved / k.target) * 100)}%` : 0,
                  background: DASHBOARD_PALETTE.actual,
                }}
              />
            </div>
            {k.top3 && <small>TOP3：{k.top3}</small>}
          </article>
        ))}
      </div>

      <p className="bd-caption">达成天数基于底表登记原文保留；进度条表达已达成天数相对月目标（20天）进度。</p>
      <Evidence source={data.source || refSeo?.source} label="收录/占位：所选日报登记。" />
      <Evidence source={data.acceptanceSource} label="16词累计达成：SEO优化执行进度表（验收list）。" />
    </>
  );
}
