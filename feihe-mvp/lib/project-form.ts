export const PROJECT_COLORS = [
  { value: '#2563eb', label: '蓝色' }, { value: '#059669', label: '绿色' },
  { value: '#4f46e5', label: '靛蓝' }, { value: '#d97706', label: '琥珀色' },
  { value: '#e11d48', label: '玫瑰色' }, { value: '#7c3aed', label: '紫色' },
  { value: '#0891b2', label: '青色' }, { value: '#475569', label: '石板灰' },
];
export const PROJECT_STATUSES = ['筹备中', '进行中', '已结束'];
export function automaticProjectColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length].value;
}
export interface ProjectDraft {
  id?: string; name: string; departmentId: string; ownerId: string; clientId: string;
  description: string; templateId: string; status: string; color: string;
  brand: string; spu: string; category: string;
}
export function projectDraftErrors(draft: ProjectDraft) {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('请填写项目名称');
  if (draft.name.trim().length > 100) errors.push('项目名称不能超过100字');
  if (!draft.departmentId) errors.push('请选择负责部门');
  if (!draft.ownerId) errors.push('请选择负责人');
  if (!PROJECT_STATUSES.includes(draft.status)) errors.push('请选择有效的业务状态');
  if (draft.color && !/^#[a-f0-9]{6}$/i.test(draft.color)) errors.push('项目识别色格式不正确');
  return errors;
}
