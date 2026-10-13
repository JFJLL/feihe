'use client';

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import Link from '../../components/ui/AppLink';
import { useProject } from '../../components/project-shell/ProjectContext';
import { SettingsDataSources } from '../settings/data-sources/SettingsDataSources';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import type { Dataset } from '../../lib/datasets';
import type { DataWorkspaceState, DatasetQuality, WorkspaceSource } from '../../lib/types/data-workspace';

type Detail = Dataset & { rows: Record<string, unknown>[]; pagination: { total: number; totalPages: number; page: number } };
const tabs = [
  { id: 'sources', title: '数据源', desc: '接入与维护原表', icon: '🔗' },
  { id: 'datasets', title: '数据集', desc: '数据明细、字段和质量', icon: '▦' },
  { id: 'runs', title: '同步记录', desc: '成功、失败和读取范围', icon: '↻' },
];
const types: Record<string, string> = { number: '数值', text: '文本', date: '日期', boolean: '布尔', category: '分类' };
function display(value: unknown) { return value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? String(value) : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function schedule(source?: WorkspaceSource) {
  if (!source) return '手动导入，没有自动同步来源';
  if (source.isPaused) return '来源已暂停；当前不会同步';
  // A selected frequency is not proof of a running scheduler.
  return '自动同步未启用；当前需手动同步';
}
export function DataWorkspace({ projectId }: { projectId: string }) {
  const { currentProject, workspace, refreshWorkspace, showToast, navigateTo } = useProject();
  const [tab, setTab] = useProjectTab('sources', ['sources', 'datasets', 'runs']);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ projectId: string; value: DataWorkspaceState | null; error: string }>({ projectId: '', value: null, error: '' });
  const state = snapshot.projectId === projectId ? snapshot.value : null;
  const indexError = snapshot.projectId === projectId ? snapshot.error : '';
  const [selected, setSelected] = useState('');
  const datasetId = state?.datasets.find(dataset => dataset.id === selected)?.id || state?.datasets[0]?.id || '';
  const dataset = state?.datasets.find(dataset => dataset.id === datasetId);
  const source = state?.sources.find(item => item.id === dataset?.sourceId);
  const [sourceView, setSourceView] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; value: Detail | null; error: string }>({ key: '', value: null, error: '' });
  const [qualitySnapshot, setQualitySnapshot] = useState<{ key: string; value: DatasetQuality | null; error: string }>({ key: '', value: null, error: '' });
  const detailKey = JSON.stringify({ projectId, datasetId, page, search, revision });
  const detail = detailSnapshot.key === detailKey ? detailSnapshot.value : null;
  const detailError = detailSnapshot.key === detailKey ? detailSnapshot.error : '';
  const qualityKey = JSON.stringify({ projectId, datasetId, revision });
  const quality = qualitySnapshot.key === qualityKey ? qualitySnapshot.value : null;
  const qualityError = qualitySnapshot.key === qualityKey ? qualitySnapshot.error : '';
  const [syncing, setSyncing] = useState('');
  const syncLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController(); let current = true;
    api<DataWorkspaceState>('/api/data-workspace?projectId=' + encodeURIComponent(projectId), { signal: controller.signal })
      .then(value => { if (current) setSnapshot({ projectId, value, error: '' }); })
      .catch(error => { if (current) setSnapshot({ projectId, value: null, error: error instanceof Error ? error.message : '数据工作台加载失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, revision]);
  useEffect(() => {
    if (!datasetId || tab !== 'datasets') return;
    const controller = new AbortController(); let current = true;
    const query = new URLSearchParams({ projectId, id: datasetId, page: String(page), pageSize: '15', search });
    api<{ dataset: Detail }>('/api/datasets?' + query, { signal: controller.signal }).then(result => {
      if (!current) return;
      if (page > result.dataset.pagination.totalPages) { setPage(result.dataset.pagination.totalPages); return; }
      setDetailSnapshot({ key: detailKey, value: result.dataset, error: '' });
    }).catch(error => { if (current) setDetailSnapshot({ key: detailKey, value: null, error: error instanceof Error ? error.message : '数据明细加载失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, datasetId, page, search, revision, detailKey, tab]);
  useEffect(() => {
    if (!qualityOpen || !datasetId || tab !== 'datasets') return;
    const controller = new AbortController(); let current = true;
    const query = new URLSearchParams({ projectId, datasetId });
    api<DataWorkspaceState>('/api/data-workspace?' + query, { signal: controller.signal }).then(result => {
      if (current) setQualitySnapshot({ key: qualityKey, value: result.quality || null, error: '' });
    }).catch(error => { if (current) setQualitySnapshot({ key: qualityKey, value: null, error: error instanceof Error ? error.message : '质量检查失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, datasetId, qualityKey, qualityOpen, tab]);

  async function updated() { await refreshWorkspace(); setRevision(value => value + 1); }
  async function sync(sourceId: string) {
    if (syncLock.current) return; syncLock.current = true; setSyncing(sourceId);
    try {
      await api('/api/feishu/sync', { method: 'POST', body: JSON.stringify({ projectId, sourceId }) });
      showToast('数据已同步', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : '同步失败', 'error'); }
    finally { syncLock.current = false; setSyncing(''); await updated(); }
  }
  function openDataset(id: string) { setSelected(id); setPage(1); setSearch(''); setTab('datasets'); }

  return <div className="stack ops-workspace reference-workspace data-workspace" data-workspace-ui="v2">
    <PageHeader variant="light" title="数据工作台" subtitle="从原表接入，到可核对的项目数据。飞书记录仍在原表编辑。">
      <button className="secondary" onClick={() => setRevision(value => value + 1)}>刷新数据状态</button>
    </PageHeader>
    <WorkspaceModuleTabs tabs={tabs} activeTab={tab} onChange={setTab} variant="compact" />
    <p className="data-scroll-hint">宽表可横向滑动，或聚焦表格后使用左右方向键查看。</p>
    {indexError ? <ErrorState error={indexError} onRetry={() => setRevision(value => value + 1)} /> : !state ? <LoadingState text="正在读取来源、数据集和同步记录…" /> : <>
      {tab === 'sources' && <>
        <section className="platform-panel data-panel">
          <div className="data-actions"><h2>来源与使用关系</h2><CustomSelect ariaLabel="数据源视图" value={sourceView} options={[{ value: 'all', label: '全部来源' }, { value: 'failed', label: '同步失败' }, { value: 'waiting', label: '待首次同步' }]} onChange={setSourceView} /></div>
          {!state.sources.length ? <EmptyState title="尚未接入业务表" text={currentProject?.canManage ? '接入下方飞书数据源后，这里会显示其生成的数据集及使用关系。' : '请联系项目负责人接入业务表。'} /> : <div className="data-table-scroll" tabIndex={0}><table aria-label="来源与使用关系"><thead><tr><th>原表 / 更新方式</th><th>数据集</th><th>正在使用</th><th>状态</th></tr></thead><tbody>{state.sources.filter(item => sourceView === 'all' || (sourceView === 'failed' ? item.lastError : !item.lastSyncedAt)).map(item => <tr key={item.id}>
            <td><strong>{item.name}</strong>{/^https:\/\//.test(item.spreadsheet) && <p><a href={item.spreadsheet} target="_blank" rel="noreferrer">打开飞书原表</a></p>}<p>{schedule(item)}</p>{item.range && <p>有限范围：{item.range}</p>}</td>
            <td>{item.datasetIds.length ? item.datasetIds.map(id => <button key={id} className="secondary" onClick={() => openDataset(id)}>{state.datasets.find(d => d.id === id)?.name || id}</button>) : '尚未生成数据集'}</td>
            <td>{item.uses.length ? item.uses.map(use => <p key={use.kind + use.id}>{use.kind === 'metric' ? '指标' : '看板'}：{use.name}</p>) : '尚未配置指标或卡片'}</td>
            <td>{item.lastError ? <span role="status">同步失败：{item.lastError}</span> : item.lastSyncedAt ? <>已同步 {item.lastRowCount} 行<p>{cnTime(item.lastSyncedAt)}</p></> : '配置已保存 · 待首次同步'}{currentProject?.canWrite && !currentProject?.canManage && <button className="secondary" disabled={Boolean(syncing)} onClick={() => void sync(item.id)}>{syncing === item.id ? '同步中…' : '立即同步'}</button>}</td>
          </tr>)}</tbody></table></div>}
        </section>
        {currentProject?.canManage && !currentProject.isArchived && <SettingsDataSources key={projectId} projectId={projectId} workspace={workspace} onDone={updated} toast={showToast} active={tab === 'sources'} />}
      </>}
      {tab === 'datasets' && <section className="platform-panel data-panel">
        <div className="data-actions"><h2>数据集明细</h2>{state.datasets.length > 0 && <CustomSelect ariaLabel="业务数据集" value={datasetId} options={state.datasets.map(item => ({ value: item.id, label: item.name + ' · ' + item.rowCount + ' 行' }))} onChange={openDataset} />}</div>
        {!dataset ? <EmptyState title="尚未生成数据集" text="只有同步成功或真实导入后，才会出现数据明细。" action={currentProject?.canManage ? <button className="primary" onClick={() => setTab('sources')}>接入业务表</button> : undefined} /> : <>
          <div className="data-context"><p>来源：{source?.name || '手动导入 / 原来源已移除'} · 已入库 {dataset.rowCount} 行 · 数据版本 v{dataset.version}</p><p>数据更新时间：{cnTime(dataset.updatedAt)}</p><p>{schedule(source)}</p>{source?.lastError && <p role="status">最近同步失败，以下保留上一次成功数据：{source.lastError}</p>}
            {source && /^https:\/\//.test(source.spreadsheet) && <a href={source.spreadsheet} target="_blank" rel="noreferrer">在飞书原表修改记录</a>}
          </div>
          <div className="data-actions"><label>搜索数据明细<input aria-label="搜索数据明细" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="在当前数据集中搜索" /></label><button className="secondary" aria-expanded={qualityOpen} onClick={() => setQualityOpen(value => !value)}>字段与质量检查</button><Link className="secondary" href={'/projects/' + encodeURIComponent(projectId)}>查看项目看板</Link></div>
          {qualityOpen && <div className="data-quality">{qualityError ? <ErrorState error={qualityError} onRetry={() => setRevision(value => value + 1)} /> : !quality ? <LoadingState text="正在检查完整数据集…" /> : <><p>已检查完整数据集 {quality.checkedRows} 行</p><p>空值按指标自身规则处理；类型错误不会自动改成0。</p><div className="data-table-scroll" tabIndex={0}><table aria-label="字段质量"><thead><tr><th>字段显示名</th><th>取值键</th><th>类型 / 单位</th><th>空值</th><th>类型错误</th></tr></thead><tbody>{quality.fields.map(field => { const column = dataset.columns.find(item => item.key === field.key); return <tr key={field.key}><td>{field.name}</td><td>{field.key}</td><td>{types[field.type] || field.type}{column?.numericUnit === 'percent' && ' · 百分比（比例存储）'}</td><td>{field.missing}</td><td>{field.invalid}</td></tr>; })}</tbody></table></div></>}</div>}
          {detailError ? <ErrorState error={detailError} onRetry={() => setRevision(value => value + 1)} /> : !detail ? <LoadingState text="正在加载数据明细…" /> : <>
            <div className="data-table-scroll" tabIndex={0}><table aria-label="业务数据明细"><thead><tr>{detail.columns.map(column => <th key={column.key}>{column.name}</th>)}</tr></thead><tbody>{detail.rows.map((row, index) => <tr key={index}>{detail.columns.map(column => <td key={column.key}>{display(row[column.key])}</td>)}</tr>)}</tbody></table></div>
            {!detail.rows.length && <p role="status">当前搜索没有匹配记录。</p>}
            <div className="data-actions"><span>第 {page} / {detail.pagination.totalPages} 页 · 匹配 {detail.pagination.total} 行</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><button className="secondary" disabled={page >= detail.pagination.totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
          </>}
          <h3>正在使用此数据集</h3>{state.uses.filter(use => use.datasetId === datasetId).length ? <ul>{state.uses.filter(use => use.datasetId === datasetId).map(use => <li key={use.kind + use.id}>{use.kind === 'metric' ? '指标' : '看板卡片'}：{use.name}</li>)}</ul> : <p>尚无绑定的指标或卡片。</p>}
          {currentProject?.canManage && !currentProject.isArchived && <button className="secondary" onClick={() => navigateTo('/projects/' + encodeURIComponent(projectId) + '/metrics?new=true&datasetId=' + encodeURIComponent(datasetId))}>创建指标</button>}
        </>}
      </section>}
      {tab === 'runs' && <section className="platform-panel data-panel"><h2>同步记录</h2><p>显示最近100条同步记录。每次同步独立记录结果。失败保留上一次成功数据；只接入配置不代表已经同步。</p>{!state.runs.length ? <EmptyState title="尚无同步记录" text="接入配置后，执行首次同步。" /> : <div className="data-table-scroll" tabIndex={0}><table aria-label="来源同步记录"><thead><tr><th>来源 / 时间</th><th>结果</th><th>读取 / 入库</th><th>读取范围</th><th>说明</th></tr></thead><tbody>{state.runs.map(run => <tr key={run.id}><td>{run.sourceName}<p>{cnTime(run.startedAt)}</p></td><td>{run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '进行中'}</td><td>{run.status === 'failed' && !run.rowsRead ? '读取未完成' : run.rowsRead} / {run.rowsImported}</td><td>{run.scope === 'full_table' ? '完整工作表' : run.scope === 'limited_range' ? '有限范围：' + run.range : '历史范围未记录'}</td><td>{run.errorSummary || (run.rowsFailed ? '有 ' + run.rowsFailed + ' 行未导入' : '已完整发布读取到的批次')}{!run.sourceId && <p>旧记录未保存来源ID</p>}</td></tr>)}</tbody></table></div>}</section>}
    </>}
  </div>;
}
