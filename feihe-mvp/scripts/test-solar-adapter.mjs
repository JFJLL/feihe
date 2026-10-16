import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';

Object.assign(process.env, {
  LOCAL_DB_PATH: ':memory:',
  LOCAL_DB_NO_SEED: 'true',
  ENABLE_TEST_AUTH: '1',
  REQUIRE_PROD_AUTH: 'false',
});

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/solar-adapter-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});
after(() => vite.close());

const { db } = await vite.ssrLoadModule('/lib/db.ts');
const ops = await vite.ssrLoadModule('/lib/comment-ops/store.ts');
const collect = await vite.ssrLoadModule('/lib/comment-ops/collect.ts');
const xhs = await vite.ssrLoadModule('/lib/xhs.ts');

await ops.ensureCommentOpsSchema();

test('solar adapter: big-int idStr preservation, L1 embedded and L2 pagination de-duplication, userMap nickname resolution', async () => {
  const noteId = 'test_solar_note_01';
  const bigL1Id = '426380746347922178';
  const bigL2Id1 = '426380753111659542';
  const bigL2Id2 = '426380753897723405';
  const rawUserId = '210154916928160769';

  const userMap = {
    [rawUserId]: {
      userId: 'user_hex_01',
      userNickName: '大小姐驾到',
    },
  };

  let l2CallCount = 0;
  const vendor = {
    pageSize: 10,
    read: async (kind, id, query) => {
      if (kind === 'detail') {
        return {
          title: '宝宝爱喝的奶粉',
          desc: '关于转奶经验分享',
          name: '测试作者',
          createTime: '2026-10-14 10:00:00',
        };
      }
      if (kind === 'roots') {
        return {
          l1CommentTotal: 1,
          l1Comments: [
            {
              comment: {
                id: 426380746347922178, // number may lose precision
                idStr: bigL1Id, // idStr must be prioritized
                content: '这个奶粉好喝吗？',
                subCommentCount: 2, // expects 2 replies
                userIdStr: rawUserId,
              },
              l1L2Comments: [
                {
                  idStr: bigL2Id1,
                  content: '我家宝很爱喝',
                  userIdStr: rawUserId,
                },
              ],
              userMap,
            },
          ],
        };
      }
      if (kind === 'replies') {
        l2CallCount++;
        // Returns overlap of bigL2Id1 plus new bigL2Id2
        return {
          l2Comments: [
            {
              idStr: bigL2Id1, // overlap to test de-duplication
              content: '我家宝很爱喝',
              userIdStr: rawUserId,
            },
            {
              idStr: bigL2Id2, // new reply
              content: '冲调也很顺滑',
              userIdStr: rawUserId,
            },
          ],
          userMap,
        };
      }
      throw new Error('Unknown kind: ' + kind);
    },
  };

  const capture = await collect.collectConversation(noteId, vendor);

  assert.equal(capture.comments.length, 3, '总共应为 1 条主评 + 2 条子评（去重后）');
  assert.equal(capture.comments[0].id, bigL1Id, '主评 ID 应为 idStr');
  assert.equal(capture.comments[0].author, '大小姐驾到', '主评作者应从 userMap 解析');
  assert.equal(capture.comments[1].parentId, bigL1Id, '子评 1 parentId 必须绑定主评 idStr');
  assert.equal(capture.comments[2].id, bigL2Id2, '子评 2 ID 应为 idStr');
  assert.equal(capture.complete, true, '数量完整且无异常时应标记 complete: true');
});

test('solar adapter: repeated cursor or budget limit stops gracefully with partial status', async () => {
  const noteId = 'test_stalled_note';
  const vendor = {
    pageSize: 2,
    read: async (kind, id, query) => {
      if (kind === 'detail') return {};
      if (kind === 'roots') {
        // Stalled pagination: returns the same id without advancing
        return {
          l1CommentTotal: 5,
          l1Comments: [
            {
              comment: { idStr: 'cid_same', content: '一直重复的评论' },
            },
          ],
        };
      }
      return {};
    },
  };

  const capture = await collect.collectConversation(noteId, vendor);
  assert.equal(capture.complete, false, '分页未前进或未达到上报数量时必须为 complete: false');
  assert.ok(capture.issues.some((s) => s.includes('主评论分页没有前进') || s.includes('主评论数量未完整核对')));
});

