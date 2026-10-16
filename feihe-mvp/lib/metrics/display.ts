import type { PercentScale } from '../numeric-values';

export function formatMetricValue(val: number | null, format = 'number', unit = '', percentScale: PercentScale = 'percentage_points'): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  if (format === 'percent' || unit === '%') return (val * (percentScale === 'fraction' ? 100 : 1)).toFixed(1) + '%';
  if (format === 'currency' || unit === '元') return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (format === 'compact') {
    if (Math.abs(val) >= 10000) return (val / 10000).toFixed(1) + 'w';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    return String(Math.round(val));
  }
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + (unit ? ' ' + unit : '');
}
