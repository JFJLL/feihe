with open('docs/new-projects-sources/deep-audit-meiling/step6_rebuild_verified_facts.py', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = '"channel_roi": round(clean_num(rows_4sgaof[15][9]) / clean_num(rows_4sgaof[21][7]), 2),'
target2 = '"channel_roi": round(clean_num(rows_4sgaof[26][9]) / clean_num(rows_4sgaof[31][7]), 2),'
target3 = '"channel_roi": round(1994188.69 / 415238.18, 2),'

assert target1 in text, "target1 not found"
assert target2 in text, "target2 not found"
assert target3 in text, "target3 not found"

text = text.replace(target1, '"channel_roi": None,')
text = text.replace(target2, '"channel_roi": None,')
text = text.replace(target3, '"channel_roi": None,')

with open('docs/new-projects-sources/deep-audit-meiling/step6_rebuild_verified_facts.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully patched step6_rebuild_verified_facts.py")
