import io
root = r"D:/download/pic-vec/feihe/feihe-mvp"
def edit(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert t.count(old) == 1, path + " :: MISS " + old[:70]
        t = t.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok", path.rsplit("/", 1)[-1])
edit(root + "/features/comments/CommentsWorkspace.tsx", [
    ("import { RiskTriage } from './RiskTriage';",
     "import { RiskTriage } from './RiskTriage';\nimport { ReviewActionQueue } from './ReviewActionQueue';"),
    ("useProjectTab('acceptance', ['acceptance', 'supplier', 'risk'])",
     "useProjectTab('acceptance', ['acceptance', 'supplier', 'risk', 'review'])"),
    ("['risk', '风险处置', '关键评论、回复与删除闭环'],",
     "['risk', '风险处置', '关键评论、回复与删除闭环'],\n    ['review', '判定处置', '需回复/删除/补充队列'],"),
    ("{tab === 'risk' && (",
     "{tab === 'review' && <ReviewActionQueue projectId={projectId} />}\n\n      {tab === 'risk' && ("),
])
css = io.open(root + "/styles/project-shell.css", encoding="utf-8").read()
add = "\n.queue-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}\n.queue-card{border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:14px;display:flex;flex-direction:column;min-width:0}\n.queue-card header strong{font-size:15px}\n.queue-card header small{display:block;color:#64748b;margin:2px 0 10px}\n.queue-list{max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px}\n.queue-row{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;border:1px solid #eef2f7;border-radius:10px;padding:10px 12px}\n.queue-main b{font-size:13px;margin-right:8px}\n.queue-main span{font-size:12px;color:#b45309}\n.queue-main p{margin:6px 0;font-size:12px;color:#334155;line-height:1.6}\n.queue-main small{color:#94a3b8;font-size:11px}\n@media(max-width:1100px){.queue-grid{grid-template-columns:1fr}}\n"
if ".queue-grid" not in css:
    io.open(root + "/styles/project-shell.css", "w", encoding="utf-8", newline="").write(css + add)
    print("css appended")
else:
    print("css already")
print("workspace done")
