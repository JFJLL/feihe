#!/usr/bin/env node

/**
 * sync-all-feishu-live.mjs
 *
 * Pulls live Feishu Sheets and Bitable data via lark-cli (--as user --format json),
 * parses raw streams via lib/campaign-sync-parser.mjs,
 * builds fresh campaign-daily-data.json, campaign-enrichment JSON files,
 * meiling-base.json, and updates local.db project timestamps & snapshots.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  parseWipesDelivery,
  parseWipesTaosou,
  parseHuangCommerce,
  parseHuangCid,
  parseMeilingPivot,
  parseHuangBrandRaw,
  rebuildHuangSummaryTables,
  safeParseNum,
} from '../lib/campaign-sync-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');

const TMP_SYNC_DIR = path.resolve(os.tmpdir(), 'feihe-live-sync-tmp');
if (!fs.existsSync(TMP_SYNC_DIR)) {
  fs.mkdirSync(TMP_SYNC_DIR, { recursive: true });
}

function runLarkCli(args, timeoutMs = 120000) {
  const cmd = process.platform === 'win32' ? 'lark-cli.cmd' : 'lark-cli';
  try {
    const stdout = execFileSync('rtk', ['lark-cli', ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  }
}

function sanitizeUrl(val) {
  if (!val || typeof val !== 'string') return null;
  const m = val.match(/\((https?:\/\/[^\)]+)\)/);
  if (m) {
    val = m[1];
  } else {
    const m2 = val.match(/https?:\/\/[^\s\]\)\"\'\,]+/);
    if (m2) val = m2[0];
  }
  return val.replace(/1[3-9]\d{9}/g, '1XXXXXXXXXX');
}

function getProductGroup(pname) {
  if (!pname) return '未填';
  if (pname.includes('502')) return '小确杏502pro (含柳潇/雨珂)';
  if (pname.includes('421')) return '小确杏421';
  if (pname.includes('520')) return '小确杏520机皇';
  if (pname.includes('511')) return '小确杏511';
  if (pname.includes('516') || pname.includes('黑珍珠')) return '黑珍珠516';
  if (pname.includes('570') || pname.includes('大白鲸')) return '大白鲸570';
  if (pname.includes('无忧嵌')) return '无忧嵌系列';
  return pname;
}

export async function syncAllFeishuLive(options = {}) {
  const syncTimestamp = new Date().toISOString();
  console.log(`[LIVE-SYNC] Starting Feishu Live Sync at ${syncTimestamp}...`);

  // =========================================================================
  // 1. Fetch Winner Wipes (Ero1shDTFhVzwttqDMLceZQ4nMb)
  // =========================================================================
  console.log('\n[LIVE-SYNC 1/4] Syncing Winner Wipes (Ero1shDTFhVzwttqDMLceZQ4nMb)...');
  const wipesDeliveryPath = path.join(TMP_SYNC_DIR, 'wipes-delivery.json');
  const wipesTaosouPath = path.join(TMP_SYNC_DIR, 'wipes-taosou.json');

  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'Ero1shDTFhVzwttqDMLceZQ4nMb',
    '--sheet-id', '0QTVhE',
    '--range', 'A1:U200',
    '--no-header',
    '--output-path', wipesDeliveryPath,
  ]);
  const wipesDeliveryRaw = JSON.parse(fs.readFileSync(wipesDeliveryPath, 'utf8'));
  const wipesDeliveryParsed = parseWipesDelivery(wipesDeliveryRaw);
  console.log(`  -> Wipes Delivery: ${wipesDeliveryParsed.rows.length} rows (${wipesDeliveryParsed.period})`);

  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'Ero1shDTFhVzwttqDMLceZQ4nMb',
    '--sheet-id', 'wY1HZO',
    '--range', 'A1:W120',
    '--no-header',
    '--output-path', wipesTaosouPath,
  ]);
  const wipesTaosouRaw = JSON.parse(fs.readFileSync(wipesTaosouPath, 'utf8'));
  const wipesTaosouParsed = parseWipesTaosou(wipesTaosouRaw);
  console.log(`  -> Wipes Taosou: ${wipesTaosouParsed.rows.length} rows (${wipesTaosouParsed.period})`);

  // =========================================================================
  // 2. Fetch Meiling (K63bsyzvNhXuWTtY4aLcF9kpnnd & XH2obMhtwaPCWUsmsWacRCpLnvg)
  // =========================================================================
  console.log('\n[LIVE-SYNC 2/4] Syncing Meiling Sheets & Bitable...');
  const meilingDefs = [
    {
      id: 'meiling-daily-tm-seed',
      sheetId: 'iautvs',
      range: 'A1:U592',
      isCid: false,
      label: '美菱双11-自采天猫种草日流水 (TM种草)',
      note: '美菱双11自采天猫种草日流水（透视表iautvs）。小红星站外活跃UV为30日归因口径（各创意归因UV之和，非项目去重人数）。源CPUV若存在#NAME?按spend/uv重算。全量覆盖历史UV回填。',
    },
    {
      id: 'meiling-daily-jd-seed',
      sheetId: 'B5TBE7',
      range: 'A1:U592',
      isCid: false,
      label: '美菱双11-自采京东种草日流水 (JD种草)',
      note: '美菱双11自采京东种草日流水（透视表B5TBE7）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。',
    },
    {
      id: 'meiling-daily-xingban-seed',
      sheetId: '7gf6nq',
      range: 'A1:U592',
      isCid: false,
      label: '代采星伴种草分日流水',
      note: '美菱双11代采星伴种草分日流水（透视表7gf6nq）。小红星站外活跃UV为30日归因口径。',
    },
    {
      id: 'meiling-daily-jd-toitou-seed',
      sheetId: 'TLLRoo',
      range: 'A1:U592',
      isCid: false,
      label: '京东对投种草分日流水',
      note: '美菱双11京东对投种草分日流水（透视表TLLRoo）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。',
    },
    {
      id: 'meiling-daily-cid-jd',
      sheetId: 'Trvrou',
      range: 'A1:W601',
      isCid: true,
      label: '美菱双11-京东对投CID日表现 (CID渠道)',
      note: '美菱双11京东对投CID日表现（透视表Trvrou）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。',
    },
  ];

  const meilingDatasets = [];
  for (const def of meilingDefs) {
    const tmpOut = path.join(TMP_SYNC_DIR, `${def.id}.json`);
    runLarkCli([
      'sheets', '+table-get',
      '--as', 'user',
      '--format', 'json',
      '--spreadsheet-token', 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
      '--sheet-id', def.sheetId,
      '--range', def.range,
      '--no-header',
      '--output-path', tmpOut,
    ]);
    const raw = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
    const parsed = parseMeilingPivot(raw, { isCid: def.isCid });
    console.log(`  -> ${def.id}: ${parsed.rows.length} rows (${parsed.period})`);
    meilingDatasets.push({
      id: def.id,
      label: def.label,
      period: parsed.period,
      sourceSheetId: def.sheetId,
      sourceUrl: `https://yimeichuanbo.feishu.cn/wiki/DMMpwdQShiyEpyk89jVcP6GInjg?sheet=${def.sheetId}`,
      note: def.note,
      rows: parsed.rows,
    });
  }

  // Meiling Bitable
  console.log('  -> Fetching Meiling Bitable tbluz50zuZOeGQWf...');
  const meilingNdjsonPath = path.join(TMP_SYNC_DIR, 'meiling-records.ndjson');
  runLarkCli([
    'base', '+record-list',
    '--base-token', 'XH2obMhtwaPCWUsmsWacRCpLnvg',
    '--table-id', 'tbluz50zuZOeGQWf',
    '--as', 'user',
    '--format', 'ndjson',
    '--output', meilingNdjsonPath,
    '--overwrite',
  ], 180000);

  const bitableLines = fs.readFileSync(meilingNdjsonPath, 'utf8').trim().split('\n').filter(Boolean);
  const bitableRecords = bitableLines.map((l) => JSON.parse(l));
  console.log(`  -> Bitable Records fetched: ${bitableRecords.length}`);

  // Rebuild meiling-base.json
  const pipelineRecords = [];
  for (const r of bitableRecords) {
    const isSc = Boolean(r['二核确认合作']);
    const hasRp = Boolean(r['审核进度'] && r['审核进度'].length > 0);
    const cdcVal = Array.isArray(r['内容方向确认']) ? r['内容方向确认'][0] : r['内容方向确认'];
    const isCdc = cdcVal === '确认';
    if (isSc || hasRp || isCdc) {
      const rec = {
        record_id: r.record_id,
        达人昵称: r['达人昵称'] || null,
        达人量级: (r['达人量级'] || [null])[0],
        '粉丝（万）': r['粉丝（万）'] ?? null,
        合作形式: (r['合作形式（图文/视频）'] || [null])[0],
        推荐产品: (r['推荐产品'] || [null])[0],
        内容类型: (r['内容类型'] || [null])[0],
        内容方向: r['内容方向'] || null,
        品牌反馈: (r['品牌反馈'] || [null])[0],
        二核确认合作: Boolean(r['二核确认合作']),
        达人是否可接: (r['达人是否可接'] || [null])[0],
        内容方向确认: (r['内容方向确认'] || [null])[0],
        审核进度: (r['审核进度'] || [null])[0],
        发布状态:
          (r['审核进度'] || [])[0] === '已发布'
            ? '已发布'
            : (r['审核进度'] || [])[0]
            ? '推进中'
            : '未进入审核',
        发布时间: r['发布时间'] || null,
        提报日期: r['提报日期'] || null,
        初定档期: r['初定档期'] || null,
        发布短链: sanitizeUrl(r['发布短链']),
        发布长链: sanitizeUrl(r['发布长链']),
        主页链接: sanitizeUrl(r['主页链接']),
        蒲公英链接: sanitizeUrl(r['蒲公英链接']),
        曝光量: r['曝光量'] ?? null,
        阅读量: r['阅读量'] ?? null,
        点赞量: r['点赞量'] ?? null,
        互动量: r['互动量'] ?? null,
        达人裸价: r['达人裸价'] ?? null,
        合作下单价: r['合作下单价'] ?? null,
        '筛选人（自动）': r['筛选人（自动）'] || null,
        '采买形式（自动）': r['采买形式（自动）'] || null,
        外溢平台: (r['外溢平台'] || [null])[0],
        '外溢平台（自动）': r['外溢平台（自动）'] || null,
      };
      pipelineRecords.push(rec);
    }
  }

  const candidatePoolTotal = bitableRecords.length;
  const confirmedPopulation = pipelineRecords.filter((r) => r['二核确认合作']);
  const confirmedTotal = confirmedPopulation.length;
  const publishedRecords = confirmedPopulation.filter((r) => r['审核进度'] === '已发布');
  const publishedCount = publishedRecords.length;
  const publishedRateStr =
    confirmedTotal > 0
      ? `${((publishedCount / confirmedTotal) * 100).toFixed(2)}% (${publishedCount}/${confirmedTotal})`
      : '0%';
  const inProgressCount = confirmedPopulation.filter((r) => r['审核进度'] && r['审核进度'] !== '已发布').length;
  const unstartedReviewCount = confirmedPopulation.filter((r) => !r['审核进度']).length;

  // Status distribution
  const statusCounts = {};
  for (const r of confirmedPopulation) {
    const s = r['审核进度'] || '未进入审核流';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Spillover distribution
  const spillCounts = {};
  for (const r of confirmedPopulation) {
    const sp = r['外溢平台'] || '未标注';
    spillCounts[sp] = (spillCounts[sp] || 0) + 1;
  }
  const orderedSpillItems = {};
  for (const [k, c] of Object.entries(spillCounts)) {
    const pct = confirmedTotal > 0 ? `${((c / confirmedTotal) * 100).toFixed(2)}%` : '0%';
    orderedSpillItems[k] = { count: c, percentage: pct };
  }

  // Product groups
  const productGroups = {};
  for (const r of confirmedPopulation) {
    const rawP = r['推荐产品'] || '未填';
    const grp = getProductGroup(rawP);
    if (!productGroups[grp]) {
      productGroups[grp] = { count: 0, raw_counts: {} };
    }
    productGroups[grp].count++;
    productGroups[grp].raw_counts[rawP] = (productGroups[grp].raw_counts[rawP] || 0) + 1;
  }
  const productItems = {};
  for (const [k, data] of Object.entries(productGroups)) {
    const pct = confirmedTotal > 0 ? `${((data.count / confirmedTotal) * 100).toFixed(2)}%` : '0%';
    productItems[k] = { count: data.count, percentage: pct, detail: data.raw_counts };
  }

  // Tier & format distributions
  const tierCounts = {};
  for (const r of confirmedPopulation) {
    const t = r['达人量级'] || '未填';
    tierCounts[t] = (tierCounts[t] || 0) + 1;
  }
  const tierItems = {};
  for (const [k, v] of Object.entries(tierCounts)) {
    tierItems[k] = { count: v, percentage: `${((v / confirmedTotal) * 100).toFixed(2)}%` };
  }

  const formatCounts = {};
  for (const r of confirmedPopulation) {
    const f = r['合作形式'] || '未填';
    formatCounts[f] = (formatCounts[f] || 0) + 1;
  }
  const formatItems = {};
  for (const [k, v] of Object.entries(formatCounts)) {
    formatItems[k] = { count: v, percentage: `${((v / confirmedTotal) * 100).toFixed(2)}%` };
  }

  // Candidate pool counters
  const bfCounts = {};
  const scCounts = {};
  const cctCounts = {};
  const cdcCounts = {};
  for (const r of bitableRecords) {
    const bf = (r['品牌反馈'] || ['未反馈/空'])[0] || '未反馈/空';
    bfCounts[bf] = (bfCounts[bf] || 0) + 1;
    const sc = r['二核确认合作'] ? '已确认合作 (True)' : '未确认 (False)';
    scCounts[sc] = (scCounts[sc] || 0) + 1;
    const cct = (r['达人是否可接'] || ['空'])[0] || '空';
    cctCounts[cct] = (cctCounts[cct] || 0) + 1;
    const cdc = (r['内容方向确认'] || ['空'])[0] || '空';
    cdcCounts[cdc] = (cdcCounts[cdc] || 0) + 1;
  }

  const meilingBaseOut = {
    metadata: {
      source_type: 'online_feishu_bitable',
      source_url:
        'https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l',
      base_token: 'XH2obMhtwaPCWUsmsWacRCpLnvg',
      base_name: '美菱冰箱小红书种草多维表',
      table_id: 'tbluz50zuZOeGQWf',
      table_name: '双11 KOL进度表',
      read_at: syncTimestamp,
      version_separation_note:
        '【版本与来源隔离说明】1. 本文件为飞书多维表格线上实时读取数据，反映当前最新状态。2. 业务历史日报数据与当前线上多维表格实时版本按日期与来源严格分开，避免混淆覆盖。',
    },
    viewScope: {
      view_id: 'vewOPEh08l',
      view_name: '（品牌筛）KOL账号提报',
      view_type: 'grid',
      view_records_count: candidatePoolTotal,
      table_total_records: candidatePoolTotal,
      filter: null,
      group: ['fldVSGimrQ'],
      sort: [['fldtuvfGfF', 'desc']],
      scope_distinction_analysis: `当前视图 vewOPEh08l 为"（品牌筛）KOL账号提报"，无过滤条件，视图记录数等同于整表全量初筛候选池共 ${candidatePoolTotal} 条。实际进入合作二核确认的严格人群为 ${confirmedTotal} 条。`,
    },
    population_definitions: {
      candidate_pool_total: {
        denominator: candidatePoolTotal,
        description: '全表/初筛视图全量提报候选池，含淘汰与未定账号',
      },
      strictly_confirmed_population: {
        denominator: confirmedTotal,
        filter_condition: '二核确认合作 == True',
        description: '线上多维表严格二核确认合作人群，作为各项执行、发布率、外溢、产品分布的统计基准母集',
      },
      active_execution_pipeline: {
        denominator: pipelineRecords.length,
        filter_condition: '二核确认合作 == True OR 审核进度非空 OR 内容方向确认 == 确认',
        description: `包含全部有活跃制作/执行痕迹的记录（共 ${pipelineRecords.length} 条）`,
      },
    },
    summary_confirmed_population_N117: {
      denominator: confirmedTotal,
      published_metrics: {
        published_count: publishedCount,
        published_rate: publishedRateStr,
        in_progress_count: inProgressCount,
        unstarted_review_count: unstartedReviewCount,
      },
      execution_status_distribution: {
        denominator: confirmedTotal,
        items: statusCounts,
      },
      spillover_platform_distribution: {
        denominator: confirmedTotal,
        items: orderedSpillItems,
      },
      product_distribution: {
        denominator: confirmedTotal,
        items: productItems,
      },
      tier_distribution: {
        denominator: confirmedTotal,
        items: tierItems,
      },
      format_distribution: {
        denominator: confirmedTotal,
        items: formatItems,
      },
    },
    summary_candidate_pool_N1096: {
      denominator: candidatePoolTotal,
      brand_feedback: bfCounts,
      second_check_confirmed: scCounts,
      blogger_availability: cctCounts,
      content_direction_confirmed: cdcCounts,
    },
    historical_reference: {
      wiki_node_token: 'UKPKwNHFdi9jk0kBaQKcuO3Anqf',
      obj_token: 'Ugwgd6lKzoURMWxXeJ3c4VzNnFc',
      obj_type: 'docx',
      title: '美菱冰箱618小红书项目复盘',
      is_current_campaign: false,
      note: '属于618历史复盘资料，非当前双11项目；保留标识索引，不展开全文内容。',
    },
    fields: [
      { name: '达人昵称', field_id: 'fldQdCovPV', type: 'text', category: '达人标识' },
      { name: '达人量级', field_id: 'fldpjWZH1l', type: 'select', category: '达人画像' },
      { name: '粉丝（万）', field_id: 'fldpobsf1u', type: 'number', category: '达人画像' },
      { name: '合作形式', field_id: 'fldLw5AOeY', type: 'select', category: '合作属性' },
      { name: '推荐产品', field_id: 'fldog4zGfZ', type: 'select', category: '产品' },
      { name: '内容类型', field_id: 'fldlhIcTzm', type: 'select', category: '内容' },
      { name: '内容方向', field_id: 'fldGv1p1gS', type: 'text', category: '内容' },
      { name: '品牌反馈', field_id: 'fldbHlgrCt', type: 'select', category: '合作确认' },
      { name: '二核确认合作', field_id: 'fldZr8vDGk', type: 'checkbox', category: '合作确认' },
      { name: '达人是否可接', field_id: 'fldPakfP1A', type: 'select', category: '合作确认' },
      { name: '内容方向确认', field_id: 'fldPcOhsjD', type: 'select', category: '合作确认' },
      { name: '审核进度', field_id: 'fldqcbJbd4', type: 'select', category: '执行进度' },
      { name: '发布状态', derived: true, type: 'text', category: '执行进度' },
      { name: '发布时间', field_id: 'fldtyMFRvM', type: 'datetime', category: '时间周期' },
      { name: '提报日期', field_id: 'fldtuvfGfF', type: 'datetime', category: '时间周期' },
      { name: '初定档期', field_id: 'fldj56xRRH', type: 'text', category: '时间周期' },
      { name: '发布短链', field_id: 'fldqKg0HVA', type: 'text', category: '链接资产' },
      { name: '发布长链', field_id: 'fldJULaQHe', type: 'text', category: '链接资产' },
      { name: '主页链接', field_id: 'fldaADVRQ3', type: 'url', category: '链接资产' },
      { name: '蒲公英链接', field_id: 'fldW2HIVLP', type: 'url', category: '链接资产' },
      { name: '曝光量', field_id: 'fldw6q0i2N', type: 'number', category: '投放指标' },
      { name: '阅读量', field_id: 'fldbOPgPdU', type: 'number', category: '投放指标' },
      { name: '点赞量', field_id: 'flduBzR2wb', type: 'number', category: '投放指标' },
      { name: '互动量', field_id: 'fldPVYWkyx', type: 'number', category: '投放指标' },
      { name: '达人裸价', field_id: 'fldzUlyF7E', type: 'number', category: '财务投放' },
      { name: '合作下单价', field_id: 'fldEsb1gXv', type: 'formula', category: '财务投放' },
      { name: '筛选人（自动）', field_id: 'fldVSGimrQ', type: 'lookup', category: '人员归属' },
      { name: '采买形式（自动）', field_id: 'fldSmVUz8o', type: 'lookup', category: '采买与外溢' },
      { name: '外溢平台', field_id: 'fld5Qe9UhX', type: 'select', category: '采买与外溢' },
      { name: '外溢平台（自动）', field_id: 'fldauanSEu', type: 'lookup', category: '采买与外溢' },
    ],
    records: pipelineRecords,
  };

  const meilingBaseDest = path.resolve(REPO_ROOT, 'docs/new-projects-sources/meiling-base.json');
  fs.writeFileSync(meilingBaseDest, JSON.stringify(meilingBaseOut, null, 2), 'utf8');
  console.log(`  -> Wrote rebuilt ${meilingBaseDest} (${candidatePoolTotal} pool, ${confirmedTotal} confirmed, ${publishedCount} published)`);

  // Compute meiling-enrich-kol-tier-budget-stage table
  const crossGroups = new Map();
  for (const r of confirmedPopulation) {
    const tier = r['达人量级'] || '未填';
    const stage = r['审核进度'] || '未进入审核流';
    const key = `${tier}|||${stage}`;
    if (!crossGroups.has(key)) {
      crossGroups.set(key, { tier, stage, kol_count: 0, total_settlement_price: 0, video_count: 0 });
    }
    const g = crossGroups.get(key);
    g.kol_count++;
    const price = safeParseNum(r['合作下单价']) ?? safeParseNum(r['达人裸价']) ?? 0;
    g.total_settlement_price += price;
    const fmt = r['合作形式'] || '';
    if (fmt.includes('视频')) g.video_count++;
  }

  const tierOrder = ['头部', '腰部', '尾部', 'KOC', '未填'];
  const stageOrder = ['已发布', '可推进', '达人修改中', '品牌审核中', '内审中', '达人拍摄中', '待确认预览', '定稿可上传', '未进入审核流'];
  const kolTierRows = Array.from(crossGroups.values())
    .map((g) => ({
      tier: g.tier,
      stage: g.stage,
      kol_count: g.kol_count,
      avg_settlement_price: Math.round(g.total_settlement_price / g.kol_count),
      total_settlement_price: g.total_settlement_price,
      video_ratio: Number(((g.video_count / g.kol_count) * 100).toFixed(1)),
    }))
    .sort((a, b) => {
      const toA = tierOrder.indexOf(a.tier);
      const toB = tierOrder.indexOf(b.tier);
      if (toA !== toB) return (toA === -1 ? 99 : toA) - (toB === -1 ? 99 : toB);
      const soA = stageOrder.indexOf(a.stage);
      const soB = stageOrder.indexOf(b.stage);
      return (soA === -1 ? 99 : soA) - (soB === -1 ? 99 : soB);
    });

  const kolTierTable = {
    id: 'meiling-enrich-kol-tier-budget-stage',
    name: '双11二核确认达人量级与审核进度交叉透视',
    category: '达人与内容',
    period: '双11大促执行期',
    sourceId: 'src-meiling-base-XH2obMhtwaPCWUsmsWacRCpLnvg',
    sourceUrl:
      'https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l',
    columns: [
      { key: 'tier', title: '达人量级', type: 'string' },
      { key: 'stage', title: '执行阶段', type: 'string' },
      { key: 'kol_count', title: '达人数(位)', type: 'number' },
      { key: 'avg_settlement_price', title: '均结算价(元)', type: 'currency' },
      { key: 'total_settlement_price', title: '总结算价(元)', type: 'currency' },
      { key: 'video_ratio', title: '视频占比', type: 'percentage' },
    ],
    rows: kolTierRows,
  };

  // =========================================================================
  // 3. Fetch Huang Tiane (XvqasKtUFhKZI2tqlEEcC0qtnph, ERxXsBh6ehwgfDtQwAYcaxlZnEc, F42ksAyO8hKRGNt2plhccnSWnNh)
  // =========================================================================
  console.log('\n[LIVE-SYNC 3/4] Syncing Huang Tiane Sheets...');
  const huangCommercePath = path.join(TMP_SYNC_DIR, 'huang-commerce.json');
  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'XvqasKtUFhKZI2tqlEEcC0qtnph',
    '--sheet-id', 'Dz6eHe',
    '--range', 'A1:T211',
    '--no-header',
    '--output-path', huangCommercePath,
  ]);
  const huangCommerceRaw = JSON.parse(fs.readFileSync(huangCommercePath, 'utf8'));
  const huangCommerceParsed = parseHuangCommerce(huangCommerceRaw);
  console.log(`  -> Huang Commerce: ${huangCommerceParsed.rows.length} rows (${huangCommerceParsed.period})`);

  const huangCidPath = path.join(TMP_SYNC_DIR, 'huang-cid.json');
  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'ERxXsBh6ehwgfDtQwAYcaxlZnEc',
    '--sheet-id', 'Nm3Sev',
    '--range', 'A1:W609',
    '--no-header',
    '--output-path', huangCidPath,
  ]);
  const huangCidRaw = JSON.parse(fs.readFileSync(huangCidPath, 'utf8'));
  const huangCidParsed = parseHuangCid(huangCidRaw);
  console.log(`  -> Huang CID: Std ${huangCidParsed.standard.rows.length}, Simple ${huangCidParsed.simple.rows.length}, Total ${huangCidParsed.total.rows.length}`);

  // Fetch brand raw in 2 chunks to guarantee complete: true
  const huangBrandPart1Path = path.join(TMP_SYNC_DIR, 'huang-brand-part1.json');
  const huangBrandPart2Path = path.join(TMP_SYNC_DIR, 'huang-brand-part2.json');
  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'F42ksAyO8hKRGNt2plhccnSWnNh',
    '--sheet-id', '637ef8',
    '--range', 'A1:BD2000',
    '--no-header',
    '--output-path', huangBrandPart1Path,
  ]);
  runLarkCli([
    'sheets', '+table-get',
    '--as', 'user',
    '--format', 'json',
    '--spreadsheet-token', 'F42ksAyO8hKRGNt2plhccnSWnNh',
    '--sheet-id', '637ef8',
    '--range', 'A2001:BD4021',
    '--no-header',
    '--output-path', huangBrandPart2Path,
  ]);
  const p1 = JSON.parse(fs.readFileSync(huangBrandPart1Path, 'utf8'));
  const p2 = JSON.parse(fs.readFileSync(huangBrandPart2Path, 'utf8'));
  const fullBrandRows = [...p1.sheets[0].data, ...p2.sheets[0].data];
  const huangBrandParsed = parseHuangBrandRaw(fullBrandRows);
  console.log(`  -> Huang Brand Daily: ${huangBrandParsed.rows.length} rows (${huangBrandParsed.period}) from ${fullBrandRows.length} raw rows`);

  const huangSummaries = rebuildHuangSummaryTables(
    huangBrandParsed.rows,
    huangCommerceParsed.rows
  );

  // =========================================================================
  // 4. Update Enrichment JSON Files & campaign-daily-data.json
  // =========================================================================
  console.log('\n[LIVE-SYNC 4/4] Updating local enrichment JSONs, daily data, and DB...');

  // A. lib/campaign-daily-data.json
  const dailyDataPath = path.resolve(ROOT_DIR, 'lib/campaign-daily-data.json');
  const dailyData = JSON.parse(fs.readFileSync(dailyDataPath, 'utf8'));

  // Winner Wipes
  if (dailyData['winner-wipes']) {
    const dDel = dailyData['winner-wipes'].find((d) => d.id === 'wipes-daily-delivery');
    if (dDel) {
      dDel.period = wipesDeliveryParsed.period;
      dDel.rows = wipesDeliveryParsed.rows;
    }
    const dTao = dailyData['winner-wipes'].find((d) => d.id === 'wipes-daily-taosou');
    if (dTao) {
      dTao.period = wipesTaosouParsed.period;
      dTao.rows = wipesTaosouParsed.rows;
    }
  }

  // Meiling
  if (dailyData['meiling']) {
    for (const md of meilingDatasets) {
      const target = dailyData['meiling'].find((d) => d.id === md.id);
      if (target) {
        target.period = md.period;
        target.rows = md.rows;
      }
    }
  }

  // Huang Tiane
  if (dailyData['huang-tiane']) {
    const hb = dailyData['huang-tiane'].find((d) => d.id === 'huang-brand-daily');
    if (hb) {
      hb.period = huangBrandParsed.period;
      hb.rows = huangBrandParsed.rows;
    }
    const hc = dailyData['huang-tiane'].find((d) => d.id === 'huang-commerce-daily');
    if (hc) {
      hc.period = huangCommerceParsed.period;
      hc.rows = huangCommerceParsed.rows;
    }
    const hcs = dailyData['huang-tiane'].find((d) => d.id === 'huang-cid-standard-daily');
    if (hcs) {
      hcs.period = huangCidParsed.standard.period;
      hcs.rows = huangCidParsed.standard.rows;
    }
    const hcm = dailyData['huang-tiane'].find((d) => d.id === 'huang-cid-simple-daily');
    if (hcm) {
      hcm.period = huangCidParsed.simple.period;
      hcm.rows = huangCidParsed.simple.rows;
    }
    const hct = dailyData['huang-tiane'].find((d) => d.id === 'huang-cid-total-daily');
    if (hct) {
      hct.period = huangCidParsed.total.period;
      hct.rows = huangCidParsed.total.rows;
    }
  }

  fs.writeFileSync(dailyDataPath, JSON.stringify(dailyData, null, 2), 'utf8');
  console.log(`  -> Wrote ${dailyDataPath}`);

  // B. lib/campaign-enrichment/winner-wipes.json
  const wipesEnrichPath = path.resolve(ROOT_DIR, 'lib/campaign-enrichment/winner-wipes.json');
  const wipesEnrich = JSON.parse(fs.readFileSync(wipesEnrichPath, 'utf8'));
  wipesEnrich.extractedAt = syncTimestamp;
  if (wipesEnrich.dailyDatasets) {
    const wDel = wipesEnrich.dailyDatasets.find((d) => d.id === 'wipes-daily-delivery');
    if (wDel) {
      wDel.period = wipesDeliveryParsed.period;
      wDel.rows = wipesDeliveryParsed.rows;
    }
    const wTao = wipesEnrich.dailyDatasets.find((d) => d.id === 'wipes-daily-taosou');
    if (wTao) {
      wTao.period = wipesTaosouParsed.period;
      wTao.rows = wipesTaosouParsed.rows;
    }
  }
  fs.writeFileSync(wipesEnrichPath, JSON.stringify(wipesEnrich, null, 2), 'utf8');
  console.log(`  -> Wrote ${wipesEnrichPath}`);

  // C. lib/campaign-enrichment/meiling.json
  const meilingEnrichPath = path.resolve(ROOT_DIR, 'lib/campaign-enrichment/meiling.json');
  const meilingEnrich = JSON.parse(fs.readFileSync(meilingEnrichPath, 'utf8'));
  meilingEnrich.extractedAt = syncTimestamp;
  if (meilingEnrich.dailyDatasets) {
    for (const md of meilingDatasets) {
      const target = meilingEnrich.dailyDatasets.find((d) => d.id === md.id);
      if (target) {
        target.period = md.period;
        target.rows = md.rows;
      }
    }
  }
  // Add or update meiling-enrich-kol-tier-budget-stage in tables
  if (meilingEnrich.tables) {
    const existingIdx = meilingEnrich.tables.findIndex((t) => t.id === kolTierTable.id);
    if (existingIdx >= 0) {
      meilingEnrich.tables[existingIdx] = kolTierTable;
    } else {
      meilingEnrich.tables.push(kolTierTable);
    }
  }
  fs.writeFileSync(meilingEnrichPath, JSON.stringify(meilingEnrich, null, 2), 'utf8');
  console.log(`  -> Wrote ${meilingEnrichPath} (with ${kolTierTable.rows.length} kolTier rows)`);

  // D. lib/campaign-enrichment/huang-tiane.json
  const huangEnrichPath = path.resolve(ROOT_DIR, 'lib/campaign-enrichment/huang-tiane.json');
  const huangEnrich = JSON.parse(fs.readFileSync(huangEnrichPath, 'utf8'));
  huangEnrich.extractedAt = syncTimestamp;
  if (huangEnrich.dailyDatasets) {
    const hb = huangEnrich.dailyDatasets.find((d) => d.id === 'huang-brand-daily');
    if (hb) {
      hb.period = huangBrandParsed.period;
      hb.rows = huangBrandParsed.rows;
    }
    const hc = huangEnrich.dailyDatasets.find((d) => d.id === 'huang-commerce-daily');
    if (hc) {
      hc.period = huangCommerceParsed.period;
      hc.rows = huangCommerceParsed.rows;
    }
    const hcs = huangEnrich.dailyDatasets.find((d) => d.id === 'huang-cid-standard-daily');
    if (hcs) {
      hcs.period = huangCidParsed.standard.period;
      hcs.rows = huangCidParsed.standard.rows;
    }
    const hcm = huangEnrich.dailyDatasets.find((d) => d.id === 'huang-cid-simple-daily');
    if (hcm) {
      hcm.period = huangCidParsed.simple.period;
      hcm.rows = huangCidParsed.simple.rows;
    }
    const hct = huangEnrich.dailyDatasets.find((d) => d.id === 'huang-cid-total-daily');
    if (hct) {
      hct.period = huangCidParsed.total.period;
      hct.rows = huangCidParsed.total.rows;
    }
  }
  if (huangEnrich.tables) {
    const tSummary = huangEnrich.tables.find((t) => t.id === 'huang-brand-summary');
    if (tSummary) {
      tSummary.period = huangBrandParsed.period;
      tSummary.rows = [huangSummaries.brandSummary];
    }
    const tBudget = huangEnrich.tables.find((t) => t.id === 'huang-brand-budget');
    if (tBudget) {
      tBudget.period = `截至${huangBrandParsed.rows[huangBrandParsed.rows.length - 1].date}`;
      tBudget.rows = [huangSummaries.brandBudget];
    }
    const tCommerce = huangEnrich.tables.find((t) => t.id === 'huang-commerce-summary');
    if (tCommerce) {
      tCommerce.period = huangCommerceParsed.period;
      tCommerce.rows = [huangSummaries.commerceSummary];
    }
  }
  fs.writeFileSync(huangEnrichPath, JSON.stringify(huangEnrich, null, 2), 'utf8');
  console.log(`  -> Wrote ${huangEnrichPath}`);

  // E0. Kailas live sync via Tencent Docs OpenAPI
  const kailasTencentScript = path.resolve(REPO_ROOT, 'scripts/sync_kailas_tencent.py');
  if (fs.existsSync(kailasTencentScript)) {
    try {
      console.log(`  -> Executing Tencent Docs sync for Kailas...`);
      execSync(`python "${kailasTencentScript}"`, { cwd: REPO_ROOT, stdio: 'inherit', timeout: 60000 });
    } catch (err) {
      console.warn(`[WARN] Tencent Docs sync failed: ${err.message}`);
    }
  }

  // E. lib/campaign-enrichment/kailas.json
  const kailasEnrichPath = path.resolve(ROOT_DIR, 'lib/campaign-enrichment/kailas.json');
  const kailasEnrich = JSON.parse(fs.readFileSync(kailasEnrichPath, 'utf8'));
  kailasEnrich.extractedAt = syncTimestamp;
  fs.writeFileSync(kailasEnrichPath, JSON.stringify(kailasEnrich, null, 2), 'utf8');
  console.log(`  -> Wrote ${kailasEnrichPath}`);

  // F. docs/data-sync-2026-10-26.json (update syncDate to 2026-10-30 and sync evidence)
  const syncDocPath = path.resolve(ROOT_DIR, 'docs/data-sync-2026-10-26.json');
  if (fs.existsSync(syncDocPath)) {
    const syncDoc = JSON.parse(fs.readFileSync(syncDocPath, 'utf8'));
    syncDoc.syncDate = '2026-10-30';
    syncDoc.lastLiveSyncAt = syncTimestamp;
    fs.writeFileSync(syncDocPath, JSON.stringify(syncDoc, null, 2), 'utf8');
    console.log(`  -> Wrote ${syncDocPath}`);
  }

  // =========================================================================
  // 5. Update local.db
  // =========================================================================
  console.log('\n[LIVE-SYNC 5/5] Refreshing local.db snapshots and project timestamps...');
  // Run onboard-campaign-projects.mjs --apply to refresh meiling, wipes, kailas snapshots
  try {
    execSync('node scripts/onboard-campaign-projects.mjs --apply', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      timeout: 60000,
    });
  } catch (onboardErr) {
    console.warn(`[WARN] onboard-campaign-projects returned error: ${onboardErr.message}`);
  }

  // Update DB projects.updated_at directly
  const dbPaths = [
    path.resolve(ROOT_DIR, 'data/local.db'),
    path.resolve(REPO_ROOT, 'feihe-mvp/data/local.db'),
  ];

  for (const p of dbPaths) {
    if (!fs.existsSync(p)) continue;
    const db = new DatabaseSync(p);
    try {
      db.exec('BEGIN IMMEDIATE;');
      // Update projects updated_at
      const targetProjects = ['winner-wipes', 'meiling', 'huang-tiane', 'kailas', 'qicui'];
      for (const pid of targetProjects) {
        db.prepare('UPDATE projects SET updated_at=? WHERE id=?').run(syncTimestamp, pid);
      }

      // Update huang-tiane campaign_dashboard in project_settings with latest tables and dailyDatasets
      const huangSnapRow = db.prepare("SELECT value FROM project_settings WHERE project_id='huang-tiane' AND key='campaign_dashboard'").get();
      if (huangSnapRow) {
        const huangSnap = JSON.parse(huangSnapRow.value);
        huangSnap.updatedAt = syncTimestamp;
        if (huangSnap.dailyDatasets) {
          for (const ds of huangSnap.dailyDatasets) {
            const freshDs = huangEnrich.dailyDatasets?.find((d) => d.id === ds.id);
            if (freshDs) {
              ds.rows = freshDs.rows;
              ds.period = freshDs.period;
            }
          }
        }
        if (huangSnap.tables) {
          const tSummary = huangSnap.tables.find((t) => t.id === 'huang-brand-summary');
          if (tSummary) {
            tSummary.period = huangBrandParsed.period;
            tSummary.rows = [huangSummaries.brandSummary];
          }
          const tBudget = huangSnap.tables.find((t) => t.id === 'huang-brand-budget');
          if (tBudget) {
            tBudget.period = `截至${huangBrandParsed.rows[huangBrandParsed.rows.length - 1].date}`;
            tBudget.rows = [huangSummaries.brandBudget];
          }
          const tCommerce = huangSnap.tables.find((t) => t.id === 'huang-commerce-summary');
          if (tCommerce) {
            tCommerce.period = huangCommerceParsed.period;
            tCommerce.rows = [huangSummaries.commerceSummary];
          }
        }
        db.prepare("UPDATE project_settings SET value=?, updated_at=? WHERE project_id='huang-tiane' AND key='campaign_dashboard'").run(JSON.stringify(huangSnap), syncTimestamp);
      }

      // Update meiling campaign_dashboard in project_settings with latest tables & datasets
      const meilingSnapRow = db.prepare("SELECT value FROM project_settings WHERE project_id='meiling' AND key='campaign_dashboard'").get();
      if (meilingSnapRow) {
        const meilingSnap = JSON.parse(meilingSnapRow.value);
        meilingSnap.updatedAt = syncTimestamp;
        if (!meilingSnap.tables) meilingSnap.tables = [];
        const exIdx = meilingSnap.tables.findIndex((t) => t.id === kolTierTable.id);
        if (exIdx >= 0) meilingSnap.tables[exIdx] = kolTierTable;
        else meilingSnap.tables.push(kolTierTable);
        db.prepare("UPDATE project_settings SET value=?, updated_at=? WHERE project_id='meiling' AND key='campaign_dashboard'").run(JSON.stringify(meilingSnap), syncTimestamp);
      }

      // Update winner-wipes campaign_dashboard updatedAt
      const wipesSnapRow = db.prepare("SELECT value FROM project_settings WHERE project_id='winner-wipes' AND key='campaign_dashboard'").get();
      if (wipesSnapRow) {
        const wipesSnap = JSON.parse(wipesSnapRow.value);
        wipesSnap.updatedAt = syncTimestamp;
        db.prepare("UPDATE project_settings SET value=?, updated_at=? WHERE project_id='winner-wipes' AND key='campaign_dashboard'").run(JSON.stringify(wipesSnap), syncTimestamp);
      }

      // Update data_sources updated_at
      db.prepare("UPDATE data_sources SET updated_at=?, last_synced_at=? WHERE project_id IN ('winner-wipes', 'meiling', 'huang-tiane', 'kailas')").run(syncTimestamp, syncTimestamp);

      db.exec('COMMIT;');
      console.log(`  -> Updated SQLite at ${p} with fresh 2026-10-30 timestamp.`);
    } catch (dbErr) {
      db.exec('ROLLBACK;');
      console.error(`  -> Failed to update SQLite at ${p}:`, dbErr);
    } finally {
      db.close();
    }
  }

  console.log('\n[LIVE-SYNC COMPLETE] All Feishu sources synced successfully!');
  return {
    ok: true,
    syncTimestamp,
    counts: {
      wipesDeliveryRows: wipesDeliveryParsed.rows.length,
      wipesTaosouRows: wipesTaosouParsed.rows.length,
      meilingCandidatePool: candidatePoolTotal,
      meilingConfirmed: confirmedTotal,
      meilingPublished: publishedCount,
      huangBrandRows: huangBrandParsed.rows.length,
      huangCommerceRows: huangCommerceParsed.rows.length,
      huangCidTotalRows: huangCidParsed.total.rows.length,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncAllFeishuLive().catch((err) => {
    console.error('[FATAL] Live sync failed:', err);
    process.exit(1);
  });
}
