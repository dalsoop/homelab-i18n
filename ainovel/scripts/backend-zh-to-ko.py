#!/usr/bin/env python3
"""Ai-Novel backend Python 소스 한자 → 한국어 변환기.

zh-to-ko.py 의 backend 버전. frontend와 같은 세그먼트 단위 번역 로직을
/opt/ainovel/backend/app/ 의 .py 파일에 적용.

Python 특수성:
- 주석(#) 라인 skip
- f-string, triple-quoted string 내부도 처리 (line-by-line 이라 multi-line
  문자열 경계 안전은 번역 결과의 quote/newline reject 로 보장)
- Jinja 템플릿 변수 `{{var}}`, `{% if %}` 보존 (세그먼트에 한자만 매치)
- syntax 안전: 번역 결과에 따옴표/백틱/백슬래시 포함 시 reject

사용법:
    backend-zh-to-ko.py scan
    backend-zh-to-ko.py translate
    backend-zh-to-ko.py run           # scan → translate → restart backend
"""
from __future__ import annotations
import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from threading import Lock

LXC = "50176"
SHIM = [f"http://10.0.60.108:{p}/translate" for p in (8080, 8081, 8082, 8083)]
CACHE_FILE = Path("/tmp/ainovel-gemma-translate/translations.json")
WORK = Path("/tmp/backend-zh-to-ko-work")
WORK.mkdir(exist_ok=True)

CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")
CJK_BLOCK = re.compile(
    r"[\u4e00-\u9fff]"
    r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d ]*"
    r"[\u4e00-\u9fff\uff00-\uffef]"
    r"|[\u4e00-\u9fff]+"
)

cache_lock = Lock()
# N7: cache 를 import 시점이 아닌 main() 에서 load 하도록 지연
cache: dict[str, str] = {}

# N8: shim circuit breaker — 연속 실패 5회면 번역 포기
_shim_fail_lock = Lock()
_shim_fail_count = [0]
_SHIM_FAIL_THRESHOLD = 5


def _load_cache() -> None:
    global cache
    if CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    print(f"캐시: {len(cache)}개", file=sys.stderr)


def save_cache() -> None:
    with cache_lock:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def call_shim(text: str, idx: int) -> str:
    url = SHIM[idx % len(SHIM)]
    req = urllib.request.Request(
        url,
        data=json.dumps({"text": text, "source_lang_code": "zh", "target_lang_code": "ko"}).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["translation"]


def translate_segment(text: str, idx: int) -> str | None:
    with cache_lock:
        if text in cache:
            return cache[text]
    # N8: circuit breaker 발동 시 즉시 None
    with _shim_fail_lock:
        if _shim_fail_count[0] >= _SHIM_FAIL_THRESHOLD:
            return None
    try:
        ko = call_shim(text, idx)
        with _shim_fail_lock:
            _shim_fail_count[0] = 0  # 성공 시 리셋
    except Exception:
        with _shim_fail_lock:
            _shim_fail_count[0] += 1
            if _shim_fail_count[0] == _SHIM_FAIL_THRESHOLD:
                print(f"  ! shim 연속 실패 {_SHIM_FAIL_THRESHOLD}회 — 이후 번역 포기", file=sys.stderr)
        return None
    # 개행·탭·백틱은 Python 문자열 경계를 깨뜨릴 수 있어 reject
    if any(c in ko for c in ("\n", "\r", "\t", "`", "\\")):
        return None
    # Jinja 템플릿 문법 생성 방지
    if "${" in ko or "{{" in ko or "}}" in ko:
        return None
    if len(ko) > len(text) * 6 + 80:
        return None
    # 코드 안전: 따옴표는 전각으로 치환 (문맥에 영향 없음)
    ko = ko.replace('"', '\u201d').replace("'", '\u2019')
    with cache_lock:
        cache[text] = ko
    return ko


def list_target_files() -> list[str]:
    """/opt/ainovel/backend/app/ 아래 한자 포함 .py 파일."""
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "python3", "-c", """
import pathlib, re
rx = re.compile(r'[\\u4e00-\\u9fff]')
for p in pathlib.Path('/opt/ainovel/backend/app').rglob('*.py'):
    if p.is_file() and rx.search(p.read_text(errors='ignore')):
        print(p.relative_to('/opt/ainovel'))
"""],
        capture_output=True, text=True, timeout=120, check=False,
    )
    return [f.strip() for f in r.stdout.splitlines() if f.strip()]


