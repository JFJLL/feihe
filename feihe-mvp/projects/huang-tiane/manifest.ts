import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'huang-tiane',
  name: '黄天鹅',
  brand: '黄天鹅',
  spu: '黄天鹅可生食鸡蛋',
  category: '生鲜食品 / 禽蛋蛋品',
  color: '#b8860b',
  themeId: 'executive',
  defaultReportPeriod: '营销复盘周期',
  mode: '全域三线核算 · 真实入账',
  rendererMode: 'legacy-huang-tiane',
  subtitle: '可生食鸡蛋种草与电商引流',
  description: '可生食鸡蛋小红书种草、投流与商销引流复盘',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '三线全域核算', icon: '📊', desc: '三线独立核算大盘' },
    { key: 'ads', label: '商销与CID引流', icon: '🛒', desc: '商销日报与CID全域引流' },
    { key: 'content', label: '品牌FS种草执行', icon: '✨', desc: '品牌线FS投流与达人种草' },
    { key: 'industry', label: '行业竞品监控', icon: '🔍', desc: '生鲜禽蛋行业竞争监控' },
  ],
};

export default manifest;
