#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import requests
import json
import aiohttp
import asyncio
import re
from snownlp import SnowNLP
from datetime import datetime, timedelta
from config_loader import load_config, load_cookie_pool, make_cookie_header

CONFIG = load_config()
APP_ID = CONFIG["feishu"]["app_id"]
APP_SECRET = CONFIG["feishu"]["app_secret"]
XHS_CONFIG = CONFIG["xiaohongshu"]

SHEET_NAMES = {
    "source": "笔记发布list",
    "comments": "评论监测底表",
    "summary": "监测日报"
}

question_words = ["~？", "吗", "嘛", "在哪", "哪里", "有没有", "好不好", "是不是", "啥", "需不需要", "为什么", "怎么", "多久", "多少", "请问"]

positive_words = []
negative_words = []
our_products = []
competitor_products = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def parse_time_str(tstr):
    if not tstr:
        raise ValueError("Empty time string")

    try:
        # 处理时间戳（毫秒/秒）
        if isinstance(tstr, int) or tstr.isdigit():
            ts = int(tstr)
            if ts > 1e12:
                return datetime.fromtimestamp(ts / 1000)
            else:
                return datetime.fromtimestamp(ts)

        # 处理 ISO 格式（如 2024-04-03T15:04:21.000Z）
        if "T" in tstr and "Z" in tstr:
            return datetime.strptime(tstr, "%Y-%m-%dT%H:%M:%S.%fZ")

        # 处理常规格式
        for fmt in ("%Y/%m/%d %H:%M", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(tstr, fmt)
            except:
                continue
    except Exception as e:
        raise ValueError(f"Unrecognized time format: {tstr}")

    raise ValueError(f"Unrecognized time format: {tstr}")

def get_tenant_access_token():
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    payload = {"app_id": APP_ID, "app_secret": APP_SECRET}
    log("获取 tenant_access_token 中...")
    token = requests.post(url, json=payload).json()["tenant_access_token"]
    log("✅ tenant_access_token 获取成功")
    return token

def get_sheet_id_map(app_token, token):
    url = f"https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/{app_token}/sheets/query"
    headers = {"Authorization": f"Bearer {token}"}
    log("查询所有 Sheet ID 中...")
    resp = requests.get(url, headers=headers)
    data = resp.json()
    sheet_map = {s['title']: s['sheet_id'] for s in data['data']['sheets']}
    log(f"✅ 获取 sheet_id 成功: {sheet_map}")
    return sheet_map

def get_note_ids(app_token, sheet_id, token):
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{app_token}/values/{sheet_id}!H2:H"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"valueRenderOption": "ToString", "dateTimeRenderOption": "FormattedString"}
    log("拉取 '笔记发布list' 表中的 noteid（H 列）中...")
    resp = requests.get(url, headers=headers, params=params)
    values = resp.json().get("data", {}).get("valueRange", {}).get("values", [])
    note_ids = [row[0] for row in values if row and row[0] != "笔记id"]
    log(f"✅ 共获取 {len(note_ids)} 条 noteid")
    return note_ids

def get_cookies_list_from_oss():
    log("从 OSS 下载最新 cookie 池...")
    cookies = load_cookie_pool(CONFIG, refresh=True, allow_cached=True)
    log(f"✅ 成功加载 {len(cookies)} 组 cookie")
    return cookies

def _comment_id(comment):
    return str(comment.get("idStr") or comment.get("id") or "")


async def _request_comment_data(session, url, headers, params):
    max_retries = int(XHS_CONFIG.get("max_retries", 5))
    timeout_seconds = int(XHS_CONFIG.get("request_timeout_seconds", 30))
    last_error = None

    for attempt in range(max_retries):
        try:
            timeout = aiohttp.ClientTimeout(total=timeout_seconds)
            async with session.get(
                url,
                headers=headers,
                params=params,
                timeout=timeout,
            ) as resp:
                result = await resp.text()
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status}: {result[:160]}")
                payload = json.loads(result)
                if payload.get("code") not in (None, 0):
                    raise RuntimeError(
                        f"接口错误 code={payload.get('code')}: "
                        f"{payload.get('msg') or payload.get('message')}"
                    )
                return payload.get("data", {})
        except Exception as exc:
            last_error = exc
            if attempt + 1 < max_retries:
                await asyncio.sleep(min(0.5 * (attempt + 1), 2))

    raise RuntimeError(f"评论接口连续失败 {max_retries} 次: {last_error}")


