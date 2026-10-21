import type {
  IndustryV2AnalysisInput,
  IndustryV2Report,
  IndustryV2Config,
  IndustryV2Note,
  IndustryV2Metric,
  IndustryV2Distribution,
} from './industry-v2-types';

export type ProjectCategory = 'egg' | 'shoes' | 'fridge' | 'wipes' | 'general';

export interface CategoryRule {
  label: string;
  keywords: string[];
}

export interface ProjectDictionary {
  scenes: CategoryRule[];
  sellingPoints: CategoryRule[];
}

export const PROJECT_DICTIONARIES: Record<ProjectCategory, ProjectDictionary> = {
  egg: {
    scenes: [
      { label: '食谱', keywords: ['食谱', '做法', '料理', '做饭', '烹饪', '煎蛋', '水波蛋', '蛋羹', '烘焙', '溏心蛋', '温泉蛋', '炒蛋', '蒸蛋', '荷包蛋'] },
      { label: '早餐', keywords: ['早餐', '早点', '晨起', '早餐食谱', '早饭', '营养早餐', '元气早餐', '吐司'] },
      { label: '健身', keywords: ['健身', '减脂', '增肌', '高蛋白', '刷脂', '控卡', '低脂', '蛋白质', '运动', '低卡'] },
    ],
    sellingPoints: [
      { label: '安全与营养', keywords: ['安全', '营养', '无菌', '可生食', '生食标准', '无腥味', '无抗生素', '新鲜', '富硒', 'dha', '卵磷脂', '品质', '沙门氏菌', '无菌蛋'] },
    ],
  },
  shoes: {
    scenes: [
      { label: '越野', keywords: ['越野', '跑山', '山地', '户外', '泥地', '碎石', '徒步', '爬山', '山野', '野径'] },
      { label: '赛事', keywords: ['赛事', '比赛', '马拉松', '越野赛', '百公里', '参赛', '崇礼', '柴古', '港百', '站台', '完赛'] },
      { label: '训练', keywords: ['训练', '跑量', '拉练', 'lsd', '间歇跑', '备赛', '日常跑', '晨跑', '夜跑', '配速'] },
      { label: '穿搭', keywords: ['穿搭', '搭配', '山系', '机能', '城市户外', 'ootd', '街头', '复古', '造型', '潮流'] },
    ],
    sellingPoints: [
      { label: '测评', keywords: ['测评', '实测', '开箱', '上脚', '体验', '横评', '红黑榜', '优缺点', '评测', '脚感'] },
    ],
  },
  fridge: {
    scenes: [
      { label: '装修', keywords: ['装修', '家装', '新房', '橱柜', '定制', '小户型', '极简', '中古', '法式', '平层', '改造', '厨房设计'] },
    ],
    sellingPoints: [
      { label: '保鲜', keywords: ['保鲜', '冻鲜', '水润', '恒温', '净味', '除菌', '抑菌', '不风干', '肉类冷冻', '果蔬'] },
      { label: '嵌入', keywords: ['嵌入', '零嵌', '平嵌', '超薄', '齐平', '缝隙', '散热', '底部散热', '微缝'] },
      { label: '容量', keywords: ['容量', '大容量', '空间', '500l', '分区', '多门', '十字', '法式四门', '储鲜', '囤货'] },
      { label: '能耗', keywords: ['能耗', '能效', '一级能效', '省电', '节能', '静音', '变频', '低噪', '耗电'] },
    ],
  },
  wipes: {
    scenes: [
      { label: '出行', keywords: ['出行', '随身', '旅行', '包包', '飞机', '高铁', '外出', '随手', '出差', '通勤'] },
      { label: '家庭', keywords: ['家庭', '居家', '日常', '厨房', '桌面', '玩具', '卫生间', '门把手', '家具'] },
      { label: '办公', keywords: ['办公', '工位', '电脑', '键盘', '鼠标', '办公室', '手机屏幕', '办公桌'] },
    ],
    sellingPoints: [
      { label: '材质', keywords: ['材质', '纯棉', '棉柔', '加厚', '不掉絮', '韧性', '环保', '亲肤', '植物纤维', '无纺布'] },
      { label: '消毒', keywords: ['消毒', '杀菌', '75度', '75%', '酒精', '抑菌', '灭菌', '卫生', '消杀'] },
      { label: '便携', keywords: ['便携', '单片装', '小包', '随身装', '便携装', '独立包装', '轻巧', '方便携带'] },
    ],
  },
  general: {
    scenes: [
      { label: '日常使用', keywords: ['日常', '使用', '生活', '体验', '分享'] },
      { label: '工作学习', keywords: ['工作', '学习', '办公', '效率'] },
    ],
    sellingPoints: [
      { label: '品质功能', keywords: ['品质', '功能', '效果', '性能', '实用'] },
      { label: '性价比', keywords: ['性价比', '划算', '实惠', '价格', '便宜'] },
    ],
  },
};

