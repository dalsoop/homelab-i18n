#!/bin/bash
# 번역 결과를 LXC 50176 원본 경로에 반영
set -e
ROOT="${1:-frontend/src}"
KO_DIR="/tmp/ainovel-gemma-translate/ko"
DONE="/tmp/ainovel-gemma-translate/done.txt"

[ "$ROOT" = "frontend/src" ] && PREFIX="/opt/ainovel/frontend/src" || PREFIX="/opt/ainovel/$ROOT"

count=0
skipped=0
while read rel; do
  [ -z "$rel" ] && continue
  flat=$(echo "$rel" | tr '/' '_' | tr '_' '_')
  # rel 의 / 를 __로 치환한 게 ko 파일명
  ko_file="$KO_DIR/$(echo "$rel" | sed 's|/|__|g')"
  if [ ! -f "$ko_file" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  # 파일이 실제 경로 아래면 푸시
  # ROOT 필터: frontend 번역이면 frontend/ 로 시작하는 경로만
  case "$ROOT" in
    frontend/src)
      [[ "$rel" != pages/* && "$rel" != components/* && "$rel" != lib/* && "$rel" != hooks/* && "$rel" != services/* && "$rel" != contexts/* && "$rel" != types.ts && "$rel" != App.tsx && "$rel" != main.tsx && "$rel" != index.css ]] && { skipped=$((skipped + 1)); continue; }
      ;;
  esac
  target="$PREFIX/$rel"
  pct push 50176 "$ko_file" "$target" 2>/dev/null && count=$((count + 1)) || skipped=$((skipped + 1))
done < "$DONE"

echo "✓ 반영: $count 파일  ·  건너뛰기: $skipped"
