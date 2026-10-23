'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/hooks/use-project-data';
import { useCachedQuery, fetchWithCache, invalidateQueryCache } from '../../lib/cache';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import type { Cell, CommercePoint, DailyPoint, DailyView, SourceRef, TableView } from '../../lib/business-daily/types';
import { useProject } from '../../components/project-shell/ProjectContext';
import { parseNumericValue } from '../../lib/numeric-values';
import { useSearchParams } from 'next/navigation';
import { BusinessSyncPanel } from '../data/BusinessSyncPanel';
import { BusinessConfigDrawer } from './BusinessConfigDrawer';
import { SpendBars } from './SpendBars';
import { SearchVisuals, SearchCoreWordsVisuals, FeedVisuals, FeedAudienceVisuals, CreatorVisuals, MaintenanceVisuals, RectificationVisuals, SeoVisuals, TodayBusinessActions, HorizontalRanks, DASHBOARD_PALETTE } from './BusinessVisuals';

const DailyDetailsContext = createContext<Record<string, string>>({});

const format = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
const cellLabels = { observed: '已观测', missing: '缺失', not_collected: '未采集', formula_error: '公式错误' };

const overviewNavItems = [
  { id: 'view-overview-performance', label: '经营表现' },
  { id: 'view-overview-ad', label: '投流效果' },
  { id: 'view-overview-execution', label: '执行进度' },
  { id: 'view-overview-data', label: '数据明细' },
];

const dailyNavItems = [
  { id: 'view-daily-focus-spend', label: '当日重点与费用进度' },
  { id: 'view-daily-ad', label: '投流执行' },
  { id: 'view-daily-execution', label: '内容与评论/SEO执行' },
  { id: 'view-daily-source', label: '原文与来源' },
];

