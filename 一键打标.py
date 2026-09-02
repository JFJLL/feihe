#!/usr/bin/env python3
"""飞鹤/爱他美千瓜底表一键打标入口。

用法：
    python3 一键打标.py "爱他美六月千瓜数据底表.xls"
    python3 一键打标.py "飞鹤六月千瓜数据底表.xls" "爱他美六月千瓜数据底表.xls"

脚本通过主表的“飞鹤内容类型/爱他美内容类型”列自动识别品牌，
并切换对应的 SPU 与内容类型判定视角。
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from argparse import Namespace
from pathlib import Path

from keyword_tagger import run


SCRIPT_DIR = Path(__file__).resolve().parent
RULES_PATH = SCRIPT_DIR / "竞品打标关键词拆分.xlsx"
CONFIG_PATH = SCRIPT_DIR / "关键词打标配置.json"


def find_soffice(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    discovered = shutil.which("soffice") or shutil.which("libreoffice")
    if discovered:
        return discovered
    candidates = [
        Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
        Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice",
    ]
    return str(next((path for path in candidates if path.exists()), "")) or None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="自动识别飞鹤/爱他美底表，根据标题与完整文案打 SPU 和内容类型标签"
    )
    parser.add_argument("数据文件", nargs="+", help="一个或多个 .xls/.xlsx 千瓜底表")
    parser.add_argument(
        "--output-dir",
        help="输出目录；默认在每个源文件旁边建立“打标结果”文件夹",
    )
    parser.add_argument("--soffice", help="LibreOffice soffice 可执行文件路径")
    parser.add_argument(
        "--allow-title-only",
        action="store_true",
        help="缺少完整文案明细表时，允许仅用标题降级打标",
    )
    return parser


def output_paths(data_path: Path, output_dir: str | None) -> tuple[Path, Path]:
    directory = Path(output_dir).expanduser().resolve() if output_dir else data_path.parent / "打标结果"
    output = directory / f"{data_path.stem}_已打标.xlsx"
    audit = directory / f"{data_path.stem}_已打标_命中明细.csv"
    return output, audit


def main() -> int:
    args = build_parser().parse_args()
    if not RULES_PATH.exists() or not CONFIG_PATH.exists():
        print("缺少规则文件，请保持以下文件与本脚本在同一目录：", file=sys.stderr)
        print(f"- {RULES_PATH.name}\n- {CONFIG_PATH.name}", file=sys.stderr)
        return 2

    # 提前校验 JSON，让用户修改关键词后能获得清晰错误。
    try:
        json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"配置文件无法读取: {exc}", file=sys.stderr)
        return 2

    soffice = find_soffice(args.soffice)
    failures = 0
    for raw_path in args.数据文件:
        data_path = Path(raw_path).expanduser().resolve()
        if data_path.suffix.lower() not in {".xls", ".xlsx"}:
            print(f"[ERROR] 仅支持 .xls/.xlsx: {data_path}", file=sys.stderr)
            failures += 1
            continue
        output, audit = output_paths(data_path, args.output_dir)
        task_args = Namespace(
            data=str(data_path),
            rules=str(RULES_PATH),
            config=str(CONFIG_PATH),
            output=str(output),
            audit=str(audit),
            main_sheet=None,
            content_sheet=None,
            soffice=soffice,
            allow_title_only=args.allow_title_only,
        )
        try:
            result_output, result_audit, content_counts, spu_counts = run(task_args)
        except Exception as exc:  # 批量时继续处理后续文件
            print(f"[ERROR] {data_path.name}: {exc}", file=sys.stderr)
            failures += 1
            continue
        print(f"[OK] {data_path.name}")
        print(f"  结果: {result_output}")
        print(f"  明细: {result_audit}")
        print("  SPU:", json.dumps(spu_counts, ensure_ascii=False, sort_keys=True))
        print("  内容类型:", json.dumps(content_counts, ensure_ascii=False, sort_keys=True))
        with result_audit.open(encoding="utf-8-sig", newline="") as handle:
            audit_rows = list(csv.DictReader(handle))
        content_present = sum(int(row["文案字数"] or 0) > 0 for row in audit_rows)
        content_missing = len(audit_rows) - content_present
        print(f"  文案覆盖: {content_present}/{len(audit_rows)}")
        if content_missing:
            print(
                f"  [WARN] {content_missing} 条笔记未关联到文案，已使用标题"
                "（必要时加报备品牌）降级判定。"
            )

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
