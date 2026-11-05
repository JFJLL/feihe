import type { ProjectSources } from '../../lib/core/types';

export const sources: ProjectSources = {
  projectId: 'qicui',
  sources: [
    {
      id: 'qicui-db-daily',
      name: '飞鹤启萃分日业务快照底表',
      type: 'manual',
      description: '存储于 business_daily_reports 中的审核日报与结算快照',
    },
    {
      id: 'qicui-db-notes',
      name: '飞鹤启萃达人笔记底表',
      type: 'manual',
      description: '存储于 project_notes 与 note_profiles 的 3000+ 篇全量笔记库',
    },
    {
      id: 'qicui-weekly-q4',
      name: '飞鹤启萃周趋势变化底表 (Q4)',
      type: 'feishu_sheet',
      url: 'https://yimeichuanbo.feishu.cn/wiki/SVwkw52kZiSlLEkQuaNcHvrynGg',
      description: '飞鹤启萃 Q4 周度投放与外显跟踪表',
    },
  ],
};

export default sources;
