export type CommentInput = {
  id: string;
  noteId: string;
  parentId?: string;
  content: string;
  author?: string;
  createdAt?: string;
  replyCount?: number;
};

const negativeWords = ['不好', '踩雷', '过敏', '便秘', '拉肚子', '胀气', '吐奶', '不长肉', '腥', '难喝', '结块', '发货慢', '不发货', '客服', '核销', '假货', '贵', '后悔'];
const positiveWords = ['好吸收', '长肉', '长个', '适应', '好转奶', '抵抗力', '体质', '便便正常', '爱喝', '放心', '稳当', '细腻', '溶解'];
const questionWords = ['吗', '嘛', '呢', '？', '?', '怎么', '多少', '多久', '哪买', '适合', '有没有', '好不好'];
const brandWords = ['飞鹤', '启萃', '卓睿'];
const competitorWords = ['爱他美', '合生元', '派星', 'A2', 'a2', '至初', '美素', '金领冠'];
const sellingWords = ['出一罐', '转卖', '低价出', '私我', '闲置', '代理', '加微', '出售'];
const irrelevantWords = ['求互', '互关', '互赞', '打卡', '路过', '第一', '沙发', '占楼'];

export type ClassificationRules = {
  brands: string[]; competitors: string[]; positiveWords: string[]; negativeWords: string[];
  questionWords?: string[]; sellingWords?: string[]; irrelevantWords?: string[]; deleteCompetitorMentions?: boolean;
};
export const DEFAULT_RULES: ClassificationRules = { brands: brandWords, competitors: competitorWords, positiveWords, negativeWords };

export function normalizeText(value: string) {
  return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
}

export function classifyComment(comment: CommentInput, rules: ClassificationRules = DEFAULT_RULES) {
  const text = comment.content.trim();
  const hasBrand = rules.brands.some((word) => text.includes(word));
  const competitor = rules.competitors.find((word) => text.includes(word)) || '';
  const isQuestion = (rules.questionWords?.length ? rules.questionWords : questionWords).some((word) => text.includes(word));
  const isNegative = rules.negativeWords.some((word) => text.includes(word));
  const isPositive = !isNegative && rules.positiveWords.some((word) => text.includes(word));
  const isSelling = (rules.sellingWords?.length ? rules.sellingWords : sellingWords).some((word) => text.includes(word));
  const onlyEmoji = Boolean(text) && normalizeText(text).length === 0;
  const irrelevant = (rules.irrelevantWords?.length ? rules.irrelevantWords : irrelevantWords).some((word) => text.includes(word));

  let sentiment = '中立';
  if (isNegative) sentiment = '负向';
  else if (isPositive) sentiment = '正向';
  else if (isQuestion) sentiment = '问询';

  let category = '其他';
  if (isSelling) category = '出售/引流';
  else if (onlyEmoji) category = '纯表情';
  else if (isNegative) category = rules.negativeWords.find((word) => text.includes(word)) || '负面体验';
  else if (competitor) category = `竞品提及·${competitor}`;
  else if (isQuestion) category = '购买/产品问询';
  else if (text.includes('长肉') || text.includes('长个')) category = '长肉/生长曲线';
  else if (text.includes('吸收') || text.includes('便便')) category = '吸收/消化';
  else if (text.includes('转奶') || text.includes('适应')) category = '转奶/适应';
  else if (text.includes('抵抗') || text.includes('体质')) category = '抵抗力/体质';

  let action = '保留观察';
  if (isNegative || isSelling || onlyEmoji || irrelevant || (competitor && rules.deleteCompetitorMentions !== false)) action = '需删除';
  else if (isQuestion) action = '需达人回复';

  return { sentiment, category, action, hasBrand, competitor, isQuestion, isNegative, isPositive, irrelevant, onlyEmoji, isSelling };
}