def scan_cmd() -> int:
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "python3", "-c", """
import pathlib, re
rx = re.compile(r'[\\u4e00-\\u9fff]')
total = 0; files = 0; details = []
for p in pathlib.Path('/opt/ainovel/backend/app').rglob('*.py'):
    if p.is_file():
        t = p.read_text(errors='ignore')
        c = len(rx.findall(t))
        if c:
            total += c; files += 1
            details.append((c, str(p.relative_to('/opt/ainovel/backend'))))
details.sort(reverse=True)
for c, path in details[:30]:
    print(f'  {c:5d}  {path}')
print(f'TOTAL files={files} chars={total}')
"""],
        capture_output=True, text=True, timeout=120, check=False,
    )
    print(r.stdout)
    m = re.search(r"chars=(\d+)", r.stdout)
    return int(m.group(1)) if m else -1


def process_file(relpath: str, idx: int) -> tuple[str, str, int, int]:
    src_path = f"/opt/ainovel/{relpath}"
    # N2: `foo__bar.py` 와 `foo/bar.py` 충돌 방지 — sha1 prefix 포함
    safe = hashlib.sha1(relpath.encode()).hexdigest()[:12] + "_" + Path(relpath).name
    local = WORK / safe
    local.unlink(missing_ok=True)  # C2: stale file 방지
    try:
        subprocess.run(
            ["pct", "pull", LXC, src_path, str(local)],
            check=True, capture_output=True, timeout=30,
        )
        if not local.exists() or local.stat().st_size == 0:
            return (relpath, "pull-empty", 0, 0)
        content = local.read_text(encoding="utf-8")  # N6
    except Exception:
        return (relpath, "pull-fail", 0, 0)

    trailing_nl = "\n" if content.endswith("\n") else ""  # N1
    lines = content.split("\n")
    hits = misses = 0

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        # 파이썬 주석 skip (# 시작)
        if stripped.startswith("#"):
            continue
        if not CJK_CHAR.search(line):
            continue

        def repl(m):
            nonlocal hits, misses
            seg = m.group(0)
            ko = translate_segment(seg, idx)
            if ko is None:
                misses += 1
                return seg
            hits += 1
            return ko

        lines[i] = CJK_BLOCK.sub(repl, line)

    if hits == 0:
        return (relpath, "no-hit", 0, misses)

    # Python syntax 검증 — 변역 후 파일이 valid Python 인지
    new_content = "\n".join(lines) + trailing_nl  # N1
    try:
        compile(new_content, relpath, "exec")
    except SyntaxError as e:
        return (relpath, f"syntax-err-{e.lineno}", 0, misses)

    local.write_text(new_content, encoding="utf-8")  # N6
    try:
        subprocess.run(
            ["pct", "push", LXC, str(local), src_path],
            check=True, capture_output=True, timeout=30,
        )
    except Exception:
        return (relpath, "push-fail", hits, misses)
    return (relpath, "ok", hits, misses)


def translate_cmd(workers: int) -> int:
    files = list_target_files()
    print(f"대상: {len(files)} 파일")
    if not files:
        return 0
    start = time.time()
    total_hits = 0
    ok = err = skipped = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(process_file, f, i): f for i, f in enumerate(files)}
        for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            rel, status, h, m = fut.result()
            if status == "ok":
                ok += 1
                total_hits += h
            elif status == "no-hit":
                skipped += 1
            else:
                err += 1
                print(f"  ✗ {rel}: {status}")
            if i % 5 == 0:
                save_cache()
                print(f"  [{i}/{len(files)}] ok={ok} skip={skipped} err={err} hits={total_hits} ({time.time()-start:.0f}s)")
    save_cache()
    print(f"=== 완료 ({time.time()-start:.0f}s) ok={ok} skip={skipped} err={err} hits={total_hits} cache={len(cache)}")
    return total_hits


def restart_backend() -> None:
    print("backend + rq_worker 재시작")
    subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         "cd /opt/ainovel && docker compose --env-file .env.docker restart backend rq_worker"],
        check=True, timeout=120,
    )


def run_cmd(workers: int) -> int:
    print("=== backend Python seed 번역 ===")
    before = scan_cmd()
    if before == 0:
        print("✓ 한자 0 — 이미 완료")
        return 0
    translate_cmd(workers)
    after = scan_cmd()
    if after > 0:
        print(f"⚠ 잔여 한자 {after}자 (수동 확인)")
    print("\n=== backend 재시작 ===")
    restart_backend()
    print("✓ backend 재시작 완료")
    return after


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["scan", "translate", "run", "restart"])
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    _load_cache()  # N7: main 시점에 캐시 로드
    if args.command == "scan":
        return 0 if scan_cmd() == 0 else 1
    if args.command == "translate":
        translate_cmd(args.workers)
        return 0
    if args.command == "run":
        return 0 if run_cmd(args.workers) == 0 else 2
    if args.command == "restart":
        restart_backend()
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