export const TITLE_PATTERNS = [
  {
    label: '攻略教程 (规则匹配)',
    keywords: ['教程', '攻略', '指南', '保姆级', '手把手', '抄作业', '怎么选', '选购', '闭眼入', '避坑', '干货', '必看'],
  },
  {
    label: '清单推荐 (规则匹配)',
    keywords: ['清单', '合集', '推荐', '汇总', '盘点', 'top', '红黑榜', '精选', '大盘点', '分享'],
  },
  {
    label: '测评实录 (规则匹配)',
    keywords: ['实测', '测评', '开箱', '上脚', '实拍', '体验', '拆箱', '横评', '真实反馈'],
  },
  {
    label: '痛点问答 (规则匹配)',
    keywords: ['怎么办', '为什么', '吗', '？', '?', '踩雷', '焦虑', '后悔', '真相', '翻车'],
  },
  {
    label: '日常场景 (规则匹配)',
    keywords: ['沉浸式', '日常', '独居', '治愈', '打卡', '改造', '生活', '碎碎念', '记录'],
  },
];

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) {
    return [from];
  }
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function getWeekday(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return WEEKDAY_NAMES[d.getUTCDay()];
}

export function noteShanghaiDate(note: Pick<IndustryV2Note, 'publishedDate' | 'publishedAt'>): string | null {
  if (note.publishedDate && /^\d{4}-\d{2}-\d{2}$/.test(note.publishedDate)) {
    return note.publishedDate;
  }
  if (note.publishedAt) {
    const ms = Date.parse(note.publishedAt);
    if (Number.isFinite(ms)) {
      return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
    }
  }
  return null;
}

export function detectProjectCategory(config: IndustryV2Config): ProjectCategory {
  const pId = (config.projectId || '').trim().toLowerCase();
  if (pId === 'huang-tiane') return 'egg';
  if (pId === 'kailas') return 'shoes';
  if (pId === 'meiling') return 'fridge';
  if (pId === 'winner-wipes') return 'wipes';

  const spu = (config.spu || '').toLowerCase();
  const brand = (config.brand || '').toLowerCase();
  const kw = (config.categoryKeyword || '').toLowerCase();
  const text = `${pId} ${spu} ${brand} ${kw}`;

  if (['鸡蛋', '可生食鸡蛋', '黄天鹅'].some(k => text.includes(k))) {
    return 'egg';
  }
  if (['跑鞋', '越野跑鞋', '凯乐石', '越野鞋', '跑山鞋'].some(k => text.includes(k))) {
    return 'shoes';
  }
  if (['冰箱', '冷柜', '美菱'].some(k => text.includes(k))) {
    return 'fridge';
  }
  if (['酒精湿巾', '消毒湿巾', '稳健医疗', '湿巾'].some(k => text.includes(k))) {
    return 'wipes';
  }
  return 'general';
}

export function getFansTier(fans: number | null | undefined): string {
  if (fans === null || fans === undefined || !Number.isFinite(fans)) {
    return '未知粉丝数';
  }
  if (fans > 1000000) return '超头部(>100万)';
  if (fans >= 500000) return '头部(50万-100万)';
  if (fans >= 200000) return '腰部(20万-50万)';
  if (fans >= 30000) return '精选(3万-20万)';
  if (fans >= 5000) return 'KOC(5000-3万)';
  return '素人(<5000)';
}

export function deduplicateNotes(notes: IndustryV2Note[]): IndustryV2Note[] {
  const map = new Map<string, IndustryV2Note>();
  for (const n of notes) {
    const id = n.noteId;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...n, queryIds: Array.from(new Set(n.queryIds || [])) });
    } else {
      const mergedQueryIds = Array.from(new Set([...(existing.queryIds || []), ...(n.queryIds || [])]));
      const isNewer = (n.capturedAt || '') > (existing.capturedAt || '');
      const chosen = isNewer ? n : existing;
      map.set(id, {
        ...chosen,
        queryIds: mergedQueryIds,
      });
    }
  }
  return Array.from(map.values());
}

function buildSumMetric(values: Array<number | null>, totalCount: number): IndustryV2Metric {
  const knownValues = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const known = knownValues.length;
  const value = known > 0 ? knownValues.reduce((sum, curr) => sum + curr, 0) : null;
  return { value, known, total: totalCount };
}

