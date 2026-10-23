'use client';
import { useEffect, useState } from 'react';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { api } from '../../lib/hooks/use-project-data';
import { queryErrors, type MetricQuery } from '../../lib/metrics/query';

export function BoardQueryBar({ projectId, dataset, query, disabled, editing, onChange }: {
  projectId: string; dataset?: { id: string; columns?: Array<{ key: string; name: string; type: string }> };
  query: MetricQuery; disabled: boolean; editing: boolean; onChange: (query: MetricQuery) => void;
}) {
  const filter = query.filters?.[0], field = filter?.key || '';
  const key = JSON.stringify({ projectId, datasetId: dataset?.id, field });
  const [options, setOptions] = useState<{ key: string; values: string[]; limited?: boolean; error?: string }>({ key: '', values: [] });
  useEffect(() => {
    if (!field || !dataset) return;
    const controller = new AbortController(); let current = true;
    const scope = JSON.parse(key);
    const params = new URLSearchParams({ projectId: scope.projectId, datasetId: scope.datasetId, field: scope.field, action: 'filter_options' });
    api<{ values: string[]; limited: boolean }>('/api/metrics?' + params, { signal: controller.signal }).then(result => { if (current) setOptions({ key, ...result }); }).catch(error => { if (current) setOptions({ key, values: [], error: error instanceof Error ? error.message : '筛选项加载失败' }); });
    return () => { current = false; controller.abort(); };
  }, [key, field, dataset]);
  const current = options.key === key ? options : undefined;
  const errors = queryErrors(query);
  return <section className="board-query-bar" aria-label="项目周期与共同筛选">
    <div className="board-query-fields">
      <label>开始日期<CustomDatePicker aria-label="项目开始日期" disabled={disabled} value={query.from || ''} onChange={e => onChange({ ...query, from: e.target.value })} /></label>
      <label>结束日期<CustomDatePicker aria-label="项目结束日期" disabled={disabled} value={query.to || ''} onChange={e => onChange({ ...query, to: e.target.value })} /></label>
      <label>共同筛选字段<CustomSelect ariaLabel="共同筛选字段" disabled={disabled} value={field} onChange={key => onChange({ ...query, filters: key ? [{ key, value: '' }] : undefined })} options={[{ value: '', label: '不筛选' }, ...(dataset?.columns || []).filter(column => column.type !== 'date').map(column => ({ value: column.key, label: column.name }))]} /></label>
      {field && <label>筛选值<CustomSelect ariaLabel="共同筛选值" disabled={disabled || !current} value={filter?.value || ''} onChange={value => onChange({ ...query, filters: [{ key: field, value }] })} options={[{ value: '', label: '全部' }, ...(current?.values || []).map(value => ({ value, label: value }))]} /></label>}
      <button className="secondary" disabled={disabled} onClick={() => onChange({})}>清除周期与筛选</button>
    </div>
    <p>{editing ? '发布时保存为团队默认周期与筛选。' : '当前查看范围；配置者可在编辑看板时发布团队默认范围。'}日期按项目时区，结束日包含全天；无日期记录不进入指定周期。共同筛选须在每张卡片来源中存在。</p>
    {current?.limited && <p>筛选列表展示前100个值；其他值可在数据明细中检索。</p>}
    {(errors.length > 0 || current?.error) && <p role="alert">{errors.join('；') || current?.error}</p>}
  </section>;
}
