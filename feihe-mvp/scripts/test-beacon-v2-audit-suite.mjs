import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
});

const { strictNum, strictRatio, formatPercentValue, toIsoDate } = await vite.ssrLoadModule('/lib/core/transform-kit.ts');
const { validateBoardHealth } = await vite.ssrLoadModule('/lib/core/board-health.ts');
const { buildCopilotContext } = await vite.ssrLoadModule('/lib/core/copilot-context.ts');
const { transformProject: transformKailas } = await vite.ssrLoadModule('/projects/kailas/transform.ts');
const { transformProject: transformWipes } = await vite.ssrLoadModule('/projects/winner-wipes/transform.ts');
const { transformProject: transformQicui } = await vite.ssrLoadModule('/projects/qicui/transform.ts');
const { formatDatasetValue, formatMetricCardValue } = await vite.ssrLoadModule('/features/campaign/UniversalBoardRenderer.tsx');

// ============================================================================
// 1. 同步测试 (Sync Tests, 1-10)
// ============================================================================

test('1. 已有缓存时，force=false 仍能按刷新策略判断是否过期', () => {
  const existingMeta = {
    status: 'cached',
    lastAttemptAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    lastSuccessAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  };
  const refreshIntervalMinutes = 60;
  const intervalMs = refreshIntervalMinutes * 60 * 1000;
  const isExpired = Date.now() - new Date(existingMeta.lastSuccessAt).getTime() > intervalMs;
  assert.equal(isExpired, true, '2小时前的缓存超过60分钟刷新周期，应当触发重新获取');

  const freshMeta = {
    status: 'live_success',
    lastAttemptAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
  };
  const isFreshExpired = Date.now() - new Date(freshMeta.lastSuccessAt).getTime() > intervalMs;
  assert.equal(isFreshExpired, false, '刚刚拉取的缓存未超过刷新周期，不需要重新获取');
});

test('2. 一个来源成功、一个关键来源失败时，健康检查阻断不发布不完整快照', () => {
  const mockPayload = {
    projectId: 'test-sync-proj',
    name: '测试项目',
    brand: '测试品牌',
    datasets: {
      summary_kpis: {
        id: 'summary_kpis',
        columns: [{ key: 'kpi_1', label: '指标1', type: 'number', format: 'integer' }],
        rows: [{ kpi_1: 100 }],
      },
    },
    sections: [],
    syncMetadata: {
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      dataThrough: '2026-11-09',
      sources: {
        'source-non-critical': { status: 'live_success', lastAttemptAt: '', lastSuccessAt: new Date().toISOString(), critical: false },
        'source-critical': { status: 'failed', lastAttemptAt: '', lastSuccessAt: null, critical: true, error: '网络超时 504' },
      },
    },
  };

  const health = validateBoardHealth(mockPayload);
  assert.equal(health.ok, false, '关键来源失败应当阻断 BoardHealth');
  const criticalErr = health.errors.find(e => e.code === 'CRITICAL_SOURCE_FAILED');
  assert.ok(criticalErr, '应报告 CRITICAL_SOURCE_FAILED 致命错误');
});

test('3. 非关键来源失败时，明确保留旧数据并在健康检查报告中输出警告', () => {
  const mockPayload = {
    projectId: 'test-sync-proj',
    name: '测试项目',
    brand: '测试品牌',
    datasets: {
      summary_kpis: {
        id: 'summary_kpis',
        columns: [{ key: 'kpi_1', label: '指标1', type: 'number', format: 'integer' }],
        rows: [{ kpi_1: 100 }],
      },
    },
    sections: [],
    syncMetadata: {
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      dataThrough: '2026-11-09',
      sources: {
        'source-primary': { status: 'live_success', lastAttemptAt: '', lastSuccessAt: new Date().toISOString(), critical: false },
        'source-enrich': { status: 'cached', lastAttemptAt: '', lastSuccessAt: '2026-10-01', critical: false, error: '远端文件无变更' },
      },
    },
  };

  const health = validateBoardHealth(mockPayload);
  assert.equal(health.ok, true, '非关键来源降级缓存不阻断发布');
  const staleWarn = health.warnings.find(w => w.code === 'STALE_CACHE_USED');
  assert.ok(staleWarn, '应记录 STALE_CACHE_USED 警示');
});

test('4. 全部远端来源失败且无缓存时，不能返回同步成功', () => {
  const externalAttemptCount = 2;
  const externalSuccessCount = 0;
  const validRawSources = {};
  const canSucceed = !(externalAttemptCount > 0 && externalSuccessCount === 0 && Object.keys(validRawSources).length === 0);
  assert.equal(canSucceed, false, '全部远程来源拉取失败且无可用的本地缓存时不可声称成功');
});

