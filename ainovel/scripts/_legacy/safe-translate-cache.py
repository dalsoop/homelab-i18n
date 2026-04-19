#!/usr/bin/env python3
"""캐시된 번역만 사용해 파일 내 문자열 리터럴 안전 치환.

- 단일 라인에 완전히 들어가는 "..." 또는 '...' 만 대상
- 백틱(`) template literal 은 skip (syntax 리스크)
- 캐시 miss 는 그대로 두기
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

CACHE_FILE = "/tmp/ainovel-gemma-translate/translations.json"
LXC = "50176"
cache = json.loads(Path(CACHE_FILE).read_text())
print(f"캐시 로드: {len(cache)}개")

# 단일 라인 "..." 또는 '...' 중 중국어 포함 (백틱 제외)
STRING_RE = re.compile(
    r'"([^"\\\n]*(?:\\.[^"\\\n]*)*)"'  # double quote
    r"|"
    r"'([^'\\\n]*(?:\\.[^'\\\n]*)*)'"  # single quote
)
CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def process_file(relpath):
    src_path = f"/opt/ainovel/frontend/src/{relpath}"
    local_orig = f"/tmp/t-{relpath.replace('/','__')}"

    subprocess.run(
        ["pct", "pull", LXC, src_path, local_orig],
        check=True, capture_output=True, timeout=30,
    )
    content = Path(local_orig).read_text()

    if not CJK_RE.search(content):
        return (relpath, "no-cjk", 0, 0)

    # 라인 단위 처리 (multi-line 리터럴 건드리지 않음)
    lines = content.split("\n")
    hits = 0
    misses = 0

    for i, line in enumerate(lines):
        if not CJK_RE.search(line):
            continue

        def replace_literal(m):
            nonlocal hits, misses
            full = m.group(0)
            inner = m.group(1) if m.group(1) is not None else m.group(2)
            if inner is None or not CJK_RE.search(inner):
                return full
            ko = cache.get(inner)
            if not ko:
                misses += 1
                return full
            quote = full[0]
            ko_esc = ko.replace("\\", "\\\\").replace(quote, f"\\{quote}")
            hits += 1
            return f"{quote}{ko_esc}{quote}"

        new_line = STRING_RE.sub(replace_literal, line)
        lines[i] = new_line

    new_content = "\n".join(lines)

    if hits == 0:
        return (relpath, "no-hit", 0, misses)

    # 결과를 로컬 저장하고 push
    local_ko = f"/tmp/ko-{relpath.replace('/','__')}"
    Path(local_ko).write_text(new_content)
    subprocess.run(
        ["pct", "push", LXC, local_ko, src_path],
        check=True, capture_output=True, timeout=30,
    )
    return (relpath, "ok", hits, misses)


# 대상 파일 (frontend/src 하위 모든 중국어 포함 .tsx .ts)
SRC_ROOT = "/opt/ainovel/frontend/src"
result = subprocess.run(
    ["pct", "exec", LXC, "--", "bash", "-c",
     f'cd {SRC_ROOT} && find . -type f \\( -name "*.tsx" -o -name "*.ts" \\) -exec grep -l $"[\\xe4-\\xe9][\\x80-\\xbf]\\{{2\\}}" {{}} \\; 2>/dev/null'],
    capture_output=True, text=True, timeout=120,
)
files = [f.strip().lstrip("./") for f in result.stdout.splitlines() if f.strip()]
# 이미 처리한 것 (uiCopy, 4 Copy.ts, LoginPage) skip
SKIP = {
    "lib/uiCopy.ts",
    "pages/outline/outlineCopy.ts",
    "pages/writing/writingPageCopy.ts",
    "pages/worldbook/worldbookCopy.ts",
    "pages/taskCenter/taskCenterCopy.ts",
    "pages/LoginPage.tsx",
}
files = [f for f in files if f not in SKIP]
print(f"처리 대상: {len(files)} 파일")

total_hits = total_misses = 0
ok = no_cjk = no_hit = err = 0

for i, f in enumerate(files, 1):
    try:
        _, status, h, m = process_file(f)
        total_hits += h
        total_misses += m
        if status == "ok":
            ok += 1
            print(f"  ✓ {f} (+{h}, miss {m})")
        elif status == "no-cjk":
            no_cjk += 1
        elif status == "no-hit":
            no_hit += 1
    except Exception as e:
        err += 1
        print(f"  ✗ {f}: {str(e)[:80]}")
    if i % 20 == 0:
        print(f"  [{i}/{len(files)}] hits={total_hits} misses={total_misses}")

print(f"\n완료 — ok={ok} no-cjk={no_cjk} no-hit={no_hit} err={err}")
print(f"총 hits={total_hits}, 캐시 miss={total_misses}")
