import io
root = r"D:/download/pic-vec/feihe/feihe-mvp"
def edit(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert t.count(old) == 1, path + " :: MISS " + old[:70]
        t = t.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok", path.rsplit("/", 1)[-1])
edit(root + "/app/api/review/route.ts", [
    ("  const batchId = await persistReviewBatch(d1, project, result);\n  return Response.json({ ok: true, batchId, ...result, samples: undefined });",
     "  const batchId = await persistReviewBatch(d1, project, result);\n" +
     "  if (url.searchParams.get('items') === '1') {\n" +
     "    const itemRows = await d1.prepare('SELECT id,link,blogger,action,reason,sample_json AS sampleJson,status FROM review_action_items WHERE batch_id=? ORDER BY id LIMIT 500').bind(batchId).all<{ id: number; link: string; blogger: string; action: string; reason: string; sampleJson: string; status: string }>();\n" +
     "    const items = (itemRows.results || []).map((it) => { let sample: string[] = []; try { const arr = JSON.parse(it.sampleJson || '[]'); if (Array.isArray(arr)) sample = arr.map((s) => String((s as { t?: string }).t || '')).filter(Boolean).slice(0, 2); } catch {} return { id: it.id, link: it.link, blogger: it.blogger, action: it.action, reason: it.reason, sample, status: it.status }; });\n" +
     "    return Response.json({ ok: true, batchId, dateKey: result.dateKey, counts: result.counts, items });\n" +
     "  }\n" +
     "  return Response.json({ ok: true, batchId, ...result, samples: undefined });"),
    ("export const dynamic = 'force-dynamic';",
     "export const dynamic = 'force-dynamic';\n" +
     "export async function POST(request: Request) {\n" +
     "  if (!(await apiUser())) return jsonError('请先登录', 401);\n" +
     "  try {\n" +
     "    const body = await request.json() as { action?: string; id?: number; projectId?: string };\n" +
     "    if (body.action !== 'resolve' || !body.id) return jsonError('参数错误', 400);\n" +
     "    const project = projectId(body.projectId);\n" +
     "    const d1 = db();\n" +
     "    await ensureReviewTables(d1);\n" +
     "    await d1.prepare('UPDATE review_action_items SET status=' + chr(39)*0 + \"'已处理'\" + ' WHERE id=? AND project_id=?').bind(body.id, project).run();\n" +
     "    return Response.json({ ok: true });\n" +
     "  } catch (e) { return jsonError(e instanceof Error ? e.message : '更新失败', 500); }\n" +
     "}"),
])
print("api done")
