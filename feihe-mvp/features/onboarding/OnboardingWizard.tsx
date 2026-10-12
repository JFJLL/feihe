'use client';

import { useState } from 'react';
import Link from '../../components/ui/AppLink';
import type { Project } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';

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
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<string[]>(['template']);

  const steps: Step[] = [
    {
      id: 'template',
      title: '1. 业务模板确认',
      desc: `已选择「${project?.templateName || (project?.templateId === 'general_workbench' ? '通用数据工作台' : project?.templateId === 'comment_qc' ? '评论质检项目' : project?.templateId === 'ad_performance' ? '投放分析项目' : '内容营销项目') }」`,
      unlockedAbility: '确立项目数据边界、推荐指标集与默认看板布局。',
      link: `/projects/${encodeURIComponent(projectId)}/settings`,
      linkLabel: '查看模板设定',
    },
    {
      id: 'source',
      title: '2. 接入业务数据源',
      desc: '绑定飞书表格、多维表格或本地文件，无需技术人员介入。',
      unlockedAbility: '建立项目数据管道，为指标计算提供原始快照。',
      link: `/projects/${encodeURIComponent(projectId)}/settings`,
      linkLabel: '接入飞书数据源',
    },
    {
      id: 'first_sync',
      title: '3. 字段映射与首次同步',
      desc: '确认主键、时间字段、数值类型与空值策略，触发首次安全同步。',
      unlockedAbility: '生成结构化业务数据集，留存版本快照与血缘记录。',
      link: `/projects/${encodeURIComponent(projectId)}/settings`,
      linkLabel: '配置字段映射',
    },
    {
      id: 'metrics',
      title: '4. 确认指标与发布看板',
      desc: '根据数据类型计算关键指标，生成适合业务角色的看板卡片。',
      unlockedAbility: '获得实时更新的动态看板，支持周期对比与异常告警。',
      link: `/projects/${encodeURIComponent(projectId)}`,
      linkLabel: '查看看板效果',
    },
    {
      id: 'members',
      title: '5. 邀请团队成员协作',
      desc: '按管理员、编辑者、只读成员划分权限，隔离敏感凭证。',
      unlockedAbility: '多人协同查看数据、处置异常与导出经营报告。',
      link: `/projects/${encodeURIComponent(projectId)}/settings`,
      linkLabel: '分配成员角色',
    },
  ];

  const canManage = role === 'project_admin' || role === 'platform_admin';

  async function markFinished() {
    setBusy(true);
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          projectId,
          onboardingStatus: 'ready',
        }),
      });
      await onFinish();
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }
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
              : '您当前为业务协作成员，可查看数据并执行允许的业务操作。如需接入新数据源请联系项目管理员。'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
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
                cursor: 'pointer',
              }}
            >
              {busy ? '正在完成…' : '完成初始化（发布项目）'}
            </button>
          )}
        </div>
      </div>

      {/* Stepper Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {steps.map((s, idx) => {
          const isDone = completed.includes(s.id);
          return (
            <div
              key={s.id}
              style={{
                padding: 14,
                borderRadius: 8,
                border: isDone ? '1px solid #86efac' : '1px solid #e2e8f0',
                background: isDone ? '#f0fdf4' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, color: isDone ? '#166534' : '#0f172a' }}>{s.title}</strong>
                  <span style={{ fontSize: 12, color: isDone ? '#16a34a' : '#94a3b8' }}>{isDone ? '✓ 已就绪' : `第${idx + 1}步`}</span>
                </div>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px 0', lineHeight: 1.4 }}>{s.desc}</p>
                <div style={{ fontSize: 11, color: '#64748b', background: isDone ? 'rgba(22,101,52,0.06)' : '#f1f5f9', padding: '6px 8px', borderRadius: 4, marginBottom: 10 }}>
                  <strong>获得能力：</strong>{s.unlockedAbility}
                </div>
              </div>

              <div>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
