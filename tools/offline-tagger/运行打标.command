#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

BUNDLED_PYTHON="/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ -x "$BUNDLED_PYTHON" ]]; then
  PYTHON_BIN="$BUNDLED_PYTHON"
else
  PYTHON_BIN=$(command -v python3)
fi

INPUT_FILES=("$@")
if (( ${#INPUT_FILES[@]} == 0 )); then
  if command -v osascript >/dev/null 2>&1; then
    if ! SELECTED_FILE=$(osascript -e 'POSIX path of (choose file with prompt "选择已跑完文案的飞鹤或爱他美千瓜底表" of type {"com.microsoft.excel.xls", "org.openxmlformats.spreadsheetml.sheet"})'); then
      exit 0
    fi
    INPUT_FILES=("$SELECTED_FILE")
  else
    echo "请输入 .xls/.xlsx 底表完整路径："
    read -r SELECTED_FILE
    INPUT_FILES=("$SELECTED_FILE")
  fi
fi

set +e
"$PYTHON_BIN" "$SCRIPT_DIR/一键打标.py" "${INPUT_FILES[@]}"
STATUS=$?
set -e

echo ""
if (( STATUS == 0 )); then
  echo "打标完成，结果保存在源文件旁边的“打标结果”文件夹。"
else
  echo "打标未完成，请根据上方错误信息检查底表。"
fi
echo "按回车键关闭窗口。"
read -r
exit "$STATUS"
