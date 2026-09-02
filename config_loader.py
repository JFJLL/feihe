#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Load local credentials and download the shared Xiaohongshu cookie pool."""

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "config.json"


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    path = Path(config_path or os.environ.get("FEIHE_CONFIG", DEFAULT_CONFIG_PATH))
    if not path.is_absolute():
        path = SCRIPT_DIR / path
    if not path.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")

    with path.open("r", encoding="utf-8") as config_file:
        config = json.load(config_file)

    for section in ("feishu", "oss", "xiaohongshu"):
        if section not in config:
            raise ValueError(f"配置文件缺少 {section} 节: {path}")
    return config


def _oss_object_url(endpoint: str, bucket: str, object_key: str) -> str:
    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"OSS endpoint 格式错误: {endpoint}")
    encoded_key = quote(object_key.lstrip("/"), safe="/")
    return f"{parsed.scheme}://{bucket}.{parsed.netloc}/{encoded_key}"


def _download_oss_object(oss_config: Dict[str, Any]) -> bytes:
    access_key_id = oss_config["access_key_id"]
    access_key_secret = oss_config["access_key_secret"]
    endpoint = oss_config["endpoint"]
    bucket = oss_config["bucket"]
    object_key = oss_config["cookie_object"].lstrip("/")

    request_date = format_datetime(datetime.now(timezone.utc), usegmt=True)
    canonical_resource = f"/{bucket}/{object_key}"
    string_to_sign = f"GET\n\n\n{request_date}\n{canonical_resource}"
    signature = base64.b64encode(
        hmac.new(
            access_key_secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("ascii")

    request = Request(
        _oss_object_url(endpoint, bucket, object_key),
        headers={
            "Date": request_date,
            "Authorization": f"OSS {access_key_id}:{signature}",
            "User-Agent": "feihe-comment-monitor/1.0",
        },
    )
    timeout = int(oss_config.get("request_timeout_seconds", 30))
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def load_cookie_pool(
    config: Dict[str, Any],
    refresh: bool = True,
    allow_cached: bool = True,
) -> List[Dict[str, str]]:
    """Download token.txt from OSS and return one cookie dict per line.

    If OSS is temporarily unavailable, a previously downloaded local cache can
    be used. The cache contains active cookies and must stay out of version
    control.
    """

    oss_config = config["oss"]
    cache_path = Path(oss_config.get("cookie_cache_file", "token.txt"))
    if not cache_path.is_absolute():
        cache_path = SCRIPT_DIR / cache_path

    raw: Optional[bytes] = None
    download_error: Optional[Exception] = None
    if refresh:
        try:
            raw = _download_oss_object(oss_config)
            cache_path.write_bytes(raw)
            try:
                cache_path.chmod(0o600)
            except OSError:
                pass
        except Exception as exc:
            download_error = exc

    if raw is None and allow_cached and cache_path.exists():
        raw = cache_path.read_bytes()
    if raw is None:
        if download_error:
            raise RuntimeError(f"无法从 OSS 下载 Cookie 池: {download_error}") from download_error
        raise FileNotFoundError(f"Cookie 池不存在: {cache_path}")

    cookies: List[Dict[str, str]] = []
    for line_number, line in enumerate(raw.decode("utf-8-sig").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        value = json.loads(line)
        if not isinstance(value, dict) or not value:
            raise ValueError(f"Cookie 池第 {line_number} 行不是有效对象")
        cookies.append({str(key): str(item) for key, item in value.items()})

    if not cookies:
        raise ValueError("Cookie 池为空")
    return cookies


def make_cookie_header(cookie: Dict[str, str]) -> str:
    return "; ".join(f"{key}={value}" for key, value in cookie.items())
