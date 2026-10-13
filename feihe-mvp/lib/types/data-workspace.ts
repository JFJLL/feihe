import type { Dataset } from '../datasets';

export type DatasetUse = { id: string; name: string; kind: 'metric' | 'card'; datasetId: string };
export type WorkspaceSource = {
  id: string; name: string; type: string; spreadsheet: string; sheetId: string;
  range: string; status: string; lastError: string; lastSyncedAt?: string;
  lastRowCount: number; syncFrequency: string; scheduleEnabled: number; isPaused: number;
  datasetIds: string[]; uses: DatasetUse[];
};
export type SourceRun = {
  id: string; sourceId: string; sourceName: string; status: string;
  rowsRead: number; rowsImported: number; rowsFailed: number;
  errorSummary: string; startedAt: string; finishedAt?: string;
  scope: 'full_table' | 'limited_range' | 'unknown'; range: string;
};
export type DatasetQuality = {
  datasetId: string; version: number; checkedRows: number;
  fields: Array<{ key: string; name: string; type: string; missing: number; invalid: number }>;
};
export type DataWorkspaceState = {
  projectId: string; datasets: Dataset[]; sources: WorkspaceSource[];
  runs: SourceRun[]; uses: DatasetUse[]; quality?: DatasetQuality;
};
