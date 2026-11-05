import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'kailas',
  sources: [
    {
      id: 'kailas-online-budget',
      name: '凯乐石Q3投放与预算表',
      type: 'feishu_sheet',
      spreadsheetToken: '0vvsaG',
      sheetId: 'ZpT73Q',
      url: 'https://yimeichuanbo.feishu.cn/wiki/0vvsaG?sheet=ZpT73Q',
      description: '凯乐石跑鞋秋季投放预算规划与执行跟踪',
    },
    {
      id: 'kailas-online-perf',
      name: '凯乐石Q3效果明细表',
      type: 'feishu_sheet',
      spreadsheetToken: '0vvsaG',
      sheetId: 'JPKUX9',
      description: '凯乐石版位效率与分日指标',
    },
    {
      id: 'kailas-enrichment',
      name: '凯乐石离线全量增强快照',
      type: 'manual',
      filePath: 'lib/campaign-enrichment/kailas.json',
      description: '包含预算执行、版位分布与达人明细等26张数据表',
    },
  ],
};

export default sources;
