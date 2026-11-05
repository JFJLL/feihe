import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'meiling',
  sources: [
    {
      id: 'meiling-daily-tm-seed',
      name: '美菱天猫分日种子数据表',
      type: 'feishu_sheet',
      sheetId: 'iautvs',
      description: '美菱双11分日投放与天猫回流数据',
    },
    {
      id: 'meiling-kol-tier-bitable',
      name: '美菱达人梯队与执行多维表格',
      type: 'feishu_bitable',
      appToken: 'O0rdbm2fja7f67sFq6tc09xBn5d',
      tableId: 'tblL9G2yC0f8kX4Q',
      description: '美菱KOL梯队预算执行与阶段跟进多维表格',
    },
    {
      id: 'meiling-enrichment',
      name: '美菱离线增强快照',
      type: 'manual',
      filePath: 'lib/campaign-enrichment/meiling.json',
      description: '包含四线归因、执行状态、KOL梯队等34张数据表',
    },
  ],
};

export default sources;