function buildRateMetric(boolValues: Array<boolean | null>, totalCount: number): IndustryV2Metric {
  const knownBools = boolValues.filter((v): v is boolean => typeof v === 'boolean');
  const known = knownBools.length;
  if (known === 0) {
    return { value: null, known: 0, total: totalCount };
  }
  const trueCount = knownBools.filter(Boolean).length;
  const value = Math.round((trueCount / known) * 10000) / 10000;
  return { value, known, total: totalCount };
}

function buildDistribution(
  buckets: Array<{ label: string; notes: IndustryV2Note[] }>
): IndustryV2Distribution[] {
  return buckets.map(b => {
    const count = b.notes.length;
    const knownNotes = b.notes.filter(n => n.interactions !== null && Number.isFinite(n.interactions));
    const interactionsSum = knownNotes.length > 0
      ? knownNotes.reduce((acc, curr) => acc + (curr.interactions || 0), 0)
      : null;
    const meanInteractions = knownNotes.length > 0 && count > 0
      ? Math.round((interactionsSum! / knownNotes.length) * 10) / 10
      : null;
    return {
      label: b.label,
      count,
      interactions: interactionsSum,
      meanInteractions,
      evidenceIds: b.notes.map(n => n.noteId).slice(0, 50),
    };
  });
}

