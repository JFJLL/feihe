import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'meiling',
  name: '美菱',
  brand: '美菱',
  spu: '美菱 603 无霜冰箱',
  category: '大家电 / 冰箱保鲜',
  color: '#b8322f',
  themeId: 'store-red',
  defaultReportPeriod: '大促复盘周期',
  mode: '双11大促全域攻坚 · 四线独立归因',
  rendererMode: 'legacy-campaign',
  subtitle: '双十一投放与内容执行',
  description: '双十一投放与内容执行',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '双11四线总览', icon: '📊', desc: '双11大促全域总览' },
    { key: 'ads', label: '渠道ROI赛马', icon: '🏇', desc: '多渠道投流ROI对比' },
    { key: 'content', label: 'KOL审稿与外溢', icon: '📝', desc: 'KOL达人内容与外溢效果' },
    { key: 'industry', label: '行业竞品监控', icon: '🔍', desc: '大家电与冰箱行业大盘' },
  ],
};

export default manifest;
