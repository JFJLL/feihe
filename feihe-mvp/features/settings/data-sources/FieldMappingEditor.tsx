'use client';

import { useState } from 'react';
import { CustomSelect } from '../../../components/ui/CustomSelect';

export interface FieldMappingRule {
  sourceField: string;
  targetField: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  isKey?: boolean;
  isDate?: boolean;
  required?: boolean;
  nullPolicy?: 'null' | 'zero' | 'empty' | 'skip';
}

export function FieldMappingEditor({
  rawHeaders,
  rawPreviewRows,
  mappingRules,
  onChange,
}: {
  rawHeaders: string[];
  rawPreviewRows: Array<Record<string, unknown>>;
  mappingRules: FieldMappingRule[];
  onChange: (rules: FieldMappingRule[]) => void;
}) {
  const [previewMode, setPreviewMode] = useState<'mapped' | 'raw'>('mapped');

  function updateRule(index: number, patch: Partial<FieldMappingRule>) {
    const updated = [...mappingRules];
    updated[index] = { ...updated[index], ...patch };
    onChange(updated);
  }

  const mappedPreviewRows = rawPreviewRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const rule of mappingRules) {
      if (!rule.sourceField || !rule.targetField) continue;
      const raw = row[rule.sourceField];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        out[rule.targetField] = rule.nullPolicy === 'zero' ? 0 : '—';
        continue;
      }
      if (rule.type === 'number') {
        const num = Number(String(raw).replace(/[,￥¥%]/g, ''));
        out[rule.targetField] = isNaN(num) ? (rule.nullPolicy === 'zero' ? 0 : '—') : num;
      } else {
        out[rule.targetField] = String(raw);
      }
    }
    return out;
  });

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a', fontWeight: 700 }}>
            ⚙ 可视化字段映射配置
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            定义来源字段对应项目数据集的目标字段名、数据类型、主键及空值处理。已自动解析 {rawHeaders.length} 个字段。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setPreviewMode('mapped')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: 'none',
              background: previewMode === 'mapped' ? '#2563eb' : '#fff',
              color: previewMode === 'mapped' ? '#fff' : '#475569',
              cursor: 'pointer',
            }}
          >
            映射后预览
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('raw')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: 'none',
              background: previewMode === 'raw' ? '#2563eb' : '#fff',
              color: previewMode === 'raw' ? '#fff' : '#475569',
              cursor: 'pointer',
            }}
          >
            原始快照
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '8px 12px' }}>来源原字段</th>
              <th style={{ padding: '8px 12px' }}>目标项目字段名</th>
              <th style={{ padding: '8px 12px' }}>目标数据类型</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>业务主键</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>日期字段</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>必填</th>
              <th style={{ padding: '8px 12px' }}>空值处理</th>
            </tr>
          </thead>
          <tbody>
            {mappingRules.map((rule, idx) => (
              <tr key={rule.sourceField} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                  {rule.sourceField}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    value={rule.targetField}
                    onChange={(e) => updateRule(idx, { targetField: e.target.value })}
                    style={{ height: 32, padding: '0 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, width: 140 }}
                  />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <CustomSelect
                    value={rule.type}
                    onChange={(val: any) => updateRule(idx, { type: val })}
                    options={[
                      { value: 'text', label: '文本 (text)' },
                      { value: 'number', label: '数值 (number)' },
                      { value: 'date', label: '日期 (date)' },
                      { value: 'boolean', label: '布尔 (boolean)' },
                    ]}
                    style={{ width: 125 }}
                  />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(rule.isKey)}
                    onChange={(e) => updateRule(idx, { isKey: e.target.checked })}
                  />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(rule.isDate)}
                    onChange={(e) => updateRule(idx, { isDate: e.target.checked })}
                  />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(rule.required)}
                    onChange={(e) => updateRule(idx, { required: e.target.checked })}
                  />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <CustomSelect
                    value={rule.nullPolicy || 'null'}
                    onChange={(val: any) => updateRule(idx, { nullPolicy: val })}
                    options={[
                      { value: 'null', label: '保留为空 (null)' },
                      { value: 'zero', label: '填充为 0' },
                      { value: 'empty', label: '填充为空串' },
                    ]}
                    style={{ width: 125 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Table */}
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
          {previewMode === 'mapped' ? '🔍 映射转换后数据预览（前 5 行）：' : '📄 原始飞书表格数据预览（前 5 行）：'}
        </div>
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {(previewMode === 'mapped' ? mappingRules.map((r) => r.targetField) : rawHeaders).map((h) => (
                  <th key={h} style={{ padding: '6px 10px', color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(previewMode === 'mapped' ? mappedPreviewRows : rawPreviewRows).slice(0, 5).map((r, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {(previewMode === 'mapped' ? mappingRules.map((m) => m.targetField) : rawHeaders).map((h) => (
                    <td key={h} style={{ padding: '6px 10px', color: '#1e293b' }}>
                      {String(r[h] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
