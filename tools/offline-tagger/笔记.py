import argparse
import asyncio
from contextlib import contextmanager
import datetime
import json
import msvcrt
import os
from pathlib import Path

import aiohttp
from aiohttp import ClientSession

# 设置Cookie
cookies =  {"a1":"1a0566807a2u734iks5c5vsmbua5z4zb5ijt0odq650000352499","webId":"c13ad168581a073309d32c352341ba40","gid":"y082KKY8ySUqy082y4J48hU300udI8CSMU61DTFj34iIjk28DjKxfS888JJK2Wy8W4Dy2Sd8","customerClientId":"709063578295236","abRequestId":"ab92753d-b704-5797-a7c2-558382beb79e","web_session":"040069b7f21c0e3f17dc813a4e354b86cc2553","xsecappid":"ratlin","websectiga":"7750c37de43b7be9de8ed9ff8ea0e576519e8cd2157322eb972ecb429a7735d4","sec_poison_id":"606a958c-468c-4ff7-a97f-32f5b3745faa","acw_tc":"0a00075317881560526031340ea473f6ed69d80fa0ebfb1a483d31e7809a3a","customer-sso-sid":"68c517680071985388584966u91uhfrtdygsh0vb","solar.beaker.session.id":"AT-68c517680071998273224707tsav8ctu15njoadn","access-token-pgy.xiaohongshu.com":"customer.pgy.AT-68c517680071998273224707tsav8ctu15njoadn","access-token-pgy.beta.xiaohongshu.com":"customer.pgy.AT-68c517680071998273224707tsav8ctu15njoadn","x-user-id-pgy.xiaohongshu.com":"65d87563e300000000000001"}

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_UID_FILE = SCRIPT_DIR.parent / "uid.txt"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "outputs" / "pgy_note_fetch"
URL_TEMPLATE = "https://pgy.xiaohongshu.com/api/solar/note/{}/detail?bizCode="
STOP_STATUS_CODES = {401, 403, 429}


class RiskControlError(RuntimeError):
    """登录失效、限流或风控响应；出现后必须停止全部请求。"""


class PermanentItemError(RuntimeError):
    """单条笔记不可用；记录错误后继续其他 UID。"""


class GlobalRateLimiter:
    """跨 Worker 的入口限速器，保证请求发出时间相隔固定秒数。"""

    def __init__(self, requests_per_second: float) -> None:
        self.interval = 1.0 / requests_per_second
        self.lock = asyncio.Lock()
        self.next_allowed = 0.0

    async def acquire(self) -> None:
        loop = asyncio.get_running_loop()
        async with self.lock:
            now = loop.time()
            if self.next_allowed > now:
                await asyncio.sleep(self.next_allowed - now)
            self.next_allowed = loop.time() + self.interval


@contextmanager
def single_instance(lock_path: Path):
    """使用 Windows 文件锁阻止同一输出目录同时运行多个抓取实例。"""
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open("a+b")
    handle.seek(0)
    handle.write(b"1")
    handle.flush()
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError as exc:
        handle.close()
        raise RuntimeError(f"已有抓取任务正在运行: {lock_path}") from exc
    try:
        yield
    finally:
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        handle.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="低频、可续跑地抓取蒲公英笔记详情")
    parser.add_argument("--uid-file", default=str(DEFAULT_UID_FILE), help="每行一个 24 位笔记 UID")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="JSON/JSONL 输出目录")
    parser.add_argument("--concurrency", type=int, default=4, help="并发 Worker 数，默认 4，最大 8")
    parser.add_argument("--rps", type=float, default=1.0, help="全局每秒请求数，默认 1，最大 2")
    return parser


def load_uids(path: Path) -> list[str]:
    values = [line.strip().lower() for line in path.read_text(encoding="utf-8-sig").splitlines()]
    unique = list(dict.fromkeys(value for value in values if value))
    invalid = [value for value in unique if len(value) != 24 or any(c not in "0123456789abcdef" for c in value)]
    if invalid:
        raise ValueError(f"UID 文件包含 {len(invalid)} 个非 24 位十六进制 ID")
    return unique


def load_checkpoint(path: Path) -> dict[str, str]:
    cached: dict[str, str] = {}
    if not path.exists():
        return cached
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            uid = str(row.get("UID", "")).strip().lower()
            content = row.get("Content")
            if uid and isinstance(content, str):
                cached[uid] = content
    return cached


async def append_checkpoint(path: Path, uid: str, content: str, lock: asyncio.Lock) -> None:
    row = json.dumps({"UID": uid, "Content": content}, ensure_ascii=False)
    async with lock:
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(row + "\n")


