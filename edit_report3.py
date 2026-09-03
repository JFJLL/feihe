import io
def edit(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert t.count(old) == 1, path + " :: MISS " + old[:70]
        t = t.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok", path.rsplit("/", 1)[-1])
root = r"D:/download/pic-vec/feihe/feihe-mvp"
edit(root + "/lib/review-report.ts", [
    ("export function reviewSummary(",
     "export function buildReviewInsight(result: ReviewResult): string[] {\n" +
     "  const lines: string[] = [];\n" +
     "  lines.push('结论：' + result.dateKey + '累计' + result.noteCount + '篇中，可汇报' + result.counts.reportable + '篇、达基础线' + result.counts.basic + '篇；其余' + result.counts.needSupplement + '篇正向不足30条需补量。');\n" +
     "  const quick = [...result.needSupplement].sort((a, b) => a.supplementNeed - b.supplementNeed).filter((n) => n.supplementNeed <= 10).slice(0, 3);\n" +
     "  if (quick.length) lines.push('补量优先（还差10条以内）：' + quick.map((n) => (n.blogger || '未知博主') + '（正向' + n.positive + '条，还差' + n.supplementNeed + '条）').join('；') + '。');\n" +
     "  const weak = [...result.basic, ...result.reportable].filter((n) => n.mentionRate < 0.4).sort((a, b) => b.positive - a.positive).slice(0, 3);\n" +
     "  if (weak.length) lines.push('提及率短板：' + weak.map((n) => (n.blogger || '未知博主') + '（正向' + n.positive + '条，提及率' + Math.round(n.mentionRate * 100) + '%）').join('；') + '，建议补产品盖楼话术顶上前三屏。');\n" +
     "  if (result.needReply.length) { const t = result.needReply.slice(0, 2); lines.push('待回复' + result.counts.needReply + '篇，如' + t.map((n) => (n.blogger || '未知博主') + '\"' + (n.replyHits[0] || '').slice(0, 24) + '...\"').join('；') + '，需达人24小时内回。'); }\n" +
     "  if (result.needDelete.length) { const t = result.needDelete.slice(0, 2); lines.push('待删除' + result.counts.needDelete + '篇，如' + t.map((n) => (n.blogger || '未知博主') + '（' + (n.deleteHits[0] || '').slice(0, 20) + '...）').join('；') + '，已入处置队列。'); }\n" +
     "  return lines;\n" +
     "}\n" +
     "export function reviewSummary("),
])
print("insight fallback done")
