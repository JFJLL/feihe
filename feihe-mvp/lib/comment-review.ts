export type SeedSample = { t: string; f: string; r: string; b: string; p: string };
export type SeedNote = { link: string; blogger: string; sheets: string[]; count: number; forms: Record<string, number>; samples: SeedSample[] };
export type NoteClass = 'reportable' | 'basic' | 'needReply' | 'needDelete' | 'needSupplement';
export type ClassifiedNote = {
  link: string; blogger: string; sheets: string[]; total: number; positive: number;
  mentionRate: number; classes: NoteClass[]; supplementNeed: number;
  deleteHits: string[]; replyHits: string[]; samples: SeedSample[];
};
export type ReviewResult = {
  dateKey: string; sheets: Array<{ name: string; kind: string; rows: number; notes: number }>;
  noteCount: number; rowCount: number;
  reportable: ClassifiedNote[]; basic: ClassifiedNote[]; needReply: ClassifiedNote[];
  needDelete: ClassifiedNote[]; needSupplement: ClassifiedNote[];
  counts: { reportable: number; basic: number; needReply: number; needDelete: number; needSupplement: number };
};
const MENTION_RE = /启萃|飞鹤|星阶|蕴萃|奶粉|奶罐|生牛乳|小分子|母乳低聚糖|HMOs|乳铁蛋白/;
const QUESTION_RE = /\?|？|吗|怎么|如何|为什么|为啥|求问|请问|可以吗|行不行|靠谱吗|哪个好|怎么选|喝过吗|有人|求推荐|咨询|客服/;
const DELETE_NEG = /拉肚|腹泻|便秘|上火|过敏|呕吐|胀气|不吸收|难喝|腥味重|结块|有异物|投诉|维权|退货|退款|差评|避雷|踩雷|千万别|垃圾|难吃|倒闭|过期/;
const DELETE_SPAM = /加微信|加V|微信号|vx|VX|QQ|拼单|转让|出售|出掉|闲置|代购|招代理|加盟|兼职|刷单|点赞互|互关|抽奖|领红包|点击链接|下单返/;
const COMPETITOR = /爱他美|诺优能|合生元|派星|金领冠|伊利|美赞臣|蓝臻|惠氏|雀巢|能恩|美素|皇家|a2|A2|君乐宝|完达山|贝因美/;
const RELEVANT_RE = /奶粉|宝宝|娃|母乳|转奶|断奶|肠胃|吸收|便便|奶量|冲奶|奶瓶|月龄|启萃|飞鹤|育儿|辅食|营养|DHA|益生菌/;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
function isDeleteText(t: string): string | null {
  if (!t || t.length < 2) return '空评论';
  if (DELETE_NEG.test(t)) return '负面舆情';
  if (DELETE_SPAM.test(t)) return '导流售卖';
  if (COMPETITOR.test(t) && /不好|差|贵|不如|别买|坑/.test(t)) return '竞品拉踩';
  const noEmoji = t.replace(EMOJI_RE, '').trim();
  if (noEmoji.length < 4) return '纯表情无信息';
  if (t.length < 30 && !RELEVANT_RE.test(t)) return '不相关内容';
  return null;
}
export function parseDateKey(prompt: string): string | null {
  const m1 = prompt.match(/(\d{1,2})\s*月\s*(\d{1,2})/);
  if (m1) return pad(m1[1]) + '-' + pad(m1[2]);
  const m2 = prompt.match(/(?:20\d{2}[年\-/.])?(\d{1,2})[.\-ß/](\d{1,2})/);
  if (m2) {
    const a = Number(m2[1]);
    const b = Number(m2[2]);
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) return pad(m2[1]) + '-' + pad(m2[2]);
  }
  return null;
}
function pad(s: string): string {
  return String(Number(s)).padStart(2, '0');
}
export function classifyNotes(dateKey: string, notes: SeedNote[]): ReviewResult {
  const reportable: ClassifiedNote[] = [];
  const basic: ClassifiedNote[] = [];
  const needReply: ClassifiedNote[] = [];
  const needDelete: ClassifiedNote[] = [];
  const needSupplement: ClassifiedNote[] = [];
  for (const n of notes) {
    const samples = n.samples || [];
    let del = 0;
    let reply = 0;
    let mention = 0;
    const deleteHits: string[] = [];
    const replyHits: string[] = [];
    for (const s of samples) {
      const reason = isDeleteText(s.t);
      if (reason) {
        del += 1;
        if (deleteHits.length < 3) deleteHits.push(reason + ':' + s.t.slice(0, 40));
      }
      if (QUESTION_RE.test(s.t)) {
        reply += 1;
        if (replyHits.length < 3) replyHits.push(s.t.slice(0, 40));
      }
      if (MENTION_RE.test(s.t)) mention += 1;
    }
    const k = samples.length || 1;
    const positive = Math.max(0, Math.round(n.count * (1 - del / k)));
    const mentionRate = Math.round((mention / k) * 100) / 100;
    const c: ClassifiedNote = {
      link: n.link, blogger: n.blogger, sheets: n.sheets, total: n.count,
      positive, mentionRate, classes: [], supplementNeed: 0,
      deleteHits, replyHits, samples: samples.slice(0, 4),
    };
    if (positive >= 200 && mentionRate >= 0.4) c.classes.push('reportable');
    else if (positive >= 30) c.classes.push('basic');
    else {
      c.classes.push('needSupplement');
      c.supplementNeed = 30 - positive;
    }
    if (reply > 0) c.classes.push('needReply');
    if (del > 0) c.classes.push('needDelete');
    if (c.classes.includes('reportable')) reportable.push(c);
    if (c.classes.includes('basic')) basic.push(c);
    if (c.classes.includes('needReply')) needReply.push(c);
    if (c.classes.includes('needDelete')) needDelete.push(c);
    if (c.classes.includes('needSupplement')) needSupplement.push(c);
  }
  const byPositive = (a: ClassifiedNote, b: ClassifiedNote) => b.positive - a.positive;
  reportable.sort(byPositive);
  basic.sort(byPositive);
  needSupplement.sort((a, b) => b.supplementNeed - a.supplementNeed);
  return {
    dateKey, sheets: [], noteCount: notes.length,
    rowCount: notes.reduce((s, n) => s + n.count, 0),
    reportable, basic, needReply, needDelete, needSupplement,
    counts: { reportable: reportable.length, basic: basic.length, needReply: needReply.length, needDelete: needDelete.length, needSupplement: needSupplement.length },
  };
}
