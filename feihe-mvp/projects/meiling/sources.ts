import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'meiling',
  sources: [
    {
      id: 'meiling-daily-tm-seed',
      name: '美菱双11-自采天猫种草日流水 (TM种草)',
      type: 'feishu_sheet',
      spreadsheetToken: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      sheetId: 'iautvs',
      range: 'A1:U592',
      description: '美菱双11自采天猫种草日流水（透视表iautvs）',
    },
    {
      id: 'meiling-daily-jd-seed',
      name: '美菱双11-自采京东种草日流水 (JD种草)',
      type: 'feishu_sheet',
      spreadsheetToken: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      sheetId: 'B5TBE7',
      range: 'A1:U592',
      description: '美菱双11自采京东种草日流水（透视表B5TBE7）',
    },
    {
      id: 'meiling-daily-xingban-seed',
      name: '代采星伴种草分日流水',
      type: 'feishu_sheet',
      spreadsheetToken: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      sheetId: '7gf6nq',
      range: 'A1:U592',
      description: '美菱双11代采星伴种草分日流水（透视表7gf6nq）',
    },
    {
      id: 'meiling-daily-jd-toitou-seed',
      name: '京东对投种草分日流水',
      type: 'feishu_sheet',
      spreadsheetToken: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      sheetId: 'TLLRoo',
      range: 'A1:U592',
      description: '美菱双11京东对投种草分日流水（透视表TLLRoo）',
    },
    {
      id: 'meiling-daily-cid-jd',
      name: '美菱双11-京东对投CID日表现 (CID渠道)',
      type: 'feishu_sheet',
      spreadsheetToken: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      sheetId: 'Trvrou',
      range: 'A1:W601',
      description: '美菱双11京东对投CID日表现（透视表Trvrou）',
    },
    {
      id: 'meiling-kol-tier-bitable',
      name: '美菱达人梯队与执行多维表格',
      type: 'feishu_bitable',
      baseToken: 'XH2obMhtwaPCWUsmsWacRCpLnvg',
      appToken: 'XH2obMhtwaPCWUsmsWacRCpLnvg',
      tableId: 'tbluz50zuZOeGQWf',
      description: '美菱KOL梯队预算执行与阶段跟进多维表格',
    },
    {
      id: 'meiling-enrichment',
      name: '美菱离线增强快照',
      type: 'manual',
      filePath: 'projects/meiling/data/enrichment.json',
      description: '包含四线归因、执行状态、KOL梯队等34张数据表',
    },
  ],
};

export default sources;
