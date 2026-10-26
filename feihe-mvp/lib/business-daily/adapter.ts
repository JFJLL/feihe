import { parseNumericValue } from '../numeric-values';
import { parseProjectDate } from '../date-values';
import type { Cell, CommercePoint, DailyPoint, DailyView, Difference, Narrative, NoteSpend, PlatformNativeObservation, ReportDocument, SourceBundle, SourceRef, SourceTable, TableView } from './types';

export const DAILY_SCHEMA_VERSION = 'business-daily/1.0.1';
const txt = (v: unknown) => v === null || v === undefined ? '' : String(v).trim();
const summary = (v: unknown) => /^(?:合计|总计|小计|TTL|整体|汇总)/i.test(txt(v));
export function calendarDay(value: unknown): string | null {
  const t = txt(value);
  if (/^\d{5}(?:\.\d+)?$/.test(t)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000).toISOString().slice(0, 10);
  const epoch = parseProjectDate(value);
  if (epoch === null) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(epoch);
}
const ref = (s: SourceTable | ReportDocument, row?: number, column?: number): SourceRef => ({ sourceKey: s.key, url: s.url, version: s.version, capturedAt: s.capturedAt, captureId: s.captureId, ...('range' in s ? { range: s.range } : {}), row, column });
export function cell(value: unknown, source?: SourceRef, unavailable = false, customReason?: string, partialValue?: number | null): Cell {
  if (/^#(?:REF!|DIV\/0!|VALUE!|N\/A|NUM!|NAME\?|ERROR!)/i.test(txt(value))) return { value: null, state: 'formula_error', reason: txt(value), source };
  if (unavailable) return { value: null, state: 'not_collected', reason: customReason || '费用原始输入尚未登记；公式默认零不视为观测', source, ...(partialValue !== undefined && partialValue !== null ? { partialValue } : {}) };
  const number = parseNumericValue(value);
  return number === null ? { value: null, state: 'missing', reason: txt(value) ? '无法解释的值：' + txt(value) : '源字段为空', source } : { value: number, state: 'observed', source };
}
const missing = (): Cell => cell(null);
export function ratio(numerator: Cell, denominator: Cell): Cell {
  if (numerator.value === null || denominator.value === null) return { value: null, state: 'missing', reason: '同范围分子或分母未观测' };
  if (denominator.value === 0) return { value: null, state: 'formula_error', reason: '分母为零' };
  return cell(numerator.value / denominator.value);
}
export function addCells(values: Cell[], requireComplete = true): Cell {
  const present = values.filter(v => v.value !== null);
  if (!present.length || (requireComplete && present.length !== values.length)) return { value: null, state: 'missing', reason: `实际观测 ${present.length}/${values.length}；不以零补齐` };
  return { value: present.reduce((n, v) => n + v.value!, 0), state: 'observed' };
}
const emptyCommerce = (): CommercePoint => ({ investment: missing(), shopUv: missing(), readUv: missing(), purchaseUv: missing(), newCustomerUv: missing(), monitoredShopUv: missing() });
function idx(header: unknown[], fragment: string) { return header.findIndex(v => txt(v).includes(fragment)); }
export function weeklyPoints(s: SourceTable): DailyPoint[] {
  const [top = []] = s.rows;
  const ix = { day: idx(top, '时间'), plan: idx(top, 'FS总预算'), ad: idx(top, '投流总金额'), k: idx(top, 'K金额'), f: idx(top, 'F金额'), search: idx(top, 'S金额'), all: idx(top, 'KFSOPZ总金额'), settlement: idx(top, 'KFSOPZ总结算金额'), seo: idx(top, 'seo投资'), comments: idx(top, 'P(评论)'), other: idx(top, '杂费-'), star: idx(top, '小红星'), alliance: idx(top, '小红盟') };
  if (Object.values(ix).some(v => v < 0)) throw new Error(s.key + '：周底表结构不兼容，需要核验字段映射');
  const points: DailyPoint[] = []; let week = '';
  for (const [i, r] of s.rows.entries()) {
    if (i < 2 || summary(r[0]) || summary(r[ix.day])) continue;
    const day = calendarDay(r[ix.day]); if (!day) continue;
    if (txt(r[2])) week = txt(r[2]);
    // Primitive leaf inputs for each indicator independently:
    const kLeaves = [ix.star, ix.alliance];
    const fLeaves = [ix.star + 1, ix.star + 2, ix.alliance + 1, ix.alliance + 2];
    const sLeaves = [ix.star + 4, ix.alliance + 4];
    const adLeaves = [...fLeaves, ...sLeaves];

    // Indicator-level leaf availability (distinguishing explicit 0 from null/blank):
    const creatorAvailable = kLeaves.some(j => parseNumericValue(r[j]) !== null);
    const feedAvailable = fLeaves.some(j => parseNumericValue(r[j]) !== null);
    const searchAvailable = sLeaves.some(j => parseNumericValue(r[j]) !== null);
    const adAvailable = feedAvailable && searchAvailable;
    const anyAdLeafInput = adLeaves.some(j => parseNumericValue(r[j]) !== null);

    const seoValue = parseNumericValue(r[ix.seo]);
    const commentsValue = parseNumericValue(r[ix.comments]);

    const rowEntirelyEmpty = !creatorAvailable && !anyAdLeafInput && seoValue === null && commentsValue === null;

    const at = (j: number, unavailable = false, customReason?: string) => {
      return cell(r[j], ref(s, i + 1, j + 1), unavailable, customReason);
    };

    const creatorCell = at(ix.k, !creatorAvailable, '达人费用原始输入尚未登记；公式默认零不视为观测');
    const feedCell = at(ix.f, !feedAvailable, '投流信息流费用原始输入尚未登记；公式默认零不视为观测');
    const searchCell = at(ix.search, !searchAvailable, '投流搜索费用原始输入尚未登记；公式默认零不视为观测');
    const adCell = at(ix.ad, !adAvailable, '投流广告费用尚未回填；公式默认零不视为观测');

    const seoCell = cell(r[ix.seo], ref(s, i + 1, ix.seo + 1), seoValue === null && rowEntirelyEmpty);
    const commentsCell = cell(r[ix.comments], ref(s, i + 1, ix.comments + 1), commentsValue === null && rowEntirelyEmpty);
    const otherCell = cell(r[ix.other], ref(s, i + 1, ix.other + 1), rowEntirelyEmpty);

    // Total Project Investment & Settlement:
    // If ad spend or creator is not available, the formula total lacks components and cannot be treated as complete actual total.
    const projectInvestmentCell: Cell = (() => {
      const rawNum = parseNumericValue(r[ix.all]);
      if (rowEntirelyEmpty || rawNum === null) {
        return at(ix.all, true, '费用原始输入尚未登记');
      }
      if (!adAvailable) {
        return cell(r[ix.all], ref(s, i + 1, ix.all + 1), true, '投流广告费用尚未回填，总投入缺少广告组件，不作为完整实际总额（已登记部分小计：¥' + rawNum.toFixed(2) + '）', rawNum);
      }
      if (!creatorAvailable) {
        return cell(r[ix.all], ref(s, i + 1, ix.all + 1), true, '达人合作费用尚未登记，总投入缺少达人组件，不作为完整实际总额（已登记部分小计：¥' + rawNum.toFixed(2) + '）', rawNum);
      }
      return at(ix.all, false);
    })();

    const settlementCell: Cell = (() => {
      const rawNum = parseNumericValue(r[ix.settlement]);
      if (rowEntirelyEmpty || rawNum === null) {
        return at(ix.settlement, true, '费用原始输入尚未登记');
      }
      if (!adAvailable) {
        return cell(r[ix.settlement], ref(s, i + 1, ix.settlement + 1), true, '投流广告费用尚未回填，缺少广告结算组件，不作为完整实际总额（已登记部分结算：¥' + rawNum.toFixed(2) + '）', rawNum);
      }
      if (!creatorAvailable) {
        return cell(r[ix.settlement], ref(s, i + 1, ix.settlement + 1), true, '达人合作费用尚未登记，缺少达人结算组件，不作为完整实际总额（已登记部分结算：¥' + rawNum.toFixed(2) + '）', rawNum);
      }
      return at(ix.settlement, false);
    })();

    const commerce = (start: number): CommercePoint => {
      const denominatorPending = rowEntirelyEmpty || (/^#/.test(txt(r[start + 6])) && Number(r[start + 7]) === 0);
      const c = (j: number): Cell => denominatorPending && !rowEntirelyEmpty ? { value: null, state: 'missing', reason: '底表引用的电商内表尚未回传当日数据（公式XLOOKUP返回模板零值且进店率为#DIV/0!，属未回传）', source: ref(s, i + 1, start + j + 1) } : cell(r[start + j], ref(s, i + 1, start + j + 1), rowEntirelyEmpty);
      // These are source-local period UVs. We do not claim cross-day unique users.
      return { investment: at(start + 5, !adAvailable), shopUv: c(7), readUv: c(8), purchaseUv: c(9), newCustomerUv: c(10), monitoredShopUv: at(start + 11, !adAvailable) };
    };
    points.push({
      date: day,
      week,
      plan: at(ix.plan, false),
      adSpend: adCell,
      creatorCost: creatorCell,
      projectInvestment: projectInvestmentCell,
      settlement: settlementCell,
      feed: feedCell,
      search: searchCell,
      seo: seoCell,
      comments: commentsCell,
      other: otherCell,
      star: commerce(ix.star),
      alliance: commerce(ix.alliance),
      source: ref(s, i + 1),
      starCreator: at(ix.star, !creatorAvailable),
      allianceCreator: at(ix.alliance, !creatorAvailable)
    });
  }
  return points;
}
export function publicNoteLink(value: unknown, id = ''): string {
  try { const u = new URL(txt(value)); if (!['http:', 'https:'].includes(u.protocol)) return ''; u.search = ''; u.hash = ''; return u.href; } catch { return /^[a-f0-9]{24}$/i.test(id) ? 'https://www.xiaohongshu.com/explore/' + id : ''; }
}
function plain(xml: string): string {
  return xml.replace(/<img\b[^>]*>(?:<\/img>)?/g, '').replace(/<cite\b([^>]*)>[\s\S]*?<\/cite>/g, (_, attrs: string) => attrs.match(/user-name="([^"]+)"/)?.[1] || '').replace(/<\/(?:p|li|tr|blockquote|callout|td|table)>/g, '\n').replace(/<[^>]*>/g, '').replace(/https?:\/\/[^\s<>]+/g, url => publicNoteLink(url)).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n\s*\n/g, '\n').trim();
}
export function documentDays(doc?: ReportDocument): Map<string, Narrative[]> {
  const result = new Map<string, Narrative[]>(); if (!doc) return result;
  let day = '';
  for (const match of doc.content.matchAll(/<(h[123])\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[123]\b|$)/g)) {
    const title = plain(match[2]);
    if (match[1] === 'h1') { const d = title.match(/(\d{1,2})月(\d{1,2})日/); day = d ? `${doc.year}-${d[1].padStart(2, '0')}-${d[2].padStart(2, '0')}` : ''; }
    if (!day) continue;
    if (!result.has(day)) result.set(day, []);
    result.get(day)!.push({ title, level: Number(match[1].slice(1)), text: plain(match[3]), source: ref(doc) });
  }
  return result;
}
export function rectificationNotes(s: SourceTable): NoteSpend[] {
  if (!txt(s.rows[1]?.[5]).includes('笔记')) throw new Error('整改表笔记ID列发生变化');
  const byId = new Map<string, NoteSpend>();
  s.rows.slice(2).forEach((r, i) => {
    const id = txt(r[5]); if (!/^[a-f0-9]{24}$/i.test(id)) return;
    const n = { id, link: publicNoteLink(r[4], id), author: txt(r[2]), publishedDay: calendarDay(r[3]), monthSpend: cell(r[17], ref(s, i + 3, 18)), totalSpend: cell(r[16], ref(s, i + 3, 17)), audit: txt(r[23]), advice: txt(r[24]), correction: txt(r[25]), problem: txt(r[26]), owner: txt(r[27]), source: ref(s, i + 3) };
    if (byId.has(id)) { const prev = byId.get(id)!; prev.problem = [prev.problem, '重复来源行，需核对，未重复累计'].filter(Boolean).join('；'); } else byId.set(id, n);
  });
  return [...byId.values()];
}
function table(s: SourceTable, title: string, columns: string[], rows: unknown[][], scope: string): TableView {
  return { key: s.key, title, columns, rows: rows.map(r => r.map(v => { const t = txt(v); return /^https?:/.test(t) ? publicNoteLink(t) : t || null; })), source: ref(s), scope };
}
function commerceSum(points: DailyPoint[], key: 'star' | 'alliance', totalDaysCount?: number): CommercePoint {
  const result = emptyCommerce();
  const fields = ['investment', 'shopUv', 'readUv', 'purchaseUv', 'newCustomerUv', 'monitoredShopUv'] as const;
  for (const field of fields) {
    result[field] = addCells(points.map(p => p[key][field]));
  }

  const validPoints = points.filter(p => p[key].shopUv.value !== null);
  const coveredDays = validPoints.length;
  const totalDays = totalDaysCount ?? points.length;
  const periodFrom = validPoints[0]?.date || '';
  const periodTo = validPoints[validPoints.length - 1]?.date || '';

  const sumField = (f: keyof CommercePoint) => {
    const vals = validPoints.map(p => (p[key][f] as Cell)?.value).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  result.coverage = {
    coveredDays,
    totalDays,
    periodFrom,
    periodTo,
  };

  result.observedTotals = {
    shopUv: sumField('shopUv'),
    readUv: sumField('readUv'),
    purchaseUv: sumField('purchaseUv'),
    newCustomerUv: sumField('newCustomerUv'),
    investment: sumField('investment'),
    monitoredShopUv: points.map(p => p[key].monitoredShopUv?.value).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0) || null,
  };
  result.observedSummary = { ...result.observedTotals };

  return result;
}
export function buildDailyView(
  projectId: string,
  bundle: SourceBundle,
  day: string,
  options: {
    from?: string;
    to?: string;
    threshold?: number;
    platformObservations?: { sourceKey: string; accountId: string; businessDay: string; capturedAt: string; data: Record<string, unknown> }[];
  } = {}
): DailyView {
  if (!calendarDay(day) || calendarDay(day) !== day) throw new Error('日报日期无效');
  if (bundle.tables.some(s => !s.complete)) throw new Error('不完整来源不能进入业务看板');
  const sourceVersions = bundle.tables.map(s => ref(s)); if (bundle.document) sourceVersions.push(ref(bundle.document));
  const narrativeDays = documentDays(bundle.document);
  let narrativeBusinessDay: string | null = null;
  let isNarrativeHistorical = false;
  let narrative: Narrative[] = [];
  if (narrativeDays.has(day)) {
    narrative = narrativeDays.get(day) || [];
    narrativeBusinessDay = day;
    isNarrativeHistorical = false;
  } else {
    const candidateDays = [...narrativeDays.keys()]
      .filter(d => d.startsWith(day.slice(0, 7)) && d <= day)
      .sort();
    if (candidateDays.length > 0) {
      narrativeBusinessDay = candidateDays.at(-1)!;
      narrative = narrativeDays.get(narrativeBusinessDay) || [];
      isNarrativeHistorical = true;
    }
  }
  const seriesAll = bundle.tables.filter(s => s.role === 'weekly').flatMap(weeklyPoints).sort((a, b) => a.date.localeCompare(b.date));
  const differences: Difference[] = []; const unique = new Map<string, DailyPoint>();
  for (const point of seriesAll) { if (unique.has(point.date)) differences.push({ key: 'duplicate-day-' + point.date, title: '逐日来源日期重叠', details: point.date + ' 保留第一主来源；第二来源进入核对，不相加。', sources: [unique.get(point.date)!.source, point.source] }); else unique.set(point.date, point); }
  const from = options.from || day.slice(0, 7) + '-01', to = options.to || day;
  if (!calendarDay(from) || !calendarDay(to) || from > to) throw new Error('统计区间无效');
  const series = [...unique.values()].filter(p => p.date >= from && p.date <= to);
  const selected = unique.get(day); const monthly = [...unique.values()].filter(p => p.date.startsWith(day.slice(0, 7)) && p.date <= day);
  const businessThrough = [...unique.values()].filter(p => p.date <= day && p.adSpend.value !== null).at(-1)?.date || null;
  const observedMonthly = monthly.filter(p => p.adSpend.value !== null);
  const core = { adSpend: selected?.adSpend || missing(), creatorCost: selected?.creatorCost || missing(), projectInvestment: selected?.projectInvestment || missing(), settlement: selected?.settlement || missing(), monthlySettlement: missing(), monthlyBudget: missing() };
  const tables: TableView[] = [];
  const snapshotRoles = ['platform_snapshot', 'creator_snapshot', 'budget_plan'] as const;
  const activeSnapshotTables = new Map<string, SourceTable>();
  for (const role of snapshotRoles) {
    const candidates = bundle.tables
      .filter(s => s.role === role && s.reportDay && s.reportDay.startsWith(day.slice(0, 7)) && s.reportDay <= day)
      .sort((a, b) => b.reportDay!.localeCompare(a.reportDay!));
    if (candidates.length > 0) {
      activeSnapshotTables.set(role, candidates[0]);
    }
  }
  const nonSnapshotTables = bundle.tables.filter(s => !s.reportDay);
  const relevant = [...nonSnapshotTables, ...activeSnapshotTables.values()];
  if (bundle.document && [...narrativeDays.keys()].some(d => d.startsWith(day.slice(0, 7)))) {
    const prefix = bundle.document.content.split(/<h1\b/)[0];
    const owners = [...prefix.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c => plain(c[1]))).filter(r => r.length === 2 && r[1] && r[1] !== '负责人');
    if (owners.length) tables.push({ key: 'business-owners', title: '板块负责人', columns: ['业务板块', '负责人'], rows: owners, source: ref(bundle.document), scope: '日报全局负责人登记；单条整改负责人以笔记档案登记为准。' });
  }
  for (const s of relevant) {
    if (s.role === 'platform_snapshot') {
      const ttl = s.rows.find(r => summary(r[0]) && /TTL|总/i.test(txt(r[0])));
      if (ttl) { core.monthlySettlement = cell(ttl[4], ref(s, s.rows.indexOf(ttl) + 1, 5)); core.monthlyBudget = cell(ttl[3], ref(s, s.rows.indexOf(ttl) + 1, 4)); }
      const isHist = Boolean(s.reportDay && s.reportDay < day);
      const scopeText = isHist
        ? `日报内嵌月累计快照（引用截至 ${s.reportDay} 快照）；截止日未明确，不与逐日数据相加`
        : '日报内嵌月累计快照；截止日未明确，不与逐日数据相加';
      tables.push(table(s, '星盟月累计 · 电商与聚光分别核对', ['项目', '平台', '代理', '预算/元', '政策后结算金额/元', '消耗进度', '电商CPUV目标', '电商CPUV实际', '完成率', '电商UV目标', '聚光CPUV', '聚光进店UV', '电商后台进店UV'], s.rows.slice(2).filter(r => !summary(r[0])), scopeText));
    }
    if (s.role === 'creator_snapshot') {
      const isHist = Boolean(s.reportDay && s.reportDay < day);
      const scopeText = isHist
        ? `日报月度快照（引用截至 ${s.reportDay} 快照）；分层展示，整体行不重复累计`
        : '日报月度快照；分层展示，整体行不重复累计';
      tables.push(table(s, '达人储备及发布进度', ['层级', '均价/元', '预算/元', '数量占比', '计划', '已选', '已发', '发布进度'], s.rows.slice(1).filter(r => !summary(r[0])), scopeText));
    }
    if (s.role === 'keywords' && (!s.periodFrom || s.periodFrom.slice(0, 7) === day.slice(0, 7))) {
      const rows = s.rows.slice(1).filter(r => txt(r[2]) && !summary(r[2]));
      rows.sort((a, b) => (parseNumericValue(b[4]) ?? -1) - (parseNumericValue(a[4]) ?? -1));
      const header = s.rows[0] || [];
      const cpuvRaw = txt(header[5]) ? txt(header[5]).trim() : '';
      const cpuvNormalized = cpuvRaw.replace(/\s+/g, ' ');
      const cpuvLabel = /cp星盟/i.test(cpuvNormalized) ? 'CP星盟UV' : (/cpuv/i.test(cpuvNormalized) ? 'CPUV' : (cpuvNormalized || 'CPUV'));
      const columns = ['市场出价', '搜索指数（单次观测）', '关键词', '消费占比', '消耗/元', cpuvLabel, 'CTR（源比率）', 'CPC'];
      const scopeText = s.scopeLabel
        ? s.scopeLabel
        : (s.periodFrom && s.periodTo
            ? `${s.periodFrom} 至 ${s.periodTo}；月累计底表，无逐日日期与星盟拆分`
            : (s.periodFrom
                ? `${s.periodFrom} 起；无逐日日期与星盟拆分`
                : '来源快照，统计区间未标明'));
      tables.push(table(s, '关键词消耗排行', columns, rows, scopeText));
    }
    if (s.role === 'keyword_notes' && (!s.periodFrom || s.periodFrom.slice(0, 7) === day.slice(0, 7))) {
      let keyword = ''; const rows: unknown[][] = [];
      for (const r of s.rows.slice(2)) { if (txt(r[0]) && !summary(r[0])) keyword = txt(r[0]); if (!/^[a-f0-9]{24}$/i.test(txt(r[1]))) continue; rows.push([keyword, ...r.slice(1)]); }
      tables.push(table(s, '占位词下高消耗笔记', ['关键词', '笔记ID', '原文入口', '消耗/元', '点击', 'CTR', '回搜率', '回搜量', '回搜成本'], rows.sort((a, b) => (parseNumericValue(b[3]) ?? -1) - (parseNumericValue(a[3]) ?? -1)), `${s.periodFrom || '待核验'} 至 ${s.periodTo || '待核验'}；明细样本，汇总行不与明细混算`));
    }
    if (s.role === 'execution' && (!s.periodFrom || s.periodFrom.slice(0, 7) === day.slice(0, 7))) {
      const header = s.rows[0] || []; const pub = idx(header, '发布日期'), status = idx(header, '执行进度'), name = idx(header, '达人昵称'), id = idx(header, '笔记ID'), tier = idx(header, '博主粉丝数量级');
      const rows = s.rows.slice(1).filter(r => txt(r[name]) && !summary(r[name]));
      const counts = new Map<string, { selected: number; published: number }>();
      for (const r of rows) { const level = txt(r[tier]) || '未分层'; const c = counts.get(level) || { selected: 0, published: 0 }; c.selected++; const date = calendarDay(r[pub]); if (/已发布/.test(txt(r[status])) && date?.startsWith(day.slice(0, 7)) && date <= day) c.published++; counts.set(level, c); }
      tables.push(table(s, '当前执行底表 · 当月产出', ['层级', '当前已选', '截至所选日已发布'], [...counts].map(([k, v]) => [k, v.selected, v.published]), `按发布日期：${day.slice(0, 7)}；历史发布日期不计当月新发`));
      tables.push(table(s, '当月新发笔记档案', ['笔记ID', '达人', '层级', '发布日期', '执行状态'], rows.filter(r => { const d = calendarDay(r[pub]); return Boolean(d?.startsWith(day.slice(0, 7)) && d <= day && /^[a-f0-9]{24}$/i.test(txt(r[id]))); }).map(r => [r[id], r[name], r[tier], calendarDay(r[pub]), r[status]]), '当月新发；不包含仅在本月投放的历史笔记'));
    }
    if (s.role === 'seo_acceptance' && s.periodFrom?.slice(0, 7) === day.slice(0, 7)) {
      const h = s.rows[0] || [], keyword = idx(h, '关键词'), success = idx(h, '首次优化成功日期'), days = idx(h, '实际已达成天数'), links = idx(h, '占位链接'), nextField = idx(h, '是否有新笔记占位'), top3 = idx(h, '是否TOP3');
      if ([keyword,success,days,links,nextField,top3].some(i => i < 0)) throw new Error('SEO验收表结构发生变化');
      const data = s.rows.slice(2).filter(r => txt(r[keyword]) && !summary(r[keyword]));
      tables.push(table(s, 'SEO关键词验收', ['关键词', '首次优化成功日期', '实际达成天数（源登记）', '是否TOP3有占位', '是否新笔记占位', '10月新笔记占位天数（源登记）'], data.map(r => [r[keyword], calendarDay(r[success]), txt(r[days]) || null, txt(r[top3]) || null, txt(r[nextField]) || null, r[nextField + 1]]), `当前源表累计登记快照${s.capturedAt ? '（采集时间：' + s.capturedAt.slice(0, 19).replace('T', ' ') + '）' : ''}；未注明逐日截止。横向逐日观测为空时不推算每日排名或达成天数，不当所选日实绩。`));
      const noteRows: unknown[][] = [];
      for (const r of data) for (const link of r.slice(links, nextField)) {
        const safe = publicNoteLink(link); if (!safe) continue;
        const id = safe.match(/\/(?:explore|discovery\/item)\/([a-f0-9]{24})(?:\/|$)/i)?.[1] || safe.match(/\/user\/profile\/[^/]+\/([a-f0-9]{24})(?:\/|$)/i)?.[1] || null;
        noteRows.push([r[keyword], id, safe]);
      }
      tables.push(table(s, 'SEO关联笔记', ['关键词', '笔记ID', '原文入口'], noteRows, '保留完整笔记ID与源链接；链接校验待执行，本地来源档案独立保存。'));
    }
    if (s.role === 'seo_plan' && s.periodFrom?.slice(0, 7) === day.slice(0, 7)) {
      const acceptedKeywords = new Set(relevant.filter(t => t.role === 'seo_acceptance').flatMap(t => { const k = idx(t.rows[0] || [], '关键词'); return t.rows.slice(2).map(r => txt(r[k])).filter(Boolean); }));
      const data = s.rows.slice(1).filter(r => txt(r[1]) && !summary(r[1]) && (acceptedKeywords.size ? acceptedKeywords.has(txt(r[1])) : /\d+\s*[＜<]|X/.test(txt(r[9]))));
      tables.push(table(s, 'SEO占位词与执行目标', ['关键词', '执行目标', '占位登记', '目标人群', '人群阶段', 'KPI区间', '规划笔记数'], data.map(r => [r[1],r[5],r[6],r[7],r[8],r[9],r[11]]), '10月定词list的执行登记与计划；计划不等于实际观测。'));
    }
  }
  const rect = bundle.tables.find(s => s.role === 'rectification' && (!s.periodFrom || s.periodFrom.slice(0, 7) === day.slice(0, 7)));
  const notes = rect ? rectificationNotes(rect).filter(n => (n.monthSpend.value ?? 0) > 0).sort((a, b) => b.monthSpend.value! - a.monthSpend.value!) : [];
  const docText = (narrative || []).map(n => n.title + '\n' + n.text).join('\n');
  const reported = docText.match(/排查在投笔记\s*(\d+)篇/);
  if (rect && reported) { const actual = rectificationNotes(rect).length; if (actual !== Number(reported[1])) differences.push({ key: 'rectification-count', title: '巡查数量口径差异', details: `日报登记 ${reported[1]} 篇；当前整改底表 ${actual} 个唯一笔记ID。更新日期及范围需业务确认，不覆盖任一来源。`, sources: [ref(rect), ref(bundle.document!)] }); }
  if (rect) { const conflicts = rectificationNotes(rect).filter(n => /不合格/.test(n.audit) && /(?:^|[\s，,;；\n])合格|合格笔记/.test(n.audit)); if (conflicts.length) differences.push({ key: 'audit-conflict', title: '巡查结论冲突', details: `${conflicts.length} 篇同时登记合格与不合格，需人工复核，未计为合格。`, sources: [ref(rect)] }); }
  const weeklyTotal = addCells(observedMonthly.map(p => p.settlement));
  if (weeklyTotal.value !== null && core.monthlySettlement.value !== null && Math.abs(weeklyTotal.value - core.monthlySettlement.value) > 0.01) differences.push({ key: 'settlement-scope', title: '日报累计与当前底表存在差异', details: `日报月累计结算 ${core.monthlySettlement.value.toFixed(2)} 元；逐日已观测结算合计 ${weeklyTotal.value.toFixed(2)} 元（截至 ${businessThrough}）。两者统计截止及版本不同，保持分别展示。`, sources: [core.monthlySettlement.source!, ...bundle.tables.filter(s => s.role === 'weekly').map(s => ref(s))] });
  const creatorSnapshot = tables.find(t => t.title === '达人储备及发布进度'); const execution = tables.find(t => t.title === '当前执行底表 · 当月产出');
  if (creatorSnapshot && execution) { const registered = creatorSnapshot.rows.reduce((n, r) => n + (parseNumericValue(r[6]) || 0), 0); const current = execution.rows.reduce((n, r) => n + (parseNumericValue(r[2]) || 0), 0); if (registered !== current) differences.push({ key: 'publication-scope', title: '发布进度来源差异', details: `日报分层已发 ${registered}；当前执行底表按发布日期截至所选日 ${current}。状态已发布但缺发布日期不计入当月产出，差异保留待确认。`, sources: [creatorSnapshot.source, execution.source] }); }
  const keywordTable = tables.find(t => t.title === '关键词消耗排行'), keywordNotes = tables.find(t => t.title === '占位词下高消耗笔记');
  if (keywordTable && keywordNotes) {
    const occupied = new Set(keywordNotes.rows.map(r => r[0]).filter(Boolean));
    tables.push({ ...keywordTable, key: keywordTable.key + ':core', title: '核心占位词关键词表现', rows: keywordTable.rows.filter(r => occupied.has(r[2])) });
    tables.push({ ...keywordTable, key: keywordTable.key + ':other', title: '其他高消耗关键词', rows: keywordTable.rows.filter(r => !occupied.has(r[2])) });
  }
  if (selected) {
    const through = businessThrough || day;
    const monday = new Date(through + 'T00:00:00Z'); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const allObserved = [...unique.values()].filter(p => p.date <= through && p.adSpend.value !== null);
    const ranges: [string, DailyPoint[]][] = [['所选日', [selected]], ['本周已观测（含跨月）', allObserved.filter(p => p.date >= monday.toISOString().slice(0, 10))], ['本月已观测', observedMonthly]];
    tables.push({ key: 'fees-reconciliation', title: '日 / 周 / 月费用对账', columns: ['范围', '实际观测日数', '平台广告消耗/元', '达人合作费用/元', '项目总投入/元', '政策后结算金额/元', 'F信息流/元', 'S搜索/元', 'SEO/元', '评论/元'], rows: ranges.map(([label, points]) => [label, points.filter(p => p.adSpend.value !== null).length, ...(['adSpend','creatorCost','projectInvestment','settlement','feed','search','seo','comments'] as const).map(k => addCells(points.map(p => p[k])).value)]), source: selected.source, scope: `日值为所选日期，周/月为已观测日期小计，截至 ${through}；不补齐未采集日。费用含税及政策口径按源列分别标注。` });
  }
  const plan = relevant.find(s => s.role === 'budget_plan');
  if (plan) {
    for (const point of series) {
      const i = plan.rows.findIndex(r => calendarDay(r[0]) === point.date);
      if (i >= 0) point.plan = cell(plan.rows[i][1], ref(plan, i + 1, 2));
    }
  }
  if (plan) {
    const isHist = Boolean(plan.reportDay && plan.reportDay < day);
    const scopeText = isHist
      ? `平台FS排期（引用截至 ${plan.reportDay} 快照版本）；包含未来计划，不等于KFSOPZ总目标`
      : '平台FS排期；包含未来计划，不等于KFSOPZ总目标';
    tables.push(table(plan, '预算版本 · 每日FS排期', ['日期', 'FS合计', 'F红星', 'F红盟', '信息流', 'S红星', 'S红盟', '搜索'], plan.rows.slice(1).filter(r => calendarDay(r[0])).map(r => [calendarDay(r[0]), ...r.slice(1)]), scopeText));
  }
  const planRows = plan?.rows.filter(r => calendarDay(r[0])?.startsWith(day.slice(0, 7))) || [];
  const allPlan = addCells(planRows.map(r => cell(r[1]))), donePlan = addCells(planRows.filter(r => calendarDay(r[0])! <= day).map(r => cell(r[1])));
  const totalDays = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();
  const settlementFraction = ratio(core.monthlySettlement, core.monthlyBudget).value;
  const scheduleFraction = ratio(donePlan, allPlan).value;
  const timeFraction = Number(day.slice(8)) / totalDays;
  // Compare FS with FS only. Overall settlement and FS-only schedules cannot form a lag alert.
  const adProgress = allPlan.value && addCells(observedMonthly.map(p => p.adSpend)).value !== null ? addCells(observedMonthly.map(p => p.adSpend)).value! / allPlan.value : null;
  const completeMonth = monthly.length === Number(day.slice(8)) && monthly.every(p => p.adSpend.value !== null);
  const lagPoints = completeMonth && scheduleFraction !== null && adProgress !== null ? (scheduleFraction - adProgress) * 100 : null;
  const planThroughData = plan ? addCells(planRows.filter(r => businessThrough && calendarDay(r[0])! <= businessThrough).map(r => cell(r[1]))).value : null;
  const dataComplete = businessThrough?.startsWith(day.slice(0, 7)) && observedMonthly.length === Number(businessThrough.slice(8));
  const actualThroughData = dataComplete ? addCells(observedMonthly.map(p => p.adSpend)).value : null;
  const gapThroughData = actualThroughData !== null && planThroughData !== null ? actualThroughData - planThroughData : null;
  const latestReportDay = [...narrativeDays.keys()].sort().at(-1) || null;
  const latestCompleteDay = [...unique.values()].filter(p => p.adSpend.value !== null).at(-1)?.date || null;
  const latestRegisteredDay = [...unique.values()].filter(p => p.adSpend.value !== null || p.creatorCost.value !== null || p.seo.value !== null).at(-1)?.date || null;
  const financeThrough = businessThrough;
  const defaultDay = latestReportDay || latestCompleteDay || day;
  const hasCurrentNarrative = narrative.length > 0 && !isNarrativeHistorical;
  const hasSpend = selected?.adSpend?.value !== null && selected?.adSpend?.state === 'observed';
  let dayStatus: 'complete' | 'partial' | 'pending' | 'empty' = 'empty';
  if (hasSpend && hasCurrentNarrative) {
    dayStatus = 'complete';
  } else if (hasCurrentNarrative || hasSpend) {
    dayStatus = 'partial';
  } else if (selected?.adSpend?.state === 'not_collected') {
    dayStatus = 'pending';
  } else {
    dayStatus = 'empty';
  }

  // Platform Native Reconciliation (Independent source)
  let platformNative: PlatformNativeObservation | undefined = undefined;
  const platObs = options.platformObservations || [];
  const dayPlatObs = platObs.filter(o => o.businessDay === day && (o.sourceKey === 'juguang-f' || o.sourceKey === 'juguang-s' || o.sourceKey.startsWith('juguang')));
  if (dayPlatObs.length > 0) {
    let feedTotal = 0, searchTotal = 0, grandTotal = 0;
    const tableRows: (string | number | null)[][] = [];
    const seenPlacements = new Set<string>();
    for (const o of dayPlatObs) {
      const d = o.data;
      const fee = Number(d.fee || d['消费'] || 0);
      const imps = Number(d.impression || d['展现量'] || 0);
      const clicks = Number(d.click || d['点击量'] || 0);
      const placement = String(d.placementName || d['投放位置'] || (o.sourceKey.includes('f') ? '信息流' : '搜索'));
      const placementKey = `${o.sourceKey}:${o.accountId}:${placement}`;
      if (seenPlacements.has(placementKey)) continue;
      seenPlacements.add(placementKey);

      const accountLabel = o.sourceKey === 'juguang-f' ? `聚光信息流 (${o.accountId})` : o.sourceKey === 'juguang-s' ? `聚光搜索 (${o.accountId})` : `${o.sourceKey} (${o.accountId})`;
      if (o.sourceKey === 'juguang-f') feedTotal += fee;
      else if (o.sourceKey === 'juguang-s') searchTotal += fee;
      grandTotal += fee;
      tableRows.push([day, accountLabel, placement, Math.round(fee * 100) / 100, imps, clicks, selected?.adSpend?.value === null ? '周底表未回填' : '周底表已有值']);
    }
    if (grandTotal > 0) {
      grandTotal = Math.round(grandTotal * 100) / 100;
      feedTotal = Math.round(feedTotal * 100) / 100;
      searchTotal = Math.round(searchTotal * 100) / 100;

      const weeklyAdSpend = selected?.adSpend?.value ?? null;
      let status: 'missing_weekly' | 'difference' | 'matched' = 'missing_weekly';
      let statusLabel = '待回填';
      let delta: number | null = null;
      let totalRowStatus = '独立平台观测 · 周底表待回填';
      let note = `周底表当日投流广告尚未回填；平台原生投放 ¥${grandTotal.toFixed(2)} 保持独立对账，不计入周表成本口径。`;

      if (weeklyAdSpend === null) {
        status = 'missing_weekly';
        statusLabel = '待回填';
        totalRowStatus = '独立平台观测 · 周底表待回填';
        note = `周底表当日投流广告尚未回填；平台原生投放 ¥${grandTotal.toFixed(2)} 保持独立对账，不计入周表成本口径。`;
        if (selected) {
          differences.push({
            key: `platform-unreconciled-${day}`,
            title: `平台原生投放与周底表比对（${day} · 周底表待回填）`,
            details: `聚光平台 ${day} 原始投放：信息流 ¥${feedTotal.toFixed(2)} + 搜索 ¥${searchTotal.toFixed(2)}，合计 ¥${grandTotal.toFixed(2)} 已存入平台观测；周底表当日广告投流列尚未回填（公式为0），保持独立来源对账，不擅自拼入周表成本总口径。`,
            sources: [selected.source]
          });
        }
      } else {
        delta = Math.round((grandTotal - weeklyAdSpend) * 100) / 100;
        if (Math.abs(delta) > 0.01) {
          status = 'difference';
          statusLabel = `金额有差异（差额 ¥${delta.toFixed(2)}）`;
          totalRowStatus = `差异 ¥${delta.toFixed(2)} · 口径待核对`;
          note = `平台原生投放 ¥${grandTotal.toFixed(2)} vs 周底表广告消耗 ¥${weeklyAdSpend.toFixed(2)}，差额 ¥${delta.toFixed(2)}（口径或返点政策待核对），保持独立来源不自动抵扣。`;
          if (selected) {
            differences.push({
              key: `platform-diff-${day}`,
              title: `平台原生投放与周底表金额差异（${day}）`,
              details: `聚光平台 ${day} 原始投放合计 ¥${grandTotal.toFixed(2)}（信息流 ¥${feedTotal.toFixed(2)} + 搜索 ¥${searchTotal.toFixed(2)}），周底表当日广告消耗登记为 ¥${weeklyAdSpend.toFixed(2)}，差额 ¥${delta.toFixed(2)}。两者来源口径保持独立展示与核对，不擅自拼接或自动抵扣。`,
              sources: [selected.source]
            });
          }
        } else {
          status = 'matched';
          statusLabel = '金额一致';
          totalRowStatus = '金额一致 · 独立来源';
          note = `平台原生投放与周底表广告消耗金额一致（¥${grandTotal.toFixed(2)}）。`;
        }
      }

      tableRows.push([
        `${day} 聚光小计`,
        '聚光合计',
        '信息流 + 搜索',
        grandTotal,
        tableRows.reduce((a, b) => a + (Number(b[4]) || 0), 0),
        tableRows.reduce((a, b) => a + (Number(b[5]) || 0), 0),
        totalRowStatus
      ]);

      platformNative = {
        day,
        totalFee: grandTotal,
        feedFee: feedTotal,
        searchFee: searchTotal,
        weeklyAdSpend,
        delta,
        status,
        statusLabel,
        note
      };

      tables.push({
        key: 'platform-native-reconciliation',
        title: '平台原生投放分日核对 · 聚光',
        columns: ['业务日期', '平台/账号', '投放位置', '消耗/元', '展现量', '点击量', '对账状态'],
        rows: tableRows,
        source: {
          sourceKey: 'juguang-f/juguang-s',
          url: 'https://ad.xiaohongshu.com',
          version: 'platform_obs',
          capturedAt: dayPlatObs[0]?.capturedAt || ''
        },
        scope: `聚光原生投放数据独立采集对账；${day} 原生投放合计 ¥${grandTotal.toFixed(2)}，周底表广告消耗 ¥${weeklyAdSpend !== null ? weeklyAdSpend.toFixed(2) : '未回填'}，状态：${statusLabel}。保持独立来源展示，不擅自拼入周表成本总口径。`
      });
    }
  }

  return {
    projectId,
    day,
    selectedDay: day,
    defaultDay,
    dayStatus,
    latestReportDay,
    latestCompleteDay,
    latestRegisteredDay,
    financeThrough,
    platformNative,
    narrativeBusinessDay,
    isNarrativeHistorical,
    dates: [...new Set([...narrativeDays.keys(), ...unique.keys()])].sort(),
    mode: 'latest',
    schemaVersion: DAILY_SCHEMA_VERSION,
    capturedAt: sourceVersions.map(s => s.capturedAt).sort().at(-1) || null,
    businessThrough,
    from,
    to,
    series,
    narrative,
    tables,
    notes,
    core,
    progress: { timeFraction, scheduleFraction, settlementFraction, lagPoints, alertThresholdPoints: options.threshold ?? 5, planThroughData, actualThroughData, gapThroughData },
    funnel: {
      star: commerceSum(series, 'star', Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1),
      alliance: commerceSum(series, 'alliance', Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1),
      scope: `${from} 至 ${to}`,
      aggregation: '每日来源UV的加和，非跨日去重；聚光与电商后台归因不同，分别展示'
    },
    differences,
    sourceVersions
  };
}
