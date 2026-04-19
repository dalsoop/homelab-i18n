#!/usr/bin/env python3
"""backend Python 잔여 한자 수동 치환."""
import subprocess
import re
import pathlib

LXC = "50176"
WORK = pathlib.Path("/tmp/backend-fix")
WORK.mkdir(exist_ok=True)

# 수동 치환 규칙
# 안전한 rewrite (정확한 리터럴 매치로만)
EXACT_REPLACEMENTS = [
    # mojibake 된 PRESET_NAME 상수 (app/services/prompt_presets.py)
    ('"개비나무.도로가 넓다.х한유성(한유(韓愈)의 업적.) v3별이 빛나는 밤."', '"기본·개요 생성 v3 (추천)"'),
    ('"개비나무.路绔犺妭鐢熸垚 v3별이 빛나는 밤."', '"기본·장 생성 v3 (추천)"'),
    ('"개비나무.路绔犺妭鍒嗘瀽 v1별이 빛나는 밤."', '"기본·장 분석 v1 (추천)"'),
    ('"개비나무.路绔犺妭閲嶅啓 v1별이 빛나는 밤."', '"기본·장 재작성 v1 (추천)"'),
    # "장(章)" 병기 제거 — 사용자가 한자 안 씀
    ("장(章)", "장"),
    ("(章)", ""),
]

# 잔여 CJK 문자 단일자 치환 — H8: Python literal 내부에 있는 경우만
# re.sub 로 문자열 literal 컨텍스트에서만 매치 (f-string / str literal 내부)
def sanitize_literals(content: str) -> str:
    """문자열 리터럴 내부의 잔여 한자만 안전하게 치환."""
    def literal_repl(m):
        lit = m.group(0)
        return lit.replace("章", "장").replace("。", ".")
    # 단일 라인 "..." 또는 '...' 만 (triple-quote / 여러 줄 문자열은 건드리지 않음)
    lit_re = re.compile(r'(?<!\\)"([^"\\\n]+)"|(?<!\\)\'([^\'\\\n]+)\'')
    return lit_re.sub(literal_repl, content)


def fix_file(relpath: str) -> tuple[int, bool]:
    src = f"/opt/ainovel/{relpath}"
    local = WORK / relpath.replace("/", "__")
    # C2: pct pull 은 실패해도 exit 0 을 반환하는 버그가 있어 stale file 선삭제 후 존재 검증
    local.unlink(missing_ok=True)
    r = subprocess.run(["pct", "pull", LXC, src, str(local)], capture_output=True, text=True)
    if not local.exists() or local.stat().st_size == 0:
        print(f"  ! pull failed: {relpath} ({r.stderr.strip()[:80]})")
        return (0, False)
    content = local.read_text(encoding="utf-8")
    orig = content
    for old, new in EXACT_REPLACEMENTS:
        content = content.replace(old, new)
    content = sanitize_literals(content)
    if content == orig:
        return (0, False)
    # Python syntax 검증
    try:
        compile(content, relpath, "exec")
    except SyntaxError as e:
        print(f"  ✗ syntax broken: {relpath}:{e.lineno}")
        return (0, False)
    local.write_text(content, encoding="utf-8")
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
