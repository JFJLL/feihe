import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'kailas',
  name: '凯乐石',
  brand: '凯乐石',
  spu: '凯乐石 FUGA 大坡王越野跑鞋',
  category: '户外运动 / 越野跑鞋',
  color: '#b4573f',
  themeId: 'amber-dusk',
  defaultReportPeriod: '营销复盘周期',
  mode: '双轨全域归因 · KFS真实入账',
  rendererMode: 'legacy-campaign',
  subtitle: '预算与版位效率',
  description: '预算与版位效率',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '预算控盘总览', icon: '📊', desc: '预算推进与双轨入账' },
    { key: 'ads', label: '版位效率寻优', icon: '🎯', desc: '搜索与信息流投放效率' },
    { key: 'content', label: '达人种草执行', icon: '📝', desc: '达人采买与笔记转化' },
    { key: 'industry', label: '行业竞品监控', icon: '🔍', desc: '户外跑鞋行业动态' },
  ],
};

export default manifest;
