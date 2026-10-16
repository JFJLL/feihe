import { createHash } from 'node:crypto';
import { db } from './db';
import { readProjectDashboard, type ProjectDashboardData } from './project-dashboard';
import { getProjectSetting } from './projects';
import { defaultAcceptance } from './business-targets';
import { FEISHU_DOCUMENTS } from './feishu-model';
import { DefinitionError } from './metrics/definitions';
import { queryErrors } from './metrics/query';
import type { MetricQuery } from './metrics/query';
import type { ReportSpec } from './report-agent';

export type QicuiBusinessSnapshot = {
  kind: 'qicui_business';
  fingerprint: string;
  snapshot: Omit<ProjectDashboardData, 'syncedAt'>;
  acceptance: ReturnType<typeof defaultAcceptance>;
  kpis: ReportSpec['kpis'];
  sections: ReportSpec['sections'];
  sources: Array<{ id: string; name: string; fingerprint: string; rows: number; checkedAt: string; status: string; error: string }>;
};

export async function qicuiBusinessAvailable(projectId: string): Promise<boolean> {
  if (projectId !== 'qicui') return false;
  const d1 = db();
  const daily = await d1.prepare('SELECT COUNT(*) AS n FROM business_daily_reports WHERE project_id=?').bind(projectId).first<{ n: number }>();
  if (daily?.n) return true;
  const notes = await d1.prepare('SELECT COUNT(*) AS n FROM project_notes WHERE project_id=?').bind(projectId).first<{ n: number }>();
  if (notes?.n) return true;
  const { feishu } = await readProjectDashboard(projectId);
  return feishu.reports.some(source => source.status === 'success' && source.rows > 0);
}

