import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'meiling',
  name: '美菱',
  brand: '美菱',
  spu: '美菱 603 无霜冰箱',
  category: '大家电 / 冰箱保鲜',
  color: '#0d9488',
  defaultReportPeriod: '大促复盘周期',
  mode: '双11大促全域攻坚 · 四线独立归因',
  rendererMode: 'legacy-campaign',
  subtitle: '双十一投放与内容执行',
  description: '双十一投放与内容执行',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '数据总览', icon: '📊', desc: '预算进度与阶段效果' },
    { key: 'daily', label: '分日看板', icon: '📅', desc: '当日指标与明细' },
    { key: 'ads', label: '版位投放', icon: '🎯', desc: '广告与渠道效率' },
    { key: 'content', label: '内容执行', icon: '📝', desc: '达人与笔记详情' },
  ],
};

export default manifest;
