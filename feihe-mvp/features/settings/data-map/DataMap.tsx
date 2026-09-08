'use client';

import { useState, useMemo } from 'react';
import type { MapData, Keystone, Row } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
import { api, shown, cnTime, size } from '../../../lib/hooks/use-project-data';

const entityLabels: Record<string, string> = {
  account: '账户',
  endpoint: '接口',
  metric: '指标',
  binding: '映射',
};

export function DataMap({
  projectId,
  data,
  reload,
  toast,
}: {
  projectId: string;
  data: MapData;
  reload: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [tab, setTab] = useState('overview');
  const [editor, setEditor] = useState<{ entity: string; row: Row } | null>(null);
  const [busy, setBusy] = useState('');

  const coverage = useMemo(
    () => ({
      sources: data.sources.length + data.integrations.length,
      accounts: data.accounts.length,
      endpoints: data.endpoints.length,
      metrics: data.metrics.length,
      bindings: data.bindings.length,
    }),
    [data]
  );

  async function save() {
    if (!editor) return;
    setBusy('save');
    try {
      await api('/api/data-map', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          entity: editor.entity,
          projectId,
          ...editor.row,
        }),
      });
      toast(entityLabels[editor.entity] + '已保存', 'success');
      setEditor(null);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function remove(entity: string, row: Row) {
    if (!confirm('确认删除“' + shown(row.name || row.key) + '”？')) return;
    try {
      await api('/api/data-map', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          entity,
          projectId,
          id: row.id,
          name: row.name,
        }),
      });
      toast('已删除', 'success');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  }

  async function probe() {
    setBusy('probe');
    try {
      const result = await api<Keystone>('/api/data-map', {
        method: 'POST',
        body: JSON.stringify({ action: 'probe_keystone', projectId }),
      });
      toast('Keystone：' + result.status, 'success');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '检测失败', 'error');
    } finally {
      setBusy('');
    }
  }

  const tabs = [
    ['overview', '总览'],
    ['accounts', '账户 ' + data.accounts.length],
    ['endpoints', '接口 ' + data.endpoints.length],
    ['metrics', '指标 ' + data.metrics.length],
    ['bindings', '字段映射 ' + data.bindings.length],
    ['assets', '附件 ' + data.assets.length],
  ];

  return (
    <div className="intel-stack">
      <section className="pastel-card reference-section section-blue">
        <div>
          <small>DATA SEMANTIC LAYER</small>
          <h2>数据来源、业务指标与映射关系</h2>
          <p>
            从项目数据源追溯到账户、接口与标准指标。下方数量表示已登记的配置，实际连接状态以检测结果为准。
          </p>
        </div>
      </section>

      <nav className="map-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="ops-metric-grid" aria-label="数据地图登记概况">
            {Object.entries(coverage).map(([k, v]) => (
              <MetricCard key={k} label={({ sources: '数据源与集成', accounts: '业务账户', endpoints: '已登记接口', metrics: '标准指标', bindings: '字段映射' } as Record<string, string>)[k]} value={v} unit="项" theme={k === 'metrics' ? 'purple' : k === 'bindings' ? 'teal' : 'blue'} tag="已登记" desc={({ sources: '来源：项目数据源与工具集成配置', accounts: '来源：业务账户目录', endpoints: '登记数量不等于已验证可用数量', metrics: '来源：标准指标字典', bindings: '来源：原始字段与标准指标映射' } as Record<string, string>)[k]} />
            ))}
          </section>


          <section className="platform-split" style={{ gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
            {(() => {
              const k = data.keystone;
              const isConfigured = Boolean(k.configured);
              const isFailed = k.status === '连接失败' || Boolean(k.error);
              const hasTextModel = Boolean(k.textModels?.includes(k.textModel));
              const hasImageModel = Boolean(k.imageModels?.includes(k.imageModel));

              let statusColor = '#94a3b8';
              let statusText = k.status || '未配置密钥';
              if (!isConfigured) {
                statusColor = '#94a3b8';
                statusText = k.status || '未配置密钥';
              } else if (isFailed) {
                statusColor = '#dc2626';
                statusText = k.error ? `连接失败 (${k.error})` : '连接失败';
              } else if (hasTextModel) {
                statusColor = '#16a34a';
                statusText = k.status || '文本与生图模型可用';
              } else {
                statusColor = '#ea580c';
                statusText = k.status || '已连接 · 目标模型待验证';
              }

              let poolContent: React.ReactNode;
              if (!isConfigured) {
                poolContent = <span style={{ color: '#94a3b8' }}>未配置网关密钥</span>;
              } else if (isFailed) {
                poolContent = <span style={{ color: '#dc2626' }}>连接失败：{k.error || '无法获取模型列表'}</span>;
              } else if (!k.models || k.models.length === 0) {
                poolContent = <span style={{ color: '#b45309' }}>已连接但可用模型列表为空</span>;
              } else {
                poolContent = <span style={{ color: '#334155' }}>{k.models.join(', ')}</span>;
              }

              return (
            <article className="platform-panel pastel-card reference-section section-blue" style={{ padding: '20px' }}>
              <div className="card-header-row" style={{ marginBottom: '16px' }}>
                <div className="header-left">
                  <span className="section-mini-tag tag-blue">AI GATEWAY</span>
                  <h3 style={{ margin: 0 }}>Keystone 模型网关配置与状态</h3>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: statusColor }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} />
                  {statusText}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '3px' }}>Base URL</span>
                  <code style={{ color: '#0f172a', wordBreak: 'break-all' }}>{k.baseUrl}</code>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '3px' }}>文本推理模型</span>
                  <strong style={{ color: '#0f172a' }}>{k.textModel}</strong>{' '}
                  {!isConfigured ? (
                    <span className="section-mini-tag" style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>未配置</span>
                  ) : isFailed ? (
                    <span className="section-mini-tag tag-rose" style={{ fontSize: '10px' }}>不可用</span>
                  ) : hasTextModel ? (
                    <span className="section-mini-tag tag-green" style={{ fontSize: '10px' }}>已验证可用</span>
                  ) : (
                    <span className="section-mini-tag tag-amber" style={{ fontSize: '10px' }}>待验证（未在列表中）</span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '3px' }}>生图模型</span>
                  <strong style={{ color: '#0f172a' }}>{k.imageModel}</strong>{' '}
                  {!isConfigured ? (
                    <span className="section-mini-tag" style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>未配置</span>
                  ) : isFailed ? (
                    <span className="section-mini-tag tag-rose" style={{ fontSize: '10px' }}>不可用</span>
                  ) : hasImageModel ? (
                    <span className="section-mini-tag tag-purple" style={{ fontSize: '10px' }}>已授权可用</span>
                  ) : (
                    <span className="section-mini-tag tag-blue" style={{ fontSize: '10px' }}>配置已保留（未在列表中）</span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '3px' }}>可用模型令牌池</span>
                  {poolContent}
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'probe'}
                  onClick={probe}
                  style={{ padding: '7px 14px', fontSize: '13px' }}
                >
                  {busy === 'probe' ? '正在检测…' : '重新检测模型网关'}
                </button>
              </div>
            </article>
              );
            })()}

            <article className="platform-panel pastel-card reference-section section-teal" style={{ padding: '20px' }}>
              <div className="card-header-row" style={{ marginBottom: '14px' }}>
                <div className="header-left">
                  <span className="section-mini-tag tag-teal">DATA QUALITY</span>
                  <h3 style={{ margin: 0 }}>数据地图建设进度</h3>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { done: Boolean(coverage.accounts), text: '配置各聚光主账户与子账户' },
                  { done: Boolean(coverage.endpoints), text: '登记账户级报表接口和请求参数' },
                  { done: Boolean(coverage.bindings), text: '完成原始字段到标准指标映射' },
                  { done: Boolean(data.keystone.configured && data.keystone.textModels?.includes(data.keystone.textModel)), text: `验证 ${data.keystone.textModel} 文本推理` },
                  { done: Boolean(data.keystone.configured && data.keystone.imageModels?.includes(data.keystone.imageModel)), text: `验证 ${data.keystone.imageModel} 生图模型` },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: item.done ? '#0f172a' : '#64748b' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: item.done ? '#dcfce7' : '#f1f5f9', color: item.done ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                      {item.done ? '✓' : (idx + 1)}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}

      {tab !== 'overview' && (
        <MapList
          tab={tab}
          data={data}
          edit={(entity, row) => setEditor({ entity, row })}
          remove={remove}
        />
      )}

      {editor && (
        <EntityEditor
          editor={editor}
          setEditor={setEditor}
          data={data}
          save={save}
          busy={busy}
        />
      )}
    </div>
  );
}

