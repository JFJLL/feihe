'use client';

import type { Analytics } from '../../lib/types/project';
import { sourceLabel } from './content-view-model';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { TierDoughnutChart, HorizontalBarList } from '../overview/OverviewCharts';

const colors = ['#1e6091', '#3f815e', '#7864a5', '#a66f22', '#64748b'];
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const cleanName = (val: unknown) => {
  const str = String(val || '').trim();
  return !str || /\uFFFD/.test(str) ? '其他' : str;
};

export function ContentAnalyticsBoard({ analytics }: { analytics: Analytics }) {
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
  const levels = analytics.creatorLevels.filter(row => count(row.avgInteraction) > 0)
    .slice().sort((a, b) => count(b.avgInteraction) - count(a.avgInteraction));
  const maxInteraction = Math.max(0, ...levels.map(row => count(row.avgInteraction)));
  const formats = analytics.formats.filter(row => count(row.interactions) > 0);
  const interactions = formats.reduce((sum, row) => sum + count(row.interactions), 0);
  const scopes = (analytics.scopeDistribution || []).filter(row => count(row.count) > 0);
  const scopeTotal = scopes.reduce((sum, row) => sum + count(row.count), 0);

  return (
    <div className="stack">
      {/* 核心主分析两栏布局：左侧来源与形式纵向排布，右侧达人效率纵深对比，高度自然平衡 */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        {/* 左列：内容资产来源结构 + 内容形式互动贡献 */}
        <div className="stack" style={{ gap: 20 }}>
          <DashboardSection eyebrow="CORE STRATEGY" title="内容资产来源结构" desc="按当前统计范围内的全部笔记汇总，识别内容来源集中度。">
            {sourceTotal > 0 ? (
              <TierDoughnutChart
                total={sourceTotal}
                items={sources.map((row, index) => ({
                  label: sourceLabel(row.name),
                  count: count(row.count),
                  pct: (count(row.count) / sourceTotal) * 100,
                  color: colors[index % colors.length],
                }))}
              />
            ) : (
              <div className="empty">暂无内容来源数据</div>
            )}
          </DashboardSection>

          <DashboardSection eyebrow="FORMAT MIX" title="内容形式互动贡献" desc="按已同步互动次数计算贡献占比；缺失互动指标的内容不参与占比计算。">
            {interactions > 0 ? (
              <HorizontalBarList
                items={formats.map((row, index) => ({
                  label: String(row.name || '待补充'),
                  amount: count(row.interactions),
                  pct: (count(row.interactions) / interactions) * 100,
                  color: colors[index % colors.length],
                  subText: `${count(row.interactions).toLocaleString()} 次互动 · ${count(row.count)} 篇`,
                }))}
              />
            ) : (
              <div className="empty">暂无已同步互动贡献</div>
            )}
          </DashboardSection>

          {scopes.length > 0 && (
            <DashboardSection
              eyebrow="PRODUCT SCOPE"
              title="内容产品范围分布"
              desc="本品投放与竞品讨论、行业泛内容声量分布结构。"
            >
              <HorizontalBarList
                items={scopes.map((row, index) => ({
                  label: cleanName(row.name),
                  amount: count(row.count),
                  pct: scopeTotal > 0 ? (count(row.count) / scopeTotal) * 100 : 0,
                  color: colors[(index + 2) % colors.length],
                  subText: `${count(row.count).toLocaleString()} 篇 · ${count(row.comments).toLocaleString()} 评论`,
                }))}
              />
            </DashboardSection>
          )}
        </div>

        {/* 右列：达人层级篇均互动效率 */}
        <DashboardSection
          eyebrow="CREATOR EFFICIENCY"
          title="达人层级篇均互动效率"
          desc="百分比以最高篇均互动层级为 100%；均值沿用已同步指标口径，不代表互动贡献占比。"
        >
          {levels.length ? (
            <HorizontalBarList
              items={levels.map((row, index) => ({
                label: cleanName(row.name),
                amount: count(row.avgInteraction),
                pct: (count(row.avgInteraction) / maxInteraction) * 100,
                color: colors[index % colors.length],
                subText: `${count(row.avgInteraction).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 次/篇 · ${count(row.count)} 篇`,
              }))}
            />
          ) : (
            <div className="empty">暂无大于 0 的篇均互动数据</div>
          )}
        </DashboardSection>
      </div>

      {/* 辅助分析：数据覆盖与分析缺口（全宽网格自适应展示，消除下部空隙） */}
      <DashboardSection
        eyebrow="DATA INTEGRITY"
        title="数据覆盖与分析缺口"
        desc="各项独立统计；表现指标指阅读或互动大于 0，未覆盖不等于表现为零。"
      >
        {total > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {coverage.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <strong style={{ color: '#0f172a' }}>{item.label}</strong>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: item.color }}>{item.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>{item.subText}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">暂无笔记，暂不计算覆盖率</div>
        )}
      </DashboardSection>
    </div>
  );
}
