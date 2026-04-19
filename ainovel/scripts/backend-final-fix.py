#!/usr/bin/env python3
"""backend Python 잔여 한자 수동 치환."""
import subprocess
import re
import pathlib

LXC = "50176"
WORK = pathlib.Path("/tmp/backend-fix")
WORK.mkdir(exist_ok=True)

# 수동 치환 규칙
REPLACEMENTS = [
    # mojibake 된 PRESET_NAME 상수 (app/services/prompt_presets.py)
    ('"개비나무.도로가 넓다.х한유성(한유(韓愈)의 업적.) v3별이 빛나는 밤."', '"기본·개요 생성 v3 (추천)"'),
    ('"개비나무.路绔犺妭鐢熸垚 v3별이 빛나는 밤."', '"기본·장 생성 v3 (추천)"'),
    ('"개비나무.路绔犺妭鍒嗘瀽 v1별이 빛나는 밤."', '"기본·장 분석 v1 (추천)"'),
    ('"개비나무.路绔犺妭閲嶅啓 v1별이 빛나는 밤."', '"기본·장 재작성 v1 (추천)"'),
    # "장(章)" 병기 제거 — 사용자가 한자 안 씀
    ("장(章)", "장"),
    ("(章)", ""),
    ("章", "장"),  # 남은 단일 "章" 도 "장"으로
    # 의미 없는 문장 끝 "。"
    ("。", "."),
]


def fix_file(relpath: str) -> tuple[int, bool]:
    src = f"/opt/ainovel/{relpath}"
    local = WORK / relpath.replace("/", "__")
    r = subprocess.run(["pct", "pull", LXC, src, str(local)], capture_output=True)
    content = local.read_text()
    orig = content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    if content == orig:
        return (0, False)
    # Python syntax 검증
    try:
        compile(content, relpath, "exec")
    except SyntaxError as e:
        print(f"  ✗ syntax broken: {relpath}:{e.lineno}")
        return (0, False)
    local.write_text(content)
    subprocess.run(["pct", "push", LXC, str(local), src], check=True, capture_output=True)
    # 남은 한자 카운트
    rx = re.compile(r"[\u4e00-\u9fff]")
    remaining = len(rx.findall(content))
    return (remaining, True)


# 잔여 한자 있는 파일들
r = subprocess.run(
    ["pct", "exec", LXC, "--", "python3", "-c", """
import pathlib, re
rx = re.compile(r'[\\u4e00-\\u9fff]')
for p in pathlib.Path('/opt/ainovel/backend/app').rglob('*.py'):
    if p.is_file() and rx.search(p.read_text(errors='ignore')):
        print(p.relative_to('/opt/ainovel'))
"""],
    capture_output=True, text=True,
)
files = [f.strip() for f in r.stdout.splitlines() if f.strip()]
print(f"대상: {len(files)} 파일")

total_fixed = 0
total_remaining = 0
for f in files:
    rem, changed = fix_file(f)
    if changed:
        total_fixed += 1
    total_remaining += rem
    if rem > 0:
        print(f"  {rem:3d}  {f}")
print(f"=== fixed {total_fixed} 파일, 잔여 한자 {total_remaining}자 ===")
