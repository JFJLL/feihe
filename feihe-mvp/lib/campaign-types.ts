/**
 * Shared types for Campaign Review (战役复盘) dashboards.
 * Template: campaign_review
 */

export type CampaignProjectId = 'kailas' | 'meiling' | 'winner-wipes';

export type CampaignTemplateId = 'campaign_review';

export type CampaignDashboardTabKey =
  | 'overview'
  | 'kpis'
  | 'tables'
  | 'actions'
  | 'sources';

/**
 * Data provenance classification:
 * - 'manual': Manual data entry, CSV/Excel upload, or local curated snapshot.
 * - 'feishu': Auto or semi-auto sync from Feishu Bitable / Sheets.
 */
export type CampaignProvenanceType = 'manual' | 'feishu';

export interface CampaignProvenance {
  type: CampaignProvenanceType;
  sourceName?: string;
  externalId?: string;
  syncedAt?: string | null;
  operator?: string;
  note?: string;
}

export type CampaignSourceStatus =
  | 'ready'
  | 'pending'
  | 'error'
  | 'syncing'
  | 'manual'
  | string;

export interface CampaignSource {
  id: string;
  name: string;
  url?: string;
  status: CampaignSourceStatus;
  detail?: string;
  fetchedAt?: string | null;
  provenance?: CampaignProvenanceType | CampaignProvenance;
}

export type KpiDirection = 'lower' | 'higher' | 'neutral';

export type KpiComparison = 'lt' | 'lte' | 'gt' | 'gte';

export interface CampaignKpi {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  target: number | null;
  direction: KpiDirection;
  comparison?: KpiComparison;
  sourceId?: string;
  period?: string;
  note?: string;
  provenance?: CampaignProvenanceType;
}

export type CampaignTableCategory = 'budget' | 'performance' | 'execution' | 'kpi';

export type CampaignTableColumnAlign = 'left' | 'center' | 'right';

export interface CampaignTableColumn {
  key: string;
  title: string;
  type?: 'string' | 'number' | 'percent' | 'currency' | 'date' | 'badge';
  align?: CampaignTableColumnAlign;
  width?: number | string;
}

export type CampaignTableRow = Record<string, unknown>;

export interface CampaignTable {
  id: string;
  title: string;
  period?: string;
  sourceId?: string;
  category?: CampaignTableCategory;
  columns: CampaignTableColumn[];
  rows: CampaignTableRow[];
  provenance?: CampaignProvenanceType;
  note?: string;
  sourceUrl?: string;
}

export interface CampaignActionItem {
  id?: string;
  title?: string;
  text?: string;
  description?: string;
  owner?: string;
  status?: 'todo' | 'in_progress' | 'done' | string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
}

export interface CampaignActions {
  title: string;
  items: (CampaignActionItem | string)[];
}

export interface CampaignDailyMetric {
  key: string;
  label: string;
  unit?: string;
}

export interface CampaignDailyRow {
  date: string; // ISO date string: YYYY-MM-DD
  [key: string]: string | number | null;
}

export interface CampaignDailyDataset {
  id: string;
  label: string;
  period: string;
  sourceId?: string;
  sourceUrl?: string;
  note?: string;
  metrics: CampaignDailyMetric[];
  rows: CampaignDailyRow[];
}

export interface CampaignDashboard {
  projectId: string;
  name: string;
  subtitle?: string;
  reportPeriod: string;
  updatedAt: string;
  templateId?: CampaignTemplateId | string;
  provenance?: CampaignProvenanceType | CampaignProvenance;
  sources: CampaignSource[];
  kpis: CampaignKpi[];
  tables: CampaignTable[];
  actions: CampaignActions;
  warnings: string[];
  dailyDatasets?: CampaignDailyDataset[];
}

export interface CampaignProjectMeta {
  id: CampaignProjectId;
  name: string;
  brand: string;
  subtitle: string;
  description: string;
  templateId: CampaignTemplateId;
  color?: string;
  category?: string;
  defaultReportPeriod?: string;
}
