export const TEMPLATE_GUIDES = [
  { id: 'general_workbench', name: '通用数据工作台', description: '接入任意部门表格，再按实际字段推荐指标与图表。', requiredFields: [], optionalFields: ['日期', '分类或渠道', '数值字段'], recommended: '记录数、数值汇总、趋势与分组对比', modulesJson: '["overview","data","metrics","reports","settings"]' },
  { id: 'blank', name: '空白项目', description: '从空白工作台开始，自行选择指标与呈现方式。', requiredFields: [], optionalFields: [], recommended: '不预装卡片或目标', modulesJson: '["overview","data","metrics","reports","settings"]' },
  { id: 'content_marketing', name: '内容营销项目', description: '管理内容发布与表现；互动采集需另行配置外部接口。', requiredFields: ['内容标识或链接'], optionalFields: ['发布日期', '阅读', '互动', '费用'], recommended: '内容数量、阅读与互动趋势；目标需自行确认', modulesJson: '["overview","data","metrics","content","growth","comments","reports","settings"]' },
  { id: 'comment_qc', name: '评论质检项目', description: '接入评论记录进行质检与处置；在线抓取需另行配置。', requiredFields: ['评论内容'], optionalFields: ['记录日期', '情感', '处置状态'], recommended: '评论数量、情感分布与待处置情况', modulesJson: '["overview","data","metrics","comments","reports","settings"]' },
  { id: 'ad_performance', name: '投放分析项目', description: '接入授权投放日报，分析消耗、曝光、点击与效率。', requiredFields: ['日期', '花费', '曝光', '点击'], optionalFields: ['渠道', '账户', '目标'], recommended: '消耗、曝光、点击、点击率、渠道对比；不预设预算', modulesJson: '["overview","data","metrics","ads","reports","settings"]' },
];
export function templateGuide(id: string) { return TEMPLATE_GUIDES.find(t => t.id === id); }
