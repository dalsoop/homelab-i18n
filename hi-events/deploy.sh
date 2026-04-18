#!/usr/bin/env bash
# Hi.events 한국어 배포
#   - Hi.events 소스를 ko 패치 + 번역 적용 → Docker 이미지 빌드 → LXC 컨테이너 교체
#   - 기본 타겟: LXC 50174 (hi-events). 필요시 --vmid 로 오버라이드.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VMID="${VMID:-50174}"
IMAGE_TAG="${IMAGE_TAG:-hi-events-ko:latest}"
SRC_DIR="${SRC_DIR:-/opt/hi-events-src}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-develop}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/hi-events}"

usage() {
  cat <<EOF
Usage: bash deploy.sh [options]

Options:
  --vmid <n>           대상 LXC VMID (기본: 50174)
  --image <tag>        빌드할 이미지 태그 (기본: hi-events-ko:latest)
  --src <path>         Hi.events 소스 디렉토리 (기본: /opt/hi-events-src, 없으면 clone)
  --branch <name>      업스트림 브랜치 (기본: develop)
  --compose <path>     LXC 안 compose 디렉토리 (기본: /opt/hi-events)
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vmid) VMID="$2"; shift 2 ;;
    --image) IMAGE_TAG="$2"; shift 2 ;;
    --src) SRC_DIR="$2"; shift 2 ;;
    --branch) UPSTREAM_BRANCH="$2"; shift 2 ;;
    --compose) COMPOSE_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown: $1"; usage; exit 1 ;;
  esac
done

say() { printf "\033[1;36m[hi-events-ko]\033[0m %s\n" "$*"; }

# 1. 소스 준비
if [[ ! -d "$SRC_DIR/.git" ]]; then
  say "clone HiEventsDev/hi.events → $SRC_DIR"
  git clone --depth 1 -b "$UPSTREAM_BRANCH" https://github.com/HiEventsDev/hi.events.git "$SRC_DIR"
else
  say "fetch latest $UPSTREAM_BRANCH"
  git -C "$SRC_DIR" fetch origin "$UPSTREAM_BRANCH" --depth 1
  git -C "$SRC_DIR" checkout "$UPSTREAM_BRANCH" 2>/dev/null || git -C "$SRC_DIR" checkout -B "$UPSTREAM_BRANCH" origin/"$UPSTREAM_BRANCH"
fi

# 2. 패치 적용
say "apply patches"
(cd "$SRC_DIR" && for p in "$HERE"/src/patches/*.patch; do
  if git apply --check "$p" 2>/dev/null; then
    git apply "$p"
    echo "  ✓ $(basename "$p")"
  else
    # 이미 적용됐거나 충돌 — reverse check
    if git apply --reverse --check "$p" 2>/dev/null; then
      echo "  ↩ $(basename "$p") (이미 적용됨)"
    else
      echo "  ✗ $(basename "$p") — 충돌, 수동 해결 필요"; exit 1
    fi
  fi
done)

# 3. 번역 파일 복사
say "copy translation files"
cp -v "$HERE/src/ko.po"   "$SRC_DIR/frontend/src/locales/ko.po"
cp -v "$HERE/src/ko.json" "$SRC_DIR/backend/lang/ko.json"
mkdir -p "$SRC_DIR/backend/lang/ko"
cp -v "$HERE/src/lang-ko/"*.php "$SRC_DIR/backend/lang/ko/"

# 4. LXC로 소스 복사 + 빌드
if command -v pct >/dev/null 2>&1 && pct status "$VMID" 2>/dev/null | grep -q running; then
  say "push source → LXC $VMID + docker build $IMAGE_TAG"
  tar -C "$(dirname "$SRC_DIR")" -cf - "$(basename "$SRC_DIR")" | pct exec "$VMID" -- tar -C /opt -xf -
  pct exec "$VMID" -- bash -c "cd /opt/$(basename "$SRC_DIR") && docker build -f Dockerfile.all-in-one -t $IMAGE_TAG ."
else
  say "local docker build $IMAGE_TAG"
  (cd "$SRC_DIR" && docker build -f Dockerfile.all-in-one -t "$IMAGE_TAG" .)
fi

# 5. 컨테이너 교체
say "swap compose image → $IMAGE_TAG"
if command -v pct >/dev/null 2>&1 && pct status "$VMID" 2>/dev/null | grep -q running; then
  pct exec "$VMID" -- sed -i -E "s|^(\s*image:\s*).*|\1$IMAGE_TAG|" "$COMPOSE_DIR/docker-compose.yml"
  pct exec "$VMID" -- bash -c "cd $COMPOSE_DIR && docker compose up -d --force-recreate all-in-one"
else
  sed -i -E "s|^(\s*image:\s*).*|\1$IMAGE_TAG|" "$COMPOSE_DIR/docker-compose.yml"
  (cd "$COMPOSE_DIR" && docker compose up -d --force-recreate all-in-one)
fi

say "완료. https 도메인에서 한국어 UI 확인"
