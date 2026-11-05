/**
 * Universal Board Runtime Protocol & Schema Definitions
 * Inspired by Tencent Beacon (灯塔) QueryRegistry and Component Architecture.
 */

export type ColumnType = 'string' | 'number' | 'date' | 'badge' | 'boolean';

export type ColumnFormat = 'number' | 'integer' | 'currency' | 'percent';

export type PercentInput = 'ratio' | 'points';

export interface ColumnDef {
  key: string;
  label: string;
  type?: ColumnType;
  format?: ColumnFormat;
  percentInput?: PercentInput;
  decimals?: number;
  displayUnits?: string;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  role?: 'TIMESTAMP' | 'DIMENSION' | 'METRIC' | 'RATIO';
  description?: string;
}

export interface DatasetTable {
  id: string;
  name?: string;
  description?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  totalRows?: number;
  period?: string;
  sourceId?: string;
  sourceUrl?: string;
  meta?: Record<string, unknown>;
}

export type ComponentType =
  | 'metric-card'
  | 'data-table'
  | 'date-range-filter'
  | 'select-filter'
  | 'line-bar-combo'
  | 'time-series'
  | 'target-bullet'
  | 'multi-line-deck'
  | 'donut-rose'
  | 'percent-stack'
  | 'capability-radar'
  | 'pareto-chart'
  | 'effect-scatter'
  | 'distribution-histogram'
  | 'grouped-boxplot'
  | 'comment-qc-panel'
  | 'analysis-insight-card';

export interface ComponentInstanceSpec {
  id: string;
  type: ComponentType | string;
  title?: string;
  subtitle?: string;
  query: string; // references datasetId in datasets
  field?: string;
  xField?: string;
  yField?: string;
  y2Field?: string;
  categoryField?: string;
  seriesFields?: string[];
  targetField?: string;
  deltaField?: string;
  detailFields?: string[]; // Clickable drilldown sample columns
  direction?: 'higher' | 'lower' | 'neutral';
  props?: Record<string, unknown>;
  width?: 'full' | 'half' | 'third' | 'two-thirds' | 'quarter' | number;
}

export type SectionLayout = 'stack' | 'grid' | 'tabs' | 'paired-metrics';

export interface SectionTabSpec {
  id: string;
  title: string;
  icon?: string;
  sections: SectionSpec[];
}

export interface SectionSpec {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  layout?: SectionLayout;
  columns?: number;
  components: ComponentInstanceSpec[];
  tabs?: SectionTabSpec[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface AnalysisCardSpec {
  id: string;
  targetQueryIds: string[];
  type?: 'insight' | 'warning' | 'action';
  title: string;
  summary: string;
  recommendations?: string[];
  severity?: 'info' | 'warning' | 'critical' | 'success';
  evidence?: Array<{ label: string; value: string | number }>;
}

export interface BoardActionItem {
  id?: string;
  text: string;
  owner?: string;
  status?: 'todo' | 'in_progress' | 'done' | string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
}

export interface BoardSource {
  id: string;
  name: string;
  url?: string;
  type?: 'feishu_sheet' | 'feishu_bitable' | 'excel' | 'csv' | 'manual';
  status: string;
  detail?: string;
  fetchedAt?: string | null;
}

export interface BoardPayload {
  projectId: string;
  name: string;
  brand: string;
  spu?: string;
  category?: string;
  themeColor?: string;
  reportPeriod?: string;
  updatedAt?: string;
  mode?: string;
  datasets: Record<string, DatasetTable>;
  sections: SectionSpec[];
  analysisCards?: AnalysisCardSpec[];
  warnings?: string[];
  actions?: {
    title: string;
    items: BoardActionItem[];
  };
  sources?: BoardSource[];
  kpis?: unknown[];
  tables?: unknown[];
  dailyDatasets?: unknown[];
}

export interface ProjectManifest {
  id: string;
  name: string;
  brand: string;
  spu: string;
  category: string;
  color: string;
  defaultReportPeriod: string;
  templateId?: string;
  mode?: string;
  subtitle?: string;
  description?: string;
  enabledTabs?: Array<{ key: string; label: string; icon?: string; desc?: string }>;
}

export interface ProjectSourceConfig {
  id: string;
  name: string;
  type: 'feishu_sheet' | 'feishu_bitable' | 'excel' | 'csv' | 'manual';
  url?: string;
  filePath?: string;
  spreadsheetToken?: string;
  sheetId?: string;
  appToken?: string;
  tableId?: string;
  description?: string;
}

export interface ProjectSources {
  projectId: string;
  sources: ProjectSourceConfig[];
}
