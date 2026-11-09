import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'qicui',
  name: '飞鹤启萃',
  brand: '飞鹤',
  spu: '飞鹤启萃系列婴配粉',
  category: '母婴乳品 / 奶粉',
  color: '#0f5e52',
  themeId: 'teal-mist',
  defaultReportPeriod: '营销复盘周期',
  mode: '全域声量与评论质检 · 真实对账',
  rendererMode: 'universal',
  subtitle: '启萃全域声量与评论质检',
  description: '飞鹤启萃小红书全域声量、达人投放、评论外显质检与分日消耗',
  templateId: 'content_marketing',
  enabledTabs: [
    { key: 'overview', label: '全域声量总览', icon: '📊', desc: '品牌声量与全量消耗大盘' },
    { key: 'comments', label: '评论外显质检', icon: '💬', desc: '真实舆情与口碑外显率' },
    { key: 'industry', label: '竞品社媒监控', icon: '🔍', desc: '本竞品声量与行业大盘' },
    { key: 'content', label: '达人爆文矩阵', icon: '📝', desc: '达人带货与爆文分布' },
  ],
};

export default manifest;
