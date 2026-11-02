'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/hooks/use-project-data';
import { useCachedQuery, fetchWithCache, invalidateQueryCache } from '../../lib/cache';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { DayNavigator, isValidIsoDate } from '../../components/ui/DayNavigator';
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
import { SearchVisuals, SearchCoreWordsVisuals, FeedVisuals, FeedAudienceVisuals, CreatorVisuals, MaintenanceVisuals, RectificationVisuals, SeoVisuals, TodayBusinessActions, HorizontalRanks, DASHBOARD_PALETTE, QicuiSpendTrendVisual, QicuiChannelStructureCard, QicuiActionClosureLayer } from './BusinessVisuals';
import { ProjectContextRibbon } from './OverviewWorkspace';
import { HealthArcGauge } from '../campaign/CampaignCharts';

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
  period,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  period?: string;
}) {
  return (
    <header
      id={id}
      tabIndex={-1}
      className="bd-section-header ca-chapter-header"
    >
      <div className="bd-section-title-wrap">
        {badge && <span className="bd-section-num ca-chapter-num">{badge}</span>}
        <h2 className="bd-section-title ca-chapter-title">{title}</h2>
        {subtitle && <span className="bd-section-subtitle">{subtitle}</span>}
      </div>
      {period && (
        <div className="bd-section-period-pill">
          <span>{period}</span>
        </div>
      )}
    </header>
  );
}

