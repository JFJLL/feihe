import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'kailas',
  name: '凯乐石',
  brand: '凯乐石',
  spu: '凯乐石 FUGA 大坡王越野跑鞋',
  category: '户外运动 / 越野跑鞋',
  color: '#0284c7',
  defaultReportPeriod: '营销复盘周期',
  mode: '双轨全域归因 · KFS真实入账',
  rendererMode: 'legacy-campaign',
  subtitle: '预算与版位效率',
  description: '预算与版位效率',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '数据总览', icon: '📊', desc: '预算进度与阶段效果' },
    { key: 'daily', label: '分日看板', icon: '📅', desc: '当日指标与明细' },
    { key: 'ads', label: '版位投放', icon: '🎯', desc: '广告与渠道效率' },
    { key: 'content', label: '内容执行', icon: '📝', desc: '达人与笔记详情' },
  ],
};

export default manifest;
