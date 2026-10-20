# -*- coding: utf-8 -*-
"""
build_overview_mining.py
Extracts deep insights for Kailas project from raw JSON cache & biweekly docx,
and safely enriches feihe-mvp/lib/campaign-enrichment/kailas.json.
"""

import csv
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path('docs/new-projects-sources/deep-audit-kailas')
RAW_DIR = ROOT / 'raw-full'
TARGET_JSON = Path('feihe-mvp/lib/campaign-enrichment/kailas.json')

def clean_num(v):
    if v is None:
        return None
    s = str(v).replace('¥', '').replace('￥', '').replace(',', '').replace('%', '').strip()
    if not s or s in ('-', '/', 'None', '#N/A', '#REF!', '#DIV/0!', 'null'):
        return None
    try:
        return float(s)
    except:
        return None

def safe_ratio(num, den, round_digits=2):
    if num is None or den is None or den == 0:
        return None
    try:
        val = num / den
        return round(val, round_digits) if round_digits is not None else val
    except:
        return None

def safe_pct(num, den, round_digits=2):
    r = safe_ratio(num, den, None)
    return round(r * 100, round_digits) if r is not None else None

def load_csv(sheet_id):
    p = RAW_DIR / f'{sheet_id}.json'
    if not p.exists():
        return []
    d = json.loads(p.read_text(encoding='utf-8'))
    data = d.get('data', d)
    csv_text = data.get('annotated_csv') or data.get('csv') or ''
    cleaned = re.sub(r'^\[row=\d+\] ?', '', csv_text, flags=re.M)
    return list(csv.reader(io.StringIO(cleaned)))

print('Loading raw datasets...')
rows_4pg = load_csv('4PGzjP')

# 1. kailas-potential-notes-boost (9 selected potential boost notes from hGgSvt / c4qXS1)
potential_notes_rows = [
    {
        'noteId': '6ab3bef300000000140010c0',
        'kolName': '阿蛋黄靖',
        'fsSpend': 13104.79,
        'fsKLeverage': 0.16,
        'ctr': 12.11,
        'cpc': 1.56,
        'cpe': 2.49,
        'recommendation': '高点击率(12.11%)与超低CPE(¥2.49)，投流杠杆仅0.16x，待加大预算放量'
    },
    {
        'noteId': '6a954afa000000000400b74f',
        'kolName': '邝美心',
        'fsSpend': 2352.59,
        'fsKLeverage': 0.14,
        'ctr': 9.24,
        'cpc': 0.57,
        'cpe': 28.34,
        'recommendation': '低CPC(¥0.57)，K端达人采买16500元，FS仅投2352元(0.14x)，严重低投待加推'
    },
    {
        'noteId': '6a82fa6a0000000005028b3f',
        'kolName': '-张琼之-',
        'fsSpend': 3926.32,
        'fsKLeverage': 0.16,
        'ctr': 7.96,
        'cpc': 0.85,
        'cpe': 20.77,
        'recommendation': 'K端采买25000元腰部达人，FS投流仅3926元(0.16x)，建议追投优质素材'
    },
    {
        'noteId': '6a8c2d440000000033009a96',
        'kolName': '张明敏',
        'fsSpend': 2125.34,
        'fsKLeverage': 0.15,
        'ctr': 8.75,
        'cpc': 0.65,
        'cpe': 23.61,
        'recommendation': '高CTR(8.75%)低CPC(¥0.65)，K端14000元，FS端2125元(0.15x)，加推空间大'
    },
    {
        'noteId': '6abb7dfc000000001500dfc7',
        'kolName': '番茄西红柿🍅',
        'fsSpend': 435.39,
        'fsKLeverage': 0.12,
        'ctr': 9.83,
        'cpc': 0.71,
        'cpe': 5.44,
        'recommendation': '高CTR(9.83%)且超低CPE(¥5.44)，目前消耗仅435元，典型高潜潜力爆文'
    },
    {
        'noteId': '6ac8b4a9000000000100ab9e',
        'kolName': '胡阿浩haoa',
        'fsSpend': 519.42,
        'fsKLeverage': 0.08,
        'ctr': 8.87,
        'cpc': 0.79,
        'cpe': 4.56,
        'recommendation': '超低CPE(¥4.56)与优质CTR(8.87%)，FS消耗仅519元(0.08x)，极具加推性价比'
    },
    {
        'noteId': '6ac8d5c0000000000a023fd9',
        'kolName': '十点准时睡觉',
        'fsSpend': 206.35,
        'fsKLeverage': 0.17,
        'ctr': 5.86,
        'cpc': 1.02,
        'cpe': 6.07,
        'recommendation': '低CPE(¥6.07)，早期消耗过低仅206元，建议结合人群包定向进行加推'
    },
    {
        'noteId': '6ac9ffab000000001a032490',
        'kolName': 'O644_',
        'fsSpend': 290.05,
        'fsKLeverage': 0.03,
        'ctr': 5.73,
        'cpc': 1.84,
        'cpe': 8.53,
        'recommendation': '杠杆倍数仅0.03x，测试阶段互动成本良好(CPE ¥8.53)，可小额提量'
    },
    {
        'noteId': '6aca01e4000000001c02f76a',
        'kolName': '是Niggi',
        'fsSpend': 164.56,
        'fsKLeverage': 0.06,
        'ctr': 5.24,
        'cpc': 1.34,
        'cpe': 9.14,
        'recommendation': '杠杆倍数仅0.06x，CPE控制在¥9.14，可作为长尾素材补充放量'
    }
]

