import io
def edit(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert t.count(old) == 1, path + " :: MISS " + old[:70]
        t = t.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok", path.rsplit("/", 1)[-1])
root = r"D:/download/pic-vec/feihe/feihe-mvp"
edit(root + "/app/api/agent/route.ts", [
    ("import { ensureReviewTables, persistReviewBatch, reviewSections, reviewSummary } from '@/lib/review-report';",
     "import { buildReviewInsight, ensureReviewTables, persistReviewBatch, reviewSections, reviewSummary } from '@/lib/review-report';"),
    ("      const spec: ReportSpec = {\n        version: '1.0',",
     "      const spec: ReportSpec = {\n        version: '1.0',\n        query: prompt,"),
    ("            spec.sections.unshift(...reviewSections(reviewResult));",
     "            spec.sections.unshift(...reviewSections(reviewResult));\n            const insightLines = await aiReviewInsight(prompt, reviewResult);\n            spec.sections.splice(2, 0, { id: 'review_insight', eyebrow: '模型解读', title: '本期判定解读与下一步', kind: 'insights', data: insightLines.map((text) => ({ text })) });"),
    ("export async function POST(request: Request) {",
     "async function aiReviewInsight(prompt: string, result: { counts: Record<string, number>; dateKey: string; noteCount: number; reportable: Array<{ blogger: string; positive: number; mentionRate: number }>; basic: Array<{ blogger: string; positive: number; mentionRate: number }>; needSupplement: Array<{ blogger: string; positive: number; supplementNeed: number }>; needReply: Array<{ blogger: string; replyHits: string[] }>; needDelete: Array<{ blogger: string; deleteHits: string[] }> }): Promise<string[]> {\n" +
     "  const fallback = buildReviewInsight(result as never);\n" +
     "  try {\n" +
     "    const r = runtime();\n" +
     "    const key = r.KEYSTONE_API_KEY || process.env.KEYSTONE_API_KEY;\n" +
     "    const model = r.KEYSTONE_MODEL || process.env.KEYSTONE_MODEL;\n" +
     "    const rawBase = r.KEYSTONE_BASE_URL || process.env.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1';\n" +
     "    if (!key || !model) return fallback;\n" +
     "    const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;\n" +
     "    const top = (list: Array<Record<string, unknown>>) => list.slice(0, 8);\n" +
     "    const response = await fetch(base + '/chat/completions', {\n" +
     "      method: 'POST',\n" +
     "      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },\n" +
     "      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 700, response_format: { type: 'json_object' }, messages: [\n" +
     "        { role: 'system', content: '你是母婴社媒评论验收顾问。只返回 JSON：{\"insights\":[不超过7条简洁中文]}。基于给定判定数据给出结论、补量优先级与处置建议，不得编造数据中没有的笔记或数字。' },\n" +
     "        { role: 'user', content: JSON.stringify({ request: prompt, date: result.dateKey, counts: result.counts, reportable: top(result.reportable as never), basic: top(result.basic as never), supplementGap: top(result.needSupplement as never), replySample: top(result.needReply as never), deleteSample: top(result.needDelete as never) }) }] }) });\n" +
     "    if (!response.ok) return fallback;\n" +
     "    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };\n" +
     "    const content = payload.choices?.[0]?.message?.content;\n" +
     "    if (!content) return fallback;\n" +
     "    const parsed = JSON.parse(content) as { insights?: unknown };\n" +
     "    return Array.isArray(parsed.insights) && parsed.insights.length ? parsed.insights.map(String).slice(0, 7) : fallback;\n" +
     "  } catch { return fallback; }\n" +
     "}\n" +
     "export async function POST(request: Request) {"),
])
print("agent insight done")
