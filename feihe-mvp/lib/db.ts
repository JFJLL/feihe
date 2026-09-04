import { runtimeVars, warmWorkerEnv, workerEnvSync } from './runtime-env';

let schemaReady: Promise<void> | null = null;
export const DEFAULT_PROJECT_ID = 'qicui';

export type MiniRow = Record<string, unknown>;
export type MiniRunner = {
  first<T = MiniRow>(column?: string): Promise<T | null>;
  all<T = MiniRow>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
};
export type MiniDb = {
  prepare(query: string): { bind(...params: unknown[]): MiniRunner } & MiniRunner;
  batch(statements: Array<{ run(): Promise<unknown> }>): Promise<unknown[]>;
};

void warmWorkerEnv();

type NodeBuiltins = {
  sqlite: typeof import('node:sqlite');
  fs: typeof import('node:fs');
  path: typeof import('node:path');
} | null;
const nodeBuiltins: NodeBuiltins = await (async (): Promise<NodeBuiltins> => {
  try {
    if (typeof process === 'undefined' || !process.versions?.node) return null;
    const [sqlite, fs, path] = await Promise.all([import('node:sqlite'), import('node:fs'), import('node:path')]);
    return { sqlite, fs, path };
  } catch {
    return null;
  }
})();

let sqliteDb: MiniDb | null = null;

function seedFromMiniflare(file: string): void {
  if (!nodeBuiltins) return;
  const { fs, path } = nodeBuiltins;
  try {
    if (fs.existsSync(file)) return;
    const d1dir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1');
    if (!fs.existsSync(d1dir)) return;
    let best = '';
    let bestMtime = 0;
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.sqlite') || e.name.startsWith('metadata.sqlite')) continue;
        const m = fs.statSync(p).mtimeMs;
        if (m > bestMtime) { bestMtime = m; best = p; }
      }
    };
    walk(d1dir);
    if (!best) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(best, file);
    for (const suffix of ['-wal', '-shm']) {
      try { if (fs.existsSync(best + suffix)) fs.copyFileSync(best + suffix, file + suffix); } catch { /* ignore */ }
    }
  } catch { /* fall through to fresh database */ }
}

function nodeDb(): MiniDb {
  if (sqliteDb) return sqliteDb;
  const nb = nodeBuiltins;
  if (!nb) throw new Error('D1 数据库未绑定');
  const file = process.env.LOCAL_DB_PATH || nb.path.join(process.cwd(), 'data', 'local.db');
  seedFromMiniflare(file);
  nb.fs.mkdirSync(nb.path.dirname(file), { recursive: true });
  const native = new nb.sqlite.DatabaseSync(file);
  const wrap = (query: string, params: unknown[]): MiniRunner => {
    const stmt = native.prepare(query);
    const list = params as never[];
    return {
      first: (async <T>(column?: string) => {
        const row = stmt.get(...list) as MiniRow | undefined;
        if (!row) return null;
        return (column ? row[column] : row) as T;
      }),
      all: (async <T>() => ({ results: (stmt.all(...list) as MiniRow[] as unknown as T[]) ?? [] })),
      run: (async () => { stmt.run(...list); return { success: true }; }),
    };
  };
  sqliteDb = {
    prepare: (query: string) => {
      const unbound = wrap(query, []);
      return { bind: (...params: unknown[]) => wrap(query, params), ...unbound };
    },
    batch: (async (statements: Array<{ run(): Promise<unknown> }>) => {
      const out: unknown[] = [];
      for (const s of statements) out.push(await s.run());
      return out;
    }),
  };
  return sqliteDb;
}

