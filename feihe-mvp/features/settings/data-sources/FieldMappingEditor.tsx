'use client';

import { useState } from 'react';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { transformMappedRows, type FieldMappingRule } from '../../../lib/field-mapping';
export type { FieldMappingRule } from '../../../lib/field-mapping';

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

  const transformed = transformMappedRows(rawPreviewRows, mappingRules);
  const mappedPreviewRows = transformed.rows;
  const mappedHeaders = [...new Set(mappedPreviewRows.flatMap(row => Object.keys(row)))];

  return (
    <div style={{ marginTop: 20, borderTop: '0.5px solid #d9d9e0', paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 16, color: '#1c2024', fontWeight: 700 }}>
            ⚙ 可视化字段映射配置
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#60646c' }}>
            定义来源字段对应项目数据集的目标字段名、数据类型、主键及空值处理。已自动解析 {rawHeaders.length} 个字段。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, border: '0.5px solid #cdced6', borderRadius: 6, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setPreviewMode('mapped')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: 'none',
              background: previewMode === 'mapped' ? '#0090ff' : '#fff',
              color: previewMode === 'mapped' ? '#fff' : '#60646c',
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
              background: previewMode === 'raw' ? '#0090ff' : '#fff',
              color: previewMode === 'raw' ? '#fff' : '#60646c',
              cursor: 'pointer',
            }}
          >
            原始快照
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12 }}>多个主键字段组成联合主键；空主键、重复主键和非法值会拒绝整次导入。必填检查先于补值，未映射字段保留。</p>
      {transformed.errors.length > 0 && <div role="alert">{transformed.errors.join('；')}</div>}
      <div style={{ overflowX: 'auto', border: '0.5px solid #d9d9e0', borderRadius: 8, background: '#fff', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9f9fb', borderBottom: '0.5px solid #d9d9e0', color: '#60646c' }}>
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
              <tr key={rule.sourceField} style={{ borderBottom: '0.5px solid #f0f0f3' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1c2024' }}>
                  {rule.sourceField}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    aria-label={rule.sourceField + '目标字段'}
                    value={rule.targetField}
                    onChange={(e) => updateRule(idx, { targetField: e.target.value })}
                    style={{ height: 32, padding: '0 8px', borderRadius: 4, border: '0.5px solid #cdced6', fontSize: 14, width: 140 }}
                  />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <CustomSelect
                    ariaLabel={rule.sourceField + '数据类型'}
                    value={rule.type || 'text'}
                    onChange={val => updateRule(idx, { type: val as FieldMappingRule['type'], isDate: val === 'date', nullPolicy: 'null', numericUnit: undefined, sourcePercentScale: undefined })}
                    options={[
                      { value: 'text', label: '文本 (text)' },
                      { value: 'number', label: '数值 (number)' },
                      { value: 'date', label: '日期 (date)' },
                      { value: 'boolean', label: '布尔 (boolean)' },
                    ]}
                    style={{ width: 125 }}
                  />
                  {rule.type === 'number' && <CustomSelect ariaLabel={rule.sourceField + '数值单位'} value={rule.numericUnit || 'number'} onChange={value => updateRule(idx, { numericUnit: value as FieldMappingRule['numericUnit'], sourcePercentScale: value === 'percent' ? 'fraction' : undefined })} options={[{ value: 'number', label: '普通数值' }, { value: 'percent', label: '百分比（存为比例小数）' }]} />}
                  {rule.type === 'number' && rule.numericUnit === 'percent' && <><CustomSelect ariaLabel={rule.sourceField + '来源百分比单位'} value={rule.sourcePercentScale || ''} onChange={value => updateRule(idx, { sourcePercentScale: value as FieldMappingRule['sourcePercentScale'] })} options={[{ value: 'fraction', label: '来源数值为比例：0.005 = 0.5%' }, { value: 'percentage_points', label: '来源数值为百分点：0.5 = 0.5%' }]} /><small>带 % 文本按自身单位转换一次；目标统一存比例小数。</small></>}
                  {(rule.type === 'date' || rule.isDate) && <CustomSelect ariaLabel={rule.sourceField + '日期格式'} value={rule.dateFormat || 'auto'} onChange={value => updateRule(idx, { dateFormat: value as FieldMappingRule['dateFormat'] })} options={['auto', 'YYYY-MM-DD', 'YYYY-MM', 'ISO']} />}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={rule.sourceField + '主键'}
                    checked={Boolean(rule.isKey)}
                    onChange={(e) => updateRule(idx, { isKey: e.target.checked })}
                  />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={rule.sourceField + '日期字段'}
                    checked={rule.type === 'date' || Boolean(rule.isDate)}
                    onChange={(e) => updateRule(idx, { isDate: e.target.checked, type: e.target.checked ? 'date' : 'text', nullPolicy: 'null', numericUnit: undefined, sourcePercentScale: undefined })}
                  />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={rule.sourceField + '必填'}
                    checked={Boolean(rule.required)}
                    onChange={(e) => updateRule(idx, { required: e.target.checked })}
                  />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <CustomSelect
                    ariaLabel={rule.sourceField + '空值处理'}
                    value={rule.nullPolicy || 'null'}
                    onChange={val => updateRule(idx, { nullPolicy: val as FieldMappingRule['nullPolicy'] })}
                    options={[
                      { value: 'null', label: '保留为空 (null)' },
                      { value: 'zero', label: '填充为 0', disabled: rule.type !== 'number' },
                      { value: 'empty', label: '填充为空串', disabled: rule.type !== 'text' },
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
      <div style={{ background: '#f9f9fb', padding: 12, borderRadius: 8, border: '0.5px solid #d9d9e0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#60646c', marginBottom: 8 }}>
          {previewMode === 'mapped' ? '🔍 映射转换后数据预览（前 5 行）：' : '📄 原始飞书表格数据预览（前 5 行）：'}
        </div>
        <div style={{ overflowX: 'auto', background: '#fff', border: '0.5px solid #cdced6', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f0f0f3' }}>
                {(previewMode === 'mapped' ? mappedHeaders : rawHeaders).map((h) => (
                  <th key={h} style={{ padding: '6px 10px', color: '#60646c' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(previewMode === 'mapped' ? mappedPreviewRows : rawPreviewRows).slice(0, 5).map((r, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '0.5px solid #f0f0f3' }}>
                  {(previewMode === 'mapped' ? mappedHeaders : rawHeaders).map((h) => (
                    <td key={h} style={{ padding: '6px 10px', color: '#1c2024' }}>
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
