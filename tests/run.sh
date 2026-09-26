#!/bin/zsh
# מריץ את שתי חבילות-הבדיקה. שימוש: tests/run.sh [URL]   (ברירת-מחדל: שרת מקומי 8746)
cd "$(dirname "$0")/.." || exit 1
export OB2_PW_FILE="${OB2_PW_FILE:-/private/tmp/claude-501/-Users-orperias/d7298096-2519-4dcf-b226-3ec99d3e50f4/scratchpad/app2test.pw}"
if [ -n "$1" ]; then export OB2_URL="$1"; else curl -s -o /dev/null localhost:8746 || (python3 -m http.server 8746 --bind 127.0.0.1 >/dev/null 2>&1 &); sleep 1; fi
node tests/e2e.js | grep -E "^(FAIL|ALL|[0-9]+ FAILED|CRASH)"; node tests/scenarios.js | grep -E "^(FAIL|ALL|[0-9]+ FAILED|CRASH)"
