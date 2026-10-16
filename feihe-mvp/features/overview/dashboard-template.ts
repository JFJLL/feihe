export type DashboardPresetKind = 'marketing' | 'general' | 'comment_qc' | 'ad_performance';

export interface DashboardPreset {
  kind: DashboardPresetKind;
  eyebrow: string;
  defaultSubtitle: string;
  themeTag: string;
  showModuleTabs: boolean;
}

export function resolveDashboardPreset(templateId?: string): DashboardPreset {
  if (templateId === 'content_marketing') {
    return {
      kind: 'marketing',
      eyebrow: 'BUSINESS · 营销业务',
      defaultSubtitle: '业务日报、投流效果与执行进度',
      themeTag: 'marketing',
      showModuleTabs: true,
    };
  }
  if (templateId === 'comment_qc') {
    return {
      kind: 'comment_qc',
      eyebrow: 'COMMENT QC · 评论口碑质检看板',
      defaultSubtitle: '本项目评论记录、来源标注与处置状态',
      themeTag: 'comment_qc',
      showModuleTabs: false,
    };
  }
  if (templateId === 'ad_performance') {
    return {
      kind: 'ad_performance',
      eyebrow: 'AD PERFORMANCE · 投放效果分析看板',
      defaultSubtitle: '本项目投放消耗、点击效率与渠道对比',
      themeTag: 'ad_performance',
      showModuleTabs: false,
    };
  }
  return {
    kind: 'general',
    eyebrow: 'PROJECT DASHBOARD · 通用数据工作台',
    defaultSubtitle: '结构化数据集与度量监控看板',
    themeTag: 'general',
    showModuleTabs: false,
  };
}

export function getProjectThemeTag(templateId?: string): string {
  return resolveDashboardPreset(templateId).themeTag;
}