# 2. kailas-full-funnel-summary (全链路漏斗节点: 曝光 -> 点击 -> 互动 -> 小红星站外活跃UV)
full_funnel_rows = [
    {
        'stage': '展现曝光量 (Impressions)',
        'step': 1,
        'totalValue': 21606184,
        'organicValue': 4020618,
        'paidValue': 17585566,
        'unit': '次',
        'conversionRate': 100.0,
        'rateLabel': '基准曝光量',
        'costPerUnit': 59.61,
        'costLabel': '全域CPM ¥59.61 (投流CPM ¥43.77)',
        'description': '黑山Q3全周期自然内容与商业投流全域曝光总量'
    },
    {
        'stage': '阅读点击量 (Clicks)',
        'step': 2,
        'totalValue': 2188140,
        'organicValue': 436679,
        'paidValue': 1751461,
        'unit': '次',
        'conversionRate': 10.13,
        'rateLabel': '整体CTR 10.13% (投流9.96% / 自然10.86%)',
        'costPerUnit': 0.59,
        'costLabel': '综合CPC ¥0.59 (投流CPC ¥0.44)',
        'description': '进入笔记正文、图片精读与详情浏览的有效点击总量'
    },
    {
        'stage': '深度互动量 (Engagements)',
        'step': 3,
        'totalValue': 85372,
        'organicValue': 17254,
        'paidValue': 68118,
        'unit': '次',
        'conversionRate': 3.90,
        'rateLabel': '点击互动率 3.90% (自然3.95% / 投流3.89%)',
        'costPerUnit': 15.09,
        'costLabel': '综合CPE ¥15.09 (投流CPE ¥11.30)',
        'description': '赞、藏、评、转等高价值深度心智种草互动总量'
    },
    {
        'stage': '小红星站外活跃UV (External UV)',
        'step': 4,
        'totalValue': 10408,
        'organicValue': 0,
        'paidValue': 10408,
        'unit': 'UV',
        'conversionRate': 12.19,
        'rateLabel': '互动至站外活跃转化率 12.19%',
        'costPerUnit': 73.95,
        'costLabel': '小红星CPUV ¥73.95',
        'description': '联动京东/天猫小红星任务期进店与深度活跃UV外溢沉淀'
    }
]

