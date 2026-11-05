import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'huang-tiane',
  sources: [
    {
      id: 'huang-commerce',
      name: '黄天鹅商销引流底表',
      type: 'feishu_sheet',
      sheetId: '1zHh98',
      description: '黄天鹅千川/聚光商销引流投放表',
    },
    {
      id: 'huang-cid',
      name: '黄天鹅CID回流归因表',
      type: 'feishu_sheet',
      sheetId: '1zHh99',
      description: '小红书引流淘宝/京东外溢回流与下单ROI',
    },
    {
      id: 'huang-enrichment',
      name: '黄天鹅全域增强快照',
      type: 'manual',
      filePath: 'lib/campaign-enrichment/huang-tiane.json',
      description: '包含品牌、商销、人群画像等25张表与5个分日流',
    },
  ],
};

export default sources;
