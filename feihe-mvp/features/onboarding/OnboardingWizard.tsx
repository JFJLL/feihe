'use client';
import { useEffect, useRef, useState } from 'react';
import Link from '../../components/ui/AppLink';
import type { Project } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';
import { useProject } from '../../components/project-shell/ProjectContext';
type Readiness = { completedSteps: string[]; blockedSteps: string[]; memberCount: number; ready: boolean };
export function OnboardingWizard({ projectId, project, role = '', onFinish = async () => {} }: { projectId: string; project?: Project; role?: string; onFinish?: () => Promise<void> }) {
  const { showToast } = useProject();
  const [snapshot, setSnapshot] = useState<{ key: string; role: string; readiness: Readiness } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dismissed, setDismissed] = useState(false);
  const submitting = useRef(false);
  const key = projectId + ':' + (project?.updatedAt || '');
  useEffect(() => {
    const controller = new AbortController();
    api<{ projectRole: string; readiness: Readiness }>('/api/projects?projectId=' + encodeURIComponent(projectId), { signal: controller.signal })
      .then(detail => { if (!controller.signal.aborted) { setSnapshot({ key, role: detail.projectRole, readiness: detail.readiness }); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '首次设置读取失败'); });
    return () => controller.abort();
  }, [key, projectId]);
  const current = snapshot?.key === key ? snapshot : null;
  const canManage = (current?.role || role) === 'project_admin' || (current?.role || role) === 'platform_admin';
  if (project?.onboardingStatus === 'ready' || dismissed) return null;
  if (!canManage) return <section className="integration-onboarding-note" aria-label="工作台准备状态"><strong>工作台待负责人发布</strong><p>您可以查看已有结果。接入数据和发布工作台由{project?.ownerName || '项目负责人'}完成。</p></section>;
  const steps = current?.readiness.completedSteps || [];
  const dataReady = steps.includes('first_sync'), metricsReady = steps.includes('metrics');
  const teamReady = steps.includes('members') || steps.includes('skip:members');
  const next = !dataReady ? '接入自己的业务表' : !metricsReady ? '确认指标与第一份看板' : !teamReady ? '选择团队协作或先单人试用' : '发布团队工作台';
  async function update(skipOnly = false) {
    if (submitting.current || !current || (!skipOnly && !current.readiness.ready)) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const completedSteps = skipOnly ? [...steps, 'skip:members'] : steps;
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ action: 'update_onboarding', projectId, onboardingStatus: skipOnly ? (project?.onboardingStatus || 'source') : 'ready', completedSteps }) });
      if (skipOnly) {
        const detail = await api<{ projectRole: string; readiness: Readiness }>('/api/projects?projectId=' + encodeURIComponent(projectId));
        setSnapshot({ key, role: detail.projectRole, readiness: detail.readiness });
        showToast('已选择单人试用，之后可随时添加团队成员', 'info');
      } else { showToast('工作台已发布，团队可以开始使用', 'success'); await onFinish(); }
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="integration-onboarding" aria-label="首次设置">
    <div className="integration-page-heading"><div><small>首次设置 · {project?.templateName || '通用数据工作台'}</small><h2>下一步：{next}</h2><p>{!dataReady ? '保留飞书原表，不必添加任务、预算或负责人列。接入后按实际字段选择适用的分析。' : !metricsReady ? '先得到可核对的指标，再选择趋势、分组或明细。已有设置会保留。' : '发布后进入日常工作界面，成员可以查看同一份结果。'}</p></div>
      {!dataReady ? <Link className="primary" href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=data-sources'}>接入飞书数据源 →</Link> : !metricsReady ? <button className="primary" onClick={() => window.dispatchEvent(new CustomEvent('workbench:configure', { detail: { projectId } }))}>查看看板与配置 →</button> : null}
    </div>
    {error && <p role="alert" className="integration-error">{error}</p>}
    <div className="integration-actions">
      {current?.readiness.memberCount === 1 && !teamReady && <button type="button" disabled={busy} onClick={() => void update(true)}>单人跳过</button>}
      {canManage && <button type="button" className={current?.readiness.ready ? 'primary' : ''} disabled={busy || !current?.readiness.ready} onClick={() => void update()}>{busy ? '正在发布…' : '完成初始化（发布项目）'}</button>}
      <button type="button" disabled={busy} onClick={() => setDismissed(true)}>稍后配置</button>
    </div>
    <details><summary>查看设置进度与团队选项</summary><ol className="integration-setup-checklist">
      <li>基本资料与业务方向：{steps.includes('template') ? '已完成' : '待确认'}</li>
      <li>业务数据：{steps.includes('source') ? dataReady ? '已同步' : '待首次同步' : '待接入'} <Link href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=data-sources'}>检查数据</Link></li>
      <li>指标与看板：{metricsReady ? '已完成' : '待确认'}</li>
      <li>团队：{steps.includes('members') ? '已添加成员' : steps.includes('skip:members') ? '已选择单人试用' : '选填，允许单人试用'} <Link href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=members'}>管理团队成员 →</Link></li>
    </ol></details>
  </section>;
}