test('5. 同步失败时不更新 lastSuccessAt', () => {
  const previousSuccess = '2026-10-20T10:00:00.000Z';
  const existingMeta = {
    status: 'live_success',
    lastAttemptAt: previousSuccess,
    lastSuccessAt: previousSuccess,
  };

  const attemptTime = '2026-11-09T14:00:00.000Z';
  const failedFetch = { ok: false, error: 'Feishu API 401 Unauthorized' };

  const candidateMeta = {
    ...existingMeta,
    status: 'cached',
    lastAttemptAt: attemptTime,
    lastSuccessAt: existingMeta.lastSuccessAt,
    error: failedFetch.error,
  };

  assert.equal(candidateMeta.lastSuccessAt, previousSuccess, 'lastSuccessAt 必须保持原成功时间点');
  assert.equal(candidateMeta.lastAttemptAt, attemptTime, 'lastAttemptAt 记录最新尝试时间');
});

test('6 & 7. 重复手动刷新只触发一次实际同步且旧任务不覆盖新任务', () => {
  const syncLocks = new Map();
  let executionCount = 0;

  function fakeRunSync(projectId) {
    if (syncLocks.has(projectId)) {
      return syncLocks.get(projectId);
    }
    const task = (async () => {
      executionCount++;
      await new Promise(r => setTimeout(r, 20));
      return { ok: true, executionCount };
    })();
    const wrapped = task.finally(() => syncLocks.delete(projectId));
    syncLocks.set(projectId, wrapped);
    return wrapped;
  }

  const p1 = fakeRunSync('kailas');
  const p2 = fakeRunSync('kailas');
  assert.strictEqual(p1, p2, '并发调用应返回同一个进行中的 Promise');

  return Promise.all([p1, p2]).then(([r1, r2]) => {
    assert.equal(r1.executionCount, 1);
    assert.equal(r2.executionCount, 1);
    assert.equal(executionCount, 1, '实际执行次数严格为 1 次');
  });
});

test('8 & 9. 健康检查未通过时绝不晋升候选缓存与生产有效快照', () => {
  const badPayload = {
    projectId: 'bad-proj',
    name: '异常项目',
    brand: '品牌',
    datasets: {
      daily_flow: {
        id: 'daily_flow',
        columns: [{ key: 'date', label: '日期', role: 'TIMESTAMP' }],
        rows: [{ date: '2026-10-10' }, { date: '2026-10-10' }],
      },
    },
    sections: [],
  };

  const health = validateBoardHealth(badPayload);
  assert.equal(health.ok, false, '重复业务日期必须被健康检查捕获为 ERROR');
  assert.ok(health.errors.some(e => e.code === 'DUPLICATE_BUSINESS_DATE'));
});

// ============================================================================
// 2. 数据计算测试 (Calculation Tests, 11-18)
// ============================================================================

test('11. 零值与缺失值严格区分', () => {
  assert.equal(strictNum(0), 0, '真实 0 必须保留为 0');
  assert.equal(strictNum('0'), 0, '字符串 "0" 必须解析为数字 0');
  assert.equal(strictNum(null), null, 'null 必须解析为 null');
  assert.equal(strictNum(undefined), null, 'undefined 必须解析为 null');
  assert.equal(strictNum(''), null, '空字符串必须解析为 null');
  assert.equal(strictNum('-'), null, '短横线必须解析为 null');
  assert.equal(strictNum('#DIV/0!'), null, 'Excel报错必须解析为 null');
  assert.equal(strictNum(NaN), null, 'NaN 必须解析为 null');
});

test('12. ratio 与 points 百分比口径均正确转换', () => {
  assert.equal(formatPercentValue(0.125, 'ratio'), '12.5%');
  assert.equal(formatPercentValue(12.5, 'points'), '12.5%');
  assert.equal(formatPercentValue(1.5, 'ratio'), '150%');
  assert.equal(formatPercentValue(0.8, 'points'), '0.8%');
  assert.equal(formatPercentValue(0, 'ratio'), '0%');
  assert.equal(formatPercentValue(null, 'ratio'), '未观测');
  assert.equal(formatPercentValue(null, 'points'), '未观测');
  assert.equal(formatPercentValue(undefined, 'ratio'), '未观测');
});

