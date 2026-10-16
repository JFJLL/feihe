import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const testDbPath = path.resolve('.verification/competitor-validation.db');
process.env.LOCAL_DB_PATH = testDbPath;
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';

if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch {}
}

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

async function runAll() {
  const { db } = await vite.ssrLoadModule('/lib/db.ts');
  const {
    ensureCompetitorsSchema,
    getCompetitorConfig,
    saveCompetitorConfig
  } = await vite.ssrLoadModule('/lib/competitors/db.ts');
  const {
    parseRawIpscgRecord,
    attributeBrandAndLine,
    detectContentNature,
    extractConsumerIssues
  } = await vite.ssrLoadModule('/lib/competitors/analyzer.ts');
  const { runCompetitorSync } = await vite.ssrLoadModule('/lib/competitors/worker.ts');
  const { GET, POST } = await vite.ssrLoadModule('/app/api/competitors/route.ts');
  const { claimTask, finishTask, dueTasks } = await vite.ssrLoadModule('/lib/business-sync/store.ts');

  console.log('=== [1] 测试独立 Schema 建立 ===');
  await ensureCompetitorsSchema();
  const d = db();
  const tables = await d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'competitor_%'").all();
  const tableNames = tables.results.map((r) => r.name);
  console.log('已建立的数据表:', tableNames);
  assert(tableNames.includes('competitor_configs'), '缺少 competitor_configs 表');
  assert(tableNames.includes('competitor_notes'), '缺少 competitor_notes 表');
  assert(tableNames.includes('competitor_sync_logs'), '缺少 competitor_sync_logs 表');
  console.log('✓ Schema 建立验证通过\n');

  console.log('=== [2] 测试项目隔离与空态机制 ===');
  const qicuiConfig = await getCompetitorConfig('qicui');
  assert(qicuiConfig?.isConfigured, 'qicui 应具备种子绑定的授权任务');
  assert.strictEqual(qicuiConfig.taskId, 'ba7a885c-16b5-479d-a2a9-9cceb5908e9c');

  const secondProjectConfig = await getCompetitorConfig('project-test-empty');
  assert.strictEqual(secondProjectConfig?.isConfigured, false, '第二项目默认必须为空配置');
  assert.strictEqual(secondProjectConfig?.taskId, '', '第二项目严禁继承启萃 taskId');

  const rejectRes = await runCompetitorSync('project-test-empty');
  assert.strictEqual(rejectRes.success, false);
  assert(rejectRes.error?.includes('尚未绑定'), '未配置项目应被拒绝');

  const hijackRes = await runCompetitorSync('qicui', { taskId: 'illegal-task-id-12345' });
  assert.strictEqual(hijackRes.success, false);
  assert(hijackRes.error?.includes('不符'), '越权 taskId 应被拦截');
  console.log('✓ 项目隔离与空态越权防护验证通过\n');

  console.log('=== [3] 端到端：rawRecord -> analyze -> 入库 -> API 品牌归属严格验证 ===');
  const brandRules = qicuiConfig.brandRules;
  const testNoteMap = new Map();

  // Case A: 游戏无品牌内容（命中关键词金领冠，但无品牌证据，严格归为 unknown）
  const rawA = {
    noteId: 'test_raw_game_001',
    title: '#第五人格追光逐梦',
    content: '今天玩游戏抽到了金皮太开心了',
    nickname: '玩家小张',
    pubTime: '2026-10-01 12:00:00',
    tagList: '["第五人格"]'
  };
  const parsedA = parseRawIpscgRecord(rawA, 'qicui', qicuiConfig.taskId, '金领冠', brandRules, testNoteMap);
  assert.strictEqual(parsedA.brandAttributed, 'unknown', 'Case A 缺少品牌证据必须归属 unknown，绝不 fallback 到金领冠');
  assert.strictEqual(parsedA.keywordHit, '金领冠', '保留采集关键词作来源');

  // Case B: 正文明确指另一品牌（命中关键词合生元，但内容通篇推荐飞鹤启萃）
  const rawB = {
    noteId: 'test_raw_cross_002',
    title: '宝宝断奶日记：飞鹤启萃真的好喝',
    content: '试了好几款，最终宝宝特别爱喝飞鹤启萃，长肉很稳',
    nickname: '宝妈李莉',
    pubTime: '2026-10-01 13:00:00',
    tagList: '["飞鹤", "启萃", "婴儿奶粉"]'
  };
  const parsedB = parseRawIpscgRecord(rawB, 'qicui', qicuiConfig.taskId, '合生元', brandRules, testNoteMap);
  assert.strictEqual(parsedB.brandAttributed, '飞鹤', 'Case B 正文指向另一品牌必须按证据归属飞鹤');

  // Case C: 明确命中合生元派星
  const rawC = {
    noteId: 'test_raw_biostime_003',
    title: '合生元派星一段喂养感受',
    content: '宝宝从出生就喝合生元派星，吸收挺不错的',
    nickname: '新手妈妈',
    pubTime: '2026-10-01 14:00:00',
    tagList: '["合生元", "派星"]'
  };
  const parsedC = parseRawIpscgRecord(rawC, 'qicui', qicuiConfig.taskId, '合生元', brandRules, testNoteMap);
  assert.strictEqual(parsedC.brandAttributed, '合生元', 'Case C 明确证据归属合生元');
  assert.strictEqual(parsedC.productLine, '派星', '正确识别品线派星');

  // 入库验证
  for (const item of [parsedA, parsedB, parsedC]) {
    await d.prepare(`INSERT OR REPLACE INTO competitor_notes (
      id, project_id, task_id, raw_note_id, id_hex_length, title, content,
      author_name, author_id, avatar_url, pub_time, insert_time, last_update_time,
      asof_date, collection_date, keyword_hit, brand_attributed, product_line,
      content_type, content_nature, nature_evidence, creator_tier,
      liked_count, comment_count, collected_count, share_count, interaction_total,
      note_url, video_url, tags_json, raw_payload_json, duplicate_status,
      suspected_dup_target, consumer_issues_json, sentiment_tendency, data_quality,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      item.id, item.projectId, item.taskId, item.rawNoteId, item.idHexLength, item.title, item.content,
      item.authorName, item.authorId, item.avatarUrl, item.pubTime, item.insertTime, item.lastUpdateTime,
      item.asofDate, item.collectionDate, item.keywordHit, item.brandAttributed, item.productLine,
      item.contentType, item.contentNature, item.natureEvidence, item.creatorTier,
      item.likedCount, item.commentCount, item.collectedCount, item.shareCount, item.interactionTotal,
      item.noteUrl, item.videoUrl, JSON.stringify(item.tags), JSON.stringify(item.rawPayload),
      item.duplicateStatus, item.suspectedDupTarget || null, JSON.stringify(item.consumerIssues),
      item.sentimentTendency, item.dataQuality, item.createdAt, item.updatedAt
    ).run();
  }

  // 调用 API 验证聚合端点对品牌的呈现
  const apiReq = new Request('http://localhost:5246/api/competitors?projectId=qicui&action=data');
  const apiJson = await (await GET(apiReq)).json();
  assert(apiJson.ok, 'API 查询应当成功');
  const apiShares = apiJson.data.brandShares;
  console.log('API 返回的品牌声量份额:', apiShares.map(s => s.brand + ': ' + s.noteCount + '篇 (' + s.sharePercent.toFixed(1) + '%)'));
  assert(apiShares.some(s => s.brand === 'unknown'), 'API 必须显式展示 unknown 品牌');
  assert(apiShares.some(s => s.brand === '飞鹤'), 'API 必须正确归属飞鹤');
  assert(apiShares.some(s => s.brand === '合生元'), 'API 必须正确归属合生元');
  console.log('✓ 端到端 rawRecord -> normalize -> 入库 -> API 品牌归属严格验证通过\n');

  console.log('=== [4] 测试近期明确窗口真实同步与含 taskId 的 Checkpoint ===');
  const windowFrom = '2026-10-01';
  const windowTo = '2026-10-14';
  const targetWindowKey = qicuiConfig.taskId + ':合生元:pubTime:2026-10-01_2026-10-14';

  const syncRes = await runCompetitorSync('qicui', {
    keywords: ['合生元', '金领冠'],
    from: windowFrom,
    to: windowTo,
    windowType: 'pubTime',
    maxPagesPerRun: 1,
    pageSize: 3,
    rateLimitMs: 1200,
  });

  assert(syncRes.success, '真实同步应当执行成功');
  assert(syncRes.rowsRead >= 2, '两个关键词至少各读到记录');
  assert(syncRes.watermarkAdvanced, '成功执行后水位必须推进');
  assert.strictEqual(syncRes.coverageComplete, false, '受控单页预算不可冒充全量已完成');

  // 严格断言带 taskId 的独立 Checkpoint
  const cp1 = syncRes.checkpoints[targetWindowKey];
  assert(cp1, '必须存在确切包含 taskId 的 Checkpoint: ' + targetWindowKey);
  assert.strictEqual(cp1.pageCursor, 1, '第 1 轮同步后 pageCursor 必须为 1');
  console.log('✓ 含 taskId 明确近期窗口第 1 轮同步成功 (Checkpoint 键:', targetWindowKey, ')\n');

  console.log('=== [5] 验证同任务断点续跑推进 ===');
  const resumedRes = await runCompetitorSync('qicui', {
    keywords: ['合生元'],
    from: windowFrom,
    to: windowTo,
    windowType: 'pubTime',
    maxPagesPerRun: 1,
    pageSize: 3,
    rateLimitMs: 1200,
  });

  const cp2 = resumedRes.checkpoints[targetWindowKey];
  assert(cp2, '续传后 Checkpoint 必须存在');
  assert.strictEqual(cp2.pageCursor, 2, '同任务同窗口断点必须严格推进为 2');
  console.log('✓ 同任务断点续跑成功推进至 pageCursor = 2\n');

  console.log('=== [6] 核心验证：换新任务后 Checkpoint 不继承，必须从 page 1 开始 ===');
  const newTaskId = 'task-brand-new-9999-isolated';
  await saveCompetitorConfig('qicui', { taskId: newTaskId });

  // 换新任务后执行同步（同词同窗口）
  const newTaskSyncRes = await runCompetitorSync('qicui', {
    keywords: ['合生元'],
    from: windowFrom,
    to: windowTo,
    windowType: 'pubTime',
    maxPagesPerRun: 1,
    pageSize: 3,
    rateLimitMs: 1200,
  });

  const newTaskKey = newTaskId + ':合生元:pubTime:2026-10-01_2026-10-14';
  const newCp = newTaskSyncRes.checkpoints[newTaskKey];
  assert(newCp, '新任务必须创建属于新 taskId 的 Checkpoint: ' + newTaskKey);
  assert.strictEqual(newCp.pageCursor, 0, '新任务初始水位严格为 0 (未成功抓取不推进水位)');
  assert.notStrictEqual(newCp.pageCursor, 2, '新任务严禁继承旧任务的 pageCursor 2！');

  // 验证旧任务的 Checkpoint 依然完整保留在字典中供审计追溯
  const preservedOldCp = newTaskSyncRes.checkpoints[targetWindowKey];
  assert(preservedOldCp, '旧任务 Checkpoint 必须永久保留在存档中可追溯');
  assert.strictEqual(preservedOldCp.pageCursor, 2, '旧任务页码保持为 2 不被篡改');
  console.log('✓ 换新任务从 page 1 起始且旧任务存档追溯保留验证通过！\n');

  // 恢复授权任务
  await saveCompetitorConfig('qicui', { taskId: 'ba7a885c-16b5-479d-a2a9-9cceb5908e9c' });

  console.log('=== [7] 验证官方持久排队与调度 Worker Claim Lease 闭环 ===');
  const postReq = new Request('http://localhost:5246/api/competitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'qicui',
      action: 'trigger_sync',
      from: '2026-10-01',
      to: '2026-10-14',
      maxPagesPerRun: 1,
    }),
  });
  const postRes = await POST(postReq);
  assert.strictEqual(postRes.status, 202, 'POST trigger_sync 必须返回 202 Queued');
  const postJson = await postRes.json();
  assert(postJson.ok, 'POST trigger_sync 响应成功');
  assert(postJson.queued, '必须标记为 queued');
  assert(postJson.jobId && postJson.jobId.startsWith('req-comp-'), '必须生成持久 requestId/jobId');
  console.log('✓ POST 持久排队成功，返回:', postJson);

  const pendingReq = await d.prepare("SELECT * FROM business_sync_requests WHERE id = ?").bind('qicui:' + postJson.jobId).first();
  assert(pendingReq, 'business_sync_requests 表中必须持久化存入该排队请求');

  const activeTasks = await dueTasks();
  const targetTask = activeTasks.find(t => t.project_id === 'qicui' && t.id === postJson.taskId);
  assert(targetTask, '官方调度 dueTasks 必须能扫描到该持久任务');

  const claim = await claimTask(targetTask);
  assert(claim, '官方 claimTask 必须成功抢占到 lease');
  console.log('调度 Worker 成功 Claim 官方租约！Token:', claim.token, 'RunId:', claim.runId);

  const runningJob = await d.prepare("SELECT * FROM sync_jobs WHERE id = ?").bind(claim.runId).first();
  assert(runningJob, 'sync_jobs 表中必须记录 claim.runId');
  assert.strictEqual(runningJob.status, 'running', '租约期内状态必须为 running');

  const spec = JSON.parse(targetTask.spec_json || '{}');
  const compRes = await runCompetitorSync('qicui', {
    taskId: spec.taskId,
    keywords: spec.keywords,
    from: claim.request?.window_from || spec.from,
    to: claim.request?.window_to || spec.to,
    maxPagesPerRun: 1,
    pageSize: 3,
  });
  assert(compRes.success, 'Worker 执行应当成功');

  await finishTask(targetTask, claim, { rows: compRes.rowsImported });

  const finishedJob = await d.prepare("SELECT * FROM sync_jobs WHERE id = ?").bind(claim.runId).first();
  assert.strictEqual(finishedJob.status, 'success', '调度执行完成后状态必须为 success');

  const processedReq = await d.prepare("SELECT processed_at FROM business_sync_requests WHERE id = ?").bind('qicui:' + postJson.jobId).first();
  assert(processedReq?.processed_at, 'business_sync_requests.processed_at 必须被标记完成');
  console.log('✓ 真实 POST -> 持久排队 -> 独立 Worker Claim Lease -> 执行 -> 持久日志闭环验证通过\n');

  console.log('全部 7 大项核心业务测试圆满通过！');
}

try {
  await runAll();
} finally {
  await vite.close();
}