function MapList({
  tab,
  data,
  edit,
  remove,
}: {
  tab: string;
  data: MapData;
  edit: (entity: string, row: Row) => void;
  remove: (entity: string, row: Row) => void;
}) {
  const cfg: Record<
    string,
    { entity: string; title: string; rows: Row[]; cols: Array<[string, string]> }
  > = {
    accounts: {
      entity: 'account',
      title: '业务账户',
      rows: data.accounts,
      cols: [
        ['name', '账户名称'],
        ['externalId', '外部ID'],
        ['accountType', '账户类型'],
        ['status', '状态'],
        ['updatedAt', '更新时间'],
      ],
    },
    endpoints: {
      entity: 'endpoint',
      title: '接口目录',
      rows: data.endpoints,
      cols: [
        ['name', '接口名称'],
        ['method', '方法'],
        ['path', '路径'],
        ['category', '分类'],
        ['enabled', '启用'],
      ],
    },
    metrics: {
      entity: 'metric',
      title: '标准指标字典',
      rows: data.metrics,
      cols: [
        ['name', '指标'],
        ['key', '标准 Key'],
        ['unit', '单位'],
        ['aggregation', '聚合'],
        ['aliasesJson', '别名'],
      ],
    },
    bindings: {
      entity: 'binding',
      title: '字段与指标映射',
      rows: data.bindings,
      cols: [
        ['metricName', '标准指标'],
        ['sourceName', '数据源'],
        ['endpointName', '接口'],
        ['sourceField', '原始字段'],
        ['dimensionsJson', '维度'],
      ],
    },
    assets: {
      entity: 'asset',
      title: 'Agent 附件资产',
      rows: data.assets,
      cols: [
        ['fileName', '文件'],
        ['contentType', '类型'],
        ['size', '大小'],
        ['status', '状态'],
        ['createdAt', '上传时间'],
      ],
    },
  };

  const c = cfg[tab];
  if (!c) return null;

  return (
    <section className="map-list pastel-card reference-section section-blue">
      <div className="intel-card-head">
        <div>
          <small>CATALOG</small>
          <h2>{c.title}</h2>
        </div>
        {c.entity !== 'asset' && (
          <button onClick={() => edit(c.entity, {})}>
            ＋ 新增{entityLabels[c.entity]}
          </button>
        )}
      </div>
      <div className="ops-table-wrap" style={{ marginTop: '14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {c.cols.map((x) => (
                <th key={x[0]} style={{ whiteSpace: 'nowrap', textAlign: 'left', padding: '12px 14px', background: '#f8fafc', color: '#475569', fontSize: '12.5px', borderBottom: '1px solid #e2e8f0' }}>
                  {x[1]}
                </th>
              ))}
              <th style={{ whiteSpace: 'nowrap', textAlign: 'right', padding: '12px 14px', background: '#f8fafc', color: '#475569', fontSize: '12.5px', borderBottom: '1px solid #e2e8f0', width: '120px' }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {c.rows.length > 0 ? (
              c.rows.map((row) => (
                <tr key={String(row.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {c.cols.map(([key]) => (
                    <td key={key} style={{ padding: '12px 14px', fontSize: '13px', color: '#1e293b' }}>
                      {key === 'size' ? (
                        size(row[key])
                      ) : key.includes('At') ? (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>{cnTime(String(row[key]))}</span>
                      ) : key === 'enabled' ? (
                        <span className={`section-mini-tag tag-${Number(row[key]) ? 'green' : 'gray'}`} style={{ fontSize: '11px' }}>
                          {Number(row[key]) ? '是' : '否'}
                        </span>
                      ) : key === 'path' ? (
                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#0369a1' }}>
                          {shown(row[key])}
                        </code>
                      ) : (
                        shown(row[key])
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.entity !== 'asset' && (
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => edit(c.entity, { ...row })}
                          style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => remove(c.entity, row)}
                          style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', cursor: 'pointer' }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={c.cols.length + 1} style={{ padding: '32px 0' }}>
                  <EmptyState title={'尚未配置' + c.title} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EntityEditor({
  editor,
  setEditor,
  data,
  save,
  busy,
}: {
  editor: { entity: string; row: Row };
  setEditor: (v: { entity: string; row: Row } | null) => void;
  data: MapData;
  save: () => void;
  busy: string;
}) {
  const r = editor.row;
  const set = (k: string, v: unknown) =>
    setEditor({ entity: editor.entity, row: { ...r, [k]: v } });
  const field = (label: string, key: string, placeholder = '') => (
    <label>
      {label}
      <input
        value={String(r[key] || '')}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <div className="entity-backdrop" onMouseDown={() => setEditor(null)}>
      <section className="entity-editor" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <div>
            <small>DATA MAP CRUD</small>
            <h2>
              {r.id ? '编辑' : '新增'}
              {entityLabels[editor.entity]}
            </h2>
          </div>
          <button onClick={() => setEditor(null)}>×</button>
        </header>
        <div className="entity-form">
          {editor.entity === 'account' && (
            <>
              {field('账户名称', 'name', '例如：启萃聚光主账户')}
              {field('外部账户 ID', 'externalId')}
              {field('账户类型', 'accountType', 'main_account / sub_account')}
              <label>
                关联工具
                <select
                  value={String(r.integrationId || '')}
                  onChange={(e) => set('integrationId', e.target.value)}
                >
                  <option value="">未绑定</option>
                  {data.integrations.map((x) => (
                    <option key={String(x.id)} value={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </select>
              </label>
              {field('状态', 'status', '未检测')}
              <label className="full">
                账户元数据 JSON
                <textarea
                  value={String(r.metadataJson || '{}')}
                  onChange={(e) => set('metadataJson', e.target.value)}
                />
              </label>
            </>
          )}

          {editor.entity === 'endpoint' && (
            <>
              {field('接口名称', 'name')}
              {field('接口 Key', 'key', 'account_daily_report')}
              <label>
                请求方法
                <select
                  value={String(r.method || 'GET')}
                  onChange={(e) => set('method', e.target.value)}
                >
                  <option>GET</option>
                  <option>POST</option>
                </select>
              </label>
              {field('请求路径', 'path', '/v1/report/account/daily')}
              {field('业务分类', 'category', '账户日报')}
              <label className="full">
                用途说明
                <textarea
                  value={String(r.description || '')}
                  onChange={(e) => set('description', e.target.value)}
                />
              </label>
              <label className="full">
                参数 Schema JSON
                <textarea
                  value={String(r.parameterSchema || '{}')}
                  onChange={(e) => set('parameterSchema', e.target.value)}
                />
              </label>
            </>
          )}

          {editor.entity === 'metric' && (
            <>
              {field('指标名称', 'name', '新增种草人数')}
              {field('标准 Key', 'key', 'seed_users')}
              {field('单位', 'unit', '人')}
              <label>
                聚合方式
                <select
                  value={String(r.aggregation || 'sum')}
                  onChange={(e) => set('aggregation', e.target.value)}
                >
                  <option value="sum">求和</option>
                  <option value="ratio">比率</option>
                  <option value="avg">平均</option>
                  <option value="latest">最新值</option>
                </select>
              </label>
              {field('公式', 'formula', '例如：spend / seed_users')}
              <label className="full">
                别名 JSON
                <textarea
                  value={String(r.aliasesJson || '[]')}
                  onChange={(e) => set('aliasesJson', e.target.value)}
                />
              </label>
            </>
          )}

          {editor.entity === 'binding' && (
            <>
              <label>
                标准指标
                <select
                  value={String(r.metricId || '')}
                  onChange={(e) => set('metricId', e.target.value)}
                >
                  <option value="">请选择</option>
                  {data.metrics.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                数据源
                <select
                  value={String(r.sourceId || '')}
                  onChange={(e) => set('sourceId', e.target.value)}
                >
                  <option value="">未绑定</option>
                  {data.sources.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                接口
                <select
                  value={String(r.endpointId || '')}
                  onChange={(e) => set('endpointId', e.target.value)}
                >
                  <option value="">未绑定</option>
                  {data.endpoints.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </select>
              </label>
              {field('原始字段', 'sourceField', 'total_cost')}
              {field('维度 JSON', 'dimensionsJson', '["date","account_id"]')}
              {field('转换 JSON', 'transformJson', '{"scale":1}')}
            </>
          )}
        </div>
        <footer>
          <button onClick={() => setEditor(null)}>取消</button>
          <button className="save" disabled={busy === 'save'} onClick={save}>
            保存{entityLabels[editor.entity]}
          </button>
        </footer>
      </section>
    </div>
  );
}