function generateActions(params: {
  notes: IndustryV2Note[];
  config: IndustryV2Config;
  scenes: IndustryV2Distribution[];
  sellingPoints: IndustryV2Distribution[];
  formats: IndustryV2Distribution[];
  tiers: IndustryV2Distribution[];
  weekday: IndustryV2Distribution[];
  commercialVsNatural: IndustryV2Distribution[];
  promotedVsOrganic: IndustryV2Distribution[];
  coverageCompleteRatio: number;
}): IndustryV2Report['actions'] {
  const {
    notes,
    config,
    scenes,
    formats,
    tiers,
    commercialVsNatural,
    coverageCompleteRatio,
  } = params;

  const actions: IndustryV2Report['actions'] = [];

  if (notes.length < 5 || coverageCompleteRatio < 0.8) {
    actions.push({
      id: 'act-improve-collection-keywords',
      priority: 'high',
      title: '优化采集关键词覆盖与采集完整度',
      finding: `当前周期已获得 ${notes.length} 篇去重样本，词×日任务完整覆盖率为 ${(coverageCompleteRatio * 100).toFixed(0)}%。未完成或被截断的检索会影响跨期比较。`,
      suggestion: '先检查待补采、失败与部分覆盖状态；等待已有词包补齐后再比较趋势。若精确 SPU 连续返回空样本，再核对产品名称，不将零检索结果当作没有市场声量。',
      evidenceIds: notes.map(n => n.noteId).slice(0, 5),
      basis: `基于当前采集样本量 ${notes.length} 篇与 ${(coverageCompleteRatio * 100).toFixed(0)}% 的覆盖率统计`,
    });
    actions.push({
      id: 'act-expand-monitoring-period',
      priority: 'medium',
      title: '建立可比的连续观测基准',
      finding: `当前配置为 ${config.historyDays} 天窗口；环比需要连续 14 天的全部检索任务完整覆盖，样本总数不能替代日期覆盖。`,
      suggestion: config.historyDays < 14 ? '将监测窗口设为 14 天或 30 天，并积累连续观测数据。' : '保持当前窗口，优先补齐现有日期；达到分页上限的日期仍只代表部分样本，不强行计算环比。',
      evidenceIds: notes.map(n => n.noteId).slice(0, 5),
      basis: `基于当前采样周期内 ${notes.length} 篇样本的稳定性评估`,
    });
    if (notes.length === 0) {
      return actions;
    }
  }

  const validScenes = scenes.filter(s => s.label !== '未识别场景' && s.count > 0 && s.meanInteractions !== null);
  if (validScenes.length > 0) {
    const topScene = [...validScenes].sort((a, b) => (b.meanInteractions || 0) - (a.meanInteractions || 0))[0];
    actions.push({
      id: 'act-focus-top-scene',
      priority: topScene.count >= 5 && coverageCompleteRatio >= 0.8 ? 'high' : 'medium',
      title: `针对高互动切角「${topScene.label}」开展小规模内容测试`,
      finding: `在采样样本中（覆盖率 ${(coverageCompleteRatio * 100).toFixed(0)}%），「${topScene.label}」切角共采集 ${topScene.count} 篇笔记，平均互动量达 ${topScene.meanInteractions}。`,
      suggestion: `建议后续产出 1-2 篇「${topScene.label}」方向的内容进行小规模验证，观察用户互动是否具备持续性。`,
      evidenceIds: topScene.evidenceIds.slice(0, 5),
      basis: `基于采样范围内 ${topScene.count} 篇「${topScene.label}」切角笔记的真实互动表现（小规模验证假设）`,
    });
  }

  const video = formats.find(f => f.label === '视频');
  const image = formats.find(f => f.label === '图文');
  if (video && image && video.count > 0 && image.count > 0 && video.meanInteractions !== null && image.meanInteractions !== null) {
    if (actions.length < 4) {
      const isVideoBetter = video.meanInteractions > image.meanInteractions;
      actions.push({
        id: 'act-optimize-content-format',
        priority: isVideoBetter && video.count >= 5 && image.count >= 5 && coverageCompleteRatio >= 0.8 ? 'high' : 'medium',
        title: isVideoBetter ? '建议对视频形式开展小规模分发测试' : '建议对图文形式开展小规模排版测试',
        finding: `在监测样本内，视频格式平均互动量为 ${video.meanInteractions}（共 ${video.count} 篇），图文格式为 ${image.meanInteractions}（共 ${image.count} 篇）。`,
        suggestion: isVideoBetter
          ? '当前样本中视频互动均值高于图文，可将优质图文主题制作 1-2 条短视频做小规模分发观察，验证互动表现。'
          : '当前样本中图文互动均值不低于视频，可围绕相同选题制作轻量图文做对照测试；均值不代表表现稳定或因果优势。',
        evidenceIds: (isVideoBetter ? video.evidenceIds : image.evidenceIds).slice(0, 5),
        basis: `基于采样范围内 ${video.count} 篇视频与 ${image.count} 篇图文的真实平均互动量对比（样本观察，需小规模验证）`,
      });
    }
  }

  const validTiers = tiers.filter(t => t.label !== '未知粉丝数' && t.count > 0 && t.meanInteractions !== null);
  if (validTiers.length > 0 && actions.length < 4) {
    const bestTier = [...validTiers].sort((a, b) => (b.meanInteractions || 0) - (a.meanInteractions || 0))[0];
    actions.push({
      id: 'act-creator-tier-pacing',
      priority: 'medium',
      title: `关注「${bestTier.label}」创作者内容表现`,
      finding: `在监测样本中（覆盖率 ${(coverageCompleteRatio * 100).toFixed(0)}%），「${bestTier.label}」创作者共产出 ${bestTier.count} 篇笔记，平均互动量达 ${bestTier.meanInteractions}。（注：达人层级系创作者账号量级阶梯，非受众画像）`,
      suggestion: `「${bestTier.label}」在有限样本中平均互动较高，可作为后续小规模沟通或合作选题的测试观察对象，不据此作全盘预算调整。`,
      evidenceIds: bestTier.evidenceIds.slice(0, 5),
      basis: `基于采样范围内 ${bestTier.count} 篇归属于「${bestTier.label}」创作者的内容统计（样本观察，非受众画像或最终预算建议）`,
    });
  }

  const comm = commercialVsNatural.find(c => c.label === '商业合作');
  const nat = commercialVsNatural.find(c => c.label === '自然内容');
  if (comm && nat && actions.length < 4) {
    const totalKnown = comm.count + nat.count;
    if (totalKnown > 0) {
      const commRate = comm.count / totalKnown;
      actions.push({
        id: 'act-commercial-mix-balance',
        priority: 'medium',
        title: '持续观察自然内容与商业标记笔记表现',
        finding: `在已知性质样本中（覆盖率 ${(coverageCompleteRatio * 100).toFixed(0)}%），商业合作笔记共 ${comm.count} 篇（占比 ${(commRate * 100).toFixed(1)}%），自然口碑笔记共 ${nat.count} 篇。`,
        suggestion: commRate < 0.2
          ? '样本中商业标记占比较低，建议持续追踪高互动自然内容的话题方向，作为后续选题小规模测试的参考。'
          : '商业笔记占比较高，需持续监控真实用户评论反馈，注重通过真实测评与生活场景降低商业感。',
        evidenceIds: (comm.count > 0 ? comm.evidenceIds : nat.evidenceIds).slice(0, 5),
        basis: `基于采样范围内 ${totalKnown} 篇已知性质笔记的商业化比例分布（样本统计）`,
      });
    }
  }

  if (actions.length < 2) {
    actions.push({
      id: 'act-monitoring-daily-pacing',
      priority: 'medium',
      title: '保持常态化数据监控与指标跟踪',
      finding: `当前已采集 ${notes.length} 篇有效笔记，覆盖核心监测词。`,
      suggestion: '建议保持周期性跟踪，密切观测品类热词与竞品动作变化。',
      evidenceIds: notes.map(n => n.noteId).slice(0, 5),
      basis: `基于当前已采集的 ${notes.length} 篇样本跟踪`,
    });
  }

  return actions.slice(0, 4);
}