# 3. kailas-biweekly-stage-evolution (Q3四个双周阶段演进)
biweekly_evolution_rows = [
    {
        'stage': '7.16 - 8.12 (首期启动测新)',
        'period': '2026-07-16 ~ 2026-08-12',
        'spend': 225075.01,
        'kSpend': 94363.50,
        'fsSpend': 130711.51,
        'ctr': 8.98,
        'cpc': 0.39,
        'cpe': 13.51,
        'cpuv': 43.27,
        'publishedNotes': 10,
        'viralNotes': 'Gyw (夏日穿搭 CPTi 9.02, CPUV 48.14), 恩予 (天池大片初探)',
        'strategyHighlights': '灵犀人群包测新，视频流高CTR初探，搜索站内外1:1预算测试'
    },
    {
        'stage': '8.1 - 8.26 (8月全月攻坚放量)',
        'period': '2026-08-01 ~ 2026-08-26',
        'spend': 305581.70,
        'kSpend': 232217.40,
        'fsSpend': 182635.00,
        'ctr': 9.16,
        'cpc': 0.40,
        'cpe': 15.80,
        'cpuv': 52.07,
        'publishedNotes': 24,
        'viralNotes': '恩予 (天池起飞 CTR 14.4%, CPC 0.23, CPE 9.97), 上海在穿啥 (FS:K 2.25x)',
        'strategyHighlights': 'ti计划对比Q2下降0.2元，七夕词上线测试，头部素材集中追投'
    },
    {
        'stage': '8.27 - 9.8 (前哨冲刺与放量)',
        'period': '2026-08-27 ~ 2026-09-08',
        'spend': 430385.54,
        'kSpend': 371620.40,
        'fsSpend': 457164.61,
        'ctr': 9.55,
        'cpc': 0.40,
        'cpe': 16.50,
        'cpuv': 59.44,
        'publishedNotes': 48,
        'viralNotes': 'KK (FS:K 4.29x), 没1月 (FS:K 4.18x), ONIONYOUNG (FS:K 3.26x)',
        'strategyHighlights': '辛芷蕾粉丝人群包加推，新潮运动派放量，外溢站外进店拉通'
    },
    {
        'stage': '9.9 - 9.27 (Q3决战与收官总结)',
        'period': '2026-09-09 ~ 2026-09-27',
        'spend': 326998.86,
        'kSpend': 518378.11,
        'fsSpend': 769666.00,
        'ctr': 10.00,
        'cpc': 0.44,
        'cpe': 11.30,
        'cpuv': 73.95,
        'publishedNotes': 59,
        'viralNotes': '全周期59篇达人笔记矩阵沉淀，站外活跃UV累计达10408',
        'strategyHighlights': '全周期达成总预算151.8万的84.85%(128.8万)，沉淀高杠杆爆款资产'
    }
]

# 4. kailas-tier-direction-matrix (4层级 x 8方向)
tier_dir_counts = defaultdict(lambda: defaultdict(lambda: {'count': 0, 'spend': 0.0}))
for r in rows_4pg[2:]:
    if len(r) > 28 and r[0].strip().isdigit():
        direction = r[15].strip() or '其他'
        tier = r[21].strip() or '其他'
        if tier == 'ugc': tier = 'UGC'
        fee_s = r[28].replace('¥', '').replace('￥', '').replace(',', '').strip()
        fee = float(fee_s) if fee_s and fee_s != '-' else 0.0
        tier_dir_counts[tier][direction]['count'] += 1
        tier_dir_counts[tier][direction]['spend'] += fee

matrix_rows = []
all_matrix_dirs = [
    '时尚穿搭',
    '暑期出行/夏日灵感穿搭',
    '街头采访/街拍大片',
    '产品开箱',
    '时尚跑者',
    'UGC晒鞋',
    '情侣穿搭/创意短片',
    '插画/穿搭'
]

for tier in ['头部', '腰部', '尾部', 'UGC']:
    for direction in all_matrix_dirs:
        cell = tier_dir_counts[tier][direction]
        matrix_rows.append({
            'tier': tier,
            'direction': direction,
            'noteCount': cell['count'],
            'spend': round(cell['spend'], 2) if cell['spend'] > 0 else 0.0,
            'avgSpend': safe_ratio(cell['spend'], cell['count']) if cell['count'] > 0 else 0.0
        })

