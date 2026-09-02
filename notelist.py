import requests
import json
from datetime import datetime, timedelta
from pathlib import Path
from config_loader import load_config, load_cookie_pool

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG = load_config()
XHS_CONFIG = CONFIG["xiaohongshu"]
SEARCH_CONFIG = CONFIG["note_search"]
cookies = None

headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Authorization": "",  # 如果需要，可以添加授权Token
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": "https://pgy.xiaohongshu.com",
    "Referer": "https://pgy.xiaohongshu.com/solar/creative/content",
    "Sec-Ch-Ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\", \"Google Chrome\";v=\"126\"",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "\"Windows\"",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "X-B3-Traceid": "4a993e6a0b9d5094"
}

# 搜索参数统一从 config.json 读取
keyword = SEARCH_CONFIG["keyword"]

# 设置总时间范围
overall_start_date_str = SEARCH_CONFIG["start_date"]
overall_end_date_str = SEARCH_CONFIG["end_date"]
period_days = int(SEARCH_CONFIG.get("period_days", 1))
page_size = int(XHS_CONFIG.get("search_page_size", 60))
request_timeout = int(XHS_CONFIG.get("request_timeout_seconds", 30))

# 将日期字符串转换为datetime对象
overall_start_date = datetime.strptime(overall_start_date_str, "%Y-%m-%d")
overall_end_date = datetime.strptime(overall_end_date_str, "%Y-%m-%d")

# 计算时间段内的所有起始和结束日期
time_periods = []
current_start_date = overall_start_date

while current_start_date <= overall_end_date:
    current_end_date = current_start_date + timedelta(days=period_days - 1)
    if current_end_date > overall_end_date:
        current_end_date = overall_end_date
    time_periods.append((current_start_date.strftime("%Y-%m-%d"), current_end_date.strftime("%Y-%m-%d")))
    current_start_date = current_end_date + timedelta(days=1)

url = f"{XHS_CONFIG['base_url'].rstrip('/')}/api/solar/content_square/searchNote"


def log_error(keyword, error_message, response_text=None):
    with open('error_log.txt', 'a', encoding='utf-8') as log_file:
        log_file.write(f"关键词: {keyword}, 错误: {error_message}\n")
        if response_text:
            log_file.write(f"响应内容: {response_text}\n")


def search_note_request(keyword, start_date, end_date, page_num):
    payload = {
        "searchWord": keyword,
        "pageSize": page_size,
        "pageNum": page_num,
        "cooperNote": 0,
        "notePublishTimeStart": f"{start_date} 00:00:00",
        "notePublishTimeEnd": f"{end_date} 23:59:59",
        "sorts": [{"column": "hot", "sort": "desc"}],
        "trackId": "note_search_423b7f70125d4d819cc96b5d023084e0"
    }

    response = requests.post(
        url,
        headers=headers,
        cookies=cookies,
        json=payload,
        timeout=request_timeout,
    )

    # 检查响应状态码
    print(f"HTTP 状态码: {response.status_code}")
    if response.status_code != 200:
        raise Exception(f"请求失败，状态码: {response.status_code}")

    # 直接解析响应文本内容
    data = response.json()  # 使用response.json()直接解析JSON

    print(f"获取到的数据量: {len(data.get('data', {}).get('noteList', []))} 条")  # 打印获取到的数据量

    return data


all_responses = []

try:
    cookies = load_cookie_pool(CONFIG, refresh=True, allow_cached=True)[0]

    for start_date_str, end_date_str in time_periods:
        # 首次请求获取总条数
        first_response_data = search_note_request(keyword, start_date_str, end_date_str, page_num=1)
        total = first_response_data['data']['total']
        total_pages = (total + page_size - 1) // page_size

        all_responses.append(first_response_data)  # 包含第一页的数据

        # 循环获取剩余页的数据
        for page_num in range(2, total_pages + 1):
            try:
                response_data = search_note_request(keyword, start_date_str, end_date_str, page_num=page_num)
                all_responses.append(response_data)
            except Exception as e:
                print(f"获取第 {page_num} 页数据时发生错误: {e}")
                log_error(keyword, str(e))
                break

    # 保存所有响应数据到一个JSON文件
    output_dir = Path(SEARCH_CONFIG.get("output_dir", "outputs/notes"))
    if not output_dir.is_absolute():
        output_dir = SCRIPT_DIR / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = output_dir / f"{keyword}_all_periods.json"
    with filename.open('w', encoding='utf-8') as file:
        json.dump(all_responses, file, ensure_ascii=False, indent=4)
    print(f"所有searchNote响应数据已成功写入{filename}文件")

except Exception as e:
    print(f"过程中发生错误: {e}")
    log_error(keyword, str(e))