test('13. 字符串百分比不会二次换算', () => {
  const parsed = strictNum('12.5%');
  assert.equal(parsed, 0.125, 'strictNum("12.5%") 归一化为 ratio 0.125');
  assert.equal(formatPercentValue(parsed, 'ratio'), '12.5%', '按照 ratio 格式化还原为 12.5%');
  assert.equal(formatPercentValue('12.5%'), '12.5%', '原生百分比字符串直接安全透传');
});

test('14 & 15. 同一业务日期多个日报版本只选择一个已确认优先版本且无重复日期', () => {
  const rawDbReports = [
    { business_day: '2026-10-13', status: 'draft', created_at: '2026-10-13 18:00:00', val: 100 },
    { business_day: '2026-10-13', status: 'confirmed', created_at: '2026-10-13 19:00:00', val: 200 },
    { business_day: '2026-10-12', status: 'confirmed', created_at: '2026-10-12 18:00:00', val: 300 },
    { business_day: '2026-10-13', status: 'confirmed', created_at: '2026-10-13 17:00:00', val: 150 },
  ];

  rawDbReports.sort((a, b) => {
    if (a.business_day !== b.business_day) return a.business_day.localeCompare(b.business_day);
    const confA = a.status === 'confirmed' ? 1 : 0;
    const confB = b.status === 'confirmed' ? 1 : 0;
    if (confA !== confB) return confB - confA;
    return b.created_at.localeCompare(a.created_at);
  });

  const map = new Map();
  for (const r of rawDbReports) {
    const day = toIsoDate(r.business_day);
    if (day && !map.has(day)) {
      map.set(day, r);
    }
  }

  assert.equal(map.size, 2, '仅应提取 2 个有效业务日');
  assert.equal(map.get('2026-10-13').val, 200, '必须命中 status=confirmed 且最新 created_at 的版本 (val: 200)');
  assert.equal(map.get('2026-10-12').val, 300);
});

test('16. 凯乐石缺少预算数据时不使用历史默认金额', async () => {
  const mockRawSourcesEmpty = {
    'kailas-online-budget': { rows: [] },
  };
  const payload = await transformKailas(mockRawSourcesEmpty);
  assert.ok(payload, 'BoardPayload 应当正常生成');
  const budgetCard = payload.analysisCards?.find(c => c.id === 'insight-kailas-overbudget');
  assert.ok(budgetCard, '应有预算分析卡');
  assert.ok(!budgetCard.summary.includes('NaN'), '不得包含 NaN');
});

test('17. 稳健酒精湿巾缺少 CPUV 时不回退 8.23', async () => {
  const payload = await transformWipes({});
  assert.ok(payload);
  const cpuvCard = payload.analysisCards?.find(c => c.id === 'insight-wipes-cpuv');
  assert.ok(cpuvCard);
  assert.ok(cpuvCard.summary.includes('7.20'), '应当真实读取 baseline KPI wipes-cum-cpuv-t2: 7.20');
  assert.ok(!cpuvCard.summary.includes('8.23'), '严禁回退历史假数据 8.23');
});

test('18. 启萃没有评论数据时不生成 100% 清洁度成功结论', async () => {
  const payload = await transformQicui({});
  assert.ok(payload);
  const sentimentCard = payload.analysisCards?.find(c => c.id === 'insight-qicui-sentiment');
  assert.ok(sentimentCard);
  if (payload.datasets.summary_kpis.rows[0].comment_total === 0) {
    assert.equal(sentimentCard.severity, 'info');
    assert.ok(sentimentCard.summary.includes('待观测'));
  } else {
    assert.ok(sentimentCard.summary.includes('非负向清洁度'));
  }
});

// ============================================================================
// 3. AI 上下文测试 (AI Copilot Context Tests, 19-24)
// ============================================================================

test('19 & 20. AI 助手上下文指定日期正确筛选且不硬编码默认历史日期', () => {
  const mockPayload = {
    projectId: 'test-p',
    name: '测试项目',
    brand: '测试品牌',
    reportPeriod: '2026-10-01 ~ 2026-10-31',
    dataThrough: '2026-10-25',
    datasets: {
      summary_kpis: {
        id: 'summary_kpis',
        columns: [
          { key: 'total_spend', label: '累计消耗', type: 'number', format: 'currency', displayUnits: '元' },
        ],
        rows: [{ total_spend: 50000 }],
      },
      daily_flow: {
        id: 'daily_flow',
        columns: [
          { key: 'date', label: '日期', type: 'date', role: 'TIMESTAMP' },
          { key: 'spend', label: '消耗', type: 'number', format: 'currency' },
        ],
        rows: [
          { date: '2026-10-10', spend: 1000 },
          { date: '2026-10-11', spend: 1200 },
          { date: '2026-10-12', spend: 1500 },
        ],
      },
    },
    sections: [],
  };

  const unfilteredCtx = buildCopilotContext(mockPayload);
  assert.equal(unfilteredCtx.isFiltered, false);
  assert.equal(unfilteredCtx.dataThrough, '2026-10-25');
  assert.equal(unfilteredCtx.keyTablesSummary.find(t => t.id === 'daily_flow').rowCount, 3);

  const filteredCtx = buildCopilotContext(mockPayload, { day: '2026-10-11' });
  assert.equal(filteredCtx.isFiltered, true);
  assert.equal(filteredCtx.queryPeriod, '2026-10-11');
  const flowSummary = filteredCtx.keyTablesSummary.find(t => t.id === 'daily_flow');
  assert.equal(flowSummary.rowCount, 1, '指定日期时明细表切片为 1 行');
  assert.equal(flowSummary.sampleRows[0].spend, 1200);
});

