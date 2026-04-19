#!/usr/bin/env python3
"""Ai-Novel 전체 번역 via TranslateGemma (LXC 60108, 4개 shim 병렬).

- shim 엔드포인트: http://10.0.60.108:8080..8083/translate (라운드로빈)
- 문자열 단위 번역 (중국어 → 한국어)
- 동일 문자열은 중복 제거 + 캐시
- frontend .tsx/.ts + backend .py 모두 커버
"""
import os
import sys
import json
import re
import time
import subprocess
import concurrent.futures
import urllib.request
from pathlib import Path
from collections import defaultdict

LXC = "50176"
WORK = Path("/tmp/ainovel-gemma-translate")
WORK.mkdir(exist_ok=True)
(WORK / "orig").mkdir(exist_ok=True)
(WORK / "ko").mkdir(exist_ok=True)

CACHE_FILE = WORK / "translations.json"
DONE_FILE = WORK / "done.txt"

# 4개 shim 엔드포인트
SHIM_URLS = [
    "http://10.0.60.108:8080/translate",
    "http://10.0.60.108:8081/translate",
    "http://10.0.60.108:8082/translate",
    "http://10.0.60.108:8083/translate",
]

# 캐시 로드
cache = {}
if CACHE_FILE.exists():
    cache = json.loads(CACHE_FILE.read_text())
print(f"캐시 로드: {len(cache)}개")

done_files = set()
if DONE_FILE.exists():
    done_files = set(DONE_FILE.read_text().splitlines())

# 중국어 포함 판정
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
# 문자열 리터럴 추출 — "..." 또는 '...' 안에 중국어 포함
STRING_RE = re.compile(
    r'("(?:[^"\\\n]|\\.)*[\u4e00-\u9fff](?:[^"\\\n]|\\.)*")'
    r"|"
    r"('(?:[^'\\\n]|\\.)*[\u4e00-\u9fff](?:[^'\\\n]|\\.)*')"
)


def translate_one(text, url_idx=0):
    """단일 문자열 번역. cache 우선."""
    if text in cache:
        return cache[text]
    if not CJK_RE.search(text):
        return text
    url = SHIM_URLS[url_idx % len(SHIM_URLS)]
    payload = {
        "text": text,
        "source_lang_code": "zh",
        "target_lang_code": "ko",
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
            ko = data.get("translation", text)
            cache[text] = ko
            return ko
    except Exception as e:
        return None


def save_cache():
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def process_file(relpath, src_root, idx):
    """파일 번역. 문자열 리터럴만 추출 → 번역 → 치환."""
    orig_path = WORK / "orig" / relpath.replace("/", "__")
    ko_path = WORK / "ko" / relpath.replace("/", "__")

    # 이미 완료?
    if relpath in done_files and ko_path.exists():
        return (relpath, "cached", 0)

    try:
        # pct pull
        src_in_lxc = f"{src_root}/{relpath}"
        subprocess.run(
            ["pct", "pull", LXC, src_in_lxc, str(orig_path)],
            check=True, capture_output=True, timeout=30,
        )
        content = orig_path.read_text()

        # 중국어 포함 문자열 전부 추출 (중복 제거)
        strings = set()
        for m in STRING_RE.finditer(content):
            lit = m.group(0)  # "..." or '...'
            inner = lit[1:-1]
            if CJK_RE.search(inner):
                strings.add(lit)

        if not strings:
            ko_path.write_text(content)
            return (relpath, "no-cjk", 0)

        # 번역 (파일 내 병렬 X, 이미 파일 단위 10 병렬)
        replace_map = {}
        for lit in strings:
            inner = lit[1:-1]
            ko = translate_one(inner, url_idx=idx)
            if ko is None:
                continue
            # escape처리 — 원본 따옴표 종류 유지
            quote = lit[0]
            ko_esc = ko.replace("\\", "\\\\").replace(quote, "\\" + quote)
            replace_map[lit] = f"{quote}{ko_esc}{quote}"

        # 치환 (긴 것부터 해야 substring 문제 없음)
        translated = content
        for old in sorted(replace_map, key=len, reverse=True):
            translated = translated.replace(old, replace_map[old])

        ko_path.write_text(translated)
        return (relpath, "ok", len(strings))

    except Exception as e:
        return (relpath, "error", str(e)[:80])


def run_batch(files, src_root):
    """파일 리스트 병렬 번역."""
    total = len(files)
    ok = err = cached = skipped = 0
    string_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(process_file, f, src_root, i): f for i, f in enumerate(files)}
        for i, fut in enumerate(concurrent.futures.as_completed(futures)):
            rel, status, val = fut.result()
            if status == "ok":
                ok += 1
                string_count += val
                with open(DONE_FILE, "a") as f:
                    f.write(f"{rel}\n")
            elif status == "cached":
                cached += 1
            elif status == "no-cjk":
                skipped += 1
            else:
                err += 1

            if (i + 1) % 10 == 0:
                save_cache()
                print(f"  [{i+1}/{total}] ok={ok} cached={cached} skip={skipped} err={err} strings={string_count} cache={len(cache)}", flush=True)

    save_cache()
    return ok, err, cached, skipped, string_count


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "frontend"

    if target == "frontend":
        src_root = "/opt/ainovel/frontend/src"
        list_file = "/tmp/ainovel-cjk-files.txt"
    elif target == "backend":
        src_root = "/opt/ainovel/backend"
        list_file = "/tmp/ainovel-cjk-files-backend.txt"
    else:
        print(f"알 수 없는 target: {target}")
        sys.exit(1)

    files = [f.strip().lstrip("./") for f in open(list_file).read().splitlines() if f.strip()]
    files = [f for f in files if "uiCopy.ts" not in f]  # 이미 완료

    print(f"=== {target} 번역 시작 ({len(files)} 파일) ===")
    start = time.time()
    ok, err, cached, skip, n = run_batch(files, src_root)
    elapsed = time.time() - start

    print(f"\n=== 완료 ({elapsed:.0f}초) ===")
    print(f"  OK:     {ok}")
    print(f"  cached: {cached}")
    print(f"  skip:   {skip}")
    print(f"  error:  {err}")
    print(f"  strings: {n}")
    print(f"  cache total: {len(cache)}")
