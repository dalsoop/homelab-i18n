#!/usr/bin/env python3
"""Ai-Novel 한자 → 한국어 전수 변환기 (iterate-until-zero).

사용법:
    zh-to-ko.py scan                       # 현재 남은 한자 카운트
    zh-to-ko.py translate                  # 세그먼트 단위 번역 (한 라운드)
    zh-to-ko.py strip-parenthetical        # "한글(漢字)" → "한글" 병기 벗기기
    zh-to-ko.py clean-nested               # 중첩 번역 ("장(章).)") 정리
    zh-to-ko.py run                        # scan → translate → strip → clean 반복 (한자 0될 때까지)
    zh-to-ko.py --lxc 50176 --include-tests run

전제:
- 사용자는 한자를 사용하지 않음. 모든 한자는 번역 또는 제거 대상.
- TranslateGemma 4-way 병렬 (10.0.60.108:8080-8083).
- 캐시는 /tmp/ainovel-gemma-translate/translations.json.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from threading import Lock

DEFAULT_LXC = "50176"
SHIM_HOST = "10.0.60.108"
SHIM_PORTS = (8080, 8081, 8082, 8083)
CACHE_FILE = Path("/tmp/ainovel-gemma-translate/translations.json")
WORK = Path("/tmp/zh-to-ko-work")
WORK.mkdir(exist_ok=True)
CACHE_FILE.parent.mkdir(exist_ok=True)

CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")
# 한자 + 인접 CJK 부호 연속 블록
CJK_BLOCK = re.compile(
    r"[\u4e00-\u9fff]"
    r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d ]*"
    r"[\u4e00-\u9fff\uff00-\uffef]"
    r"|[\u4e00-\u9fff]+"
)

cache_lock = Lock()


def load_cache() -> dict[str, str]:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict[str, str]) -> None:
    with cache_lock:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def call_shim(text: str, idx: int) -> str:
    url = f"http://{SHIM_HOST}:{SHIM_PORTS[idx % len(SHIM_PORTS)]}/translate"
    req = urllib.request.Request(
        url,
        data=json.dumps({
            "text": text,
            "source_lang_code": "zh",
            "target_lang_code": "ko",
        }).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["translation"]


def translate_segment(text: str, idx: int, cache: dict[str, str]) -> str | None:
    """번역 + 안전성 검사. 실패 시 None."""
    with cache_lock:
        if text in cache:
            return cache[text]
    try:
        ko = call_shim(text, idx)
    except Exception:
        return None
    # syntax-breaking 문자는 모두 거부
    if any(c in ko for c in ("\n", "\r", "\t", "`")) or "${" in ko:
        return None
    if len(ko) > len(text) * 6 + 80:
        return None
    with cache_lock:
        cache[text] = ko
    return ko


def list_target_files(lxc: str, include_tests: bool) -> list[str]:
    """frontend/src 아래 한자 포함 .ts/.tsx 파일 경로 (rel to src/)."""
    r = subprocess.run(
        ["pct", "exec", lxc, "--", "python3", "-c", """
import pathlib, re
rx = re.compile(r'[\\u4e00-\\u9fff]')
for p in pathlib.Path('/opt/ainovel/frontend/src').rglob('*'):
    if p.suffix in ('.ts','.tsx') and p.is_file():
        if rx.search(p.read_text(errors='ignore')):
            print(p.relative_to('/opt/ainovel/frontend/src'))
"""],
        capture_output=True, text=True, timeout=180, check=False,
    )
    files = [f.strip() for f in r.stdout.splitlines() if f.strip()]
    if not include_tests:
        files = [f for f in files if not re.search(r"\.test\.(ts|tsx)$", f)]
    return files


def scan_cmd(lxc: str, include_tests: bool) -> int:
    """현재 한자 파일/글자 수 출력. 한자 없으면 return 0."""
    r = subprocess.run(
        ["pct", "exec", lxc, "--", "python3", "-c", f"""
