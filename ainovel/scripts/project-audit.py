#!/usr/bin/env python3
"""Ai-Novel 프로젝트 audit — 빈 테이블/미흡 지점 JSON 리포트.

사용법:
    project-audit.py <project_id>

반환: stdout 에 JSON 리포트.
    {
      "project_id": "...",
      "counts": {...},
      "missing": [
        {"category": "plot_analysis", "severity": "warn", "detail": "..."},
        ...
      ],
      "summary": {"coverage_pct": 95.0, "critical": 0, "warn": 2}
    }
"""
from __future__ import annotations
import json
import subprocess
import sys

LXC = "50176"


def psql(query: str) -> str:
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         "cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -At"],
        input=query, capture_output=True, text=True, timeout=60, check=True,
    )
    return r.stdout.strip()


def count(table: str, where: str = "") -> int:
    q = f"SELECT COUNT(*) FROM {table} WHERE project_id=%(pid)s {('AND ' + where) if where else ''}"
    # pct exec 내부에서 psql 변수 설정
    return int(psql(q.replace("%(pid)s", f"'{PROJ}'")))


def main() -> int:
    global PROJ
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: project-audit.py <project_id>"}), file=sys.stderr)
        return 1
    PROJ = sys.argv[1]

    # 기본 존재 검증
    exists = psql(f"SELECT COUNT(*) FROM projects WHERE id='{PROJ}'").strip()
    if exists == "0":
        print(json.dumps({"error": f"project {PROJ} not found"}), file=sys.stderr)
        return 2

    # 카운트 수집 (project_id 컬럼 가진 모든 테이블)
    tables = [
        "chapters", "outlines", "characters", "entities", "relations", "events",
        "worldbook_entries", "foreshadows", "glossary_terms", "evidence",
        "story_memories", "plot_analysis", "fractal_memory",
        "project_settings", "project_default_styles",
        "llm_presets", "llm_task_presets",
        "project_tables", "project_table_rows",
        "project_source_documents", "knowledge_bases",
        "prompt_presets", "search_documents",
    ]
    counts = {}
    for t in tables:
        try:
            counts[t] = int(psql(f"SELECT COUNT(*) FROM {t} WHERE project_id='{PROJ}'") or 0)
        except Exception:
            counts[t] = -1

    # missing 지점 수집
    missing = []
    ch_count = counts.get("chapters", 0)

    # 본편 커버리지
    if ch_count == 0:
        missing.append({"category": "chapters", "severity": "critical", "detail": "본편이 없음"})
    else:
        # chapter 별 story_memories 최소 1개
        rows = psql(f"""
            SELECT c.number, c.title, COUNT(s.id)
            FROM chapters c LEFT JOIN story_memories s ON s.chapter_id=c.id
            WHERE c.project_id='{PROJ}' GROUP BY c.number, c.title ORDER BY c.number""").splitlines()
        for line in rows:
            parts = line.split("|")
            if len(parts) == 3 and int(parts[2]) == 0:
                missing.append({"category": "story_memories", "severity": "warn",
                                "detail": f"chapter {parts[0]} [{parts[1]}] story_memory 0건"})
        # plot_analysis 장별 매칭
        rows = psql(f"""
            SELECT c.number FROM chapters c
            WHERE c.project_id='{PROJ}' AND NOT EXISTS (
                SELECT 1 FROM plot_analysis p WHERE p.chapter_id=c.id
            ) ORDER BY c.number""").splitlines()
        for n in rows:
            if n:
                missing.append({"category": "plot_analysis", "severity": "warn",
                                "detail": f"chapter {n} plot_analysis 누락"})

    # 메타 필수
    if counts.get("outlines", 0) == 0:
        missing.append({"category": "outlines", "severity": "critical", "detail": "outline 없음"})
    if counts.get("characters", 0) == 0:
        missing.append({"category": "characters", "severity": "critical", "detail": "등장인물 없음"})
    if counts.get("project_settings", 0) == 0:
        missing.append({"category": "project_settings", "severity": "warn", "detail": "프로젝트 설정(world/style/constraints) 없음"})
    if counts.get("llm_presets", 0) == 0:
        missing.append({"category": "llm_presets", "severity": "critical", "detail": "LLM preset 없음 — 생성/분석 불가"})
    if counts.get("worldbook_entries", 0) == 0:
        missing.append({"category": "worldbook_entries", "severity": "warn", "detail": "세계책 비어있음"})
    if counts.get("foreshadows", 0) == 0 and ch_count >= 3:
        missing.append({"category": "foreshadows", "severity": "warn", "detail": "3장+ 작품인데 복선 0건"})
    if counts.get("fractal_memory", 0) == 0 and ch_count > 0:
        missing.append({"category": "fractal_memory", "severity": "info", "detail": "계층 요약(fractal) 없음"})
    if counts.get("glossary_terms", 0) == 0:
        missing.append({"category": "glossary_terms", "severity": "info", "detail": "용어집 비어있음"})

    # 실패 task 잔재
    failed = int(psql(f"SELECT COUNT(*) FROM project_tasks WHERE project_id='{PROJ}' AND status IN ('failed','cancelled')") or 0)
    if failed > 0:
        missing.append({"category": "project_tasks", "severity": "info",
                        "detail": f"failed/cancelled task {failed}건 — reset-tasks 권장"})

    # 미적용 change_sets
    proposed = int(psql(f"SELECT COUNT(*) FROM memory_change_sets WHERE project_id='{PROJ}' AND status='proposed'") or 0)
    if proposed > 0:
        missing.append({"category": "memory_change_sets", "severity": "info",
                        "detail": f"미적용 change_set {proposed}건"})

    critical = sum(1 for m in missing if m["severity"] == "critical")
    warn = sum(1 for m in missing if m["severity"] == "warn")
    filled = sum(1 for v in counts.values() if v > 0)
    coverage_pct = round(filled / len(counts) * 100, 1)

    report = {
        "project_id": PROJ,
        "counts": counts,
        "missing": missing,
        "summary": {
            "coverage_pct": coverage_pct,
            "filled_tables": filled,
            "total_tables": len(counts),
            "critical": critical,
            "warn": warn,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if critical == 0 else 3


if __name__ == "__main__":
    sys.exit(main())
