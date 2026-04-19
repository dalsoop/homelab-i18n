#!/bin/bash
# LLM 프롬프트 후보 파일 식별 (번역 skip)
cd /opt/ainovel/backend
# 파일명에 prompt/template 포함
find . -type f -name "*.py" 2>/dev/null | grep -iE "prompt|template" | head -20
echo "---"
# 파일 내 `PROMPT`, `SYSTEM`, `INSTRUCTION` 같은 상수 + 중국어 + 긴 문자열
find . -type f -name "*.py" -not -path "*/venv/*" 2>/dev/null | while read f; do
  # 중국어 있고
  if grep -qE $'[\xe4-\xe9][\x80-\xbf]{2}' "$f" 2>/dev/null; then
    # PROMPT/SYSTEM/TEMPLATE 변수 또는 role: system 패턴
    if grep -qE '(PROMPT|SYSTEM|TEMPLATE|INSTRUCTION|BASE_PROMPT|_prompt|_template|role.*:.*system|role.*:.*user|content=.*你|content=.*请|prompt=f?"""|build_prompt|prompt_template)' "$f"; then
      # 긴 중국어 단락 확인 (100자 이상)
      LONG=$(python3 -c "
import re
content = open('$f').read()
# 100자 이상 중국어 덩어리
patterns = re.findall(r'[\u4e00-\u9fff、。，！？：；《》\"\'（）\s\w]{100,}', content)
print(len(patterns))
" 2>/dev/null)
      if [ "${LONG:-0}" -gt 0 ]; then
        echo "$f  (long_blocks=$LONG)"
      fi
    fi
  fi
done
