import type {
  BrandRuleMapping,
  ConsumerIssue,
  ContentNature,
  CreatorTier,
  DuplicateStatus,
  RawIpscgRecord,
  SentimentTendency,
  CompetitorNote,
} from './types';

// 风险与消费者反馈词典
const ISSUE_CATEGORIES: Array<{
  category: ConsumerIssue['category'];
  keywords: string[];
}> = [
  {
    category: 'digestive',
    keywords: ['便秘', '拉肚子', '腹泻', '绿便', '胀气', '肠绞痛', '吐奶', '溢奶', '排便困难', '攒肚', '奶瓣', '拉稀'],
  },
  {
    category: 'taste',
    keywords: ['味道腥', '腥味重', '太腥', '不爱喝', '抗拒', '太甜', '香精', '口感差', '难喝', '不接受'],
  },
  {
    category: 'mixability',
    keywords: ['结块', '挂壁', '难溶解', '起泡多', '沉淀', '溶不开', '摇不匀', '有小颗粒'],
  },
  {
    category: 'safety',
    keywords: ['湿疹', '过敏', '红疹', '上火', '乳糖不耐受', '长红点', '水便', '红屁屁'],
  },
  {
    category: 'service',
    keywords: ['假货', '破罐', '漏粉', '售后差', '涨价', '临期', '凹罐', '客服不理'],
  },
];

const COMMERCIAL_SIGNALS = [
  '合作', '赞助', '品牌邀请', '商单', '蒲公英', '开箱测评', '好物推荐',
  '点击左下角', '同款链接', '官方旗舰店', '福利', '抽奖', '专享价', '领券'
];

const NATURAL_SIGNALS = [
  '自费购买', '踩坑', '亲测吐槽', '求助姐妹', '我家宝宝', '二胎妈妈真实',
  '喝了三个月', '真实感受', '个人记录', '断奶记录', '真实分享'
];

export function extractConsumerIssues(text: string): ConsumerIssue[] {
  if (!text) return [];
  const issues: ConsumerIssue[] = [];
  const lower = text.toLowerCase();

  for (const group of ISSUE_CATEGORIES) {
    for (const kw of group.keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        const start = Math.max(0, idx - 15);
        const end = Math.min(text.length, idx + kw.length + 15);
        const excerpt = text.slice(start, end).trim();
        issues.push({
          category: group.category,
          keyword: kw,
          excerpt: '...' + excerpt + '...',
          confidence: 0.85,
        });
        break; // 同一分类取最显著命中的一条
      }
    }
  }
  return issues;
}

export function detectContentNature(
  title: string,
  content: string,
  tags: string[]
): { nature: ContentNature; evidence: string } {
  const combined = (title || '') + ' ' + (content || '') + ' ' + tags.join(' ');

  const foundComm = COMMERCIAL_SIGNALS.find(s => combined.includes(s));
  if (foundComm) {
    return {
      nature: 'commercial',
      evidence: '命中商业合作信号词「' + foundComm + '」',
    };
  }

  const foundNat = NATURAL_SIGNALS.find(s => combined.includes(s));
  if (foundNat) {
    return {
      nature: 'natural',
      evidence: '命中真实自费/日常分享信号词「' + foundNat + '」',
    };
  }

  return {
    nature: 'unknown',
    evidence: '缺少明确商业报备或自费日常分享特征词',
  };
}

export function detectSentiment(
  title: string,
  content: string,
  issues: ConsumerIssue[]
): SentimentTendency {
  const text = (title || '') + ' ' + (content || '');
  if (issues.length > 0) return 'negative';
  if (text.includes('?') || text.includes('？') || text.includes('怎么样') || text.includes('求助')) {
    return 'question';
  }
  if (text.includes('好') || text.includes('推荐') || text.includes('不错') || text.includes('长肉') || text.includes('适应很好')) {
    return 'positive';
  }
  return 'neutral';
}

export function attributeBrandAndLine(
  title: string,
  content: string,
  tags: string[],
  keywordHit: string,
  rules: BrandRuleMapping[]
): { brand: string; productLine: string } {
  const titleText = (title || '').trim();
  const contentText = (content || '').trim();
  const tagText = (tags || []).join(' ');
  const fullText = titleText + ' ' + contentText + ' ' + tagText;

  if (!fullText.trim()) {
    return { brand: 'unknown', productLine: '无正文与标题证据' };
  }

  // 扫描所有规则中明确命中的品牌
  const matchedBrands: Array<{
    brand: string;
    inTitle: boolean;
    inContent: boolean;
    productLine: string;
    score: number;
  }> = [];

  for (const rule of rules) {
    let hitBrand = false;
    let inTitle = false;
    let inContent = false;

    for (const alias of rule.aliases) {
      if (titleText.includes(alias)) {
        hitBrand = true;
        inTitle = true;
      }
      if (contentText.includes(alias) || tagText.includes(alias)) {
        hitBrand = true;
        inContent = true;
      }
    }

    if (hitBrand) {
      let matchedLine = '综合/未细分';
      for (const pl of rule.productLines) {
        if (pl.keywords.some(k => fullText.includes(k))) {
          matchedLine = pl.line;
          break;
        }
      }
      const score = (inTitle ? 3 : 0) + (inContent ? 1 : 0);
      matchedBrands.push({
        brand: rule.brand,
        inTitle,
        inContent,
        productLine: matchedLine,
        score,
      });
    }
  }

  // 1. 无任何明确品牌证据：严格归为 unknown，保留采集关键词作来源
  if (matchedBrands.length === 0) {
    return { brand: 'unknown', productLine: '无明确品牌提及' };
  }

  // 2. 恰好命中单一品牌：按明确证据归属
  if (matchedBrands.length === 1) {
    return {
      brand: matchedBrands[0].brand,
      productLine: matchedBrands[0].productLine,
    };
  }

  // 3. 命中多个品牌（多品牌对比或提及）：按标题权重或主导性判定
  matchedBrands.sort((a, b) => b.score - a.score);
  if (matchedBrands[0].score > matchedBrands[1].score) {
    return {
      brand: matchedBrands[0].brand,
      productLine: matchedBrands[0].productLine + ' (多品牌对比主导)',
    };
  }

  return {
    brand: '多品牌对比',
    productLine: matchedBrands.map(b => b.brand).join('+'),
  };
}

