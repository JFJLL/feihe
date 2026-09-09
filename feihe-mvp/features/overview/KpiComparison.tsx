'use client';

import { useState } from 'react';
import type { FeishuData } from '../../lib/feishu-model';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { kpiScopes, compareKpi } from './kpi-view-model';

const display = (value: number | null, percent = false) => value === null ? '—' :
  (value * (percent ? 100 : 1)).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + (percent ? '%' : '');

export function KpiComparison({ data }: { data?: FeishuData }) {
  const [selection, setSelection] = useState('');
  const scopes = kpiScopes(data?.kpiWeekly || []);
  const scope = scopes.find(s => s.key === selection) || scopes.at(-1);
  const comparison = scope ? compareKpi(scope.rows) : null;
  const metrics = [
    { key: 'cost', label: '消耗金额', unit: '元', lower: false },
    { key: 'cpuvEcom', label: '电商 CPUV', unit: '元', lower: true },
    { key: 'cpuvSpotlight', label: '聚光 CPUV', unit: '元', lower: true },
    { key: 'storeUvEcom', label: '电商进店 UV', unit: '人', lower: false },
    { key: 'itiTotal', label: 'I+TI 人群资产', unit: '人', lower: false },
    { key: 'viralRate', label: '爆文率', unit: '%', lower: false },
  ] as const;
  return <DashboardSection title="KPI目标与实际" eyebrow="TARGET VS ACTUAL" desc="选择同一周期、代理、项目和渠道进行比较；总计与明细分别查看。">
    {scope && <label style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>统计范围
      <CustomSelect ariaLabel="KPI统计范围" value={scope.key} onChange={setSelection} options={scopes.map(s => ({ value: s.key, label: s.label }))} />
    </label>}
    {!comparison ? <EmptyState title="等待 KPI 数据" text="同步飞书数据后查看目标、实际和差额。" /> : <>
      {comparison.ambiguous && <p role="alert">该范围存在重复的目标或实际记录，暂不计算，需核对源表。</p>}
      <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>指标</th><th>目标</th><th>实际</th><th>实际 − 目标</th><th>对照结果</th></tr></thead>
        <tbody>{metrics.map(metric => {
          const target = comparison.target?.[metric.key] ?? null;
          const actual = comparison.actual?.[metric.key] ?? null;
          const valid = target !== null && actual !== null;
          const rate = valid && target > 0 ? actual / target : null;
          return <tr key={metric.key}><td>{metric.label}{metric.unit !== '%' ? `（${metric.unit}）` : ''}</td>
            <td>{display(target, metric.unit === '%')}</td><td>{display(actual, metric.unit === '%')}</td>
            <td>{valid ? metric.unit === '%' ? display((actual - target) * 100) + ' 个百分点' : display(actual - target) : '—'}</td>
            <td>{!valid ? '缺少可比数据' : metric.key === 'cost' ? `预算执行 ${display(rate, true)}` : metric.lower ? (actual <= target ? '达到成本目标' : '高于成本目标') : (actual >= target ? '达到目标' : '低于目标')}</td></tr>;
        })}</tbody></table></div>
      <p className="metric-note">消耗进度不代表效果达成；爆文率使用该范围源值，不平均不同范围的比率。人群资产不跨周期加总。</p>
    </>}
    {(data?.itiRetention || []).length > 0 && <TimeSeriesChart rows={(data?.itiRetention || []).filter(r => r.date >= '2025-12-31').map(r => ({ ...r }))}
      title="I+TI 人群资产趋势" unit="人" series={[{ key: 'feiheIti', label: '飞鹤整体', color: '#1e40af' }, { key: 'qicuiIti', label: '启萃', color: '#7c3aed' }, { key: 'qicuiEarlyIti', label: '启萃早阶', color: '#0d9488' }]} />}
    {(data?.kpiInternal || []).some(r => r.dimension === '实际') && <details style={{ marginTop: 16 }}><summary>月度实际明细（各项目、渠道独立展示）</summary>
      <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>月份</th><th>项目</th><th>渠道</th><th>费用（元）</th><th>曝光</th><th>互动</th></tr></thead><tbody>
        {data?.kpiInternal?.filter(r => r.dimension === '实际').map((r, i) => <tr key={i}><td>{r.month.replace(/月$/, '')}月</td><td>{r.project}</td><td>{r.lat}</td><td>{display(r.cost)}</td><td>{display(r.exposure)}</td><td>{display(r.interaction)}</td></tr>)}
      </tbody></table></div></details>}
  </DashboardSection>;
}
