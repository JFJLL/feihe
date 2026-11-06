import type { ProjectManifest } from '../../lib/core/types';

export const manifest: ProjectManifest = {
  id: 'huang-tiane',
  name: '黄天鹅',
  brand: '黄天鹅',
  spu: '黄天鹅可生食鸡蛋',
  category: '生鲜食品 / 禽蛋蛋品',
  color: '#d97706',
  defaultReportPeriod: '营销复盘周期',
  mode: '全域三线核算 · 真实入账',
  rendererMode: 'legacy-huang-tiane',
  subtitle: '可生食鸡蛋种草与电商引流',
  description: '可生食鸡蛋小红书种草、投流与商销引流复盘',
  templateId: 'campaign_review',
  enabledTabs: [
    { key: 'overview', label: '数据总览', icon: '📊', desc: '预算进度与阶段效果' },
    { key: 'daily', label: '分日看板', icon: '📅', desc: '当日指标与明细' },
    { key: 'ads', label: '版位投放', icon: '🎯', desc: '广告与渠道效率' },
    { key: 'content', label: '内容执行', icon: '📝', desc: '达人与笔记详情' },
  ],
};

export default manifest;