async def _fetch_all_l2_comments(note_id, l1_item, session, headers):
    comment = l1_item.get("comment", {})
    l1_comment_id = _comment_id(comment)
    expected_total = int(comment.get("subCommentCount") or 0)
    all_l2_comments = []
    seen_ids = set()

    for sub_comment in l1_item.get("l1L2Comments", []):
        sub_comment_id = _comment_id(sub_comment)
        if sub_comment_id and sub_comment_id not in seen_ids:
            seen_ids.add(sub_comment_id)
            all_l2_comments.append(sub_comment)

    if not l1_comment_id or len(all_l2_comments) >= expected_total:
        return all_l2_comments

    base_url = (
        f"{XHS_CONFIG['base_url'].rstrip('/')}"
        f"/api/solar/note/{note_id}/l2_comments"
    )
    offset = _comment_id(all_l2_comments[-1]) if all_l2_comments else ""
    page_size = int(XHS_CONFIG.get("comment_l2_page_size", 5))

    while len(all_l2_comments) < expected_total:
        data = await _request_comment_data(
            session,
            base_url,
            headers,
            {
                "offset": offset,
                "l1CommentId": l1_comment_id,
                "pageSize": page_size,
            },
        )
        batch = data.get("l2Comments", [])
        if not batch:
            break

        added = 0
        for sub_comment in batch:
            sub_comment_id = _comment_id(sub_comment)
            if sub_comment_id and sub_comment_id not in seen_ids:
                seen_ids.add(sub_comment_id)
                all_l2_comments.append(sub_comment)
                added += 1

        next_offset = _comment_id(batch[-1])
        if not added or not next_offset or next_offset == offset:
            break
        offset = next_offset

    return all_l2_comments


async def fetch_note_comments(note_id, session, cookie):
    all_comments = []
    seen_l1_ids = set()
    offset = ""
    reported_l1_total = 0
    headers = {"Cookie": cookie, "User-Agent": "Mozilla/5.0"}
    base_url = (
        f"{XHS_CONFIG['base_url'].rstrip('/')}"
        f"/api/solar/note/{note_id}/l1_comments"
    )
    page_size = int(XHS_CONFIG.get("comment_l1_page_size", 10))
    l2_page_size = int(XHS_CONFIG.get("comment_l2_page_size", 5))

    try:
        while True:
            data = await _request_comment_data(
                session,
                base_url,
                headers,
                {
                    "offset": offset,
                    "pageSize": page_size,
                    "l2PageSize": l2_page_size,
                },
            )
            reported_l1_total = int(data.get("l1CommentTotal") or reported_l1_total)
            batch = data.get("l1Comments", [])
            if not batch:
                break

            added = 0
            for item in batch:
                comment_id = _comment_id(item.get("comment", {}))
                if comment_id and comment_id not in seen_l1_ids:
                    seen_l1_ids.add(comment_id)
                    all_comments.append(item)
                    added += 1

            if reported_l1_total and len(all_comments) >= reported_l1_total:
                break

            next_offset = _comment_id(batch[-1].get("comment", {}))
            if not added or not next_offset or next_offset == offset:
                break
            offset = next_offset

        for item in all_comments:
            item["l1L2Comments"] = await _fetch_all_l2_comments(
                note_id,
                item,
                session,
                headers,
            )

        return note_id, json.dumps(
            {
                "data": {
                    "l1CommentTotal": reported_l1_total,
                    "l1Comments": all_comments,
                }
            },
            ensure_ascii=False,
        )
    except Exception as exc:
        log(f"⚠️ 拉取 noteid={note_id} 评论失败: {exc}")
        return note_id, "{}"