function GroupHeading({
  id,
  title,
  subtitle,
  badge,
}: {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className="bd-group-heading"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        margin: '12px 0 6px',
        padding: '4px 0 2px',
        borderBottom: '2px solid #eef2f6',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: '#1f2937',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {badge && (
            <span
              style={{
                fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                background: '#eaf2f0',
                color: '#2c7168',
              }}
            >
              {badge}
            </span>
          )}
          {title}
        </h3>
        {subtitle && (
          <span style={{ fontSize: 11.5, color: '#64748b' }}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}

function Source({ value }: { value?: SourceRef }) {
  const { projectId } = useProject();
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function load() {
    if (!value || rows) return;
    try {
      const result = await api<{ rows: unknown[][]; columns: string[] }>(
        '/api/business-daily?' +
          new URLSearchParams({
            projectId,
            sourceKey: value.sourceKey,
            ...(value.captureId ? { captureId: value.captureId } : {}),
            offset: String(Math.max(0, (value.row || 1) - 1)),
            limit: '3',
          })
      );
      setRows(result.rows);
      setColumns(result.columns);
    } catch (e) {
      setError(e instanceof Error ? e.message : '明细读取失败');
    }
  }

  return value ? (
    <details className="bd-source">
      <summary>查看来源与口径</summary>
      <a href={value.url} target="_blank" rel="noreferrer">原始业务来源 ↗</a>
      <span>
        版本 {value.version}
        {value.row ? (' · 第' + value.row + '行' + (value.column ? '第' + value.column + '列' : '')) : ''} · {value.sourceKey}
      </span>
      {value.range && (
        <>
          <button onClick={load}>查看保存的来源行</button>
          {error ? (
            <p role="alert">{error}</p>
          ) : rows ? (
            <div className="bd-scroll">
              <table>
                <thead>
                  <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>{r.map((v, j) => <td key={j}>{String(v ?? '—')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </details>
  ) : (
    <span className="bd-source">来源待接入</span>
  );
}

function Value({ value, unit = '元' }: { value: Cell; unit?: string }) {
  return (
    <>
      <strong>
        {format(value.value)} <small>{unit}</small>
      </strong>
      <small className={'bd-state bd-' + value.state}>
        {value.state === 'observed' && value.value === 0 ? '真实零' : cellLabels[value.state]}
        {value.reason ? ' · ' + value.reason : ''}
      </small>
      <Source value={value.source} />
    </>
  );
}

function DataTable({ table, initial = 20 }: { table: TableView; initial?: number }) {
  const query = useContext(DailyDetailsContext);
  return <PagedDataTable key={query.fingerprint + table.title} table={table} query={query} initial={initial} />;
}

function PagedDataTable({ table, query, initial }: { table: TableView; query: Record<string, string>; initial: number }) {
  const { projectId } = useProject();
  const identity = useCacheIdentity();
  const [rows, setRows] = useState(table.rows);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const total = table.totalRows ?? table.rows.length;
  const size = Math.min(100, Math.max(20, initial));

  async function page(next: number) {
    setBusy(true);
    setError('');
    try {
      const result = await fetchWithCache<{ table: TableView }>(
        '/api/business-daily',
        {
          identity,
          projectId,
          params: {
            ...query,
            part: 'table',
            tableTitle: table.title,
            offset: String(next),
            limit: String(size),
          },
          staleTime: 60 * 1000,
        }
      );
      if (result?.table) {
        setRows(result.table.rows);
        setOffset(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '明细读取失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (table.rows.length || !total) return;
    const details = ref.current?.closest('details');
    const load = () => {
      if (!details || details.open) void page(0);
    };
    load();
    details?.addEventListener('toggle', load);
    return () => details?.removeEventListener('toggle', load);
  }, []);

  function display(v: string | number | null | undefined, column: string) {
    if (v === null || v === undefined) return '—';
    if (/^(?:.*ID|关键词|层级|日期|达人|状态|原文入口|项目|平台|代理|范围|执行状态|发布日期|达人昵称)$/.test(column)) return v;
    const n = parseNumericValue(v);
    return n === null ? v : /CTR|占比|完成率|进度|回搜率/.test(column) ? format(n * 100) + '%' : format(n);
  }

  return (
    <div className="bd-detail-table" ref={ref}>
      <p className="bd-caption">{table.scope}</p>
      {error && <p role="alert">{error}</p>}
      {busy && <p className="bd-caption">读取这一页明细…</p>}
      <div className="bd-scroll">
        <table>
          <thead>
            <tr>{table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={offset + i}>
                {table.columns.map((c, j) => (
                  <td key={j}>
                    {typeof r[j] === 'string' && /^https?:/.test(r[j] as string) ? (
                      <a href={r[j] as string} target="_blank" rel="noreferrer">原文 ↗</a>
                    ) : (
                      display(r[j], c)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > size && (
        <div className="bv-detail-pagination">
          <button disabled={busy || !offset} onClick={() => page(Math.max(0, offset - size))}>
            上一页明细
          </button>
          <span>第{offset + 1}–{offset + rows.length}条 / {total}条</span>
          <button disabled={busy || offset + rows.length >= total} onClick={() => page(offset + size)}>
            下一页明细
          </button>
        </div>
      )}
      <Source value={table.source} />
    </div>
  );
}

function NarrativeBlock({ title, view }: { title: string; view: DailyView }) {
  const sections = view.narrative.filter(n => n.title.includes(title));
  return sections.length ? (
    <details className="bv-report-text">
      <summary>展开作者判断与动作 · {title}</summary>
      {sections.map((n, i) => (
        <div className="bd-narrative" key={i}>
          <h4>{n.title}</h4>
          <p>{n.text || '该节数据见来源明细。'}</p>
          <Source value={n.source} />
        </div>
      ))}
    </details>
  ) : null;
}

function NoteRows({ notes, projectId, day }: { notes: DailyView['notes']; projectId: string; day: string }) {
  return (
    <div className="bd-scroll bv-notes-table">
      <table>
        <thead>
          <tr>{['笔记 / 当月消耗', '源表问题与整改', '负责人 / 档案'].map(t => <th key={t}>{t}</th>)}</tr>
        </thead>
        <tbody>
          {notes.map(n => (
            <tr key={n.id}>
              <td>
                <b>{n.author || n.id}</b>
                <small>
                  {format(n.monthSpend.value)} 元 · {n.publishedDay || '发布日期待确认'}
                  {n.publishedDay && !n.publishedDay.startsWith(day.slice(0, 7)) ? ' · 历史笔记本月在投' : ''}
                </small>
              </td>
              <td>
                {n.audit || '巡查结论未明确'}
                <small>{[n.problem, n.advice, n.correction].filter(Boolean).join('；') || '具体问题待确认'}</small>
              </td>
              <td>
                {n.owner || '负责人待确认'}
                <small>
                  <a href={'/projects/' + projectId + '/comments?noteId=' + n.id + '&month=' + day.slice(0, 7)}>巡查档案 ↗</a>
                </small>
                <details>
                  <summary>笔记与原始证据</summary>
                  <p>{n.id}</p>
                  <Source value={n.source} />
                  {n.link && <a href={n.link} target="_blank" rel="noreferrer">原文入口 ↗</a>}
                  <p>链接尚未校验，保存的档案仍可读取。</p>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullNotePages({ view, projectId }: { view: DailyView; projectId: string }) {
  const query = useContext(DailyDetailsContext);
  const [rows, setRows] = useState(view.notes);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = view.noteCount ?? view.notes.length;

  async function page(next: number) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ rows: DailyView['notes'] }>(
        '/api/business-daily?' +
          new URLSearchParams({
            ...query,
            part: 'notes',
            offset: String(next),
            limit: '20',
          })
      );
      setRows(result.rows);
      setOffset(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '明细读取失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      onToggle={e => {
        if (e.currentTarget.open && offset === 0 && rows.length < 20 && total > rows.length) void page(0);
      }}
    >
      <summary>展开全部在投笔记（{total}篇，按需分页）</summary>
      {error && <p role="alert">{error}</p>}
      <NoteRows notes={rows} projectId={projectId} day={view.day} />
      <div className="bv-detail-pagination">
        <button disabled={busy || !offset} onClick={() => page(Math.max(0, offset - 20))}>
          上一页笔记
        </button>
        <span>第{offset + 1}–{offset + rows.length}条 / {total}条</span>
        <button disabled={busy || offset + rows.length >= total} onClick={() => page(offset + 20)}>
          下一页笔记
        </button>
      </div>
    </details>
  );
}

function Funnel({
  data,
  title,
  monthSnapshot,
}: {
  data: CommercePoint;
  title: string;
  monthSnapshot?: { target?: unknown; actual?: unknown; monitored?: unknown };
}) {
  const isComplete = data.shopUv?.value !== null;
  const observed = data.observedSummary || data.observedTotals;
  const hasObserved = Boolean(
    observed?.shopUv !== null && observed?.shopUv !== undefined
  );
  const coveredDays = data.coverage?.coveredDays ?? 0;
  const totalDays = data.coverage?.totalDays ?? 0;
  const periodText = data.coverage?.periodFrom && data.coverage?.periodTo
    ? `${data.coverage.periodFrom.slice(5).replace('-', '.')}–${data.coverage.periodTo.slice(5).replace('-', '.')}`
    : '';

  const steps: [string, number | null, string][] = hasObserved
    ? [
        ['阅读 / 播放 (UV)', isComplete ? data.readUv.value : observed?.readUv ?? null, isComplete ? '全区间合计' : `${periodText}合计`],
        ['电商进店 (商详UV)', isComplete ? data.shopUv.value : observed?.shopUv ?? null, isComplete ? '全区间合计' : `${periodText}合计`],
        ['成交 (UV)', isComplete ? data.purchaseUv.value : observed?.purchaseUv ?? null, isComplete ? '全区间合计' : `${periodText}合计`],
        ['新客成交 (UV)', isComplete ? data.newCustomerUv.value : observed?.newCustomerUv ?? null, isComplete ? '全区间合计' : `${periodText}合计`],
      ]
    : [
        ['阅读 / 播放', null, '未回传'],
        ['电商进店 (商详浏览)', null, '未回传'],
        ['成交', null, '未回传'],
        ['新客成交', null, '未回传'],
      ];

  return (
    <article className="bd-funnel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: '#1f2937' }}>{title}</h4>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 4,
            background: isComplete ? '#eaf2f0' : hasObserved ? '#fef3c7' : '#f1f5f9',
            color: isComplete ? '#2c7168' : hasObserved ? '#b45309' : '#64748b',
          }}
        >
          {isComplete
            ? `全区间已回传 (${coveredDays}/${totalDays}天)`
            : hasObserved
            ? `已回传实绩 · ${periodText} (${coveredDays}/${totalDays}天)`
            : '该区间暂未回传'}
        </span>
      </div>

      {hasObserved ? (
        <>
      <div className="bd-funnel-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {steps.map(([name, val, sub]) => (
          <div key={name} style={{ background: '#f8fafc', border: '1px solid #edf2f7', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{name}</span>
              <strong style={{ display: 'block', fontSize: 16, margin: '4px 0 2px', color: '#1f2937' }}>
                {format(val)}
              </strong>
              <small style={{ fontSize: 10, color: '#8c9ba5' }}>{sub}</small>
          </div>
        ))}
      </div>

          {!isComplete && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 5 }}>
              <span style={{ fontSize: 11, color: '#78716c' }}>
                {title.includes('星') ? '10月14日–15日' : '10月13日–15日'}底表暂未回传；未覆盖日不补0，上方展示 {periodText} 真实阶段指标，不伪装全区间合计。
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="bd-funnel-compact-status" style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 6, padding: '10px 12px', margin: '4px 0 8px' }}>
          <span style={{ fontSize: 11.5, color: '#57534e', fontWeight: 600 }}>电商归因全链路状态</span>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#78716c', lineHeight: 1.4 }}>
            所选统计区间内底表暂无有效电商归因回传；待相关数据录入后自动呈现。
          </p>
        </div>
      )}

      {/* 独立口径单列展示区域 */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>
            聚光监测进店UV（独立口径）：<strong style={{ color: '#1f2937' }}>{format(data.monitoredShopUv?.value ?? observed?.monitoredShopUv ?? null)}</strong>
          </span>
          <span className="bd-caption">已观测（周趋势底表）</span>
        </div>

        {Boolean(monthSnapshot?.actual !== undefined && monthSnapshot?.actual !== null) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: '#64748b' }}>
              10月15日报月快照进店参考：<strong style={{ color: '#1f2937' }}>{format(parseNumericValue(monthSnapshot?.actual))}</strong>
              {Boolean(monthSnapshot?.target) && <span style={{ color: '#94a3b8' }}> / 目标 {format(parseNumericValue(monthSnapshot?.target))}</span>}
            </span>
            <span className="bd-caption">月累计快照（独立口径不混拼）</span>
          </div>
        )}
      </div>
    </article>
  );
}

function cumulativeRows(points: DailyPoint[]) {
  let plan = 0, actual = 0, planComplete = true, actualComplete = true;
  const result: { date: string; plan: number | null; actual: number | null }[] = [];
  for (const p of points) {
    if (p.plan.value === null) planComplete = false; else plan += p.plan.value;
    if (p.adSpend.value === null) actualComplete = false; else actual += p.adSpend.value;
    result.push({ date: p.date, plan: planComplete ? plan : null, actual: actualComplete ? actual : null });
  }
  return result;
}

/** 动态计算渠道费用结构与分布 */
function ChannelStructureOverview({ series }: { series: DailyPoint[] }) {
  // Only include days with complete cost components (where both adSpend and projectInvestment are observed)
  // to ensure numerators and denominator use the exact same common date range.
  const completeDays = series.filter(p => p.adSpend.value !== null && p.projectInvestment.value !== null);
  const sumVal = (key: keyof DailyPoint) =>
    completeDays.reduce((acc, p) => {
      const v = (p[key] as Cell)?.value;
      return typeof v === 'number' ? acc + v : acc;
    }, 0);

  const adSpend = sumVal('adSpend');
  const feedSpend = sumVal('feed');
  const searchSpend = sumVal('search');
  const creatorCost = sumVal('creatorCost');
  const seoCost = sumVal('seo');
  const commentsCost = sumVal('comments');
  const otherCost = sumVal('other');
  const totalInvestment = sumVal('projectInvestment') || (adSpend + creatorCost + seoCost + commentsCost + otherCost);
  const commonThrough = completeDays.at(-1)?.date || '';
  const commonFrom = completeDays[0]?.date || '';
  const partialDates = series
    .filter(p => p.date > commonThrough && (p.creatorCost.value !== null || p.seo.value !== null))
    .map(p => p.date.slice(5));
  const partialDatesText = partialDates.length > 0 ? partialDates.join('、') : '';

  const channels = [
    { label: '信息流 (F)', value: feedSpend, color: DASHBOARD_PALETTE.feed, desc: '聚光信息流推广' },
    { label: '搜索广告 (S)', value: searchSpend, color: DASHBOARD_PALETTE.search, desc: '聚光搜索词占位推广' },
    { label: '达人采买 (K)', value: creatorCost, color: DASHBOARD_PALETTE.creators, desc: '博主/达人合作执行' },
    { label: 'SEO 占位', value: seoCost, color: DASHBOARD_PALETTE.seo, desc: '关键词自然收录' },
    { label: '评论区运营', value: commentsCost, color: DASHBOARD_PALETTE.comments, desc: '评论维护与口碑' },
    { label: '其他/杂费', value: otherCost, color: DASHBOARD_PALETTE.other, desc: '其他运营相关杂费' },
  ].filter(c => c.value > 0);

  return (
    <div className="bd-channel-structure">
      <div className="bd-channel-structure-head">
        <div>
          <h4>KFS 全渠道费用构成与占比（区间累计）</h4>
          <span className="bd-caption">
            {`基于共同完整费用口径（${commonFrom} 至 ${commonThrough}，共 ${completeDays.length} 个完整投流日）累计计算 · 共同区间项目总投入 ¥${format(totalInvestment)}`}
          </span>
          {partialDates.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
              {`注：${partialDatesText} 等日期达人/SEO等费用已登记，因投流广告尚未回填，不混入全渠道占比分母以保持同范围口径。`}
            </div>
          )}
        </div>
      </div>

      {/* Segmented bar */}
      <div className="bd-channel-segmented-bar" role="img" aria-label="渠道费用占比分布">
        {channels.map(c => {
          const pct = totalInvestment > 0 ? (c.value / totalInvestment) * 100 : 0;
          return (
            <span
              key={c.label}
              style={{ width: pct + '%', background: c.color }}
              title={c.label + ': ¥' + format(c.value) + ' (' + pct.toFixed(1) + '%)'}
            />
          );
        })}
      </div>

      {/* Channel detail cards */}
      <div className="bd-channel-grid">
        {channels.map(c => {
          const pct = totalInvestment > 0 ? (c.value / totalInvestment) * 100 : 0;
          return (
            <div key={c.label} className="bd-channel-card">
              <div className="bd-channel-card-top">
                <span className="bd-channel-dot" style={{ background: c.color }} />
                <span className="bd-channel-name">{c.label}</span>
                <span className="bd-channel-pct">{pct.toFixed(1)}%</span>
              </div>
              <div className="bd-channel-val">
                {'¥' + format(c.value)}
              </div>
              <div className="bd-channel-desc">{c.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function AspectSummaryCard({
  aspectKey,
  view,
  overview = false,
}: {
  aspectKey: 'spend' | 'search' | 'feed' | 'creators' | 'rectification' | 'maintenance' | 'seo';
  view: DailyView;
  overview?: boolean;
}) {
  const summary = useMemo(() => {
    const ownersTable = view.tables?.find(t => t.title === '板块负责人');
    const getOwner = (role: string) => String(ownersTable?.rows?.find(r => String(r[0]).includes(role))?.[1] || '待确认');

    switch (aspectKey) {
      case 'spend': {
        const isPending = view.core.adSpend.value === null;
        return {
          title: '投放费用与结算',
          owner: getOwner('投流'),
          deadline: '本日报确认前',
          conclusion: isPending
            ? (view.core.creatorCost?.value !== null
                ? `${view.day} 费用尚未齐备 · 达人已填报（¥${format(view.core.creatorCost.value)}），投流广告待回填；未齐备指标参考截至 ${view.businessThrough || '10-14'} 完整实绩，月累计广告消耗 ¥${format(view.progress.actualThroughData)}。`
                : `${view.day} 当日投放费用待录入；截至 ${view.businessThrough || '10-14'} 月累计广告消耗 ¥${format(view.progress.actualThroughData)}，月累计结算 ¥${format(view.core.monthlySettlement?.value)}（进度 ${format((view.progress.settlementFraction ?? 0) * 100)}%）。`)
            : `当日平台广告消耗 ¥${format(view.core.adSpend.value)}，项目总投入 ¥${format(view.core.projectInvestment.value)}，政策后结算 ¥${format(view.core.settlement.value)}。`,
          reason: isPending
            ? (view.core.creatorCost?.value !== null
                ? '达人采买已填报，投流广告周底表数据尚未回填。'
                : '底层周报数据按周更新，当日投放明细尚未同步底表。')
            : (view.progress.lagPoints !== null && view.progress.lagPoints >= view.progress.alertThresholdPoints
              ? `FS业务排期落后 ${format(view.progress.lagPoints)} 个百分点。`
              : '投放消耗按排期执行，差额在预警阈值范围内。'),
          action: isPending
            ? `接入 ${view.businessThrough || '10-14'} 最近完整有效日实绩参考未齐备指标，待投流广告更新后核实。`
            : '维持当前渠道投放节奏，持续跟踪京准通与聚光当日返点及消耗对账。',
        };
      }
      case 'search': {
        const s = view.highlights?.search;
        const starCost = s?.costs?.find(c => c.channel.includes('星'))?.actual;
        const starHigh = s?.costs?.find(c => c.channel.includes('星'))?.high;
        const allianceCost = s?.costs?.find(c => c.channel.includes('盟'))?.actual;
        const allianceHigh = s?.costs?.find(c => c.channel.includes('盟'))?.high;
        const isCostHigh = (starCost && starHigh && starCost > starHigh) || (allianceCost && allianceHigh && allianceCost > allianceHigh);
        return {
          title: '搜索侧分析',
          owner: getOwner('投流'),
          deadline: '日常巡检',
          conclusion: s
            ? `小红星CPUV ${format(starCost)}元，小红盟CPUV ${format(allianceCost)}元，回搜率 ${format(s.returnRate ? s.returnRate * 100 : null)}%；新生儿奶粉 SOC ${format(s.coreWords?.[0]?.soc ? s.coreWords[0].soc * 100 : null)}% (No.${s.coreWords?.[0]?.rank ?? '—'})。`
            : '搜索侧核心指标（星/盟CPUV、回搜率及关键词表现）待服务端 highlights 字段同步。',
          reason: isCostHigh
            ? '小红盟/星成本高于行业基准上沿；大促期出价提升导致精准匹配未达80%目标。'
            : (s ? '搜索占位词与竞品词投放稳步推进，整体成本受控。' : '待底表与日报明细同步。'),
          action: s?.actions?.[0] || '稳定「新生儿奶粉」投放拉升SOC；二段词增加高CTR(9%+)笔记；持续放大优质组合，暂停高成本组合。',
        };
      }
      case 'feed': {
        const f = view.highlights?.feed;
        const starCost = f?.costs?.find(c => c.channel.includes('星'))?.actual;
        const allianceCost = f?.costs?.find(c => c.channel.includes('盟'))?.actual;
        const pStar = f?.audience?.find(a => a.name.includes('派星'))?.value;
        const pA2 = f?.audience?.find(a => a.name.includes('A2') || a.name.includes('至初'))?.value;
        return {
          title: '信息流侧分析',
          owner: getOwner('投流'),
          deadline: '日常巡检',
          conclusion: f
            ? `小红星CPUV ${format(starCost)}元、小红盟CPUV ${format(allianceCost)}元，优于基准；派星渗透率 ${format(pStar ? pStar * 100 : null)}%，至初渗透率 ${format(pA2 ? pA2 * 100 : null)}%。`
            : '信息流侧成本与人群渗透指标待服务端 highlights 字段同步。',
          reason: f ? '定向触达竞品人群以转奶场景种草抢夺存量用户；稳孕选手/新手奶爸定向组合成本低效能高。' : '待底表与日报明细同步。',
          action: f?.actions?.[0] || '对CTR<6%内容暂停并替换为喂养知识与囤货笔记；站外进店优质组合持续放大。',
        };
      }
      case 'creators': {
        const c = view.highlights?.creators;
        const diff = c && c.published !== null && c.published !== undefined && c.currentPublished !== null && c.currentPublished !== undefined
          ? Math.abs(c.published - c.currentPublished)
          : null;
        return {
          title: '达人储备与发布',
          owner: getOwner('笔记') || getOwner('内容'),
          deadline: '日常排期',
          conclusion: c
            ? `10月计划 ${format(c.plan)} 篇全量定选，日报已发 ${format(c.published)} 篇 (${format((c.published ?? 0) / (c.plan || 1) * 100)}%)，执行底表累计 ${format(c.currentPublished)} 篇。`
            : '达人计划定选与发布进度推进中，详细档案见底表。',
          reason: diff !== null && diff > 0
            ? `日报快照 (${c?.published}篇) 与执行底表 (${c?.currentPublished}篇) 口径不同，待核对。`
            : '底表记录与日报快照保持独立观测。',
          action: '推进初级与素人笔记审核发布，逐笔核对底表登记差异。',
        };
      }
      case 'rectification': {
        const r = view.highlights?.rectification;
        const rep = r?.report;
        return {
          title: '评论区质量巡查与整改',
          owner: getOwner('SEO') || getOwner('评论'),
          deadline: rep?.deadline || '周三前',
          conclusion: r
            ? `底表排查 ${format(r.total)} 篇（合格 ${format(r.statuses?.[0]?.value)}，问题 ${format(r.statuses?.[1]?.value)}）；日报整改已重投 ${format(rep?.fixed)}/${format(rep?.problematic)} 篇，剩余 ${format(rep?.remaining)} 篇。`
            : '底表排查与整改进度推进中，高消耗笔记核对见下方列表。',
          reason: '集中排查在投笔记评论折叠与违规表述；竞品合生元代号打码过审但评论折叠严重需规避。',
          action: rep?.remaining
            ? `剩余 ${format(rep.remaining)} 篇整改笔记推进重新投放，优先核查高消耗有瑕疵笔记。`
            : '持续跟进整改笔记重新投放，优先核查高消耗笔记。',
        };
      }
      case 'maintenance': {
        const m = view.highlights?.maintenance;
        return {
          title: '评论维护与心智渗透',
          owner: getOwner('SEO') || getOwner('评论'),
          deadline: '10月持续',
          conclusion: m
            ? `10月已维护 ${format(m.notesRegistered)}/${format(m.notesPlan)} 篇，发布 ${format(m.commentsRegistered)}/${format(m.commentsPlan)} 条（纯文案 ${format(m.pure)}，Live图 ${format(m.live)}）。`
            : '10月评论维护与心智渗透推进中，按月度规划分批执行。',
          reason: '核心心智聚焦「启萃像母乳」与「生长曲线好」，覆盖笔记存在交叉。',
          action: '继续提升 Live 图维评比例，重点保障长肉、吸收等产品核心心智渗透。',
        };
      }
      case 'seo': {
        const s = view.highlights?.seo;
        return {
          title: 'SEO收录与关键词占位',
          owner: getOwner('SEO'),
          deadline: '10月持续监测',
          conclusion: s
            ? `被收录笔记 ${format(s.indexed)}/${format(s.submitted)} 篇 (${format((s.indexed ?? 0) / (s.submitted || 1) * 100)}%)；16 个核心词中已占位 ${format(s.occupied)}/${format(s.target)} 词 (${format((s.occupied ?? 0) / (s.target || 1) * 100)}%)。`
            : 'SEO 关键词收录与占位目标持续跟进，详细达成见底表。',
          reason: s?.occupied === s?.target
            ? '核心词全部达成占位目标。'
            : '高搜词主要已覆盖，部分长尾需求词底表暂未登记达成。',
          action: '持续监控 16 词排位与关联笔记收录率，对未登记词补充优质内容。',
        };
      }
    }
  }, [aspectKey, view]);

  const isTerracotta = aspectKey === 'rectification';
  const accentColor = isTerracotta ? DASHBOARD_PALETTE.anomaly : DASHBOARD_PALETTE.actual;
  const badgeBg = isTerracotta ? '#faeae6' : '#eaf2f0';
  const badgeColor = isTerracotta ? '#9e4a37' : '#235952';

  return (
    <div
      className="bd-aspect-summary bd-insight-card"
      data-testid={`aspect-summary-${aspectKey}`}
      data-aspect={aspectKey}
      data-mode={overview ? 'overview' : 'daily'}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: '10px 14px',
        margin: '8px 0 12px',
      }}
    >
      <div
        className="bd-insight-banner"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          className="bd-insight-lead-wrap"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flex: 1,
            minWidth: 260,
          }}
        >
          <span
            className="bd-insight-badge"
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              background: badgeBg,
              color: badgeColor,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {overview ? '核心研判' : '关键动作'}
          </span>
          <p
            className="bd-insight-lead"
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              color: '#1f2937',
              fontWeight: overview ? 500 : 600,
            }}
          >
            {overview ? summary.conclusion : (summary.action || summary.conclusion)}
          </p>
        </div>

        <div
          className="bd-insight-meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: '#64748b',
            flexShrink: 0,
          }}
        >
          <span className="bd-insight-owner">
            责任人：<strong style={{ color: '#334155' }}>{summary.owner}</strong>
          </span>
          {summary.deadline && (
            <span className="bd-insight-deadline">
              时限：<strong style={{ color: '#334155' }}>{summary.deadline}</strong>
            </span>
          )}
        </div>
      </div>

      <details
        className="bd-aspect-details"
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: '1px dashed #edf2f7',
        }}
      >
        <summary
          style={{
            fontSize: 11,
            color: '#64748b',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {overview ? '展开差异原因与跟进策略' : '展开业务态势研判与差异原因'}
        </summary>
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
            fontSize: 11.5,
            lineHeight: 1.6,
            color: '#475569',
          }}
        >
          {overview ? (
            <>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#8c9ba5',
                    marginBottom: 2,
                  }}
                >
                  差异原因
                </span>
                <p style={{ margin: 0 }}>{summary.reason}</p>
              </div>
              {summary.action && (
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#8c9ba5',
                      marginBottom: 2,
                    }}
                  >
                    后续跟进动作
                  </span>
                  <p style={{ margin: 0 }}>{summary.action}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#8c9ba5',
                    marginBottom: 2,
                  }}
                >
                  业务态势研判
                </span>
                <p style={{ margin: 0 }}>{summary.conclusion}</p>
              </div>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#8c9ba5',
                    marginBottom: 2,
                  }}
                >
                  差异原因
                </span>
                <p style={{ margin: 0 }}>{summary.reason}</p>
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

export function BusinessDailyBoard({
  projectId,
  canWrite = false,
  overview = false,
}: {
  projectId: string;
  canWrite?: boolean;
  overview?: boolean;
}) {
  const params = useSearchParams();
  const { currentProject } = useProject();

  const [day, setDay] = useState(() => {
    const pDay = params.get('day');
    if (pDay) return pDay;
    return '2026-10-15';
  });
  const [mode, setMode] = useState(() => params.get('dataMode') || 'latest');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');
  const [configOpen, setConfigOpen] = useState(false);




  const queryParams = useMemo(() => ({
    projectId,
    day,
    mode,
    summary: '1',
    ...(overview && from ? { from } : {}),
    ...(overview && to ? { to } : {}),
    ...(revision > 0 ? { _r: String(revision) } : {}),
  }), [projectId, day, mode, overview, from, to, revision]);

  const {
    data: cachedResult,
    loading: queryLoading,
    error: queryError,
    refresh: refreshDaily,
  } = useCachedQuery<{ view: DailyView }>({
    url: '/api/business-daily',
    projectId,
    params: queryParams,
    staleTime: 60 * 1000,
    ttl: 15 * 60 * 1000,
  });

  const view = cachedResult?.view || null;
  const error = queryError || '';
  const pending = queryLoading && !view;

  useEffect(() => {
    if (!params.get('day')) {
      const viewRecord = view as (DailyView & { defaultDay?: string; latestReportDay?: string }) | null;
      const target = viewRecord?.defaultDay || viewRecord?.latestReportDay;
      if (target && target !== day) {
        setTimeout(() => {
          setDay(target);
        }, 0);
      }
    }
  }, [view, params, day]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', day);
    if (from) url.searchParams.set('from', from); else url.searchParams.delete('from');
    if (to) url.searchParams.set('to', to); else url.searchParams.delete('to');
    if (mode === 'latest') url.searchParams.delete('dataMode');
    else url.searchParams.set('dataMode', mode);
    window.history.replaceState(window.history.state, '', url);

    const ctx = { projectId, day, mode, from: from || undefined, to: to || undefined, tab: overview ? 'overview' : 'daily' };
    (window as unknown as { __ACTIVE_AGENT_CONTEXT__?: typeof ctx }).__ACTIVE_AGENT_CONTEXT__ = ctx;
    window.dispatchEvent(new CustomEvent('app:context-change', { detail: ctx }));
  }, [day, mode, from, to, projectId, overview]);


  useEffect(() => {
    const handleSync = () => {
      invalidateQueryCache({ projectId, endpoint: '/api/business-daily' });
      void refreshDaily({ fresh: true });
    };
    window.addEventListener('app:business-sync-finished', handleSync);
    window.addEventListener('app:datasets-changed', handleSync);
    return () => {
      window.removeEventListener('app:business-sync-finished', handleSync);
      window.removeEventListener('app:datasets-changed', handleSync);
    };
  }, [projectId, refreshDaily]);

  async function confirm() {
    if (!view) return;
    setBusy(true);
    setNotice('');
    try {
      await api('/api/business-daily', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm', projectId, day, fingerprint: view.fingerprint }),
      });
      invalidateQueryCache({ projectId, endpoint: '/api/business-daily' });
      setMode('confirmed');
      setNotice('日报已确认并保存完整历史快照。');
      void refreshDaily({ fresh: true });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '确认失败');
    } finally {
      setBusy(false);
    }
  }

  const cumulative = cumulativeRows(view?.series || []);
  const selected = view?.series.find(p => p.date === day);

  const latestObservedPoint = useMemo(() => {
    return [...(view?.series || [])].reverse().find(p => p.adSpend?.value !== null);
  }, [view?.series]);

  const isTodayCostsPending = useMemo(() => {
    if (overview) return false;
    if (!view?.core) return false;
    return view.core.adSpend?.value === null || view.core.adSpend?.state === 'not_collected';
  }, [overview, view]);

  const filteredTodayActions = useMemo(() => {
    if (!view?.highlights?.today) return [];
    if (isTodayCostsPending) {
      return view.highlights.today.filter(item => !item.title.includes('投放实际'));
    }
    return view.highlights.today;
  }, [view, isTodayCostsPending]);

  const table = (title: string) => view?.tables.find(t => t.title === title);
  const monthAuditTable = table('星盟月累计 · 电商与聚光分别核对');
  const starMonthRow = monthAuditTable?.rows.find(r => String(r[1] || '').includes('红星'));
  const allianceMonthRow = monthAuditTable?.rows.find(r => String(r[1] || '').includes('红盟'));
  const starMonthSnapshot = starMonthRow ? { target: starMonthRow[9], actual: starMonthRow[12], monitored: starMonthRow[11] } : undefined;
  const allianceMonthSnapshot = allianceMonthRow ? { target: allianceMonthRow[9], actual: allianceMonthRow[12], monitored: allianceMonthRow[11] } : undefined;
  const detailQuery = {
    projectId,
    day,
    mode,
    fingerprint: view?.fingerprint || '',
    ...(overview && from ? { from } : {}),
    ...(overview && to ? { to } : {}),
  };

  // Dynamic period calculations for Overview mode
  const adPoints = (view?.series || []).filter(p => p.adSpend?.value !== null);
  const creatorPoints = (view?.series || []).filter(p => p.creatorCost?.value !== null);
  const completeInvestmentPoints = (view?.series || []).filter(p => p.projectInvestment?.value !== null);
  const completeSettlementPoints = (view?.series || []).filter(p => p.settlement?.value !== null);

  const periodAdSpend = adPoints.reduce((acc, p) => acc + (p.adSpend?.value || 0), 0);
  const periodCreatorCost = creatorPoints.reduce((acc, p) => acc + (p.creatorCost?.value || 0), 0);
  const periodProjectInvestment = completeInvestmentPoints.reduce((acc, p) => acc + (p.projectInvestment?.value || 0), 0);
  const periodSettlement = completeSettlementPoints.reduce((acc, p) => acc + (p.settlement?.value || 0), 0);

  const latestCreatorPoint = creatorPoints.at(-1);
  const latestCompletePoint = completeInvestmentPoints.at(-1);

  return (
    <DailyDetailsContext.Provider value={detailQuery}>
      <div
        id={overview ? 'workspace-tabpanel-overview' : 'workspace-tabpanel-daily'}
        role="tabpanel"
        aria-labelledby={overview ? 'workspace-tab-overview' : 'workspace-tab-daily'}
        tabIndex={0}
        className="business-daily"
        data-testid={overview ? 'business-data-overview' : 'business-daily-board'}
      >
        {/* Compact, Unified Toolbar */}
        <div className="bd-toolbar-compact">
          <div className="bd-toolbar-meta">
            <span className="bd-meta-chip">{overview ? '数据总览 · 全盘效果' : '分日看板 · 执行底表'}</span>
            <span className="bd-meta-text">
              {overview ? (
                <>
                  统计区间：<strong>{view?.from || from || day.slice(0, 7) + '-01'}</strong> 至 <strong>{view?.to || to || day}</strong>
                </>
              ) : (
                <>
                  业务日期：<strong>{day}</strong>
                </>
              )}
            </span>
            <span className="bd-meta-cutoff">
              实际数据截至：<strong>{view?.businessThrough || '待采集'}</strong>
              {view?.latestRegisteredDay && view.latestRegisteredDay > (view?.businessThrough || '') && (
                <span className="bd-meta-sub-cutoff" style={{ marginLeft: 6, opacity: 0.85, fontSize: 12 }}>
                  （达人等部分费用已登记至 {view.latestRegisteredDay}）
                </span>
              )}
            </span>
            {!overview && isTodayCostsPending && (
              <span className="bd-meta-status-chip">
                当日投放待录入 · 接入 {latestObservedPoint?.date || view?.businessThrough} 实绩
              </span>
            )}
          </div>

          <div className="bd-toolbar-controls">
            {overview ? (
              <>
                <div className="bd-quick-group">
                  <button
                    type="button"
                    className="bd-quick-btn"
                    onClick={() => {
                      setFrom(day);
                      setTo(day);
                    }}
                  >
                    本日
                  </button>
                  <button
                    type="button"
                    className="bd-quick-btn"
                    onClick={() => {
                      const d = new Date(day + 'T00:00:00Z');
                      d.setUTCDate(d.getUTCDate() - 6);
                      setFrom(d.toISOString().slice(0, 10));
                      setTo(day);
                    }}
                  >
                    近7天
                  </button>
                  <button
                    type="button"
                    className="bd-quick-btn"
                    onClick={() => {
                      setFrom(day.slice(0, 7) + '-01');
                      setTo(day);
                    }}
                  >
                    本月
                  </button>
                </div>
                <label className="bd-date-input-capsule">
                  <span className="bd-capsule-label">从</span>
                  <CustomDatePicker
                    aria-label="统计开始"
                    value={from || day.slice(0, 7) + '-01'}
                    onChange={e => setFrom(e.target.value)}
                  />
                </label>
                <label className="bd-date-input-capsule">
                  <span className="bd-capsule-label">至</span>
                  <CustomDatePicker
                    aria-label="统计结束"
                    value={to || day}
                    onChange={e => setTo(e.target.value)}
                  />
                </label>
                <label className="bd-date-input-capsule">
                  <span className="bd-capsule-label">基准日</span>
                  <CustomDatePicker
                    aria-label="业务基准日"
                    value={day}
                    onChange={e => {
                      setDay(e.target.value);
                      setNotice('');
                    }}
                  />
                </label>
              </>
            ) : (
              <div className="bd-daily-date-picker-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="bd-date-step-pill-group">
                  <button
                    type="button"
                    className="bd-quick-btn bd-step-btn"
                    onClick={() => {
                      const d = new Date(day + 'T00:00:00Z');
                      d.setUTCDate(d.getUTCDate() - 1);
                      setDay(d.toISOString().slice(0, 10));
                      setNotice('');
                    }}
                    aria-label="前一天"
                    title="切换至前一日"
                  >
                    ← 前一日
                  </button>
                  <label className="bd-date-capsule-body">
                    <span className="bd-date-icon" aria-hidden="true">📅</span>
                    <CustomDatePicker
                      aria-label="业务日期"
                      value={day}
                      onChange={e => {
                        setDay(e.target.value);
                        setNotice('');
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="bd-quick-btn bd-step-btn"
                    onClick={() => {
                      const d = new Date(day + 'T00:00:00Z');
                      d.setUTCDate(d.getUTCDate() + 1);
                      setDay(d.toISOString().slice(0, 10));
                      setNotice('');
                    }}
                    aria-label="后一天"
                    title="切换至后一日"
                  >
                    后一日 →
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  数据版本
                  <CustomSelect
                    ariaLabel="数据版本"
                    value={mode}
                    onChange={v => setMode(v)}
                    options={[
                      { value: 'latest', label: '当前最新底表' },
                      { value: 'source_snapshot', label: '来源日报快照' },
                      { value: 'confirmed', label: '已确认历史日报' },
                    ]}
                  />
                </label>
              </div>
            )}

            <button disabled={busy} onClick={() => {
              invalidateQueryCache({ projectId, endpoint: '/api/business-daily' });
              setRevision(n => n + 1);
              void refreshDaily({ fresh: true });
            }}>
              刷新
            </button>
            {canWrite && <button onClick={() => setConfigOpen(true)}>配置业务来源与规则</button>}
            {canWrite && !overview && mode === 'latest' && (
              <button
                className="primary-btn"
                disabled={busy || !view || !view.sourceVersions.length}
                onClick={confirm}
              >
                确认并保存日报
              </button>
            )}
          </div>
        </div>

        {notice && <p role="status" className="bd-notice-banner">{notice}</p>}

        {error ? (
          <ErrorState error={error} onRetry={() => {
            invalidateQueryCache({ projectId, endpoint: '/api/business-daily' });
            setRevision(n => n + 1);
            void refreshDaily({ fresh: true });
          }} />
        ) : (busy || pending) && !view ? (
          <LoadingState text="正在读取项目业务日报…" />
        ) : (
          view && (
            <>
              {!view.sourceVersions.length && (
                <EmptyState title="本项目尚未绑定业务日报来源" text="为本项目配置独立数据源、业务周期、预算和规则后查看。" />
              )}

              {view.sourceVersions.length > 0 && (
                <>
                  {/* Lightweight Section Anchor Navigation */}
                  <nav
                    className="bd-section-nav"
                    aria-label={overview ? '数据总览板块导航' : '业务分日板块导航'}
                  >
                    {(overview ? overviewNavItems : dailyNavItems).map(item => (
                      <a
                        key={item.id}
                        href={'#' + item.id}
                        onClick={e => {
                          if (typeof document !== 'undefined') {
                            const target = document.getElementById(item.id);
                            if (target) {
                              e.preventDefault();
                              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              target.focus({ preventScroll: true });
                            }
                          }
                        }}
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>

                  {/* Overview Group 1: 经营表现 */}
                  {overview && (
                    <GroupHeading
                      id="view-overview-performance"
                      badge="01"
                      title="经营表现"
                      subtitle="区间核心指标、平台广告消耗走势、渠道费用构成与电商漏斗"
                    />
                  )}

                  {/* Daily Group 1: 当日重点与费用进度 */}
                  {!overview && (
                    <GroupHeading
                      id="view-daily-focus-spend"
                      badge="01"
                      title="当日重点与费用进度"
                      subtitle="业务状态、当日待办、FS累计计划与消耗及分渠道当日明细"
                    />
                  )}

                  {/* KPI Cards: Overview Period vs. Single-Day distinction */}
                  {overview ? (
                    <div className="bd-kpi-grid-rich">
                      <article className="bd-kpi-card-rich">
                        <div className="bd-kpi-head">
                          <span>平台广告消耗</span>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-val">{'¥' + format(periodAdSpend)}</div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + adPoints.length + ' 个有效观测日（' + (view?.from?.slice(5) || '10-01') + ' 至 ' + (latestObservedPoint?.date?.slice(5) || view.businessThrough) + '）· 日均 ¥' + format(periodAdSpend / (adPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.adSpend?.value !== null
                              ? '¥' + format(selected?.adSpend?.value)
                              : '最新有效（' + (latestObservedPoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestObservedPoint?.adSpend?.value)}
                          </strong>
                        </div>
                      </article>

                      <article className="bd-kpi-card-rich">
                        <div className="bd-kpi-head">
                          <span>达人合作费用</span>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-val">{'¥' + format(periodCreatorCost)}</div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + creatorPoints.length + ' 个有效观测日 · 日均 ¥' + format(periodCreatorCost / (creatorPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.creatorCost?.value !== null
                              ? '¥' + format(selected?.creatorCost?.value)
                              : '最新有效（' + (latestCreatorPoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCreatorPoint?.creatorCost?.value)}
                          </strong>
                        </div>
                      </article>

                      <article className="bd-kpi-card-rich">
                        <div className="bd-kpi-head">
                          <span>项目总投入</span>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-val">{'¥' + format(periodProjectInvestment)}</div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + completeInvestmentPoints.length + ' 个完整投流日 · 日均 ¥' + format(periodProjectInvestment / (completeInvestmentPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.projectInvestment?.value !== null
                              ? '¥' + format(selected?.projectInvestment?.value)
                              : '最新有效（' + (latestCompletePoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCompletePoint?.projectInvestment?.value)}
                          </strong>
                        </div>
                      </article>

                      <article className="bd-kpi-card-rich">
                        <div className="bd-kpi-head">
                          <span>政策后结算金额</span>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-val">{'¥' + format(periodSettlement)}</div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + completeSettlementPoints.length + ' 个完整投流日 · 月累计结算 ¥' + format(view.core.monthlySettlement?.value) + '（进度 ' + format((view.progress.settlementFraction ?? 0) * 100) + '%）'}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.settlement?.value !== null
                              ? '¥' + format(selected?.settlement?.value)
                              : '最新有效（' + (latestCompletePoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCompletePoint?.settlement?.value)}
                          </strong>
                        </div>
                      </article>
                    </div>
                  ) : (
                    /* DAILY MODE KPIS */
                    isTodayCostsPending ? (
                      latestObservedPoint ? (
                        <div className="bd-recent-kpis-wrapper" style={{ margin: '6px 0 10px' }}>
                          <div
                            className="bd-recent-kpis-header"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              padding: '8px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderBottom: 'none',
                              borderRadius: '8px 8px 0 0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ fontSize: 13, color: '#1e293b' }}>
                                {view.core.creatorCost?.value !== null
                                  ? `最近完整费用实绩 · ${latestObservedPoint.date.slice(5).replace('-', '月')}日（未齐备指标接入）`
                                  : `最近费用实绩 · ${latestObservedPoint.date.slice(5).replace('-', '月')}日`}
                              </strong>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: '#eaf2f0',
                                  color: '#2c7168',
                                }}
                              >
                                {view.core.creatorCost?.value !== null ? '未齐备指标接入 14 实绩' : '最新有效实绩'}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {view.core.creatorCost?.value !== null
                                ? `${day.slice(5)} 费用尚未齐备 · 达人等已填报，投流广告待回填，业务基准日保持 ${day}`
                                : `${day.slice(5)} 分日费用待录入（月累计结算已达 ¥${format(view.core.monthlySettlement?.value)}），业务基准日保持 ${day}`}
                            </span>
                          </div>
                          <div className="bd-kpis" style={{ marginTop: 0 }}>
                            <article className="bd-kpi-card-rich">
                              <div className="bd-kpi-head">
                                <span>平台广告消耗</span>
                                <span className="bd-kpi-badge">{latestObservedPoint.date.slice(5)} 完整实绩</span>
                              </div>
                              <div className="bd-kpi-val">¥{format(latestObservedPoint.adSpend?.value)}</div>
                              <div className="bd-kpi-sub">
                                信息流 ¥{format(latestObservedPoint.feed?.value)} + 搜索 ¥{format(latestObservedPoint.search?.value)}
                              </div>
                              <span className="bd-state">未齐备指标 · 参考 {latestObservedPoint.date} 完整实绩</span>
                            </article>

                            <article className="bd-kpi-card-rich">
                              <div className="bd-kpi-head">
                                <span>达人合作费用</span>
                                <span className="bd-kpi-badge">
                                  {view.core.creatorCost?.value !== null ? `${day.slice(5)} 已登记` : `${latestObservedPoint.date.slice(5)} 实绩`}
                                </span>
                              </div>
                              <div className="bd-kpi-val">
                                ¥{format(view.core.creatorCost?.value !== null ? view.core.creatorCost.value : latestObservedPoint.creatorCost?.value)}
                              </div>
                              <div className="bd-kpi-sub">
                                {view.core.creatorCost?.value !== null
                                  ? `星 ¥${format(selected?.starCreator?.value ?? selected?.star?.investment?.value ?? 0)} + 盟 ¥${format(selected?.allianceCreator?.value ?? selected?.alliance?.investment?.value ?? 0)}`
                                  : `星 ¥${format(latestObservedPoint.starCreator?.value ?? latestObservedPoint.star?.investment?.value ?? 0)} + 盟 ¥${format(latestObservedPoint.allianceCreator?.value ?? latestObservedPoint.alliance?.investment?.value ?? 0)}`}
                              </div>
                              <span className="bd-state">
                                {view.core.creatorCost?.value !== null ? `周报Q4 · ${day} 达人已填报` : `周报Q4 · ${latestObservedPoint.date} 实绩`}
                              </span>
                            </article>

                            <article className="bd-kpi-card-rich">
                              <div className="bd-kpi-head">
                                <span>项目总投入</span>
                                <span className="bd-kpi-badge">{latestObservedPoint.date.slice(5)} 完整实绩</span>
                              </div>
                              <div className="bd-kpi-val">¥{format(latestObservedPoint.projectInvestment?.value)}</div>
                              <div className="bd-kpi-sub">
                                {view.core.projectInvestment?.partialValue !== undefined && view.core.projectInvestment?.partialValue !== null
                                  ? `${day.slice(5)} 部分已登记：¥${format(view.core.projectInvestment.partialValue)}（缺投流广告）`
                                  : '含KFSOP及杂费总投资'}
                              </div>
                              <span className="bd-state">未齐备指标 · 参考 {latestObservedPoint.date} 完整实绩</span>
                            </article>

                            <article className="bd-kpi-card-rich">
                              <div className="bd-kpi-head">
                                <span>政策后结算金额</span>
                                <span className="bd-kpi-badge">{latestObservedPoint.date.slice(5)} 完整实绩</span>
                              </div>
                              <div className="bd-kpi-val">¥{format(latestObservedPoint.settlement?.value)}</div>
                              <div className="bd-kpi-sub">
                                {view.core.settlement?.partialValue !== undefined && view.core.settlement?.partialValue !== null
                                  ? `${day.slice(5)} 部分已登记：¥${format(view.core.settlement.partialValue)}（缺投流广告）`
                                  : '政策后核算（星盟总结算）'}
                              </div>
                              <span className="bd-state">未齐备指标 · 参考 {latestObservedPoint.date} 完整实绩</span>
                            </article>
                          </div>
                        </div>
                      ) : (
                        <div className="bd-empty-cost-status" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', margin: '8px 0' }}>
                          <strong style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 4 }}>暂无历史分日费用实绩</strong>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                            原因：底表尚未录入任何有效分日费用记录。<br />
                            来源：周趋势底表 Q4。<br />
                            下一步：等待投放与媒介团队录入分日明细后自动呈现。
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="bd-kpis">
                        {([
                          ['平台广告消耗 · 当日', view.core.adSpend],
                          ['达人合作费用 · 当日', view.core.creatorCost],
                          ['项目总投入 · 当日', view.core.projectInvestment],
                          ['政策后结算金额 · 当日', view.core.settlement],
                        ] as [string, Cell][]).map(([name, value]) => (
                          <article key={name}>
                            <h4>{name}</h4>
                            <Value value={value} />
                          </article>
                        ))}
                      </div>
                    )
                  )}

                  {/* Alerts & Consolidated Status Banner */}
                  {isTodayCostsPending ? (
                    <div className="bd-alerts-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 6, margin: '8px 0 10px', fontSize: 11.5, color: '#78716c' }}>
                      <span>💡 <strong>{day} 费用尚未齐备 · 投流广告待回填</strong> · 达人等单项已登记，未齐备指标参考 {latestObservedPoint?.date} 完整实绩；所选基准日保持 {day}。</span>
                      <details style={{ display: 'inline', marginLeft: 8 }}>
                        <summary style={{ cursor: 'pointer', color: '#0284c7', fontSize: 11 }}>来源核对</summary>
                        <span className="bd-caption" style={{ display: 'block', marginTop: 4 }}>数据源：周趋势底表 Q4 (loIsK8)</span>
                      </details>
                    </div>
                  ) : (
                    <div className="bd-alerts">
                      {view.businessThrough !== day && (
                        <p>
                          {'所选基准日（' + day + '）投放实际尚未齐备（最新截至 ' + (view.businessThrough || '待采集') + '），缺失数值保留 —；维护和SEO按所选日报登记展示。'}
                        </p>
                      )}
                      {view.progress.lagPoints !== null && view.progress.lagPoints >= view.progress.alertThresholdPoints && (
                        <p>
                          {'FS业务排期落后 ' + format(view.progress.lagPoints) + ' 个百分点（阈值 ' + view.progress.alertThresholdPoints + ' 个百分点）。'}
                        </p>
                      )}
                    </div>
                  )}

                  {!overview && filteredTodayActions.length > 0 && <TodayBusinessActions items={filteredTodayActions} />}

                  {/* OVERVIEW MODE CONTENT */}
                  {overview ? (
                    <>
                      {/* 1. 业务费用与消耗走势 */}
                      <section className="bd-panel" data-section="spend">
                        <h3>平台广告消耗与项目总投入走势</h3>
                        <p className="bd-caption">统计区间内每日消耗、总投入与结算走势；缺失日期断开不伪造。</p>
                        <TimeSeriesChart
                          title="业务费用趋势"
                          unit="元"
                          rows={view.series.map(p => ({
                            date: p.date,
                            ads: p.adSpend.value,
                            investment: p.projectInvestment.value,
                            settlement: p.settlement.value,
                          }))}
                          series={[
                            { key: 'ads', label: '平台广告消耗', color: DASHBOARD_PALETTE.actual },
                            { key: 'investment', label: '项目总投入', color: DASHBOARD_PALETTE.investment },
                            { key: 'settlement', label: '政策后结算', color: DASHBOARD_PALETTE.settlement },
                          ]}
                        />
                        <SpendBars view={view} selectedDay={day} onSelectDay={d => setDay(d)} />
                      </section>

                      {/* 2. 渠道结构分布 */}
                      <section className="bd-panel" data-section="spend">
                        <ChannelStructureOverview series={view.series} />
                      </section>

                      {/* 3. 星盟电商转化漏斗 */}
                      <section className="bd-panel" data-section="funnel">
                        <h3>星盟电商漏斗 · {view.funnel.scope}</h3>
                        <p className="bd-caption">
                          {view.funnel.aggregation}。缺少同范围归因证据时，阶段不计算转化率。
                        </p>
                        <div className="bd-two-col">
                          <Funnel title="小红星 · 淘宝星河" data={view.funnel.star} monthSnapshot={starMonthSnapshot} />
                          <Funnel title="小红盟 · 京准通" data={view.funnel.alliance} monthSnapshot={allianceMonthSnapshot} />
                        </div>
                        {table('星盟月累计 · 电商与聚光分别核对') && (
                          <details style={{ marginTop: 12 }}>
                            <summary>展开日报月累计核对明细</summary>
                            <DataTable table={table('星盟月累计 · 电商与聚光分别核对')!} />
                          </details>
                        )}
                      </section>

                                            {/* Overview Group 2: 投流效果 */}
                      <GroupHeading
                        id="view-overview-ad"
                        badge="02"
                        title="投流效果"
                        subtitle="搜索与信息流成本、行业基准对比、核心占位词及人群渗透"
                      />

                      {/* 4. 搜索与信息流核心概览双列对称排版 */}
                      <div className="bd-two-col bd-core-overview">
                        {view.highlights?.search && (
                          <section className="bd-panel" data-section="search">
                            <h3>搜索分析 · 核心概览</h3>
                            <AspectSummaryCard aspectKey="search" view={view} overview={true} />
                            <SearchVisuals data={view.highlights.search} hideCoreWords={true} hideTopKeywords={true} />
                            <p className="bd-caption" style={{ marginTop: 8 }}>
                              搜索侧费用与关键词为 10 月底表累计，非单日数据。
                            </p>
                          </section>
                        )}
                        {view.highlights?.feed && (
                          <section className="bd-panel" data-section="feed">
                            <h3>信息流分析 · 核心概览</h3>
                            <AspectSummaryCard aspectKey="feed" view={view} overview={true} />
                            <FeedVisuals data={view.highlights.feed} hideAudienceRanks={true} />
                          </section>
                        )}
                      </div>

                      {/* 5. 搜索核心占位大词与高消耗词 TOP 10 独立全宽行 */}
                      {view.highlights?.search && (
                        <section className="bd-panel" data-section="search">
                          <div className="bd-panel-head">
                            <div>
                              <h3>搜索核心占位大词与高消耗词 TOP 10（底表累计）</h3>
                              <p className="bd-caption" style={{ marginTop: 4 }}>
                                核心占位词表现与高消耗关键词排行（底表累计）；无每日观测不伪造趋势。
                              </p>
                            </div>
                          </div>
                          <SearchCoreWordsVisuals data={view.highlights.search} />
                          {view.highlights.search.topKeywords && view.highlights.search.topKeywords.length > 0 && (
                            <div className="bd-keywords-top-container" style={{ marginTop: 14 }}>
                              <HorizontalRanks
                                rows={view.highlights.search.topKeywords}
                                title="高消耗关键词排行（底表累计）"
                                unit="元"
                                color="purple"
                              />
                            </div>
                          )}
                        </section>
                      )}

                      {/* 6. 信息流人群定向与竞品人群渗透 独立全宽行 */}
                      {view.highlights?.feed && (
                        <section className="bd-panel" data-section="feed">
                          <div className="bd-panel-head">
                            <div>
                              <h3>信息流人群定向与竞品人群渗透</h3>
                              <p className="bd-caption">小红星 / 小红盟定向人群包月累计 CPUV 分布与竞品人群渗透对比；无每日观测不推算。</p>
                            </div>
                          </div>
                          <FeedAudienceVisuals data={view.highlights.feed} />
                        </section>
                      )}

                                            {/* Overview Group 3: 执行进度 */}
                      <GroupHeading
                        id="view-overview-execution"
                        badge="03"
                        title="执行进度"
                        subtitle="评论区质量巡查整改、达人储备发布进展、评论维护心智与SEO收录占位"
                      />

                      {/* 7. 评论区质量巡查与整改全盘 独立全宽行 */}
                      {view.highlights?.rectification && (
                        <section className="bd-panel" data-section="rectification">
                          <h3>评论区质量巡查与整改进度全盘</h3>
                          <AspectSummaryCard aspectKey="rectification" view={view} overview={true} />
                          <RectificationVisuals data={view.highlights.rectification} />
                          <p className="bd-caption" style={{ marginTop: 8 }}>
                            {'当前底表共登记 ' + view.highlights.rectification.total + ' 个唯一笔记ID。源表巡查登记截至当前底表快照，非单日数据。'}
                          </p>
                        </section>
                      )}

                      {/* 8. 达人储备与执行底表进度 + 评论维护 */}
                      <div className="bd-two-col bd-creators-maintenance">
                        {view.highlights?.creators && (
                          <section className="bd-panel" data-section="creators">
                            <h3>达人储备与执行底表进度</h3>
                            <AspectSummaryCard aspectKey="creators" view={view} overview={true} />
                            <CreatorVisuals data={view.highlights.creators} />
                            <p className="bd-caption" style={{ marginTop: 'auto', paddingTop: 8 }}>
                              {'执行底表已发布登记 ' + (view.highlights.creators.currentPublished ?? '—') + ' 篇，按发布日期截至所选日累计。'}
                            </p>
                          </section>
                        )}
                        {view.highlights?.maintenance && (
                          <section className="bd-panel" data-section="comments">
                            <h3>评论维护 · 计划、形式与心智</h3>
                            <AspectSummaryCard aspectKey="maintenance" view={view} overview={true} />
                            <MaintenanceVisuals data={view.highlights.maintenance} />
                          </section>
                        )}
                      </div>

                      {/* 9. SEO 关键词验收达成进展 独立全宽行 */}
                      {view.highlights?.seo && (
                        <section className="bd-panel" data-section="seo">
                          <h3>SEO 关键词验收达成进展</h3>
                          <AspectSummaryCard aspectKey="seo" view={view} overview={true} />
                          <SeoVisuals data={view.highlights.seo} />
                          <p className="bd-caption" style={{ marginTop: 8 }}>
                            SEO 验收底表累计达成。条带表达已登记目标进度，无逐日位置不伪造趋势。
                          </p>
                        </section>
                      )}
                    </>
                  ) : (
                    /* DAILY MODE CONTENT */
                    <>
                      <section className="bd-panel bd-main-chart" data-section="spend">
                        <div className="bd-panel-head">
                          <div>
                            <h3>当日渠道费用结构与对账明细 ({day})</h3>
                            <p className="bd-caption">选定单日FS实际与排期明细对照；整体KFSOPZ进度另列。</p>
                          </div>
                          <div className="bd-progress">
                            <span>月时间进度 {format(view.progress.timeFraction * 100)}%</span>
                            <span>
                              FS业务排期 {format(view.progress.scheduleFraction === null ? null : view.progress.scheduleFraction * 100)}%
                            </span>
                            <span>
                              日报月累计结算进度 {format(view.progress.settlementFraction === null ? null : view.progress.settlementFraction * 100)}%
                            </span>
                          </div>
                        </div>
                        <AspectSummaryCard aspectKey="spend" view={view} overview={false} />
                        {view?.platformNative && (
                          <div className="bd-platform-reconcile-chip" style={{ margin: '8px 0', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#334155' }}>
                            <strong style={{ color: DASHBOARD_PALETTE.actual }}>平台原生观测对账：</strong>
                            {view.platformNative.status === 'missing_weekly' ? (
                              <span>{view.platformNative.day} 聚光原生投放 ¥{format(view.platformNative.totalFee)}（信息流 ¥{format(view.platformNative.feedFee)} + 搜索 ¥{format(view.platformNative.searchFee)}）。周底表广告投放尚未回填，保持独立来源对账，不计入周表成本总口径。</span>
                            ) : view.platformNative.status === 'difference' ? (
                              <span>{view.platformNative.day} 聚光原生投放 ¥{format(view.platformNative.totalFee)} vs 周底表广告消耗 ¥{format(view.platformNative.weeklyAdSpend)}，<strong>差额 ¥{format(view.platformNative.delta)}</strong>（口径待核对）。两套来源独立，不擅自合并或自动抵扣。</span>
                            ) : (
                              <span>{view.platformNative.day} 聚光原生投放与周底表广告消耗金额一致（¥{format(view.platformNative.totalFee)}）。</span>
                            )}
                          </div>
                        )}
                        <div className="bd-costs">
                          {selected &&
                            ([
                              ['K达人', selected.creatorCost, latestObservedPoint?.creatorCost],
                              ['F信息流', selected.feed, latestObservedPoint?.feed],
                              ['S搜索', selected.search, latestObservedPoint?.search],
                              ['SEO', selected.seo, latestObservedPoint?.seo],
                              ['评论', selected.comments, latestObservedPoint?.comments],
                              ['杂费', selected.other, latestObservedPoint?.other],
                            ] as [string, Cell, Cell | undefined][]).map(([name, value, refVal]) => (
                              <div key={name}>
                                <span>{name}</span>
                                {value.value !== null ? (
                                  <Value value={value} />
                                ) : (
                                  <div>
                                    <strong style={{ color: DASHBOARD_PALETTE.plan }}>—<small>元</small></strong>
                                    {refVal?.value !== null && refVal?.value !== undefined && (
                                      <small className="bd-state" style={{ color: DASHBOARD_PALETTE.settlement }}>
                                        {latestObservedPoint?.date?.slice(5)}: ¥{format(refVal.value)}
                                      </small>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                        <details className="bd-history-details" style={{ margin: '14px 0', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', background: '#fafaf9' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            📈 查看月度累计FS走势与历史排期走势 (可选折叠)
                          </summary>
                          <div style={{ marginTop: 12 }}>
                            <TimeSeriesChart
                              title="累计FS计划与实际消耗"
                              height={260}
                              unit="元"
                              rows={cumulative}
                              series={[
                                { key: 'plan', label: '累计FS计划', color: DASHBOARD_PALETTE.plan },
                                { key: 'actual', label: '累计平台广告消耗', color: DASHBOARD_PALETTE.actual },
                              ]}
                            />
                            <SpendBars view={view} selectedDay={day} onSelectDay={d => setDay(d)} />
                            <p className="bd-caption" style={{ marginTop: 8 }}>
                              截至 {view.businessThrough || '待采集'}，同范围FS计划 {format(view.progress.planThroughData)} 元，实际 {format(view.progress.actualThroughData)} 元，差额（实际−计划）{format(view.progress.gapThroughData)} 元。
                            </p>
                          </div>
                        </details>
                        <div className="bd-monthly">
                          日报月预算 {format(view.core.monthlyBudget.value)} 元 · 月累计政策后结算 {format(view.core.monthlySettlement.value)} 元{' '}
                          <Source value={view.core.monthlySettlement.source} />
                        </div>
                        {table('日 / 周 / 月费用对账') && (
                          <details>
                            <summary>展开日 / 周 / 月费用对账底表</summary>
                            <DataTable table={table('日 / 周 / 月费用对账')!} />
                          </details>
                        )}
                    {table('平台原生投放分日核对 · 聚光') && (
                      <details className="bd-table-details" style={{ marginTop: 8 }} open>
                        <summary>
                          {view?.platformNative?.totalFee
                            ? `展开平台原生投放分日核对（聚光独立来源 · ${view.platformNative.day.slice(5)} ¥${format(view.platformNative.totalFee)} · ${view.platformNative.statusLabel || (view.platformNative.status === 'missing_weekly' ? '待回填' : view.platformNative.status === 'difference' ? '金额有差异' : '金额一致')}）`
                            : '展开平台原生投放分日核对（聚光独立来源）'}
                        </summary>
                        <DataTable table={table('平台原生投放分日核对 · 聚光')!} />
                      </details>
                    )}
                        {table('预算版本 · 每日FS排期') && (
                          <details>
                            <summary>展开日 / 周排期及预算版本</summary>
                            <DataTable table={table('预算版本 · 每日FS排期')!} initial={31} />
                          </details>
                        )}
                      </section>

                                            {/* Daily Group 2: 投流执行 */}
                      <GroupHeading
                        id="view-daily-ad"
                        badge="02"
                        title="投流执行"
                        subtitle="搜索与信息流当日成本、关键词排行与人群定向"
                      />

                      {/* 1. Symmetrical Core Overview Pairing: Search vs Feed */}
                      <div className="bd-two-col bd-core-overview">
                        <section className="bd-panel" data-section="search">
                          <h3>搜索分析 · 核心概览</h3>
                          <AspectSummaryCard aspectKey="search" view={view} overview={false} />
                          {view.highlights && <SearchVisuals data={view.highlights.search} hideCoreWords={true} hideTopKeywords={true} />}
                          <details style={{ marginTop: 12 }}>
                            <summary>展开搜索侧作者原文明细</summary>
                            <NarrativeBlock title="搜索侧" view={view} />
                          </details>
                        </section>
                        <section className="bd-panel" data-section="feed">
                          <h3>信息流分析 · 核心概览</h3>
                          <AspectSummaryCard aspectKey="feed" view={view} overview={false} />
                          {view.highlights && <FeedVisuals data={view.highlights.feed} hideAudienceRanks={true} />}
                          <details style={{ marginTop: 12 }}>
                            <summary>展开信息流侧作者原文明细与重点发现</summary>
                            <NarrativeBlock title="信息流侧" view={view} />
                            <NarrativeBlock title="重点发现" view={view} />
                          </details>
                          {table('星盟月累计 · 电商与聚光分别核对') && (
                            <details style={{ marginTop: 12 }}>
                              <summary>展开星盟效果核对明细底表</summary>
                              <DataTable table={table('星盟月累计 · 电商与聚光分别核对')!} />
                            </details>
                          )}
                        </section>
                      </div>

                      {/* 2. Dedicated Full-Width Row: 搜索核心占位大词与高消耗词 TOP 10 */}
                      {view.highlights?.search && (
                        <section className="bd-panel" data-section="search">
                          <div className="bd-panel-head">
                            <div>
                              <h3>搜索核心占位大词与高消耗词 TOP 10（底表累计）</h3>
                              <p className="bd-caption">核心占位词表现与高消耗关键词排行（底表累计）；无每日观测不伪造趋势。</p>
                            </div>
                          </div>
                          <SearchCoreWordsVisuals data={view.highlights.search} />
                          <div className="bd-keywords-top-container" style={{ marginTop: 14 }}>
                            <HorizontalRanks
                              rows={view.highlights.search.topKeywords}
                              title="高消耗关键词排行（底表累计）"
                              unit="元"
                              color="purple"
                            />
                          </div>
                          {['占位词下高消耗笔记', '关键词消耗排行'].map(name =>
                            table(name) ? (
                              <details key={name}>
                                <summary>
                                  {name}（{table(name)!.totalRows ?? table(name)!.rows.length}条）
                                </summary>
                                <DataTable table={table(name)!} />
                              </details>
                            ) : null
                          )}
                        </section>
                      )}

                      {/* 3. Dedicated Full-Width Row: 信息流人群定向与竞品人群渗透 */}
                      {view.highlights?.feed && (
                        <section className="bd-panel" data-section="feed">
                          <div className="bd-panel-head">
                            <div>
                              <h3>信息流人群定向与竞品人群渗透</h3>
                              <p className="bd-caption">小红星 / 小红盟定向人群包月累计 CPUV 分布与竞品人群渗透对比；底表累计快照观测。</p>
                            </div>
                          </div>
                          <FeedAudienceVisuals data={view.highlights.feed} />
                        </section>
                      )}

                                            {/* Daily Group 3: 内容与评论/SEO执行 */}
                      <GroupHeading
                        id="view-daily-execution"
                        badge="03"
                        title="内容与评论/SEO执行"
                        subtitle="评论区质量巡查整改、高消耗笔记核对、达人发布推进、心智渗透与SEO达成"
                      />

                      {/* 4. Dedicated Full-Width Row: 评论区质量巡查与整改全盘 */}
                      <section className="bd-panel" data-section="rectification">
                        <h3>评论区质量巡查与整改进度</h3>
                        <AspectSummaryCard aspectKey="rectification" view={view} overview={false} />
                        {view.highlights && <RectificationVisuals data={view.highlights.rectification} />}
                        <h4>本月高消耗笔记 · 优先核对</h4>
                        <p className="bd-caption">
                          按当月消耗排序。源表整改登记、实际可见和本次采集分别记录，未检查不默认为合格。
                        </p>
                        <NoteRows notes={view.notes} projectId={projectId} day={day} />
                        <FullNotePages key={view.fingerprint} view={view} projectId={projectId} />
                      </section>

                      {/* 5. Symmetrical Paired Row: 达人储备与执行底表进度 + 评论维护 */}
                      <div className="bd-two-col bd-creators-maintenance">
                        <section className="bd-panel" data-section="creators">
                          <h3>达人储备与执行底表进度</h3>
                          <AspectSummaryCard aspectKey="creators" view={view} overview={false} />
                          {view.highlights && <CreatorVisuals data={view.highlights.creators} />}
                          <div className="bd-panel-bottom-details" style={{ marginTop: 'auto', paddingTop: 10 }}>
                            {['达人储备及发布进度', '当前执行底表 · 当月产出', '当月新发笔记档案'].map(name =>
                              table(name) ? (
                                <details key={name}>
                                  <summary>{name}</summary>
                                  <DataTable table={table(name)!} />
                                </details>
                              ) : null
                            )}
                          </div>
                        </section>
                        <section className="bd-panel" data-section="comments">
                          <h3>评论维护 · 计划、形式与心智</h3>
                          <AspectSummaryCard aspectKey="maintenance" view={view} overview={false} />
                          {view.highlights && <MaintenanceVisuals data={view.highlights.maintenance} />}
                          <div className="bd-panel-bottom-details" style={{ marginTop: 'auto', paddingTop: 10 }}>
                            <details style={{ marginTop: 0 }}>
                              <summary>展开评论区运营与商业笔记原文明细</summary>
                              <NarrativeBlock title="月执行" view={view} />
                              <NarrativeBlock title="商业笔记" view={view} />
                            </details>
                          </div>
                        </section>
                      </div>

                      {/* 6. Dedicated Full-Width Row: SEO 关键词收录与占位达成 (16-word grid) */}
                      <section className="bd-panel" data-section="seo">
                        <h3>SEO 关键词收录与占位达成进展</h3>
                        <AspectSummaryCard aspectKey="seo" view={view} overview={false} />
                        {view.highlights && <SeoVisuals data={view.highlights.seo} />}
                        <details style={{ marginTop: 12 }}>
                          <summary>展开 SEO 占位原文明细</summary>
                          <NarrativeBlock title="SEO" view={view} />
                        </details>
                        {['SEO关键词验收', 'SEO关联笔记', 'SEO占位词与执行目标'].map(name =>
                          table(name) ? (
                            <details key={name}>
                              <summary>
                                {name}（{table(name)!.totalRows ?? table(name)!.rows.length}条）
                              </summary>
                              <DataTable table={table(name)!} />
                            </details>
                          ) : null
                        )}
                      </section>

                      {/* 7. 当天动作、负责人和证据 */}
                      <section className="bd-panel" data-section="actions">
                        <h3>当天动作、负责人和证据</h3>
                        {table('板块负责人') && <DataTable table={table('板块负责人')!} />}
                        <NarrativeBlock title="核心todo" view={view} />
                        <NarrativeBlock title="核心亮点" view={view} />
                        <p className="bd-caption">
                          模块负责人按日报登记；具体整改负责人以笔记档案为准。竞品文字为作者观察，交叉验证尚未完成。
                        </p>
                      </section>

                      {/* Daily Group 4: 原文与来源 */}
                      <GroupHeading
                        id="view-daily-source"
                        badge="04"
                        title="原文与来源"
                        subtitle="完整日报作者文字、案例档案、业务同步与来源版本"
                      />

                      <details className="bd-panel">
                        <summary>查看完整日报文字、案例与来源（{view.narrative.length} 节）</summary>
                        {view.narrative.map((n, i) => (
                          <div className="bd-narrative" key={i}>
                            <h4>{n.title}</h4>
                            <p>{n.text}</p>
                            <Source value={n.source} />
                          </div>
                        ))}
                      </details>
                    </>
                  )}

                  {/* Overview Group 4: 数据明细 */}
                  {overview && (
                    <GroupHeading
                      id="view-overview-data"
                      badge="04"
                      title="数据明细"
                      subtitle="业务数据源同步状态、差异清单与底表采集版本"
                    />
                  )}

                  <BusinessSyncPanel
                    projectId={projectId}
                    canManage={Boolean(currentProject?.canManage && !currentProject?.isArchived)}
                  />

                  <details className="bd-panel">
                    <summary>差异清单与来源版本（{view.differences.length} 项）</summary>
                    {view.differences.map(d => (
                      <div key={d.key}>
                        <h4>{d.title}</h4>
                        <p>{d.details}</p>
                        {d.sources.map((s, i) => <Source key={i} value={s} />)}
                      </div>
                    ))}
                    {view.sourceVersions.map(s => (
                      <div key={s.sourceKey}>
                        <Source value={s} />
                        <span className="bd-caption"> · 采集 {s.capturedAt}</span>
                      </div>
                    ))}
                  </details>
                </>
              )}
            </>
          )
        )}
        <BusinessConfigDrawer
          projectId={projectId}
          isOpen={configOpen}
          onClose={() => setConfigOpen(false)}
          onSaved={() => setRevision(n => n + 1)}
        />
      </div>
    </DailyDetailsContext.Provider>
  );
}