import pathlib, re
rx = re.compile(r'[\\u4e00-\\u9fff]')
total = 0; files = 0; details = []
for p in pathlib.Path('/opt/ainovel/frontend/src').rglob('*'):
    if p.suffix in ('.ts','.tsx') and p.is_file():
        if {include_tests} is False and '.test.' in p.name:
            continue
        t = p.read_text(errors='ignore')
        c = len(rx.findall(t))
        if c:
            total += c; files += 1
            details.append((c, str(p.relative_to('/opt/ainovel/frontend/src'))))
details.sort(reverse=True)
for c, path in details[:30]:
    print(f'  {{c:5d}}  {{path}}')
print(f'TOTAL files={{files}} chars={{total}}')
"""],
        capture_output=True, text=True, timeout=120, check=False,
    )
    print(r.stdout)
    if r.stderr:
        print(r.stderr, file=sys.stderr)
    m = re.search(r"chars=(\d+)", r.stdout)
    return int(m.group(1)) if m else -1


def process_file(relpath: str, idx: int, lxc: str, cache: dict[str, str]) -> tuple[str, str, int, int]:
    src_path = f"/opt/ainovel/frontend/src/{relpath}"
    local = WORK / relpath.replace("/", "__")
    try:
        subprocess.run(
            ["pct", "pull", lxc, src_path, str(local)],
            check=True, capture_output=True, timeout=30,
        )
        content = local.read_text()
    except Exception as e:
        return (relpath, "pull-fail", 0, 0)

    lines = content.split("\n")
    hits = misses = 0

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        if not CJK_CHAR.search(line):
            continue

        def repl(m):
            nonlocal hits, misses
            seg = m.group(0)
            ko = translate_segment(seg, idx, cache)
            if ko is None:
                misses += 1
                return seg
            # 코드 안전: 따옴표/백틱/백슬래시 무독화
            ko_safe = ko.replace('"', "'").replace("`", "'").replace("\\", "")
            hits += 1
            return ko_safe

        lines[i] = CJK_BLOCK.sub(repl, line)

    if hits == 0:
        return (relpath, "no-hit", 0, misses)

    local.write_text("\n".join(lines))
    try:
        subprocess.run(
            ["pct", "push", lxc, str(local), src_path],
            check=True, capture_output=True, timeout=30,
        )
    except Exception:
        return (relpath, "push-fail", hits, misses)
    return (relpath, "ok", hits, misses)


def translate_cmd(lxc: str, include_tests: bool, workers: int) -> int:
    cache = load_cache()
    print(f"캐시: {len(cache)}개")
    files = list_target_files(lxc, include_tests)
    print(f"대상: {len(files)} 파일")
    if not files:
        return 0

    start = time.time()
    total_hits = 0
    ok = err = skipped = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(process_file, f, i, lxc, cache): f for i, f in enumerate(files)}
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
            if i % 10 == 0:
                save_cache(cache)
                print(f"  [{i}/{len(files)}] ok={ok} skip={skipped} err={err} hits={total_hits} ({time.time()-start:.0f}s)")
    save_cache(cache)
    print(f"=== translate 완료 ({time.time()-start:.0f}s) ok={ok} skip={skipped} err={err} hits={total_hits} cache={len(cache)}")
    return total_hits


def run_on_lxc(lxc: str, code: str, timeout: int = 120) -> tuple[int, str, str]:
    r = subprocess.run(
        ["pct", "exec", lxc, "--", "python3", "-c", code],
        capture_output=True, text=True, timeout=timeout, check=False,
    )
    return r.returncode, r.stdout, r.stderr


def strip_parenthetical_cmd(lxc: str, include_tests: bool) -> int:
    """'한글(漢字)' 형태의 한자 병기에서 괄호+한자 부분을 제거.

    예: '린모(林默)' → '린모'
        '장(章)' → '장'
    사용자가 한자를 전혀 쓰지 않으므로 병기 자체가 불필요.
    """
    inc_tests = "True" if include_tests else "False"
    code = f"""
