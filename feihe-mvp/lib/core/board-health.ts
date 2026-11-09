/**
 * Dashboard Health Check System
 * Inspired by Tencent Beacon [DashboardHealth] runtime verification.
 *
 * Verifies:
 * 1. Query existence: every component.query must exist in BoardPayload.datasets.
 * 2. Field existence: field, xField, yField must exist in the dataset's columns.
 * 3. Non-empty charts: chart datasets must not be empty or have all-null series.
 * 4. Ratio normalization: percentage metrics must be normalized (0~1 for 'ratio' or declared 'points').
 * 5. Balanced layouts: paired-metrics and top metric grids must not leave an odd orphan card.
 */

import type { BoardPayload, ComponentInstanceSpec, SectionSpec } from './types';

export interface HealthIssue {
  severity: 'error' | 'warning';
  code: string;
  componentId?: string;
  sectionId?: string;
  queryId?: string;
  message: string;
  remediation: string;
}

export interface HealthReport {
  ok: boolean;
  errors: HealthIssue[];
  warnings: HealthIssue[];
  summary: string;
}

export function validateBoardHealth(payload: BoardPayload): HealthReport {
  const errors: HealthIssue[] = [];
  const warnings: HealthIssue[] = [];

  const datasets = payload.datasets || {};
  const sections = payload.sections || [];

  // Flatten all component instances
  const flatComponents: Array<{ comp: ComponentInstanceSpec; section: SectionSpec }> = [];
  function collectComponents(secs: SectionSpec[]) {
    for (const sec of secs) {
      if (sec.components) {
        for (const comp of sec.components) {
          flatComponents.push({ comp, section: sec });
        }
      }
      if (sec.tabs) {
        for (const tab of sec.tabs) {
          collectComponents(tab.sections || []);
        }
      }
    }
  }
  collectComponents(sections);

  // 1. Query & Field existence
  for (const { comp, section } of flatComponents) {
    if (!comp.query) {
      errors.push({
        severity: 'error',
        code: 'MISSING_QUERY',
        componentId: comp.id,
        sectionId: section.id,
        message: `组件 "${comp.id}" (${comp.type}) 未绑定 query 数据集 ID`,
        remediation: `在 transform.ts 中为组件 "${comp.id}" 指定 query: "<datasetId>"，并在 datasets 中定义该表。`,
      });
      continue;
    }

    const dataset = datasets[comp.query];
    if (!dataset) {
      errors.push({
        severity: 'error',
        code: 'QUERY_NOT_FOUND',
        componentId: comp.id,
        sectionId: section.id,
        queryId: comp.query,
        message: `组件 "${comp.id}" 绑定的数据集 "${comp.query}" 不存在于 datasets 中`,
        remediation: `在 transform.ts 的 datasets 字典中添加键 "${comp.query}"，或检查拼写。`,
      });
      continue;
    }

    const colKeys = new Set((dataset.columns || []).map((c) => c.key));
    const fieldsToCheck = [
      { name: 'field', val: comp.field },
      { name: 'xField', val: comp.xField },
      { name: 'yField', val: comp.yField },
      { name: 'categoryField', val: comp.categoryField },
      { name: 'targetField', val: comp.targetField },
    ];

    for (const { name, val } of fieldsToCheck) {
      if (val && !colKeys.has(val)) {
        errors.push({
          severity: 'error',
          code: 'FIELD_NOT_FOUND',
          componentId: comp.id,
          sectionId: section.id,
          queryId: comp.query,
          message: `组件 "${comp.id}" 指定的 ${name}="${val}" 不在数据集 "${comp.query}" 的列定义中`,
          remediation: `检查数据集 "${comp.query}" 的 columns 声明，确保包含 key: "${val}"。`,
        });
      }
    }

    // 2. Empty charts check
    if (comp.type.includes('chart') || comp.type === 'line-bar-combo' || comp.type === 'time-series' || comp.type === 'donut-rose') {
      const rows = dataset.rows || [];
      if (rows.length === 0) {
        warnings.push({
          severity: 'warning',
          code: 'EMPTY_CHART_DATASET',
          componentId: comp.id,
          sectionId: section.id,
          queryId: comp.query,
          message: `图表组件 "${comp.id}" 绑定的数据集 "${comp.query}" 行数为 0`,
          remediation: `确保源表抓取到真实记录，或提供有代表性的回退/空态样本。`,
        });
      } else if ((comp.type === 'line-bar-combo' || comp.type === 'time-series') && rows.length < 2) {
        warnings.push({
          severity: 'warning',
          code: 'INSUFFICIENT_TREND_POINTS',
          componentId: comp.id,
          sectionId: section.id,
          queryId: comp.query,
          message: `趋势图组件 "${comp.id}" 绑定的数据集 "${comp.query}" 仅有 ${rows.length} 行数据 (< 2)`,
          remediation: `时序折线/趋势图至少需要 2 个以上连续时间点，单点数据建议降级为 metric-card 或数据摘要卡片展示。`,
        });
      } else if (comp.yField) {
        const allNull = rows.every((r) => r[comp.yField!] === null || r[comp.yField!] === undefined);
        if (allNull) {
          warnings.push({
            severity: 'warning',
            code: 'ALL_NULL_SERIES',
            componentId: comp.id,
            sectionId: section.id,
            queryId: comp.query,
            message: `图表组件 "${comp.id}" 的 Y 轴指标 "${comp.yField}" 在所有 ${rows.length} 行数据中全为 null`,
            remediation: `检查 transform.ts 中的字段清洗逻辑，确保 "${comp.yField}" 提取到真实有效数值。`,
          });
        }
      }
    }
  }

  // 3. Ratio Normalization check
  for (const [dsId, ds] of Object.entries(datasets)) {
    for (const col of ds.columns || []) {
      if (col.format === 'percent') {
        for (let i = 0; i < Math.min(ds.rows.length, 50); i++) {
          const val = ds.rows[i]?.[col.key];
          if (typeof val === 'number') {
            if (col.percentInput === 'points' && val > 1000) {
              warnings.push({
                severity: 'warning',
                code: 'ABNORMAL_PERCENT_VALUE',
                queryId: dsId,
                message: `数据集 "${dsId}" 的百分比列 "${col.key}" 出现异常高值 (${val})`,
                remediation: `若该字段为 85.5% 请确认其数值为 0.855 (ratio) 或 85.5 (points)，并在 ColumnDef 中显式设置 percentInput。`,
              });
              break;
            } else if ((!col.percentInput || col.percentInput === 'ratio') && val > 1.01 && val <= 100) {
              warnings.push({
                severity: 'warning',
                code: 'UNNORMALIZED_RATIO',
                queryId: dsId,
                message: `数据集 "${dsId}" 列 "${col.key}" 声明为 percent (ratio)，但检测到数值 ${val} > 1。`,
                remediation: `若源数据为百分点 (如 12.5 代表 12.5%)，请在 transform.ts 中除以 100 归一化，或在列声明中设置 percentInput: 'points'。`,
              });
              break;
            }
          }
        }
      }
    }
  }

  // 4. Paired metrics & Grid balance check
  for (const sec of sections) {
    if (sec.layout === 'paired-metrics' || (sec.layout === 'grid' && sec.components.every((c) => c.type === 'metric-card'))) {
      const count = sec.components.length;
      if (count > 0 && count % 2 !== 0) {
        warnings.push({
          severity: 'warning',
          code: 'ODD_METRICS_COUNT',
          sectionId: sec.id,
          message: `指标卡区域 "${sec.id}" 包含奇数张 (${count} 个) 指标卡，在双列网格下会留下孤立项`,
          remediation: `建议在 section "${sec.id}" 中补充指标卡配成偶数对（如 2 张或 4 张），符合成对排版纪律。`,
        });
      }
    }

    // 5. Chart section hint or description check
    const hasCharts = sec.components.some(c =>
      c.type.includes('chart') ||
      c.type === 'line-bar-combo' ||
      c.type === 'donut-rose' ||
      c.type === 'target-bullet' ||
      c.type === 'capability-radar' ||
      c.type === 'pareto-chart' ||
      c.type === 'contribution-waterfall'
    );
    if (hasCharts && !sec.hint && !sec.description) {
      warnings.push({
        severity: 'warning',
        code: 'MISSING_SECTION_HINT',
        sectionId: sec.id,
        message: `图表区块 "${sec.id}" 未填写 hint 或 description 读法导读说明`,
        remediation: `在 SectionSpec 中补充 hint 导读说明（如“按互动降序，前20%达人贡献80%效果”），提升看板可读性。`,
      });
    }
  }

  // 6. 3-Tab Completeness Check (overview, ads, content)
  const tabKeysPresent = new Set<string>();
  for (const s of sections) {
    if (s.tab) tabKeysPresent.add(s.tab);
    if (s.id) {
      if (s.id.includes('overview') || s.id.includes('summary')) tabKeysPresent.add('overview');
      if (s.id.includes('ads') || s.id.includes('placement') || s.id.includes('channel')) tabKeysPresent.add('ads');
      if (s.id.includes('content') || s.id.includes('notes') || s.id.includes('comments')) tabKeysPresent.add('content');
    }
    if (s.tabs) {
      for (const t of s.tabs) tabKeysPresent.add(t.id);
    }
  }

  const coreTabs = ['overview', 'ads', 'content'];
  for (const t of coreTabs) {
    if (!tabKeysPresent.has(t)) {
      warnings.push({
        severity: 'warning',
        code: 'MISSING_CORE_TAB_SECTION',
        message: `未检测到栏目 "${t}" 的专属内容区块`,
        remediation: `建议在 transform.ts 中为 sections 配置 tab: "${t}" 区块，保证总览、版位投放与内容执行三栏结构完整。`,
      });
    }
  }

  const ok = errors.length === 0;
  const summary = `[DashboardHealth] 项目 ${payload.projectId} 体检完成: ${ok ? '✓ PASS' : '✗ FAILED'} (${errors.length} 错误, ${warnings.length} 警示)`;

  return { ok, errors, warnings, summary };
}

export function formatHealthReport(report: HealthReport): string {
  const lines: string[] = [report.summary];
  if (report.errors.length > 0) {
    lines.push('\n[CRITICAL ERRORS 需立即修复]:');
    for (const e of report.errors) {
      lines.push(`  - [${e.code}] ${e.message}`);
      lines.push(`    -> 修复指引: ${e.remediation}`);
    }
  }
  if (report.warnings.length > 0) {
    lines.push('\n[WARNINGS 建议优化]:');
    for (const w of report.warnings) {
      lines.push(`  - [${w.code}] ${w.message}`);
      lines.push(`    -> 优化建议: ${w.remediation}`);
    }
  }
  return lines.join('\n');
}
