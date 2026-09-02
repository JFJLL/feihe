#!/usr/bin/env python3
"""根据关键词规则给千瓜 Excel 底表打 SPU 和内容类型标签。

仅依赖 Python 标准库。输入为 .xls 时调用 LibreOffice 将副本转换为 .xlsx；
随后直接修改 xlsx 内的工作表 XML，以保留原工作簿中绝大多数格式与对象。
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from collections import Counter, defaultdict
from copy import copy
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NS = {"x": MAIN_NS, "r": REL_NS, "pr": PKG_REL_NS}
ET.register_namespace("", MAIN_NS)
ET.register_namespace("r", REL_NS)


def normalize(value: object) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"[\s\u200b\ufeff]+", "", text)


def split_keywords(value: object) -> list[str]:
    if value is None:
        return []
    parts = re.split(r"[、,，;；\n]+", str(value))
    return [p.strip().strip("。.!！?？\"'“”‘’") for p in parts if p.strip()]


def col_number(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref.upper())
    if not letters:
        raise ValueError(f"非法单元格地址: {cell_ref}")
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - 64
    return value


def col_letter(number: int) -> str:
    chars: list[str] = []
    while number:
        number, remainder = divmod(number - 1, 26)
        chars.append(chr(65 + remainder))
    return "".join(reversed(chars))


class XlsxReader:
    def __init__(self, path: Path):
        self.path = path
        self.zip = zipfile.ZipFile(path)
        self.shared_strings = self._load_shared_strings()
        self.sheets = self._load_sheets()

    def close(self) -> None:
        self.zip.close()

    def __enter__(self) -> "XlsxReader":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def _load_shared_strings(self) -> list[str]:
        try:
            root = ET.fromstring(self.zip.read("xl/sharedStrings.xml"))
        except KeyError:
            return []
        return ["".join(t.text or "" for t in item.findall(".//x:t", NS)) for item in root.findall("x:si", NS)]

    def _load_sheets(self) -> dict[str, str]:
        workbook = ET.fromstring(self.zip.read("xl/workbook.xml"))
        rels = ET.fromstring(self.zip.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in rels.findall("pr:Relationship", NS)}
        result: dict[str, str] = {}
        for sheet in workbook.findall("x:sheets/x:sheet", NS):
            rid = sheet.attrib[f"{{{REL_NS}}}id"]
            target = targets[rid].lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            result[sheet.attrib["name"]] = os.path.normpath(target).replace("\\", "/")
        return result

    def sheet_tree(self, sheet_name: str) -> ET.Element:
        return ET.fromstring(self.zip.read(self.sheets[sheet_name]))

    def cell_value(self, cell: ET.Element) -> str:
        cell_type = cell.attrib.get("t")
        if cell_type == "inlineStr":
            return "".join(t.text or "" for t in cell.findall(".//x:t", NS))
        value = cell.find("x:v", NS)
        if value is None or value.text is None:
            return ""
        if cell_type == "s":
            index = int(value.text)
            return self.shared_strings[index] if 0 <= index < len(self.shared_strings) else ""
        if cell_type == "b":
            return "TRUE" if value.text == "1" else "FALSE"
        return value.text

    def rows(self, sheet_name: str) -> Iterable[tuple[int, dict[int, str]]]:
        root = self.sheet_tree(sheet_name)
        for row in root.findall("x:sheetData/x:row", NS):
            row_number = int(row.attrib.get("r", "0"))
            values = {col_number(c.attrib["r"]): self.cell_value(c) for c in row.findall("x:c", NS)}
            yield row_number, values

    def table(self, sheet_name: str) -> tuple[dict[str, int], list[tuple[int, dict[int, str]]]]:
        iterator = iter(self.rows(sheet_name))
        try:
            _header_row, header_values = next(iterator)
        except StopIteration as exc:
            raise ValueError(f"工作表为空: {sheet_name}") from exc
        headers = {str(value).strip(): column for column, value in header_values.items() if str(value).strip()}
        return headers, list(iterator)


def find_sheet(reader: XlsxReader, required_headers: set[str], preferred: str | None = None) -> str:
    candidates = ([preferred] if preferred else []) + [name for name in reader.sheets if name != preferred]
    for name in candidates:
        if not name or name not in reader.sheets:
            continue
        headers, _ = reader.table(name)
        if required_headers.issubset(headers):
            return name
    raise ValueError(f"找不到包含字段 {sorted(required_headers)} 的工作表。现有工作表: {list(reader.sheets)}")


def find_main_sheet(reader: XlsxReader, preferred: str | None = None) -> tuple[str, str]:
    """查找主表，并兼容“飞鹤内容类型”“爱他美内容类型”等品牌化列名。"""
    candidates = ([preferred] if preferred else []) + [name for name in reader.sheets if name != preferred]
    for name in candidates:
        if not name or name not in reader.sheets:
            continue
        headers, _ = reader.table(name)
        if not {"笔记链接", "SPU列"}.issubset(headers):
            continue
        type_headers = [
            header
            for header in headers
            if header != "笔记类型" and header.endswith("内容类型")
        ]
        if type_headers:
            return name, type_headers[0]
    raise ValueError(
        "找不到同时包含“笔记链接”“SPU列”和品牌内容类型列的主表。"
        f"现有工作表: {list(reader.sheets)}"
    )


def ensure_xlsx(input_path: Path, work_dir: Path, soffice: str | None) -> Path:
    if input_path.suffix.lower() == ".xlsx":
        return input_path
    if input_path.suffix.lower() != ".xls":
        raise ValueError("数据文件仅支持 .xls 或 .xlsx")
    executable = soffice or shutil.which("soffice") or shutil.which("libreoffice")
    if not executable:
        raise RuntimeError("输入为 .xls，但未找到 LibreOffice/soffice。请安装 LibreOffice 或用 --soffice 指定路径。")
    command = [executable, "--headless", "--convert-to", "xlsx", "--outdir", str(work_dir), str(input_path)]
    result = subprocess.run(command, capture_output=True, text=True)
    converted = work_dir / f"{input_path.stem}.xlsx"
    if result.returncode != 0 or not converted.exists():
        message = (result.stderr or result.stdout or "未知错误").strip()
        raise RuntimeError(f"LibreOffice 转换失败: {message}")
    return converted


def parse_rules(rule_path: Path) -> tuple[dict[str, list[str]], dict[str, dict[str, list[str]]]]:
    with XlsxReader(rule_path) as reader:
        content_sheet = find_sheet(reader, {"方向", "典型关键词"}, "内容类型")
        headers, rows = reader.table(content_sheet)
        content_rules: dict[str, list[str]] = {}
        for _row_number, values in rows:
            label = values.get(headers["方向"], "").strip()
            if label:
                content_rules[label] = split_keywords(values.get(headers["典型关键词"], ""))

        spu_sheet = find_sheet(reader, {"品牌", "SKU"}, "SPU")
        headers, rows = reader.table(spu_sheet)
        spu_rules: dict[str, dict[str, list[str]]] = {}
        for _row_number, values in rows:
            brand = values.get(headers["品牌"], "").strip()
            if not brand:
                continue
            products = [x for x in split_keywords(values.get(headers["SKU"], "")) if x != "其他"]
            spu_rules[brand] = {product: [product] for product in products}
    return content_rules, spu_rules


def merge_aliases(spu_rules: dict[str, dict[str, list[str]]], config: dict) -> None:
    configured = config.get("SKU别名", {})
    for brand, products in spu_rules.items():
        for product in products:
            aliases = [product]
            if product.startswith(brand) and len(product) > len(brand):
                aliases.append(product[len(brand):])
            aliases.extend(configured.get(product, []))
            products[product] = list(dict.fromkeys(a for a in aliases if a))


def detect_spu(text: str, spu_rules: dict[str, dict[str, list[str]]], config: dict) -> tuple[str, list[str], set[str]]:
    normalized = normalize(text)
    hits: list[str] = []
    hit_brands: set[str] = set()
    for brand, products in spu_rules.items():
        for product, aliases in products.items():
            if any(normalize(alias) in normalized for alias in aliases):
                hits.append(product)
                hit_brands.add(brand)
    hits = list(dict.fromkeys(hits))
    brand_aliases = config.get("品牌别名", {})
    for brand in spu_rules:
        aliases = brand_aliases.get(brand, [brand])
        if any(normalize(alias) in normalized for alias in aliases):
            hit_brands.add(brand)
    if hits:
        return "、".join(hits), hits, hit_brands
    if hit_brands:
        return "其他", [], hit_brands
    return config.get("未命中标签", "未命中"), [], set()


def detect_brand_spu(
    text: str,
    brand: str,
    config: dict,
) -> tuple[str, list[str], set[str], str] | None:
    """按品牌特殊规则选出唯一 SPU；多命中时选择所在文本行最长的关键词。"""
    rule = config.get("品牌SPU特殊规则", {}).get(brand)
    if not rule:
        return None
    product_rules = rule.get("产品规则")
    if not product_rules:
        # 兼容早期“候选关键词/直接输出关键词”配置。
        direct = set(rule.get("直接输出关键词", []))
        product_rules = [
            {
                "产品": keyword,
                "输出标签": keyword if keyword in direct else rule.get("其他标签", "其他"),
                "关键词": [keyword],
            }
            for keyword in list(dict.fromkeys(rule.get("候选关键词", [])))
        ]

    # 元组排序：所在行字符数 > 命中别名长度 > 产品配置顺序 > 别名顺序 > 首次出现行。
    # 除配置的显式别名外，自动剥离“飞鹤/星飞帆”等品牌前缀，
    # 使“星飞帆卓初”可由文案中的“卓初”命中，同时仍由最长行规则决定最终 SPU。
    matches: list[tuple[int, int, int, int, int, str, str, str]] = []
    lines = text.splitlines() or [text]
    short_name_prefixes = sorted(
        config.get("SPU自动简称前缀", ["飞鹤星飞帆", "星飞帆", "飞鹤"]),
        key=lambda item: len(normalize(item)),
        reverse=True,
    )
    for product_order, product_rule in enumerate(product_rules):
        product = product_rule["产品"]
        output_label = product_rule.get("输出标签", product)
        product_keywords = list(product_rule.get("关键词", [product]))
        normalized_product = normalize(product)
        for prefix in short_name_prefixes:
            normalized_prefix = normalize(prefix)
            if normalized_product.startswith(normalized_prefix):
                short_name = normalized_product[len(normalized_prefix):]
                if len(short_name) >= 2:
                    product_keywords.append(short_name)
                break
        for alias_order, keyword in enumerate(dict.fromkeys(product_keywords)):
            normalized_keyword = normalize(keyword)
            if not normalized_keyword:
                continue
            for line_number, line in enumerate(lines):
                if normalized_keyword in normalize(line):
                    matches.append((
                        len(line),
                        len(normalized_keyword),
                        -product_order,
                        -alias_order,
                        -line_number,
                        product,
                        output_label,
                        keyword,
                    ))
    if not matches:
        return config.get("未命中标签", "未命中"), [], set(), "未命中任一指定SPU关键词"
    best_line_length, _alias_length, _product_order, _alias_order, _line_number, product, label, chosen_keyword = max(matches)
    matched_products = {
        item[5]
        for item in matches
    }
    all_hits = [
        product_rule["产品"]
        for product_rule in product_rules
        if product_rule["产品"] in matched_products
    ]
    evidence = f"命中:{chosen_keyword}→{product}；所在行字符数:{best_line_length}"
    return label, all_hits, {brand}, evidence


def count_known_brands(text: str, config: dict) -> int:
    normalized = normalize(text)
    groups = config.get("奶粉品牌组", {})
    return sum(
        1
        for aliases in groups.values()
        if any(normalize(alias) in normalized for alias in aliases)
    )


def content_tag(
    text: str,
    workbook_keywords: dict[str, list[str]],
    product_hits: list[str],
    product_brands: set[str],
    config: dict,
) -> tuple[str, int, list[str], dict[str, int]]:
    normalized = normalize(text)
    supplements = config.get("内容类型补充关键词", {})
    scores: dict[str, int] = {}
    evidence: dict[str, list[str]] = {}

    all_labels = list(workbook_keywords)
    all_labels.extend(label for label in supplements if label not in workbook_keywords)
    for label in all_labels:
        rule_keywords = workbook_keywords.get(label, [])
        label_hits: list[str] = []
        score = 0
        for keyword in rule_keywords:
            if normalize(keyword) and normalize(keyword) in normalized:
                label_hits.append(keyword)
                score += 4
        extra = supplements.get(label, {})
        for keyword in extra.get("强关键词", []):
            if normalize(keyword) and normalize(keyword) in normalized and keyword not in label_hits:
                label_hits.append(keyword)
                score += 4
        for keyword in extra.get("弱关键词", []):
            if normalize(keyword) and normalize(keyword) in normalized and keyword not in label_hits:
                label_hits.append(keyword)
                score += 1
        scores[label] = score
        evidence[label] = label_hits

    compare_signal = any(
        normalize(x) in normalized
        for x in [
            "对比", "vs", "pk", "横评", "横测", "差异", "二选一", "对决",
            "哪个好", "哪款", "谁更", "怎么选", "区别",
        ]
    )
    transfer_signal = any(normalize(x) in normalized for x in ["转奶", "换奶", "换成", "转到", "原来喝", "之前喝"])
    known_brand_count = max(count_known_brands(text, config), len(product_brands))
    explicit_old_to_new = bool(
        re.search(r"(?:从|之前|原来).{0,30}(?:换|转).{0,20}(?:到|成|喝)", normalized)
    )

    if len(product_hits) >= 2 and len(product_brands) <= 1:
        scores["本品纵测"] = scores.get("本品纵测", 0) + 12 + (4 if compare_signal else 0)
        evidence.setdefault("本品纵测", []).append("同品牌2款及以上SKU")
    if known_brand_count >= 2 and compare_signal:
        scores["竞品横测"] = scores.get("竞品横测", 0) + 14
        evidence.setdefault("竞品横测", []).append("2个及以上品牌+对比信号")
    qualified_transfer = transfer_signal and (known_brand_count >= 2 or explicit_old_to_new)
    if qualified_transfer:
        scores["1v1 转奶"] = scores.get("1v1 转奶", 0) + 8
        evidence.setdefault("1v1 转奶", []).append("旧品→新品转奶叙事")
    elif "1v1 转奶" in scores:
        # 规则表要求出现明确的旧品牌→新品牌叙事；只有“转奶期”等字样不成立。
        scores["1v1 转奶"] = min(scores["1v1 转奶"], 3)
        evidence["1v1 转奶"] = []
    if not (known_brand_count >= 2 and compare_signal) and "竞品横测" in scores:
        # “家庭PK”“怎么选”等普通措辞不能单独证明存在竞品横测。
        scores["竞品横测"] = min(scores["竞品横测"], 3)
        evidence["竞品横测"] = []
    if any(normalize(x) in normalized for x in ["敏宝", "乳蛋白过敏", "水解奶粉", "氨基酸奶粉", "脱敏"]):
        scores["敏宝选奶"] = scores.get("敏宝选奶", 0) + 8
    if any(normalize(x) in normalized for x in ["618", "双11", "双十一", "双12", "双十二", "大促", "到手价"]):
        scores["电商活动类"] = scores.get("电商活动类", 0) + 8
    if any(normalize(x) in normalized for x in ["品牌日", "中国宝宝日", "528中国宝宝日", "品牌溯源", "发布会"]):
        scores["品牌活动类"] = scores.get("品牌活动类", 0) + 8

    priority = config.get("内容类型优先级", list(workbook_keywords))
    rank = {label: index for index, label in enumerate(priority)}
    best_label = max(scores, key=lambda label: (scores[label], -rank.get(label, 9999)))
    best_score = scores[best_label]
    if best_score < int(config.get("最低内容类型分数", 4)):
        return config.get("未命中标签", "未命中"), best_score, [], scores
    return best_label, best_score, list(dict.fromkeys(evidence.get(best_label, []))), scores


def fallback_content_tag(
    text: str,
    config: dict,
    allow_short_post: bool = True,
) -> tuple[str, int, list[str]]:
    """关键词分数不足时，按可配置的语义信号顺序给出保守兜底标签。"""
    normalized = normalize(text)
    for rule in config.get("内容类型兜底规则", []):
        for keyword in rule.get("关键词", []):
            if normalize(keyword) and normalize(keyword) in normalized:
                return rule["标签"], 4, [f"兜底关键词:{keyword}"]
    visible_text = re.sub(r"#.*?\[话题\]#", "", text, flags=re.S).strip()
    if allow_short_post and len(visible_text) <= 80:
        return "随手 po", 4, ["兜底规则:短文案/话题露出"]
    return config.get("有SPU默认内容类型", "单品直推"), 4, ["兜底规则:有SPU的产品内容"]


def extract_uid(link: str) -> str:
    match = re.search(r"[0-9a-fA-F]{24}", link or "")
    return match.group(0).lower() if match else ""


def extract_json_content(raw: str) -> str:
    if not raw or not raw.lstrip().startswith("{"):
        return ""
    try:
        payload = json.loads(raw)
        return str(payload.get("data", {}).get("content", ""))
    except (json.JSONDecodeError, AttributeError, TypeError):
        return ""


def set_inline_string(cell: ET.Element, value: str) -> None:
    style = cell.attrib.get("s")
    ref = cell.attrib["r"]
    cell.clear()
    cell.attrib["r"] = ref
    if style is not None:
        cell.attrib["s"] = style
    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, f"{{{MAIN_NS}}}is")
    text = ET.SubElement(inline, f"{{{MAIN_NS}}}t")
    if value[:1].isspace() or value[-1:].isspace():
        text.attrib[f"{{{XML_NS}}}space"] = "preserve"
    text.text = value


def patch_sheet(source: Path, output: Path, sheet_path: str, updates: dict[int, dict[int, str]]) -> None:
    with zipfile.ZipFile(source) as source_zip:
        root = ET.fromstring(source_zip.read(sheet_path))
        sheet_data = root.find("x:sheetData", NS)
        if sheet_data is None:
            raise ValueError("目标工作表没有 sheetData")
        rows = {int(row.attrib["r"]): row for row in sheet_data.findall("x:row", NS)}
        for row_number, columns in updates.items():
            row = rows.get(row_number)
            if row is None:
                row = ET.SubElement(sheet_data, f"{{{MAIN_NS}}}row", {"r": str(row_number)})
                rows[row_number] = row
            existing = {col_number(cell.attrib["r"]): cell for cell in row.findall("x:c", NS)}
            for column, value in columns.items():
                cell = existing.get(column)
                if cell is None:
                    cell = ET.Element(f"{{{MAIN_NS}}}c", {"r": f"{col_letter(column)}{row_number}"})
                    cells = list(row.findall("x:c", NS))
                    insert_at = next((i for i, other in enumerate(cells) if col_number(other.attrib["r"]) > column), len(cells))
                    row.insert(insert_at, cell)
                set_inline_string(cell, value)
        replacement = ET.tostring(root, encoding="utf-8", xml_declaration=True)

        output.parent.mkdir(parents=True, exist_ok=True)
        temp_output = output.with_suffix(output.suffix + ".tmp")
        with zipfile.ZipFile(temp_output, "w") as target_zip:
            for info in source_zip.infolist():
                data = replacement if info.filename == sheet_path else source_zip.read(info.filename)
                cloned = copy(info)
                target_zip.writestr(cloned, data)
        os.replace(temp_output, output)


def run(args: argparse.Namespace) -> tuple[Path, Path, Counter, Counter]:
    data_path = Path(args.data).expanduser().resolve()
    rule_path = Path(args.rules).expanduser().resolve()
    config_path = Path(args.config).expanduser().resolve()
    if not data_path.exists() or not rule_path.exists() or not config_path.exists():
        missing = [str(p) for p in [data_path, rule_path, config_path] if not p.exists()]
        raise FileNotFoundError("文件不存在: " + ", ".join(missing))
    config = json.loads(config_path.read_text(encoding="utf-8"))
    workbook_keywords, spu_rules = parse_rules(rule_path)
    merge_aliases(spu_rules, config)

    output = Path(args.output).expanduser().resolve() if args.output else data_path.with_name(f"{data_path.stem}_已打标.xlsx")
    audit = Path(args.audit).expanduser().resolve() if args.audit else output.with_name(f"{output.stem}_命中明细.csv")
    if output == data_path:
        raise ValueError("输出路径不能与源数据相同；脚本不会覆盖原始底表")

    with tempfile.TemporaryDirectory(prefix="feihe_tagger_") as temp_name:
        converted = ensure_xlsx(data_path, Path(temp_name), args.soffice)
        with XlsxReader(converted) as reader:
            main_sheet, type_header = find_main_sheet(reader, args.main_sheet)
            main_headers, main_rows = reader.table(main_sheet)
            content_by_uid: dict[str, str] = {}
            try:
                detail_sheet = find_sheet(reader, {"UID", "content"}, args.content_sheet)
            except ValueError as exc:
                # 部分千瓜导出只含主表，没有 UID/content 明细表。
                # 这种情况下使用标题与报备合作品牌做可审计的降级打标。
                if not getattr(args, "allow_title_only", False):
                    raise ValueError(
                        "未找到包含 UID/content 的完整文案明细表，请先跑文案后再打标。"
                        "如确需只用标题降级打标，请加 --allow-title-only。"
                    ) from exc
                detail_sheet = None
            if detail_sheet:
                detail_headers, detail_rows = reader.table(detail_sheet)
                for _row_number, values in detail_rows:
                    uid = values.get(detail_headers["UID"], "").strip().lower()
                    content = values.get(detail_headers["content"], "")
                    if not content and "Content" in detail_headers:
                        content = extract_json_content(values.get(detail_headers["Content"], ""))
                    if uid:
                        content_by_uid[uid] = content

            title_col = main_headers.get("笔记标题")
            link_col = main_headers["笔记链接"]
            spu_col = main_headers["SPU列"]
            type_col = main_headers[type_header]
            direct_content_col = main_headers.get("笔记文案") or main_headers.get("content")
            reported_brand_col = main_headers.get("报备合作品牌")
            target_brand = type_header[: -len("内容类型")].strip()
            supported_brands = config.get("品牌SPU特殊规则", {})
            if target_brand not in supported_brands:
                raise ValueError(
                    f"不支持品牌“{target_brand}”；当前仅支持: "
                    + "、".join(supported_brands)
                )
            output_spu_rules = (
                {target_brand: spu_rules[target_brand]}
                if target_brand in spu_rules
                else spu_rules
            )
            updates: dict[int, dict[int, str]] = {}
            audit_rows: list[list[object]] = []
            content_counts: Counter = Counter()
            spu_counts: Counter = Counter()

            for row_number, values in main_rows:
                link = values.get(link_col, "")
                uid = extract_uid(link)
                content = values.get(direct_content_col, "") if direct_content_col else content_by_uid.get(uid, "")
                title = values.get(title_col, "") if title_col else ""
                if content:
                    judged_text = f"{title}\n{content}" if config.get("标题参与判断", True) else content
                else:
                    reported_brand = values.get(reported_brand_col, "") if reported_brand_col else ""
                    title_spu = detect_brand_spu(title, target_brand, config)
                    title_has_spu = bool(
                        title_spu
                        and title_spu[0] != config.get("未命中标签", "未命中")
                    )
                    metadata_items = [title]
                    if not title_has_spu:
                        metadata_items.append(reported_brand)
                    judged_text = "\n".join(item for item in metadata_items if item)
                # 输出 SPU 优先使用品牌特殊规则；全部品牌/SKU 仍用于竞品横测等结构判断。
                special_spu = detect_brand_spu(judged_text, target_brand, config)
                if special_spu is not None:
                    spu_label, target_products, target_brands, spu_evidence = special_spu
                else:
                    spu_label, target_products, target_brands = detect_spu(judged_text, output_spu_rules, config)
                    spu_evidence = "命中:" + "、".join(target_products) if target_products else spu_label
                _all_spu_label, product_hits, product_brands = detect_spu(judged_text, spu_rules, config)
                product_hits = list(dict.fromkeys(product_hits + target_products))
                product_merge = config.get("SPU内容判定归并", {})
                product_hits = list(dict.fromkeys(product_merge.get(product, product) for product in product_hits))
                product_brands |= target_brands
                type_label, score, hits, _scores = content_tag(
                    judged_text, workbook_keywords, product_hits, product_brands, config
                )
                no_spu_type = config.get("品牌SPU未命中内容类型", {}).get(target_brand)
                if spu_label == config.get("未命中标签", "未命中") and no_spu_type:
                    type_label, score, hits = no_spu_type, 100, ["兜底规则:未命中任一指定SPU关键词"]
                elif type_label == config.get("未命中标签", "未命中"):
                    type_label, score, hits = fallback_content_tag(
                        judged_text,
                        config,
                        allow_short_post=bool(content),
                    )
                updates[row_number] = {spu_col: spu_label, type_col: type_label}
                content_counts[type_label] += 1
                spu_counts[spu_label] += 1
                audit_rows.append([
                    row_number,
                    uid,
                    title,
                    len(content),
                    spu_label,
                    spu_evidence,
                    type_label,
                    score,
                    "、".join(hits),
                ])

            patch_sheet(converted, output, reader.sheets[main_sheet], updates)

    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "Excel行号",
            "UID",
            "笔记标题",
            "文案字数",
            "SPU标签",
            "SPU命中依据",
            "内容类型",
            "内容类型分数",
            "内容类型命中依据",
        ])
        writer.writerows(audit_rows)

    return output, audit, content_counts, spu_counts


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="根据关键词规则对千瓜 Excel 底表打标")
    parser.add_argument("--data", required=True, help="待打标 .xls/.xlsx 底表")
    parser.add_argument("--rules", default="竞品打标关键词拆分.xlsx", help="规则工作簿")
    parser.add_argument("--config", default="关键词打标配置.json", help="补充关键词与优先级配置")
    parser.add_argument("--output", help="输出 .xlsx；默认在源文件旁生成 *_已打标.xlsx")
    parser.add_argument("--audit", help="命中明细 CSV；默认在输出文件旁生成")
    parser.add_argument("--main-sheet", help="主表名称；默认按字段自动识别")
    parser.add_argument("--content-sheet", help="文案明细表名称；默认按 UID/content 字段自动识别")
    parser.add_argument(
        "--allow-title-only",
        action="store_true",
        help="缺少 UID/content 明细表时允许只用标题降级打标（默认禁止）",
    )
    parser.add_argument("--soffice", help="LibreOffice soffice 可执行文件路径")
    return parser


def main() -> int:
    try:
        output, audit, content_counts, spu_counts = run(build_parser().parse_args())
    except Exception as exc:  # 给批处理调用方明确的非零退出码
        print(f"打标失败: {exc}", file=sys.stderr)
        return 1
    print(f"已生成: {output}")
    print(f"命中明细: {audit}")
    print("内容类型统计:", json.dumps(content_counts, ensure_ascii=False, sort_keys=True))
    print("SPU统计:", json.dumps(spu_counts, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