export function analyzeIndustryV2(input: IndustryV2AnalysisInput): IndustryV2Report {
  const { config, from, to } = input;
  const rawNotes = input.notes || [];
  const coverageRows = input.coverage || [];

  const deduplicatedNotes = deduplicateNotes(rawNotes);
  const totalNotesCount = deduplicatedNotes.length;

  let latestCollectedAt: string | null = null;
  for (const n of deduplicatedNotes) {
    if (n.capturedAt) {
      if (!latestCollectedAt || n.capturedAt > latestCollectedAt) {
        latestCollectedAt = n.capturedAt;
      }
    }
  }

  const dates = getDatesInRange(from, to);
  const queries = config.queries || [];

  const coverageStatusMap = new Map<string, string>();
  let completeRowsCount = 0;
  let partialRowsCount = 0;
  let failedRowsCount = 0;
  let runningRowsCount = 0;
  let pendingRowsCount = 0;

  for (const row of coverageRows) {
    coverageStatusMap.set(`${row.queryId}:${row.date}`, row.status);
    if (row.status === 'complete') completeRowsCount++;
    else if (row.status === 'partial') partialRowsCount++;
    else if (row.status === 'failed') failedRowsCount++;
    else if (row.status === 'running') runningRowsCount++;
    else if (row.status === 'pending') pendingRowsCount++;
  }

  const expectedCoverage = queries.length > 0
    ? Math.max(coverageRows.length, dates.length * queries.length)
    : coverageRows.length;
  const coverage = {
    expected: expectedCoverage,
    complete: completeRowsCount,
    partial: partialRowsCount,
    failed: failedRowsCount,
    running: runningRowsCount,
    pending: pendingRowsCount,
    rows: coverageRows,
  };

  const creatorIdMap = new Map<string, {
    id: string;
    name: string;
    fans: number | null;
    notes: number;
    interactionsSum: number;
    hasInteractions: boolean;
    quotedPrice: number | null;
    queryIds: Set<string>;
  }>();

  let unknownCreators = 0;

  for (const n of deduplicatedNotes) {
    const rawId = (n.creatorId || '').trim();
    if (!rawId || rawId.toLowerCase() === 'unknown') {
      unknownCreators++;
    } else {
      const existing = creatorIdMap.get(rawId);
      const hasInter = n.interactions !== null && Number.isFinite(n.interactions);
      const interVal = hasInter ? (n.interactions || 0) : 0;
      if (!existing) {
        creatorIdMap.set(rawId, {
          id: rawId,
          name: n.creatorName || rawId,
          fans: n.fans ?? null,
          notes: 1,
          interactionsSum: interVal,
          hasInteractions: hasInter,
          quotedPrice: n.quotedPrice ?? null,
          queryIds: new Set(n.queryIds || []),
        });
      } else {
        existing.notes++;
        if (hasInter) {
          existing.interactionsSum += interVal;
          existing.hasInteractions = true;
        }
        if (existing.fans === null && n.fans !== null) {
          existing.fans = n.fans;
        }
        if (existing.quotedPrice === null && n.quotedPrice !== null) {
          existing.quotedPrice = n.quotedPrice;
        }
        if (n.queryIds) {
          for (const qid of n.queryIds) existing.queryIds.add(qid);
        }
      }
    }
  }

  let repeatCreators = 0;
  for (const c of Array.from(creatorIdMap.values())) {
    if (c.notes > 1) repeatCreators++;
  }
  const totalCreatorsCount = creatorIdMap.size;

  const topCreators = Array.from(creatorIdMap.values())
    .sort((a, b) => {
      const aInter = a.hasInteractions ? a.interactionsSum : -1;
      const bInter = b.hasInteractions ? b.interactionsSum : -1;
      if (bInter !== aInter) return bInter - aInter;
      return b.notes - a.notes;
    })
    .slice(0, 10)
    .map(c => ({
      id: c.id,
      name: c.name,
      fans: c.fans,
      notes: c.notes,
      interactions: c.hasInteractions ? c.interactionsSum : null,
      quotedPrice: c.quotedPrice,
      queryIds: Array.from(c.queryIds),
    }));

  const TIER_ORDER = [
    '超头部(>100万)',
    '头部(50万-100万)',
    '腰部(20万-50万)',
    '精选(3万-20万)',
    'KOC(5000-3万)',
    '素人(<5000)',
    '未知粉丝数',
  ];
  const creatorTiersDistribution = buildDistribution(
    TIER_ORDER.map(t => ({
      label: t,
      notes: deduplicatedNotes.filter(n => getFansTier(n.fans) === t),
    }))
  );

  const creators = {
    tiers: creatorTiersDistribution,
    top: topCreators,
    repeatCreators,
    unknownCreators,
  };

  let noteChange: number | null = null;
  let changeReason = '';

  if (dates.length < 14) {
    noteChange = null;
    changeReason = `监测周期仅 ${dates.length} 天（不足 14 天），无法计算近7天对比前7天的环比变化`;
  } else {
    const last7Days = dates.slice(-7);
    const prior7Days = dates.slice(-14, -7);
    const all14Days = [...prior7Days, ...last7Days];

    let coverageCompleteFor14Days = true;
    for (const d of all14Days) {
      for (const q of queries) {
        const status = coverageStatusMap.get(`${q.id}:${d}`);
        if (status !== 'complete') {
          coverageCompleteFor14Days = false;
          break;
        }
      }
      if (!coverageCompleteFor14Days) break;
    }

    if (!coverageCompleteFor14Days) {
      noteChange = null;
      changeReason = '近 14 天存在采样未完整覆盖的日期（部分关键词未采集或采集失败），按口径不计算环比变化';
    } else {
      const last7Notes = deduplicatedNotes.filter(n => {
        const d = noteShanghaiDate(n) || '';
        return last7Days.includes(d);
      });
      const prior7Notes = deduplicatedNotes.filter(n => {
        const d = noteShanghaiDate(n) || '';
        return prior7Days.includes(d);
      });

      const lCount = last7Notes.length;
      const pCount = prior7Notes.length;
      if (pCount === 0) {
        noteChange = lCount === 0 ? 0 : null;
        changeReason = lCount === 0
          ? '近7天与前7天均无笔记发布'
          : '前7天有效笔记数为 0，基数为零无法计算百分比变化';
      } else {
        noteChange = Math.round(((lCount - pCount) / pCount) * 10000) / 10000;
        const pct = (noteChange * 100).toFixed(1);
        changeReason = `近7天 (${lCount}篇) 对比前7天 (${pCount}篇) 变化 ${noteChange >= 0 ? '+' : ''}${pct}%`;
      }
    }
  }

  const summary = {
    notes: totalNotesCount,
    creators: totalCreatorsCount,
    impressions: buildSumMetric(deduplicatedNotes.map(n => n.impressions), totalNotesCount),
    reads: buildSumMetric(deduplicatedNotes.map(n => n.reads), totalNotesCount),
    interactions: buildSumMetric(deduplicatedNotes.map(n => n.interactions), totalNotesCount),
    commercialRate: buildRateMetric(deduplicatedNotes.map(n => n.commercial), totalNotesCount),
    promotedRate: buildRateMetric(deduplicatedNotes.map(n => n.promoted), totalNotesCount),
    noteChange,
    changeReason,
  };

  const comparison = queries.map(query => {
    const qNotes = deduplicatedNotes.filter(n => (n.queryIds || []).includes(query.id));
    const qTotal = qNotes.length;

    const qCreatorIds = new Set<string>();
    for (const n of qNotes) {
      const cid = (n.creatorId || '').trim();
      if (cid && cid.toLowerCase() !== 'unknown') {
        qCreatorIds.add(cid);
      }
    }

    let completeDays = 0;
    for (const d of dates) {
      if (coverageStatusMap.get(`${query.id}:${d}`) === 'complete') {
        completeDays++;
      }
    }

    return {
      query,
      notes: qTotal,
      creators: qCreatorIds.size,
      interactions: buildSumMetric(qNotes.map(n => n.interactions), qTotal),
      impressions: buildSumMetric(qNotes.map(n => n.impressions), qTotal),
      commercialRate: buildRateMetric(qNotes.map(n => n.commercial), qTotal),
      promotedRate: buildRateMetric(qNotes.map(n => n.promoted), qTotal),
      completeDays,
      expectedDays: dates.length,
    };
  });

  const trend = dates.map(date => {
    const isComplete = queries.length > 0 && queries.every(q => coverageStatusMap.get(`${q.id}:${date}`) === 'complete');
    const dayNotes = deduplicatedNotes.filter(n => noteShanghaiDate(n) === date);

    if (isComplete) {
      if (dayNotes.length === 0) {
        return {
          date,
          notes: 0,
          commercial: 0,
          promoted: 0,
          interactions: 0,
          complete: true,
        };
      }
      const hasKnownComm = dayNotes.some(n => n.commercial !== null);
      const hasKnownProm = dayNotes.some(n => n.promoted !== null);
      const knownInteractions = dayNotes.filter(n => n.interactions !== null && Number.isFinite(n.interactions));

      return {
        date,
        notes: dayNotes.length,
        commercial: hasKnownComm ? dayNotes.filter(n => n.commercial === true).length : null,
        promoted: hasKnownProm ? dayNotes.filter(n => n.promoted === true).length : null,
        interactions: knownInteractions.length > 0
          ? knownInteractions.reduce((acc, curr) => acc + (curr.interactions || 0), 0)
          : null,
        complete: true,
      };
    }

    if (dayNotes.length === 0) {
      return {
        date,
        notes: null,
        commercial: null,
        promoted: null,
        interactions: null,
        complete: false,
      };
    }

    const hasKnownComm = dayNotes.some(n => n.commercial !== null);
    const hasKnownProm = dayNotes.some(n => n.promoted !== null);
    const knownInteractions = dayNotes.filter(n => n.interactions !== null && Number.isFinite(n.interactions));

    return {
      date,
      notes: dayNotes.length,
      commercial: hasKnownComm ? dayNotes.filter(n => n.commercial === true).length : null,
      promoted: hasKnownProm ? dayNotes.filter(n => n.promoted === true).length : null,
      interactions: knownInteractions.length > 0
        ? knownInteractions.reduce((acc, curr) => acc + (curr.interactions || 0), 0)
        : null,
      complete: false,
    };
  });

  const category = detectProjectCategory(config);
  const dict = PROJECT_DICTIONARIES[category] || PROJECT_DICTIONARIES.general;

  const sceneBucketMap = new Map<string, IndustryV2Note[]>();
  for (const s of dict.scenes) sceneBucketMap.set(s.label, []);
  sceneBucketMap.set('未识别场景', []);

  const sellingPointBucketMap = new Map<string, IndustryV2Note[]>();
  for (const sp of dict.sellingPoints) sellingPointBucketMap.set(sp.label, []);
  sellingPointBucketMap.set('未识别卖点', []);

  for (const n of deduplicatedNotes) {
    const text = `${n.title || ''} ${n.content || ''}`.toLowerCase();

    let matchedScene = false;
    for (const rule of dict.scenes) {
      if (rule.keywords.some(k => text.includes(k.toLowerCase()))) {
        sceneBucketMap.get(rule.label)!.push(n);
        matchedScene = true;
      }
    }
    if (!matchedScene) {
      sceneBucketMap.get('未识别场景')!.push(n);
    }

    let matchedSellingPoint = false;
    for (const rule of dict.sellingPoints) {
      if (rule.keywords.some(k => text.includes(k.toLowerCase()))) {
        sellingPointBucketMap.get(rule.label)!.push(n);
        matchedSellingPoint = true;
      }
    }
    if (!matchedSellingPoint) {
      sellingPointBucketMap.get('未识别卖点')!.push(n);
    }
  }

  const scenesDistribution = buildDistribution(
    Array.from(sceneBucketMap.entries()).map(([label, bNotes]) => ({ label, notes: bNotes }))
  );

  const sellingPointsDistribution = buildDistribution(
    Array.from(sellingPointBucketMap.entries()).map(([label, bNotes]) => ({ label, notes: bNotes }))
  );

  const formatBuckets = [
    { label: '图文', notes: deduplicatedNotes.filter(n => n.format === 'image') },
    { label: '视频', notes: deduplicatedNotes.filter(n => n.format === 'video') },
    { label: '未知形式', notes: deduplicatedNotes.filter(n => n.format === 'unknown') },
  ];
  const formatsDistribution = buildDistribution(formatBuckets);

  const patternBucketMap = new Map<string, IndustryV2Note[]>();
  for (const p of TITLE_PATTERNS) patternBucketMap.set(p.label, []);
  patternBucketMap.set('未识别句式', []);

  for (const n of deduplicatedNotes) {
    const titleText = (n.title || '').toLowerCase();
    let matched = false;
    for (const p of TITLE_PATTERNS) {
      if (p.keywords.some(k => titleText.includes(k.toLowerCase()))) {
        patternBucketMap.get(p.label)!.push(n);
        matched = true;
      }
    }
    if (!matched) {
      patternBucketMap.get('未识别句式')!.push(n);
    }
  }
  const titlePatternsDistribution = buildDistribution(
    Array.from(patternBucketMap.entries()).map(([label, bNotes]) => ({ label, notes: bNotes }))
  );

  const topNotes = [...deduplicatedNotes]
    .sort((a, b) => {
      const aInter = a.interactions ?? -1;
      const bInter = b.interactions ?? -1;
      if (bInter !== aInter) return bInter - aInter;
      const aLikes = a.likes ?? -1;
      const bLikes = b.likes ?? -1;
      return bLikes - aLikes;
    })
    .slice(0, 10);

  const content = {
    scenes: scenesDistribution,
    sellingPoints: sellingPointsDistribution,
    formats: formatsDistribution,
    titlePatterns: titlePatternsDistribution,
    topNotes,
  };

  const weekdayBuckets = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(w => ({
    label: w,
    notes: deduplicatedNotes.filter(n => getWeekday(noteShanghaiDate(n)) === w),
  }));
  const weekdayDistribution = buildDistribution(weekdayBuckets);

  const commercialBuckets = [
    { label: '商业合作', notes: deduplicatedNotes.filter(n => n.commercial === true) },
    { label: '自然内容', notes: deduplicatedNotes.filter(n => n.commercial === false) },
    { label: '未知性质', notes: deduplicatedNotes.filter(n => n.commercial === null) },
  ];
  const commercialVsNatural = buildDistribution(commercialBuckets);

  const promotedBuckets = [
    { label: '投流推广', notes: deduplicatedNotes.filter(n => n.promoted === true) },
    { label: '非投流/自然流量', notes: deduplicatedNotes.filter(n => n.promoted === false) },
    { label: '未知投流', notes: deduplicatedNotes.filter(n => n.promoted === null) },
  ];
  const promotedVsOrganic = buildDistribution(promotedBuckets);

  const notesWithReadAndImp = deduplicatedNotes.filter(n =>
    n.impressions !== null && n.reads !== null && Number.isFinite(n.impressions) && Number.isFinite(n.reads) && n.impressions > 0
  );
  const readingRateKnown = notesWithReadAndImp.length;
  let readingRateValue: number | null = null;
  if (readingRateKnown > 0) {
    const sumImp = notesWithReadAndImp.reduce((sum, n) => sum + (n.impressions || 0), 0);
    const sumReads = notesWithReadAndImp.reduce((sum, n) => sum + (n.reads || 0), 0);
    if (sumImp > 0) {
      readingRateValue = Math.round((sumReads / sumImp) * 10000) / 10000;
    }
  }
  const readingRate: IndustryV2Metric = {
    value: readingRateValue,
    known: readingRateKnown,
    total: totalNotesCount,
  };

  const notesWithInterAndRead = deduplicatedNotes.filter(n =>
    n.reads !== null && n.interactions !== null && Number.isFinite(n.reads) && Number.isFinite(n.interactions) && n.reads > 0
  );
  const interactionRateKnown = notesWithInterAndRead.length;
  let interactionRateValue: number | null = null;

  if (interactionRateKnown > 0) {
    const sumReads = notesWithInterAndRead.reduce((sum, n) => sum + (n.reads || 0), 0);
    const sumInter = notesWithInterAndRead.reduce((sum, n) => sum + (n.interactions || 0), 0);
    if (sumReads > 0) {
      interactionRateValue = Math.round((sumInter / sumReads) * 10000) / 10000;
    }
  }

  const interactionRate: IndustryV2Metric = {
    value: interactionRateValue,
    known: interactionRateKnown,
    total: totalNotesCount,
  };

  const traffic = {
    weekday: weekdayDistribution,
    commercialVsNatural,
    promotedVsOrganic,
    readingRate,
    interactionRate,
  };

  const coverageCompleteRatio = expectedCoverage > 0 ? (completeRowsCount / expectedCoverage) : 0;
  const actions = generateActions({
    notes: deduplicatedNotes,
    config,
    scenes: scenesDistribution,
    sellingPoints: sellingPointsDistribution,
    formats: formatsDistribution,
    tiers: creatorTiersDistribution,
    weekday: weekdayDistribution,
    commercialVsNatural,
    promotedVsOrganic,
    coverageCompleteRatio,
  });

  const limitations = [
    '达人报价为公开采买参考价，不能直接累加为实际结算消耗，报告未计算 ROI。',
    '总互动量严格基于原始平台的互动数（engageNum）统计，未以点赞数估算或替换。',
    '趋势图中的逐日互动量为该发布日笔记在抓取时刻的累计总互动，而非该日期当天产生的新增互动增量。',
    '数据属于设定关键词与受控分页上限（maxPages cap）下的样本监测，即使日覆盖为 complete 亦不代表平台全量大盘。',
    '阅读率与互动率指标均采用严格成对样本计算：互动率固定以阅读数（reads）为分母，不以展现数动态替代；成对样本不足时记为 null。',
    '不同监测词采集到的笔记存在交叉重合，分词对比按独立样本展示，不可简单加总作为全市场规模。',
    '环比计算严格基于连续 14 天完整采样（所有监测词均 complete），存在采样缺失时不予计算。',
    '内容切角与标题模式基于明确的行业规则库匹配，未匹配样本单列为未识别，不宣称包含黑盒 AI 深度洞察。',
    '达人粉丝层级仅代表创作者自身粉丝量级阶梯，非受众人口属性或粉丝画像。',
  ];

  return {
    version: 2,
    config,
    from,
    to,
    generatedAt: new Date().toISOString(),
    latestCollectedAt,
    coverage,
    summary,
    comparison,
    trend,
    content,
    creators,
    traffic,
    actions,
    notes: deduplicatedNotes.slice(0, 10000),
    limitations,
  };
}
