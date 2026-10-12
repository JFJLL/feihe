'use client';

import Link from '../../components/ui/AppLink';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { api } from '../../lib/hooks/use-project-data';

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#4f46e5', // Indigo
  '#d97706', // Amber
  '#e11d48', // Rose
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#475569', // Slate
];

const emptyProject = {
  name: '',
  templateId: 'general_workbench',
  departmentId: 'dept-general',
  clientId: '',
  ownerId: '',
  description: '',
  status: '筹备中',
  color: '#2563eb',
  spu: '',
  brand: '',
  category: '',
};

export function ProjectCenter({ userName }: { userName: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingProject, setEditingProject] = useState<Record<string, unknown>>(emptyProject);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [templateFilter, setTemplateFilter] = useState('ALL');

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    confirmText: '确认',
    onConfirm: async () => {},
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextWorkspace = await api<Workspace>('/api/projects');
      setWorkspace(nextWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : '项目列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function saveProject() {
    const isEdit = Boolean(editingProject.id);
    const action = isEdit ? 'update' : 'create';
    setBusy('project');
    try {
      const res = await api<{ ok: boolean; id: string; templateId?: string }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action,
          projectId: editingProject.id,
          ...editingProject,
        }),
      });

      setMessage(isEdit ? '项目资料已更新' : '项目创建成功，已进入初始化向导');
      setShowEditor(false);
      setEditingProject(emptyProject);
      await refresh();

      if (!isEdit && res?.id) {
        window.location.href = `/projects/${encodeURIComponent(res.id)}`;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存项目失败');
    } finally {
      setBusy('');
    }
  }

  function promptArchive(item: Project) {
    const isArchived = Number(item.isArchived || 0) === 1 || item.status === '已归档';
    setConfirmDialog({
      open: true,
      title: isArchived ? `恢复项目“${item.name}”` : `归档项目“${item.name}”`,
      description: isArchived
        ? '恢复后该项目将重新允许写入操作与数据同步。'
        : '归档后项目数据将保留在系统中，但写操作与自动同步将暂停。可随时恢复。',
      confirmText: isArchived ? '确认恢复' : '确认归档',
      isDanger: !isArchived,
      onConfirm: async () => {
        setBusy(item.id);
        try {
          await api('/api/projects', {
            method: 'POST',
            body: JSON.stringify({
              action: isArchived ? 'restore' : 'archive',
              projectId: item.id,
            }),
          });
          setMessage(isArchived ? '项目已恢复进行中' : '项目已归档');
          await refresh();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : '操作失败');
        } finally {
          setBusy('');
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  function promptDelete(item: Project) {
    setConfirmDialog({
      open: true,
      title: `彻底删除项目“${item.name}”`,
      description: '此操作仅平台管理员可执行。将永久删除该项目的指标、规则、评论与数据源配置，不可恢复！',
      confirmText: '彻底删除',
      isDanger: true,
      onConfirm: async () => {
        setBusy(item.id);
        try {
          await api('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', projectId: item.id }),
          });
          setMessage('项目已彻底删除');
          await refresh();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : '删除失败');
        } finally {
          setBusy('');
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }
  function openEdit(item?: Project) {
    if (item) {
      setEditingProject({
        id: item.id,
        name: item.name,
        templateId: item.templateId || 'general_workbench',
        departmentId: item.departmentId || 'dept-general',
        clientId: item.clientId || '',
        ownerId: item.ownerId || '',
        description: item.description || '',
        status: item.status || '进行中',
        color: item.color || '#2563eb',
        spu: item.spu || '',
        brand: item.brand || '',
        category: item.category || '',
      });
    } else {
      setEditingProject(emptyProject);
    }
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const allProjects = workspace?.projects || [];
  const departments = workspace?.metadata?.departments || [];
  const clients = workspace?.metadata?.clients || [];
  const templates = workspace?.metadata?.templates || [];

  const filteredProjects = useMemo(() => {
    return allProjects.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchBrand) return false;
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ARCHIVED') {
          if (Number(item.isArchived || 0) !== 1 && item.status !== '已归档') return false;
        } else {
          if (item.status !== statusFilter) return false;
        }
      }
      if (deptFilter !== 'ALL' && item.departmentId !== deptFilter) return false;
      if (templateFilter !== 'ALL' && (item.templateId || 'general_workbench') !== templateFilter) return false;
      return true;
    });
  }, [allProjects, searchQuery, statusFilter, deptFilter, templateFilter]);

  const activeCount = allProjects.filter((p) => p.status === '进行中').length;
  const pendingCount = allProjects.filter((p) => p.status === '筹备中').length;
  const archivedCount = allProjects.filter((p) => Number(p.isArchived || 0) === 1 || p.status === '已归档').length;

  return (
    <div className="platform-shell">
      <header className="platform-top">
        <Link className="platform-brand" href="/">
          <b>协同</b>
          <span>
            项目协同中台 V1
            <small>MULTI-PROJECT COLLABORATION OS</small>
          </span>
        </Link>
        <div className="platform-user">
          <i>{(userName || 'U').slice(0, 1).toUpperCase()}</i>
          <span>
            {userName || '系统用户'}
            <small>{workspace?.metadata?.currentUser?.role === 'platform_admin' ? '平台管理员' : '项目成员'}</small>
          </span>
        </div>
      </header>

      <main className="platform-main" style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 20px' }}>
        {message && (
          <div style={{ padding: '12px 16px', marginBottom: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>{message}</span>
            <button onClick={() => setMessage('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#166534' }} aria-label="关闭提示">×</button>
          </div>
        )}

        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <small style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>PROJECT PORTFOLIO</small>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px 0' }}>多部门项目协同中心</h1>
            <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>支持各业务部门创建专属项目、接入飞书数据、配置自定义指标与看板，实现成员权限隔离。</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>共 {allProjects.length} 个项目（{activeCount} 进行中 · {pendingCount} 筹备中）</span>
            <button
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
              onClick={() => openEdit()}
            >
              ＋ 新建项目
            </button>
          </div>
        </section>

        {/* Filters */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '16px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <input
              type="text"
              placeholder="搜索项目名称、品牌或说明…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>状态:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
              <option value="ALL">全部状态 ({allProjects.length})</option>
              <option value="进行中">进行中 ({activeCount})</option>
              <option value="筹备中">筹备中 ({pendingCount})</option>
              <option value="已结束">已结束</option>
              <option value="ARCHIVED">已归档 ({archivedCount})</option>
            </select>
          </div>
          {departments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>部门:</span>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
                <option value="ALL">全部部门</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>模板:</span>
              <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)} style={{ padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
                <option value="ALL">全部业务模板</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </section>
        {/* Editor Modal */}
        {showEditor && (
          <section style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #cbd5e1', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', padding: '24px', marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <small style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '0.06em' }}>{editingProject.id ? 'EDIT PROJECT' : 'NEW PROJECT CREATION'}</small>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0' }}>{editingProject.id ? '编辑项目资料' : '新建通用业务项目'}</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>为部门设立独立的数据边界、授权成员与度量看板。无需社媒/SPU假设。</p>
              </div>
              <button onClick={() => setShowEditor(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            {!editingProject.id && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>选择业务模板：</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {[
                    { id: 'general_workbench', name: '通用数据工作台', desc: '适用于活动排期、任务分工、预算支出等任意表格，无社媒强依赖。', recommended: true },
                    { id: 'content_marketing', name: '内容营销项目', desc: '适用于品牌种草、笔记资产管理、博主合作与曝光互动复盘。', recommended: false },
                    { id: 'comment_qc', name: '评论质检项目', desc: '适用于评论监测、负向舆情判定、处置待办与供应商核验。', recommended: false },
                    { id: 'ad_performance', name: '投放分析项目', desc: '适用于聚光等投放账户监控、消耗走势与获客效果分析。', recommended: false },
                  ].map((tpl) => {
                    const selected = editingProject.templateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setEditingProject({ ...editingProject, templateId: tpl.id })}
                        style={{
                          padding: 14,
                          borderRadius: 8,
                          border: selected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: selected ? '#eff6ff' : '#f8fafc',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {tpl.recommended && (
                          <span style={{ position: 'absolute', top: 8, right: 8, background: '#2563eb', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>推荐</span>
                        )}
                        <h4 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 700, color: selected ? '#1d4ed8' : '#0f172a' }}>{tpl.name}</h4>
                        <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{tpl.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>项目名称 <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  value={String(editingProject.name || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  placeholder="如：华北区渠道推广活动"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>负责部门</label>
                <select
                  value={String(editingProject.departmentId || 'dept-general')}
                  onChange={(e) => setEditingProject({ ...editingProject, departmentId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }}
                >
                  {departments.length > 0 ? (
                    departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)
                  ) : (
                    <>
                      <option value="dept-marketing">市场与营销部</option>
                      <option value="dept-operations">渠道与运营部</option>
                      <option value="dept-brand">品牌战略部</option>
                      <option value="dept-general">综合管理部</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>所属客户 (可选)</label>
                <select
                  value={String(editingProject.clientId || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, clientId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="">内部部门项目 (无特定客户)</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>业务状态</label>
                <select
                  value={String(editingProject.status || '筹备中')}
                  onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="筹备中">筹备中</option>
                  <option value="进行中">进行中</option>
                  <option value="已结束">已结束</option>
                </select>
              </div>
            </div>

            {/* Colors */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>项目识别色：</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {PRESET_COLORS.map((color) => {
                  const isSelected = (editingProject.color || '#2563eb') === color;
                  return (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setEditingProject({ ...editingProject, color })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: color,
                        border: isSelected ? '3px solid #0f172a' : '2px solid transparent',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>

            {/* Optional extension fields for marketing */}
            {(editingProject.templateId === 'content_marketing' || editingProject.templateId === 'comment_qc') && (
              <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 10 }}>社媒/营销业务扩展字段 (选填)：</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>SPU 名称</label>
                    <input
                      value={String(editingProject.spu || '')}
                      onChange={(e) => setEditingProject({ ...editingProject, spu: e.target.value })}
                      placeholder="如：启萃 3 段"
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>品牌</label>
                    <input
                      value={String(editingProject.brand || '')}
                      onChange={(e) => setEditingProject({ ...editingProject, brand: e.target.value })}
                      placeholder="如：飞鹤"
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>品类</label>
                    <input
                      value={String(editingProject.category || '')}
                      onChange={(e) => setEditingProject({ ...editingProject, category: e.target.value })}
                      placeholder="如：婴幼儿奶粉"
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>项目说明</label>
              <textarea
                value={String(editingProject.description || '')}
                onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                placeholder="简要说明该项目的核心目标、涉及业务与协作要求…"
                rows={2}
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy === 'project' || !editingProject.name}
                onClick={saveProject}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: !editingProject.name ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  cursor: !editingProject.name ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {editingProject.id ? '保存资料' : '创建项目并开启向导'}
              </button>
            </div>
          </section>
        )}
        {/* Portfolio Cards Grid */}
        {loading && !workspace ? (
          <LoadingState text="正在获取项目列表…" />
        ) : error && !workspace ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : !filteredProjects.length ? (
          <EmptyState
            title="未找到符合条件的项目"
            text="尝试清除筛选条件，或点击“新建项目”创建新的业务工作区。"
            action={
              <button
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
                onClick={() => openEdit()}
              >
                ＋ 新建项目
              </button>
            }
          />
        ) : (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {filteredProjects.map((item) => {
              const isArchived = Number(item.isArchived || 0) === 1 || item.status === '已归档';
              const templateTag =
                item.templateName ||
                (item.templateId === 'content_marketing'
                  ? '内容营销'
                  : item.templateId === 'comment_qc'
                  ? '评论质检'
                  : item.templateId === 'ad_performance'
                  ? '投放分析'
                  : '通用工作台');

              return (
                <article
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  <div style={{ height: 4, background: item.color || '#2563eb' }} />

                  <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontWeight: 600,
                            background:
                              item.status === '进行中' ? '#dcfce7' : item.status === '筹备中' ? '#fef3c7' : '#f1f5f9',
                            color: item.status === '进行中' ? '#15803d' : item.status === '筹备中' ? '#b45309' : '#475569',
                          }}
                        >
                          {item.status}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                          {templateTag}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => openEdit(item)}
                          style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: 13, cursor: 'pointer', padding: 0 }}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => promptArchive(item)}
                          style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', padding: 0 }}
                        >
                          {isArchived ? '恢复' : '归档'}
                        </button>
                        {item.id !== 'qicui' && (
                          <button
                            onClick={() => promptDelete(item)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: 0 }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: item.color || '#2563eb',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {(item.name || '项').slice(0, 1)}
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{item.name}</h3>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 8 }}>
                          <span>{item.departmentName || '业务部门'}</span>
                          <span>·</span>
                          <span>{item.clientName || '内部项目'}</span>
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b', lineHeight: 1.5, flex: 1 }}>
                      {item.description || '项目数据与业务协作工作区。'}
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        marginBottom: 16,
                        textAlign: 'center',
                      }}
                    >
                      {item.templateId === 'content_marketing' ? (
                        <>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>笔记资产</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{item.noteCount || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>可汇报</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{item.reportableCount || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>数据源</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                              {(workspace?.sources || []).filter((s) => s.projectId === item.id).length}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>已挂接数据源</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                              {(workspace?.sources || []).filter((s) => s.projectId === item.id).length}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>初始化状态</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: item.onboardingStatus === 'ready' ? '#166534' : '#b45309' }}>
                              {item.onboardingStatus === 'ready' ? '就绪' : '引导中'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>更新日期</div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
                              {(item.updatedAt || '').slice(0, 10) || '今日'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>ID: {item.id}</span>
                      <Link
                        href={'/projects/' + encodeURIComponent(item.id)}
                        style={{
                          textDecoration: 'none',
                          padding: '7px 14px',
                          borderRadius: 6,
                          background: item.color || '#2563eb',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {item.onboardingStatus === 'ready' ? '进入工作区 →' : '进入向导 →'}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Confirmation Modal */}
        {confirmDialog.open && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '24px',
                maxWidth: 440,
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{confirmDialog.title}</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{confirmDialog.description}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14 }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: confirmDialog.isDanger ? '#ef4444' : '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
