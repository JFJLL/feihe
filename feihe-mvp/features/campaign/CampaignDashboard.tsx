"use client";

import React, { useState, useMemo } from "react";
import type {
  CampaignDashboard as CampaignDashboardData,
  CampaignKpi,
  CampaignTable,
  CampaignActionItem,
  CampaignTableCategory,
  CampaignTableColumn,
  CampaignDashboardTabKey,
} from "../../lib/campaign-types";
import "./campaign.css";

export interface CampaignDashboardProps {
  dashboard: CampaignDashboardData;
  className?: string;
  initialTab?: CampaignDashboardTabKey | 'ads' | 'content';
  activeTab?: CampaignDashboardTabKey;
  controlledTab?: CampaignDashboardTabKey;
  onTabChange?: (tab: CampaignDashboardTabKey) => void;
}

interface KpiEvaluation {
  hasTarget: boolean;
  isAchieved: boolean | null;
  statusLabel: string;
  statusType: "success" | "warning" | "neutral" | "pending";
  progressPercent: number | null;
  progressFillWidth: number;
  progressText: string | null;
  targetDescription: string;
}

function getSafeUrl(url?: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

function evaluateKpi(kpi: CampaignKpi): KpiEvaluation {
  const hasTarget =
    kpi.target !== null &&
    kpi.target !== undefined &&
    (kpi.target as unknown) !== "" &&
    !isNaN(Number(kpi.target));
  if (!hasTarget) {
    return {
      hasTarget: false,
      isAchieved: null,
      statusLabel: "目标待补充",
      statusType: "pending",
      progressPercent: null,
      progressFillWidth: 0,
      progressText: null,
      targetDescription: "目标待补充",
    };
  }

  const target = Number(kpi.target);
  const unit = kpi.unit || "";
  const hasActual =
    kpi.value !== null &&
    kpi.value !== undefined &&
    (kpi.value as unknown) !== "" &&
    !isNaN(Number(kpi.value));
  const val = hasActual ? Number(kpi.value) : null;

  const op = kpi.comparison
    ? (kpi.comparison === "lt" ? "<" : kpi.comparison === "lte" ? "≤" : kpi.comparison === "gt" ? ">" : "≥")
    : (kpi.direction === "lower" ? "≤" : kpi.direction === "higher" ? "≥" : "");

  const formatTargetDesc = () => {
    if (kpi.direction === "neutral" && !kpi.comparison) {
      return "基准值: " + target + unit;
    }
    return op ? ("目标: " + op + " " + target + unit) : ("目标: " + target + unit);
  };

  if (val === null) {
    return {
      hasTarget: true,
      isAchieved: null,
      statusLabel: "实际值待录入",
      statusType: "pending",
      progressPercent: null,
      progressFillWidth: 0,
      progressText: null,
      targetDescription: formatTargetDesc(),
    };
  }

  // 中性基准：不判定达标状态，不计入达标数量
  if (kpi.direction === "neutral") {
    return {
      hasTarget: true,
      isAchieved: null,
      statusLabel: "基准参考",
      statusType: "neutral",
      progressPercent: null,
      progressFillWidth: 0,
      progressText: null,
      targetDescription: formatTargetDesc(),
    };
  }

  // 严格比较保持 source < 目标边界
  let isAchieved: boolean;
  if (kpi.comparison === "lt") {
    isAchieved = val < target;
  } else if (kpi.comparison === "lte") {
    isAchieved = val <= target;
  } else if (kpi.comparison === "gt") {
    isAchieved = val > target;
  } else if (kpi.comparison === "gte") {
    isAchieved = val >= target;
  } else if (kpi.direction === "lower") {
    isAchieved = val <= target;
  } else {
    isAchieved = val >= target;
  }

  const isLower =
    kpi.comparison === "lt" ||
    kpi.comparison === "lte" ||
    (!kpi.comparison && kpi.direction === "lower");

  if (isLower) {
    let ratio: number | null = null;
    if (target > 0 && val >= 0) {
      ratio = Math.round((val / target) * 100);
    }
    const fillWidth =
      ratio !== null ? Math.min(100, Math.max(0, ratio)) : isAchieved ? 50 : 100;
    const progressText = ratio !== null ? ("目标占用: " + ratio + "%") : null;

    const unachievedCostLabel =
      kpi.comparison === "lt" || val === target
        ? "未达到成本目标"
        : "高于控制目标";

    return {
      hasTarget: true,
      isAchieved,
      statusLabel: isAchieved ? "成本达标" : unachievedCostLabel,
      statusType: isAchieved ? "success" : "warning",
      progressPercent: ratio,
      progressFillWidth: fillWidth,
      progressText,
      targetDescription: formatTargetDesc(),
    };
  }

  let ratio: number | null = null;
  if (target > 0) {
    if (val >= 0) {
      ratio = Math.round((val / target) * 100);
    } else {
      ratio = 0;
    }
  }
  const fillWidth = ratio !== null ? Math.min(100, Math.max(0, ratio)) : 0;
  const progressText = ratio !== null ? ("达成率: " + ratio + "%") : null;

  return {
    hasTarget: true,
    isAchieved,
    statusLabel: isAchieved ? "达成目标" : "未达目标",
    statusType: isAchieved ? "success" : "warning",
    progressPercent: ratio,
    progressFillWidth: fillWidth,
    progressText,
    targetDescription: formatTargetDesc(),
  };
}

function renderCellValue(val: unknown, col: CampaignTableColumn) {
  if (val === null || val === undefined || val === "") {
    return <span className="campaign-text-muted">—</span>;
  }
  if (col.type === "currency") {
    const num = typeof val === "number" ? val : Number(val);
    if (!isNaN(num)) {
      return `¥${num.toLocaleString()}`;
    }
  }
  if (col.type === "percent") {
    const str = String(val);
    return str.endsWith("%") ? str : `${str}%`;
  }
  if (col.type === "badge") {
    return <span className="campaign-badge campaign-badge-slate">{String(val)}</span>;
  }
  if (typeof val === "number") {
    return val.toLocaleString();
  }
  return String(val);
}

function normalizeActionItem(item: CampaignActionItem | string): {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
} {
  if (typeof item === "string") {
    return { id: item, title: item };
  }
  return {
    id: item.id || item.title || item.text || "action-item",
    title: item.title || item.text || "未命名事项",
    description: item.description,
    owner: item.owner,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate,
  };
}

function isSummaryRow(row: Record<string, unknown>, nameKey: string): boolean {
  const label = String(row[nameKey] ?? "").trim().toLowerCase();
  return (
    /^(合计|总计|汇总|全部|总体|total|all|summary)$/i.test(label) ||
    label.includes("总计") ||
    label.includes("合计") ||
    label.includes("汇总")
  );
}


const SOURCE_STATUS_MAP: Record<string, string> = {
  ready: "已读取快照",
  manual: "日报补充",
  error: "读取异常/待核对",
  metadata_only: "仅文件信息",
  pending: "待读取",
  syncing: "读取中",
};

function formatSourceStatus(status: string): string {
  return SOURCE_STATUS_MAP[status] || status;
}

function findActualSpendColumn(columns: CampaignTableColumn[]): CampaignTableColumn | null {
  // 优先级 1: 明确标注实际消耗/实际花费/现消耗
  const explicitActual = columns.find((c) =>
    /actual_spend|actual_cost|实际消耗|实际花费|实际支出|实际投入|现消耗/i.test(`${c.key} ${c.title}`)
  );
  if (explicitActual) return explicitActual;

  // 优先级 2: 消耗/花费（显式排除计划预算 plan_budget、规划、预期）
  const generalSpend = columns.find((c) => {
    const combined = `${c.key} ${c.title}`.toLowerCase();
    const isSpend = /spend|cost|消耗|花费|支出/.test(combined);
    const isPlanned = /plan|规划|预期|预计|预设|上限/.test(combined);
    return isSpend && !isPlanned;
  });
  if (generalSpend) return generalSpend;

  // 优先级 3: 效果曝光/点击或通用数值，排除计划
  return (
    columns.find((c) => {
      const combined = `${c.key} ${c.title}`.toLowerCase();
      return !/plan|规划|预期|预计/.test(combined) && /amount|金额|曝光|点击/.test(combined);
    }) || null
  );
}


function resolveCampaignTabKey(tab?: CampaignDashboardTabKey | 'ads' | 'content'): CampaignDashboardTabKey {
  if (tab === 'ads') return 'tables';
  if (tab === 'content') return 'actions';
  return tab || 'overview';
}

export const CampaignDashboard: React.FC<CampaignDashboardProps> = (props) => {
  const data = props.dashboard ?? (props as { data?: CampaignDashboardData }).data;

  const effectiveControlledTab = props.activeTab ?? props.controlledTab;
  const [internalTab, setInternalTab] = useState<CampaignDashboardTabKey>(
    resolveCampaignTabKey(props.initialTab)
  );
  const currentTab = effectiveControlledTab ?? internalTab;

  const [prevInitialTab, setPrevInitialTab] = useState(props.initialTab);
  if (props.initialTab !== prevInitialTab) {
    setPrevInitialTab(props.initialTab);
    if (effectiveControlledTab === undefined && props.initialTab) {
      setInternalTab(resolveCampaignTabKey(props.initialTab));
    }
  }

  const handleTabChange = (tab: CampaignDashboardTabKey) => {
    if (effectiveControlledTab === undefined) {
      setInternalTab(tab);
    }
    props.onTabChange?.(tab);
  };

  // 风险预警默认折叠，避免长段数据声明占满首屏
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  // Hooks 均在条件 return 之前无条件执行，空安全
  const sources = useMemo(() => data?.sources ?? [], [data?.sources]);
  const kpis = useMemo(() => data?.kpis ?? [], [data?.kpis]);
  const tables = useMemo(() => data?.tables ?? [], [data?.tables]);
  const actions = data?.actions;

  // 按 kpi.period 提取可选统计期
  const availableKpiPeriods = useMemo(() => {
    const set = new Set<string>();
    kpis.forEach((k) => {
      const p = k.period?.trim();
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [kpis]);

  // 选择值在传入数据 period 不存在时安全退回全部（渲染派生，避免 useEffect 同步 setState 产生 lint 报警）
  const effectivePeriod = useMemo(() => {
    if (selectedPeriod === "all") return "all";
    if (availableKpiPeriods.includes(selectedPeriod)) return selectedPeriod;
    return "all";
  }, [selectedPeriod, availableKpiPeriods]);

  // 真实过滤 card 列表与显示数量
  const displayedKpis = useMemo(() => {
    if (effectivePeriod === "all") return kpis;
    return kpis.filter((k) => k.period?.trim() === effectivePeriod);
  }, [kpis, effectivePeriod]);
  const warnings = useMemo(() => data?.warnings ?? [], [data?.warnings]);

  // 最新资料读取时间
  
  // 当 kpis 或 tables 同时包含 manual 与 feishu 来源时，顶栏周期采用复合标注
  const displayReportPeriod = useMemo(() => {
    const provenances = new Set<string>();

    const checkProv = (prov?: unknown, sourceId?: string) => {
      if (typeof prov === "string") {
        provenances.add(prov);
      } else if (prov && typeof prov === "object" && "type" in prov) {
        provenances.add(String((prov as { type: string }).type));
      } else if (sourceId) {
        const s = sources.find((src) => src.id === sourceId);
        if (typeof s?.provenance === "string") {
          provenances.add(s.provenance);
        } else if (s?.provenance && typeof s.provenance === "object" && "type" in s.provenance) {
          provenances.add(String((s.provenance as { type: string }).type));
        }
      }
    };

    kpis.forEach((k) => checkProv(k.provenance, k.sourceId));
    tables.forEach((t) => checkProv(t.provenance, t.sourceId));

    if (provenances.has("manual") && provenances.has("feishu")) {
      return "多来源统计期 · 详见各项标注";
    }
    return data?.reportPeriod ?? "";
  }, [kpis, tables, sources, data?.reportPeriod]);

  const latestSourceSync = useMemo(() => {
    const dates = sources
      .map((s) => s.fetchedAt)
      .filter((d): d is string => Boolean(d));
    if (!dates.length) return null;
    return [...dates].sort().reverse()[0];
  }, [sources]);

  // 真实渠道对比提取（排除汇总行，优先选择 actual_spend/spend，明确注明指标）
  const channelBreakdown = useMemo(() => {
    const candidateTable =
      tables.find((t) => t.category === "budget" || t.category === "performance") ||
      tables.find((t) => /渠道|版位|平台|消耗|花费/.test(t.title)) ||
      tables[0];

    if (!candidateTable || !candidateTable.rows || candidateTable.rows.length === 0) {
      return null;
    }

    const nameCol =
      candidateTable.columns.find((c) =>
        /渠道|版位|平台|媒介|名称|类别|channel|placement|platform|name/i.test(c.title || c.key)
      ) || candidateTable.columns[0];

    const valCol = findActualSpendColumn(candidateTable.columns);

    if (!nameCol || !valCol) return null;

    const nonSummaryRows = candidateTable.rows.filter((r) => !isSummaryRow(r, nameCol.key));

    const parsedRows = nonSummaryRows
      .map((row) => {
        const rawVal = row[valCol.key];
        const num = typeof rawVal === "number" ? rawVal : Number(String(rawVal).replace(/[^\d.-]/g, ""));
        return {
          name: String(row[nameCol.key] ?? "-"),
          value: isNaN(num) ? null : num,
          rawDisplay: row[valCol.key],
        };
      })
      .filter((item) => item.value !== null && item.value > 0);

    if (!parsedRows.length) return null;

    const maxVal = Math.max(...parsedRows.map((r) => r.value as number));
    return {
      tableTitle: candidateTable.title,
      metricLabel: valCol.title || valCol.key,
      hasFilteredSummary: candidateTable.rows.length > nonSummaryRows.length,
      items: parsedRows.map((r) => ({
        ...r,
        percent: maxVal > 0 ? Math.round(((r.value as number) / maxVal) * 100) : 0,
      })),
    };
  }, [tables]);

  // 表格分类集合
  const availableTableCategories = useMemo(() => {
    const cats = new Set<CampaignTableCategory>();
    tables.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (tableCategoryFilter === "all") return tables;
    return tables.filter((t) => t.category === tableCategoryFilter);
  }, [tables, tableCategoryFilter]);

  // 按分类提取表格，供对应 Tab 专用渲染
  const executionTables = useMemo(
    () => tables.filter((t) => t.category === "execution"),
    [tables]
  );
  const kpiTables = useMemo(
    () => tables.filter((t) => t.category === "kpi"),
    [tables]
  );

  // 目标比较表 (KPI category) 在选择统计期时也按 exact period 过滤，不能只改按钮不改数据
  const displayedKpiTables = useMemo(() => {
    if (effectivePeriod === "all") return kpiTables;
    return kpiTables
      .map((t) => {
        const tablePeriod = t.period?.trim();
        if (tablePeriod === effectivePeriod) {
          return t;
        }
        const hasRowPeriod = t.rows.some(
          (r) =>
            typeof r.period === "string" ||
            typeof r["周期"] === "string" ||
            typeof r["统计期"] === "string"
        );
        if (hasRowPeriod) {
          const filteredRows = t.rows.filter((r) => {
            const rowP = (r.period || r["周期"] || r["统计期"]) as string | undefined;
            return rowP?.trim() === effectivePeriod;
          });
          if (filteredRows.length > 0) {
            return { ...t, rows: filteredRows };
          }
        }
        return null;
      })
      .filter((t): t is CampaignTable => t !== null);
  }, [kpiTables, effectivePeriod]);

  const renderPeriodFilter = (idPrefix: string) => {
    if (kpis.length === 0) return null;
    return (
      <div className="campaign-period-filter">
        <label htmlFor={idPrefix + "-period-select"} className="campaign-filter-label">
          统计期:
        </label>
        <select
          id={idPrefix + "-period-select"}
          className="campaign-select"
          value={effectivePeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          aria-label="按统计期筛选指标"
        >
          <option value="all">全部统计期 ({kpis.length})</option>
          {availableKpiPeriods.map((p) => {
            const count = kpis.filter((k) => k.period?.trim() === p).length;
            return (
              <option key={p} value={p}>
                {p} ({count})
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  const categoryNames: Record<CampaignTableCategory, string> = {
    budget: "预算明细",
    performance: "效果表现",
    execution: "执行进度",
    kpi: "指标复盘",
  };

  // 通用表格渲染函数
  const renderTableCard = (table: CampaignTable) => {
    const source = sources.find((s) => s.id === table.sourceId);
    const safeSourceUrl = getSafeUrl(source?.url);

    return (
      <div key={table.id} className="campaign-table-card">
        <div className="campaign-table-header">
          <div className="campaign-table-info">
            <h3 className="campaign-table-title">{table.title}</h3>
            {table.category && (
              <span className="campaign-badge campaign-badge-primary">
                {categoryNames[table.category] || table.category}
              </span>
            )}
            {table.period && (
              <span className="campaign-meta-refresh">业务周期: {table.period}</span>
            )}
          </div>
          <div className="campaign-table-source">
            {source ? (
              <>
                <span className="campaign-source-tag">资料来源: {source.name}</span>
                {safeSourceUrl && (
                  <a
                    href={safeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="campaign-source-url"
                  >
                    打开源表 ↗
                  </a>
                )}
              </>
            ) : table.sourceId ? (
              <span className="campaign-source-tag">来源: {table.sourceId}</span>
            ) : null}
          </div>
        </div>

        <div className="campaign-table-wrapper">
          <table className="campaign-table">
            <thead>
              <tr>
                {table.columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      textAlign: col.align || "left",
                      width: col.width,
                    }}
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.columns.length}
                    style={{ textAlign: "center", padding: "24px 0" }}
                    className="campaign-text-muted"
                  >
                    暂无明细数据
                  </td>
                </tr>
              ) : (
                table.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {table.columns.map((col) => (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align || "left" }}
                      >
                        {renderCellValue(row[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 渲染 KPI 卡片辅助函数（支持线上/日报双来源区分）
  const renderKpiCard = (kpi: CampaignKpi, isDetailedView = false) => {
    const evaluation = evaluateKpi(kpi);
    const source = sources.find((s) => s.id === kpi.sourceId);

    // 区分线上 vs 日报等来源类型
    const isOnline = source?.name?.includes("线上") || kpi.label?.includes("线上");
    const isDaily = source?.name?.includes("日报") || kpi.label?.includes("日报");
    const sourceBadgeClass = isOnline
      ? "campaign-badge-primary"
      : isDaily
      ? "campaign-badge-warning"
      : "campaign-badge-slate";

    return (
      <div key={kpi.id} className="campaign-kpi-card">
        <div className="campaign-kpi-header">
          <div className="campaign-kpi-header-left" style={{ minWidth: 0, flex: 1 }}>
            <div className="campaign-kpi-label">{kpi.label}</div>
            {/* 明确标注线上/日报或对应业务统计周期，避免两组CPUV误读 */}
            <div className="campaign-kpi-source-meta" style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px", minWidth: 0 }}>
              {source && (
                <span className={`campaign-badge campaign-kpi-source-badge ${sourceBadgeClass}`} style={{ maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" }}>
                  {source.name}
                </span>
              )}
              {kpi.period && (
                <span className="campaign-meta-refresh" style={{ fontSize: "11px" }}>
                  周期: {kpi.period}
                </span>
              )}
            </div>
          </div>
          <span className={`campaign-badge campaign-kpi-status-badge campaign-badge-${evaluation.statusType}`} style={{ flexShrink: 0 }}>
            {evaluation.statusLabel}
          </span>
        </div>
        <div className="campaign-kpi-value-row">
          <span className="campaign-kpi-value">
            {kpi.value !== null && kpi.value !== undefined
              ? kpi.value.toLocaleString()
              : "待补充"}
          </span>
          {kpi.unit && <span className="campaign-kpi-unit">{kpi.unit}</span>}
        </div>
        <div className="campaign-kpi-footer">
          <div className="campaign-kpi-target-row">
            <span>{evaluation.targetDescription}</span>
            {evaluation.progressText && (
              <strong>{evaluation.progressText}</strong>
            )}
          </div>
          {evaluation.progressPercent !== null && (
            <div className="campaign-progress-bar-bg">
              <div
                className={`campaign-progress-bar-fill ${evaluation.statusType}`}
                style={{ width: `${evaluation.progressFillWidth}%` }}
              />
            </div>
          )}
          {isDetailedView && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {kpi.direction && (
                <span className="campaign-meta-refresh">
                  方向: {kpi.direction === "lower" ? "成本越低越好" : kpi.direction === "higher" ? "越大越好" : "基准观察"}
                </span>
              )}
            </div>
          )}
          {kpi.note && (
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>
              说明: {kpi.note}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!data) {
    return (
      <div className={`campaign-dashboard-root ${props.className || ""}`.trim()}>
        <div className="campaign-section-card">
          <p className="campaign-text-muted">暂无看板数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`campaign-dashboard-root ${props.className || ""}`.trim()}>
      {/* 顶栏：项目名、周期、资料读取时间（去技术projectId） */}
      <header className="campaign-topbar">
        <div className="campaign-header-main">
          <div className="campaign-header-badge-row">
            <span className="campaign-template-pill">营销项目看板</span>
          </div>
          <h1 className="campaign-project-title">{data.name}</h1>
          {data.subtitle && <p className="campaign-project-subtitle">{data.subtitle}</p>}
        </div>
        <div className="campaign-header-meta">
          <div className="campaign-meta-badge">
            <span>业务统计周期:</span>
            <strong>{displayReportPeriod}</strong>
          </div>
          <div className="campaign-meta-refresh">
            {latestSourceSync ? `资料读取时间: ${latestSourceSync}` : `资料读取时间: ${data.updatedAt}`}
          </div>
        </div>
      </header>

      {/* Warnings 默认折叠：只显示数量与第一项摘要 */}
      {warnings.length > 0 && (
        <section className="campaign-warnings-card" aria-label="数据提示与注意事项">
          <div
            className="campaign-warnings-header"
            onClick={() => setWarningsOpen(!warningsOpen)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setWarningsOpen(!warningsOpen)}
          >
            <div className="campaign-warnings-title">
              <span>⚠️</span>
              <span>数据提示与注意事项 ({warnings.length}项)</span>
              {!warningsOpen && warnings[0] && (
                <span className="campaign-warning-summary-snippet">
                  ：{warnings[0].length > 42 ? `${warnings[0].slice(0, 42)}...` : warnings[0]}
                </span>
              )}
            </div>
            <button
              type="button"
              className="campaign-warnings-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setWarningsOpen(!warningsOpen);
              }}
            >
              {warningsOpen ? "收起 ▲" : "展开详情 ▼"}
            </button>
          </div>
          {warningsOpen && (
            <ul className="campaign-warnings-list">
              {warnings.map((w, idx) => (
                <li key={idx} className="campaign-warning-item">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tabs 导航 */}
      <nav className="campaign-tabs-nav" aria-label="看板导航">
        <button
          type="button"
          className={`campaign-tab-btn ${currentTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          总览
        </button>
        <button
          type="button"
          className={`campaign-tab-btn ${currentTab === "kpis" ? "active" : ""}`}
          onClick={() => handleTabChange("kpis")}
        >
          KPI进度
          {kpis.length > 0 && <span className="campaign-tab-count">{kpis.length}</span>}
        </button>
        <button
          type="button"
          className={`campaign-tab-btn ${currentTab === "tables" ? "active" : ""}`}
          onClick={() => handleTabChange("tables")}
        >
          投放明细
          {tables.length > 0 && <span className="campaign-tab-count">{tables.length}</span>}
        </button>
        <button
          type="button"
          className={`campaign-tab-btn ${currentTab === "actions" ? "active" : ""}`}
          onClick={() => handleTabChange("actions")}
        >
          执行优化
          {(actions?.items?.length || executionTables.length > 0) && (
            <span className="campaign-tab-count">
              {(actions?.items?.length ?? 0) + executionTables.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`campaign-tab-btn ${currentTab === "sources" ? "active" : ""}`}
          onClick={() => handleTabChange("sources")}
        >
          数据来源
          {sources.length > 0 && (
            <span className="campaign-tab-count">{sources.length}</span>
          )}
        </button>
      </nav>

      {/* Tab 内容 */}
      {currentTab === "overview" && (
        <main>
          {/* 核心指标概览 */}
          <div className="campaign-section-header" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="campaign-section-title">核心指标概览</h3>
              <p className="campaign-section-subtitle">
                重点投放与转化考核指标
              </p>
            </div>
            <div className="campaign-kpi-header-controls">
              {renderPeriodFilter("overview")}
              <span className="campaign-badge campaign-badge-primary">
                共 {displayedKpis.length} 项指标
              </span>
            </div>
          </div>

          {/* 核心指标卡 */}
          <div className="campaign-kpi-grid">
            {displayedKpis.length > 0 ? (
              displayedKpis.map((kpi) => renderKpiCard(kpi, false))
            ) : (
              <div
                className="campaign-text-muted"
                style={{ gridColumn: "1 / -1", padding: "16px 0", textAlign: "center" }}
              >
                当前统计期暂无指标数据
              </div>
            )}
          </div>

          {/* 渠道/版位实际消耗对比（依据真实数据行提取，已排除汇总行） */}
          {channelBreakdown && (
            <section className="campaign-section-card">
              <div className="campaign-section-header">
                <div>
                  <h3 className="campaign-section-title">渠道 / 版位消耗对比</h3>
                  <p className="campaign-section-subtitle">
                    数据提取自明细表「{channelBreakdown.tableTitle}」，指标：
                    <strong>{channelBreakdown.metricLabel}</strong>
                    {channelBreakdown.hasFilteredSummary && (
                      <span>（已排除汇总行，展示各子项真实明细）</span>
                    )}
                  </p>
                </div>
                <span className="campaign-badge campaign-badge-primary">实际消耗</span>
              </div>
              <div className="campaign-channel-bars">
                {channelBreakdown.items.map((item, idx) => (
                  <div key={idx} className="campaign-channel-bar-item">
                    <div className="campaign-channel-bar-labels">
                      <span className="campaign-channel-bar-name">{item.name}</span>
                      <span className="campaign-channel-bar-val">
                        {typeof item.rawDisplay === "number"
                          ? item.rawDisplay.toLocaleString()
                          : String(item.rawDisplay ?? item.value)}
                      </span>
                    </div>
                    <div className="campaign-channel-bar-track">
                      <div
                        className="campaign-channel-bar-inner"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {currentTab === "kpis" && (
        <section>
          {/* KPI Target 数值卡（支持线上11项等未来追加） */}
          <div className="campaign-section-header" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="campaign-section-title">目标与关键成果 (KPI 卡片)</h3>
              <p className="campaign-section-subtitle">
                核对各渠道/波段核心考核目标达成度，区分线上/日报不同口径
              </p>
            </div>
            <div className="campaign-kpi-header-controls">
              {renderPeriodFilter("kpis")}
              <span className="campaign-badge campaign-badge-primary">
                共 {displayedKpis.length} 项指标
              </span>
            </div>
          </div>
          <div className="campaign-kpi-grid" style={{ marginBottom: 24 }}>
            {displayedKpis.length > 0 ? (
              displayedKpis.map((kpi) => renderKpiCard(kpi, true))
            ) : (
              <div
                className="campaign-text-muted"
                style={{ gridColumn: "1 / -1", padding: "16px 0", textAlign: "center" }}
              >
                当前统计期暂无指标数据
              </div>
            )}
          </div>

          {/* 呈现 category 为 kpi 的复盘明细表格 */}
          {kpiTables.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="campaign-section-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="campaign-section-title">KPI 复盘明细表</h3>
                  <p className="campaign-section-subtitle">
                    各阶段与渠道目标分解明细与达成记录
                  </p>
                </div>
                {effectivePeriod !== "all" && (
                  <span className="campaign-badge campaign-badge-slate">
                    统计期: {effectivePeriod}
                  </span>
                )}
              </div>
              {displayedKpiTables.length > 0 ? (
                displayedKpiTables.map((table) => renderTableCard(table))
              ) : (
                <div className="campaign-table-card">
                  <p
                    className="campaign-text-muted"
                    style={{ textAlign: "center", margin: "16px 0" }}
                  >
                    当前统计期（{effectivePeriod}）暂无对应 KPI 复盘明细表
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {currentTab === "tables" && (
        <section>
          {availableTableCategories.length > 0 && (
            <div className="campaign-category-filters">
              <button
                type="button"
                className={`campaign-filter-pill ${tableCategoryFilter === "all" ? "active" : ""}`}
                onClick={() => setTableCategoryFilter("all")}
              >
                全部明细 ({tables.length})
              </button>
              {availableTableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`campaign-filter-pill ${tableCategoryFilter === cat ? "active" : ""}`}
                  onClick={() => setTableCategoryFilter(cat)}
                >
                  {categoryNames[cat] || cat} (
                  {tables.filter((t) => t.category === cat).length})
                </button>
              ))}
            </div>
          )}

          {filteredTables.map((table) => renderTableCard(table))}
        </section>
      )}

      {currentTab === "actions" && (
        <section>
          {/* 执行 Tab 同时渲染 category execution 的状态图/表 */}
          {executionTables.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="campaign-section-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="campaign-section-title">执行进度与状态表</h3>
                  <p className="campaign-section-subtitle">
                    当前执行波段、物料状态与落地节奏监控
                  </p>
                </div>
                <span className="campaign-badge campaign-badge-primary">
                  {executionTables.length} 个执行表
                </span>
              </div>
              {executionTables.map((table) => renderTableCard(table))}
            </div>
          )}

          {/* 执行优化与后续建议列表 */}
          <div className="campaign-section-card">
            <div className="campaign-section-header">
              <div>
                <h3 className="campaign-section-title">
                  {actions?.title || "执行优化与后续建议"}
                </h3>
                <p className="campaign-section-subtitle">
                  针对本轮战役表现与 KPI 缺口的策略优化与跟进行动
                </p>
              </div>
            </div>
            <div className="campaign-actions-list">
              {(!actions?.items || actions.items.length === 0) && (
                <p className="campaign-text-muted">暂无优化事项</p>
              )}
              {actions?.items?.map((rawItem, idx) => {
                const item = normalizeActionItem(rawItem);
                return (
                  <div key={item.id || idx} className="campaign-action-item">
                    <div className="campaign-action-left">
                      <span className="campaign-action-bullet" />
                      <div className="campaign-action-content">
                        <span className="campaign-action-title">{item.title}</span>
                        {item.description && (
                          <span className="campaign-action-desc">{item.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="campaign-action-meta">
                      {item.priority && (
                        <span
                          className={`campaign-badge ${
                            item.priority === "high"
                              ? "campaign-badge-danger"
                              : item.priority === "medium"
                              ? "campaign-badge-warning"
                              : "campaign-badge-slate"
                          }`}
                        >
                          {item.priority === "high"
                            ? "高优"
                            : item.priority === "medium"
                            ? "中优"
                            : "普通"}
                        </span>
                      )}
                      {item.status && (
                        <span className="campaign-badge campaign-badge-slate">
                          {item.status === "done"
                            ? "已完成"
                            : item.status === "in_progress"
                            ? "进行中"
                            : "待办"}
                        </span>
                      )}
                      {item.owner && (
                        <span className="campaign-source-tag">负责人: {item.owner}</span>
                      )}
                      {item.dueDate && (
                        <span className="campaign-meta-refresh">截止: {item.dueDate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {currentTab === "sources" && (
        <section>
          <div className="campaign-sources-grid">
            {sources.map((source) => {
              const safeUrl = getSafeUrl(source?.url);
              return (
                <div key={source.id} className="campaign-source-card">
                  <div>
                    <div className="campaign-source-card-header">
                      <h4 className="campaign-source-name">{source.name}</h4>
                      <span
                        className={`campaign-badge ${
                          source.status === "ready" || source.status === "syncing"
                            ? "campaign-badge-success"
                            : source.status === "error"
                            ? "campaign-badge-danger"
                            : "campaign-badge-slate"
                        }`}
                      >
                        {formatSourceStatus(source.status)}
                      </span>
                    </div>
                    {source.detail && (
                      <p className="campaign-source-detail" style={{ marginTop: 8 }}>
                        {source.detail}
                      </p>
                    )}
                  </div>
                  <div className="campaign-source-footer">
                    <span>
                      {source.fetchedAt ? `资料读取: ${source.fetchedAt}` : "按需手工录入"}
                    </span>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="campaign-link-button"
                      >
                        访问数据源 ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default CampaignDashboard;
