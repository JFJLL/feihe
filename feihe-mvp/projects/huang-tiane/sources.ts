import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'huang-tiane',
  sources: [
    {
      id: 'huang-commerce',
      name: '黄天鹅商销引流底表',
      type: 'feishu_sheet',
      spreadsheetToken: 'XvqasKtUFhKZI2tqlEEcC0qtnph',
      sheetId: 'Dz6eHe',
      range: 'A1:T211',
      description: '黄天鹅千川/聚光商销引流投放表（XvqasKtUFhKZI2tqlEEcC0qtnph/Dz6eHe）',
    },
    {
      id: 'huang-cid',
      name: '黄天鹅CID回流归因表',
      type: 'feishu_sheet',
      spreadsheetToken: 'ERxXsBh6ehwgfDtQwAYcaxlZnEc',
      sheetId: 'Nm3Sev',
      range: 'A1:W609',
      description: '小红书引流淘宝/京东外溢回流与下单ROI（ERxXsBh6ehwgfDtQwAYcaxlZnEc/Nm3Sev）',
    },
    {
      id: 'huang-brand',
      name: '黄天鹅品牌FS种草流水表',
      type: 'feishu_sheet',
      spreadsheetToken: 'F42ksAyO8hKRGNt2plhccnSWnNh',
      sheetId: '637ef8',
      range: 'A1:BD4021',
      description: '黄天鹅品牌全量FS种草流水（F42ksAyO8hKRGNt2plhccnSWnNh/637ef8）',
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
