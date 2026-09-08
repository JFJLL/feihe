import type { ComponentProps } from 'react';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { compactMetric, display, numeric } from './metrics';

export function GrowthReadout({ value }: { value: unknown }) {
  return <span title={numeric(value) === null ? '未提供' : display(value)}>{compactMetric(value)}</span>;
}

export function GrowthMetricCard({ value, ...props }: Omit<ComponentProps<typeof MetricCard>, 'value'> & { value: unknown }) {
  return <div title={props.label + '：' + (numeric(value) === null ? '未提供' : display(value)) + (props.unit || '')}>
    <MetricCard {...props} value={compactMetric(value)} />
  </div>;
}
