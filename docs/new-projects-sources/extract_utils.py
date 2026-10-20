import csv
import io
import re
import datetime

def parse_date(val):
    if not val:
        return None
    s = str(val).strip()
    if re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$", s):
        parts = re.split(r"[-/]", s)
        return f"{parts[0]}-{int(parts[1]):02d}-{int(parts[2]):02d}"
    try:
        num = float(s)
        if 40000 <= num <= 50000:
            d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(num))
            return d.isoformat()
    except:
        pass
    return None

def clean_num(val):
    """
    Parses a string/numeric value into float or None.
    CRITICAL: Preserves genuine 0/0.0 as 0.0.
    Returns None for empty, missing, #N/A, #DIV/0!, #REF!, -, /, etc.
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s == "" or s in ("-", "/", "--", "—", "None", "null"):
        return None
    if any(err in s for err in ("#N/A", "#DIV/0!", "#REF!", "#VALUE!", "#NAME?", "#NULL!", "#NUM!")):
        return None
    s_clean = s.replace("¥", "").replace(",", "").replace("%", "").strip()
    try:
        return float(s_clean)
    except ValueError:
        return None

def parse_annotated_blocks(csv_text):
    """
    Extracts logical row blocks from Lark CLI annotated_csv output.
    Regex matches `[row=N] ...` up to the next `[row=M]` or EOF,
    safely handling multi-line quoted cells without broken splitlines.
    """
    blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', csv_text, flags=re.DOTALL)
    rows = []
    for row_str, content in blocks:
        row_num = int(row_str)
        reader = csv.reader(io.StringIO(content.strip()))
        try:
            cols = next(reader)
        except StopIteration:
            cols = []
        rows.append((row_num, cols))
    return rows

class MetricTracker:
    """
    Tracks metric values, valid count, and missing count for strict missing preservation.
    If missing_count > 0 on a given day/group, final aggregated value is None.
    Audit log retains known_sum, valid_count, missing_count, and coverage.
    """
    def __init__(self, is_int=False):
        self.sum_val = 0.0
        self.valid_count = 0
        self.missing_count = 0
        self.is_int = is_int

    def add(self, val):
        if val is None:
            self.missing_count += 1
        else:
            self.sum_val += float(val)
            self.valid_count += 1

    def get_final(self):
        if self.missing_count > 0:
            return None
        if self.valid_count == 0:
            return None
        if self.is_int:
            return int(round(self.sum_val))
        return round(self.sum_val, 2)

    def get_audit(self):
        total = self.valid_count + self.missing_count
        return {
            "known_sum": round(self.sum_val, 2) if (self.valid_count > 0 and not self.is_int) else (int(round(self.sum_val)) if self.valid_count > 0 else None),
            "valid_count": self.valid_count,
            "missing_count": self.missing_count,
            "coverage_pct": round(self.valid_count / total * 100, 1) if total > 0 else 0.0,
            "has_missing": (self.missing_count > 0)
        }