def validate_response(status: int, content_type: str, text: str) -> None:
    if status in STOP_STATUS_CODES:
        raise RiskControlError(f"HTTP {status}，已触发全局熔断")
    if status in {400, 404, 410, 422}:
        raise PermanentItemError(f"HTTP {status}")
    if status >= 400:
        raise RuntimeError(f"HTTP {status}")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RiskControlError(f"返回内容不是 JSON（Content-Type: {content_type or '未知'}）") from exc
    if not isinstance(payload, dict):
        raise RiskControlError("返回 JSON 结构异常")
    success = payload.get("success")
    code = payload.get("code")
    if success is False or (code not in (None, 0, "0")):
        message = str(payload.get("msg") or payload.get("message") or "接口返回失败")
        risk_keywords = ("频繁", "风控", "登录", "验证码", "token", "访问受限", "权限受限")
        if any(keyword.lower() in message.lower() for keyword in risk_keywords):
            raise RiskControlError(f"接口拒绝请求: {message[:120]}")
        raise PermanentItemError(message[:200])


async def fetch_one(
    uid: str,
    session: ClientSession,
    limiter: GlobalRateLimiter,
    stop_event: asyncio.Event,
    cookie_header: str,
) -> str:
    url = URL_TEMPLATE.format(uid)
    headers = {"Cookie": cookie_header}
    last_error: Exception | None = None
    for attempt in range(2):
        if stop_event.is_set():
            raise RiskControlError("任务已熔断")
        await limiter.acquire()
        try:
            async with session.get(url, headers=headers) as response:
                text = await response.text()
                if response.status >= 500 and attempt == 0:
                    await asyncio.sleep(2)
                    continue
                validate_response(response.status, response.headers.get("Content-Type", ""), text)
                return text
        except (RiskControlError, PermanentItemError):
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError, RuntimeError) as exc:
            last_error = exc
            if attempt == 0:
                await asyncio.sleep(2)
                continue
    raise RuntimeError(str(last_error or "请求失败"))


async def run(args: argparse.Namespace) -> int:
    uid_file = Path(args.uid_file).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    if not 1 <= args.concurrency <= 8:
        raise ValueError("--concurrency 必须在 1 到 8 之间")
    if not 0 < args.rps <= 2:
        raise ValueError("--rps 必须大于 0 且不超过 2")

    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = output_dir / "表现数据_检查点.jsonl"
    result_path = output_dir / "表现数据.json"
    error_path = output_dir / "抓取错误.json"

    uids = load_uids(uid_file)
    results = load_checkpoint(checkpoint_path)
    pending = [uid for uid in uids if uid not in results]
    print(f"UID 总数: {len(uids)}；缓存命中: {len(uids) - len(pending)}；待抓取: {len(pending)}")
    if not pending:
        ordered = [{"UID": uid, "Content": results[uid]} for uid in uids]
        result_path.write_text(json.dumps(ordered, ensure_ascii=False), encoding="utf-8")
        return 0

    cookie_header = os.environ.get("PGY_COOKIE") or "; ".join(
        f"{name}={value}" for name, value in cookies.items()
    )
    limiter = GlobalRateLimiter(args.rps)
    stop_event = asyncio.Event()
    checkpoint_lock = asyncio.Lock()
    errors: dict[str, str] = {}
    queue: asyncio.Queue[str] = asyncio.Queue()
    for uid in pending:
        queue.put_nowait(uid)

    timeout = aiohttp.ClientTimeout(total=30, connect=10, sock_read=20)
    connector = aiohttp.TCPConnector(limit=args.concurrency, limit_per_host=args.concurrency)
    completed = 0
    started = datetime.datetime.now()

    async with ClientSession(timeout=timeout, connector=connector) as session:
        async def worker(worker_number: int) -> None:
            nonlocal completed
            while not stop_event.is_set():
                try:
                    uid = queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                try:
                    content = await fetch_one(uid, session, limiter, stop_event, cookie_header)
                    results[uid] = content
                    await append_checkpoint(checkpoint_path, uid, content, checkpoint_lock)
                    completed += 1
                    if completed % 10 == 0 or completed == len(pending):
                        elapsed = datetime.datetime.now() - started
                        print(f"进度: {completed}/{len(pending)}；耗时: {elapsed}", flush=True)
                except RiskControlError as exc:
                    errors[uid] = str(exc)
                    stop_event.set()
                    print(f"[熔断] Worker {worker_number}: {exc}", flush=True)
                    return
                except Exception as exc:
                    errors[uid] = str(exc)
                    print(f"[失败] {uid}: {exc}", flush=True)
                finally:
                    queue.task_done()

        workers = [asyncio.create_task(worker(index + 1)) for index in range(args.concurrency)]
        await asyncio.gather(*workers)

    ordered = [{"UID": uid, "Content": results[uid]} for uid in uids if uid in results]
    result_path.write_text(json.dumps(ordered, ensure_ascii=False), encoding="utf-8")
    error_path.write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"成功: {len(ordered)}/{len(uids)}；失败/未完成: {len(uids) - len(ordered)}")
    print(f"JSON 结果: {result_path}")
    return 2 if stop_event.is_set() else (1 if errors else 0)


def main() -> int:
    args = build_parser().parse_args()
    try:
        output_dir = Path(args.output_dir).expanduser().resolve()
        with single_instance(output_dir / ".fetch.lock"):
            return asyncio.run(run(args))
    except Exception as exc:
        print(f"运行失败: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
