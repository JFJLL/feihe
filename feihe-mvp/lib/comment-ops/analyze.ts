import type { CommentJudgment, ConversationComment, Sentiment } from './types';
export const CONTEXT_RULE_VERSION = 'conversation-context-v3-clarification';
const topics: Record<string, RegExp> = {
  '消化与适应': /胀气|便秘|便便|腹泻|拉肚子|吐奶|转奶|吸收|适应/,
  '生长与体质': /长肉|生长|体重|抵抗力|体质/,
  '口感与冲调': /口感|腥|味道|爱喝|难喝|结块|溶解/,
  '购买与服务': /价格|太贵|怎么买|哪里买|发货|客服|假货|核销/,
  '产品与配方': /配方|成分|段数|几段|过敏|乳糖/,
};
const negative = /胀气|便秘|腹泻|拉肚子|吐奶|过敏|难喝|结块|假货|不好|踩雷|后悔|太贵|不吸收|不长肉/;
const positive = /改善|好了|好转|不再|没有(?:胀气|便秘|吐奶|过敏)|不(?:胀气|便秘|吐奶)|好吸收|爱喝|适应了|便便正常|长肉|放心/;
const question = /[?？]|吗|有没有|怎么办|适合|怎么选|能不能/;
const historical = /以前|之前|原来|曾经|原先/;
const switchedTo = /换(?:了|成|到|用)?|转(?:了|成|到)?|喝(?:了|上)?|吃(?:了|上)?/;
const stopped = /停(?:了|用|掉)?|不喝(?:了)?|换掉/;
function polarity(text:string) {
  let positive=false,negative=false,negatedPositive=false,negatedProblem=false;
  const prefix=(index:number)=>text.slice(0,index).split(/[，,。；;!?？!\n]/).at(-1)!.slice(-10);
  for(const match of text.matchAll(/改善|好了|好转|好吸收|爱喝|适应了|便便正常|长肉|放心/g)) {
    if(/(?:没有|没|未见|未|不(?:觉得|怎么|太)?|并非|谈不上)[^，,。；;！？?\n]{0,6}$/.test(prefix(match.index!))){negative=true;negatedPositive=true;}else positive=true;
  }
  for(const match of text.matchAll(/胀气|便秘|腹泻|拉肚子|吐奶|过敏|难喝|结块|假货|不好|踩雷|后悔|太贵|不吸收|不长肉/g)) {
    if(/(?:没有|没|不再|不会|不怎么|不)[^，,。；;！？?\n]{0,3}$/.test(prefix(match.index!))){positive=true;negatedProblem=true;}else negative=true;
  }
  return {positive,negative,negatedPositive,negatedProblem};
}
function mentions(text: string, names: string[]) { return names.filter(x => x && text.toLocaleLowerCase().includes(x.toLocaleLowerCase())); }
export function analyzeConversation(comments: ConversationComment[], context: { title: string; content: string; brands: string[]; competitors: string[]; confidenceThreshold?: number }): CommentJudgment[] {
  const byId = new Map(comments.map(c => [c.id, c]));
  const names = [...new Set([...context.brands, ...context.competitors])];
  return comments.map(comment => {
    const text = comment.content.trim(), parent = comment.parentId ? byId.get(comment.parentId) : null;
    const explicit = mentions(text, names), parentTargets = parent ? mentions(parent.content, names) : [];
    const noteTargets = mentions(context.title + '\n' + context.content, names);
    const target = explicit.length === 1 ? explicit[0] : explicit.length > 1 ? explicit.join('、') : parentTargets.length === 1 ? parentTargets[0] : noteTargets.length === 1 ? noteTargets[0] : '提及对象未确定';
    let confidence = explicit.length === 1 ? 0.85 : 0.55;
    const reasons = [explicit.length ? '依据本条评论的明确提及对象' : parentTargets.length === 1 ? '对象参考主评论，仍需人工核对' : noteTargets.length === 1 ? '对象参考笔记语境，仍需人工核对' : '没有足够证据确定评价对象'];
    const evidence = [text]; if (parent) evidence.push('主评论：' + parent.content);
    const assertion=text.replace(/[“「『"]([^”」』"]+)[”」』"]/g,'');
    const hasQuotationWords = /有人说|别人说|朋友说|网友说|大家说|听说|据说|引用/.test(text);
    const quoted=assertion!==text || hasQuotationWords;
    const signs=polarity(assertion);
    let sentiment: Sentiment = signs.negative && signs.positive ? 'mixed':signs.negative ? 'negative':signs.positive ? 'positive':question.test(text) ? 'question':'neutral';
    if(signs.negatedPositive)reasons.push('否定作用于改善/好转等正面谓词，不能按正面关键词放行');
    if(signs.negatedProblem)reasons.push('症状前存在否定，不能仅因症状词判为负向');
    // A question does not establish that a claimed effect or adverse experience happened.
    if (question.test(text) && !/(?:我(?:家|的|宝宝)|宝宝).*?(?:喝了|换了|用了|一直|还是|仍然|出现|没有改善)/.test(assertion)) { sentiment = 'question'; reasons.push('问询不作为已发生的体验结论'); }
    const clauses = assertion.split(/[，,。！!；;]|但是|不过|但|现在/).map(s => s.trim()).filter(Boolean);
    const ownExplicit = mentions(text, context.brands);
    const last = clauses.at(-1) || text;
    const positiveAfter = clauses.findIndex(s => switchedTo.test(s) && mentions(s, context.brands).length > 0 && polarity(s).positive && !polarity(s).negative && !/还是|仍然|反而|又/.test(s));
    if (sentiment !== 'question' && positiveAfter > 0 && clauses.slice(0, positiveAfter).some(s => historical.test(s) && negative.test(s))) {
      sentiment = 'positive'; confidence = 0.9; reasons.push('前句属于既往问题，后句明确说明换用本品后的改善');
    } else if (sentiment !== 'question' && ownExplicit.length && mentions(last, context.competitors).length && switchedTo.test(last) && positive.test(last) && negative.test(text)) {
      sentiment = 'mixed'; confidence = 0.6; reasons.push('不同产品的前后体验，必须按对象人工拆分');
    } else if (sentiment !== 'question' && signs.negative && signs.positive) {
      if (!signs.negatedPositive && /不再|没有(?:胀气|便秘|吐奶|过敏)|不(?:胀气|便秘|吐奶)/.test(last) && !/还是|仍然|但是.*(?:胀气|便秘)|太贵/.test(last) && explicit.length === 1) { sentiment = 'positive'; reasons.push('评价中明确否定了症状的持续存在'); }
      else { sentiment = 'mixed'; confidence = 0.6; reasons.push('存在转折或正负混合语句，需人工确认'); }
    }
        // 停用本品后的变化判定（如：医生让停了启萃，后面便便才正常 / 停了启萃之后就改善了）
    const stopMatch = stopped.test(assertion) && mentions(assertion, context.brands).length > 0;
    if (stopMatch && /(?:后面|才|后来|换了|之后|就).*?(?:正常|好|改善|没事)/.test(assertion)) {
      confidence = Math.min(confidence, 0.55);
      sentiment = 'uncertain';
      reasons.push('停用本品后发生变化，不草率断言医学因果，转人工审阅');
    }

    // 转述/引述后的自身澄清或转折（如：有人说启萃胀气，我家没有）
    if (hasQuotationWords && /(?:我家|我|宝宝).*?(?:没有|不|没|挺好|很好|没事|正常)/.test(assertion)) {
      confidence = Math.min(confidence, 0.55);
      sentiment = 'uncertain';
      reasons.push('转述他人评价并由当前用户澄清/反驳，需人工复核实际体验归属');
    } else if (quoted) {
      confidence = Math.min(confidence, 0.55);
      if (!assertion.trim() || (hasQuotationWords && !/我(?:家|的|宝宝).*?(?:喝了|换了|用了|还是|没有|没)/.test(assertion))) {
        sentiment = question.test(text) ? 'question' : 'uncertain';
      }
      reasons.push('包含引用或转述，不将他人经历当成当前用户已发生的体验');
    }
if (/不是不|呵呵|可真好|真是好/.test(text) && negative.test(text)) { confidence = 0.5; reasons.push('反讽或多重否定需要人工判断'); }
    if(/不是没有|并非没有|没有不|不能说没有|不是不/.test(text)){confidence=Math.min(confidence,0.5);sentiment='uncertain';reasons.push('多重否定的范围不能可靠确定，进入人工复核');}
    
    if (explicit.length > 1) { confidence = Math.min(confidence, 0.6); reasons.push('同一评论提及多个品牌，不能将情绪统一归给本品'); }
    if (parent && parentTargets.length > 1 && !explicit.length) {
      confidence = Math.min(confidence, 0.5);
      reasons.push('主评论提及多个品牌，回复的省略指代需人工确认评价对象');
    } else if (parent && /对|是的|不是|之前|现在|已经|没了|我家也是/.test(text) && !explicit.length) {
      confidence = Math.min(confidence, 0.6);
      reasons.push('回复依赖前文的指代与时间，需连同对话核对');
    }
    if (!text) { sentiment = 'uncertain'; confidence = 0; reasons.push('评论正文缺失'); }
    return { commentId: comment.id, target, sentiment, topics: Object.entries(topics).filter(([,pattern]) => pattern.test(text + (parent?.content || ''))).map(([name]) => name), confidence, needsReview: confidence < (context.confidenceThreshold ?? 0.75), reasons, evidence };
  });
}
