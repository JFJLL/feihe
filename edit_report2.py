import io
def edit(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert t.count(old) == 1, path + " :: MISS " + old[:70]
        t = t.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok", path.rsplit("/", 1)[-1])
root = r"D:/download/pic-vec/feihe/feihe-mvp"
edit(root + "/lib/report-agent.ts", [
    ("<p class=\"muted\">需求：${escapeHtml(spec.query||'常规复盘')} · 周期 ${spec.period.start} — ${spec.period.end}</p>",
     "<p class=\"muted\">${escapeHtml(spec.subtitle)}</p><p class=\"muted\">需求：${escapeHtml(spec.query||'常规复盘')} · 周期 ${spec.period.start} — ${spec.period.end}</p>"),
    ("\n  .qa{display:flex;gap:10px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin:0 0 18px}\n  .qa b{color:#1d4ed8;font-size:13px;white-space:nowrap}\n  .qa p{margin:0;color:#1e3a8a;font-size:14px;line-height:1.7}", ""),
])
edit(root + "/lib/review-report.ts", [
    ("    产品提及率: Math.round(n.mentionRate * 100) + '%',",
     "    产品提及率: Math.round(n.mentionRate * 100) + '%',\n    执行表数: n.sheets.length,"),
    ("data: result.reportable.slice(0, 30).map(toRow),", "data: result.reportable.slice(0, 50).map(toRow),"),
    ("data: result.basic.slice(0, 30).map(toRow),", "data: result.basic.slice(0, 50).map(toRow),"),
    ("description: result.dateKey + ' 按供应商执行数据判定，仅符合项进入汇报。',",
     "description: result.dateKey + ' 累计判定 ' + result.noteCount + ' 篇，可汇报 ' + result.counts.reportable + ' 篇，仅符合项进入汇报。',"),
    ("description: '符合30条基础要求，可正常结算与沉淀。',",
     "description: '累计正向30条以上共 ' + result.counts.basic + ' 篇，可正常结算与沉淀（仅展示前50）。',"),
])
print("tweaks done")
