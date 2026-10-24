'use client';

import { useState, useMemo } from 'react';
import Link from '../../../components/ui/AppLink';
import { Dialog } from '../../../components/ui/Dialog';
import { StyledSelect } from '../../../components/ui/StyledSelect';
import type { MapData, Keystone, Row } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
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
    const label = entityLabels[editor.entity] || '配置';
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
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
      setBusy('');
      return;
    }

    setEditor(null);
    setBusy('');
    toast(label + '已保存', 'success');

    try {
      await reload();
    } catch (e) {
      toast(label + '已保存，但刷新列表失败：' + (e instanceof Error ? e.message : '未知异常'), 'error');
    }
  }

  // Delete modal states
  const [pendingDelete, setPendingDelete] = useState<{ entity: string; row: Row } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function requestDelete(entity: string, row: Row) {
    if (isDeleting) return;
    setPendingDelete({ entity, row });
    setDeleteError(null);
  }

  function handleCancelDelete() {
    if (isDeleting) return; // Busy protection
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api('/api/data-map', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          entity: pendingDelete.entity,
          projectId,
          id: pendingDelete.row.id,
          name: pendingDelete.row.name,
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败';
      setDeleteError(msg);
      toast(msg, 'error');
      setIsDeleting(false);
      return;
    }

    setPendingDelete(null);
    setIsDeleting(false);
    toast('已删除', 'success');

    try {
      await reload();
    } catch (e) {
      toast('已删除，但刷新列表失败：' + (e instanceof Error ? e.message : '未知异常'), 'error');
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
    <article
      className="platform-panel"
      style={{
        background: 'var(--ws-surface, #ffffff)',
        border: '0.5px solid var(--slate-6, #d9d9e0)',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
            数据来源、业务指标与映射关系
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
            从项目数据源追溯到账户、接口与标准指标。已登记配置数量统计见下方，实际连接状态以检测结果为准。
          </p>
        </div>
        <Link
          href={`/projects/${encodeURIComponent(projectId)}/settings?tab=integrations`}
          style={{ padding: '6px 14px', borderRadius: 'var(--ws-radius-control, 8px)', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: 12, fontWeight: 500, textDecoration: 'none', border: '0.5px solid var(--slate-6, #d9d9e0)' }}
        >
          工具与接口集成 ↗
        </Link>
      </div>

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
          <section
            aria-label="数据地图登记概况"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 16,
              padding: '14px 18px',
              background: 'var(--slate-2, #f9f9fb)',
              borderRadius: 'var(--ws-radius-control, 8px)',
              border: '0.5px solid var(--slate-6, #d9d9e0)',
            }}
          >
            {[
              { key: 'sources', label: '数据源与集成', count: coverage.sources, note: '已登记' },
              { key: 'accounts', label: '业务账户', count: coverage.accounts, note: '已登记' },
              { key: 'endpoints', label: '业务接口', count: coverage.endpoints, note: '登记数≠连接正常' },
              { key: 'metrics', label: '标准指标', count: coverage.metrics, note: '已登记' },
              { key: 'bindings', label: '字段映射', count: coverage.bindings, note: '已登记' },
            ].map((item) => (
              <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>
                  {item.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--slate-12, #1c2024)', lineHeight: 1.2 }}>
                    {item.count}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--slate-11, #60646c)' }}>项</span>
                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 4, background: 'var(--slate-3, #f0f0f3)', color: 'var(--slate-11, #60646c)', marginLeft: 'auto' }}>
                    {item.note}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="platform-split" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            {(() => {
              const k = data.keystone;
              const isConfigured = Boolean(k.configured);
              const isFailed = k.status === '连接失败' || Boolean(k.error);
              const hasTextModel = Boolean(k.textModels?.includes(k.textModel));
              const hasImageModel = Boolean(k.imageModels?.includes(k.imageModel));

              let statusColor = 'var(--slate-9, #8b8d98)';
              let statusText = k.status || '未配置密钥';
              if (!isConfigured) {
                statusColor = 'var(--slate-9, #8b8d98)';
                statusText = k.status || '未配置密钥';
              } else if (isFailed) {
                statusColor = 'var(--red-9, #e5484d)';
                statusText = k.error ? `连接失败 (${k.error})` : '连接失败';
              } else if (hasTextModel) {
                statusColor = 'var(--jade-11, #208368)';
                statusText = k.status || '文本与生图模型可用';
              } else {
                statusColor = 'var(--amber-11, #ab6400)';
                statusText = k.status || '已连接 · 目标模型待验证';
              }

              let poolContent: React.ReactNode;
              if (!isConfigured) {
                poolContent = <span style={{ color: 'var(--slate-9, #8b8d98)' }}>未配置网关密钥</span>;
              } else if (isFailed) {
                poolContent = <span style={{ color: 'var(--red-9, #e5484d)' }}>连接失败：{k.error || '无法获取模型列表'}</span>;
              } else if (!k.models || k.models.length === 0) {
                poolContent = <span style={{ color: 'var(--amber-11, #ab6400)' }}>已连接但可用模型列表为空</span>;
              } else {
                poolContent = <span style={{ color: 'var(--slate-12, #1c2024)' }}>{k.models.join(', ')}</span>;
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, background: 'var(--slate-2, #f9f9fb)', padding: 14, borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--slate-6, #d9d9e0)', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--slate-11, #60646c)', display: 'block', marginBottom: '3px' }}>Base URL</span>
                  <code style={{ color: 'var(--slate-12, #1c2024)', wordBreak: 'break-all' }}>{k.baseUrl}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-11, #60646c)', display: 'block', marginBottom: '3px' }}>文本推理模型</span>
                  <strong style={{ color: 'var(--slate-12, #1c2024)' }}>{k.textModel}</strong>{' '}
                  {!isConfigured ? (
                    <span className="section-mini-tag" style={{ fontSize: 12, background: 'var(--slate-3, #f0f0f3)', color: 'var(--slate-11, #60646c)', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>未配置</span>
                  ) : isFailed ? (
                    <span className="section-mini-tag tag-rose" style={{ fontSize: 12 }}>不可用</span>
                  ) : hasTextModel ? (
                    <span className="section-mini-tag tag-green" style={{ fontSize: 12 }}>已验证可用</span>
                  ) : (
                    <span className="section-mini-tag tag-amber" style={{ fontSize: 12 }}>待验证（未在列表中）</span>
                  )}
                </div>
                <div>
                  <span style={{ color: 'var(--slate-11, #60646c)', display: 'block', marginBottom: '3px' }}>生图模型</span>
                  <strong style={{ color: 'var(--slate-12, #1c2024)' }}>{k.imageModel}</strong>{' '}
                  {!isConfigured ? (
                    <span className="section-mini-tag" style={{ fontSize: 12, background: 'var(--slate-3, #f0f0f3)', color: 'var(--slate-11, #60646c)', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>未配置</span>
                  ) : isFailed ? (
                    <span className="section-mini-tag tag-rose" style={{ fontSize: 12 }}>不可用</span>
                  ) : hasImageModel ? (
                    <span className="section-mini-tag tag-purple" style={{ fontSize: 12 }}>已授权可用</span>
                  ) : (
                    <span className="section-mini-tag tag-blue" style={{ fontSize: 12 }}>配置已保留（未在列表中）</span>
                  )}
                </div>
                <div>
                  <span style={{ color: 'var(--slate-11, #60646c)', display: 'block', marginBottom: '3px' }}>可用模型令牌池</span>
                  {poolContent}
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'probe'}
                  onClick={probe}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {busy === 'probe' ? '正在检测…' : '重新检测模型网关'}
                </button>
              </div>
            </article>
              );
            })()}

            <article className="platform-panel" style={{ background: 'var(--ws-surface, #ffffff)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: 'var(--ws-radius-card, 12px)', padding: 20 }}>
              <div className="card-header-row" style={{ marginBottom: '14px' }}>
                <div className="header-left">
                  <h3 style={{ margin: 0 }}>数据地图建设进度</h3>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { done: Boolean(coverage.accounts), text: '配置各聚光主账户与子账户' },
                  { done: Boolean(coverage.endpoints), text: '登记账户级报表接口和请求参数' },
                  { done: Boolean(coverage.bindings), text: '完成原始字段到标准指标映射' },
                  { done: Boolean(data.keystone.configured && data.keystone.textModels?.includes(data.keystone.textModel)), text: `验证 ${data.keystone.textModel} 文本推理` },
                  { done: Boolean(data.keystone.configured && data.keystone.imageModels?.includes(data.keystone.imageModel)), text: `验证 ${data.keystone.imageModel} 生图模型` },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: item.done ? 'var(--slate-12, #1c2024)' : 'var(--slate-11, #60646c)' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: item.done ? 'var(--jade-3, #e6f7ed)' : 'var(--slate-3, #f0f0f3)', color: item.done ? 'var(--jade-11, #208368)' : 'var(--slate-9, #8b8d98)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
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
          requestDelete={requestDelete}
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

      {/* Delete Confirmation Dialog */}
      {pendingDelete && (
        <Dialog
          open={Boolean(pendingDelete)}
          title={`确认删除${entityLabels[pendingDelete.entity] || ''}“${shown(pendingDelete.row.name || pendingDelete.row.key || pendingDelete.row.id)}”？`}
          width={460}
          onClose={handleCancelDelete}
          footer={
            <>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCancelDelete}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: '0.5px solid var(--slate-6, #d9d9e0)',
                  background: 'var(--ws-surface, #ffffff)',
                  color: 'var(--slate-12, #1c2024)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: 'none',
                  background: 'var(--red-9, #e5484d)',
                  color: '#ffffff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {isDeleting ? '正在删除…' : '确认删除'}
              </button>
            </>
          }
        >
          <p style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--slate-11, #60646c)', lineHeight: 1.5 }}>
            删除后，当前项目的该{entityLabels[pendingDelete.entity] || '项'}将被移除，依赖此映射或接口的看板与分析计算可能会受影响。
          </p>
          {deleteError && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--red-3, #feebec)', color: 'var(--red-11, #ce2c31)', borderRadius: 'var(--ws-radius-control, 8px)', fontSize: 12, border: '0.5px solid var(--red-6, #fdbdbe)' }}>
              删除失败：{deleteError}
            </div>
          )}
        </Dialog>
      )}
    </article>
  );
}

function MapList({
  tab,
  data,
  edit,
  requestDelete,
}: {
  tab: string;
  data: MapData;
  edit: (entity: string, row: Row) => void;
  requestDelete: (entity: string, row: Row) => void;
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
      <div className="ops-table-wrap" style={{ marginTop: '14px', background: 'var(--ws-surface, #ffffff)', borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--slate-6, #d9d9e0)', overflowX: 'auto' }}>
        <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {c.cols.map((x) => (
                <th key={x[0]} style={{ whiteSpace: 'nowrap', textAlign: 'left', padding: '12px 14px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-11, #60646c)', fontSize: 12, borderBottom: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                  {x[1]}
                </th>
              ))}
              <th style={{ whiteSpace: 'nowrap', textAlign: 'right', padding: '12px 14px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-11, #60646c)', fontSize: 12, borderBottom: '0.5px solid var(--slate-6, #d9d9e0)', width: '120px' }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {c.rows.length > 0 ? (
              c.rows.map((row) => (
                <tr key={String(row.id)} style={{ borderBottom: '0.5px solid var(--slate-4, #e8e8ec)' }}>
                  {c.cols.map(([key]) => (
                    <td key={key} style={{ padding: '12px 14px', fontSize: 12, color: 'var(--slate-12, #1c2024)' }}>
                      {key === 'size' ? (
                        size(row[key])
                      ) : key.includes('At') ? (
                        <span style={{ color: 'var(--slate-11, #60646c)', fontSize: '12px' }}>{cnTime(String(row[key]))}</span>
                      ) : key === 'enabled' ? (
                        <span className={`section-mini-tag tag-${Number(row[key]) ? 'green' : 'gray'}`} style={{ fontSize: 12 }}>
                          {Number(row[key]) ? '是' : '否'}
                        </span>
                      ) : key === 'path' ? (
                        <code style={{ background: 'var(--slate-3, #f0f0f3)', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: 'var(--teal-11, #008573)' }}>
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
                          style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '0.5px solid var(--slate-6, #d9d9e0)', background: 'var(--ws-surface, #ffffff)', color: 'var(--slate-12, #1c2024)', cursor: 'pointer' }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => requestDelete(c.entity, row)}
                          style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '0.5px solid var(--red-6, #fdbdbe)', background: 'var(--red-3, #feebec)', color: 'var(--red-11, #ce2c31)', cursor: 'pointer' }}
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
                <StyledSelect
                  value={String(r.integrationId || '')}
                  onChange={(e) => set('integrationId', e.target.value)}
                  aria-label="关联工具"
                >
                  <option value="">未绑定</option>
                  {data.integrations.map((x) => (
                    <option key={String(x.id)} value={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </StyledSelect>
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
                <StyledSelect
                  value={String(r.method || 'GET')}
                  onChange={(e) => set('method', e.target.value)}
                  aria-label="请求方法"
                >
                  <option>GET</option>
                  <option>POST</option>
                </StyledSelect>
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
                <StyledSelect
                  value={String(r.aggregation || 'sum')}
                  onChange={(e) => set('aggregation', e.target.value)}
                  aria-label="聚合方式"
                >
                  <option value="sum">求和</option>
                  <option value="ratio">比率</option>
                  <option value="avg">平均</option>
                  <option value="latest">最新值</option>
                </StyledSelect>
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
                <StyledSelect
                  value={String(r.metricId || '')}
                  onChange={(e) => set('metricId', e.target.value)}
                  aria-label="标准指标"
                >
                  <option value="">请选择</option>
                  {data.metrics.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </StyledSelect>
              </label>
              <label>
                数据源
                <StyledSelect
                  value={String(r.sourceId || '')}
                  onChange={(e) => set('sourceId', e.target.value)}
                  aria-label="数据源"
                >
                  <option value="">未绑定</option>
                  {data.sources.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </StyledSelect>
              </label>
              <label>
                接口
                <StyledSelect
                  value={String(r.endpointId || '')}
                  onChange={(e) => set('endpointId', e.target.value)}
                  aria-label="接口"
                >
                  <option value="">未绑定</option>
                  {data.endpoints.map((x) => (
                    <option value={String(x.id)} key={String(x.id)}>
                      {shown(x.name)}
                    </option>
                  ))}
                </StyledSelect>
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
