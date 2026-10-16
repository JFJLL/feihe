'use client';
import { Children, Fragment, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { api, ApiError } from '../../lib/hooks/use-project-data';
import { readDashboardLayout, type DashboardLayout } from '../../lib/metrics/query';
import { BUSINESS_COMPONENTS, DEFAULT_BUSINESS_COMPONENTS, businessComponentErrors } from '../../lib/business-components';

type Published = { id: string; version: number; layout: DashboardLayout };
type Choice = { id: string; enabled: boolean };
function choices(ids: string[]): Choice[] { return [...ids.map(id => ({ id, enabled: true })), ...DEFAULT_BUSINESS_COMPONENTS.filter(id => !ids.includes(id)).map(id => ({ id, enabled: false }))]; }
function nodes(children: ReactNode): ReactElement<{ componentId?: string; 'data-business-component'?: string; children?: ReactNode }>[] {
  return Children.toArray(children).flatMap(child => !isValidElement(child) ? [] : child.type === Fragment ? nodes((child.props as { children: ReactNode }).children) : [child as ReactElement<{ componentId?: string; 'data-business-component'?: string; children?: ReactNode }>]);
}
export function BusinessComponentBoard({ projectId, view, canManage, period, children }: { projectId: string; view: 'overview' | 'daily'; canManage: boolean; period: string; children: ReactNode }) {
  const [revision, setRevision] = useState(0), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<{ key: string; value?: Published; error?: string }>({ key: '' });
  const key = JSON.stringify({ projectId, revision }), current = snapshot.key === key ? snapshot : null;
  const published = current?.value, selected = published?.layout.businessComponents ?? DEFAULT_BUSINESS_COMPONENTS;
  const [draft, setDraft] = useState<Choice[]>([]), [base, setBase] = useState<Published | null>(null), [conflict, setConflict] = useState<number | null>(null);
  const locked = useRef(false), alertRef = useRef<HTMLParagraphElement>(null);
  const read = useCallback(async (id?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ projectId }); if (id) params.set('dashboardId', id);
    const response = await api<{ targetDashboardId: string; dashboards: Array<{ id: string; version: number; layoutJson: string }> }>('/api/dashboards?' + params, { signal });
    const row = response.dashboards.find(item => item.id === response.targetDashboardId); if (!row) throw new Error('团队看板不存在');
    const layout = readDashboardLayout(row.layoutJson), validation = layout.businessComponents === undefined ? [] : businessComponentErrors(layout.businessComponents);
    if (validation.length) throw new Error(validation.join('；'));
    return { id: row.id, version: row.version, layout };
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void read(undefined, controller.signal).then(value => { if (active) setSnapshot({ key, value }); }).catch(error => { if (active) setSnapshot({ key, error: error instanceof Error ? error.message : '布局读取失败' }); });
    return () => { active = false; controller.abort(); };
  }, [key, read]);
  useEffect(() => {
    const changed = (event: Event) => {
      const scope = (event as CustomEvent<{ projectId: string }>).detail;
      if (scope?.projectId === projectId && !open && !locked.current) setRevision(value => value + 1);
    };
    window.addEventListener('app:dashboard-changed', changed);
    return () => window.removeEventListener('app:dashboard-changed', changed);
  }, [projectId, open]);
  useEffect(() => { if (error) { alertRef.current?.focus(); alertRef.current?.scrollIntoView({ block: 'nearest' }); } }, [error]);
  function start() { if (!published) return; setBase(published); setDraft(choices(selected)); setError(''); setConflict(null); setOpen(true); }
  function move(index: number, delta: number) { setDraft(previous => { const next = [...previous], target = index + delta; if (target < 0 || target >= next.length) return previous; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  async function reload() {
    if (locked.current || !base) return; locked.current = true; setBusy(true);
    try { setBase(await read(base.id)); setConflict(null); setError('最新看板版本已读取，当前组件选择和顺序保留。再次发布将应用当前选择。'); }
    catch (error) { setError(error instanceof Error ? error.message : '读取最新版本失败'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function publish() {
    if (locked.current || !base) return; locked.current = true; setBusy(true); setError('');
    const submitted = draft.filter(choice => choice.enabled).map(choice => choice.id);
    try {
      const response = await api<{ dashboardId: string; version: number; layout: DashboardLayout }>('/api/dashboards', { method: 'POST', body: JSON.stringify({ projectId, dashboardId: base.id, version: base.version, action: 'set_components', components: submitted }) });
      setSnapshot({ key, value: { id: response.dashboardId, version: response.version, layout: response.layout } }); setOpen(false); setBase(null); setConflict(null);
      window.dispatchEvent(new CustomEvent('app:dashboard-changed', { detail: { projectId, dashboardId: response.dashboardId, version: response.version } }));
    } catch (error) { setError(error instanceof Error ? error.message : '组件布局发布失败'); if (error instanceof ApiError && error.status === 409) setConflict(Number(error.data?.serverVersion) || null); }
    finally { locked.current = false; setBusy(false); }
  }
  const elements = nodes(children), id = (element: typeof elements[number]) => element.props.componentId || element.props['data-business-component'];
  const available = new Map(elements.filter(element => id(element)).map(element => [id(element), element]));
  return <div className="stack data-workspace" data-testid={'business-component-board-' + view}>
    <div className="data-actions"><p>业务分析截至 {period || '待同步'}，沿用现有日报与季度口径。下方项目指标使用各自已标明的周期与筛选。</p>{canManage && <button className="secondary" disabled={!published} onClick={start}>配置业务组件布局</button>}</div>
    {current?.error ? <ErrorState error={current.error} onRetry={() => setRevision(value => value + 1)} /> : !published ? <LoadingState text="正在读取团队业务布局…" /> : <div className="overview-block-content" data-component-order={selected.filter(componentId => available.has(componentId)).join(',')}>
      {elements.filter(element => !id(element))}
      {selected.filter(componentId => available.has(componentId)).map(componentId => <Fragment key={componentId}>{available.get(componentId)}</Fragment>)}
      {!selected.some(componentId => available.has(componentId)) && <p>本视图未选择业务组件。项目指标仍可在下方查看；有权成员可重新配置组件布局。</p>}
    </div>}
    {open && <Dialog title="团队业务组件布局" onClose={() => { if (!busy) setOpen(false); }} footer={<><button className="secondary" disabled={busy} onClick={() => setOpen(false)}>取消布局修改</button><button className="primary" disabled={busy || conflict !== null} onClick={() => void publish()}>{busy ? '正在处理…' : '发布业务组件布局'}</button></>}>
      <p>选择团队显示的既有业务组件，并用上下按钮调整顺序。保留数据、业务规则、目标和项目指标。日报与总览共用此配置。</p>
      {error && <p role="alert" tabIndex={-1} ref={alertRef}>{error}</p>}
      {conflict !== null && <button className="secondary" disabled={busy} onClick={() => void reload()}>读取最新布局版本并保留选择（服务端 v{conflict}）</button>}
      <div inert={busy}>{draft.map((choice, index) => { const component = BUSINESS_COMPONENTS.find(item => item.id === choice.id)!; return <div className="business-component-choice" key={choice.id}>
        <label><input type="checkbox" aria-label={'显示' + component.title} checked={choice.enabled} onChange={event => setDraft(previous => previous.map(item => item.id === choice.id ? { ...item, enabled: event.target.checked } : item))} /><span>{component.title}<small>{component.view === 'daily' ? '日报' : '总览'}</small></span></label>
        <div><button className="secondary" aria-label={'上移' + component.title} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="secondary" aria-label={'下移' + component.title} disabled={index === draft.length - 1} onClick={() => move(index, 1)}>↓</button></div>
      </div>; })}<button className="secondary" onClick={() => setDraft(choices(DEFAULT_BUSINESS_COMPONENTS))}>恢复全部业务组件与默认顺序</button></div>
    </Dialog>}
  </div>;
}