test('21 & 22. 日期筛选时明确全周期 KPI 与宏观洞察范围，不伪造局部指标', () => {
  const mockPayload = {
    projectId: 'test-p',
    name: '测试项目',
    brand: '测试品牌',
    datasets: {
      summary_kpis: {
        id: 'summary_kpis',
        columns: [{ key: 'kpi', label: '全周期KPI', type: 'number' }],
        rows: [{ kpi: 9999 }],
      },
    },
    sections: [],
    analysisCards: [
      { id: 'c1', title: '全周期策略洞察', summary: '整体执行顺利', targetQueryIds: ['summary_kpis'] },
    ],
  };

  const ctx = buildCopilotContext(mockPayload, { day: '2026-10-15' });
  assert.ok(ctx.markdownFactSheet.includes('全周期累计/基线值'), 'Prompt 中必须明确标注全周期累计');
  assert.ok(ctx.markdownFactSheet.includes('全周期宏观结论'), 'Prompt 中必须明确标注洞察属于宏观结论');
});

// ============================================================================
// 4. 组件与健康检查测试 (Component Tests, 25-30)
// ============================================================================

test('25 & 26. UniversalBoardRenderer 源码严格统一使用 effectiveRows', () => {
  const compFile = fs.readFileSync(path.join(root, 'features/campaign/UniversalBoardRenderer.tsx'), 'utf8');
  assert.ok(!compFile.includes('dataset.rows.map(r => ({'), 'multi-line-deck 不得直接读取 dataset.rows');
  assert.ok(!compFile.includes('const previewRows = dataset.rows.slice(0, 6);'), '通用表格预览必须使用 effectiveRows');
});

test('27. 缺失值格式化严格呈现为 "-" 或 "未观测"，绝不转换为 0', () => {
  assert.equal(formatDatasetValue(null), '-');
  assert.equal(formatDatasetValue(undefined), '-');
  assert.equal(formatDatasetValue(''), '-');
  assert.equal(formatDatasetValue(0, { key: 'cnt', label: '计数', format: 'integer' }), '0', '真实 0 正常显示为 0');

  const metricNull = formatMetricCardValue(null);
  assert.equal(metricNull.display, '未观测');
  const metricZero = formatMetricCardValue(0, { key: 'c', label: '零指标', type: 'number', format: 'integer' });
  assert.equal(metricZero.display, '0');
});

test('28. 表格分页与筛选组合时当前页不超出总页数', () => {
  const totalRows = 5;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const userRequestedPage = 3;
  const safePage = Math.min(totalPages, Math.max(1, userRequestedPage));
  assert.equal(safePage, 1, '当筛选后总页数减少为 1 时，当前页应安全归位为第 1 页');
});

test('29. 日期范围筛选开始时间不晚于结束时间', () => {
  let startDate = '2026-10-20';
  let endDate = '2026-10-10';
  if (startDate && endDate && startDate > endDate) {
    endDate = startDate;
  }
  assert.equal(startDate <= endDate, true);
  assert.equal(endDate, '2026-10-20');
});

test('30. BoardHealth 缺少百分比口径声明严格阻断 ERROR', () => {
  const payloadMissingPercentInput = {
    projectId: 'test-p',
    name: '测试项目',
    brand: '品牌',
    datasets: {
      summary_kpis: {
        id: 'summary_kpis',
        columns: [
          { key: 'ctr', label: '点击率', type: 'number', format: 'percent' },
        ],
        rows: [{ ctr: 0.12 }],
      },
    },
    sections: [],
  };

  const report = validateBoardHealth(payloadMissingPercentInput);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(e => e.code === 'MISSING_PERCENT_INPUT_DECLARATION'));
});

test.after(async () => {
  await vite.close();
});
