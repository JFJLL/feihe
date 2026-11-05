import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'qicui',
  name: '飞鹤启萃',
  brand: '飞鹤',
  spu: '飞鹤启萃系列婴配粉',
  category: '母婴乳品 / 奶粉',
  color: '#0f5e52',
  defaultReportPeriod: '营销复盘周期',
  mode: '全域声量与评论质检 · 真实对账',
  subtitle: '启萃全域声量与评论质检',
  description: '飞鹤启萃小红书全域声量、达人投放、评论外显质检与分日消耗',
  templateId: 'content_marketing',
  enabledTabs: [
    { key: 'overview', label: '数据总览', icon: '📊', desc: '全域声量与核心指标' },
    { key: 'daily', label: '业务日报', icon: '📅', desc: '分日流水与结算对账' },
    { key: 'comments', label: '评论质检', icon: '💬', desc: '外显审核与负向拦截' },
    { key: 'content', label: '达人笔记', icon: '📝', desc: '达人投放与爆文库' },
  ],
};

export default manifest;