export async function readQicuiReport(query: MetricQuery): Promise<QicuiBusinessSnapshot> {
  if (query.filters?.length) throw new DefinitionError('启萃业务报告支持日期范围；请清除数据集字段筛选后生成。共享指标报告仍可单独使用字段筛选。');
  const d1 = db();

  // 1. 从真实的 business_daily_reports 中查询匹配日期的业务快照
  let dailyRow: { id: string; business_day: string; status: string; payload_json: string; fingerprint: string } | null = null;

  const errs = queryErrors(query);
  if (errs.length) throw new DefinitionError(errs.join('；'));

  const hasRange = Boolean(query.from || query.to);
  if (hasRange) {
    const conditions = ["project_id='qicui'"];
    const bindings: string[] = [];
    if (query.from) {
      conditions.push('business_day >= ?');
      bindings.push(query.from);
    }
    if (query.to) {
      conditions.push('business_day <= ?');
      bindings.push(query.to);
    }
    const whereSql = conditions.join(' AND ');
    dailyRow = await d1.prepare(
      `SELECT id, business_day, status, payload_json, fingerprint FROM business_daily_reports WHERE ${whereSql} ORDER BY CASE WHEN status='confirmed' THEN 1 ELSE 0 END DESC, business_day DESC, created_at DESC LIMIT 1`
    ).bind(...bindings).first();
    if (!dailyRow) {
      throw new DefinitionError('所选日期范围内无启萃业务日报快照');
    }
  } else {
    // 无输入默认展示最新业务日（优先已确认归档快照，其次最新业务日）
    dailyRow = await d1.prepare(
      "SELECT id, business_day, status, payload_json, fingerprint FROM business_daily_reports WHERE project_id='qicui' ORDER BY CASE WHEN status='confirmed' THEN 1 ELSE 0 END DESC, business_day DESC, created_at DESC LIMIT 1"
    ).first();
  }

  const acceptance = await getProjectSetting('qicui', 'acceptance', defaultAcceptance('qicui'));

  if (dailyRow) {
    const payload = JSON.parse(dailyRow.payload_json);
    const targetDay = dailyRow.business_day;
    const isConfirmed = dailyRow.status === 'confirmed';

    const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const display = (v: number | string | null | undefined) => v === null || v === undefined || v === '' ? '—' : (typeof v === 'number' ? v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(v));

    const core = payload.core || {};
    const progress = payload.progress || {};
    const notesList: Array<Record<string, unknown>> = Array.isArray(payload.notes) ? payload.notes : [];

    const kpis: ReportSpec['kpis'] = [
      {
        key: 'qicui-settlement',
        label: '月度累计结算金额',
        value: finite(core.monthlySettlement?.value) ? '¥' + display(core.monthlySettlement.value) : '未观测',
        unit: '元',
        note: `基准日 ${targetDay} · ${isConfirmed ? '已确认归档快照' : '来源快照'} · 观测真实金额`,
      },
      {
        key: 'qicui-budget',
        label: '月度预算控制额',
        value: finite(core.monthlyBudget?.value) ? '¥' + display(core.monthlyBudget.value) : '未设定',
        unit: '元',
        note: `当月预算指标 · 源表登记`,
      },
      {
        key: 'qicui-gap',
        label: '进度推进差额',
        value: finite(progress.gapThroughData) ? (progress.gapThroughData < 0 ? '-¥' : '¥') + display(Math.abs(progress.gapThroughData)) : '—',
        unit: '元',
        note: progress.planThroughData !== undefined ? `实际通过 ¥${display(progress.actualThroughData)} / 计划 ¥${display(progress.planThroughData)}；未回传不补零` : '未计算进度差额',
      },
      {
        key: 'qicui-notes-count',
        label: '巡查登记笔记',
        value: display(notesList.length),
        unit: '篇',
        note: `基准日 ${targetDay} ${isConfirmed ? '已确认' : '来源快照'} 巡查登记笔记`,
      },
      {
        key: 'qicui-ad-spend',
        label: '当日广告投流',
        value: finite(core.adSpend?.value) ? '¥' + display(core.adSpend.value) : `未登记 (${core.adSpend?.state === 'not_collected' ? '源表未登记' : '缺失'})`,
        note: core.adSpend?.reason || '公式默认零不视为有效观测；严格不补零',
      },
    ];

    // 构建内容、执行与SEO表格
    const topNotes = notesList.slice(0, 20).map(note => ({
      笔记ID: String(note.id || '—'),
      达人: String(note.author || '未知达人'),
      发布日期: String(note.publishedDay || '未明确'),
      当月消耗: (note.monthSpend as any)?.value !== null && (note.monthSpend as any)?.value !== undefined ? '¥' + display((note.monthSpend as any).value) : ((note.monthSpend as any)?.state === 'not_collected' ? '未登记' : '未观测'),
      累计消耗: (note.totalSpend as any)?.value !== null && (note.totalSpend as any)?.value !== undefined ? '¥' + display((note.totalSpend as any).value) : '未观测',
      评论区审计: String(note.audit || '正常'),
      整改进度: String(note.correction || '无需整改'),
      责任人: String(note.owner || '—'),
    }));

    const executionTable = (payload.tables as any[])?.find(t => t.title?.includes('产出') || t.title?.includes('执行')) || payload.tables?.[0];
    const executionRows = executionTable?.rows?.slice(0, 15).map((r: any[]) => {
      const obj: Record<string, string> = {};
      (executionTable.columns || []).forEach((col: string, idx: number) => {
        obj[col] = String(r[idx] ?? '—');
      });
      return obj;
    }) || [];

    const seoTable = (payload.tables as any[])?.find(t => t.title?.includes('关键词') || t.title?.includes('SEO') || t.title?.includes('搜索'));
    const seoRows = seoTable?.rows?.slice(0, 15).map((r: any[]) => {
      const obj: Record<string, string> = {};
      (seoTable.columns || []).forEach((col: string, idx: number) => {
        obj[col] = String(r[idx] ?? '—');
      });
      return obj;
    }) || [];

    const sourceVersionsList = (payload.sourceVersions as any[]) || [];
    const sourceRows = sourceVersionsList.map((s: any) => ({
      来源标识: String(s.sourceKey || '—'),
      抓取范围: String(s.range || '全表'),
      版本号: String(s.version || '—'),
      捕获时间: String(s.capturedAt ? new Date(s.capturedAt).toLocaleString('zh-CN', { hour12: false }) : '未记录'),
      飞书原表: String(s.url || '—'),
    }));

    const sections: ReportSpec['sections'] = [
      {
        id: 'qicui-notes',
        title: '重点笔记档案与整改跟踪',
        eyebrow: 'CONTENT & AUDIT',
        kind: 'table',
        description: `基准日 ${targetDay} 前20篇重点笔记档案；展示真实消耗与整改状态，未观测项不补零。`,
        data: topNotes,
      },
      ...(executionRows.length > 0 ? [{
        id: 'qicui-execution',
        title: executionTable.title || '当前执行底表 · 当月产出',
        eyebrow: 'EXECUTION',
        kind: 'table' as const,
        description: executionTable.scope || '基于执行底表统计的达人与产出进度。',
        data: executionRows,
      }] : []),
      ...(seoRows.length > 0 ? [{
        id: 'qicui-seo',
        title: seoTable.title || '核心占位词关键词与搜索表现',
        eyebrow: 'SEO & SEARCH',
        kind: 'table' as const,
        description: '核心搜索关键词的占位与排名观测表现。',
        data: seoRows,
      }] : []),
      {
        id: 'qicui-rules',
        title: '启萃既有评论验收规则',
        eyebrow: 'RULES',
        kind: 'table',
        data: [{ 可汇报正向评论: acceptance.reportCount, 基础线正向评论: acceptance.baseCount, 产品提及率: (acceptance.brandTopRate * 100).toFixed(1) + '%', 数据新鲜度小时: acceptance.freshnessHours || 24 }],
      },
      {
        id: 'qicui-sources',
        title: '真实业务原表与版本快照',
        eyebrow: 'PROVENANCE',
        kind: 'table',
        description: '报告所引用的真实底表版本号、单元格抓取范围与快照捕获时间。',
        data: sourceRows,
      },
    ];

    const sources = sourceVersionsList.map((s: any) => ({
      id: s.sourceKey,
      name: s.sourceKey,
      fingerprint: s.captureId || '',
      rows: 0,
      checkedAt: s.capturedAt || '',
      status: '最近读取成功',
      error: '',
    }));

    const fingerprint = dailyRow.fingerprint || createHash('sha256').update(JSON.stringify({ rowId: dailyRow.id, targetDay, status: dailyRow.status, kpis, sections })).digest('hex');

    return {
      kind: 'qicui_business',
      fingerprint,
      snapshot: {
        pipelines: [],
        metrics: { noteCount: notesList.length, commentTotal: 0, positiveCount: null, positiveRate: null, negativeCount: null, negativeRate: null, questionCount: null, questionRate: null, publishedCount: 0, supplier: {}, actions: {} },
        analytics: {} as any,
        keyComments: [],
        notes: notesList as any,
        ads: { totals: {}, accounts: [] },
        feishu: { reports: [], daily: [], intelligence: {} as any },
        dailyMetrics: [],
      } as unknown as Omit<ProjectDashboardData, 'syncedAt'>,
      acceptance,
      kpis,
      sections,
      sources,
    };
  }

  // 兜底回退
  const raw = await readProjectDashboard('qicui', new URLSearchParams(query.from ? { from: query.from } : {}), true);
  const { syncedAt, ...snapshot } = structuredClone(raw);
  void syncedAt;
  delete snapshot.feishu.intelligence;
  snapshot.feishu.daily = snapshot.feishu.daily.filter(row => (!query.from || String(row.date) >= query.from) && (!query.to || String(row.date) <= query.to));
  snapshot.dailyMetrics = snapshot.feishu.daily;
  const stored = await d1.prepare('SELECT sheet_id AS id,fingerprint,report_json AS reportJson FROM feishu_sheet_snapshots WHERE project_id=? ORDER BY sheet_id').bind('qicui').all<{ id: string; fingerprint: string; reportJson: string }>();
  const sources = FEISHU_DOCUMENTS.flatMap(document => document.sheets.map(sheet => {
    const value = snapshot.feishu.reports.find(report => report.sheetId === sheet.id), row = stored.results.find(item => item.id === sheet.id);
    return { id: sheet.id, name: document.title + ' / ' + sheet.name, fingerprint: row?.fingerprint || '', rows: value?.rows || 0, checkedAt: value?.checkedAt || '', status: value?.status === 'success' ? '最近读取成功' : value ? '最近读取失败，保留上次成功数据' : '尚未同步', error: value?.error || '' };
  }));
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const sum = (key: string) => { const values = snapshot.feishu.daily.map(row => row[key]).filter(finite); return values.length ? values.reduce((total, value) => total + value, 0) : null; };
  const display = (value: number | null) => value === null ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const reads = snapshot.notes.filter(note => finite(note.readCount)), interactions = snapshot.notes.filter(note => finite(note.interactionCount));
  const kpis: ReportSpec['kpis'] = [
    { key: 'qicui-notes', label: '已同步内容样本', value: display(snapshot.metrics.noteCount), unit: '篇', note: '内容集合与当前业务看板查询一致' },
    { key: 'qicui-reads', label: '已同步内容阅读量', value: reads.length ? display(snapshot.metrics.readCount as number) : '—', note: `实际观测 ${reads.length} / ${snapshot.notes.length} 篇；未观测不补零` },
    { key: 'qicui-interactions', label: '已同步内容互动量', value: interactions.length ? display(snapshot.metrics.interactionCount as number) : '—', note: `实际观测 ${interactions.length} / ${snapshot.notes.length} 篇` },
    { key: 'qicui-spend', label: '范围内实际投放消耗', value: display(sum('actual_spend')), unit: '元', note: '与历史日报相同的原表优先规则；缺日不补零' },
    { key: 'qicui-plan', label: '范围内计划消耗', value: display(sum('plan_spend')), unit: '元', note: '只汇总源表实际有计划的日期' },
  ];
  const sections: ReportSpec['sections'] = [
    { id: 'qicui-content', title: '内容表现与重点笔记', eyebrow: '', kind: 'table', description: '与业务看板共用查询，按发布时间进入日期范围；无发布时间不混入指定范围。前20篇按互动排序，完整来源样本保存到快照。', data: snapshot.notes.slice().sort((a, b) => Number(b.interactionCount || 0) - Number(a.interactionCount || 0)).slice(0, 20).map(note => ({ 笔记: String(note.title), 达人: String(note.author), 阅读: finite(note.readCount) ? note.readCount : '未观测', 互动: finite(note.interactionCount) ? note.interactionCount : '未观测', 达人层级: String(note.creatorLevel || '待补充'), 场景: String(note.category1 || '待补充') })) },
    { id: 'qicui-daily', title: '投放计划与实际日报', eyebrow: '', kind: 'trend', data: snapshot.feishu.daily.map(row => ({ 日期: String(row.date), 实际消耗: finite(row.actual_spend) ? row.actual_spend : '未观测', 计划消耗: finite(row.plan_spend) ? row.plan_spend : '未观测', 信息流CTR: finite(row.feed_ctr) ? row.feed_ctr.toFixed(2) + '%' : '未观测', 搜索CTR: finite(row.search_ctr) ? row.search_ctr.toFixed(2) + '%' : '未观测', 达成率: finite(row.achieve_pct) ? row.achieve_pct.toFixed(2) + '%' : '不可计算' })) },
    { id: 'qicui-rules', title: '启萃既有评论验收规则', eyebrow: '', kind: 'table', data: [{ 可汇报正向评论: acceptance.reportCount, 基础线正向评论: acceptance.baseCount, 产品提及率: (acceptance.brandTopRate * 100).toFixed(1) + '%', 数据新鲜度小时: acceptance.freshnessHours || 24 }] },
  ];
  const fingerprint = createHash('sha256').update(JSON.stringify({ snapshot, acceptance, sources })).digest('hex');
  return { kind: 'qicui_business', fingerprint, snapshot, acceptance, kpis, sections, sources };
}

