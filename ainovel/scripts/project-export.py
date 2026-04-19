#!/usr/bin/env python3
"""Ai-Novel 프로젝트 상태를 JSON 으로 덤프 (row 당 json_agg 방식, 개행 안전)."""
from __future__ import annotations
import json
import subprocess
import sys

LXC = "50176"


def psql_json(query: str) -> object:
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         "cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -At"],
        input=query, capture_output=True, text=True, timeout=120, check=True,
    )
    out = r.stdout.strip()
    return json.loads(out) if out and out != "[null]" else []


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: project-export.py <project_id>", file=sys.stderr)
        return 1
    proj = sys.argv[1]
    P = f"'{proj}'"

    # 메타
    meta = psql_json(f"SELECT row_to_json(t) FROM (SELECT name, genre, logline FROM projects WHERE id={P}) t")
    if not meta:
        print(f"project {proj} not found", file=sys.stderr)
        return 2

    data = {"version": 1, "project_id": proj, "meta": meta}

    # settings
    s = psql_json(f"SELECT row_to_json(t) FROM (SELECT world_setting, style_guide, constraints FROM project_settings WHERE project_id={P}) t")
    if s:
        data["settings"] = s

    # outline
    o = psql_json(f"SELECT row_to_json(t) FROM (SELECT title, content_md FROM outlines WHERE project_id={P} LIMIT 1) t")
    if o:
        data["outline"] = o

    # chapters
    data["chapters"] = psql_json(
        f"SELECT json_agg(t ORDER BY number) FROM (SELECT number, title, plan, summary, content_md, status FROM chapters WHERE project_id={P}) t"
    ) or []

    # characters
    data["characters"] = psql_json(
        f"SELECT json_agg(t ORDER BY name) FROM (SELECT name, role, profile, notes FROM characters WHERE project_id={P}) t"
    ) or []

    # entities
    data["entities"] = psql_json(f"""
        SELECT json_agg(t) FROM (
            SELECT entity_type AS type, name, summary_md AS summary,
                   COALESCE(attributes_json::jsonb, '{{}}'::jsonb) AS attributes
            FROM entities WHERE project_id={P}
            ORDER BY entity_type, name
        ) t""") or []

    # relations (entity 이름으로 변환)
    data["relations"] = psql_json(f"""
        SELECT json_agg(t) FROM (
            SELECT (SELECT name FROM entities WHERE id=r.from_entity_id) AS "from",
                   (SELECT name FROM entities WHERE id=r.to_entity_id) AS "to",
                   r.relation_type AS type, r.description_md AS description
            FROM relations r WHERE r.project_id={P}
        ) t""") or []

    # worldbook
    data["worldbook"] = psql_json(f"""
        SELECT json_agg(t ORDER BY priority, title) FROM (
            SELECT title, content_md, priority, enabled, constant,
                   COALESCE(keywords_json::jsonb, '[]'::jsonb) AS keywords
            FROM worldbook_entries WHERE project_id={P}
        ) t""") or []

    # foreshadows
    data["foreshadows"] = psql_json(f"""
        SELECT json_agg(t ORDER BY c_num) FROM (
            SELECT (SELECT number FROM chapters WHERE id=f.chapter_id) AS chapter,
                   (SELECT number FROM chapters WHERE id=f.chapter_id) AS c_num,
                   (SELECT number FROM chapters WHERE id=f.resolved_at_chapter_id) AS resolved_at_chapter,
                   f.title, f.content_md AS content, f.resolved
            FROM foreshadows f WHERE f.project_id={P}
        ) t""") or []
    for fs in data["foreshadows"]:
        fs.pop("c_num", None)

    # glossary
    data["glossary"] = psql_json(f"""
        SELECT json_agg(t ORDER BY term) FROM (
            SELECT term,
                   COALESCE(aliases_json::jsonb, '[]'::jsonb) AS aliases,
                   COALESCE(sources_json::jsonb, '[]'::jsonb) AS sources
            FROM glossary_terms WHERE project_id={P}
        ) t""") or []

    # evidence
    data["evidence"] = psql_json(f"""
        SELECT json_agg(t) FROM (
            SELECT (SELECT number FROM chapters WHERE id=e.source_id) AS chapter,
                   e.quote_md AS quote,
                   COALESCE(e.attributes_json::jsonb, '{{}}'::jsonb) AS attributes
            FROM evidence e WHERE e.project_id={P} AND e.source_type='chapter'
        ) t""") or []

    # story_memories
    data["story_memories"] = psql_json(f"""
        SELECT json_agg(t ORDER BY timeline) FROM (
            SELECT (SELECT number FROM chapters WHERE id=s.chapter_id) AS chapter,
                   s.memory_type AS type, s.title, s.content,
                   s.importance_score AS importance,
                   COALESCE(s.tags_json::jsonb, '[]'::jsonb) AS tags,
                   s.is_foreshadow, s.story_timeline AS timeline
            FROM story_memories s WHERE s.project_id={P}
        ) t""") or []
    for sm in data["story_memories"]:
        sm.pop("timeline", None)

    # plot_analysis
    data["plot_analysis"] = psql_json(f"""
        SELECT json_agg(t) FROM (
            SELECT (SELECT number FROM chapters WHERE id=p.chapter_id) AS chapter,
                   p.overall_quality_score AS overall,
                   p.coherence_score AS coherence,
                   p.engagement_score AS engagement,
                   p.pacing_score AS pacing,
                   p.analysis_report_md AS report,
                   COALESCE(p.analysis_json::jsonb, '{{}}'::jsonb) AS analysis
            FROM plot_analysis p WHERE p.project_id={P}
        ) t""") or []

    # numeric_tables
    data["numeric_tables"] = psql_json(f"""
        SELECT json_agg(pt) FROM (
            SELECT table_key AS key, name,
                   COALESCE(schema_json::jsonb, '{{}}'::jsonb) AS schema,
                   (SELECT json_agg(json_build_object('row_index', row_index, 'data', data_json::jsonb) ORDER BY row_index)
                    FROM project_table_rows ptr WHERE ptr.table_id=t.id) AS rows
            FROM project_tables t WHERE project_id={P}
        ) pt""") or []

    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
