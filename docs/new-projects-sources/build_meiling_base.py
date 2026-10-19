import sys
import json
import re
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Read projected records from local dump
records = []
with open('.codex_work/meiling-dumps/all-projected.ndjson', 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

def sanitize_url(val):
    if not val or not isinstance(val, str):
        return None
    m = re.search(r'\((https?://[^\)]+)\)', val)
    if m:
        val = m.group(1)
    else:
        m2 = re.search(r'https?://[^\s\]\)\"\'\,]+', val)
        if m2:
            val = m2.group(0)
    val = re.sub(r'1[3-9]\d{9}', '1XXXXXXXXXX', val)
    return val

# Dynamically extract pipeline records (in execution pipeline)
pipeline_records = []
for r in records:
    is_sc = bool(r.get('二核确认合作'))
    has_rp = bool(r.get('审核进度'))
    is_cdc = (r.get('内容方向确认') or []) == ['确认']
    if is_sc or has_rp or is_cdc:
        rec = {
            'record_id': r.get('record_id'),
            '达人昵称': r.get('达人昵称'),
            '达人量级': (r.get('达人量级') or [None])[0],
            '粉丝（万）': r.get('粉丝（万）'),
            '合作形式': (r.get('合作形式（图文/视频）') or [None])[0],
            '推荐产品': (r.get('推荐产品') or [None])[0],
            '内容类型': (r.get('内容类型') or [None])[0],
            '内容方向': r.get('内容方向'),
            '品牌反馈': (r.get('品牌反馈') or [None])[0],
            '二核确认合作': bool(r.get('二核确认合作')),
            '达人是否可接': (r.get('达人是否可接') or [None])[0],
            '内容方向确认': (r.get('内容方向确认') or [None])[0],
            '审核进度': (r.get('审核进度') or [None])[0],
            '发布状态': '已发布' if (r.get('审核进度') or []) == ['已发布'] else ('推进中' if r.get('审核进度') else '未进入审核'),
            '发布时间': r.get('发布时间'),
            '提报日期': r.get('提报日期'),
            '初定档期': r.get('初定档期'),
            '发布短链': sanitize_url(r.get('发布短链')),
            '发布长链': sanitize_url(r.get('发布长链')),
            '主页链接': sanitize_url(r.get('主页链接')),
            '蒲公英链接': sanitize_url(r.get('蒲公英链接')),
            '曝光量': r.get('曝光量'),
            '阅读量': r.get('阅读量'),
            '点赞量': r.get('点赞量'),
            '互动量': r.get('互动量'),
            '达人裸价': r.get('达人裸价'),
            '合作下单价': r.get('合作下单价'),
            '筛选人（自动）': r.get('筛选人（自动）'),
            '采买形式（自动）': r.get('采买形式（自动）'),
            '外溢平台': (r.get('外溢平台') or [None])[0],
            '外溢平台（自动）': r.get('外溢平台（自动）')
        }
        pipeline_records.append(rec)

# Dynamically calculate subsets
candidate_pool_total = len(records)
confirmed_population = [r for r in pipeline_records if r['二核确认合作']]
confirmed_total = len(confirmed_population)

published_records = [r for r in confirmed_population if r['审核进度'] == '已发布']
published_count = len(published_records)
published_rate_str = f"{(published_count / confirmed_total * 100):.2f}% ({published_count}/{confirmed_total})" if confirmed_total > 0 else "0%"
in_progress_count = len([r for r in confirmed_population if r['审核进度'] and r['审核进度'] != '已发布'])
unstarted_review_count = len([r for r in confirmed_population if not r['审核进度']])

# Dynamic status distribution
status_counts = Counter(r['审核进度'] or '未进入审核流' for r in confirmed_population)
status_order = ['已发布', '可推进', '达人修改中', '品牌审核中', '内审中', '达人拍摄中', '待确认预览', '定稿可上传', '未进入审核流']
ordered_status_items = {k: status_counts[k] for k in status_order if k in status_counts}
# append any other unexpected status
for k, v in status_counts.items():
    if k not in ordered_status_items:
        ordered_status_items[k] = v

status_sum_check = " + ".join(str(v) for v in ordered_status_items.values()) + f" = {sum(ordered_status_items.values())}"

# Dynamic spillover distribution
spill_counts = Counter(r['外溢平台'] or '未标注' for r in confirmed_population)
spill_order = ['天猫代采', '京东自采', '京东代采', '天猫自采', '未标注']
ordered_spill_items = {}
for k in spill_order:
    if k in spill_counts:
        c = spill_counts[k]
        pct = f"{(c / confirmed_total * 100):.2f}%" if confirmed_total > 0 else "0%"
        ordered_spill_items[k] = {'count': c, 'percentage': pct}
for k, c in spill_counts.items():
    if k not in ordered_spill_items:
        pct = f"{(c / confirmed_total * 100):.2f}%" if confirmed_total > 0 else "0%"
        ordered_spill_items[k] = {'count': c, 'percentage': pct}

spill_sum_check = " + ".join(str(v['count']) for v in ordered_spill_items.values()) + f" = {sum(v['count'] for v in ordered_spill_items.values())}"

# Dynamic product group aggregation
def get_product_group(pname):
    if not pname:
        return '未填'
    if '502' in pname:
        return '小确杏502pro (含柳潇/雨珂)'
    if '421' in pname:
        return '小确杏421'
    if '520' in pname:
        return '小确杏520机皇'
    if '511' in pname:
        return '小确杏511'
    if '516' in pname or '黑珍珠' in pname:
        return '黑珍珠516'
    if '570' in pname or '大白鲸' in pname:
        return '大白鲸570'
    if '无忧嵌' in pname:
        return '无忧嵌系列'
    return pname

product_groups = {}
for r in confirmed_population:
    raw_p = r['推荐产品'] or '未填'
    grp = get_product_group(raw_p)
    if grp not in product_groups:
        product_groups[grp] = {'count': 0, 'raw_counts': Counter()}
    product_groups[grp]['count'] += 1
    product_groups[grp]['raw_counts'][raw_p] += 1

ordered_prod_keys = ['小确杏502pro (含柳潇/雨珂)', '小确杏421', '小确杏520机皇', '无忧嵌系列', '小确杏511', '黑珍珠516', '大白鲸570']
product_items = {}
for k in ordered_prod_keys:
    if k in product_groups:
        c = product_groups[k]['count']
        pct = f"{(c / confirmed_total * 100):.2f}%" if confirmed_total > 0 else "0%"
        item = {'count': c, 'percentage': pct}
        if len(product_groups[k]['raw_counts']) > 1 or k.endswith('系列') or '含' in k:
            item['detail'] = dict(product_groups[k]['raw_counts'])
        product_items[k] = item
for k, data in product_groups.items():
    if k not in product_items:
        c = data['count']
        pct = f"{(c / confirmed_total * 100):.2f}%" if confirmed_total > 0 else "0%"
        product_items[k] = {'count': c, 'percentage': pct, 'detail': dict(data['raw_counts'])}

prod_sum_check = " + ".join(str(v['count']) for v in product_items.values()) + f" = {sum(v['count'] for v in product_items.values())}"

# Dynamic tier and format distributions
tier_counts = Counter(r['达人量级'] or '未填' for r in confirmed_population)
tier_items = {k: {'count': v, 'percentage': f"{(v / confirmed_total * 100):.2f}%"} for k, v in tier_counts.items()}

format_counts = Counter(r['合作形式'] or '未填' for r in confirmed_population)
format_items = {k: {'count': v, 'percentage': f"{(v / confirmed_total * 100):.2f}%"} for k, v in format_counts.items()}

# 3+3 divergence dynamic analysis
extra_in_pipeline = [
    {
        '达人昵称': r['达人昵称'] or '(空)',
        '审核进度': r['审核进度'] or '(空)',
        '品牌反馈': r['品牌反馈'] or '(空)',
        '内容方向确认': r['内容方向确认'] or '(空)',
        'reason': '已进入制作审核流但二核Checkbox未勾选'
    }
    for r in pipeline_records if not r['二核确认合作']
]

confirmed_no_review = [
    {
        '达人昵称': r['达人昵称'] or '(空)',
        '二核确认合作': True,
        '内容方向确认': r['内容方向确认'] or '(空)',
        '审核进度': '(空)',
        'reason': '二核已确认但未录入常规审核进度' + ('(改供图合作)' if r['内容方向确认'] == '改供图合作' else '(待建审核流)')
    }
    for r in pipeline_records if r['二核确认合作'] and not r['审核进度']
]

# Candidate pool breakdown (N=1096)
bf_counts = Counter((r.get('品牌反馈') or ['未反馈/空'])[0] for r in records)
sc_counts = Counter('已确认合作 (True)' if r.get('二核确认合作') else '未确认 (False)' for r in records)
cct_counts = Counter((r.get('达人是否可接') or ['空'])[0] for r in records)
cdc_counts = Counter((r.get('内容方向确认') or ['空'])[0] for r in records)

selected_fields = [
    {'name': '达人昵称', 'field_id': 'fldQdCovPV', 'type': 'text', 'category': '达人标识'},
    {'name': '达人量级', 'field_id': 'fldpjWZH1l', 'type': 'select', 'category': '达人画像'},
    {'name': '粉丝（万）', 'field_id': 'fldpobsf1u', 'type': 'number', 'category': '达人画像'},
    {'name': '合作形式', 'field_id': 'fldLw5AOeY', 'type': 'select', 'category': '合作属性'},
    {'name': '推荐产品', 'field_id': 'fldog4zGfZ', 'type': 'select', 'category': '产品'},
    {'name': '内容类型', 'field_id': 'fldlhIcTzm', 'type': 'select', 'category': '内容'},
    {'name': '内容方向', 'field_id': 'fldGv1p1gS', 'type': 'text', 'category': '内容'},
    {'name': '品牌反馈', 'field_id': 'fldbHlgrCt', 'type': 'select', 'category': '合作确认'},
    {'name': '二核确认合作', 'field_id': 'fldZr8vDGk', 'type': 'checkbox', 'category': '合作确认'},
    {'name': '达人是否可接', 'field_id': 'fldPakfP1A', 'type': 'select', 'category': '合作确认'},
    {'name': '内容方向确认', 'field_id': 'fldPcOhsjD', 'type': 'select', 'category': '合作确认'},
    {'name': '审核进度', 'field_id': 'fldqcbJbd4', 'type': 'select', 'category': '执行进度'},
    {'name': '发布状态', 'derived': True, 'type': 'text', 'category': '执行进度'},
    {'name': '发布时间', 'field_id': 'fldtyMFRvM', 'type': 'datetime', 'category': '时间周期'},
    {'name': '提报日期', 'field_id': 'fldtuvfGfF', 'type': 'datetime', 'category': '时间周期'},
    {'name': '初定档期', 'field_id': 'fldj56xRRH', 'type': 'text', 'category': '时间周期'},
    {'name': '发布短链', 'field_id': 'fldqKg0HVA', 'type': 'text', 'category': '链接资产'},
    {'name': '发布长链', 'field_id': 'fldJULaQHe', 'type': 'text', 'category': '链接资产'},
    {'name': '主页链接', 'field_id': 'fldaADVRQ3', 'type': 'url', 'category': '链接资产'},
    {'name': '蒲公英链接', 'field_id': 'fldW2HIVLP', 'type': 'url', 'category': '链接资产'},
    {'name': '曝光量', 'field_id': 'fldw6q0i2N', 'type': 'number', 'category': '投放指标'},
    {'name': '阅读量', 'field_id': 'fldbOPgPdU', 'type': 'number', 'category': '投放指标'},
    {'name': '点赞量', 'field_id': 'flduBzR2wb', 'type': 'number', 'category': '投放指标'},
    {'name': '互动量', 'field_id': 'fldPVYWkyx', 'type': 'number', 'category': '投放指标'},
    {'name': '达人裸价', 'field_id': 'fldzUlyF7E', 'type': 'number', 'category': '财务投放'},
    {'name': '合作下单价', 'field_id': 'fldEsb1gXv', 'type': 'formula', 'category': '财务投放'},
    {'name': '筛选人（自动）', 'field_id': 'fldVSGimrQ', 'type': 'lookup', 'category': '人员归属'},
    {'name': '采买形式（自动）', 'field_id': 'fldSmVUz8o', 'type': 'lookup', 'category': '采买与外溢'},
    {'name': '外溢平台', 'field_id': 'fld5Qe9UhX', 'type': 'select', 'category': '采买与外溢'},
    {'name': '外溢平台（自动）', 'field_id': 'fldauanSEu', 'type': 'lookup', 'category': '采买与外溢'}
]

out = {
    'metadata': {
        'source_type': 'online_feishu_bitable',
        'source_url': 'https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l',
        'base_token': 'XH2obMhtwaPCWUsmsWacRCpLnvg',
        'base_name': '美菱冰箱小红书种草多维表',
        'table_id': 'tbluz50zuZOeGQWf',
        'table_name': '双11 KOL进度表',
        'read_at': '2026-10-19T15:40:00+08:00',
        'version_separation_note': '【版本与来源隔离说明】1. 本文件为飞书多维表格线上实时读取数据（基准时间 2026-10-19），反映当前最新状态：线上二核确认 117 条、已发布 50 篇。2. 业务历史日报数据（基准确认 108 条、已发布 44 篇）为离线日报快照版本，与当前线上多维表格实时版本按日期与来源严格分开，避免混淆覆盖。'
    },
    'viewScope': {
        'view_id': 'vewOPEh08l',
        'view_name': '（品牌筛）KOL账号提报',
        'view_type': 'grid',
        'view_records_count': candidate_pool_total,
        'table_total_records': candidate_pool_total,
        'filter': None,
        'group': ['fldVSGimrQ'],
        'sort': [['fldtuvfGfF', 'desc']],
        'scope_distinction_analysis': f'当前视图 vewOPEh08l 为"（品牌筛）KOL账号提报"，无过滤条件（filter: null），因此视图记录数等同于整表全量初筛候选池共 {candidate_pool_total} 条。其中包含大量初筛未合作/未反馈候选。实际进入合作二核确认的严格人群为 {confirmed_total} 条，不可将视图全量初筛候选池误当作已确认合作的 KOL 数量。'
    },
    'population_definitions': {
        'candidate_pool_total': {
            'denominator': candidate_pool_total,
            'description': '全表/初筛视图全量提报候选池，含淘汰与未定账号'
        },
        'strictly_confirmed_population': {
            'denominator': confirmed_total,
            'filter_condition': '二核确认合作 == True',
            'description': '线上多维表严格二核确认合作人群，作为各项执行、发布率、外溢、产品分布的统计基准母集'
        },
        'active_execution_pipeline': {
            'denominator': len(pipeline_records),
            'filter_condition': '二核确认合作 == True OR 审核进度非空 OR 内容方向确认 == 确认',
            'description': f'包含全部有活跃制作/执行痕迹的记录（共 {len(pipeline_records)} 条，比严格二核确认母集多出 {len(extra_in_pipeline)} 条）',
            'difference_explanation_3_records': {
                'extra_records_in_pipeline': extra_in_pipeline,
                'confirmed_records_without_review': confirmed_no_review
            }
        }
    },
    'summary_confirmed_population_N117': {
        'denominator': confirmed_total,
        'published_metrics': {
            'published_count': published_count,
            'published_rate': published_rate_str,
            'in_progress_count': in_progress_count,
            'unstarted_review_count': unstarted_review_count
        },
        'execution_status_distribution': {
            'denominator': confirmed_total,
            'items': ordered_status_items,
            'sum_check': status_sum_check
        },
        'spillover_platform_distribution': {
            'denominator': confirmed_total,
            'items': ordered_spill_items,
            'sum_check': spill_sum_check
        },
        'product_distribution': {
            'denominator': confirmed_total,
            'items': product_items,
            'sum_check': prod_sum_check
        },
        'tier_distribution': {
            'denominator': confirmed_total,
            'items': tier_items
        },
        'format_distribution': {
            'denominator': confirmed_total,
            'items': format_items
        }
    },
    'summary_candidate_pool_N1096': {
        'denominator': candidate_pool_total,
        'brand_feedback': dict(bf_counts),
        'second_check_confirmed': dict(sc_counts),
        'blogger_availability': dict(cct_counts),
        'content_direction_confirmed': dict(cdc_counts)
    },
    'historical_reference': {
        'wiki_node_token': 'UKPKwNHFdi9jk0kBaQKcuO3Anqf',
        'obj_token': 'Ugwgd6lKzoURMWxXeJ3c4VzNnFc',
        'obj_type': 'docx',
        'title': '美菱冰箱618小红书项目复盘',
        'is_current_campaign': False,
        'note': '属于618历史复盘资料，非当前双11项目；保留标识索引，不展开全文内容。',
        'unauthorized_nodes': [
            {
                'node_token': 'MMPZwhQbMiVmIKkcyb9c7mDQnHp',
                'status': 'unreadable',
                'error_code': 131006,
                'reason': 'permission_denied'
            },
            {
                'node_token': 'DkdOwDEk0i9FTUkXlh1cTE0fnOd',
                'status': 'unreadable',
                'error_code': 131006,
                'reason': 'permission_denied'
            }
        ]
    },
    'fields': selected_fields,
    'records': pipeline_records
}

with open('docs/new-projects-sources/meiling-base.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f'Dynamically generated meiling-base.json with {candidate_pool_total} candidates, {confirmed_total} confirmed, {len(pipeline_records)} pipeline records.')