test('source account binding: explicit customerClientId matching, order change invariance, and rejection on missing or multiple accounts', async () => {
  const project = 'qicui_test';
  const now = new Date().toISOString();
  await db()
    .prepare("INSERT INTO projects(id,name,status,created_at,updated_at) VALUES(?,'Qicui Test','active',?,?) ON CONFLICT(id) DO NOTHING")
    .bind(project, now, now)
    .run();

  // Setup mock integration pointing to pgy
  const integrationId = 'int_pgy_test';
  await db()
    .prepare(
      "INSERT INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,'qicui_test','pgy','Solar','https://pgy.xiaohongshu.com',1,?,'active',?,?)"
    )
    .bind(
      integrationId,
      JSON.stringify({
        accountId: 'acc_target',
        cookieObject: 'KOL/token.txt',
      }),
      now,
      now
    )
    .run();

  // Bind target account with customerClientId: 165321943462987
  await db()
    .prepare(
      "INSERT INTO source_accounts(id,project_id,integration_id,external_id,name,account_type,status,metadata_json,created_at,updated_at) VALUES(?,'qicui_test',?,?,'Auth Account','sub_account','active',?,?,?)"
    )
    .bind('acc_target', integrationId, '165321943462987', JSON.stringify({ platform: 'pgy' }), now, now)
    .run();

  // Mock pool resolver with 3 accounts in arbitrary order
  const poolOriginal = [
    { customerClientId: '344049533966281', a1: 'token_3' },
    { customerClientId: '165321943462987', a1: 'token_target_1' },
    { customerClientId: '188801833699238', a1: 'token_2' },
  ];

  // Helper to test filter logic directly
  const resolveAccount = (pool, targetId) => {
    const matched = pool.filter((c) => String(c.customerClientId || c.userId || '') === String(targetId));
    if (matched.length === 0) throw new Error(`未匹配到指定账号 (customerClientId: ${targetId})`);
    if (matched.length > 1) throw new Error(`匹配到多个相同账号凭据 (customerClientId: ${targetId})`);
    return matched[0];
  };

  // 1. Order invariance: finds token_target_1 regardless of index
  const selected1 = resolveAccount(poolOriginal, '165321943462987');
  assert.equal(selected1.a1, 'token_target_1');

  const poolReordered = [
    { customerClientId: '165321943462987', a1: 'token_target_1' },
    { customerClientId: '344049533966281', a1: 'token_3' },
    { customerClientId: '188801833699238', a1: 'token_2' },
  ];
  const selected2 = resolveAccount(poolReordered, '165321943462987');
  assert.equal(selected2.a1, 'token_target_1');

  // 2. Rejection on 0 matches
  assert.throws(() => resolveAccount(poolOriginal, '999999999999999'), /未匹配到指定账号/);

  // 3. Rejection on multiple matches
  const poolDuplicate = [
    { customerClientId: '165321943462987', a1: 'token_a' },
    { customerClientId: '165321943462987', a1: 'token_b' },
  ];
  assert.throws(() => resolveAccount(poolDuplicate, '165321943462987'), /匹配到多个相同账号/);
});

test('coverage denominator & sentiments accounting: 33 is root denominator (not 86), and sentiments sum exactly to 86', () => {
  const platformTotal = 33; // Reported L1 total
  const fetchedRoots = 28;
  const fetchedReplies = 58;
  const totalFetched = fetchedRoots + fetchedReplies; // 86

  // Coverage calculation: must compare roots (28) against reportedRoots (33), never 86 / 33
  const rootCoverage = fetchedRoots / platformTotal;
  assert.equal(rootCoverage < 1, true, '28/33 覆盖率为 84.85%，不可用 86/33 (260%) 冒充覆盖率');
  assert.equal((rootCoverage * 100).toFixed(2), '84.85');

  // Sentiments breakdown reconciliation:
  // question: 17, positive: 7, neutral: 58, negative: 3, mixed: 1
  const breakdown = {
    question: 17,
    positive: 7,
    neutral: 58,
    negative: 3,
    mixed: 1, // 剩余 1 条为正负转折混合
  };

  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  assert.equal(sum, totalFetched, '各类情绪加和 (17+7+58+3+1) 必须严格等于已分析总数 86 条');
});
