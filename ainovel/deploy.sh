#!/usr/bin/env bash
# deploy.sh — Ai-Novel LXC 에 한국어 uiCopy.ts 반영 + frontend rebuild
#
# 사용:
#   bash deploy.sh                    # 기본: LXC 50176
#   bash deploy.sh --pct <LXC_ID>     # 다른 LXC
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PCT_ID="${AINOVEL_VMID:-50176}"
TARGET="/opt/ainovel/frontend/src/lib/uiCopy.ts"

while [ $# -gt 0 ]; do
  case "$1" in
    --pct) PCT_ID="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown: $1" >&2; exit 1 ;;
  esac
done

SRC="$HERE/src/uiCopy.ko.ts"
[ ! -f "$SRC" ] && { echo "번역 파일 없음: $SRC" >&2; exit 1; }

echo "=== Ai-Novel 한국어 UI 배포 ==="
echo "  LXC:    $PCT_ID"
echo "  source: $SRC"
echo "  target: $TARGET"
echo ""

# 1. 원본 백업 (LXC 내부)
echo "[1/3] 원본 백업"
pct exec "$PCT_ID" -- cp "$TARGET" "${TARGET}.bak-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

# 2. 파일 교체
echo "[2/3] 한국어 파일 푸시"
pct push "$PCT_ID" "$SRC" "$TARGET"

# 3. frontend rebuild
echo "[3/3] frontend rebuild (약 3-5분)"
pct exec "$PCT_ID" -- bash -c "
cd /opt/ainovel
docker compose --env-file .env.docker build frontend 2>&1 | tail -5
docker compose --env-file .env.docker up -d frontend 2>&1 | tail -3
"

# 4. 검증
echo ""
echo "[검증] 응답 대기..."
IP=$(pct config "$PCT_ID" 2>/dev/null | grep '^net0:' | sed 's/.*ip=\([0-9.]*\)\/.*/\1/')
for i in $(seq 1 30); do
  sleep 2
  if curl -fsS -o /dev/null "http://$IP:5173/"; then
    echo "  ✓ ready (http://$IP:5173)"
    break
  fi
done

echo ""
echo "✅ 완료 — https://novel.50.internal.kr 접속 확인"
