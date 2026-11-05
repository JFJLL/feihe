import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'winner-wipes',
  sources: [
    {
      id: 'wipes-delivery',
      name: '稳健玉米湿巾投放日跟踪表',
      type: 'feishu_sheet',
      spreadsheetToken: 'Ero1shDTFhVzwttqDMLceZQ4nMb',
      sheetId: '0QTVhE',
      range: 'A1:U200',
      url: 'https://yimeichuanbo.feishu.cn/wiki/Jo2cwK3c9ishJdkq40ycfNSMnTh?sheet=0QTVhE',
      description: '稳健玉米消毒湿巾全渠道投放日跟踪表（0QTVhE）',
    },
    {
      id: 'wipes-taosou',
      name: '稳健湿巾淘搜数据',
      type: 'feishu_sheet',
      spreadsheetToken: 'Ero1shDTFhVzwttqDMLceZQ4nMb',
      sheetId: 'wY1HZO',
      range: 'A1:W120',
      description: '稳健湿巾淘搜指数与站外回流追踪',
    },
    {
      id: 'wipes-enrichment',
      name: '稳健湿巾离线增强快照',
      type: 'manual',
      filePath: 'lib/campaign-enrichment/winner-wipes.json',
      description: '达人执行、版位消耗、CID效果与阶段考核数据',
    },
  ],
};

export default sources;
