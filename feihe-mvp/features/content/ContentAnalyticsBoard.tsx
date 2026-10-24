'use client';

import type { Analytics, AnalyticRow } from '../../lib/types/project';
import { sourceLabel } from './content-view-model';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { TierDoughnutChart, HorizontalBarList } from '../overview/OverviewCharts';

const colors = ['#0d74ce', '#29a383', '#5753c6', '#ab6400', '#60646c'];
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const cleanName = (val: unknown) => {
  const str = String(val || '').trim();
  return !str || /\uFFFD/.test(str) ? '其他' : str;
};

export function ContentAnalyticsBoard({
  analytics,
  creatorLevels: customLevels,
  onSourceClick,
  onFormatClick,
}: {
  analytics: Analytics;
  creatorLevels?: Array<AnalyticRow & { avgRead?: number | null; avgInteraction?: number | null; readSamples?: number; interSamples?: number }>;
  onSourceClick?: (source: string) => void;
  onFormatClick?: (format: string) => void;
}) {
  const sources = analytics.sourceDistribution.filter(row => count(row.count) > 0);
  const sourceTotal = sources.reduce((sum, row) => sum + count(row.count), 0);
  const total = count(analytics.dataQuality.total);
  const coverage = [
    ['表现指标', 'metricCount'], ['内容分类', 'categoryCount'],
    ['达人层级', 'creatorCount'], ['评论已抓取', 'commentFetched'],
  ].map(([label, key], index) => {
    const amount = Math.min(total, count(analytics.dataQuality[key]));
    return { label, amount, pct: total ? amount / total * 100 : 0, color: colors[index], subText: `${amount.toLocaleString()} / ${total.toLocaleString()} 篇` };
  });

  const rawLevels = (customLevels || analytics.creatorLevels || []).filter(row => count(row.count) > 0);
  const levels = rawLevels.slice().sort((a, b) => {
    const aVal = typeof a.avgInteraction === 'number' && Number.isFinite(a.avgInteraction) ? a.avgInteraction : -1;
    const bVal = typeof b.avgInteraction === 'number' && Number.isFinite(b.avgInteraction) ? b.avgInteraction : -1;
    return bVal - aVal;
  });
  const validInteractions = levels
    .map(row => typeof row.avgInteraction === 'number' && Number.isFinite(row.avgInteraction) ? row.avgInteraction : null)
    .filter((v): v is number => v !== null && v > 0);
  const maxInteraction = validInteractions.length ? Math.max(...validInteractions) : 1;

  const formats = analytics.formats.filter(row => count(row.interactions) > 0);
  const interactions = formats.reduce((sum, row) => sum + count(row.interactions), 0);
  const scopes = (analytics.scopeDistribution || []).filter(row => count(row.count) > 0);
  const scopeTotal = scopes.reduce((sum, row) => sum + count(row.count), 0);

  return (
    <div className="stack">
      {/* 第一行：资产盘点与数据健康缺口（左列来源与范围，右列数据完整度，双列等高对称） */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="CORE STRATEGY"
          title="内容资产来源与范围结构"
          desc="按当前统计范围内的全部笔记汇总，识别内容来源集中度与产品讨论范围。"
        >
          {sourceTotal > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TierDoughnutChart
                total={sourceTotal}
                onItemClick={it => onSourceClick && onSourceClick(it.label)}
                items={sources.map((row, index) => ({
                  label: sourceLabel(row.name),
                  count: count(row.count),
                  pct: (count(row.count) / sourceTotal) * 100,
                  color: colors[index % colors.length],
                }))}
              />
              {scopes.length > 0 && (
                <div style={{ paddingTop: 12, borderTop: '0.5px solid #f0f0f3' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#60646c' }}>产品讨论范围分布</span>
                    <span style={{ fontSize: 12, color: '#60646c' }}>本品 vs 竞品/泛行业</span>
                  </div>
                  <HorizontalBarList
                    items={scopes.map((row, index) => ({
                      label: cleanName(row.name),
                      amount: count(row.count),
                      pct: scopeTotal > 0 ? (count(row.count) / scopeTotal) * 100 : 0,
                      color: colors[(index + 2) % colors.length],
                      subText: `${count(row.count).toLocaleString()} 篇 / ${count(row.comments).toLocaleString()} 评论`,
                    }))}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="empty">暂无内容来源数据</div>
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="DATA INTEGRITY"
          title="数据覆盖与分析缺口"
          desc="各项独立统计；表现指标指阅读或互动大于 0，未覆盖不等于表现为零。"
        >
          {total > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              {coverage.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '12px 14px',
                    background: '#f9f9fb',
                    border: '0.5px solid var(--slate-6, #d9d9e0)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <strong style={{ color: '#1c2024' }}>{item.label}</strong>
                    <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#d9d9e0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>{item.subText}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无笔记，暂不计算覆盖率</div>
          )}
        </DashboardSection>
      </div>

      {/* 第二行：内容形式互动贡献 vs 达人层级篇均互动效率（双列纵深大榜严格等高，消除右侧大空洞） */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="FORMAT MIX"
          title="内容形式互动贡献"
          desc="按已同步互动次数计算贡献占比；缺失互动指标的内容不参与占比计算。"
        >
          {interactions > 0 ? (
            <HorizontalBarList
              onItemClick={it => onFormatClick && onFormatClick(it.label)}
              items={formats.map((row, index) => ({
                label: String(row.name || '待补充'),
                amount: count(row.interactions),
                pct: (count(row.interactions) / interactions) * 100,
                color: colors[index % colors.length],
                subText: `${count(row.interactions).toLocaleString()} 次互动 / ${count(row.count)} 篇`,
              }))}
            />
          ) : (
            <div className="empty">暂无已同步互动贡献</div>
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="CREATOR EFFICIENCY"
          title="达人层级篇均互动效率"
          desc="百分比以最高篇均互动层级为 100%；均值沿用已同步指标口径，未采集指标层级单独标示。"
        >
          {levels.length ? (
            <HorizontalBarList
              items={levels.map((row, index) => {
                const hasInter = typeof row.avgInteraction === 'number' && Number.isFinite(row.avgInteraction);
                const interVal = hasInter ? (row.avgInteraction as number) : 0;
                const pct = hasInter && maxInteraction > 0 ? (interVal / maxInteraction) * 100 : 0;
                const sub = hasInter
                  ? `${interVal.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 次/篇 / ${count(row.count)} 篇`
                  : `未采集表现指标 / ${count(row.count)} 篇`;
                return {
                  label: cleanName(row.name),
                  amount: interVal,
                  pct,
                  color: hasInter ? colors[index % colors.length] : '#60646c',
                  subText: sub,
                };
              })}
            />
          ) : (
            <div className="empty">暂无达人层级数据</div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
