'use client';

import { useState, useEffect, useRef } from 'react';
import { useProject } from '../../components/project-shell/ProjectContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CardEditModal, type DashboardCardConfig } from '../overview/CardEditModal';
import { SettingsSubNav } from '../settings/SettingsSubNav';
import { api, ApiError } from '../../lib/hooks/use-project-data';
import { useCachedQuery } from '../../lib/hooks/use-cached-query';
import { invalidateQueryCache } from '../../lib/cache/query-cache';
import type { ReusableMetric } from '../../lib/metrics/definitions';
import type { Dataset } from '../../lib/datasets';

type Index = { metrics: ReusableMetric[]; standards: ReusableMetric[]; datasets: Dataset[]; canManage: boolean; canMaintainStandards: boolean };
type Editor = { id: string; metric?: ReusableMetric; standard?: ReusableMetric; config: DashboardCardConfig };
const aggregationNames: Record<string, string> = { count: '记录数量', nonempty_count: '非空数量', distinct_count: '去重数量', sum: '数值合计', avg: '平均值' };
export function MetricWorkspace({ projectId }: { projectId: string }) {
  const { navigateTo, showToast } = useProject();
  const [revision, setRevision] = useState(0), [editor, setEditor] = useState<Editor | null>(null);

  const {
    data: state,
    loading: stateLoading,
    error: stateError,
    refresh: refreshState,
  } = useCachedQuery<Index>({
    url: '/api/metric-definitions',
    projectId,
    params: { projectId, ...(revision > 0 ? { _r: String(revision) } : {}) },
    staleTime: 60 * 1000,
    ttl: 15 * 60 * 1000,
  });

  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [standardEditor, setStandardEditor] = useState<ReusableMetric | null>(null), [standardSource, setStandardSource] = useState('');
  const [standardBusy, setStandardBusy] = useState(false), [standardError, setStandardError] = useState('');
  const initialIntent = useRef(false), publishLock = useRef(false);
  function start(metric?: ReusableMetric, standard?: ReusableMetric, datasetId?: string) {
    setConflictVersion(null);
    const dataset = state?.datasets.find(item => item.id === datasetId) || state?.datasets[0];
    const config = metric?.config || standard?.config || { title: '新增指标', type: 'metric_card', mode: 'custom', metric: 'custom', aggregation: 'count', missingPolicy: 'skip', format: 'number', displayOrigin: 'auto', dateField: dataset?.columns.find(column => column.type === 'date')?.key };
    setEditor({ id: metric?.id || projectId + ':metric:' + crypto.randomUUID(), metric, standard,
      config: { ...config, title: metric?.name || standard?.name || '新增指标', datasetId: metric?.config.datasetId || dataset?.id } as DashboardCardConfig });
  }
  useEffect(() => {
    if (!state?.canManage || initialIntent.current) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get('new') === 'true') {
      const timer = window.setTimeout(() => {
        initialIntent.current = true;
        const dataset = state.datasets.find(item => item.id === query.get('datasetId')) || state.datasets[0];
        setEditor({ id: projectId + ':metric:' + crypto.randomUUID(), config: { title: '新增指标', type: 'metric_card', datasetId: dataset?.id, aggregation: 'count', metric: 'custom', mode: 'custom', displayOrigin: 'auto', missingPolicy: 'skip', format: 'number', dateField: dataset?.columns.find(column => column.type === 'date')?.key } });
        window.history.replaceState(null, '', '/projects/' + encodeURIComponent(projectId) + '/metrics');
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state, projectId]);
  async function save(config: DashboardCardConfig) {
    if (!editor) return;
    try { await api('/api/metric-definitions', { method: 'POST', body: JSON.stringify({ action: 'save', projectId, id: editor.id, name: config.title, config,
      expectedVersion: editor.metric?.version || 0, standardId: editor.standard?.id || editor.metric?.standardId, standardVersion: editor.standard?.version || editor.metric?.standardVersion }) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.data?.serverVersion === 'number') setConflictVersion(error.data.serverVersion);
      throw error;
    }
    setEditor(null); setRevision(value => value + 1); showToast('指标已保存；引用它的卡片将按版本策略更新', 'success');
    invalidateQueryCache({ projectId, endpoint: '/api/metric-definitions' });
    invalidateQueryCache({ projectId, endpoint: '/api/metrics' });
    invalidateQueryCache({ projectId, endpoint: '/api/reports' });
    void refreshState({ fresh: true });
  }
  async function readLatest() {
    if (!editor) return; const id = editor.id;
    try {
      const latest = await api<Index>('/api/metric-definitions?projectId=' + encodeURIComponent(projectId));
      const metric = latest.metrics.find(item => item.id === id);
      const standard = latest.standards.find(item => item.id === editor.standard?.id);
      if (!metric && !standard) throw new Error('没有找到可确认的服务端版本');
      void refreshState({ fresh: true });
      setEditor(current => current?.id === id ? { ...current, metric: metric || current.metric, standard: standard || current.standard } : current);
      setConflictVersion(null); showToast('已读取真实服务端版本，当前表单修改仍保留；请核对后再次保存。', 'info');
    } catch (error) { showToast(error instanceof Error ? error.message : '读取最新版本失败', 'error'); }
  }
  async function publish(metric: ReusableMetric) {
    if (publishLock.current) return; publishLock.current = true;
    try {
      await api('/api/metric-definitions', { method: 'POST', body: JSON.stringify({ projectId, action: 'publish_standard', metricId: metric.id }) });
      invalidateQueryCache({ projectId, endpoint: '/api/metric-definitions' });
      invalidateQueryCache({ projectId, endpoint: '/api/metrics' });
      invalidateQueryCache({ projectId, endpoint: '/api/reports' });
      setRevision(value => value + 1);
      void refreshState({ fresh: true });
      showToast('已发布不含来源、数据和周期的标准模板', 'success');
    }
    catch (error) { showToast(error instanceof Error ? error.message : '标准模板保存失败', 'error'); }
    finally { publishLock.current = false; }
  }
  async function updateStandard() {
    if (!standardEditor || !standardSource || publishLock.current) return;
    publishLock.current = true; setStandardBusy(true); setStandardError('');
    try {
      await api('/api/metric-definitions', { method: 'POST', body: JSON.stringify({ projectId, action: 'publish_standard', id: standardEditor.id, name: standardEditor.name, expectedVersion: standardEditor.version, metricId: standardSource }) });
      invalidateQueryCache({ projectId, endpoint: '/api/metric-definitions' });
      invalidateQueryCache({ projectId, endpoint: '/api/metrics' });
      setStandardEditor(null); setRevision(value => value + 1); showToast('标准模板新版本已保存；各项目原绑定保留已确认口径。', 'success');
      void refreshState({ fresh: true });
    } catch (error) { setStandardError(error instanceof Error ? error.message : '标准模板更新失败'); }
    finally { publishLock.current = false; setStandardBusy(false); }
  }
  return <div className="stack ops-workspace reference-workspace data-workspace" data-workspace-ui="v2">
    <PageHeader variant="light" title="项目指标" subtitle="定义一次来源与计算口径，让看板和报告引用同一个指标。">
      {state?.canManage && <button className="primary" disabled={!state.datasets.length} onClick={() => start()}>新建指标</button>}
    </PageHeader>
    <SettingsSubNav activeTab="metrics" />
    {stateError && !state ? <ErrorState error={stateError} onRetry={() => { setRevision(value => value + 1); void refreshState({ fresh: true }); }} /> : !state ? <LoadingState text="正在读取项目指标…" /> : <>
      <section className="platform-panel data-panel"><h2>本项目使用的指标</h2>
        {!state.metrics.length ? <EmptyState compact title="尚未定义共享指标" text={state.datasets.length ? '先定义一个指标；后续卡片只需选择指标与展示方式。' : '先在数据工作台接入业务表。'} /> : <div className="data-table-scroll" tabIndex={0}><table aria-label="项目指标定义"><thead><tr><th>指标</th><th>来源</th><th>口径 / 版本</th><th>使用范围</th><th>操作</th></tr></thead><tbody>{state.metrics.map(metric => <tr key={metric.id}><td>{metric.name}</td><td>{metric.datasetName}</td><td>{metric.standardId ? '标准模板的项目绑定' : '项目私有'} · v{metric.version}<p>{metric.config.aggregation === 'ratio' ? metric.config.ratioBasis === 'independent' ? '独立汇总' : '成对口径' : aggregationNames[metric.config.aggregation || ''] || '自定义口径'}</p></td><td>{metric.impact.cards} 张卡片 · {metric.impact.reports} 份历史报告</td><td>{state.canManage && <><button className="secondary" onClick={() => start(metric)}>编辑指标</button><button className="secondary" onClick={() => navigateTo('/projects/' + encodeURIComponent(projectId) + '/settings?tab=board&addMetric=' + encodeURIComponent(metric.id))}>加入看板</button>{state.canMaintainStandards && <button className="secondary" onClick={() => void publish(metric)}>发布为标准模板</button>}</>}</td></tr>)}</tbody></table></div>}
        <div className="metric-info-banner"><span>ℹ️ 默认卡片跟随指标最新版本；固定版本的卡片与已生成报告保留原口径。同名指标不会自动合并。</span></div>
      </section>
      <section className="platform-panel data-panel"><h2>公司标准模板</h2><div className="metric-info-banner standard-note"><span>ℹ️ 模板只包含计算规则。使用时仍需绑定本项目原表并确认字段；来源授权、客户数据、目标与周期不会复制。</span></div>
        {state.standards.length ? state.standards.map(standard => <div className="data-actions" key={standard.id}><span>{standard.name} · 标准 v{standard.version}</span>{state.canManage && <button className="secondary" onClick={() => start(undefined, standard)}>绑定到本项目</button>}{state.canMaintainStandards && <button className="secondary" disabled={!state.metrics.length} onClick={() => { setStandardEditor(standard); setStandardSource(state.metrics[0]?.id || ''); setStandardError(''); }}>维护标准模板</button>}</div>) : <EmptyState compact title="尚无公司标准模板" text="平台管理员可把已确认的项目指标规则发布为模板。" />}
      </section>
    </>}
    {standardEditor && state && <Dialog title="维护公司标准模板" onClose={() => { if (!standardBusy) setStandardEditor(null); }} footer={<><button disabled={standardBusy} className="secondary" onClick={() => setStandardEditor(null)}>取消</button><button disabled={standardBusy || !standardSource} className="primary" onClick={() => void updateStandard()}>{standardBusy ? '保存中…' : '保存标准新版本'}</button></>}>
      <div inert={standardBusy}><p>{standardEditor.name} · 当前标准 v{standardEditor.version}</p><p>选用本项目已经确认的指标规则。来源、数据和周期仍不复制；已有项目绑定不会自动改变。</p>
      <CustomSelect ariaLabel="标准模板采用的指标" value={standardSource} onChange={setStandardSource} options={state.metrics.map(metric => ({ value: metric.id, label: metric.name + ' · 项目 v' + metric.version }))} />{standardError && <p role="alert">{standardError}</p>}</div>
    </Dialog>}
    {editor && state && <CardEditModal projectId={projectId} initialCard={editor.config} datasets={state.datasets} onClose={() => setEditor(null)} onSave={save} definitionOnly saveRevision={editor.metric?.version || editor.standard?.version || 0} dialogTitle={editor.metric ? '编辑共享指标' : '新建共享指标'} titleLabel="指标名称" saveLabel="保存指标" headerContent={<div>{conflictVersion !== null && <p role="status">服务端当前 v{conflictVersion}。<button className="secondary" onClick={() => void readLatest()}>读取最新版本并保留草稿</button></p>}{editor.metric && <p>当前确认口径：{editor.metric.config.aggregation === 'ratio' ? editor.metric.config.ratioBasis === 'independent' ? '独立汇总' : '成对有效行' : aggregationNames[editor.metric.config.aggregation || '']} · {editor.metric.config.numField || editor.metric.config.field || '记录行数'}{editor.metric.config.denField && ' / ' + editor.metric.config.denField} · v{editor.metric.version}</p>}<p>{editor.metric ? '影响 ' + editor.metric.impact.cards + ' 张看板卡片；跟随最新的卡片采用新口径，历史报告保留生成版本。' : editor.standard ? '正在绑定标准模板 v' + editor.standard.version + '。请确认本项目来源与字段。' : '先确认来源、字段、日期、单位和缺失规则。展示方式在加入看板时选择。'}</p></div>} />}
  </div>;
}
