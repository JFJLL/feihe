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
    ("summary:string[];", "query?:string; summary:string[];"),
    ("export const reportHtml=(spec:ReportSpec)=>",
     "const fmtTime=(iso:string)=>{try{return new Date(iso).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'})+' Beijing'}catch{return iso}};\nexport const reportHtml=(spec:ReportSpec)=>"),
    ("<p class=\"muted\">${escapeHtml(spec.subtitle)} · ${spec.period.start} — ${spec.period.end} · 生成引擎: ${escapeHtml(spec.engine)}</p>",
     "<p class=\"muted\">需求：${escapeHtml(spec.query||'常规复盘')} · 周期 ${spec.period.start} — ${spec.period.end}</p><p class=\"muted\">生成时间：${escapeHtml(fmtTime(spec.generatedAt))} · 生成引擎：${escapeHtml(spec.engine)}</p>"),
    (".pill.blue{background:rgba(59,130,246,0.15);color:#93c5fd}",
     ".pill.blue{background:rgba(59,130,246,0.15);color:#93c5fd}\n  .table-scroll{max-height:440px;overflow:auto;border:1px solid #eef2f7;border-radius:10px}\n  .table-scroll thead th{position:sticky;top:0;z-index:1}\n  .qa{display:flex;gap:10px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin:0 0 18px}\n  .qa b{color:#1d4ed8;font-size:13px;white-space:nowrap}\n  .qa p{margin:0;color:#1e3a8a;font-size:14px;line-height:1.7}"),
    ("<div style=\"overflow-x:auto;\">", "<div class=\"table-scroll\">"),
])
print("report-agent done")
