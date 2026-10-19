/**
 * Online adapter for Kailas (凯乐石) Campaign Dashboard.
 *
 * Implements pure function `applyKailasSnapshot` dynamically reading
 * `docs/new-projects-sources/kailas-sheets.json` without hardcoding values.
 */

import type {
  CampaignDashboard,
  CampaignSource,
  CampaignTable,
  CampaignTableRow,
} from './campaign-types';

export interface KailasSnapshotPayload {
  readAt?: string;
  extra_files?: Array<{ token?: string; title?: string; URL?: string; access_status?: string; readAt?: string }>;
  unauthorized_nodes?: Array<{ token?: string; access_status?: string; message?: string }>;
  sheets?: Array<{ sheetId?: string; tabName?: string; URL?: string; readAt?: string; value?: unknown[][] }>;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const n = Number(String(val).replace(/[¥,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const PREFIX = 'kailas-online-';
const WARN_TAG = '【副本日报消费为0】';

export function applyKailasSnapshot(
  dashboard: CampaignDashboard,
  snapshot: unknown
): CampaignDashboard {
  if (!snapshot || typeof snapshot !== 'object') return dashboard;

  const snap = snapshot as KailasSnapshotPayload;
  const sheets = Array.isArray(snap.sheets) ? snap.sheets : [];
  const budgetSheet = sheets.find((s) => s.sheetId === '0vvsaG' || s.tabName === '黑山在run项目消耗进度');
  const dailySheet = sheets.find((s) => s.sheetId === 'pwNPq2' || s.tabName === '日报用');

  // 1. Online sources
  const newSources: CampaignSource[] = [];

  if (budgetSheet) {
    newSources.push({
      id: `${PREFIX}0vvsaG`,
      name: budgetSheet.tabName || '黑山在run项目消耗进度',
      url: budgetSheet.URL || undefined,
      status: 'ready',
      detail: '在run项目消耗进度（含返点 · K+投流）',
      fetchedAt: budgetSheet.readAt ?? snap.readAt ?? null,
      provenance: 'feishu',
    });
  }

  let dailyWarning: string | null = null;
  if (dailySheet) {
    const rows = Array.isArray(dailySheet.value) ? dailySheet.value : [];
    const summaryRow = rows[3] || rows.find((r) => Array.isArray(r) && (r[1] === '汇总' || r[0] === '汇总'));
    const onlineSpend = Array.isArray(summaryRow) ? parseNum(summaryRow[3]) : null;
    const manualSpend = dashboard.kpis.find((k) => k.id.includes('spend'))?.value ?? 0;
    const isZeroConflict = onlineSpend === 0 && manualSpend > 0;

    newSources.push({
      id: `${PREFIX}pwNPq2`,
      name: dailySheet.tabName || '日报用',
      url: dailySheet.URL || undefined,
      status: isZeroConflict ? 'error' : 'ready',
      detail: isZeroConflict ? '线上副本日报消费读取为0，与截图数据不一致，待核对' : '日报消耗汇总',
      fetchedAt: dailySheet.readAt ?? snap.readAt ?? null,
      provenance: 'feishu',
    });

    if (isZeroConflict) {
      dailyWarning = `${WARN_TAG}线上副本日报消费读取为0，与截图数据不一致，待核对；不覆盖现有基准，亦不估算抗断链消费。`;
    }
  }

  if (Array.isArray(snap.extra_files)) {
    for (const f of snap.extra_files) {
      if (f.URL || f.token) {
        newSources.push({
          id: `${PREFIX}file-${f.token || 'extra'}`,
          name: f.title || '阶段复盘PPT',
          url: f.URL || undefined,
          status: 'metadata_only',
          detail: '附件元数据已核验，正文未解析',
          fetchedAt: f.readAt ?? snap.readAt ?? null,
          provenance: 'feishu',
        });
      }
    }
  }

  if (Array.isArray(snap.unauthorized_nodes)) {
    for (const u of snap.unauthorized_nodes) {
      if (u.token) {
        newSources.push({
          id: `${PREFIX}unauthorized-${u.token}`,
          name: `未授权节点 (${u.token})`,
          url: `https://feishu.cn/wiki/${u.token}`,
          status: 'error',
          detail: u.message || '无读取权限 (131006)',
          fetchedAt: snap.readAt ?? null,
          provenance: 'feishu',
        });
      }
    }
  }

  // 2. Budget Table: rows 1..3 projects, row 4 period note
  const newTables: CampaignTable[] = [];
  if (budgetSheet && Array.isArray(budgetSheet.value) && budgetSheet.value.length > 1) {
    const rows = budgetSheet.value;
    const note = rows[4]?.[0];
    const periodNote = typeof note === 'string' && note.trim() ? note.trim() : '统计截止未注明';
    const budgetRows: CampaignTableRow[] = [];

    for (let i = 1; i <= 3 && i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || !r[1]) continue;
      budgetRows.push({
        project: String(r[1]).trim(),
        totalBudget: parseNum(r[2]),
        totalSpend: parseNum(r[3]),
        kBudget: parseNum(r[5]),
        kSpend: parseNum(r[6]),
        adBudget: parseNum(r[8]),
        adSpend: parseNum(r[9]),
      });
    }

    if (budgetRows.length > 0) {
      newTables.push({
        id: `${PREFIX}budget-0vvsaG`,
        category: 'budget',
        title: '在run项目消耗进度明细 (0vvsaG)',
        period: `${periodNote} · 含返点 · K+投流`,
        sourceId: `${PREFIX}0vvsaG`,
        provenance: 'feishu',
        columns: [
          { key: 'project', title: '项目', type: 'string', align: 'left' },
          { key: 'totalBudget', title: '总预算(元)', type: 'currency', align: 'right' },
          { key: 'totalSpend', title: '总消耗(元)', type: 'currency', align: 'right' },
          { key: 'kBudget', title: 'K侧预算(元)', type: 'currency', align: 'right' },
          { key: 'kSpend', title: 'K侧消耗(元)', type: 'currency', align: 'right' },
          { key: 'adBudget', title: '投流预算(元)', type: 'currency', align: 'right' },
          { key: 'adSpend', title: '投流消耗(元)', type: 'currency', align: 'right' },
        ],
        rows: budgetRows,
      });
    }
  }

  // 3. Deduplication by prefix
  const cleanSources = dashboard.sources.filter((s) => !s.id.startsWith(PREFIX));
  const cleanTables = dashboard.tables.filter((t) => !t.id.startsWith(PREFIX));
  const cleanWarnings = dashboard.warnings.filter((w) => !w.startsWith(WARN_TAG));

  return {
    ...dashboard,
    sources: [...cleanSources, ...newSources],
    tables: [...cleanTables, ...newTables],
    warnings: dailyWarning ? [...cleanWarnings, dailyWarning] : cleanWarnings,
  };
}