async def fetch_all_comments(note_ids, cookies_pool):
    results, counter = [], 0
    log("开始异步拉取评论（分页抓取）...")
    async with aiohttp.ClientSession() as session:
        tasks = []
        for note_id in note_ids:
            cookie = make_cookie_header(cookies_pool[(counter // 20) % len(cookies_pool)])
            tasks.append(fetch_note_comments(note_id, session, cookie))
            counter += 1
        for task in asyncio.as_completed(tasks):
            results.append(await task)
    log(f"✅ 拉取完成，共处理 {len(results)} 篇笔记")
    return results

def extract_comments(note_id, raw):
    out = []
    try:
        data = json.loads(raw).get("data", {}).get("l1Comments", [])
        for item in data:
            c = item.get("comment", {})
            content = c.get("content", "")
            time = c.get("createTime", "")
            out.append(parse_comment(note_id, content, time))

            for sub in item.get("l1L2Comments", []):
                sub_content = sub.get("content", "")
                sub_time = sub.get("createTime", "")
                out.append(parse_comment(note_id, sub_content, sub_time))
    except Exception as e:
        log(f"⚠️ 解析 noteid={note_id} 评论出错: {str(e)}")
    return out

def convert_relative_time(raw_time):
    now = datetime.now()
    if raw_time.startswith("今天"):
        return raw_time.replace("今天", now.strftime("%Y/%m/%d"))
    elif raw_time.startswith("昨天"):
        return raw_time.replace("昨天", (now - timedelta(days=1)).strftime("%Y/%m/%d"))
    return raw_time

def parse_comment(noteid, content, time):
    clean = re.sub(r'\[[^\]]*\]', '', content or "")
    sentiment = "无法分析"
    if clean.strip():
        score = SnowNLP(clean).sentiments
        sentiment = "积极" if score > 0.6 else "消极" if score < 0.4 else "中性"
        if sentiment == "积极" and any(n in clean for n in negative_words): sentiment = "中性"
        if sentiment == "消极" and any(p in clean for p in positive_words): sentiment = "中性"

    return [
        noteid,
        content or "",  # 保留原始内容，即使为空
        convert_relative_time(time or ""),
        "疑问评论" if any(q in (content or "") for q in question_words) else "非疑问评论",
        "包含本品" if any(p in (content or "") for p in our_products) else "不包含本品",
        ', '.join([p for p in competitor_products if p in (content or "")]),
        sentiment
    ]

def get_summary_time_range(app_token, sheet_id, token, comments):
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{app_token}/values/{sheet_id}!A2:A2"
    headers = {"Authorization": f"Bearer {token}"}
    log("📥 检查监测日报 A2 是否已有值...")
    resp = requests.get(url, headers=headers)
    try:
        values = resp.json().get("data", {}).get("valueRange", {}).get("values", [])
    except Exception as e:
        log(f"❌ 获取 A2 值失败，返回内容异常：{resp.text}")
        raise e

    if not values or not values[0] or not values[0][0] or not str(values[0][0]).strip():
        log("🆕 日报仅含表头，使用最早评论时间到当前时间作为监测范围")
        all_times = [parse_time_str(row[2]) for row in comments]
        earliest = min(all_times)
        return earliest, datetime.now()
    else:
        log("📌 监测日报已有数据，使用昨日当前时间到当前时间作为监测范围")
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=now.hour, minute=now.minute), now

def summarize(comments, start_time, end_time):
    from collections import Counter
    s = Counter()
    ids_neg, ids_pos, ids_ask = set(), set(), set()
    for row in comments:
        noteid, content, raw_time, is_q, is_our, is_cmp, senti = row
        try:
            comment_time = parse_time_str(raw_time)
        except:
            continue
        if not (start_time <= comment_time <= end_time):
            continue
        s['新增评论数'] += 1
        if is_our == '包含本品':
            s['新增我品评论数'] += 1
            if senti == '积极': s['我品正面评论数'] += 1
            elif senti == '消极':
                s['我品负面评论数'] += 1
                ids_neg.add(noteid)
        if is_cmp:
            s['新增竞品评论数'] += 1
            if senti == '积极':
                s['竞品正面评论数'] += 1
                ids_pos.add(noteid)
            elif senti == '消极':
                s['竞品负面评论数'] += 1
        if is_q == '疑问评论':
            s['新增疑问评论数'] += 1
            ids_ask.add(noteid)

        content_stripped = content.strip()
        if (
                not content_stripped
                or all(c in ' \t\n\r' for c in content_stripped)
                or re.fullmatch(r'[\u4e00-\u9fa5A-Za-z0-9\s]+', content_stripped)
                or re.fullmatch(r'(\[\S{0,20}\]\s*)+', content_stripped)
        ):
            s['新增纯表情包评论数'] += 1
        if is_our == '不包含本品' and not is_cmp and senti in ['中性', '无法分析']:
            s['新增无关评论数'] += 1

    s['监测时间范围'] = f"{start_time.strftime('%Y-%m-%d %H:%M')} —— {end_time.strftime('%Y-%m-%d %H:%M')}"
    s['监测笔记数'] = len(set(x[0] for x in comments))
    s['我品负面评论涉及笔记数'] = len(ids_neg)
    s['竞品正面评论涉及笔记数'] = len(ids_pos)
    s['疑问评论涉及笔记数'] = len(ids_ask)
    s['我品负面评论涉及链接'] = '\n'.join([f"https://www.xiaohongshu.com/explore/?noteid={x}" for x in ids_neg])
    s['竞品积极评论涉及链接'] = '\n'.join([f"https://www.xiaohongshu.com/explore/?noteid={x}" for x in ids_pos])

    keys = [
        "监测时间范围", "监测笔记数", "新增评论数", "新增我品评论数", "我品正面评论数", "我品负面评论数",
        "我品负面评论涉及笔记数", "新增竞品评论数", "竞品正面评论数", "竞品负面评论数",
        "竞品正面评论涉及笔记数", "新增疑问评论数", "疑问评论涉及笔记数",
        "新增无关评论数", "新增纯表情包评论数", "我品负面评论涉及链接", "竞品积极评论涉及链接"
    ]
    return [[s.get(k, 0) for k in keys]]

def overwrite_sheet_data(app_token, sheet_id, token, data, batch_size=1000):

    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{app_token}/values"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    log(f"准备分批次写入评论监测底表，总数据量：{len(data)} 行，批次大小：{batch_size} 行")

    for i in range(0, len(data), batch_size):
        batch_data = data[i:i + batch_size]
        end_col = chr(ord('A') + max(len(row) for row in batch_data) - 1)
        # 计算写入的范围，考虑到可能存在的表头
        start_row = 2 if i == 0 else i + 2
        payload = {
            "valueRange": {
                "range": f"{sheet_id}!A{start_row}:{end_col}{start_row + len(batch_data)}",
                "values": batch_data
            }
        }
        log(f"写入第 {i // batch_size + 1} 批次，范围：A{start_row}:{end_col}{start_row + len(batch_data)}，数据量：{len(batch_data)} 行")
        resp = requests.put(url, headers=headers, json=payload)
        log(f"✅ 批次写入完成，状态码：{resp.status_code}")
        try:
            log(f"📥 批次写入返回内容：{resp.json()}")
        except:
            log("⚠️ 无法解析批次写入返回内容")

    log("🎉 所有批次写入完成")


def append_summary_data(app_token, sheet_id, token, data):
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{app_token}/values_append?insertDataOption=INSERT_ROWS"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"valueRange": {"range": f"{sheet_id}!A:A", "values": data}}
    log("追加写入监测日报汇总中 (v2)...")
    resp = requests.post(url, headers=headers, json=payload)
    log(f"✅ 汇总追加完成，状态码：{resp.status_code}")
    try:
        log(f"📥 汇总返回内容：{resp.json()}")
    except:
        log("⚠️ 无法解析汇总返回内容")


def run_comment_fetch_test(note_id):
    """Fetch one note without writing to Feishu and print completeness counts."""

    cookies = get_cookies_list_from_oss()
    raw_results = asyncio.run(fetch_all_comments([note_id], cookies))
    if not raw_results:
        raise RuntimeError("评论接口没有返回结果")

    _, raw = raw_results[0]
    data = json.loads(raw).get("data", {})
    l1_comments = data.get("l1Comments", [])
    l2_count = sum(len(item.get("l1L2Comments", [])) for item in l1_comments)
    reported_l1_total = int(data.get("l1CommentTotal") or 0)
    total = len(l1_comments) + l2_count
    print(
        f"note_id={note_id} "
        f"reported_l1={reported_l1_total} "
        f"fetched_l1={len(l1_comments)} "
        f"fetched_l2={l2_count} "
        f"total={total}"
    )


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--test-note":
        run_comment_fetch_test(sys.argv[2])
        return

    if len(sys.argv) < 6:
        print(
            "Usage:\n"
            "  python feishu_comment.py --test-note <note_id>\n"
            "  python feishu_comment.py <app_token> <正面词> <负面词> <本品词> <竞品词>"
        )
        sys.exit(1)

    global positive_words, negative_words, our_products, competitor_products

    app_token = sys.argv[1]
    positive_words = sys.argv[2].replace('，', ',').split(',')
    negative_words = sys.argv[3].replace('，', ',').split(',')
    our_products = sys.argv[4].replace('，', ',').split(',')
    competitor_products = sys.argv[5].replace('，', ',').split(',')

    token = get_tenant_access_token()
    sheet_ids = get_sheet_id_map(app_token, token)
    source_sheet_id = sheet_ids[SHEET_NAMES["source"]]
    comment_sheet_id = sheet_ids[SHEET_NAMES["comments"]]
    summary_sheet_id = sheet_ids[SHEET_NAMES["summary"]]

    note_ids = get_note_ids(app_token, source_sheet_id, token)
    cookies = get_cookies_list_from_oss()
    raw_data = asyncio.run(fetch_all_comments(note_ids, cookies))
    parsed_comments = [row for nid, text in raw_data for row in extract_comments(nid, text)]
    log(f"共提取有效评论 {len(parsed_comments)} 条")
    if parsed_comments:
        log(f"📌 第一条示例评论：{parsed_comments[0]}")

    start_time, end_time = get_summary_time_range(app_token, summary_sheet_id, token, parsed_comments)
    summary = summarize(parsed_comments, start_time, end_time)

    overwrite_sheet_data(app_token, comment_sheet_id, token, parsed_comments)
    append_summary_data(app_token, summary_sheet_id, token, summary)

    log("🎉 脚本执行完成")

if __name__ == "__main__":
    main()
