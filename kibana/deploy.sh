#!/usr/bin/env bash
# Kibana ko-KR 번역 배포
# 사용: bash kibana/deploy.sh [LXC_ID]
set -euo pipefail

LXC="${1:-50190}"
HERE="$(cd "$(dirname "$0")" && pwd)"
KO_FILE="$HERE/ko-KR.json"
TRANSLATIONS_DIR="/usr/share/kibana/node_modules/@kbn/translations-plugin/translations"
CONSTANTS="/usr/share/kibana/node_modules/@kbn/core-i18n-server-internal/src/constants.js"
I18NRC="/usr/share/kibana/x-pack/.i18nrc.json"

[[ -f "$KO_FILE" ]] || { echo "ko-KR.json 없음"; exit 1; }

echo "[1/4] ko-KR.json 배포"
pct push "$LXC" "$KO_FILE" "$TRANSLATIONS_DIR/ko-KR.json"

echo "[2/4] supportedLocale에 ko-KR 등록"
pct exec "$LXC" -- sed -i "s/\(supportedLocale.*\)\]/\1, 'ko-KR']/" "$CONSTANTS" 2>/dev/null || true
# 이미 있으면 중복 방지
pct exec "$LXC" -- bash -c "grep -q \"ko-KR\" $CONSTANTS && echo '  이미 등록됨' || echo '  등록 실패'"

echo "[3/4] x-pack/.i18nrc.json에 번역 파일 등록"
pct exec "$LXC" -- python3 -c "
import json
with open('$I18NRC') as f: data = json.load(f)
entry = '@kbn/translations-plugin/translations/ko-KR.json'
if entry not in data.get('translations', []):
    data.setdefault('translations', []).append(entry)
    with open('$I18NRC', 'w') as f: json.dump(data, f, indent=2)
    print('  등록 완료')
else:
    print('  이미 등록됨')
"

echo "[4/4] kibana.yml locale 설정 + 재시작"
pct exec "$LXC" -- bash -c "
grep -q '^i18n.locale' /etc/kibana/kibana.yml || \
  sed -i 's/#i18n.locale:.*/i18n.locale: \"ko-KR\"/' /etc/kibana/kibana.yml
systemctl restart kibana
"

echo
echo "완료. Kibana 재시작 중 (1-2분 소요)"
echo "확인: curl http://localhost:5601/translations/ko-KR.json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f\"messages: {len(d[\"messages\"])}\")''"
