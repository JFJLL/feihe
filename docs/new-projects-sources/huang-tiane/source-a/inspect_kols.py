import json, csv, io, re, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open('docs/new-projects-sources/huang-tiane/source-a/raw/wb1_kol_execution_GIQjnY.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d['annotated_csv'], flags=re.DOTALL)
rows = [next(csv.reader(io.StringIO(b[1].strip()))) for b in blocks[1:]]

for i, r in enumerate(rows):
    name = r[1]
    level = r[2]
    status = r[21]
    dagang = r[17]
    jiaoben = r[18]
    chugao = r[19]
    plan_date = r[20]
    actual_date = r[23]
    sucai = r[30] if len(r) > 30 else ""
    price16 = r[16]
    print(f"{i+1:02d} | {name:<12} | {level:<10} | {status:<8} | 脚本:{jiaoben:<6} | 初稿:{chugao:<6} | 预发:{plan_date:<10} | 实发:{actual_date:<10} | 素材:{sucai}")
