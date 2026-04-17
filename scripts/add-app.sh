#!/usr/bin/env bash
# add-app.sh — 새 앱 번역 대상 추가
#
# 사용:
#   bash scripts/add-app.sh mattermost 50202 /opt/mattermost/i18n
#   bash scripts/add-app.sh outline 50165 /opt/outline/locales
#
# LXC 에서 en.json + ko.json (있으면) 가져와서 <app>/ 디렉토리 생성.

set -euo pipefail

APP="${1:?앱 이름 (예: mattermost, outline)}"
LXC="${2:?LXC ID}"
LOCALE_PATH="${3:?앱 내 locale 디렉토리 경로}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$HERE/$APP"

echo "━━━ $APP 추가 (LXC $LXC) ━━━"

mkdir -p "$APP_DIR"

# en.json 가져오기
echo "[1/3] en.json 가져오기"
if pct exec "$LXC" -- test -f "$LOCALE_PATH/en.json"; then
    pct pull "$LXC" "$LOCALE_PATH/en.json" "$APP_DIR/en.json"
    echo "  ✓ $(wc -c < "$APP_DIR/en.json") bytes"
elif pct exec "$LXC" -- test -f "$LOCALE_PATH/en_US.json"; then
    pct pull "$LXC" "$LOCALE_PATH/en_US.json" "$APP_DIR/en.json"
    echo "  ✓ en_US.json → en.json"
else
    echo "  ✗ en.json 없음 — $LOCALE_PATH 내용:"
    pct exec "$LXC" -- ls "$LOCALE_PATH" 2>&1 | head -10
    exit 1
fi

# ko.json 가져오기 (없으면 빈 파일)
echo "[2/3] ko.json 가져오기"
if pct exec "$LXC" -- test -f "$LOCALE_PATH/ko.json"; then
    pct pull "$LXC" "$LOCALE_PATH/ko.json" "$APP_DIR/ko.json"
    echo "  ✓ $(wc -c < "$APP_DIR/ko.json") bytes"
elif pct exec "$LXC" -- test -f "$LOCALE_PATH/ko_KR.json"; then
    pct pull "$LXC" "$LOCALE_PATH/ko_KR.json" "$APP_DIR/ko.json"
    echo "  ✓ ko_KR.json → ko.json"
else
    echo '{}' > "$APP_DIR/ko.json"
    echo "  ⊘ ko.json 없음 → 빈 파일 생성"
fi

# 커버리지 분석
echo "[3/3] 커버리지 분석"
python3 -c "
import json, sys
en = json.load(open('$APP_DIR/en.json'))
ko = json.load(open('$APP_DIR/ko.json'))

# list-of-dicts (mattermost) vs flat dict (outline)
if isinstance(en, list):
    en_count = len(en)
    ko_ids = {e.get('id') for e in ko} if isinstance(ko, list) else set()
    en_ids = {e.get('id') for e in en}
    missing = len(en_ids - ko_ids)
    fmt = 'mattermost'
elif isinstance(en, dict):
    en_count = len(en)
    ko_count = len(ko)
    missing = en_count - ko_count
    fmt = 'flat'
else:
    print('  ✗ 알 수 없는 포맷')
    sys.exit(1)

pct = (en_count - missing) * 100 // max(en_count, 1)
print(f'  포맷: {fmt}')
print(f'  en: {en_count}  ko: {en_count - missing}  누락: {missing}  커버리지: {pct}%')
"

echo
echo "━━━ 완료 ━━━"
echo "다음:"
echo "  bash scripts/translate-missing.sh $APP --workers 16"
echo "  bash scripts/translate-missing.sh $APP --workers 16 --deploy $LXC"