export function db(): MiniDb {
  const w = workerEnvSync() as { DB?: MiniDb };
  if (w.DB) return w.DB;
  return nodeDb();
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const d1 = db();
    await d1.batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,name TEXT NOT NULL,spu TEXT NOT NULL DEFAULT '',brand TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT '进行中',
        color TEXT NOT NULL DEFAULT '#1769d5',start_at TEXT,end_at TEXT,created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS project_notes (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,source_type TEXT NOT NULL DEFAULT 'scan',
        pipeline TEXT NOT NULL DEFAULT 'value_scan',level TEXT NOT NULL DEFAULT 'P3',product_scope TEXT NOT NULL DEFAULT '本品',
        status TEXT NOT NULL DEFAULT '待抓取',last_fetched_at TEXT,comment_total INTEGER NOT NULL DEFAULT 0,
        positive_count INTEGER NOT NULL DEFAULT 0,negative_count INTEGER NOT NULL DEFAULT 0,
        question_count INTEGER NOT NULL DEFAULT 0,brand_mention_top5 REAL NOT NULL DEFAULT 0,added_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS project_pipelines (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,key TEXT NOT NULL,name TEXT NOT NULL,target_count INTEGER NOT NULL,
        delivered_count INTEGER NOT NULL DEFAULT 0,budget REAL NOT NULL DEFAULT 0,spent REAL NOT NULL DEFAULT 0
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS project_settings (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS data_sources (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'feishu_sheet',name TEXT NOT NULL,
        spreadsheet TEXT NOT NULL DEFAULT '',sheet_id TEXT NOT NULL DEFAULT '',range TEXT NOT NULL DEFAULT 'A1:AZ5000',
        kind TEXT NOT NULL DEFAULT 'owned',sync_frequency TEXT NOT NULL DEFAULT 'manual',status TEXT NOT NULL DEFAULT '未连接',
        last_synced_at TEXT,last_row_count INTEGER NOT NULL DEFAULT 0,mapping_json TEXT NOT NULL DEFAULT '{}',
        last_error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,provider TEXT NOT NULL,name TEXT NOT NULL,base_url TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,config_json TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT '未检测',
        last_tested_at TEXT,last_error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS review_rules (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,name TEXT NOT NULL,keywords TEXT NOT NULL DEFAULT '',
        sentiment TEXT NOT NULL DEFAULT '中立',category TEXT NOT NULL DEFAULT '自定义规则',action TEXT NOT NULL DEFAULT '保留观察',
        priority INTEGER NOT NULL DEFAULT 100,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS saved_reports (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,title TEXT NOT NULL,period_start TEXT,period_end TEXT,
        status TEXT NOT NULL DEFAULT '草稿',summary_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS source_accounts (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,integration_id TEXT,external_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,account_type TEXT NOT NULL DEFAULT 'sub_account',status TEXT NOT NULL DEFAULT '未检测',
        metadata_json TEXT NOT NULL DEFAULT '{}',last_synced_at TEXT,last_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS api_endpoints (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,integration_id TEXT,key TEXT NOT NULL,name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',path TEXT NOT NULL,category TEXT NOT NULL DEFAULT '数据查询',
        description TEXT NOT NULL DEFAULT '',parameter_schema TEXT NOT NULL DEFAULT '{}',response_schema TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,last_tested_at TEXT,last_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS metric_definitions (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,key TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT '',aggregation TEXT NOT NULL DEFAULT 'sum',formula TEXT NOT NULL DEFAULT '',
        format TEXT NOT NULL DEFAULT 'number',aliases_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS metric_bindings (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,metric_id TEXT NOT NULL,endpoint_id TEXT,source_id TEXT,
        source_field TEXT NOT NULL,dimensions_json TEXT NOT NULL DEFAULT '[]',transform_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS uploaded_assets (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,file_name TEXT NOT NULL,content_type TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,r2_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT '已上传',
        summary_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,prompt TEXT NOT NULL,status TEXT NOT NULL DEFAULT '排队中',
        engine TEXT NOT NULL DEFAULT '规则引擎',date_start TEXT,date_end TEXT,query_plan_json TEXT NOT NULL DEFAULT '{}',
        report_spec_json TEXT NOT NULL DEFAULT '{}',progress INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,finished_at TEXT
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS agent_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL,step_order INTEGER NOT NULL,name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT '待执行',detail TEXT NOT NULL DEFAULT '',started_at TEXT,finished_at TEXT
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS report_versions (
        id TEXT PRIMARY KEY,project_id TEXT NOT NULL,run_id TEXT,title TEXT NOT NULL,period_start TEXT,period_end TEXT,
        status TEXT NOT NULL DEFAULT '草稿',report_spec_json TEXT NOT NULL DEFAULT '{}',html TEXT NOT NULL DEFAULT '',
        source_manifest_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY, url TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT 'scan',
        pipeline TEXT NOT NULL DEFAULT 'value_scan', level TEXT NOT NULL DEFAULT 'P3',
        product_scope TEXT NOT NULL DEFAULT '本品', published_at TEXT, last_fetched_at TEXT,
        comment_total INTEGER NOT NULL DEFAULT 0, positive_count INTEGER NOT NULL DEFAULT 0,
        negative_count INTEGER NOT NULL DEFAULT 0, question_count INTEGER NOT NULL DEFAULT 0,
        brand_mention_top5 REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '待抓取'
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS comment_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT, note_id TEXT NOT NULL, captured_at TEXT NOT NULL,
        l1_count INTEGER NOT NULL, l2_count INTEGER NOT NULL, total_count INTEGER NOT NULL,
        positive_count INTEGER NOT NULL, negative_count INTEGER NOT NULL,
        question_count INTEGER NOT NULL, irrelevant_count INTEGER NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS note_profiles (
        note_id TEXT PRIMARY KEY, cover_url TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        category1 TEXT NOT NULL DEFAULT '', category2 TEXT NOT NULL DEFAULT '', cooperation INTEGER NOT NULL DEFAULT 0,
        promoted INTEGER NOT NULL DEFAULT 0, note_type TEXT NOT NULL DEFAULT '', note_price REAL NOT NULL DEFAULT 0,
        exposure INTEGER NOT NULL DEFAULT 0, read_count INTEGER NOT NULL DEFAULT 0,
        interaction_count INTEGER NOT NULL DEFAULT 0, like_count INTEGER NOT NULL DEFAULT 0,
        favorite_count INTEGER NOT NULL DEFAULT 0, share_count INTEGER NOT NULL DEFAULT 0,
        fans_count INTEGER NOT NULL DEFAULT 0, creator_level TEXT NOT NULL DEFAULT '',
        picture_price REAL NOT NULL DEFAULT 0, video_price REAL NOT NULL DEFAULT 0,
        province TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', gender TEXT NOT NULL DEFAULT '',
        read_median INTEGER NOT NULL DEFAULT 0, interaction_median INTEGER NOT NULL DEFAULT 0,
        brand TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS note_covers (
        id TEXT PRIMARY KEY,note_id TEXT NOT NULL,project_id TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',r2_key TEXT NOT NULL DEFAULT '',
        content_type TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT '待抓取',fetched_at TEXT,
        last_error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS key_comments (
        id TEXT PRIMARY KEY, note_id TEXT NOT NULL, parent_id TEXT, content TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '', created_at TEXT, sentiment TEXT NOT NULL,
        category TEXT NOT NULL, action TEXT NOT NULL, treatment_status TEXT NOT NULL DEFAULT '待处理',
        treatment_method TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
        disappeared_at TEXT, reply_count INTEGER NOT NULL DEFAULT 0
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS supplier_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, external_key TEXT NOT NULL UNIQUE,
        note_id TEXT NOT NULL, note_url TEXT NOT NULL DEFAULT '', creator TEXT NOT NULL DEFAULT '',
        planned_content TEXT NOT NULL, comment_format TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT '待核验', matched_content TEXT, verified_at TEXT
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, target_count INTEGER NOT NULL,
        delivered_count INTEGER NOT NULL DEFAULT 0, budget REAL NOT NULL DEFAULT 0,
        spent REAL NOT NULL DEFAULT 0
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT '运行中', progress INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, finished_at TEXT
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT '', target_id TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
      )`),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_notes_pipeline ON notes(pipeline)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_project_notes_note ON project_notes(note_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_project_pipelines_project ON project_pipelines(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_data_sources_project ON data_sources(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_integrations_project_provider ON integrations(project_id,provider)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_rules_project_priority ON review_rules(project_id,priority)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_saved_reports_project_updated ON saved_reports(project_id,updated_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_source_accounts_project ON source_accounts(project_id,updated_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_api_endpoints_project_key ON api_endpoints(project_id,key)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_metric_definitions_project_key ON metric_definitions(project_id,key)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_metric_bindings_project_metric ON metric_bindings(project_id,metric_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_uploaded_assets_project_created ON uploaded_assets(project_id,created_at)'),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_agent_runs_active ON agent_runs(project_id,status) WHERE status IN ('排队中','运行中')"),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_agent_runs_project_created ON agent_runs(project_id,created_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_agent_steps_run_order ON agent_steps(run_id,step_order)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_report_versions_project_created ON report_versions(project_id,created_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_note_profiles_brand ON note_profiles(brand)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_note_covers_project_status ON note_covers(project_id,status)'),
      d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_note_covers_project_note ON note_covers(project_id,note_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_key_comments_action_status ON key_comments(action, treatment_status)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_key_comments_note_id ON key_comments(note_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_supplier_note_visibility ON supplier_comments(note_id, visibility)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_snapshots_note_time ON comment_snapshots(note_id, captured_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at)'),
      d1.prepare(`CREATE TABLE IF NOT EXISTS paid_ad_metrics (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL DEFAULT 'qicui',
        metric_date TEXT NOT NULL,
        account_name TEXT NOT NULL DEFAULT '',
        virtual_seller_id TEXT NOT NULL DEFAULT '',
        rtb_advertiser_id INTEGER,
        brand_name TEXT NOT NULL DEFAULT '',
        spend REAL NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        clicks INTEGER NOT NULL DEFAULT 0,
        ctr REAL NOT NULL DEFAULT 0,
        interactions INTEGER NOT NULL DEFAULT 0,
        balance REAL NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT 'partner_sub_page',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_paid_ads_project_date ON paid_ad_metrics(project_id, metric_date)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_paid_ads_seller ON paid_ad_metrics(virtual_seller_id, metric_date)'),
    ]);
    const ensureColumn = async (table: string, column: string, definition: string) => {
      const existing = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      if (!(existing.results || []).some((item) => item.name === column)) await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    };
    await ensureColumn('comment_snapshots', 'project_id', `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
    await ensureColumn('data_sources', 'mapping_json', `TEXT NOT NULL DEFAULT '{}'`);
    await ensureColumn('data_sources', 'last_error', `TEXT NOT NULL DEFAULT ''`);
    await ensureColumn('project_notes', 'last_fetched_at', 'TEXT');
    await ensureColumn('project_notes', 'comment_total', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('project_notes', 'positive_count', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('project_notes', 'negative_count', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('project_notes', 'question_count', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('project_notes', 'brand_mention_top5', 'REAL NOT NULL DEFAULT 0');
    await ensureColumn('key_comments', 'project_id', `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
    await ensureColumn('supplier_comments', 'project_id', `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
    await ensureColumn('jobs', 'project_id', `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
    await ensureColumn('action_logs', 'project_id', `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
    await d1.batch([
      d1.prepare(`INSERT OR IGNORE INTO projects(id,name,spu,brand,category,description,status,color,created_at,updated_at)
        VALUES('${DEFAULT_PROJECT_ID}','启萃评论与声量项目','启萃','飞鹤','婴幼儿奶粉','评论执行、口碑舆情与本竞品监测','进行中','#1769d5',?,?)`).bind(new Date().toISOString(),new Date().toISOString()),
      d1.prepare(`INSERT OR IGNORE INTO pipelines(id,name,target_count,delivered_count,budget,spent) VALUES('viral','素人评论大爆文',200,128,24000,15360)`),
      d1.prepare(`INSERT OR IGNORE INTO pipelines(id,name,target_count,delivered_count,budget,spent) VALUES('value_scan','价值笔记扫描',68,43,12000,7200)`),
      d1.prepare(`INSERT OR IGNORE INTO pipelines(id,name,target_count,delivered_count,budget,spent) VALUES('commercial','新发商业笔记',360,276,42000,30660)`),
      d1.prepare(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES('rules','{"brands":["飞鹤","启萃","卓睿"],"competitors":["爱他美","合生元","派星","A2","a2","至初","美素","金领冠"],"positiveWords":["好吸收","长肉","长个","适应","好转奶","抵抗力","体质","便便正常","爱喝","放心","稳当","细腻","溶解"],"negativeWords":["不好","踩雷","过敏","便秘","拉肚子","胀气","吐奶","不长肉","腥","难喝","结块","发货慢","不发货","客服","核销","假货","贵","后悔"]}',?)`).bind(new Date().toISOString()),
      d1.prepare(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES('acceptance','{"reportCount":200,"baseCount":30,"brandTopRate":0.4}',?)`).bind(new Date().toISOString()),
    ]);
    const runtime = runtimeVars();
    const xhsBaseUrl = runtime.XHS_BASE_URL || process.env.XHS_BASE_URL || '';
    await d1.prepare(`INSERT OR IGNORE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at)
      VALUES(?,?,?,?,?,1,?,'未检测',?,?)`).bind(`${DEFAULT_PROJECT_ID}:redtrend`,DEFAULT_PROJECT_ID,'redtrend','RedTrend 内容与评论接口',xhsBaseUrl,
      JSON.stringify({searchPath:'/api/solar/content_square/searchNote',detailPath:'/api/solar/note/{noteId}/detail?bizCode=',l1Path:'/api/solar/note/{noteId}/l1_comments',l2Path:'/api/solar/note/{noteId}/l2_comments'}),new Date().toISOString(),new Date().toISOString()).run();
    await d1.prepare(`INSERT OR IGNORE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at)
      VALUES(?,?,?,?,?,1,?,'待配置文本模型',?,?)`).bind(`${DEFAULT_PROJECT_ID}:keystone`,DEFAULT_PROJECT_ID,'keystone','Keystone AI 模型网关','https://keystonehk.ai/v1',
      JSON.stringify({modelsPath:'/models',chatPath:'/chat/completions',textModel:'gpt-5.6-terra',imageModel:'gpt-image-2',purpose:'意图理解、ReportSpec 生成与生图'}),new Date().toISOString(),new Date().toISOString()).run();
    const metricSeeds = [
      ['spend','消耗','元','sum','费用,花费,投放消耗'],['impressions','曝光量','次','sum','曝光,展现'],
      ['clicks','点击量','次','sum','点击'],['ctr','点击率','%','ratio','CTR'],['cpc','点击成本','元','ratio','CPC'],
      ['cpm','千次曝光成本','元','ratio','CPM'],['interactions','互动量','次','sum','互动,赞藏评转'],
      ['cpe','互动成本','元','ratio','CPE'],['reads','阅读量','次','sum','阅读'],['cpr','阅读成本','元','ratio','CPR'],
      ['seed_users','新增种草人数','人','sum','种草人数,新增种草'],['deep_seed_users','深度种草人数','人','sum','深度种草'],
      ['cpuv','种草成本','元','ratio','CPUV'],['gmv','成交金额','元','sum','GMV,成交额'],['roi','投入产出比','','ratio','ROI'],
      ['published_notes','发布笔记数','篇','sum','发布进度,笔记发布'],['positive_comments','正向评论','条','sum','正向口碑'],
      ['negative_comments','负向评论','条','sum','负面评论,负向舆情'],['supplier_visible_rate','供应商外显率','%','ratio','评论外显率']
    ];
    await d1.batch(metricSeeds.map(([key,name,unit,aggregation,aliases])=>d1.prepare(`INSERT OR IGNORE INTO metric_definitions(id,project_id,key,name,unit,aggregation,aliases_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`${DEFAULT_PROJECT_ID}:${key}`,DEFAULT_PROJECT_ID,key,name,unit,aggregation,JSON.stringify(String(aliases).split(',')),new Date().toISOString(),new Date().toISOString())));
    await d1.batch([
      d1.prepare(`INSERT OR IGNORE INTO project_notes(id,project_id,note_id,source_type,pipeline,level,product_scope,status,last_fetched_at,comment_total,positive_count,negative_count,question_count,brand_mention_top5,added_at)
        SELECT '${DEFAULT_PROJECT_ID}:'||id,'${DEFAULT_PROJECT_ID}',id,source_type,pipeline,level,product_scope,status,last_fetched_at,comment_total,positive_count,negative_count,question_count,brand_mention_top5,COALESCE(published_at,last_fetched_at,datetime('now')) FROM notes`),
      d1.prepare(`INSERT OR IGNORE INTO project_pipelines(id,project_id,key,name,target_count,delivered_count,budget,spent)
        SELECT '${DEFAULT_PROJECT_ID}:'||id,'${DEFAULT_PROJECT_ID}',id,name,target_count,delivered_count,budget,spent FROM pipelines`),
      d1.prepare(`INSERT OR IGNORE INTO project_settings(id,project_id,key,value,updated_at)
        SELECT '${DEFAULT_PROJECT_ID}:'||key,'${DEFAULT_PROJECT_ID}',key,value,updated_at FROM settings`),
      d1.prepare(`UPDATE project_notes SET
        last_fetched_at=(SELECT last_fetched_at FROM notes WHERE notes.id=project_notes.note_id),
        comment_total=(SELECT comment_total FROM notes WHERE notes.id=project_notes.note_id),
        positive_count=(SELECT positive_count FROM notes WHERE notes.id=project_notes.note_id),
        negative_count=(SELECT negative_count FROM notes WHERE notes.id=project_notes.note_id),
        question_count=(SELECT question_count FROM notes WHERE notes.id=project_notes.note_id),
        brand_mention_top5=(SELECT brand_mention_top5 FROM notes WHERE notes.id=project_notes.note_id)
        WHERE project_id='${DEFAULT_PROJECT_ID}' AND last_fetched_at IS NULL AND comment_total=0
          AND EXISTS(SELECT 1 FROM notes WHERE notes.id=project_notes.note_id)`),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_key_comments_project ON key_comments(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_supplier_comments_project ON supplier_comments(project_id)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_snapshots_project_time ON comment_snapshots(project_id,captured_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_jobs_project_created ON jobs(project_id,created_at)'),
      d1.prepare('CREATE INDEX IF NOT EXISTS idx_action_logs_project_created ON action_logs(project_id,created_at)'),
    ]);
    await d1.prepare('PRAGMA optimize').run();
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}