export function parseRawIpscgRecord(
  raw: RawIpscgRecord,
  projectId: string,
  taskId: string,
  keywordHit: string,
  rules: BrandRuleMapping[],
  existingNotesMap: Map<string, { id: string; rawNoteId: string; title: string; authorName: string; pubTime: string }>
): CompetitorNote {
  const rawNoteId = String(raw.noteId || '').trim();
  const idHexLength = rawNoteId.length;
  const title = String(raw.title || '').trim();
  const content = String(raw.content || '').trim();
  const authorName = String(raw.nickname || '').trim() || '小红书用户';
  const authorId = String(raw.userId || '').trim();
  const avatarUrl = String(raw.avatar || '').trim();
  const pubTime = String(raw.pubTime || raw.insertTime || '').trim();
  const insertTime = String(raw.insertTime || raw.lastUpdateTime || '').trim();
  const lastUpdateTime = String(raw.lastUpdateTime || insertTime || '').trim();

  // 业务归属日期：优先使用发布时间日期；无发布时间时回退入库日期
  const asofDate = pubTime.slice(0, 10) || insertTime.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const collectionDate = insertTime.slice(0, 10) || asofDate;

  // 标签解析
  let tags: string[] = [];
  if (raw.tagList) {
    try {
      const parsedTags = JSON.parse(raw.tagList);
      if (Array.isArray(parsedTags)) {
        tags = parsedTags.map(t => typeof t === 'string' ? t : (t?.name || '')).filter(Boolean);
      }
    } catch {
      tags = String(raw.tagList).split(/[,，、 ]+/).filter(Boolean);
    }
  }

  // 品牌与品线归属判定（核心：命中关键词不等于品牌归属）
  const { brand: brandAttributed, productLine } = attributeBrandAndLine(title, content, tags, keywordHit, rules);

  // 商业/自然判定
  const { nature: contentNature, evidence: natureEvidence } = detectContentNature(title, content, tags);

  // 达人层级（严守事实：上游无真实粉丝数字段，保守且如实标为 unknown）
  const creatorTier: CreatorTier = 'unknown';

  // 消费者反馈与风险线索
  const consumerIssues = extractConsumerIssues(title + ' ' + content);

  // 情感倾向
  const sentimentTendency = detectSentiment(title, content, consumerIssues);

  // 去重与疑似重复检查（绝不截短 ID 或强行合并）
  let duplicateStatus: DuplicateStatus = 'unique';
  let suspectedDupTarget: string | null = null;

  for (const existing of existingNotesMap.values()) {
    if (existing.rawNoteId === rawNoteId) {
      duplicateStatus = 'confirmed_dup';
      break;
    }
    // 疑似重复检查：不同 ID，但标题与作者完全相同
    if (existing.title && title && existing.title === title && existing.authorName === authorName) {
      duplicateStatus = 'suspected_dup';
      suspectedDupTarget = existing.rawNoteId;
      break;
    }
  }

  const likedCount = typeof raw.likedCount === 'number' ? raw.likedCount : 0;
  const commentCount = typeof raw.commentCount === 'number' ? raw.commentCount : 0;
  const collectedCount = typeof raw.collectedCount === 'number' ? raw.collectedCount : 0;
  const shareCount = typeof raw.shareCount === 'number' ? raw.shareCount : 0;
  const interactionTotal = likedCount + commentCount + collectedCount + shareCount;

  const noteUrl = raw.noteUrl || ('https://www.xiaohongshu.com/discovery/item/' + rawNoteId);

  const now = new Date().toISOString();

  return {
    id: projectId + ':' + rawNoteId,
    projectId,
    taskId,
    rawNoteId,
    idHexLength,
    title: title || '无标题笔记',
    content,
    authorName,
    authorId,
    avatarUrl,
    pubTime,
    insertTime,
    lastUpdateTime,
    asofDate,
    collectionDate,
    keywordHit,
    brandAttributed,
    productLine,
    contentType: raw.type || 'normal',
    contentNature,
    natureEvidence,
    creatorTier,
    likedCount,
    commentCount,
    collectedCount,
    shareCount,
    interactionTotal,
    noteUrl,
    videoUrl: raw.videoUrl || '',
    tags,
    rawPayload: (raw as unknown) as Record<string, unknown>,
    duplicateStatus,
    suspectedDupTarget,
    consumerIssues,
    sentimentTendency,
    dataQuality: pubTime && rawNoteId && title ? 'complete' : 'partial',
    createdAt: now,
    updatedAt: now,
  };
}
