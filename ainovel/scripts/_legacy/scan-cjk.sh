#!/bin/bash
cd /opt/ainovel
find . -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.venv/*" \
  -not -path "*/venv/*" \
  -not -path "*/__pycache__/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  2>/dev/null | while read f; do
    if LC_ALL=C grep -qE $'[\xe4-\xe9][\x80-\xbf]{2}' "$f" 2>/dev/null; then
      echo "$f"
    fi
  done