import pathlib, re
# "한글류((한자)+) optional 추가부호" 형태
pat = re.compile(r'([^\\s(])\\s*\\(\\s*([\\u4e00-\\u9fff]+)\\s*\\)\\.?')
changed = 0
for p in pathlib.Path('/opt/ainovel/frontend/src').rglob('*'):
    if p.suffix not in ('.ts','.tsx'): continue
    if {inc_tests} is False and '.test.' in p.name: continue
    t = p.read_text(errors='ignore')
    new = pat.sub(r'\\1', t)
    if new != t:
        p.write_text(new)
        changed += 1
print(f'stripped_files={{changed}}')
"""
    rc, out, err = run_on_lxc(lxc, code)
    print(out)
    if err:
        print(err, file=sys.stderr)
    m = re.search(r"stripped_files=(\d+)", out)
    return int(m.group(1)) if m else 0


def clean_nested_cmd(lxc: str, include_tests: bool) -> int:
    """중첩 번역 부산물 정리."""
    inc_tests = "True" if include_tests else "False"
    code = f"""
import pathlib, re
patterns = [
    (re.compile(r'장\\(장\\(章\\)\\.\\)\\.?'), '장'),
    (re.compile(r'장\\(章\\)\\.?'), '장'),
    (re.compile(r'([\\uac00-\\ud7a3]+)\\(\\1\\(([\\u4e00-\\u9fff]+)\\)\\)'), r'\\1'),
    (re.compile(r'제\\s*\\.\\s*(\\d+)\\s*장'), r'제\\1장'),
    (re.compile(r'제\\s+([^\\s]+)\\s+장'), r'제\\1장'),
    (re.compile(r'\\([\\u4e00-\\u9fff]+\\)'), ''),
]
changed = 0
for p in pathlib.Path('/opt/ainovel/frontend/src').rglob('*'):
    if p.suffix not in ('.ts','.tsx'): continue
    if {inc_tests} is False and '.test.' in p.name: continue
    t = p.read_text(errors='ignore')
    orig = t
    for rx, repl in patterns:
        t = rx.sub(repl, t)
    if t != orig:
        p.write_text(t)
        changed += 1
print(f'cleaned_files={{changed}}')
"""
    rc, out, err = run_on_lxc(lxc, code)
    print(out)
    if err:
        print(err, file=sys.stderr)
    m = re.search(r"cleaned_files=(\d+)", out)
    return int(m.group(1)) if m else 0


def run_all_cmd(lxc: str, include_tests: bool, workers: int, max_rounds: int) -> int:
    """scan → translate → strip-parenthetical → clean-nested 반복."""
    for round_n in range(1, max_rounds + 1):
        print(f"\n=== Round {round_n} ===")
        before = scan_cmd(lxc, include_tests)
        if before == 0:
            print("✓ 한자 0 — 완료")
            return 0
        translate_cmd(lxc, include_tests, workers)
        strip_parenthetical_cmd(lxc, include_tests)
        clean_nested_cmd(lxc, include_tests)
        after = scan_cmd(lxc, include_tests)
        if after == 0:
            print("✓ 한자 0 — 완료")
            return 0
        if after >= before:
            print(f"진행 정체 (before={before} after={after}) — 수동 확인 필요")
            return after
    return after


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["scan", "translate", "strip-parenthetical", "clean-nested", "run"])
    ap.add_argument("--lxc", default=DEFAULT_LXC)
    ap.add_argument("--include-tests", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--max-rounds", type=int, default=5)
    args = ap.parse_args()

    if args.command == "scan":
        return 0 if scan_cmd(args.lxc, args.include_tests) == 0 else 1
    if args.command == "translate":
        translate_cmd(args.lxc, args.include_tests, args.workers)
        return 0
    if args.command == "strip-parenthetical":
        strip_parenthetical_cmd(args.lxc, args.include_tests)
        return 0
    if args.command == "clean-nested":
        clean_nested_cmd(args.lxc, args.include_tests)
        return 0
    if args.command == "run":
        remaining = run_all_cmd(args.lxc, args.include_tests, args.workers, args.max_rounds)
        return 0 if remaining == 0 else 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
