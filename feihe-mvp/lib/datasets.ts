import { db, ensureSchema } from './db';
import { parseNumericValue, percentagePointsToFraction } from './numeric-values';

export interface DatasetColumn {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'category';
  numericUnit?: 'number' | 'percent';
  percentScale?: 'fraction' | 'percentage_points';
}

export interface Dataset {
  id: string;
  projectId: string;
  sourceId: string;
  name: string;
  schemaJson: string;
  columns: DatasetColumn[];
  rowCount: number;
  version: number;
  updatedAt: string;
  rows?: Array<Record<string, unknown>>;
}

export { inferColumnType } from './column-types';
import { inferColumnType } from './column-types';

export async function saveDataset(
  projectId: string,
  sourceId: string,
  name: string,
  rows: Array<Record<string, unknown>>,
  customColumns?: DatasetColumn[]
): Promise<Dataset> {
  await ensureSchema();
  const d1 = db();
  const now = new Date().toISOString();
  const datasetId = `ds-${projectId}-${sourceId || 'default'}`;

  // Every stored field has visible metadata; labels and storage keys stay separate.
  const columns: DatasetColumn[] = (customColumns || []).map(c => ({ ...c }));
  for (const column of columns) {
    if (column.type === 'number' && column.numericUnit !== 'percent' && rows.some(row => typeof row[column.key] === 'string' && /%$/.test(String(row[column.key]).trim()))) throw new Error(`字段 ${column.key} 含百分比文本，请明确声明百分比数值口径`);
  }
  const seen = new Set(columns.map(c => c.key));
  if (seen.size !== columns.length) throw new Error('目标字段重名');
  for (const key of new Set(rows.flatMap(row => Object.keys(row)))) {
    if (seen.has(key)) continue;
    const values = rows.map(row => row[key]);
    const type = inferColumnType(values);
    const taggedPercent = type === 'number' && values.some(value => typeof value === 'string' && /%$/.test(value.trim()));
    if (taggedPercent && values.some(value => value !== null && value !== undefined && String(value).trim() && !(typeof value === 'string' && /%$/.test(value.trim())))) throw new Error(`字段 ${key} 混合百分比文本和普通数值，请声明来源数值单位`);
    columns.push({ key, name: key, type, ...(taggedPercent ? { numericUnit: 'percent', percentScale: 'fraction' } : {}) });
    seen.add(key);
  }

  // Import mapping already emits fractions; explicit points on a direct write are normalized once.
  const percentColumns = columns.filter(column => column.numericUnit === 'percent');
  if (percentColumns.length) {
    rows = rows.map((row, index) => {
      const normalized = { ...row };
      for (const column of percentColumns) {
        if (column.type !== 'number' || !['fraction', 'percentage_points'].includes(column.percentScale || '')) throw new Error(`字段 ${column.key} 请声明合法百分比数值口径`);
        const raw = row[column.key];
        if (raw === undefined || raw === null || String(raw).trim() === '') continue;
        const value = parseNumericValue(raw);
        if (value === null) throw new Error(`第 ${index + 1} 行「${column.key}」包含非法百分比数值`);
        normalized[column.key] = column.percentScale === 'percentage_points' && !(typeof raw === 'string' && /%$/.test(raw.trim())) ? percentagePointsToFraction(value) : value;
      }
      return normalized;
    });
    for (const column of percentColumns) column.percentScale = 'fraction';
  }

  const schemaJson = JSON.stringify(columns);

  // Read existing dataset metadata to determine version
  const existing = await d1
    .prepare("SELECT id, row_count AS rowCount, version, created_at AS createdAt, updated_at AS updatedAt FROM datasets WHERE id=?")
    .bind(datasetId)
    .first<{ id: string; rowCount: number; version: number; createdAt: string; updatedAt: string }>();

  const newVersion = (existing?.version || 0) + 1;
  const createdAt = existing?.createdAt || now;
  const stagingId = datasetId + "_staging_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

  // 1. Prepare statements for staging rows (does NOT touch existing dataset data)
  const statements: Array<{ run(): Promise<unknown> }> = [];
  for (const [index, row] of rows.entries()) {
    const rowKey = datasetId + ":v" + newVersion + ":r" + (index + 1);
    statements.push(
      d1
        .prepare("INSERT INTO dataset_rows(id, dataset_id, project_id, source_id, row_key, data_json, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(rowKey, stagingId, projectId, sourceId || "default", String(index + 1), JSON.stringify(row), now, now)
    );
  }

  // 2. Insert into staging table in batches; clean up staging on failure without affecting old data
  try {
    for (let i = 0; i < statements.length; i += 80) {
      await d1.batch(statements.slice(i, i + 80));
    }
  } catch (err) {
    try {
      await d1.prepare("DELETE FROM dataset_rows WHERE dataset_id=?").bind(stagingId).run();
    } catch {}
    throw err;
  }

  // 3. Atomic switchover: replace old rows with staging rows and update dataset metadata
  try {
    await d1.batch([
      d1.prepare("DELETE FROM dataset_rows WHERE dataset_id=?").bind(datasetId),
      d1.prepare("UPDATE dataset_rows SET dataset_id=? WHERE dataset_id=?").bind(datasetId, stagingId),
      d1.prepare(
        "INSERT INTO datasets(id, project_id, source_id, name, schema_json, row_count, version, created_at, updated_at)" +
        " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)" +
        " ON CONFLICT(id) DO UPDATE SET" +
        " name=excluded.name, schema_json=excluded.schema_json, row_count=excluded.row_count, version=excluded.version, updated_at=excluded.updated_at"
      ).bind(datasetId, projectId, sourceId || "default", name || "通用数据集", schemaJson, rows.length, newVersion, createdAt, now),
    ]);
  } catch (err) {
    try { await d1.prepare("DELETE FROM dataset_rows WHERE dataset_id=?").bind(stagingId).run(); } catch {}
    throw err;
  }

  return {
    id: datasetId,
    projectId,
    sourceId,
    name,
    schemaJson,
    columns,
    rowCount: rows.length,
    version: newVersion,
    updatedAt: now,
  };
}

export async function getProjectDatasets(projectId: string): Promise<Dataset[]> {
  await ensureSchema();
  const d1 = db();
  const rows = await d1
    .prepare('SELECT id, project_id AS projectId, source_id AS sourceId, name, schema_json AS schemaJson, row_count AS rowCount, version, updated_at AS updatedAt FROM datasets WHERE project_id=? ORDER BY updated_at DESC')
    .bind(projectId)
    .all<Dataset>();

  return (rows.results || []).map((d) => {
    let columns: DatasetColumn[] = [];
    try {
      columns = JSON.parse(d.schemaJson || '[]');
    } catch {}
    return { ...d, columns };
  });
}