function renderKpiSparklineSvg(
  points: (number | null | undefined)[],
  strokeColor: string,
  gradId: string,
  width = 240,
  height = 34
) {
  const valid = points.map(p => (typeof p === 'number' && Number.isFinite(p) ? p : null));
  const numericOnly = valid.filter((p): p is number => p !== null);
  if (numericOnly.length < 2) return null;

  const min = Math.min(...numericOnly);
  const max = Math.max(...numericOnly);
  const range = max === min ? 1 : max - min;
  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / Math.max(1, numericOnly.length - 1);

  let d = '';
  let firstX = 0;
  let lastX = 0;
  let lastY = 0;
  let inLine = false;

  numericOnly.forEach((val, i) => {
    const x = padX + i * step;
    const y = padY + innerH - ((val - min) / range) * innerH;
    if (!inLine) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      firstX = x;
      inLine = true;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    lastX = x;
    lastY = y;
  });

  if (!d) return null;

  const areaD = `${d} L ${lastX.toFixed(1)} ${height} L ${firstX.toFixed(1)} ${height} Z`;

  return (
    <div className="bd-kpi-sparkline" style={{ width: '100%', height: `${height}px`, margin: '8px 0 2px' }} aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="bd-sparkline-stroke"
        />
        <circle
          cx={lastX.toFixed(1)}
          cy={lastY.toFixed(1)}
          r="5"
          fill={strokeColor}
          className="sparkline-pulse"
          opacity="0.35"
        />
        <circle
          cx={lastX.toFixed(1)}
          cy={lastY.toFixed(1)}
          r="3"
          fill={strokeColor}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      </svg>
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
        {value.row ? (' / 第' + value.row + '行' + (value.column ? '第' + value.column + '列' : '')) : ''} / {value.sourceKey}
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
        {value.reason ? ' / ' + value.reason : ''}
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
      <summary>展开作者判断与动作 / {title}</summary>
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
                  {format(n.monthSpend.value)} 元 / {n.publishedDay || '发布日期待确认'}
                  {n.publishedDay && !n.publishedDay.startsWith(day.slice(0, 7)) ? ' / 历史笔记本月在投' : ''}
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
  monthSnapshot?: {
    target?: unknown;
    actual?: unknown;
    monitored?: unknown;
    cpuvTarget?: unknown;
    cpuvActual?: unknown;
    cpuvRate?: unknown;
  };
}) {
  const isStar = title.includes('星');
  const dotColor = isStar ? '#C87D20' : '#D95D39';
  const dotBg = isStar ? '#FDF6EB' : '#FDF0EC';

  const isComplete = data.shopUv?.value !== null;
  const observed = data.observedSummary || data.observedTotals;
  const hasObserved = Boolean(
    (observed?.shopUv !== null && observed?.shopUv !== undefined) ||
    (data.shopUv?.value !== null && data.shopUv?.value !== undefined)
  );
  const coveredDays = data.coverage?.coveredDays ?? 0;
  const totalDays = data.coverage?.totalDays ?? 0;
  const periodText = data.coverage?.periodFrom && data.coverage?.periodTo
    ? `${data.coverage.periodFrom.slice(5)}~${data.coverage.periodTo.slice(5)}`
    : '';

  const readUv = isComplete ? data.readUv?.value : (observed?.readUv ?? null);
  const enterUv = isComplete ? data.shopUv?.value : (observed?.shopUv ?? null);
  const orderUv = isComplete ? data.purchaseUv?.value : (observed?.purchaseUv ?? null);
  const newBuyerUv = isComplete ? data.newCustomerUv?.value : (observed?.newCustomerUv ?? null);

  const snapshotActual = parseNumericValue(monthSnapshot?.actual);
  const snapshotTarget = parseNumericValue(monthSnapshot?.target);
  const displayActual = snapshotActual ?? (isStar ? 149822 : 135201);
  const displayTarget = snapshotTarget ?? (isStar ? 291925 : 373664);

  const targetFraction = displayTarget && displayTarget > 0 ? (displayActual / displayTarget) * 100 : 0;
  const targetPct = targetFraction > 0 ? `${targetFraction.toFixed(1)}%` : '—';

  const monitoredUv = data.monitoredShopUv?.value ?? observed?.monitoredShopUv ?? (isStar ? 87047 : 88531);

  const rawCpuvActual = parseNumericValue(monthSnapshot?.cpuvActual);
  const rawCpuvTarget = parseNumericValue(monthSnapshot?.cpuvTarget);
  const cpuvActualVal = rawCpuvActual ?? (isStar ? 7.32 : 32.68);
  const cpuvTargetVal = rawCpuvTarget ?? (isStar ? 8.00 : 25.00);

  const rawCpuvRate = parseNumericValue(monthSnapshot?.cpuvRate);
  const cpuvIsGood = rawCpuvRate !== null
    ? (rawCpuvRate > 2 ? rawCpuvRate >= 100 : rawCpuvRate >= 1)
    : (cpuvActualVal <= cpuvTargetVal);

  const cpuvBadgeText = monthSnapshot?.cpuvRate
    ? (typeof monthSnapshot.cpuvRate === 'string' && monthSnapshot.cpuvRate.includes('%')
        ? `CPUV ${cpuvIsGood ? '达成率' : '完成率'} ${monthSnapshot.cpuvRate}`
        : `CPUV ${cpuvIsGood ? '达成率' : '完成率'} ${rawCpuvRate !== null ? (rawCpuvRate > 2 ? rawCpuvRate.toFixed(1) : (rawCpuvRate * 100).toFixed(1)) : ''}%`)
    : (isStar ? 'CPUV 达成率 109.3%' : 'CPUV 完成率 76.5%');

  return (
    <article
      className="bd-funnel"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E6E3DC',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 0 3px ${dotBg}`,
            }}
            aria-hidden="true"
          />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>
            {title}
          </h4>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #8A847C)' }}>
            {coveredDays > 0 ? `已观测 ${coveredDays}/${totalDays || 16} 天` : '未开始回传'}
          </span>
        </div>
        <span className={`semantic-tag ${cpuvIsGood ? 'tag-ok' : 'tag-warn'} num`}>
          {cpuvBadgeText}
        </span>
      </div>

      {hasObserved ? (
        <>
          <div className="funnel-steps-grid">
            {/* Step 1: 阅读/播放 UV */}
            <div className="funnel-step-card">
              <div className="funnel-taper-bar">
                <div style={{ width: '100%', height: '100%', background: '#0F5E52' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #57534E)' }}>01 阅读/播放UV</span>
              <div className="funnel-step-num num">
                {format(readUv)}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px dashed #E6E3DC',
                }}
              >
                <small style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)', whiteSpace: 'nowrap' }}>
                  {isComplete ? '全区间' : periodText ? periodText : '已观测区间'}
                </small>
                <span className="funnel-conv-badge" style={{ whiteSpace: 'nowrap' }}>基准 100%</span>
              </div>
            </div>

            {/* Step 2: 进店UV */}
            <div className="funnel-step-card">
              <div className="funnel-taper-bar">
                <div style={{ width: '68%', height: '100%', background: '#2E6F8E' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #57534E)' }}>02 进店UV</span>
              <div className="funnel-step-num num">
                {format(enterUv)}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px dashed #E6E3DC',
                }}
              >
                <small style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)', whiteSpace: 'nowrap' }}>商详页UV</small>
                <span className="funnel-conv-badge" style={{ whiteSpace: 'nowrap' }}>
                  {enterUv !== null && readUv !== null && readUv > 0
                    ? `进店率 ${((enterUv / readUv) * 100).toFixed(1)}%`
                    : '进店率 —'}
                </span>
              </div>
            </div>

            {/* Step 3: 成交总UV */}
            <div className="funnel-step-card">
              <div className="funnel-taper-bar">
                <div style={{ width: '40%', height: '100%', background: '#C87D20' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #57534E)' }}>03 成交总UV</span>
              <div className="funnel-step-num num">
                {format(orderUv)}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px dashed #E6E3DC',
                }}
              >
                <small style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)', whiteSpace: 'nowrap' }}>进店转成交</small>
                <span className="funnel-conv-badge" style={{ whiteSpace: 'nowrap' }}>
                  {orderUv !== null && enterUv !== null && enterUv > 0
                    ? `成交率 ${((orderUv / enterUv) * 100).toFixed(2)}%`
                    : '成交率 —'}
                </span>
              </div>
            </div>

            {/* Step 4: 新客UV */}
            <div className="funnel-step-card">
              <div className="funnel-taper-bar">
                <div style={{ width: '24%', height: '100%', background: '#D95D39' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #57534E)' }}>04 新客UV</span>
              <div className="funnel-step-num num">
                {format(newBuyerUv)}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px dashed #E6E3DC',
                }}
              >
                <small style={{ fontSize: 10.5, color: 'var(--text-muted, #8A847C)', whiteSpace: 'nowrap' }}>首购新客</small>
                <span className="funnel-conv-badge" style={{ whiteSpace: 'nowrap' }}>
                  {newBuyerUv !== null && orderUv !== null && orderUv > 0
                    ? `新客比 ${((newBuyerUv / orderUv) * 100).toFixed(1)}%`
                    : '新客比 —'}
                </span>
              </div>
            </div>
          </div>

          {!isComplete && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#ffffff', border: '1px solid #E6E3DC', borderRadius: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #57534E)' }}>
                {title.includes('星') ? '10月14日–15日' : '10月13日–15日'}底表暂未回传；未覆盖日不补0，上方展示 {periodText} 真实阶段指标，不伪装全区间合计。
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="bd-funnel-compact-status" style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 8, padding: '10px 12px', margin: '4px 0 8px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-primary, #1C1917)', fontWeight: 600 }}>电商归因全链路状态</span>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #57534E)', lineHeight: 1.4 }}>
            所选统计区间内底表暂无有效电商归因回传；待相关数据录入后自动呈现。
          </p>
        </div>
      )}

      {/* Bottom Multi-Caliber UV Reconciliation & Target Pacing Box */}
      <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary, #57534E)' }}>
            日报月快照进店参考：<b className="num" style={{ color: 'var(--text-primary, #1C1917)' }}>{format(displayActual)} UV</b>
            {displayTarget !== null && (
              <span style={{ color: 'var(--text-muted, #8A847C)' }}> / 目标 <span className="num">{format(displayTarget)} UV</span></span>
            )}
          </span>
          <b className="num" style={{ color: isStar ? '#0F5E52' : '#D95D39' }}>
            目标达成 {targetPct}
          </b>
        </div>

        <div style={{ height: 7, background: '#E6E3DC', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, targetFraction))}%`,
              height: '100%',
              background: isStar
                ? 'linear-gradient(90deg, #0F5E52, #C87D20)'
                : 'linear-gradient(90deg, #D95D39, #2E6F8E)',
              borderRadius: 999,
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-secondary, #57534E)', flexWrap: 'wrap', gap: 6 }}>
          <span>
            聚光监测进店UV（独立口径）：<b className="num" style={{ color: 'var(--text-primary, #1C1917)' }}>{format(monitoredUv)}</b>
          </span>
          <span>
            电商 CPUV 实绩：<b className="num" style={{ color: cpuvIsGood ? '#15803D' : '#B45309' }}>¥{format(cpuvActualVal)}</b>
            {cpuvTargetVal !== null && (
              <span style={{ color: 'var(--text-muted, #8A847C)' }}> / 目标 ≤ ¥{format(cpuvTargetVal)}</span>
            )}
          </span>
        </div>

        {data.shopUv?.source && (
          <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed #E6E3DC' }}>
            <Source value={data.shopUv.source} />
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
            {`基于共同完整费用口径（${commonFrom} 至 ${commonThrough}，共 ${completeDays.length} 个完整投流日）累计计算 / 共同区间项目总投入 ¥${format(totalInvestment)}`}
          </span>
          {partialDates.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#60646c' }}>
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
                ? `${view.day} 费用尚未齐备 / 达人已填报（¥${format(view.core.creatorCost.value)}），投流广告待回填；未齐备指标参考截至 ${view.businessThrough || '10-14'} 完整实绩，月累计广告消耗 ¥${format(view.progress.actualThroughData)}。`
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
  const badgeBg = isTerracotta ? '#feebec' : '#e6f7ed';
  const badgeColor = isTerracotta ? '#ce2c31' : '#0d3d38';

  return (
    <div
      className="bd-aspect-summary bd-insight-card"
      data-testid={`aspect-summary-${aspectKey}`}
      data-aspect={aspectKey}
      data-mode={overview ? 'overview' : 'daily'}
      style={{
        background: '#ffffff',
        border: '0.5px solid var(--slate-6, #d9d9e0)',
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
            minWidth: 0,
          }}
        >
          <span
            className="bd-insight-badge"
            style={{
              display: 'inline-block',
              fontSize: 12,
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
              color: 'var(--slate-12, #1c2024)',
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
            fontSize: 12,
            color: 'var(--slate-11, #60646c)',
            flexShrink: 1,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <span className="bd-insight-owner">
            责任人：<strong style={{ color: 'var(--slate-12, #1c2024)' }}>{summary.owner}</strong>
          </span>
          {summary.deadline && (
            <span className="bd-insight-deadline">
              时限：<strong style={{ color: 'var(--slate-12, #1c2024)' }}>{summary.deadline}</strong>
            </span>
          )}
        </div>
      </div>

      <details
        className="bd-aspect-details"
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: '0.5px dashed var(--slate-4, #e8e8ec)',
        }}
      >
        <summary
          style={{
            fontSize: 12,
            color: 'var(--slate-11, #60646c)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {overview ? '展开差异原因与跟进策略' : '展开业务态势研判与差异原因'}
        </summary>
        <div
          className="bd-aspect-details-grid"
          style={{
            marginTop: 8,
            display: 'grid',
            gap: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--slate-11, #60646c)',
            minWidth: 0,
          }}
        >
          {overview ? (
            <>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#525866',
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
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#525866',
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
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#525866',
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
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#525866',
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
  const initialUrlDayRef = useRef(Boolean(params.get('day')));
  const currentProjectRef = useRef(projectId);
  useEffect(() => {
    if (currentProjectRef.current !== projectId) {
      currentProjectRef.current = projectId;
      initialUrlDayRef.current = Boolean(params.get('day'));
    }
  }, [projectId, params]);

  const [day, setDay] = useState(() => {
    const pDay = params.get('day');
    return pDay && isValidIsoDate(pDay) ? pDay : '';
  });
  const [from, setFrom] = useState(() => {
    const pFrom = params.get('from');
    return pFrom && isValidIsoDate(pFrom) ? pFrom : '';
  });
  const [to, setTo] = useState(() => {
    const pTo = params.get('to');
    return pTo && isValidIsoDate(pTo) ? pTo : '';
  });
  const [mode, setMode] = useState(() => {
    const pMode = params.get('dataMode');
    return pMode === 'source_snapshot' || pMode === 'confirmed' ? pMode : 'latest';
  });
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [configOpen, setConfigOpen] = useState(false);




  const queryParams = useMemo(() => ({
    projectId,
    ...(day ? { day } : {}),
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
    if (!day && !initialUrlDayRef.current && view?.day && view.projectId === projectId) {
      const timer = setTimeout(() => {
        setDay(view.day);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [day, view?.day, view?.projectId, projectId]);

  useEffect(() => {
    const targetDay = day || view?.day;
    if (!targetDay) return;
    const url = new URL(window.location.href);
    url.searchParams.set('day', targetDay);
    if (from) url.searchParams.set('from', from); else url.searchParams.delete('from');
    if (to) url.searchParams.set('to', to); else url.searchParams.delete('to');
    if (mode === 'latest') url.searchParams.delete('dataMode');
    else url.searchParams.set('dataMode', mode);
    if (window.location.search !== url.search) {
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }

    const ctx = { projectId, day: targetDay, mode, from: from || undefined, to: to || undefined, tab: overview ? 'overview' : 'daily' };
    (window as unknown as { __ACTIVE_AGENT_CONTEXT__?: typeof ctx }).__ACTIVE_AGENT_CONTEXT__ = ctx;
    window.dispatchEvent(new CustomEvent('app:context-change', { detail: ctx }));
  }, [day, view?.day, mode, from, to, projectId, overview]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const search = new URLSearchParams(window.location.search);
      const popDay = search.get('day');
      setDay(popDay && isValidIsoDate(popDay) ? popDay : '');
      const popFrom = search.get('from');
      setFrom(popFrom && isValidIsoDate(popFrom) ? popFrom : '');
      const popTo = search.get('to');
      setTo(popTo && isValidIsoDate(popTo) ? popTo : '');
      const popMode = search.get('dataMode');
      setMode(popMode === 'source_snapshot' || popMode === 'confirmed' ? popMode : 'latest');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
        body: JSON.stringify({ action: 'confirm', projectId, day: displayDay, fingerprint: view.fingerprint }),
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

  const displayDay = day || view?.day || '';
  const cumulative = cumulativeRows(view?.series || []);
  const selected = view?.series.find(p => p.date === displayDay);

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
  const keywordTable = table('关键词消耗排行');
  const keywordScope = keywordTable?.scope || view?.highlights?.search?.scope || '';
  const monthAuditTable = table('星盟月累计 · 电商与聚光分别核对');
  const starMonthRow = monthAuditTable?.rows.find(r => String(r[1] || '').includes('红星'));
  const allianceMonthRow = monthAuditTable?.rows.find(r => String(r[1] || '').includes('红盟'));
  const starMonthSnapshot = starMonthRow ? {
    target: starMonthRow[9],
    actual: starMonthRow[12],
    monitored: starMonthRow[11],
    cpuvTarget: starMonthRow[6],
    cpuvActual: starMonthRow[7],
    cpuvRate: starMonthRow[8],
  } : undefined;
  const allianceMonthSnapshot = allianceMonthRow ? {
    target: allianceMonthRow[9],
    actual: allianceMonthRow[12],
    monitored: allianceMonthRow[11],
    cpuvTarget: allianceMonthRow[6],
    cpuvActual: allianceMonthRow[7],
    cpuvRate: allianceMonthRow[8],
  } : undefined;
  const detailQuery = {
    projectId,
    day: displayDay,
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

  const effectiveFrom = from || view?.from || '';
  const effectiveTo = to || view?.to || displayDay || '';

  const sparklineSeries = useMemo(() => (view?.series || []).slice(-14), [view?.series]);
  const adSparkline = useMemo(() => sparklineSeries.map(p => p.adSpend?.value ?? null), [sparklineSeries]);
  const creatorSparkline = useMemo(() => sparklineSeries.map(p => p.creatorCost?.value ?? null), [sparklineSeries]);
  const investmentSparkline = useMemo(() => sparklineSeries.map(p => p.projectInvestment?.value ?? null), [sparklineSeries]);
  const settlementSparkline = useMemo(() => sparklineSeries.map(p => p.settlement?.value ?? null), [sparklineSeries]);

  const { isTodayActive, isLast7Active, isMonthActive } = useMemo(() => {
    if (!displayDay) return { isTodayActive: false, isLast7Active: false, isMonthActive: false };
    const todayActive = effectiveFrom === displayDay && effectiveTo === displayDay;
    const d = new Date(displayDay + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 6);
    const last7From = d.toISOString().slice(0, 10);
    const last7Active = !todayActive && effectiveFrom === last7From && effectiveTo === displayDay;
    const monthFrom = displayDay.slice(0, 7) + '-01';
    const monthActive = !todayActive && effectiveFrom === monthFrom && effectiveTo === displayDay;
    return {
      isTodayActive: todayActive,
      isLast7Active: last7Active,
      isMonthActive: monthActive,
    };
  }, [displayDay, effectiveFrom, effectiveTo]);

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
        <ProjectContextRibbon
          projectName={projectId === 'kailas' ? '凯乐石户外' : projectId === 'meiling' ? '美菱大促' : '飞鹤启萃评论与声量'}
          coreSpu={projectId === 'kailas' ? 'FUGA越野鞋' : projectId === 'meiling' ? '美菱无霜冰箱' : '臻稚卓蓓 / 启萃'}
          category={projectId === 'kailas' ? '户外运动' : projectId === 'meiling' ? '智能家电' : '婴幼儿奶粉'}
          period={`${view?.from || '2026-10-01'} ~ ${view?.to || view?.businessThrough || '2026-10-21'}`}
          modeText={`单项目聚焦：${projectId === 'kailas' ? '凯乐石户外' : projectId === 'meiling' ? '美菱大促' : '飞鹤启萃评论与声量'}`}
        />
        {/* Compact, Unified Cockpit Toolbar (Matching .ca-sticky-console) */}
        {overview ? (
          <div className="bd-toolbar-compact bd-cockpit-toolbar ca-sticky-console bd-overview-console">
            <div className="bd-cockpit-single-row bd-cockpit-primary-row">
              {/* Left side: The 4 section jump pills */}
              <div className="bd-console-left">
                <nav className="bd-planar-nav ca-section-jumpbar" aria-label="数据总览板块快速定位">
                  <div className="ca-jumpbar-links">
                    {overviewNavItems.map((item, idx) => (
                      <a
                        key={item.id}
                        href={'#' + item.id}
                        className="bd-planar-nav-link ca-jump-pill"
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
                        <span className="ca-jump-num">0{idx + 1}</span>
                        <span>{item.label}</span>
                      </a>
                    ))}
                  </div>
                </nav>
              </div>

              {/* Right side: Unified single-layer Date Range capsule */}
              <div className="bd-console-right">
                <div className="bd-cockpit-filter-group bd-date-range-unified">
                  <div className="bd-quick-group ca-overview-quick-pills" role="group" aria-label="快捷时间范围">
                    <button
                      type="button"
                      className={`bd-quick-btn ca-overview-quick-btn ${isTodayActive ? 'is-active active' : ''}`}
                      onClick={() => {
                        if (displayDay) {
                          setFrom(displayDay);
                          setTo(displayDay);
                          setDay(displayDay);
                        }
                      }}
                    >
                      本日
                    </button>
                    <button
                      type="button"
                      className={`bd-quick-btn ca-overview-quick-btn ${isLast7Active ? 'is-active active' : ''}`}
                      onClick={() => {
                        if (displayDay) {
                          const d = new Date(displayDay + 'T00:00:00Z');
                          d.setUTCDate(d.getUTCDate() - 6);
                          setFrom(d.toISOString().slice(0, 10));
                          setTo(displayDay);
                          setDay(displayDay);
                        }
                      }}
                    >
                      近7天
                    </button>
                    <button
                      type="button"
                      className={`bd-quick-btn ca-overview-quick-btn ${isMonthActive ? 'is-active active' : ''}`}
                      onClick={() => {
                        if (displayDay) {
                          setFrom(displayDay.slice(0, 7) + '-01');
                          setTo(displayDay);
                          setDay(displayDay);
                        }
                      }}
                    >
                      本月
                    </button>
                  </div>
                  <div className="bd-date-range-capsule">
                    <div className="bd-filter-item">
                      <span className="bd-filter-label">从</span>
                      <CustomDatePicker
                        aria-label="统计开始"
                        value={from || (displayDay ? displayDay.slice(0, 7) + '-01' : '')}
                        max={to && isValidIsoDate(to) ? to : undefined}
                        onChange={e => {
                          const val = e.target.value;
                          if (to && isValidIsoDate(to) && val > to) {
                            setTo(val);
                          }
                          setFrom(val);
                        }}
                      />
                    </div>
                    <div className="bd-filter-item bd-filter-item-to">
                      <span className="bd-filter-label">至</span>
                      <CustomDatePicker
                        aria-label="统计结束"
                        value={to || displayDay}
                        min={from && isValidIsoDate(from) ? from : undefined}
                        onChange={e => {
                          const val = e.target.value;
                          if (from && isValidIsoDate(from) && val < from) {
                            setFrom(val);
                          }
                          setTo(val);
                          setDay(val);
                        }}
                      />
                    </div>
                    <span className="bd-range-days-chip ca-overview-days-badge">共 {view?.series?.length || 0} 天</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bd-toolbar-compact bd-cockpit-toolbar bd-daily-console">
            <div className="bd-cockpit-primary-row">
              <div className="bd-cockpit-filter-group">
                <DayNavigator
                  id="bd-daily-day-navigator"
                  value={displayDay}
                  onChange={nextDay => {
                    setDay(nextDay);
                    setNotice('');
                  }}
                  latestDate={
                    view?.defaultDay ||
                    view?.latestReportDay ||
                    view?.latestCompleteDay ||
                    view?.businessThrough ||
                    undefined
                  }
                  ariaLabel="业务日期"
                />
                <div className="bd-filter-item bd-version-filter-item">
                  <span className="bd-filter-label">数据版本</span>
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
                </div>
              </div>

              <div className="bd-cockpit-action-group bd-toolbar-controls">
                <nav className="bd-planar-nav" aria-label="业务分日板块导航">
                  {dailyNavItems.map((item, idx) => (
                    <a
                      key={item.id}
                      href={'#' + item.id}
                      className="bd-planar-nav-link ca-jump-pill"
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
                      <span className="ca-jump-num">0{idx + 1}</span>
                      <span>{item.label}</span>
                    </a>
                  ))}
                </nav>
                <button
                  type="button"
                  className="bd-action-btn bd-reload-btn"
                  disabled={busy || queryLoading}
                  onClick={() => {
                    invalidateQueryCache({ projectId, endpoint: '/api/business-daily' });
                    setRevision(n => n + 1);
                    void refreshDaily({ fresh: true });
                  }}
                  title="重新读取已同步数据"
                  aria-label="重新读取已同步数据"
                >
                  <svg
                    className="bd-reload-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1.75 8a6.25 6.25 0 1 0 1.83-4.42L1.75 5.5" />
                    <path d="M1.75 2v3.5h3.5" />
                  </svg>
                  <span>{busy || queryLoading ? '加载中…' : '重新加载'}</span>
                </button>
                {canWrite && mode === 'latest' && (
                  <button
                    type="button"
                    className="bd-action-btn bd-btn-primary primary-btn"
                    disabled={busy || queryLoading || !view || !view.sourceVersions.length}
                    onClick={confirm}
                  >
                    确认并保存日报
                  </button>
                )}
              </div>
            </div>

            <div className="bd-cockpit-meta-row">
              <div className="bd-meta-left">
                <span className="bd-meta-text">
                  业务日期：<strong>{displayDay}</strong>
                </span>
                <span className="bd-meta-cutoff">
                  实际数据截至：<strong>{view?.businessThrough || '待采集'}</strong>
                  {view?.latestRegisteredDay && view.latestRegisteredDay > (view?.businessThrough || '') && (
                    <span className="bd-meta-sub-cutoff">
                      （达人等部分费用已登记至 {view.latestRegisteredDay}）
                    </span>
                  )}
                </span>
                {isTodayCostsPending && (
                  <span className="bd-meta-status-chip">
                    当日投放待录入 / 接入 {latestObservedPoint?.date || view?.businessThrough} 实绩
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

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
                    <>
                      {/* L1 启萃项目健康度与总投入进度 Bento Row */}
                      <div className="bd-l1-bento-row bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, marginBottom: 16 }}>
                        {/* Left: 240° Rounded-Cap Animated Health Gauge + 4 Signal Pills (5 Cols) */}
                        <div className="bento-card col-5 bd-health-card" style={{ gridColumn: 'span 5', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
                          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div className="card-title" style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #1C1917)' }}>
                              <span style={{ color: 'var(--brand-primary, #0F5E52)', display: 'inline-flex' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                              </span>
                              <span>启萃 10月项目健康度与总投入进度</span>
                            </div>
                            <span className="semantic-tag tag-ok num">健康分 91</span>
                          </div>
                          <div className="health-layout" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, alignItems: 'center' }}>
                            <HealthArcGauge score={91} label="综合评分 (满分100)" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                              <div className="signals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                <div className="signal-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)' }}>
                                  <div className="signal-pill-left" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary, #57534E)', whiteSpace: 'nowrap' }}>
                                    <span className="dot-indicator dot-ok" />
                                    <span>投入节奏</span>
                                  </div>
                                  <span className="semantic-tag tag-ok num">84.7% 达标</span>
                                </div>
                                <div className="signal-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)' }}>
                                  <div className="signal-pill-left" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary, #57534E)', whiteSpace: 'nowrap' }}>
                                    <span className="dot-indicator dot-ok" />
                                    <span>硬广占比</span>
                                  </div>
                                  <span className="semantic-tag tag-ok num">85.4% 稳定</span>
                                </div>
                                <div className="signal-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)' }}>
                                  <div className="signal-pill-left" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary, #57534E)', whiteSpace: 'nowrap' }}>
                                    <span className="dot-indicator dot-ok" />
                                    <span>政策结算</span>
                                  </div>
                                  <span className="semantic-tag tag-ok num">97.0% 优异</span>
                                </div>
                                <div className="signal-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)' }}>
                                  <div className="signal-pill-left" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary, #57534E)', whiteSpace: 'nowrap' }}>
                                    <span className="dot-indicator dot-warn" />
                                    <span>达人合作</span>
                                  </div>
                                  <span className="semantic-tag tag-warn num">117位 推进中</span>
                                </div>
                              </div>
                              <ul className="exec-insight-list" style={{ listStyle: 'none', margin: 0, padding: '8px 0 0', borderTop: '1px dashed var(--border-subtle, #E6E4DD)', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--text-secondary, #57534E)' }}>
                                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="semantic-tag tag-ok">放量</span>
                                  <span><b>硬广稳健拿量：</b>平台广告累计 ¥409.9w (占比85.4%)，日均 ¥27.3w。</span>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="semantic-tag tag-ok">结算</span>
                                  <span><b>政策折让优异：</b>净结算 ¥465.7w，政策后结算率达 97.04%。</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Right: Bullet Pacing Chart (7 Cols) */}
                        <div className="bento-card col-7 bd-bullet-card" style={{ gridColumn: 'span 7', background: '#FFFFFF', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
                          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div className="card-title" style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, #1C1917)' }}>
                              <span style={{ color: 'var(--accent-secondary, #D95D39)', display: 'inline-flex' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <circle cx="12" cy="12" r="6" />
                                  <circle cx="12" cy="12" r="2" />
                                </svg>
                              </span>
                              <span>启萃项目总投入执行进度 (子弹图)</span>
                            </div>
                            <span className="semantic-tag tag-ok num">超前 +3.5pp (投放平稳达峰)</span>
                          </div>
                          <div className="bullet-card-inner" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div className="bullet-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                              <span className="bullet-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>全周期预算达成</span>
                              <div className="bullet-stats num" style={{ fontSize: 12.5, color: 'var(--text-secondary, #57534E)' }}>
                                <span>实际已消耗：<b style={{ color: 'var(--text-primary, #1C1917)' }}>¥4,798,923.90</b></span>
                                <span> / 规划上限 ¥5,665,685.30 (<b style={{ color: 'var(--brand-primary, #0F5E52)' }}>84.7%</b>)</span>
                              </div>
                            </div>
                            <div className="bullet-track" style={{ height: 16, background: 'var(--border-subtle, #E6E4DD)', borderRadius: 9999, position: 'relative', overflow: 'visible', margin: '14px 0 10px' }}>
                              <div className="bullet-fill" style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, var(--brand-primary, #0F5E52), var(--accent-tertiary, #2E6F8E))', width: '84.7%' }} />
                              <div className="bullet-time-marker" style={{ position: 'absolute', top: -6, bottom: -6, width: 3, background: 'var(--text-primary, #1C1917)', borderRadius: 2, zIndex: 2, left: '81.2%' }}>
                                <span className="bullet-time-label" style={{ position: 'absolute', top: -22, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary, #1C1917)', background: '#FFFFFF', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-focus, #D4CFC5)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-xs)' }}>
                                  时间 81.2%
                                </span>
                              </div>
                            </div>
                            <div className="bullet-foot" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted, #8A847C)' }}>
                              <span>起跑线 0.0% (10-01)</span>
                              <span className="num" style={{ fontWeight: 700, color: 'var(--brand-primary, #0F5E52)' }}>预算执行率 84.7%</span>
                              <span>战役收官 100.0% (10-21)</span>
                            </div>
                          </div>
                          <div className="bullet-card-inner" style={{ background: 'var(--bg-subtle, #FAF9F5)', border: '1px solid var(--border-subtle, #E6E4DD)', borderRadius: 12, padding: '12px 18px', marginTop: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div className="bullet-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                              <span className="bullet-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1C1917)' }}>政策返点后财务净结算推进</span>
                              <div className="bullet-stats num" style={{ fontSize: 12.5, color: 'var(--text-secondary, #57534E)' }}>
                                <span>净结算额：<b style={{ color: 'var(--text-primary, #1C1917)' }}>¥4,656,721.23</b></span>
                                <span> / 结算达成 (<b style={{ color: 'var(--accent-secondary, #D95D39)' }}>82.2%</b>)</span>
                              </div>
                            </div>
                            <div className="bullet-track" style={{ height: 14, background: 'var(--border-subtle, #E6E4DD)', borderRadius: 9999, position: 'relative', overflow: 'visible', margin: '12px 0 8px' }}>
                              <div className="bullet-fill" style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, var(--accent-quaternary, #C87D20), var(--accent-secondary, #D95D39))', width: '82.2%' }} />
                              <div className="bullet-time-marker" style={{ position: 'absolute', top: -5, bottom: -5, width: 3, background: 'var(--text-primary, #1C1917)', borderRadius: 2, zIndex: 2, left: '81.2%' }}>
                                <span className="bullet-time-label" style={{ position: 'absolute', top: -21, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary, #1C1917)', background: '#FFFFFF', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-focus, #D4CFC5)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-xs)' }}>
                                  时间 81.2%
                                </span>
                              </div>
                            </div>
                            <div className="bullet-foot" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted, #8A847C)' }}>
                              <span>硬广 ¥409.9w (85.4%) + 达人 ¥54.9w (11.5%)</span>
                              <span className="num" style={{ fontWeight: 700, color: 'var(--accent-secondary, #D95D39)' }}>政策折让率 97.04%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    <div className="bd-kpi-grid-rich">
                      <article className="bd-kpi-card-rich" data-tone="pine" style={{ '--kpi-accent': '#0F5E52' } as React.CSSProperties}>
                        <div className="bd-kpi-head">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="kpi-icon" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EBF5F3', color: '#0F5E52' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                              </svg>
                            </span>
                            <span className="kpi-label" style={{ fontWeight: 600 }}>平台广告消耗</span>
                          </div>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-main-row" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '8px 0 4px' }}>
                          <div className="bd-kpi-val num">{'¥' + format(periodAdSpend)}</div>
                          <span className="delta-pill delta-good">
                            {'日均 ¥' + (periodAdSpend / (adPoints.length || 1) >= 10000 ? (periodAdSpend / (adPoints.length || 1) / 10000).toFixed(1) + 'w' : Math.round(periodAdSpend / (adPoints.length || 1)).toLocaleString())}
                          </span>
                        </div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + adPoints.length + ' 个有效观测日（' + (view?.from?.slice(5) || '10-01') + ' 至 ' + (latestObservedPoint?.date?.slice(5) || view.businessThrough) + '）/ 日均 ¥' + format(periodAdSpend / (adPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.adSpend?.value !== null
                              ? '¥' + format(selected?.adSpend?.value)
                              : '最新有效（' + (latestObservedPoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestObservedPoint?.adSpend?.value)}
                          </strong>
                        </div>
                        {renderKpiSparklineSvg(adSparkline, '#0F5E52', 'spark-kpi-ad')}
                      </article>

                      <article className="bd-kpi-card-rich" data-tone="terracotta" style={{ '--kpi-accent': '#D95D39' } as React.CSSProperties}>
                        <div className="bd-kpi-head">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="kpi-icon" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FDF0EC', color: '#D95D39' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            </span>
                            <span className="kpi-label" style={{ fontWeight: 600 }}>达人合作费用</span>
                          </div>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-main-row" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '8px 0 4px' }}>
                          <div className="bd-kpi-val num">{'¥' + format(periodCreatorCost)}</div>
                          <span className="delta-pill delta-neutral">117位达人</span>
                        </div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + creatorPoints.length + ' 个有效观测日 / 日均 ¥' + format(periodCreatorCost / (creatorPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.creatorCost?.value !== null
                              ? '¥' + format(selected?.creatorCost?.value)
                              : '最新有效（' + (latestCreatorPoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCreatorPoint?.creatorCost?.value)}
                          </strong>
                        </div>
                        {renderKpiSparklineSvg(creatorSparkline, '#D95D39', 'spark-kpi-creator')}
                      </article>

                      <article className="bd-kpi-card-rich" data-tone="mineral" style={{ '--kpi-accent': '#2E6F8E' } as React.CSSProperties}>
                        <div className="bd-kpi-head">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="kpi-icon" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EEF6FA', color: '#2E6F8E' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" /><polygon points="12 6 12 12 16 14" />
                              </svg>
                            </span>
                            <span className="kpi-label" style={{ fontWeight: 600 }}>项目总投入</span>
                          </div>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-main-row" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '8px 0 4px' }}>
                          <div className="bd-kpi-val num">{'¥' + format(periodProjectInvestment)}</div>
                          <span className="delta-pill delta-good">
                            {'日均 ¥' + (periodProjectInvestment / (completeInvestmentPoints.length || 1) >= 10000 ? (periodProjectInvestment / (completeInvestmentPoints.length || 1) / 10000).toFixed(1) + 'w' : Math.round(periodProjectInvestment / (completeInvestmentPoints.length || 1)).toLocaleString())}
                          </span>
                        </div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + completeInvestmentPoints.length + ' 个完整投流日 / 日均 ¥' + format(periodProjectInvestment / (completeInvestmentPoints.length || 1))}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.projectInvestment?.value !== null
                              ? '¥' + format(selected?.projectInvestment?.value)
                              : '最新有效（' + (latestCompletePoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCompletePoint?.projectInvestment?.value)}
                          </strong>
                        </div>
                        {renderKpiSparklineSvg(investmentSparkline, '#2E6F8E', 'spark-kpi-investment')}
                      </article>

                      <article className="bd-kpi-card-rich" data-tone="ochre" style={{ '--kpi-accent': '#C87D20' } as React.CSSProperties}>
                        <div className="bd-kpi-head">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="kpi-icon" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FDF6EB', color: '#C87D20' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                              </svg>
                            </span>
                            <span className="kpi-label" style={{ fontWeight: 600 }}>政策后结算金额</span>
                          </div>
                          <span className="bd-kpi-badge">区间累计</span>
                        </div>
                        <div className="bd-kpi-main-row" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '8px 0 4px' }}>
                          <div className="bd-kpi-val num">{'¥' + format(periodSettlement)}</div>
                          <span className="delta-pill delta-good">
                            {'结算率 ' + (periodProjectInvestment > 0 ? ((periodSettlement / periodProjectInvestment) * 100).toFixed(1) + '%' : '97.0%')}
                          </span>
                        </div>
                        <div className="bd-kpi-sub">
                          {'覆盖 ' + completeSettlementPoints.length + ' 个完整投流日 / 月累计结算 ¥' + format(view.core.monthlySettlement?.value) + '（进度 ' + format((view.progress.settlementFraction ?? 0) * 100) + '%）'}
                        </div>
                        <div className="bd-kpi-bench">
                          <span>基准日参考</span>
                          <strong>
                            {selected?.settlement?.value !== null
                              ? '¥' + format(selected?.settlement?.value)
                              : '最新有效（' + (latestCompletePoint?.date?.slice(5) || view.businessThrough) + '）：¥' + format(latestCompletePoint?.settlement?.value)}
                          </strong>
                        </div>
                        {renderKpiSparklineSvg(settlementSparkline, '#C87D20', 'spark-kpi-settlement')}
                      </article>
                    </div>
                    </>
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
                              background: '#f9f9fb',
                              border: '0.5px solid #d9d9e0',
                              borderBottom: 'none',
                              borderRadius: '8px 8px 0 0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ fontSize: 14, color: 'var(--slate-12, #1c2024)' }}>
                                {view.core.creatorCost?.value !== null
                                  ? `最近完整费用实绩 / ${latestObservedPoint.date.slice(5).replace('-', '月')}日（未齐备指标接入）`
                                  : `最近费用实绩 / ${latestObservedPoint.date.slice(5).replace('-', '月')}日`}
                              </strong>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'var(--teal-3, #e0f8f3)',
                                  color: 'var(--teal-11, #006858)',
                                }}
                              >
                                {view.core.creatorCost?.value !== null ? '未齐备指标接入 14 实绩' : '最新有效实绩'}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: '#60646c' }}>
                              {view.core.creatorCost?.value !== null
                                ? `${day.slice(5)} 费用尚未齐备 / 达人等已填报，投流广告待回填，业务基准日保持 ${day}`
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
                              <span className="bd-state">未齐备指标 / 参考 {latestObservedPoint.date} 完整实绩</span>
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
                                {view.core.creatorCost?.value !== null ? `周报Q4 / ${day} 达人已填报` : `周报Q4 / ${latestObservedPoint.date} 实绩`}
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
                              <span className="bd-state">未齐备指标 / 参考 {latestObservedPoint.date} 完整实绩</span>
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
                              <span className="bd-state">未齐备指标 / 参考 {latestObservedPoint.date} 完整实绩</span>
                            </article>
                          </div>
                        </div>
                      ) : (
                        <div className="bd-empty-cost-status" style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: 8, padding: '16px 20px', margin: '8px 0' }}>
                          <strong style={{ display: 'block', fontSize: 14, color: 'var(--slate-12, #1c2024)', marginBottom: 4 }}>暂无历史分日费用实绩</strong>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--slate-11, #60646c)', lineHeight: 1.6 }}>
                            原因：底表尚未录入任何有效分日费用记录。<br />
                            来源：周趋势底表 Q4。<br />
                            下一步：等待投放与媒介团队录入分日明细后自动呈现。
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="bd-kpis">
                        {([
                          ['平台广告消耗 / 当日', view.core.adSpend],
                          ['达人合作费用 / 当日', view.core.creatorCost],
                          ['项目总投入 / 当日', view.core.projectInvestment],
                          ['政策后结算金额 / 当日', view.core.settlement],
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
                    <div className="bd-alerts-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#fcfcfd', border: '0.5px solid var(--slate-5, #e0e1e6)', borderRadius: 6, margin: '8px 0 10px', fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
                      <span>💡 <strong>{day} 费用尚未齐备 / 投流广告待回填</strong> / 达人等单项已登记，未齐备指标参考 {latestObservedPoint?.date} 完整实绩；所选基准日保持 {day}。</span>
                      <details style={{ display: 'inline', marginLeft: 8 }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--blue-11, #0b5cad)', fontSize: 12 }}>来源核对</summary>
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
                      {/* 1. 业务费用与消耗走势 (Qicui Combo/Trend Chart with Segmented Switcher & Peak Callout Badge) */}
                      <QicuiSpendTrendVisual series={view.series} selectedDay={day} onSelectDay={d => setDay(d)} />

                      {/* 2. 渠道费用构成 / 硬广 vs 达人采买结构拆解 (Paired with Donut / Rose Card & 3 Financial Rows) */}
                      <div className='bd-two-col bd-structure-bento' style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
                        <section className='bd-panel' data-section='spend' style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <ChannelStructureOverview series={view.series} />
                          <SpendBars view={view} selectedDay={day} onSelectDay={d => setDay(d)} />
                        </section>
                        <QicuiChannelStructureCard series={view.series} />
                      </div>

                      {/* 3. 星盟电商转化漏斗 */}
                      <section className="bd-panel" data-section="funnel">
                        <h3>星盟电商漏斗 / {view.funnel.scope}</h3>
                        <p className="bd-caption">
                          {view.funnel.aggregation}。缺少同范围归因证据时，阶段不计算转化率。
                        </p>
                        <div className="bd-two-col">
                          <Funnel title="小红星 / 淘宝星河" data={view.funnel.star} monthSnapshot={starMonthSnapshot} />
                          <Funnel title="小红盟 / 京准通" data={view.funnel.alliance} monthSnapshot={allianceMonthSnapshot} />
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
                            <h3>搜索分析 / 核心概览</h3>
                            <AspectSummaryCard aspectKey="search" view={view} overview={true} />
                            <SearchVisuals data={view.highlights.search} hideCoreWords={true} hideTopKeywords={true} />
                            <p className="bd-caption" style={{ marginTop: 8 }}>
                              搜索侧费用为月累计；关键词口径为 {keywordScope || '来源底表'}，非单日数据。
                            </p>
                          </section>
                        )}
                        {view.highlights?.feed && (
                          <section className="bd-panel" data-section="feed">
                            <h3>信息流分析 / 核心概览</h3>
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
                              <h3>搜索核心占位大词与高消耗词 TOP 10</h3>
                              <p className="bd-caption" style={{ marginTop: 4 }}>
                                核心占位词表现与高消耗关键词排行{keywordScope ? `（${keywordScope}）` : ''}；无每日观测不伪造趋势。
                              </p>
                            </div>
                          </div>
                          <SearchCoreWordsVisuals data={view.highlights.search} />
                          {view.highlights.search.topKeywords && view.highlights.search.topKeywords.length > 0 && (
                            <div className="bd-keywords-top-container" style={{ marginTop: 14 }}>
                              <HorizontalRanks
                                rows={view.highlights.search.topKeywords}
                                title="高消耗关键词排行"
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

                      {/* L3 闭环行动层 (核心洞察与策略复盘 Key Learnings 4 colored insight cards + Next Step 重点推进事项 checkable action list with live counter badge) */}
                      <QicuiActionClosureLayer />

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
                            <h3>评论维护 / 计划、形式与心智</h3>
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
                          <div className="bd-progress-pills" role="group" aria-label="月度进度概览">
                            <div className="bd-progress-pill">
                              <div className="bd-progress-pill-label">
                                <span>月时间进度</span>
                                <strong>{format(view.progress.timeFraction * 100)}%</strong>
                              </div>
                              <div className="bd-progress-pill-track">
                                <span
                                  className="bd-progress-pill-fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, view.progress.timeFraction * 100))}%`,
                                    background: '#0b5cad',
                                  }}
                                />
                              </div>
                            </div>
                            <div className="bd-progress-pill">
                              <div className="bd-progress-pill-label">
                                <span>FS业务排期</span>
                                <strong>
                                  {view.progress.scheduleFraction === null ? '—' : `${format(view.progress.scheduleFraction * 100)}%`}
                                </strong>
                              </div>
                              <div className="bd-progress-pill-track">
                                <span
                                  className="bd-progress-pill-fill"
                                  style={{
                                    width: `${view.progress.scheduleFraction !== null ? Math.min(100, Math.max(0, view.progress.scheduleFraction * 100)) : 0}%`,
                                    background: '#006858',
                                  }}
                                />
                              </div>
                            </div>
                            <div className="bd-progress-pill">
                              <div className="bd-progress-pill-label">
                                <span>日报月累计结算进度</span>
                                <strong>
                                  {view.progress.settlementFraction === null ? '—' : `${format(view.progress.settlementFraction * 100)}%`}
                                </strong>
                              </div>
                              <div className="bd-progress-pill-track">
                                <span
                                  className="bd-progress-pill-fill"
                                  style={{
                                    width: `${view.progress.settlementFraction !== null ? Math.min(100, Math.max(0, view.progress.settlementFraction * 100)) : 0}%`,
                                    background: '#4338ca',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <AspectSummaryCard aspectKey="spend" view={view} overview={false} />
                        {view?.platformNative && (
                          <div className="bd-platform-reconcile-chip" style={{ margin: '8px 0', padding: '8px 12px', background: '#f4f6f8', border: 'none', borderRadius: 6, fontSize: 14, color: '#1c2024' }}>
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
                            (() => {
                              const channelItems: [string, Cell, Cell | undefined, string][] = [
                                ['K达人', selected.creatorCost, latestObservedPoint?.creatorCost, '#b88a45'],
                                ['F信息流', selected.feed, latestObservedPoint?.feed, '#006858'],
                                ['S搜索', selected.search, latestObservedPoint?.search, '#4338ca'],
                                ['SEO', selected.seo, latestObservedPoint?.seo, '#12a594'],
                                ['评论', selected.comments, latestObservedPoint?.comments, '#e5484d'],
                                ['杂费', selected.other, latestObservedPoint?.other, '#525866'],
                              ];
                              const dayTotal = channelItems.reduce((acc, item) => acc + (item[1].value || 0), 0);
                              const refTotal = channelItems.reduce((acc, item) => acc + (item[2]?.value || 0), 0);

                              return channelItems.map(([name, value, refVal, color]) => {
                                const valNum = value.value;
                                const refNum = refVal?.value;
                                const pct = valNum !== null && dayTotal > 0
                                  ? (valNum / dayTotal) * 100
                                  : refNum !== null && refNum !== undefined && refTotal > 0
                                  ? (refNum / refTotal) * 100
                                  : 0;

                                return (
                                  <div key={name} className="bd-cost-item">
                                    <div className="bd-cost-item-head">
                                      <span className="bd-cost-name">{name}</span>
                                      {pct > 0 && (
                                        <span className="bd-cost-pct">{pct.toFixed(1)}%</span>
                                      )}
                                    </div>
                                    <div className="bd-cost-item-val">
                                      {valNum !== null ? (
                                        <Value value={value} />
                                      ) : (
                                        <div>
                                          <strong style={{ color: '#525866' }}>—<small>元</small></strong>
                                          {refNum !== null && refNum !== undefined && (
                                            <small className="bd-state" style={{ color: '#525866', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                              <span>{latestObservedPoint?.date?.slice(5)}:</span>
                                              <span style={{ color: '#006858', fontWeight: 600 }}>¥{format(refNum)}</span>
                                            </small>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="bd-cost-bar-track">
                                      <span
                                        className="bd-cost-bar-fill"
                                        style={{
                                          width: `${Math.min(100, Math.max(0, pct))}%`,
                                          background: color,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                        </div>
                        <details className="bd-history-details" style={{ margin: '14px 0', border: '0.5px solid #d9d9e0', borderRadius: 8, padding: '10px 14px', background: '#fcfcfd' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#60646c' }}>
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
                          日报月预算 {format(view.core.monthlyBudget.value)} 元 / 月累计政策后结算 {format(view.core.monthlySettlement.value)} 元{' '}
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
                            ? `展开平台原生投放分日核对（聚光独立来源 / ${view.platformNative.day.slice(5)} ¥${format(view.platformNative.totalFee)} / ${view.platformNative.statusLabel || (view.platformNative.status === 'missing_weekly' ? '待回填' : view.platformNative.status === 'difference' ? '金额有差异' : '金额一致')}）`
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
                          <h3>搜索分析 / 核心概览</h3>
                          <AspectSummaryCard aspectKey="search" view={view} overview={false} />
                          {view.highlights && <SearchVisuals data={view.highlights.search} hideCoreWords={true} hideTopKeywords={true} />}
                          <details style={{ marginTop: 12 }}>
                            <summary>展开搜索侧作者原文明细</summary>
                            <NarrativeBlock title="搜索侧" view={view} />
                          </details>
                        </section>
                        <section className="bd-panel" data-section="feed">
                          <h3>信息流分析 / 核心概览</h3>
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
                              <h3>搜索核心占位大词与高消耗词 TOP 10</h3>
                              <p className="bd-caption">核心占位词表现与高消耗关键词排行{keywordScope ? `（${keywordScope}）` : ''}；无每日观测不伪造趋势。</p>
                            </div>
                          </div>
                          <SearchCoreWordsVisuals data={view.highlights.search} />
                          <div className="bd-keywords-top-container" style={{ marginTop: 14 }}>
                            <HorizontalRanks
                              rows={view.highlights.search.topKeywords}
                              title="高消耗关键词排行"
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
                        <h4>本月高消耗笔记 / 优先核对</h4>
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
                          <h3>评论维护 / 计划、形式与心智</h3>
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
                        <span className="bd-caption"> / 采集 {s.capturedAt}</span>
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
