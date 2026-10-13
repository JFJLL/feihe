import { db, ensureSchema } from './db';

export interface DatasetColumn {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'category';
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

export function inferColumnType(values: unknown[]): 'text' | 'number' | 'date' | 'boolean' | 'category' {
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'text';

  const isNum = nonNull.every((v) => {
    const s = String(v).replace(/[,￥¥%]/g, '').trim();
    return Number.isFinite(Number(s));
  });
  if (isNum) return 'number';

  const isDate = nonNull.every((v) => {
    const s = String(v).trim();
    return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s) || /^\d{1,2}[-/.]\d{1,2}/.test(s);
  });
  if (isDate) return 'date';

  const isBool = nonNull.every((v) => /^(true|false|是|否|1|0)$/i.test(String(v).trim()));
  if (isBool) return 'boolean';

  return 'text';
}

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

  // Infer columns if not provided, gathering all unique keys from all rows
  let columns: DatasetColumn[] = customColumns || [];
  if (!columns.length && rows.length > 0) {
    const keySet = new Set<string>();
    for (const r of rows) {
      if (r && typeof r === "object") {
        for (const k of Object.keys(r)) {
          if (k) keySet.add(k);
        }
      }
    }
    const keys = Array.from(keySet);
    columns = keys.map((key) => {
      const sample = rows.slice(0, 100).map((r) => r[key]);
      return {
        key,
        name: key,
        type: inferColumnType(sample),
      };
    });
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
