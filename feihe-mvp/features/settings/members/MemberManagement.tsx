'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../lib/hooks/use-project-data';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'project_admin' | 'editor' | 'viewer';
  name: string;
  email: string;
  departmentId?: string;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string;
}

const ROLE_OPTIONS = [
  { value: 'project_admin', label: '项目管理员', color: '#2563eb', badge: '全部权限' },
  { value: 'editor', label: '业务编辑者', color: '#059669', badge: '可同步与编辑' },
  { value: 'viewer', label: '只读观察员', color: '#64748b', badge: '仅查看看板' },
];

export function MemberManagement({
  projectId,
  toast,
  onDone = async () => {},
}: {
  projectId: string;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDone?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: string; role: string; displayName: string } | null>(null);
  const [ownerId, setOwnerId] = useState('');
  const requestGeneration = useRef(0);
  const invalidateRequests = useCallback(() => { requestGeneration.current++; }, []);
  const [busy, setBusy] = useState<string>('');

  // Add member dialog
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');

  // Remove confirmation dialog
  const [confirmRemove, setConfirmRemove] = useState<{
    open: boolean;
    member: ProjectMember | null;
  }>({ open: false, member: null });

  const loadData = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        ok: boolean;
        members: ProjectMember[];
        availableUsers: AvailableUser[];
        currentUser: { userId: string; role: string; displayName: string };
        project: { ownerId?: string };
      }>(`/api/projects?projectId=${encodeURIComponent(projectId)}`);

      if (generation !== requestGeneration.current) return;
      setMembers(res.members || []); setOwnerId(res.project?.ownerId || '');
      setAvailableUsers(res.availableUsers || []);
      if (res.currentUser) setCurrentUser(res.currentUser);
    } catch (err) {
      if (generation !== requestGeneration.current) return;
      setError(err instanceof Error ? err.message : '加载成员列表失败');
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadData(); }, 0);
    return () => { clearTimeout(timer); invalidateRequests(); };
  }, [loadData, invalidateRequests]);

  const canManageMembers =
    currentUser?.role === 'platform_admin' ||
    members.some((m) => m.userId === currentUser?.userId && m.role === 'project_admin');

  async function handleAddMember() {
    if (!selectedUserId) {
      toast('请选择要添加的成员', 'error');
      return;
    }
    setBusy('add');
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'manage_member',
          projectId,
          userId: selectedUserId,
          role: selectedRole,
        }),
      });
      toast('成员添加成功', 'success');
      setShowAddModal(false);
      setSelectedUserId('');
      await loadData();
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '添加成员失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setBusy(userId);
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'manage_member',
          projectId,
          userId,
          role: newRole,
        }),
      });
      toast('成员角色已调整', 'success');
      await loadData();
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '修改角色失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function executeRemove(member: ProjectMember) {
    setBusy(member.userId);
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'manage_member',
          projectId,
          userId: member.userId,
          subAction: 'remove',
        }),
      });
      toast(`已将 ${member.name} 移出项目`, 'success');
      setConfirmRemove({ open: false, member: null });
      await loadData();
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '移除成员失败', 'error');
    } finally {
      setBusy('');
    }
  }

  // Filter available users not already members
  const memberUserIds = new Set(members.map((m) => m.userId));
  const unassignedUsers = availableUsers.filter((u) => !memberUserIds.has(u.id));

  const adminCount = members.filter((m) => m.role === 'project_admin').length;
  const editorCount = members.filter((m) => m.role === 'editor').length;
  const viewerCount = members.filter((m) => m.role === 'viewer').length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Overview Metric Cards */}
      <section className="ops-metric-grid" aria-label="项目成员概况">
        <MetricCard label="成员总数" value={members.length} unit="人" theme="blue" desc="已加入当前项目的协同成员" />
        <MetricCard label="项目管理员" value={adminCount} unit="人" theme="purple" desc="具备数据接入、指标发布与授权权限" />
        <MetricCard label="业务编辑者" value={editorCount} unit="人" theme="green" desc="具备业务数据编辑与同步权限" />
        <MetricCard label="只读观察员" value={viewerCount} unit="人" theme="teal" desc="仅具备看板查看与报告导出权限" />
      </section>

      {/* Role Notice Banner */}
      <div
        style={{
          background: canManageMembers ? '#eff6ff' : '#f8fafc',
          border: canManageMembers ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#1e293b' }}>
            当前操作身份：<strong>{currentUser?.displayName || '用户'}</strong>
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: canManageMembers ? '#2563eb' : '#64748b',
              color: '#fff',
            }}
          >
            {canManageMembers ? '具备成员管理权限' : '只读查看成员'}
          </span>
        </div>
        {!canManageMembers && (
          <span style={{ fontSize: 12, color: '#64748b' }}>如需调整角色或邀请新成员，请联系项目管理员。</span>
        )}
      </div>

      {loading && <LoadingState text="正在获取项目成员列表…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {/* Member Table Panel */}
      {!loading && !error && (
        <article className="pastel-card reference-section section-blue" style={{ padding: 24, borderRadius: 12, border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="section-mini-tag tag-blue">MEMBER ACCESS MATRIX</span>
              <h3 style={{ margin: '4px 0 2px', fontSize: 18, color: '#0f172a' }}>项目成员与权限列表</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>不同成员按角色隔离飞书应用凭证、写操作与删除权限。</p>
            </div>

            {canManageMembers && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedUserId(unassignedUsers[0]?.id || '');
                  setSelectedRole('editor');
                  setShowAddModal(true);
                }}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>＋</span> 添加已有成员
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <EmptyState title="当前项目暂无成员" text="点击上方「添加已有成员」邀请团队成员协作。" />
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>成员姓名</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>系统账号 / 邮箱</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>项目角色</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>权限范围</th>
                    {canManageMembers && <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const roleInfo = ROLE_OPTIONS.find((r) => r.value === m.role) || ROLE_OPTIONS[2];
                    const isSelf = m.userId === currentUser?.userId;
                    const protectedMember = m.userId === ownerId || m.role === 'project_admin' && adminCount <= 1;

                    return (
                      <tr key={m.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                          {m.name}
                          {isSelf && (
                            <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', background: '#eff6ff', color: '#2563eb', borderRadius: 3 }}>
                              (您)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          <code>{m.email || m.userId}</code>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManageMembers && !isSelf ? (
                            <CustomSelect
                              value={m.role}
                              ariaLabel={m.name + '项目角色'}
                              disabled={Boolean(busy) || protectedMember}
                              onChange={(val) => handleRoleChange(m.userId, val)}
                              options={ROLE_OPTIONS}
                              style={{ width: 140 }}
                            />
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: roleInfo.color }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleInfo.color }} />
                              {roleInfo.label}
                            </span>
                          )}
                          {m.userId === ownerId && <p>当前负责人；角色调整需先交接项目资料。</p>}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>
                          {m.role === 'project_admin'
                            ? '完整数据接入、指标配置、看板发布与成员管理'
                            : m.role === 'editor'
                            ? '业务数据录入、触发数据同步、创建指标草稿'
                            : '查看数据看板与导出报告，无写权限'}
                        </td>
                        {canManageMembers && (
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={Boolean(busy) || protectedMember}
                                onClick={() => setConfirmRemove({ open: true, member: m })}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #fca5a5',
                                  color: '#ef4444',
                                  borderRadius: 4,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                {busy === m.userId ? '正在移除…' : '移除'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 460, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>添加项目成员</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            <p style={{ margin: '0 0 18px 0', fontSize: 13, color: '#64748b' }}>
              从公司组织中选择已有成员加入当前项目，并为其分配权限角色。
            </p>

            {unassignedUsers.length === 0 ? (
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#64748b' }}>
                组织内所有可用成员已全数加入当前项目。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  选择成员
                  <CustomSelect
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    options={unassignedUsers.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email || u.id})`,
                    }))}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  分配项目角色
                  <CustomSelect
                    value={selectedRole}
                    onChange={setSelectedRole}
                    options={ROLE_OPTIONS}
                  />
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                取消
              </button>
              {unassignedUsers.length > 0 && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'add' || !selectedUserId}
                  onClick={handleAddMember}
                  style={{ padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {busy === 'add' ? '正在添加…' : '确认添加'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Removal */}
      {confirmRemove.open && confirmRemove.member && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 440, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              确认将「{confirmRemove.member.name}」移出项目？
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              移除后，该成员将立即失去对当前项目数据、数据源与看板的访问权限。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmRemove({ open: false, member: null })}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => executeRemove(confirmRemove.member!)}
                style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