# 5. kailas-audit-common-issues (达人审稿常见问题归纳)
audit_issues_rows = [
    {
        'category': '文案类规范',
        'issueCode': 'W-01',
        'issueTitle': '品类词禁用「越野跑」统一改「跑山」',
        'violationCount': '32 人 / 84 处',
        'severity': 'P0 (全项目最高频违规)',
        'examples': '「越野首战封神鞋」「香格里拉越野赛」「想要越野跑山」「沙漠越野跑」',
        'correctStandard': '统一替换：越野跑→跑山、越野鞋→跑山鞋、越野赛→跑山赛事、越野跑山→跑山 (标题/正文/口播/花字全适用)',
        'action': '脚本与大纲初审第一道卡点强制全文替换'
    },
    {
        'category': '文案类规范',
        'issueCode': 'W-02',
        'issueTitle': '正文品牌名误写「凯乐石」未用「FUGA」',
        'violationCount': '14 人 / 21 处',
        'severity': 'P1 (品牌资产规范)',
        'examples': '「辛芷蕾同款凯乐石」「凯乐石大坡王黑山」「凯乐石FUGA的黑山家族」',
        'correctStandard': '正文/标题/口播一律写「FUGA」；仅合作必带话题标签保留「#凯乐石FUGA」',
        'action': '正文禁止中英文并列，统一FUGA强化独立潮流跑山认知'
    },
    {
        'category': '拍摄类规范',
        'issueCode': 'P-01',
        'issueTitle': '袜型不符：堆堆袜 / 露踝过短',
        'violationCount': '9 人次',
        'severity': 'P1 (视觉质检重点)',
        'examples': '「袜子不要堆叠」「第一套第二套袜子过短」「堆堆袜改为纯黑中长袜」',
        'correctStandard': '统一中筒黑袜、忌堆堆袜，拉平过脚踝，禁止堆叠感；FITTING确认后不可随意更换',
        'action': '寄拍前向达人明确袜子标准样品与穿搭指南'
    },
    {
        'category': '拍摄类规范',
        'issueCode': 'P-02',
        'issueTitle': '穿搭不符：全裙装或长裤挡鞋',
        'violationCount': '9 人次',
        'severity': 'P1 (产品露出质检)',
        'examples': '「第三套换裤装吧，三套全是裙装？」「换黑衬衫，黑袜或者换蓝衬衫」',
        'correctStandard': '三套look需裙/裤搭配均衡；裤子不能太长挡鞋；时尚穿搭向至少1-2套非运动感look',
        'action': '上身前自查裤长与产品全貌展示'
    },
    {
        'category': '拍摄类规范',
        'issueCode': 'P-03',
        'issueTitle': '竞品Logo误入镜头 (始祖鸟/萨洛蒙/耐克等)',
        'violationCount': '8 人次',
        'severity': 'P0 (合规红线)',
        'examples': '「相关非fuga品牌后期需要ps掉」「眼镜oakley需P掉」「请勿上身竞品」',
        'correctStandard': 'Brief竞品清单内品牌严禁露出；视频类fitting前必须穿无竞品；图文类露出Logo后期必P',
        'action': '终审放大逐图逐秒排查服装、背包、眼镜Logo'
    },
    {
        'category': '拍摄类规范',
        'issueCode': 'P-04',
        'issueTitle': '坐姿过多 / 坐地面摆拍 / 拍鞋内侧',
        'violationCount': '7 人次',
        'severity': 'P1 (高级感要求)',
        'examples': '「减少坐着姿势，不接受坐地面图片」「不要刻意翘角」「多展示鞋外侧」',
        'correctStandard': '成片以站姿、奔跑、行走动态为主；展示鞋子外侧核心科技与侧颜，拒绝死板坐拍',
        'action': '动态拍摄突出MEGAGRIP大底与抓地线条'
    },
    {
        'category': '拍摄类规范',
        'issueCode': 'P-05',
        'issueTitle': '图片构图贴边 / 底部无留白',
        'violationCount': '7 人次',
        'severity': 'P2 (排版规范)',
        'examples': '「贴边，这张图能调整吗」「鞋子不要太靠近图片下方」「阔图裁剪下人在c位」',
        'correctStandard': '底部严格预留15%-20%留白，背景拓展须自然衔接纹理，不接受色块或模糊填充',
        'action': '成片预留App底部UI遮挡安全区'
    },
    {
        'category': '文案类规范',
        'issueCode': 'W-03',
        'issueTitle': '极限词违规与审美疲劳形容词滥用',
        'violationCount': '高频通病',
        'severity': 'P0 (平台合规风险)',
        'examples': '「拉满出现了两次」「机能感一句话出现五遍」「天花板」「顶级抓地」',
        'correctStandard': '严禁拉满、超绝、天花板、神器等绝对化词汇；改用客观表述（如抓地表现更稳、湿地止滑）',
        'action': '合规字典自动扫词，拦截极限词与连续词汇堆砌'
    }
]

