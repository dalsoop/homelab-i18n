#!/usr/bin/env bash
# translate-missing.sh — 앱별 누락 키 추출 → 번역 → 병합
#
# 지원 포맷:
#   mattermost  [{id, translation}, ...]    (JSON array)
#   outline     {key: value}                (flat JSON)
#   sentry      phs-sentry-i18n 파이프라인   (별도)
#
# 사용:
#   bash scripts/translate-missing.sh mattermost [--workers 16] [--deploy LXC_ID]
#   bash scripts/translate-missing.sh outline [--workers 16]

set -euo pipefail

APP="${1:?앱 이름 (mattermost|outline|formbricks|medusa)}"
shift
WORKERS=16
DEPLOY_LXC=""
CONTEXT="self-hosted app UI label in Korean, concise"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workers) WORKERS="$2"; shift 2 ;;
    --deploy) DEPLOY_LXC="$2"; shift 2 ;;
    --context) CONTEXT="$2"; shift 2 ;;
    *) echo "unknown: $1"; exit 1 ;;
  esac
done

HERE="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$HERE/$APP"
GLOSSARY="$HERE/shared/glossary.json"
TRANSLATE_API="${TRANSLATE_API:-http://10.0.60.108:8080}"

[[ -d "$APP_DIR" ]] || { echo "디렉토리 없음: $APP_DIR"; exit 1; }

echo "━━━ $APP 번역 시작 ━━━"
echo "workers=$WORKERS  api=$TRANSLATE_API"
echo

case "$APP" in
  mattermost)
    EN="$APP_DIR/en.json"
    KO="$APP_DIR/ko.json"
    [[ -f "$EN" && -f "$KO" ]] || { echo "en.json / ko.json 없음"; exit 1; }

    # 1) 누락 키 추출
    echo "[1/4] 누락 키 추출"
    python3 - "$EN" "$KO" "$APP_DIR/missing.json" <<'PY'
import json, sys
en = {e['id']: e['translation'] for e in json.load(open(sys.argv[1]))}
ko = {e['id']: e.get('translation','') for e in json.load(open(sys.argv[2]))}
missing = {k: v for k, v in en.items() if k not in ko}
json.dump(missing, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2)
print(f"  누락: {len(missing)}개")
PY

    COUNT=$(python3 -c "import json; print(len(json.load(open('$APP_DIR/missing.json'))))")
    [[ "$COUNT" == "0" ]] && { echo "  이미 100% 번역됨!"; exit 0; }

    # 2) 번역
    echo "[2/4] 번역 ($COUNT개, workers=$WORKERS)"
    TRANSLATE_API="$TRANSLATE_API" \
      phs-translate -i "$APP_DIR/missing.json" -o "$APP_DIR/translated.json" \
        -w "$WORKERS" -c "$CONTEXT" -s en -t ko

    # 3) 글로서리 오버라이드
    echo "[3/4] 글로서리 적용"
    python3 - "$APP_DIR/translated.json" "$GLOSSARY" "$APP_DIR/translated.json" <<'PY'
import json, sys
tr = json.load(open(sys.argv[1]))
gl = json.load(open(sys.argv[2])) if __import__('os').path.exists(sys.argv[2]) else {}
applied = 0
for k in tr:
    g = gl.get(k)
    if isinstance(g, dict) and 'ko' in g:
        tr[k] = g['ko']; applied += 1
    elif isinstance(g, str):
        tr[k] = g; applied += 1
    # normalized
    for gk, gv in gl.items():
        if gk.strip().lower() == k.strip().lower():
            if isinstance(gv, dict) and 'ko' in gv:
                tr[k] = gv['ko']; applied += 1; break
            elif isinstance(gv, str):
                tr[k] = gv; applied += 1; break
json.dump(tr, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2)
print(f"  글로서리 적용: {applied}건")
PY

    # 4) 병합 → ko-patched.json
    echo "[4/4] 병합 → ko-patched.json"
    python3 - "$KO" "$APP_DIR/translated.json" "$APP_DIR/ko-patched.json" <<'PY'
import json, sys
ko = json.load(open(sys.argv[1]))
tr = json.load(open(sys.argv[2]))
ko_map = {e['id']: e for e in ko}
for mid, translation in tr.items():
    if mid not in ko_map:
        ko.append({"id": mid, "translation": translation})
    else:
        ko_map[mid]['translation'] = translation
json.dump(ko, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2)
print(f"  최종: {len(ko)}개 (en: {len(json.load(open(sys.argv[1])))} → patched: {len(ko)})")
PY
    ;;

  outline|formbricks|medusa)
    EN="$APP_DIR/en.json"
    KO="$APP_DIR/ko.json"
    [[ -f "$EN" ]] || { echo "en.json 없음: $APP_DIR"; exit 1; }

    echo "[1/3] 누락 키 추출"
    python3 - "$EN" "$KO" "$APP_DIR/missing.json" <<'PY'
import json, sys, os
en = json.load(open(sys.argv[1]))
ko = json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else {}
missing = {k: v for k, v in en.items() if k not in ko}
json.dump(missing, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2)
print(f"  누락: {len(missing)}개 (en={len(en)} ko={len(ko)})")
PY

    COUNT=$(python3 -c "import json; print(len(json.load(open('$APP_DIR/missing.json'))))")
    [[ "$COUNT" == "0" ]] && { echo "  이미 100% 번역됨!"; exit 0; }

    echo "[2/3] 번역 ($COUNT개)"
    TRANSLATE_API="$TRANSLATE_API" \
      phs-translate -i "$APP_DIR/missing.json" -o "$APP_DIR/translated.json" \
        -w "$WORKERS" -c "$CONTEXT" -s en -t ko

    echo "[3/3] 병합 → ko-patched.json"
    python3 - "$KO" "$APP_DIR/translated.json" "$APP_DIR/ko-patched.json" <<'PY'
import json, sys, os
ko = json.load(open(sys.argv[1])) if os.path.exists(sys.argv[1]) else {}
tr = json.load(open(sys.argv[2]))
ko.update(tr)
json.dump(ko, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2, sort_keys=True)
print(f"  최종: {len(ko)}개")
PY
    ;;

  sentry)
    echo "sentry 는 phs-sentry-i18n 파이프라인 사용:"
    echo "  phs-sentry-i18n --bust sync"
    exit 0
    ;;

  *)
    echo "미지원 앱: $APP"
    echo "지원: mattermost, outline, formbricks, medusa, sentry"
    exit 1
    ;;
esac

echo
echo "━━━ 완료 ━━━"
echo "결과: $APP_DIR/ko-patched.json"

if [[ -n "$DEPLOY_LXC" ]]; then
  echo
  echo "[deploy] LXC $DEPLOY_LXC 에 배포"
  case "$APP" in
    mattermost)
      pct push "$DEPLOY_LXC" "$APP_DIR/ko-patched.json" /opt/mattermost/i18n/ko.json
      pct exec "$DEPLOY_LXC" -- systemctl restart mattermost 2>/dev/null || \
        pct exec "$DEPLOY_LXC" -- bash -c 'cd /opt/mattermost && docker compose restart' 2>/dev/null || true
      echo "  mattermost 재시작됨"
      ;;
    *)
      echo "  자동 배포 미지원 — 수동으로 복사하세요:"
      echo "  pct push $DEPLOY_LXC $APP_DIR/ko-patched.json <target-path>"
      ;;
  esac
fi
