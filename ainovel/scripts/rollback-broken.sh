#!/usr/bin/env bash
# 번역 결과 중 syntax 깨진 파일 찾아서 원본으로 롤백
set -e

TRANS_DIR="/tmp/ainovel-gemma-translate"
KO="$TRANS_DIR/ko"
ORIG="$TRANS_DIR/orig"
LXC=50176

echo "=== 문제 감지 ==="
# 1) 라인 수가 원본 대비 크게 변한 파일 (특히 줄어든 것)
broken=()
for ko_f in "$KO"/*; do
  name=$(basename "$ko_f")
  orig_f="$ORIG/$name"
  [ ! -f "$orig_f" ] && continue
  o=$(wc -l < "$orig_f")
  k=$(wc -l < "$ko_f")
  # 라인 수가 70% 미만이면 수상
  if [ "$o" -gt 5 ]; then
    threshold=$((o * 70 / 100))
    if [ "$k" -lt "$threshold" ]; then
      broken+=("$name")
    fi
  fi
done

echo "라인 비율 이상: ${#broken[@]} 파일"

# 2) 특정 syntax 깨짐 패턴 (한국어가 식별자 중간에 들어간 경우)
# 번역문이 연산자나 키워드 바로 뒤에 공백 없이 붙은 케이스
for ko_f in "$KO"/*.ts "$KO"/*.tsx; do
  [ ! -f "$ko_f" ] && continue
  name=$(basename "$ko_f")
  # 이미 broken에 있으면 skip
  if [[ " ${broken[@]} " =~ " $name " ]]; then continue; fi
  # 한국어 + 식별자 문법 깨짐 패턴
  # "..."X 형식 (X=한글) 또는 identifier[가-힣]
  if grep -qE '[a-zA-Z_0-9]"[가-힣]|[가-힣][a-zA-Z_0-9]+[(=]|[가-힣]"&&|&&[가-힣]' "$ko_f" 2>/dev/null; then
    broken+=("$name")
  fi
done

echo "syntax 패턴 이상: ${#broken[@]} 파일 (누적)"
printf '  - %s\n' "${broken[@]}" | head -20

echo ""
echo "=== 원본으로 롤백 ==="
count=0
for name in "${broken[@]}"; do
  orig_f="$ORIG/$name"
  [ ! -f "$orig_f" ] && continue
  # 파일명 __ 를 / 로 복원
  rel=$(echo "$name" | sed 's|__|/|g')
  target="/opt/ainovel/frontend/src/$rel"
  pct push "$LXC" "$orig_f" "$target" 2>/dev/null && count=$((count + 1))
done
echo "✓ 롤백: $count 파일"
echo ""
echo "=== 영향받은 파일 목록 저장 ==="
printf '%s\n' "${broken[@]}" > /tmp/rollback-broken.txt
wc -l /tmp/rollback-broken.txt
