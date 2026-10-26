import { parseNumericValue } from '../numeric-values';
import type { BusinessHighlights, CostComparison, DailyView, Narrative, RankValue, SectionStatus } from './types';
const value=(text:unknown)=>parseNumericValue(text);
const sum=(values:(number|null)[])=>values.length && values.every(n=>n!==null) ? values.reduce<number>((total,n)=>total+n!,0):null;
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function quantity(text?:string){if(!text)return null;const match=text.match(/^([\d.]+)\s*([w万]?)$/i);return match ? Number(match[1])*(match[2] ? 10000:1):null;}
function costData(section:Narrative|undefined,month:string) {
  const lines=(section?.text || '').split('\n');
  const own=lines.find(line=>new RegExp('^'+month+'\\s*月').test(line) && !/benchmark/i.test(line));
  const benchmark=lines.find(line=>new RegExp('^'+month+'\\s*月').test(line) && /benchmark/i.test(line));
  const costs:CostComparison[]=[['小红星','星'],['小红盟','盟']].map(([channel,alias])=>{const actual=own?.match(new RegExp(alias+'cpuv[：:]\\s*([\\d.]+)','i')),range=benchmark?.match(new RegExp(alias+'cpuv[：:]\\s*([\\d.]+)\\s*[~～-]\\s*([\\d.]+)','i'));return {channel,actual:actual ? Number(actual[1]):null,low:range ? Number(range[1]):null,high:range ? Number(range[2]):null};});
  const rate=own?.match(/回搜率[：:]\s*([\d.]+)%/);
  const actionBlock=(section?.text || '').split(/(?:^|\n)\s*今日动作[：:]/).pop() || ''; const actions=actionBlock.split(/\n|【持续放大】|【降低\/暂停】/).map(s=>s.trim()).filter(s=>s && !/benchmark/i.test(s) && !/^\s*(星|盟)?\s*cpuv[：:]\s*[\d.]+/i.test(s) && !/^\s*回搜率[：:]\s*[\d.]+/i.test(s)).slice(0,3);
  return {costs,returnRate:rate ? Number(rate[1])/100:null,actions,scope:`${month}月作者日报登记 · 分渠道CPUV；行业基准同月，统计截止以源登记为准`};
}
function channelGroups(section:Narrative|undefined) {
  let channel='';const star:RankValue[]=[],alliance:RankValue[]=[];
  for(const line of (section?.text || '').split('\n')){
    if(/^红星[：:]/.test(line.trim()))channel='star';else if(/^红盟[：:]/.test(line.trim()))channel='alliance';
    else if(/人群渗透|今日动作/.test(line))channel='';
    const match=line.match(/【([^】]+)】\s*cpuv[：:]\s*([\d.]+)/i);
    if(match && channel)(channel==='star' ? star:alliance).push({label:match[1],value:Number(match[2])});
  }
  return {starGroups:star.sort((a,b)=>a.value!-b.value!),allianceGroups:alliance.sort((a,b)=>a.value!-b.value!)};
}
export function buildBusinessHighlights(view:DailyView):BusinessHighlights {
  const section=(key:string)=>view.narrative.find(n=>n.title.includes(key)),table=(key:string)=>view.tables.find(t=>t.title===key),month=String(Number(view.day.slice(5,7)));
  const search=section('搜索侧'),feed=section('信息流侧'),core=table('核心占位词关键词表现'),top=table('其他高消耗关键词');
  const coreWords=(core?.rows || []).map(r=>{const word=String(r[2] || ''),registered=search?.text.match(new RegExp('【'+escape(word)+'】\\s*soc\\s*([\\d.]+)%[，,、\\s]*soc(\\d+)\\s*费用占比\\s*([\\d.]+)%','i'));return {word,spend:value(r[4]),share:value(r[3]),cpuv:value(r[5]),ctr:value(r[6]),index:value(r[1]),soc:registered ? Number(registered[1])/100:null,rank:registered ? Number(registered[2]):null,reportShare:registered ? Number(registered[3])/100:null};});
  const audience:BusinessHighlights['feed']['audience']=[];
  const feedLines=(feed?.text || '').split('\n');
  feedLines.forEach((line,i)=>{const match=line.match(/^竞品-(.*?)人群渗透率截止(\d+\.\d+)-([\d.]+)%（(\d+\.\d+)-([\d.]+)%/);if(!match)return;const logic=feedLines[i+1] || '',size=logic.match(/人群体量[：:]\s*([^）)]+)/)?.[1] || '未登记';audience.push({name:match[1],observedOn:match[2],value:Number(match[3])/100,previousOn:match[4],previous:Number(match[5])/100,size,logic});});
  const creator=table('达人储备及发布进度'),execution=table('当前执行底表 · 当月产出'),levels=(creator?.rows || []).map(r=>({label:String(r[0]),plan:value(r[4]),selected:value(r[5]),published:value(r[6])}));
  const maintenance=section('月执行'),planned=maintenance?.text.match(/规划[：:]\s*维护([\d.]+[w万]?)篇笔记[，,；;]\s*发布([\d.]+[w万]?)条评论/),registered=maintenance?.text.match(/进度[：:]\s*维护([\d.]+[w万]?)篇笔记[，,；;]\s*发布([\d.]+[w万]?)条评论/),forms=maintenance?.text.match(/商业维评\s+(\d+)\s+(\d+)\s+(\d+)/);
  const minds:BusinessHighlights['maintenance']['minds']=[];const mindText=section('商业笔记');for(const match of (mindText?.text || '').matchAll(/([^\n]+)\n(\d+)条\n(\d+)篇/g))minds.push({label:match[1],comments:Number(match[2]),notes:Number(match[3])});
  const counts={passed:0,problem:0,conflict:0,unknown:0};for(const note of view.notes){const failed=note.audit.includes('不合格'),passed=note.audit.replace(/不合格/g,'').includes('合格');counts[failed && passed ? 'conflict':failed ? 'problem':passed ? 'passed':'unknown']++;}
  const todo=section('核心todo'),rect=todo?.text.match(/排查在投笔记(\d+)篇.*?停投整改[）)](\d+)篇.*?已整改重投(\d+)篇.*?剩余整改(\d+)篇/),deadline=todo?.text.match(/预计([^\n，,]*?前)[^\n]*整改完成/)?.[1] || '未明确';
  const seo=section('SEO'),indexed=seo?.text.match(/被收录笔记[：:]\s*(\d+)\s*\/\s*(\d+)/),occupied=seo?.text.match(/关键词已占位数量\s*(\d+)\s*\/\s*(\d+)/),acceptance=table('SEO关键词验收'),buckets:BusinessHighlights['seo']['buckets']=[];
  for(const match of (seo?.text || '').matchAll(/([^\n]*聚光搜索量[^\n]*)[：:]\s*(\d+)\s*\/\s*(\d+)/g))buckets.push({label:match[1].replace(/\s+/g,' '),actual:Number(match[2]),target:Number(match[3])});
  const keywords=(acceptance?.rows || []).map(r=>{const days=String(r[2] || ''),m=days.match(/^(\d+)\s*\/\s*(\d+)/);return {word:String(r[0]),achieved:m ? Number(m[1]):null,target:m ? Number(m[2]):null,registeredText:days || '未登记',top3:r[3]===null || r[3]===undefined ? null:String(r[3])};});
  const owners=table('板块负责人'),owner=(part:string)=>String(owners?.rows.find(r=>String(r[0]).includes(part))?.[1] || '负责人待确认');
  const today:BusinessHighlights['today']=[];
  if(view.businessThrough!==view.day)today.push({title:'投放实际数据待补齐',detail:`所选日${view.day}尚无完整实际消耗，最近观测截至${view.businessThrough || '未知'}。`,owner:owner('投流'),deadline:'本日报确认前',tone:'warning'});
  for(const cost of costData(search,month).costs)if(cost.actual!==null && cost.high!==null && cost.actual>cost.high)today.push({title:`搜索${cost.channel}成本高于基准`,detail:`月CPUV ${cost.actual}元，高于同月行业基准上沿${cost.high}元；核对低效组合与预算分配。`,owner:owner('投流'),deadline:'待负责人确认',tone:'warning',source:search?.source});
  if(rect)today.push({title:`${rect[4]}篇整改待完成`,detail:`日报登记${rect[2]}篇停投整改、${rect[3]}篇已整改重投；逐笔状态以整改底表核对。`,owner:owner('SEO和评论'),deadline,source:todo?.source,tone:'warning'});

  const searchCost = costData(search, month);
  const searchHasData = searchCost.costs.some(c => c.actual !== null);
  const searchStatus: SectionStatus = !searchHasData ? 'missing' : (view.isNarrativeHistorical ? 'historical_reference' : 'current');
  const searchReason = !searchHasData
    ? '所选日及之前未登记搜索成本或行业基准'
    : (view.isNarrativeHistorical ? `所选日无专属日报，展示截至 ${view.narrativeBusinessDay} 最近月累计快照` : undefined);

  const feedCost = costData(feed, month);
  const feedGroups = channelGroups(feed);
  const feedHasData = feedCost.costs.some(c => c.actual !== null) || feedGroups.starGroups.length > 0;
  const feedStatus: SectionStatus = !feedHasData ? 'missing' : (view.isNarrativeHistorical ? 'historical_reference' : 'current');
  const feedReason = !feedHasData
    ? '所选日及之前未登记信息流成本或人群包'
    : (view.isNarrativeHistorical ? `所选日无专属日报，展示截至 ${view.narrativeBusinessDay} 最近月累计快照` : undefined);

  const creatorSnapshotDay = creator?.source?.sourceKey?.match(/\d{4}-\d{2}-\d{2}$/)?.[0] || null;
  const isCreatorHist = Boolean(creatorSnapshotDay && creatorSnapshotDay < view.day);
  const creatorStatus: SectionStatus = !creator || !levels.length ? 'missing' : (isCreatorHist ? 'historical_reference' : 'current');
  const creatorReason = !creator || !levels.length
    ? '该月截至所选日无达人储备快照'
    : (isCreatorHist ? `展示截至 ${creatorSnapshotDay} 最近月度快照` : undefined);

  const maintStatus: SectionStatus = !maintenance ? 'missing' : (view.isNarrativeHistorical ? 'historical_reference' : 'current');
  const maintReason = !maintenance
    ? '所选日及之前无月执行与商业笔记登记'
    : (view.isNarrativeHistorical ? `展示截至 ${view.narrativeBusinessDay} 最近月执行登记` : undefined);

  const rectStatus: SectionStatus = view.notes.length ? 'current' : 'missing';
  const rectReason = !view.notes.length ? '当前整改底表无相关记录' : undefined;

  const seoStatus: SectionStatus = !indexed && !occupied ? 'missing' : (view.isNarrativeHistorical ? 'historical_reference' : 'current');
  const seoReason = !indexed && !occupied
    ? '所选日及之前无SEO收录与占位登记'
    : (view.isNarrativeHistorical ? `展示截至 ${view.narrativeBusinessDay} 最近SEO登记` : undefined);

  const keywordMain = view.tables.find(t => t.title === '关键词消耗排行');
  const tableScope = keywordMain?.scope || core?.scope || '来源快照，统计区间未标明';
  const tableCpuvLabel = keywordMain?.columns?.[5] || 'CPUV';

  return {
    search: {
      ...searchCost,
      source: search?.source,
      tableSource: core?.source || keywordMain?.source,
      tableScope,
      tableCpuvLabel,
      coreWords,
      topKeywords: (top?.rows || []).slice(0, 10).map(r => ({ label: String(r[2]), value: value(r[4]) })),
      sourceBusinessDay: view.narrativeBusinessDay || view.day,
      capturedAt: search?.source?.capturedAt || view.capturedAt || null,
      isHistoricalSnapshot: Boolean(view.isNarrativeHistorical),
      status: searchStatus,
      reason: searchReason
    },
    feed: {
      ...feedCost,
      ...feedGroups,
      source: feed?.source,
      audience,
      sourceBusinessDay: view.narrativeBusinessDay || view.day,
      capturedAt: feed?.source?.capturedAt || view.capturedAt || null,
      isHistoricalSnapshot: Boolean(view.isNarrativeHistorical),
      status: feedStatus,
      reason: feedReason
    },
    creators: {
      source: creator?.source,
      levels,
      plan: sum(levels.map(r => r.plan)),
      selected: sum(levels.map(r => r.selected)),
      published: sum(levels.map(r => r.published)),
      currentPublished: sum((execution?.rows || []).map(r => value(r[2]))),
      currentSource: execution?.source,
      snapshotBusinessDay: creatorSnapshotDay,
      snapshotCapturedAt: creator?.source?.capturedAt || null,
      isHistoricalSnapshot: isCreatorHist,
      status: creatorStatus,
      reason: creatorReason
    },
    maintenance: {
      source: maintenance?.source,
      notesPlan: quantity(planned?.[1]),
      commentsPlan: quantity(planned?.[2]),
      notesRegistered: quantity(registered?.[1]),
      commentsRegistered: quantity(registered?.[2]),
      pure: forms ? Number(forms[2]) : null,
      live: forms ? Number(forms[3]) : null,
      minds,
      sourceBusinessDay: view.narrativeBusinessDay || view.day,
      capturedAt: maintenance?.source?.capturedAt || view.capturedAt || null,
      isHistoricalSnapshot: Boolean(view.isNarrativeHistorical),
      status: maintStatus,
      reason: maintReason
    },
    rectification: {
      source: view.notes[0]?.source,
      total: view.notes.length,
      statuses: [
        { label: '登记合格', value: counts.passed },
        { label: '登记问题', value: counts.problem },
        { label: '结论冲突', value: counts.conflict },
        { label: '未明确', value: counts.unknown }
      ],
      ...(rect && todo ? { report: { source: todo.source, inspected: Number(rect[1]), problematic: Number(rect[2]), fixed: Number(rect[3]), remaining: Number(rect[4]), deadline } } : {}),
      sourceBusinessDay: view.narrativeBusinessDay || view.day,
      capturedAt: view.notes[0]?.source?.capturedAt || view.capturedAt || null,
      isHistoricalSnapshot: Boolean(view.isNarrativeHistorical),
      status: rectStatus,
      reason: rectReason
    },
    seo: {
      source: seo?.source,
      acceptanceSource: acceptance?.source,
      indexed: indexed ? Number(indexed[1]) : null,
      submitted: indexed ? Number(indexed[2]) : null,
      occupied: occupied ? Number(occupied[1]) : null,
      target: occupied ? Number(occupied[2]) : null,
      buckets,
      keywords,
      sourceBusinessDay: view.narrativeBusinessDay || view.day,
      snapshotCapturedAt: acceptance?.source?.capturedAt || view.capturedAt || null,
      isHistoricalSnapshot: Boolean(view.isNarrativeHistorical),
      status: seoStatus,
      reason: seoReason
    },
    today
  };
}