# Load existing kailas.json
existing_data = json.loads(TARGET_JSON.read_text(encoding='utf-8'))
existing_tables = existing_data.get('tables', [])
print(f'Found {len(existing_tables)} existing tables in kailas.json')

# Build new table definitions
new_tables = [
    {
        'id': 'kailas-potential-notes-boost',
        'title': '需提升消耗的潜力笔记加推分析表 (9篇高潜)',
        'period': '2026-07-16 ~ 2026-10-12',
        'sourceId': 'src-kailas-sheets-hGgSvt',
        'note': '挖掘自需提升消耗笔记列表(hGgSvt)，精选具有高点击率(最高12.11%)与超低CPE(最低¥2.49)却严重低投(杠杆<0.2x)的高价值潜力笔记。',
        'category': 'performance',
        'provenance': 'feishu',
        'columns': [
            {'key': 'kolName', 'title': '达人昵称', 'type': 'string'},
            {'key': 'noteId', 'title': '笔记ID', 'type': 'string'},
            {'key': 'fsSpend', 'title': '当前投流消耗(元)', 'type': 'currency'},
            {'key': 'fsKLeverage', 'title': '投流杠杆倍数(FS/K)', 'type': 'number'},
            {'key': 'ctr', 'title': '点击率(CTR%)', 'type': 'percent'},
            {'key': 'cpc', 'title': '平均点击成本(元)', 'type': 'currency'},
            {'key': 'cpe', 'title': '互动成本(元)', 'type': 'currency'},
            {'key': 'recommendation', 'title': '运营加推诊断建议', 'type': 'string'}
        ],
        'rows': potential_notes_rows
    },
    {
        'id': 'kailas-full-funnel-summary',
        'title': '凯乐石黑山Q3全链路种草转化漏斗表',
        'period': '2026-07-16 ~ 2026-09-27',
        'sourceId': 'src-kailas-sheets-c4qXS1',
        'note': '展现量2160万 → 阅读点击218万(CTR 10.13%) → 深度互动8.5万(CPE ¥15.09) → 小红星站外活跃UV 10408(CPUV ¥73.95)全链路数据。',
        'category': 'performance',
        'provenance': 'feishu',
        'columns': [
            {'key': 'step', 'title': '漏斗层级', 'type': 'number'},
            {'key': 'stage', 'title': '转化节点', 'type': 'string'},
            {'key': 'totalValue', 'title': '全域总量', 'type': 'number'},
            {'key': 'organicValue', 'title': '自然流量沉淀', 'type': 'number'},
            {'key': 'paidValue', 'title': '投流商业放大', 'type': 'number'},
            {'key': 'unit', 'title': '单位', 'type': 'string'},
            {'key': 'conversionRate', 'title': '转化率(%)', 'type': 'percent'},
            {'key': 'rateLabel', 'title': '转化率说明', 'type': 'string'},
            {'key': 'costPerUnit', 'title': '单位成本(元)', 'type': 'currency'},
            {'key': 'costLabel', 'title': '成本指标', 'type': 'string'},
            {'key': 'description', 'title': '链路说明', 'type': 'string'}
        ],
        'rows': full_funnel_rows
    },
    {
        'id': 'kailas-biweekly-stage-evolution',
        'title': 'Q3双周阶段演进与爆文演化对比表',
        'period': '2026-07-16 ~ 2026-09-27',
        'sourceId': 'src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb',
        'note': '回溯Q3四个双周阶段(7.16-8.12首期、8月全月攻坚、8.27-9.8前哨冲刺、9.9-9.27决战收官)的消耗、CTR、CPC、CPE、CPUV演进。',
        'category': 'performance',
        'provenance': 'feishu',
        'columns': [
            {'key': 'stage', 'title': '演进阶段', 'type': 'string'},
            {'key': 'period', 'title': '统计周期', 'type': 'string'},
            {'key': 'spend', 'title': '阶段消耗(元)', 'type': 'currency'},
            {'key': 'kSpend', 'title': 'K侧达人采买(元)', 'type': 'currency'},
            {'key': 'fsSpend', 'title': '投流侧消耗(元)', 'type': 'currency'},
            {'key': 'ctr', 'title': '点击率(CTR%)', 'type': 'percent'},
            {'key': 'cpc', 'title': '平均点击成本(元)', 'type': 'currency'},
            {'key': 'cpe', 'title': '互动成本(元)', 'type': 'currency'},
            {'key': 'cpuv', 'title': '小红星CPUV(元)', 'type': 'currency'},
            {'key': 'publishedNotes', 'title': '累计发布篇数', 'type': 'number'},
            {'key': 'viralNotes', 'title': '阶段爆文/标杆素材', 'type': 'string'},
            {'key': 'strategyHighlights', 'title': '阶段策略与测试重点', 'type': 'string'}
        ],
        'rows': biweekly_evolution_rows
    },
    {
        'id': 'kailas-tier-direction-matrix',
        'title': '达人层级与内容方向二维热力交叉矩阵',
        'period': '2026-07-28 ~ 2026-09-27',
        'sourceId': 'src-kailas-4PGzjP',
        'note': '从70位实际签约达人执行表(4PGzjP)提炼4大达人层级(头部/腰部/尾部/UGC)与8大内容方向二维篇数与采买费用交叉分布，并附Q2 vs Q3演进。',
        'category': 'execution',
        'provenance': 'feishu',
        'columns': [
            {'key': 'tier', 'title': '达人层级', 'type': 'string'},
            {'key': 'direction', 'title': '内容方向', 'type': 'string'},
            {'key': 'noteCount', 'title': '合作篇数', 'type': 'number'},
            {'key': 'spend', 'title': '采买费用(元)', 'type': 'currency'},
            {'key': 'avgSpend', 'title': '篇均单价(元)', 'type': 'currency'}
        ],
        'rows': matrix_rows
    },
    {
        'id': 'kailas-audit-common-issues',
        'title': 'FUGA达人内容审核高频问题与质检标准归纳表',
        'period': '全周期执行质检',
        'sourceId': 'src-kailas-4PGzjP',
        'note': '从FUGA达人内容审核常见问题总表(0aRpyJ)提炼拍摄类与文案类高频违规点、真实错误示例与质检红线。',
        'category': 'execution',
        'provenance': 'feishu',
        'columns': [
            {'key': 'category', 'title': '问题分类', 'type': 'string'},
            {'key': 'issueCode', 'title': '问题编号', 'type': 'string'},
            {'key': 'issueTitle', 'title': '质检要点 / 规范名称', 'type': 'string'},
            {'key': 'violationCount', 'title': '违规频次 / 触犯人数', 'type': 'string'},
            {'key': 'severity', 'title': '风险等级', 'type': 'string'},
            {'key': 'examples', 'title': '❌ 典型错误示例', 'type': 'string'},
            {'key': 'correctStandard', 'title': '✅ 规范写法 / 正确标准', 'type': 'string'},
            {'key': 'action', 'title': '质检执行动作', 'type': 'string'}
        ],
        'rows': audit_issues_rows
    }
]

# Merge into tables: keep existing tables, update/append new tables
existing_ids = {t['id'] for t in existing_tables}
print(f'Existing table IDs ({len(existing_ids)}): {existing_ids}')

final_tables = list(existing_tables)
for nt in new_tables:
    if nt['id'] in existing_ids:
        for idx, t in enumerate(final_tables):
            if t['id'] == nt['id']:
                final_tables[idx] = nt
                print(f"Updated table: {nt['id']}")
                break
    else:
        final_tables.append(nt)
        print(f"Appended new table: {nt['id']}")

existing_data['tables'] = final_tables
print(f'Total tables after enrichment: {len(final_tables)}')

# Verify all sourceIds exist in sources
valid_source_ids = {s['id'] for s in existing_data['sources']}
for t in final_tables:
    sid = t.get('sourceId')
    assert sid in valid_source_ids, f"Table {t['id']} has invalid sourceId '{sid}'! Valid sources: {valid_source_ids}"

TARGET_JSON.write_text(json.dumps(existing_data, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Successfully updated {TARGET_JSON}!')

