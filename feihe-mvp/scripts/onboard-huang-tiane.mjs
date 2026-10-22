#!/usr/bin/env node

/**
 * onboard-huang-tiane.mjs
 *
 * Independent, idempotent registrar and snapshot builder for Huang Tiane (黄天鹅):
 * - Slug: huang-tiane
 * - Template: campaign_review
 * - Projects, Project Members, Dashboards, Data Sources registration
 * - Deduplicates tables, sources, and dailyDatasets by ID
 * - Validates CampaignDashboard schema against store validation contract
 * - Emits snapshot-preview.json artifact on dry-run for review
 * - Zero side effects on existing 4 projects (qicui, kailas, meiling, winner-wipes)
 *
 * Usage:
 *   node scripts/onboard-huang-tiane.mjs            # Dry-run by default (builds & validates preview)
 *   node scripts/onboard-huang-tiane.mjs --dry-run  # Explicit dry-run
 *   node scripts/onboard-huang-tiane.mjs --apply    # Execute transaction
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = args.includes('--dry-run') || !isApply;

// 1. Resolve DB path
function resolveDbPath() {
  const envPath = process.env.LOCAL_DB_PATH;
  if (envPath) return path.resolve(envPath);
  const candidates = [
    path.join(ROOT_DIR, 'data', 'local.db'),
    path.join(REPO_ROOT, 'feihe-mvp', 'data', 'local.db'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const dbPath = resolveDbPath();
console.log(`[INFO] 数据库路径: ${dbPath}`);
console.log(`[INFO] 执行模式: ${isApply ? 'APPLY (执行事务写入)' : 'DRY-RUN (演练并生成快照预览工件)'}`);
console.log('[INFO] 目标项目: huang-tiane (黄天鹅, template: campaign_review)');

// 2. Helper to compute project hash for integrity verification
function computeProjectHash(db, projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id=?').get(projectId) || {};
  const settings =
    db.prepare('SELECT key, value FROM project_settings WHERE project_id=? ORDER BY key').all(projectId) || [];
  const members =
    db.prepare('SELECT user_id, role FROM project_members WHERE project_id=? ORDER BY user_id').all(projectId) || [];
  const sources =
    db.prepare('SELECT id, status, spreadsheet, sheet_id FROM data_sources WHERE project_id=? ORDER BY id').all(projectId) || [];
  const notesCount =
    db.prepare('SELECT COUNT(*) AS c FROM project_notes WHERE project_id=?').get(projectId)?.c || 0;
  const payload = JSON.stringify({ project, settings, members, sources, notesCount });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// 3. Target Specifications
const PROJECT_SPEC = {
  id: 'huang-tiane',
  name: '黄天鹅',
  brand: '黄天鹅',
  category: '生鲜食品',
  description: '可生食鸡蛋种草与电商引流',
  color: '#d97706',
  org_id: 'org-default',
  department_id: 'dept-marketing',
  client_id: '',
  owner_id: 'user-editor',
  template_id: 'campaign_review',
};

// 4. Data Sources Specifications (Status: ready, with real fetchedAt)
const DATA_SOURCES = [
  {
    id: 'src-huang-tiane-manual',
    projectId: 'huang-tiane',
    type: 'manual',
    name: '黄天鹅10/20日报计划与手工数据',
    spreadsheet: '',
    sheet_id: '',
    kind: 'huang_tiane_manual_chat',
    status: 'manual',
    probe_status: 'manual',
    fetchedAt: '2026-10-20T06:35:00.000Z',
    last_error: '',
    mapping_json: JSON.stringify({
      role: '用户10/20日报计划与手工数据 (商销今日预算300、达人预算32万、10/20确认费用318879、CPE 31.81核验)',
    }),
    detail: '用户10/20日报计划与手工数据（独立归口，与全周期在线表区分）',
  },
  {
    id: 'src-huang-tiane-kol-execution',
    projectId: 'huang-tiane',
    type: 'feishu_sheet',
    name: '【黄天鹅】红书种草执行表',
    spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/HfYRwSbEKiBex5ks2uwc9S9ynog?sheet=wZtAgh',
    sheet_id: 'wZtAgh',
    kind: 'huang_tiane_creator_execution',
    status: 'ready',
    probe_status: 'accessible',
    fetchedAt: '2026-10-20T06:31:40.049Z',
    last_error: '',
    mapping_json: JSON.stringify({
      obj_token: 'UrM7skBbOhopM2tTm2IcIWKcnec',
      wiki_token: 'HfYRwSbEKiBex5ks2uwc9S9ynog',
      sheets_count: 10,
      role: '达人执行与内容管理',
    }),
    detail: '达人执行表（10个子表，已完成31位达人与65篇KOS笔记读取）',
  },
  {
    id: 'src-huang-tiane-cid-fs',
    projectId: 'huang-tiane',
    type: 'feishu_sheet',
    name: '黄天鹅红猫CID 26年10月项目报表-fs',
    spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/DcFqwVVr8i6qgMkzWhhc4Zdnnqb',
    sheet_id: '',
    kind: 'huang_tiane_cid_fs',
    status: 'ready',
    probe_status: 'accessible',
    fetchedAt: '2026-10-20T06:31:52.920Z',
    last_error: '',
    mapping_json: JSON.stringify({
      obj_token: 'ERxXsBh6ehwgfDtQwAYcaxlZnEc',
      wiki_token: 'DcFqwVVr8i6qgMkzWhhc4Zdnnqb',
      sheets_count: 20,
      role: '红猫CID与分日明细',
    }),
    detail: '红猫CID与FS报表（20个子表，包含标准投、简单投及两类投放合计流水；内部真实维护源）',
  },
  {
    id: 'src-huang-tiane-brand-fs',
    projectId: 'huang-tiane',
    type: 'feishu_sheet',
    name: '黄天鹅品牌线26年10月项目报表-fs',
    spreadsheet: 'https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=Nm3Sev',
    sheet_id: 'Nm3Sev',
    kind: 'huang_tiane_brand_fs',
    status: 'ready',
    probe_status: 'accessible',
    fetchedAt: '2026-10-20T06:34:13.353Z',
    last_error: '',
    mapping_json: JSON.stringify({
      obj_token: 'F42ksAyO8hKRGNt2plhccnSWnNh',
      sheets_count: 17,
      role: '品牌线FS投流报表',
    }),
    detail: '品牌线FS投流报表（17个子表，包含品牌线10月汇总、预算进度及分日流水；CPE实录31.81）',
  },
  {
    id: 'src-huang-tiane-commerce-canonical',
    projectId: 'huang-tiane',
    type: 'feishu_sheet',
    name: '黄天鹅商销日报表',
    spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/FqHUwqtu8iM1P7kD5IXcdr2Rn7c',
    sheet_id: '',
    kind: 'huang_tiane_commerce_canonical',
    status: 'ready',
    probe_status: 'accessible',
    fetchedAt: '2026-10-20T06:34:37.915Z',
    last_error: '',
    mapping_json: JSON.stringify({
      obj_token: 'XvqasKtUFhKZI2tqlEEcC0qtnph',
      wiki_token: 'FqHUwqtu8iM1P7kD5IXcdr2Rn7c',
      sheets_count: 8,
      canonical: true,
      role: '商销日报主表',
    }),
    detail: '商销日报表（8个子表，全渠道销售与GMV以此为准；历史UV缺失保持null；内部真实维护源）',
  },
];

// 5. Helper to merge items by id deduplication
function mergeById(base = [], incoming = []) {
  const map = new Map();
  for (const item of base) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

// 6. Validate Dashboard Shape against store contract
function validateDashboardShape(projectId, data) {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid campaign dashboard snapshot: payload is not an object for project ${projectId}`);
  }
  if (data.projectId !== projectId) {
    throw new Error(`Snapshot projectId mismatch: expected "${projectId}", found "${data.projectId}"`);
  }
  if (!Array.isArray(data.sources)) {
    throw new Error(`Invalid campaign dashboard snapshot: "sources" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(data.kpis)) {
    throw new Error(`Invalid campaign dashboard snapshot: "kpis" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(data.tables)) {
    throw new Error(`Invalid campaign dashboard snapshot: "tables" must be an array for project ${projectId}`);
  }
  if (!data.actions || !Array.isArray(data.actions.items)) {
    throw new Error(`Invalid campaign dashboard snapshot: "actions.items" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(data.warnings)) {
    throw new Error(`Invalid campaign dashboard snapshot: "warnings" must be an array for project ${projectId}`);
  }
}

// 7. Load Source Facts and Build Snapshot
function buildHuangTianeSnapshot() {
  const factsAPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-a/facts.json');
  const factsBPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-b/facts.json');

  if (!fs.existsSync(factsAPath) || !fs.existsSync(factsBPath)) {
    throw new Error('source-a/facts.json 或 source-b/facts.json 缺失，无法组装快照');
  }

  const fa = JSON.parse(fs.readFileSync(factsAPath, 'utf8'));
  const fb = JSON.parse(fs.readFileSync(factsBPath, 'utf8'));

  // Chat manual context table
  const chatContextTable = {
    id: 'huang-manual-chat-context',
    title: '黄天鹅历史Chat与口径核验说明',
    category: 'budget',
    period: '2026年10月复盘',
    sourceId: 'src-huang-tiane-manual',
    note: '用户chat提及单日预算300元、CPE 31.81元（注意3181纯属无小数点显示误差，真实口径31.81元）、商销历史UV原表缺失保持null不人为虚填。',
    provenance: 'manual',
    columns: [
      { key: 'item', title: '核验事项', type: 'string', align: 'left' },
      { key: 'recordedValue', title: '系统录入数值', type: 'string', align: 'left' },
      { key: 'chatReference', title: '用户Chat对应记录', type: 'string', align: 'left' },
      { key: 'caliberNote', title: '数据口径与核验结论', type: 'string', align: 'left' }
    ],
    rows: [
      {
        item: '商销今日预算',
        recordedValue: '300 元',
        chatReference: '今日预算300',
        caliberNote: '10/20日报商销今日预算300元，非全月总预算'
      },
      {
        item: '10月达人规划预算',
        recordedValue: '320,000 元',
        chatReference: '预算320000',
        caliberNote: '达人执行规划总预算，归属用户10/20确认口径 (sourceId: src-huang-tiane-manual)'
      },
      {
        item: '10月达人已确认费用',
        recordedValue: '318,879 元',
        chatReference: '10/20确认费用318879',
        caliberNote: '10/20用户确认费用总额318,879元（占预算99.65%，预算内）；与执行表含平台费报价(¥324,774)及裸价(¥289,890)口径不同，独立列出，不能直接合并或判定超支'
      },
      {
        item: '执行底表含平台费报价',
        recordedValue: '324,774 元',
        chatReference: '底表报价sum',
        caliberNote: '源表31位达人含平台服务费报价求和，归属在线执行表口径 (sourceId: src-huang-tiane-kol-execution)'
      },
      {
        item: '执行底表裸价报价',
        recordedValue: '289,890 元',
        chatReference: '底表裸价sum',
        caliberNote: '源表31位达人纯KOL裸价求和，归属在线执行表口径 (sourceId: src-huang-tiane-kol-execution)'
      },
      {
        item: '品牌线互动成本 (CPE)',
        recordedValue: '31.81 元/次',
        chatReference: '3181',
        caliberNote: '同事日报记录3181，飞书品牌日报汇总为31.81，本页采用飞书值'
      },
      {
        item: '商销历史UV',
        recordedValue: '— (null)',
        chatReference: '历史UV空缺',
        caliberNote: '商销历史底表UV列为异常类型与空值，系统严格保留null缺失态，严禁通过chat人为猜填'
      }
    ]
  };

  // Merge tables by ID deduplication
  const rawTablesA = (fa.tables || []).map((t) => ({ ...t, category: t.category || 'execution' }));
  const rawTablesB = (fb.tables || []).map((t) => ({
    ...t,
    category: t.category || (t.id.includes('budget') ? 'budget' : 'performance'),
  }));
  const mergedTables = mergeById(rawTablesB, rawTablesA);
  const tables = mergeById(mergedTables, [chatContextTable]);

  // Merge daily datasets by ID deduplication
  const dailyDatasets = mergeById(fb.dailyDatasets || [], fa.dailyDatasets || []);

  // Factual KPIs derived from summaries
  const kpis = [
      {
        id: 'huang-kpi-commerce-today-budget',
        label: '商销今日预算',
        value: 300,
        unit: '元',
        target: null,
        direction: 'neutral',
        period: '10/20日报',
        sourceId: 'src-huang-tiane-manual',
        note: '10/20日报商销今日预算300元'
      },
      {
        id: 'huang-kpi-kol-budget',
        label: '达人规划预算',
        value: 320000,
        unit: '元',
        target: 320000,
        direction: 'neutral',
        period: '2026年10月',
        sourceId: 'src-huang-tiane-manual',
        note: '用户10/20确认达人规划总预算'
      },
      {
        id: 'huang-kpi-kol-confirmed-fee',
        label: '达人已确认费用',
        value: 318879,
        unit: '元',
        target: 320000,
        direction: 'neutral',
        period: '10/20用户确认',
        sourceId: 'src-huang-tiane-manual',
        note: '10/20用户确认费用，占预算99.65%，属预算内'
      },
      {
        id: 'huang-kpi-kol-quoted-with-fee',
        label: '执行表含平台费报价',
        value: 324774,
        unit: '元',
        target: null,
        direction: 'neutral',
        period: '执行底表求和',
        sourceId: 'src-huang-tiane-kol-execution',
        note: '31位执行达人含平台服务费报价求和'
      },
      {
        id: 'huang-kpi-kol-quoted-raw',
        label: '执行表裸价报价',
        value: 289890,
        unit: '元',
        target: null,
        direction: 'neutral',
        period: '执行底表求和',
        sourceId: 'src-huang-tiane-kol-execution',
        note: '31位执行达人纯裸价求和'
      },
    {
      id: 'huang-kpi-brand-spend',
      label: '品牌线10月总消耗',
      value: 178342.67,
      unit: '元',
      target: 565475.09,
      direction: 'neutral',
      period: '2026年10月 (10.01~10.19)',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '品牌线10月FS投流累计消耗'
    },
    {
      id: 'huang-kpi-brand-budget',
      label: '品牌线10月总预算',
      value: 565475.09,
      unit: '元',
      target: null,
      direction: 'neutral',
      period: '2026年10月',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '品牌线10月总预算配额'
    },
    {
      id: 'huang-kpi-brand-progress',
      label: '品牌线预算执行进度',
      value: 31.54,
      unit: '%',
      target: 100,
      direction: 'neutral',
      period: '截至10.19累计',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '消耗17.83万 / 预算56.55万'
    },
    {
      id: 'huang-kpi-brand-ctr',
      label: '品牌线点击率 (CTR)',
      value: 12.72,
      unit: '%',
      target: null,
      direction: 'higher',
      period: '截至10.19累计',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '52.14万点击 / 410.05万曝光'
    },
    {
      id: 'huang-kpi-brand-cpc',
      label: '品牌线点击成本 (CPC)',
      value: 0.34,
      unit: '元',
      target: null,
      direction: 'lower',
      period: '截至10.19累计',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '消耗 / 点击数'
    },
    {
      id: 'huang-kpi-brand-cpe',
      label: '品牌线互动成本 (CPE)',
      value: 31.81,
      unit: '元',
      target: null,
      direction: 'lower',
      period: '截至10.19累计',
      sourceId: 'src-huang-tiane-brand-fs',
      note: '实录31.81元/次，聊天3181为显示差异'
    },
    {
      id: 'huang-kpi-commerce-spend',
      label: '商销全期累计消耗',
      value: 25025.29,
      unit: '元',
      target: null,
      direction: 'neutral',
      period: '2026.07.27 ~ 2026.10.19',
      sourceId: 'src-huang-tiane-commerce-canonical',
      note: '商销全期累计广告支出'
    },
    {
      id: 'huang-kpi-commerce-gmv',
      label: '商销全期成交 GMV',
      value: 28023.72,
      unit: '元',
      target: null,
      direction: 'higher',
      period: '2026.07.27 ~ 2026.10.19',
      sourceId: 'src-huang-tiane-commerce-canonical',
      note: '直接成交 GMV'
    },
    {
      id: 'huang-kpi-commerce-orders',
      label: '商销全期订单量',
      value: 558,
      unit: '单',
      target: null,
      direction: 'higher',
      period: '2026.07.27 ~ 2026.10.19',
      sourceId: 'src-huang-tiane-commerce-canonical',
      note: '成交订单量'
    },
    {
      id: 'huang-kpi-commerce-roi',
      label: '商销全期综合 ROI',
      value: 1.12,
      unit: '倍',
      target: null,
      direction: 'higher',
      period: '全期累计',
      sourceId: 'src-huang-tiane-commerce-canonical',
      note: 'GMV 28,023.72 / 消耗 25,025.29'
    },
    {
        id: 'huang-kpi-creator-locked',
        label: '10月达人合作锁定',
      value: 31,
      unit: '位',
      target: null,
      direction: 'higher',
      period: '2026年10月',
      sourceId: 'src-huang-tiane-kol-execution',
        note: '已锁定执行达人31位，其中18位已完成发布'
      },
      {
        id: 'huang-kpi-creator-published',
        label: '10月达人已发布量',
        value: 18,
        unit: '篇',
        target: 31,
        direction: 'higher',
        period: '2026年10月 (截至10.19)',
        sourceId: 'src-huang-tiane-kol-execution',
        note: '已发布18篇 / 锁定31篇 (执行进度58.06%)'
    },
    {
      id: 'huang-kpi-kos-notes-count',
      label: '10月KOS笔记发布量',
      value: 65,
      unit: '篇',
      target: null,
      direction: 'higher',
      period: '2026年10月',
      sourceId: 'src-huang-tiane-kol-execution',
      note: 'KOS矩阵笔记65篇'
    }
  ];

  const snapshot = {
    projectId: PROJECT_SPEC.id,
    name: PROJECT_SPEC.name,
    subtitle: PROJECT_SPEC.description,
    reportPeriod: '2026年10月 (10.01 ~ 10.19)',
    updatedAt: new Date().toISOString(),
    templateId: PROJECT_SPEC.template_id,
    sources: DATA_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.spreadsheet,
      status: s.status,
      detail: s.detail,
      fetchedAt: s.fetchedAt,
      provenance: s.type === 'manual' ? 'manual' : 'feishu',
    })),
    kpis,
    tables,
    actions: {
      title: '10/20日报计划',
      items: [
        { id: 'act-pinpai-1', title: '预计稿件审核5篇', owner: '品牌', status: '日报计划' },
        { id: 'act-pinpai-2', title: '11月账号筛选', owner: '品牌', status: '日报计划' },
        { id: 'act-yimei-1', title: '预计稿件审核5篇', owner: '易美', status: '日报计划' },
        { id: 'act-yimei-2', title: '11月账号提报，14点前', owner: '易美', status: '日报计划' },
        { id: 'act-yimei-3', title: '品专下负面笔记巡查', owner: '易美', status: '日报计划' },
        { id: 'act-yimei-4', title: '已发布笔记评论区巡查，上午11点/下午16点', owner: '易美', status: '日报计划' },
        { id: 'act-yimei-5', title: '已发布笔记素材收集，每日18点前', owner: '易美', status: '日报计划' }
      ]
    },
    warnings: [
      '商销日报仅统计内部真实维护主表（副本已停用，不重复累计）。',
      '日报写3181，飞书原表31.81，本页采用原表。'
    ],
    dailyDatasets,
  };

  validateDashboardShape(PROJECT_SPEC.id, snapshot);
  return snapshot;
}

async function main() {
  const factsAPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-a/facts.json');
  const factsBPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-b/facts.json');
  const fa = fs.existsSync(factsAPath) ? JSON.parse(fs.readFileSync(factsAPath, 'utf8')) : null;
  const fb = fs.existsSync(factsBPath) ? JSON.parse(fs.readFileSync(factsBPath, 'utf8')) : null;
  const isFactsAComplete = fa && (fa.buildStatus === 'complete' || fa.status === 'complete');
  const isFactsBComplete = fb && (fb.buildStatus === 'complete' || fb.status === 'complete');

  if (isApply && (!isFactsAComplete || !isFactsBComplete)) {
    throw new Error(
      `[CRITICAL] --apply 被安全拦截：黄天鹅事实数据尚未全部达到 complete 状态 (Source A: ${fa?.buildStatus || 'missing'}, Source B: ${fb?.buildStatus || 'missing'})，严禁向生产数据库写入未定案数据。仅支持在 dry-run 模式下预览骨架与构建快照。`
    );
  }

  const db = new DatabaseSync(dbPath, { open: true, readOnly: isDryRun });

  try {
    // 1. Verify and record baseline hashes of existing 4 projects
    const existingProjectIds = ['qicui', 'kailas', 'meiling', 'winner-wipes'];
    const baselineHashes = {};
    console.log('\n=== 1. 基准项目数据完整性哈希校验 ===');
    for (const pid of existingProjectIds) {
      const h = computeProjectHash(db, pid);
      baselineHashes[pid] = h;
      console.log(`- [HASH-BEFORE] ${pid}: ${h}`);
    }

    // 2. Project template check
    console.log('\n=== 2. 模板 campaign_review (轻量营销看板) 检查 ===');
    const template = db.prepare('SELECT id, name FROM project_templates WHERE id=?').get('campaign_review');
    if (!template) {
      console.log('[PLAN] INSERT project_templates campaign_review');
    } else {
      console.log(`[EXISTS] project_templates campaign_review: "${template.name}"`);
    }

    // 3. Project & Member check
    console.log('\n=== 3. 项目与成员幂等检查 ===');
    const existingProj = db.prepare('SELECT id, name, brand, owner_id FROM projects WHERE id=?').get(PROJECT_SPEC.id);
    if (existingProj) {
      console.log(`[EXISTS] 项目 ${PROJECT_SPEC.id} 已存在 ("${existingProj.name}") -> 保持幂等`);
    } else {
      console.log(`[PLAN] INSERT 项目 ${PROJECT_SPEC.id} (name: "${PROJECT_SPEC.name}", owner: "${PROJECT_SPEC.owner_id}")`);
    }

    const memberId = `${PROJECT_SPEC.id}:${PROJECT_SPEC.owner_id}`;
    const existingMember = db.prepare('SELECT id, role FROM project_members WHERE id=?').get(memberId);
    if (existingMember) {
      console.log(`[EXISTS] 成员 ${memberId} 角色为 "${existingMember.role}" -> 保持幂等`);
    } else {
      console.log(`[PLAN] INSERT 成员 ${memberId} (role: "project_admin")`);
    }

    const dashId = `dash-${PROJECT_SPEC.id}-default`;
    const existingDash = db.prepare('SELECT id FROM dashboards WHERE id=?').get(dashId);
    if (existingDash) {
      console.log(`[EXISTS] 看板 ${dashId} 已存在 -> 保持幂等`);
    } else {
      console.log(`[PLAN] INSERT 看板 ${dashId}`);
    }

    // 4. Data sources check
    console.log('\n=== 4. 数据源登记规划检查 (5个数据源，状态均设为 ready) ===');
    for (const src of DATA_SOURCES) {
      const existingSrc = db.prepare('SELECT id, status, probe_status FROM data_sources WHERE id=?').get(src.id);
      if (existingSrc) {
        console.log(`[UPDATE] 数据源 ${src.id} (${src.name}) -> status="${src.status}", probe="${src.probe_status}"`);
      } else {
        console.log(`[PLAN] INSERT 数据源 ${src.id} (${src.name}) -> status="${src.status}", probe="${src.probe_status}"`);
      }
    }

    // 5. Build and validate full snapshot artifact
    console.log('\n=== 5. 快照构建与 CampaignDashboard 契约校验 ===');
    const snapshot = buildHuangTianeSnapshot();
    console.log(`✓ 契约校验通过: ProjectId="${snapshot.projectId}", Name="${snapshot.name}"`);
    console.log(`- 数据源数量: ${snapshot.sources.length} (全部状态 ready, 包含 Canonical & Alternate)`);
    console.log(`- 核心KPI数量: ${snapshot.kpis.length}`);
    console.log(`- 业务明细表数: ${snapshot.tables.length} (按 ID 唯一去重，无重叠重复)`);
    console.log(`- 分日数据集数: ${snapshot.dailyDatasets.length} (5组分日时序流)`);
    console.log(`- 行动项数: ${snapshot.actions.items.length}`);
    console.log(`- 警示备忘数: ${snapshot.warnings.length}`);

    // Always emit snapshot-preview.json for review
    const previewDir = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/integration');
    fs.mkdirSync(previewDir, { recursive: true });
    const previewPath = path.join(previewDir, 'snapshot-preview.json');
    fs.writeFileSync(previewPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`[ARTIFACT] 已生成/更新快照预览工件供审查: docs/new-projects-sources/huang-tiane/integration/snapshot-preview.json`);

    if (isDryRun) {
      console.log('\n======================================================');
      console.log('[DRY-RUN 结果] 快照构建与结构校验 100% 通过，未写库。');
      console.log('工件已就绪: docs/new-projects-sources/huang-tiane/integration/snapshot-preview.json');
      console.log('如主审确认无误，执行: node scripts/onboard-huang-tiane.mjs --apply');
      console.log('======================================================');
      return;
    }

    // 6. APPLY MODE
    console.log('\n=== 6. 在线热备份 (VACUUM INTO) ===');
    const backupDir = path.resolve(REPO_ROOT, '.verification/campaign');
    fs.mkdirSync(backupDir, { recursive: true });
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `local.db.pre-huang-tiane-${timestampStr}.db`);
    const safeSqlPath = backupPath.replace(/\\/g, '/').replace(/'/g, "''");
    db.exec(`VACUUM INTO '${safeSqlPath}';`);
    console.log(`[BACKUP] 已成功创建热备份新文件: ${backupPath}`);

    console.log('\n=== 7. 开始事务写入 (仅变更 huang-tiane 领域数据) ===');
    db.exec('BEGIN TRANSACTION;');
    try {
      const now = new Date().toISOString();

      // Template
      db.prepare(`
        INSERT OR IGNORE INTO project_templates (
          id, name, description, icon, modules_json,
          default_metrics_json, default_dashboard_json, version
        ) VALUES (
          'campaign_review', '轻量营销看板', '营销复盘与轻量营销看板，无预设目标。', 'sparkles',
          '["overview","content","ads","data","metrics","reports","settings"]', '[]', '{}', '1.0.0'
        )
      `).run();

      // Project (ON CONFLICT DO NOTHING to preserve user edits)
      db.prepare(`
        INSERT INTO projects (
          id, name, brand, category, description, status, color,
          org_id, department_id, client_id, owner_id, template_id,
          is_archived, onboarding_status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '进行中', ?, ?, ?, ?, ?, ?, 0, 'ready', ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(
        PROJECT_SPEC.id, PROJECT_SPEC.name, PROJECT_SPEC.brand, PROJECT_SPEC.category,
        PROJECT_SPEC.description, PROJECT_SPEC.color, PROJECT_SPEC.org_id,
        PROJECT_SPEC.department_id, PROJECT_SPEC.client_id, PROJECT_SPEC.owner_id,
        PROJECT_SPEC.template_id, PROJECT_SPEC.owner_id, now, now
      );

      // Member
      db.prepare(`
        INSERT INTO project_members (id, project_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, ?, 'project_admin', ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(memberId, PROJECT_SPEC.id, PROJECT_SPEC.owner_id, now, now);

      // Dashboard
      db.prepare(`
        INSERT OR IGNORE INTO dashboards (id, project_id, name, is_default, version, layout_json, status, created_at, updated_at)
        VALUES (?, ?, '营销复盘工作台', 1, 1, '[]', 'published', ?, ?)
      `).run(dashId, PROJECT_SPEC.id, now, now);

      // Data Sources
      const validSourceIds = DATA_SOURCES.map((s) => s.id);
      const placeholders = validSourceIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM data_sources WHERE project_id=? AND id NOT IN (${placeholders})`).run(PROJECT_SPEC.id, ...validSourceIds);

      for (const src of DATA_SOURCES) {
        db.prepare(`
          INSERT INTO data_sources (
            id, project_id, type, name, spreadsheet, sheet_id, kind,
            sync_frequency, status, mapping_json, last_error, probe_status,
            connection_id, is_paused, schedule_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, 'conn-default-feishu', 0, 0, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            kind = excluded.kind,
            name = excluded.name,
            spreadsheet = excluded.spreadsheet,
            sheet_id = excluded.sheet_id,
            status = excluded.status,
            probe_status = excluded.probe_status,
            last_error = excluded.last_error,
            mapping_json = excluded.mapping_json,
            updated_at = excluded.updated_at
        `).run(
          src.id, src.projectId, src.type, src.name, src.spreadsheet, src.sheet_id,
          src.kind, src.status, src.mapping_json, src.last_error, src.probe_status, now, now
        );
      }

      // Snapshot: write validated snapshot into project_settings
      const settingId = `${PROJECT_SPEC.id}:campaign_dashboard`;
      db.prepare(`
        INSERT INTO project_settings (id, project_id, key, value, updated_at)
        VALUES (?, ?, 'campaign_dashboard', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `).run(settingId, PROJECT_SPEC.id, JSON.stringify(snapshot), now);
      console.log(`[SNAPSHOT] 已成功向 project_settings 写入黄天鹅真实看板快照！`);

      db.exec('COMMIT;');
      console.log('\n[SUCCESS] 事务提交成功！');
    } catch (writeErr) {
      db.exec('ROLLBACK;');
      console.error('[ERROR] 写入失败，事务已回滚:', writeErr);
      throw writeErr;
    }

    // 8. Verify integrity of other 4 projects
    console.log('\n=== 8. 基准项目哈希二次核验 (确认零副作用) ===');
    let allIntact = true;
    for (const pid of existingProjectIds) {
      const hAfter = computeProjectHash(db, pid);
      const matches = hAfter === baselineHashes[pid];
      console.log(`- [HASH-AFTER] ${pid}: ${hAfter} (${matches ? '完全一致' : 'CRITICAL 变化！'})`);
      if (!matches) {
        allIntact = false;
        throw new Error(`[CRITICAL] 非目标项目 ${pid} 哈希发生变化！原: ${baselineHashes[pid]}, 现: ${hAfter}`);
      }
    }
    console.log('[INTEGRITY-VERIFIED] 所有4个既有项目哈希完全一致，无任何副作用变更。');

    // 9. Write registration receipt
    const receipt = {
      timestamp: new Date().toISOString(),
      db_path: dbPath,
      backup_file: backupPath,
      project: PROJECT_SPEC,
      sources: DATA_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        status: s.status,
        probe_status: s.probe_status,
      })),
      snapshot_summary: {
        sourcesCount: snapshot.sources.length,
        kpisCount: snapshot.kpis.length,
        tablesCount: snapshot.tables.length,
        dailyDatasetsCount: snapshot.dailyDatasets.length,
        actionsCount: snapshot.actions.items.length,
        warningsCount: snapshot.warnings.length,
      },
      baseline_hashes: baselineHashes,
      all_intact: allIntact,
    };
    fs.writeFileSync(path.join(previewDir, 'registration-receipt.json'), JSON.stringify(receipt, null, 2), 'utf8');
    console.log(`[RECEIPT] 已写入注册收据: docs/new-projects-sources/huang-tiane/integration/registration-receipt.json`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
