'use client';

import { useState, useEffect } from 'react';
import Link from '../../components/ui/AppLink';
import type { Project } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';
import { useProject } from '../../components/project-shell/ProjectContext';

interface Step {
  id: string;
  title: string;
  desc: string;
  unlockedAbility: string;
  link: string;
  linkLabel: string;
}

export function OnboardingWizard({
  projectId,
  project,
  role = 'project_admin',
  onFinish = async () => {},
}: {
  projectId: string;
  project?: Project;
  role?: string;
  onFinish?: () => Promise<void>;
}) {
  const { showToast } = useProject();
  const [busy, setBusy] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>(['template']);
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Compute dynamic onboarding progress from real resources
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ ok: boolean; sources?: Array<{ lastSyncedAt?: string; lastRowCount?: number }> }>(`/api/projects`),
      api<{ ok: boolean; datasets?: Array<{ rowCount: number }> }>(`/api/datasets?projectId=${encodeURIComponent(projectId)}`),
      api<{ ok: boolean; cards?: any[] }>(`/api/dashboards?projectId=${encodeURIComponent(projectId)}`),
      api<{ ok: boolean; members?: unknown[]; onboarding?: { completedStepsJson?: string } }>(`/api/projects?projectId=${encodeURIComponent(projectId)}`),
    ]).then(([ws, ds, dash, pDetail]) => {
      if (cancelled) return;
      const done = new Set<string>(['template']);
      const skipped = new Set<string>();

      const projectSources = (ws.sources || []).filter((s: any) => s.projectId === projectId);
      const datasets = ds.datasets || [];
      const cards = dash.cards || [];
      const members = pDetail.members || [];
      setMemberCount(members.length);

      // 1. Data Source Connected
      if (projectSources.length > 0 || datasets.length > 0) {
        done.add('source');
      }

      // 2. First Sync Executed
      const hasRealData = datasets.some((d) => (d.rowCount || 0) > 0) || projectSources.some((s) => Boolean(s.lastSyncedAt) && (s.lastRowCount || 0) > 0);
      if (hasRealData) {
        done.add('first_sync');
      }

      // 3. Metrics and Dashboard (Only done if real data exists AND cards configured)
      if (project?.templateId === 'general_workbench') {
        if (hasRealData && cards.length > 0) {
          done.add('metrics');
        }
      } else {
        if (hasRealData || cards.length > 0) {
          done.add('metrics');
        }
      }

      // 4. Team Members Collaboration
      if (members.length > 1) {
        done.add('members');
      }

      // Merge saved steps if available
      if (pDetail.onboarding?.completedStepsJson) {
        try {
          const saved = JSON.parse(pDetail.onboarding.completedStepsJson);
          if (Array.isArray(saved)) {
            saved.forEach((s) => {
              if (s.startsWith('skip:')) skipped.add(s.replace('skip:', ''));
              else done.add(s);
            });
          }
        } catch {}
      }

      setCompletedSteps(Array.from(done));
      setSkippedSteps(Array.from(skipped));
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [projectId, project?.templateId]);

  const templateTitle =
    project?.templateName ||
    (project?.templateId === 'general_workbench'
      ? '通用数据工作台'
      : project?.templateId === 'comment_qc'
      ? '评论质检项目'
      : project?.templateId === 'ad_performance'
      ? '投放分析项目'
      : '内容营销项目');

  const steps: Step[] = [
    {
      id: 'template',
      title: '1. 业务模板确认',
      desc: `已选定「${templateTitle}」，确立项目数据边界与指标框架。`,
      unlockedAbility: '确立项目数据边界、推荐指标集与默认看板布局。',
      link: `/projects/${encodeURIComponent(projectId)}/settings?tab=profile`,
      linkLabel: '查看项目设定',
    },
    {
      id: 'source',
      title: '2. 接入业务数据源',
      desc: '绑定飞书表格、多维表格或业务数据集，建立专属数据管道。',
      unlockedAbility: '建立项目专属数据管道，隔离不同来源与客户数据。',
      link: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-sources`,
      linkLabel: '接入飞书数据源',
    },
    {
      id: 'first_sync',
      title: '3. 字段映射与首次同步',
      desc: '确认数据类型、主键与空值策略，执行安全来源级落库。',
      unlockedAbility: '生成结构化数据集，留存版本快照与血缘记录。',
      link: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-sources`,
      linkLabel: '配置字段与同步',
    },
    {
      id: 'metrics',
      title: '4. 确认指标与发布看板',
      desc: '根据业务字段计算求和、比率与分组，自定义卡片并发布。',
      unlockedAbility: '获得动态更新的业务看板，支持卡片增删与指标切换。',
      link: `/projects/${encodeURIComponent(projectId)}`,
      linkLabel: '查看看板与配置',
    },
    {
      id: 'members',
      title: '5. 邀请团队成员协作',
      desc: '按项目管理员、编辑者、只读成员划分权限，隔离敏感凭证。',
      unlockedAbility: '多人协同查看数据、处置异常与导出经营报告。',
      link: `/projects/${encodeURIComponent(projectId)}/settings?tab=members`,
      linkLabel: '管理团队成员',
    },
  ];

  const canManage = role === 'project_admin' || role === 'platform_admin';

  function handleSkipMembers() {
    setSkippedSteps((prev) => Array.from(new Set([...prev, 'members'])));
    showToast('已跳过团队邀请步骤（单人独立管理）', 'info');
  }

  async function markFinished() {
    setBusy(true);
    setFeedback(null);
    try {
      const allSteps = [
        ...completedSteps,
        ...skippedSteps.map((s) => `skip:${s}`),
      ];

      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_onboarding',
          projectId,
          onboardingStatus: 'ready',
          completedSteps: allSteps,
        }),
      });

      showToast('项目初始化已完成，已正式就绪！', 'success');
      setFeedback({ message: '初始化完成！项目已进入就绪状态。', type: 'success' });
      await onFinish();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '初始化失败';
      setFeedback({ message: msg, type: 'error' });
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #bfdbfe',
        padding: '24px',
        marginBottom: 24,
        boxShadow: '0 4px 12px rgba(37,99,235,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em' }}>
            PROJECT ONBOARDING · 新项目初始化向导
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px 0', color: '#0f172a' }}>
            欢迎开启项目协作：完成以下步骤即可就绪
          </h2>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            {canManage
              ? '您是当前项目的管理员，具备完整的数据接入、指标配置与成员邀请权限。'
              : '您当前为业务协作成员（只读），可查看数据并执行允许的业务操作。如需接入新数据源请联系项目管理员。'}
          </p>
          {feedback && (
            <div style={{ marginTop: 8, fontSize: 12, color: feedback.type === 'error' ? '#ef4444' : '#16a34a' }}>
              {feedback.message}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: '#fff',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            稍后配置
          </button>
          {canManage && (
            <button
              onClick={markFinished}
              disabled={busy}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: 13,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? '正在就绪…' : '完成初始化（发布项目）'}
            </button>
          )}
        </div>
      </div>

      {/* Stepper Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {steps.map((s, idx) => {
          const isDone = completedSteps.includes(s.id);
          const isSkipped = skippedSteps.includes(s.id);
          const isOptional = s.id === 'members' && memberCount === 1 && !isDone && !isSkipped;

          const stepStatus = isDone ? 'completed' : isSkipped ? 'skipped' : isOptional ? 'optional' : 'blocked';
          const statusBg = stepStatus === 'completed' ? '#f0fdf4' : stepStatus === 'optional' ? '#f0f9ff' : stepStatus === 'skipped' ? '#f8fafc' : '#fefce8';
          const statusBorder = stepStatus === 'completed' ? '#86efac' : stepStatus === 'optional' ? '#bae6fd' : stepStatus === 'skipped' ? '#cbd5e1' : '#fef08a';
          const statusColor = stepStatus === 'completed' ? '#166534' : stepStatus === 'optional' ? '#0369a1' : stepStatus === 'skipped' ? '#64748b' : '#854d0e';

          return (
            <div
              key={s.id}
              style={{
                padding: 14,
                borderRadius: 8,
                border: `1px solid ${statusBorder}`,
                background: statusBg,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, color: statusColor }}>{s.title}</strong>
                  <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
                    {isDone ? '✓ 已就绪' : isSkipped ? '已跳过' : isOptional ? '选填' : `第${idx + 1}步`}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px 0', lineHeight: 1.4 }}>{s.desc}</p>
                <div style={{ fontSize: 11, color: '#64748b', background: 'rgba(0,0,0,0.03)', padding: '6px 8px', borderRadius: 4, marginBottom: 10 }}>
                  <strong>获得能力：</strong>{s.unlockedAbility}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link
                  href={s.link}
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: isDone ? '#16a34a' : '#2563eb',
                    textDecoration: 'none',
                  }}
                >
                  {s.linkLabel} →
                </Link>

                {isOptional && canManage && (
                  <button
                    onClick={handleSkipMembers}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: 11,
                      color: '#64748b',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    单人跳过
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
