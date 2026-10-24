'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../lib/hooks/use-project-data';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Dialog } from '../../../components/ui/Dialog';
import { CustomSelect } from '../../../components/ui/CustomSelect';

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
  { value: 'project_admin', label: '项目管理员', color: 'var(--teal-11, #008573)', badge: '全部权限' },
  { value: 'editor', label: '业务编辑者', color: 'var(--jade-11, #208368)', badge: '可同步与编辑' },
  { value: 'viewer', label: '只读观察员', color: 'var(--slate-11, #60646c)', badge: '仅查看看板' },
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
    <>
      {loading && <LoadingState text="正在获取项目成员列表…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {/* Member Table Panel */}
      {!loading && !error && (
        <article style={{ background: 'var(--ws-surface, #ffffff)', padding: 24, borderRadius: 'var(--ws-radius-card, 12px)', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>项目成员与权限列表</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>不同成员按角色隔离飞书应用凭证、写操作与删除权限。</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  background: canManageMembers ? 'var(--teal-2, #f3fbf9)' : 'var(--slate-2, #f9f9fb)',
                  border: `0.5px solid ${canManageMembers ? 'var(--teal-6, #a1ded2)' : 'var(--slate-6, #d9d9e0)'}`,
                  borderRadius: 'var(--ws-radius-control, 8px)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--slate-12, #1c2024)' }}>
                  当前操作身份：<strong>{currentUser?.displayName || '用户'}</strong>
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: canManageMembers ? 'var(--teal-9, #12a594)' : 'var(--slate-9, #8b8d98)',
                    color: '#ffffff',
                  }}
                >
                  {canManageMembers ? '具备管理权限' : '只读查看'}
                </span>
              </div>
              <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-11, #60646c)', borderRadius: 'var(--ws-radius-control, 8px)', fontWeight: 500, border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                共 {members.length} 名成员 / 管理员 {adminCount} / 编辑 {editorCount} / 观察员 {viewerCount}
              </span>
              {canManageMembers && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setSelectedUserId(unassignedUsers[0]?.id || '');
                    setSelectedRole('editor');
                    setShowAddModal(true);
                  }}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--ws-radius-control, 8px)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>＋</span> 添加成员
                </button>
              )}
            </div>
          </div>

          {members.length === 0 ? (
            <EmptyState title="当前项目暂无成员" text="点击上方「添加已有成员」邀请团队成员协作。" />
          ) : (
            <div style={{ overflowX: 'auto', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: 'var(--ws-radius-control, 8px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--slate-2, #f9f9fb)', borderBottom: '0.5px solid var(--slate-6, #d9d9e0)', color: 'var(--slate-11, #60646c)' }}>
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
                    const protectedMember = m.userId === ownerId || (m.role === 'project_admin' && adminCount <= 1);

                    return (
                      <tr key={m.userId} style={{ borderBottom: '0.5px solid var(--slate-4, #e8e8ec)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                          {m.name}
                          {isSelf && (
                            <span style={{ marginLeft: 6, fontSize: 12, padding: '1px 5px', background: 'var(--teal-3, #e0f8f3)', color: 'var(--teal-11, #008573)', borderRadius: 3 }}>
                              (您)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--slate-11, #60646c)' }}>
                          <code>{m.email || m.userId}</code>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManageMembers && !isSelf ? (
                            <CustomSelect
                              value={m.role}
                              ariaLabel={`${m.name}项目角色`}
                              disabled={Boolean(busy) || protectedMember}
                              onChange={(val) => handleRoleChange(m.userId, val)}
                              options={ROLE_OPTIONS.map((r) => ({
                                value: r.value,
                                label: r.label,
                              }))}
                              style={{ width: 140 }}
                            />
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: roleInfo.color }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleInfo.color }} />
                              {roleInfo.label}
                            </span>
                          )}
                          {m.userId === ownerId && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--slate-11, #60646c)' }}>当前负责人；角色调整需先交接项目资料。</p>}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--slate-11, #60646c)' }}>
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
                                  background: 'var(--red-3, #feebec)',
                                  border: '0.5px solid var(--red-6, #fdbdbe)',
                                  color: 'var(--red-11, #ce2c31)',
                                  borderRadius: 'var(--ws-radius-control, 8px)',
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  cursor: Boolean(busy) || protectedMember ? 'not-allowed' : 'pointer',
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

      {/* Add Member Dialog */}
      {showAddModal && (
        <Dialog
          open={showAddModal}
          title="添加项目成员"
          width={480}
          onClose={() => {
            if (busy !== 'add') setShowAddModal(false);
          }}
          footer={
            <>
              <button
                type="button"
                disabled={busy === 'add'}
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: '0.5px solid var(--slate-6, #d9d9e0)',
                  background: 'var(--ws-surface, #ffffff)',
                  color: 'var(--slate-12, #1c2024)',
                  cursor: busy === 'add' ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              {unassignedUsers.length > 0 && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'add' || !selectedUserId}
                  onClick={handleAddMember}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--ws-radius-control, 8px)',
                    cursor: busy === 'add' || !selectedUserId ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {busy === 'add' ? '正在添加…' : '确认添加'}
                </button>
              )}
            </>
          }
        >
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
            从组织中选择已有成员加入当前项目，并为其分配权限角色。
          </p>

          {unassignedUsers.length === 0 ? (
            <div style={{ padding: 14, background: 'var(--slate-2, #f9f9fb)', borderRadius: 'var(--ws-radius-control, 8px)', fontSize: 12, color: 'var(--slate-11, #60646c)', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
              组织内所有可用成员已全数加入当前项目。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                选择成员
                <CustomSelect
                  value={selectedUserId}
                  ariaLabel="选择成员"
                  placeholder="请选择成员"
                  disabled={busy === 'add'}
                  onChange={(val) => setSelectedUserId(val)}
                  options={unassignedUsers.map((u) => ({
                    value: u.id,
                    label: `${u.name} (${u.email || u.id})`,
                  }))}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                分配项目角色
                <CustomSelect
                  value={selectedRole}
                  ariaLabel="分配项目角色"
                  disabled={busy === 'add'}
                  onChange={(val) => setSelectedRole(val)}
                  options={ROLE_OPTIONS.map((r) => ({
                    value: r.value,
                    label: `${r.label} (${r.badge})`,
                  }))}
                />
              </label>
            </div>
          )}
        </Dialog>
      )}

      {/* Confirmation Dialog for Removal */}
      {confirmRemove.open && confirmRemove.member && (
        <Dialog
          open={confirmRemove.open && Boolean(confirmRemove.member)}
          title={`确认将「${confirmRemove.member.name}」移出项目？`}
          width={460}
          onClose={() => {
            if (busy !== confirmRemove.member?.userId) {
              setConfirmRemove({ open: false, member: null });
            }
          }}
          footer={
            <>
              <button
                type="button"
                disabled={busy === confirmRemove.member.userId}
                onClick={() => setConfirmRemove({ open: false, member: null })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: '0.5px solid var(--slate-6, #d9d9e0)',
                  background: 'var(--ws-surface, #ffffff)',
                  color: 'var(--slate-12, #1c2024)',
                  cursor: busy === confirmRemove.member.userId ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy === confirmRemove.member.userId}
                onClick={() => executeRemove(confirmRemove.member!)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: 'none',
                  background: 'var(--red-9, #e5484d)',
                  color: '#ffffff',
                  cursor: busy === confirmRemove.member.userId ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {busy === confirmRemove.member.userId ? '正在移除…' : '确认移除'}
              </button>
            </>
          }
        >
          <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--slate-11, #60646c)', lineHeight: 1.5 }}>
            移除后，该成员将立即失去对当前项目数据、数据源与看板的访问权限。
          </p>
        </Dialog>
      )}
    </>
  );
}
