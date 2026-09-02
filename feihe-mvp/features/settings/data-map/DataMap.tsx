'use client';

import { useState, useMemo } from 'react';
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
  toast: (v: string) => void;
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
      toast(entityLabels[editor.entity] + '已保存');
      setEditor(null);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败');
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
      toast('已删除');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败');
    }
  }

  async function probe() {
    setBusy('probe');
    try {
      const result = await api<Keystone>('/api/data-map', {
        method: 'POST',
        body: JSON.stringify({ action: 'probe_keystone', projectId }),
      });
      toast('Keystone：' + result.status);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '检测失败');
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
      <section className="map-hero">
        <div>
          <small>DATA SEMANTIC LAYER</small>
          <h2>告诉 Agent：数据在哪里、能问什么、口径是什么</h2>
          <p>
            项目 → 数据源 → 账户 → 接口 → 原始字段 → 标准指标。每次生成报告只调用当前需求需要的最小数据集合。
          </p>
        </div>
      </section>

      <nav className="map-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="map-kpis">
            {Object.entries(coverage).map(([k, v]) => (
              <article key={k}>
                <small>
                  {
                    (
                      {
                        sources: '数据能力',
                        accounts: '业务账户',
                        endpoints: '可调用接口',
                        metrics: '标准指标',
                        bindings: '字段映射',
                      } as Record<string, string>
                    )[k]
                  }
                </small>
                <strong>{v}</strong>
                <span>
                  {
                    (
                      {
                        sources: '飞书、RedTrend、Keystone 等',
                        accounts: '品牌/广告子账户',
                        endpoints: '按需调用，避免全量拉取',
                        metrics: '统一跨来源业务口径',
                        bindings: '原始字段到标准指标',
                      } as Record<string, string>
                    )[k]
                  }
                </span>
              </article>
            ))}
          </section>

          <section className="map-flow">
            <div className="intel-card-head">
              <div>
                <small>DATA LINEAGE</small>
                <h2>当前项目的数据链路</h2>
              </div>
              <span>从来源到报告全链追溯</span>
            </div>
            <div className="lineage">
              {[
                ['01', '数据源', coverage.sources, '飞书 / RedTrend / Keystone'],
                ['02', '账户', coverage.accounts, '聚光主账户 / 子账户'],
                ['03', '接口', coverage.endpoints, '按日期、账户、指标调用'],
                ['04', '语义层', coverage.metrics, 'CTR / CPUV / ROI / 舆情'],
                ['05', 'ReportSpec', data.reports.length, '受控组件编译 HTML'],
              ].map(([n, a, b, c]) => (
                <article key={String(a)}>
                  <b>{n}</b>
                  <strong>{a}</strong>
                  <em>{b}</em>
                  <small>{c}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="capability-grid">
            <article>
              <div className="intel-card-head">
                <div>
                  <small>AI GATEWAY</small>
                  <h2>Keystone 模型网关</h2>
                </div>
                <i
                  className={
                    data.keystone.textModels.includes(data.keystone.textModel)
                      ? 'ok'
                      : 'warn'
                  }
                >
                  {data.keystone.status}
                </i>
              </div>
              <dl>
                <div>
                  <dt>Base URL</dt>
                  <dd>{data.keystone.baseUrl}</dd>
                </div>
                <div>
                  <dt>文本推理模型</dt>
                  <dd>
                    {data.keystone.textModel} ·{' '}
                    {data.keystone.textModels.includes(data.keystone.textModel)
                      ? '已验证'
                      : '待验证'}
                  </dd>
                </div>
                <div>
                  <dt>生图模型</dt>
                  <dd>
                    {data.keystone.imageModel} ·{' '}
                    {data.keystone.imageModels.includes(data.keystone.imageModel)
                      ? '当前 Key 已授权'
                      : '配置已保留'}
                  </dd>
                </div>
                <div>
                  <dt>当前文本令牌模型</dt>
                  <dd>{data.keystone.models.join(', ') || '尚未从托管环境读取密钥'}</dd>
                </div>
              </dl>
              <button disabled={busy === 'probe'} onClick={probe}>
                重新检测真实接口
              </button>
            </article>

            <article>
              <div className="intel-card-head">
                <div>
                  <small>DATA QUALITY</small>
                  <h2>数据地图待办</h2>
                </div>
              </div>
              <ul>
                <li>
                  <b>{coverage.accounts ? '✓' : '1'}</b>配置各聚光主账户与子账户
                </li>
                <li>
                  <b>{coverage.endpoints ? '✓' : '2'}</b>登记账户级报表接口和请求参数
                </li>
                <li>
                  <b>{coverage.bindings ? '✓' : '3'}</b>完成原始字段到标准指标映射
                </li>
                <li>
                  <b>
                    {data.keystone.textModels.includes(data.keystone.textModel)
                      ? '✓'
                      : '4'}
                  </b>
                  验证 gpt-5.6-terra 文本推理
                </li>
                <li>
                  <b>✓</b>保留 gpt-image-2 生图模型配置
                </li>
              </ul>
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
    <section className="map-list">
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
      <div className="map-table">
        <div className="map-tr map-th">
          {c.cols.map((x) => (
            <span key={x[0]}>{x[1]}</span>
          ))}
          <span>操作</span>
        </div>
        {c.rows.map((row) => (
          <div className="map-tr" key={String(row.id)}>
            {c.cols.map(([key]) => (
              <span key={key}>
                {key === 'size'
                  ? size(row[key])
                  : key.includes('At')
                  ? cnTime(String(row[key]))
                  : key === 'enabled'
                  ? Number(row[key])
                    ? '是'
                    : '否'
                  : shown(row[key])}
              </span>
            ))}
            <span>
              {c.entity !== 'asset' && (
                <>
                  <button onClick={() => edit(c.entity, { ...row })}>编辑</button>
                  <button className="danger" onClick={() => remove(c.entity, row)}>
                    删除
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {!c.rows.length && <EmptyState title={'尚未配置' + c.title} />}
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
