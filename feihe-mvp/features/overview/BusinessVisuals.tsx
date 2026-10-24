'use client';
import type { BusinessHighlights, CostComparison, RankValue, SourceRef } from '../../lib/business-daily/types';

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
  actual: '#008573',
  plan: '#8b8d98',
  settlement: '#5b5bd6',
  investment: '#ffc53d',
  anomaly: '#e5484d',

  // 渠道映射
  feed: '#008573',
  search: '#5b5bd6',
  creators: '#ffc53d',
  comments: '#e5484d',
  seo: '#12a594',
  other: '#8b8d98',

  // 中性与结构
  bgPage: '#f9f9fb',
  cardBg: '#ffffff',
  textMain: '#1c2024',
  textMuted: '#60646c',
  border: '#d9d9e0',
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
      {activeCosts.map(c => {
        const max = Math.max(c.actual ?? 0, c.high ?? 0, 1) * 1.18;
        const x = (n: number) => 78 + (n / max) * 300;
        const warning = c.actual !== null && c.high !== null && c.actual > c.high;
        const zero = c.actual === 0;
        const dotColor = warning
          ? DASHBOARD_PALETTE.anomaly
          : zero
          ? DASHBOARD_PALETTE.plan
          : isReference
          ? DASHBOARD_PALETTE.settlement
          : DASHBOARD_PALETTE.actual;
        const textColor = warning
          ? '#ce2c31'
          : zero
          ? '#60646c'
          : isReference
          ? '#272962'
          : '#0d3d38';
        return (
          <div key={c.channel} className="bv-cost-row">
            <svg
              viewBox="0 0 420 83"
              role="img"
              aria-label={`${c.channel}实际${num(c.actual)}元，行业区间${num(c.low)}至${num(c.high)}元`}
            >
              <title>
                {`${c.channel}实际${num(c.actual)}元；行业基准${num(c.low)}–${num(c.high)}元`}
              </title>
              <text x="0" y="42" className="bv-svg-label" fill="#1c2024">{c.channel}</text>
              <line x1="78" x2="378" y1="38" y2="38" stroke="#d9d9e0" strokeWidth="5" strokeLinecap="round" />
              {c.low !== null && c.high !== null && (
                <>
                  <rect x={x(c.low)} y="29" width={Math.max(3, x(c.high) - x(c.low))} height="18" rx="4" fill="#d9d9e0" />
                  <text x={(x(c.low) + x(c.high)) / 2} y="18" textAnchor="middle" className="bv-svg-muted" fill="#60646c">
                    基准 {num(c.low)}–{num(c.high)}
                  </text>
                </>
              )}
              {c.actual !== null ? (
                <>
                  <circle cx={x(c.actual)} cy="38" r="6" fill={dotColor} />
                  <text
                    x={x(c.actual)}
                    y="68"
                    textAnchor="middle"
                    fill={textColor}
                    fontSize="14"
                    fontWeight="600"
                  >
                    {zero ? '原值0（待确认）' : isReference ? `快照 ${num(c.actual)}` : `实际 ${num(c.actual)}`}
                    {warning ? ' ↑' : ''}
                  </text>
                </>
              ) : (
                <text x="224" y="67" textAnchor="middle" className="bv-svg-muted" fill="#60646c">实际值未登记</text>
              )}
            </svg>
          </div>
        );
      })}
      <p className="bd-caption">
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
              <p className="bd-caption">所绑定月份累计消耗</p>
              <dl>
                <div><dt>底表消费占比</dt><dd>{pct(w.share)}</dd></div>
                <div><dt>源行CTR</dt><dd>{pct(w.ctr)}</dd></div>
                <div><dt>星盟合并CPUV</dt><dd>{num(w.cpuv)}元</dd></div>
                <div><dt>搜索指数快照</dt><dd>{num(w.index)}</dd></div>
              </dl>
              {w.reportShare !== null && w.share !== null && Math.abs(w.reportShare - w.share) > 0.005 && (
                <p className="bv-small-warning">
                  日报费用占比{pct(w.reportShare)}，底表{pct(w.share)}；范围与更新时间待核对。
                </p>
              )}
            </article>
          ))
        ) : (
          <p className="bd-caption">该范围尚无占位词观测。</p>
        )}
      </div>
      <Evidence source={data.tableSource} label="关键词底表为所绑定月份累计；SOC/排名为作者日报登记。" />
    </>
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
      <div className="bv-feed-kpis">
        {activeCosts.map(c => (
          <article key={c.channel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <span>{c.channel}月CPUV</span>
              {isCostRef && reference && (
                <span className="bv-ref-chip">快照 {reference.date.slice(5)}</span>
              )}
            </div>
            <strong>{num(c.actual)}<small>元</small></strong>
          </article>
        ))}
        <article>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span>月累计回搜率</span>
            {!currentReturnRate && refReturnRate !== null && reference && (
              <span className="bv-ref-chip">快照 {reference.date.slice(5)}</span>
            )}
          </div>
          <strong>{pct(activeReturnRate)}</strong>
        </article>
      </div>

      <CostComparisonChart
        costs={data.costs}
        title="信息流成本与同月基准"
        reference={reference?.feed ? { costs: reference.feed.costs, date: reference.date } : undefined}
      />

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
      <div className="bv-audience-col">
        <HorizontalRanks rows={starGroups} title="小红星 / 人群包CPUV（低→高）" color="blue" zeroUnconfirmed={true} />
      </div>
      <div className="bv-audience-col">
        <HorizontalRanks rows={allianceGroups} title="小红盟 / 人群包CPUV（低→高）" color="teal" zeroUnconfirmed={true} />
      </div>
      <div className="bv-audience-col bv-audience-penetration-col">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, color: '#1c2024' }}>竞品人群渗透 / 快照对比</h4>
          {isCrowdRef && reference && (
            <span className="bv-ref-badge">截至 {reference.date}</span>
          )}
        </div>
        <div className="bv-audience">
          {audience.map(a => (
            <article key={a.name}>
              <div><b>{a.name}</b><strong>{pct(a.value)}</strong></div>
              <div className="bv-progress-track">
                <span style={{ width: a.value === null ? 0 : String(Math.min(1, a.value) * 100) + "%" }} />
              </div>
              <p>{a.observedOn}观测 / {a.previousOn}登记{pct(a.previous)} / 人群体量{a.size}</p>
              <details><summary>人群定义</summary><p>{a.logic}</p></details>
            </article>
          ))}
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
