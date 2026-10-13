'use client';

import { useState, useEffect } from 'react';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { api } from '../../lib/hooks/use-project-data';

export interface DashboardCardConfig {
  id?: string;
  title: string;
  type: 'metric_card' | 'progress_card' | 'breakdown';
  datasetId?: string;
  metric?: string;
  aggregation?: 'sum' | 'count' | 'distinct_count' | 'avg' | 'ratio';
  field?: string;
  numField?: string;
  denField?: string;
  groupBy?: string;
  dateField?: string;
  from?: string;
  to?: string;
  unit?: string;
  format?: 'number' | 'percent' | 'currency' | 'compact';
  desc?: string;
  sortOrder?: number;
}

export function CardEditModal({
  projectId,
  initialCard,
  datasets,
  onSave,
  onClose,
}: {
  projectId: string;
  initialCard?: DashboardCardConfig | null;
  datasets: Array<{ id: string; name: string; columns?: Array<{ key: string; name: string; type: string }> }>;
  onSave: (card: DashboardCardConfig) => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState<DashboardCardConfig>(() => ({
    id: initialCard?.id || `card-${Date.now()}`,
    title: initialCard?.title || '新增指标卡',
    type: initialCard?.type || 'metric_card',
    datasetId: initialCard?.datasetId || datasets[0]?.id || '',
    aggregation: initialCard?.aggregation || (initialCard?.numField && initialCard?.denField ? 'ratio' : initialCard?.field ? 'sum' : 'ratio'),
    metric: initialCard?.metric || 'custom',
    field: initialCard?.field || '',
    numField: initialCard?.numField || '',
    denField: initialCard?.denField || '',
    groupBy: initialCard?.groupBy || '',
    dateField: initialCard?.dateField || '',
    unit: initialCard?.unit || '',
    format: initialCard?.format || 'number',
  }));

  const [preview, setPreview] = useState<{
    value: number | null;
    formattedValue: string;
    sampleSize: number;
    status: string;
    statusLabel: string;
    numerator?: number | null;
    denominator?: number | null;
  } | null>(null);

  const [loadingPreview, setLoadingPreview] = useState(false);

  // Available columns from selected dataset
  const activeDataset = datasets.find((d) => d.id === card.datasetId) || datasets[0];
  const columns = activeDataset?.columns || [];
  const columnKeys = columns.map((c) => c.key || c.name);

  // Fetch live calculation preview
  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    api<{ ok: boolean; metric: any }>('/api/metrics', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        action: 'evaluate',
        card: {
          ...card,
          datasetId: card.datasetId || activeDataset?.id,
        },
      }),
    })
      .then((res) => {
        if (!cancelled && res.metric) {
          setPreview(res.metric);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, card, activeDataset?.id]);

  function handleSubmit() {
    if (!card.title.trim()) return;
    onSave({
      ...card,
      datasetId: card.datasetId || activeDataset?.id,
    });
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 540, width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a', fontWeight: 700 }}>
            {initialCard?.id ? '编辑看板指标卡' : '添加看板指标卡'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            卡片标题
            <input
              value={card.title}
              placeholder="例如：签约达成率 或 门店咨询总人数"
              onChange={(e) => setCard({ ...card, title: e.target.value })}
              style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            绑定数据集
            <CustomSelect
              value={card.datasetId || activeDataset?.id || ''}
              onChange={(val) => setCard({ ...card, datasetId: val })}
              options={datasets.map((d) => ({ value: d.id, label: d.name }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            展示呈现形式
            <CustomSelect
              value={card.type}
              onChange={(val: any) => setCard({ ...card, type: val })}
              options={[
                { value: 'metric_card', label: '单值指标卡 (大号数值 / 金额)' },
                { value: 'progress_card', label: '达成进度卡 (比率 / 进度条 / 分子分母)' },
                { value: 'breakdown', label: '细分对比卡 (按维度分组列表)' },
              ]}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            指标计算方式
            <CustomSelect
              value={card.aggregation || 'sum'}
              onChange={(val: any) => {
                let defaultUnit = card.unit;
                let defaultFormat = card.format;
                if (val === 'ratio') {
                  defaultUnit = '%';
                  defaultFormat = 'percent';
                }
                setCard({ ...card, aggregation: val, unit: defaultUnit, format: defaultFormat });
              }}
              options={[
                { value: 'ratio', label: '比率转化 (分子 / 分母 加权比率)' },
                { value: 'sum', label: '数值求和 (Sum)' },
                { value: 'avg', label: '数值平均 (Average)' },
                { value: 'count', label: '记录计数 (Count)' },
                { value: 'distinct_count', label: '唯一值计数 (去重计数)' },
              ]}
            />
          </label>

          {card.aggregation === 'ratio' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                分子字段 (Numerator)
                <CustomSelect
                  value={card.numField || ''}
                  onChange={(val) => setCard({ ...card, numField: val })}
                  placeholder="-- 选择分子字段 --"
                  options={columnKeys.map((c) => ({ value: c, label: c }))}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                分母字段 (Denominator)
                <CustomSelect
                  value={card.denField || ''}
                  onChange={(val) => setCard({ ...card, denField: val })}
                  placeholder="-- 选择分母字段 --"
                  options={columnKeys.map((c) => ({ value: c, label: c }))}
                />
              </label>
            </div>
          ) : card.aggregation !== 'count' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              目标计算字段
              <CustomSelect
                value={card.field || ''}
                onChange={(val) => setCard({ ...card, field: val })}
                placeholder="-- 选择字段 --"
                options={columnKeys.map((c) => ({ value: c, label: c }))}
              />
            </label>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              细分维度 (可选分组)
              <CustomSelect
                value={card.groupBy || ''}
                onChange={(val) => setCard({ ...card, groupBy: val })}
                placeholder="不分组 (全盘合计)"
                options={[{ value: '', label: '不分组 (全盘合计)' }, ...columnKeys.map((c) => ({ value: c, label: c }))]}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              单位 (选填)
              <input
                value={card.unit || ''}
                placeholder="如：%、人、元、单"
                onChange={(e) => setCard({ ...card, unit: e.target.value })}
                style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </label>
          </div>

          {/* Live Calculation Preview Box */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              🔍 全量指标实时试算预览：
            </div>
            {loadingPreview ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>正在试算当前配置…</div>
            ) : preview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                    {preview.formattedValue}
                  </span>
                  <span style={{ fontSize: 12, color: preview.status === 'ok' ? '#16a34a' : preview.status === 'zero' ? '#64748b' : '#e11d48', fontWeight: 600 }}>
                    [{preview.statusLabel}]
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  有效样本量: {preview.sampleSize} 行
                  {preview.denominator !== undefined ? ` · 分子合计: ${preview.numerator?.toLocaleString()} · 分母合计: ${preview.denominator?.toLocaleString()}` : ''}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无可预览数据</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            取消
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            style={{ padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            保存并加入看板
          </button>
        </div>
      </div>
    </div>
  );
}
