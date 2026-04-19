#!/usr/bin/env python3
"""Ai-Novel DB 한자 → 한국어 변환기.

대상 (whitelist — 시스템 seed 성격의 UI/설정 데이터만):
    project_tables.name
    project_tables.schema_json              (JSON 내부 중국어 키/값)
    prompt_presets.name, category
    writing_styles.name, description, prompt_content
    prompt_blocks.name, template
    project_default_styles (있으면)

명시적 제외 (사용자 데이터):
    users.*
    outlines.*, chapters.*, characters.*, entities.*
    search_documents.* (원본 번역 후 인덱스 재빌드로 해결)

사용법:
    db-zh-to-ko.py scan
    db-zh-to-ko.py translate [--dry-run] [--include-templates]
    db-zh-to-ko.py translate --only prompt_presets,project_tables

--include-templates 없으면 prompt_blocks.template / writing_styles.prompt_content 는 스킵
(LLM 출력 품질에 영향 있을 수 있어 기본 보수적).
"""
from __future__ import annotations
import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

LXC = "50176"
SHIM = [f"http://10.0.60.108:{p}/translate" for p in (8080, 8081, 8082, 8083)]
CACHE_FILE = Path("/tmp/ainovel-gemma-translate/translations.json")

# whitelist: (table, column, is_json, is_llm_prompt)
UI_TARGETS = [
    ("project_tables", "name", False, False),
    ("project_tables", "schema_json", True, False),
    ("prompt_presets", "name", False, False),
    ("prompt_presets", "category", False, False),
    ("writing_styles", "name", False, False),
    ("writing_styles", "description", False, False),
    ("prompt_blocks", "name", False, False),
]
LLM_TARGETS = [
    ("prompt_blocks", "template", False, True),
    ("writing_styles", "prompt_content", False, True),
]
INDEX_TARGETS = [
    # source_type='outline'은 사용자 데이터 — WHERE 로 제외
    ("search_documents", "title", False, False),
    ("search_documents", "content", False, False),
]

CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")
CJK_BLOCK = re.compile(
    r"[\u4e00-\u9fff]"
    r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d ]*"
    r"[\u4e00-\u9fff\uff00-\uffef]"
    r"|[\u4e00-\u9fff]+"
)

cache = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}


def sql(query: str) -> str:
    """postgres에서 쿼리 실행 (raw text result)."""
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         f"cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -Atc \"{query}\""],
        capture_output=True, text=True, timeout=60, check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(f"SQL failed: {r.stderr}")
    return r.stdout


def sql_write(query: str) -> None:
    """postgres에서 쓰기 쿼리 — stdin으로 전달해 quoting 안전."""
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         "cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -v ON_ERROR_STOP=1"],
        input=query, capture_output=True, text=True, timeout=60, check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(f"SQL write failed: {r.stderr}")


def call_shim(text: str, idx: int = 0) -> str:
    url = SHIM[idx % len(SHIM)]
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
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)["translation"]


def translate_text(text: str, idx: int = 0) -> str | None:
    """전체 텍스트 번역 (긴 LLM prompt 등)."""
    if text in cache:
        return cache[text]
    try:
        ko = call_shim(text, idx)
        cache[text] = ko
        return ko
    except Exception as e:
        print(f"  ! translate error: {e}", file=sys.stderr)
        return None


def translate_segments(text: str, idx: int = 0) -> str:
    """한자 세그먼트만 번역 (구조 보존). 일반 string/JSON 값용."""
    def repl(m):
        seg = m.group(0)
        if seg in cache:
            return cache[seg]
        try:
            ko = call_shim(seg, idx)
        except Exception:
            return seg
        if any(c in ko for c in ("\n", "\r", "\t")):
            return seg
        if len(ko) > len(seg) * 6 + 80:
            return seg
        cache[seg] = ko
        return ko
    return CJK_BLOCK.sub(repl, text)


def save_cache() -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def scan_cmd() -> dict[tuple[str, str], int]:
    """대상 테이블별 한자 row 수 카운트."""
    results = {}
    targets = UI_TARGETS + LLM_TARGETS
    for table, col, _, _ in targets:
        try:
            r = sql(f"SELECT COUNT(*) FROM {table} WHERE {col}::text ~ '[\u4e00-\u9fff]'")
            cnt = int(r.strip() or 0)
            results[(table, col)] = cnt
        except RuntimeError:
            results[(table, col)] = -1
    for (t, c), n in results.items():
        mark = "✓ 0" if n == 0 else (f"⚠ {n}" if n > 0 else "! err")
        print(f"  {mark:>8}  {t}.{c}")
    total = sum(n for n in results.values() if n > 0)
    print(f"TOTAL {total} rows with CJK")
    return results


def translate_table(table: str, col: str, is_json: bool, is_llm: bool, dry_run: bool) -> int:
    """해당 (table, col) 업데이트. 반환: 업데이트된 row 수."""
    # PK 및 값 가져오기
    r = sql(f"""
        SELECT id || '\t' || COALESCE({col}::text, '')
        FROM {table}
        WHERE {col}::text ~ '[\u4e00-\u9fff]'
    """)
    rows = []
    for line in r.splitlines():
        if "\t" not in line:
            continue
        pk, val = line.split("\t", 1)
        rows.append((pk.strip(), val))
    if not rows:
        return 0

    print(f"  [{table}.{col}] {len(rows)} rows")
    updated = 0
    for idx, (pk, val) in enumerate(rows):
        if is_llm and len(val) > 80:
            # 긴 LLM prompt: 전체 번역
            new = translate_text(val, idx)
            if new is None:
                continue
        else:
            # 짧은 UI / JSON: 세그먼트 단위
            new = translate_segments(val, idx)
        if new == val:
            continue
        if is_json:
            # JSON 유효성 유지 확인
            try:
                json.loads(new)
            except Exception:
                print(f"    ! JSON broken after translate (id={pk}), skip")
                continue

        # 업데이트 SQL — $$ dollar quoting으로 안전
        delim = f"ko{idx}"
        stmt = f"UPDATE {table} SET {col} = ${delim}${new}${delim}$ WHERE id = '{pk}';"
        if dry_run:
            print(f"    [DRY] {table}.{col} id={pk[:8]}… len {len(val)}→{len(new)}")
        else:
            try:
                sql_write(stmt)
                updated += 1
                if updated % 5 == 0:
                    save_cache()
                    print(f"    {updated}/{len(rows)}")
            except RuntimeError as e:
                print(f"    ✗ update failed id={pk}: {e}")
    save_cache()
    return updated


def translate_cmd(args) -> None:
    targets = UI_TARGETS + (LLM_TARGETS if args.include_templates else [])
    if args.only:
        only_set = set(args.only.split(","))
        targets = [t for t in targets if t[0] in only_set]
    total = 0
    for table, col, is_json, is_llm in targets:
        try:
            n = translate_table(table, col, is_json, is_llm, args.dry_run)
            total += n
        except RuntimeError as e:
            print(f"  ✗ {table}.{col}: {e}")
    print(f"=== done. updated {total} rows ===")
    save_cache()
    print(f"cache: {len(cache)} entries")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["scan", "translate"])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--include-templates", action="store_true",
                    help="LLM prompt 본문도 번역 (prompt_blocks.template, writing_styles.prompt_content)")
    ap.add_argument("--only", help="특정 테이블만 (comma-separated)")
    args = ap.parse_args()

    if args.command == "scan":
        scan_cmd()
        return 0
    if args.command == "translate":
        translate_cmd(args)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
