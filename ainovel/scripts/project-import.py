#!/usr/bin/env python3
"""JSON 을 받아 Ai-Novel 프로젝트에 upsert.

사용법:
    project-import.py <project_id> <file.json> [--dry-run]

JSON 스키마는 project-export.py 출력과 동일. 부분만 넣어도 OK (있는 키만 처리).
"""
from __future__ import annotations
import json
import subprocess
import sys
import uuid

LXC = "50176"


def psql(query: str, *, capture: bool = True) -> str:
    r = subprocess.run(
        ["pct", "exec", LXC, "--", "bash", "-c",
         "cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -At -v ON_ERROR_STOP=1"],
        input=query, capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:500])
    return r.stdout.strip() if capture else ""


def q(s: str) -> str:
    """SQL literal escape."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def jq(obj) -> str:
    """JSON literal escape."""
    if obj is None:
        return "NULL"
    return q(json.dumps(obj, ensure_ascii=False))


def get_chapter_id(proj: str, number: int, cache: dict) -> str | None:
    if ("ch", number) in cache:
        return cache[("ch", number)]
    r = psql(f"SELECT id FROM chapters WHERE project_id={q(proj)} AND number={int(number)}")
    cache[("ch", number)] = r or None
    return cache[("ch", number)]


def get_entity_id(proj: str, name: str, cache: dict) -> str | None:
    if ("en", name) in cache:
        return cache[("en", name)]
    r = psql(f"SELECT id FROM entities WHERE project_id={q(proj)} AND name={q(name)} LIMIT 1")
    cache[("en", name)] = r or None
    return cache[("en", name)]


def run(sql: str, dry: bool) -> None:
    if dry:
        print(f"  [DRY] {sql[:120]}")
        return
    psql(sql, capture=False)


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: project-import.py <project_id> <file.json> [--dry-run]", file=sys.stderr)
        return 1
    proj = sys.argv[1]
    path = sys.argv[2]
    dry = "--dry-run" in sys.argv[3:]

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    exists = psql(f"SELECT 1 FROM projects WHERE id={q(proj)}")
    if not exists:
        print(f"project {proj} not found", file=sys.stderr)
        return 2

    summary = {"updated": [], "inserted": [], "errors": []}
    cache: dict = {}

    # 1) meta
    if "meta" in data:
        m = data["meta"]
        fields = []
        if "name" in m: fields.append(f"name={q(m['name'])}")
        if "genre" in m: fields.append(f"genre={q(m['genre'])}")
        if "logline" in m: fields.append(f"logline={q(m['logline'])}")
        if fields:
            run(f"UPDATE projects SET {', '.join(fields)} WHERE id={q(proj)};", dry)
            summary["updated"].append("projects")

    # 2) settings
    if "settings" in data:
        s = data["settings"]
        run(f"""INSERT INTO project_settings (project_id, world_setting, style_guide, constraints,
            vector_index_dirty, context_optimizer_enabled,
            auto_update_worldbook_enabled, auto_update_characters_enabled, auto_update_story_memory_enabled,
            auto_update_graph_enabled, auto_update_vector_enabled, auto_update_search_enabled,
            auto_update_fractal_enabled, auto_update_tables_enabled)
            VALUES ({q(proj)}, {q(s.get('world_setting',''))}, {q(s.get('style_guide',''))}, {q(s.get('constraints',''))},
                    false, true, true, true, true, true, true, true, true, true)
            ON CONFLICT (project_id) DO UPDATE SET
              world_setting=EXCLUDED.world_setting, style_guide=EXCLUDED.style_guide, constraints=EXCLUDED.constraints;""", dry)
        summary["updated"].append("project_settings")

    # 3) outline
    if "outline" in data:
        o = data["outline"]
        run(f"""UPDATE outlines SET title={q(o.get('title',''))}, content_md={q(o.get('content_md',''))}
                WHERE project_id={q(proj)};""", dry)
        summary["updated"].append("outlines")

    # 4) chapters (number 기준 upsert)
    if "chapters" in data:
        oid = psql(f"SELECT id FROM outlines WHERE project_id={q(proj)} LIMIT 1")
        for ch in data["chapters"]:
            n = int(ch["number"])
            existing = psql(f"SELECT id FROM chapters WHERE project_id={q(proj)} AND number={n}")
            if existing:
                run(f"""UPDATE chapters SET
                    title={q(ch.get('title',''))},
                    plan={q(ch.get('plan','') or '')},
                    summary={q(ch.get('summary','') or '')},
                    content_md={q(ch.get('content_md','') or '')},
                    status={q(ch.get('status','drafting'))},
                    updated_at=NOW()
                    WHERE id={q(existing)};""", dry)
                summary["updated"].append(f"chapter#{n}")
            else:
                cid = str(uuid.uuid4())
                run(f"""INSERT INTO chapters (id, project_id, number, title, plan, summary, content_md, status, outline_id, updated_at)
                    VALUES ({q(cid)}, {q(proj)}, {n}, {q(ch.get('title',''))}, {q(ch.get('plan','') or '')},
                            {q(ch.get('summary','') or '')}, {q(ch.get('content_md','') or '')},
                            {q(ch.get('status','drafting'))}, {q(oid)}, NOW());""", dry)
                summary["inserted"].append(f"chapter#{n}")

    # 5) characters
    if "characters" in data:
        for c in data["characters"]:
            existing = psql(f"SELECT id FROM characters WHERE project_id={q(proj)} AND name={q(c['name'])}")
            if existing:
                run(f"""UPDATE characters SET role={q(c.get('role','') or '')}, profile={q(c.get('profile','') or '')},
                        notes={q(c.get('notes','') or '')}, updated_at=NOW() WHERE id={q(existing)};""", dry)
                summary["updated"].append(f"char:{c['name']}")
            else:
                run(f"""INSERT INTO characters (id, project_id, name, role, profile, notes, updated_at)
                    VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(c['name'])}, {q(c.get('role','') or '')},
                            {q(c.get('profile','') or '')}, {q(c.get('notes','') or '')}, NOW());""", dry)
                summary["inserted"].append(f"char:{c['name']}")

    # 6) entities
    if "entities" in data:
        for e in data["entities"]:
            existing = psql(f"SELECT id FROM entities WHERE project_id={q(proj)} AND name={q(e['name'])}")
            if existing:
                run(f"""UPDATE entities SET entity_type={q(e.get('type','character'))},
                        summary_md={q(e.get('summary','') or '')},
                        attributes_json={jq(e.get('attributes',{}))}, updated_at=NOW()
                        WHERE id={q(existing)};""", dry)
                summary["updated"].append(f"ent:{e['name']}")
            else:
                eid = str(uuid.uuid4())
                run(f"""INSERT INTO entities (id, project_id, entity_type, name, summary_md, attributes_json, created_at, updated_at)
                    VALUES ({q(eid)}, {q(proj)}, {q(e.get('type','character'))}, {q(e['name'])},
                            {q(e.get('summary','') or '')}, {jq(e.get('attributes',{}))}, NOW(), NOW());""", dry)
                summary["inserted"].append(f"ent:{e['name']}")

    # 7) relations
    if "relations" in data:
        run(f"DELETE FROM relations WHERE project_id={q(proj)};", dry)
        for r_ in data["relations"]:
            fe = get_entity_id(proj, r_["from"], cache)
            te = get_entity_id(proj, r_["to"], cache)
            if fe and te:
                run(f"""INSERT INTO relations (id, project_id, from_entity_id, to_entity_id, relation_type, description_md, created_at, updated_at)
                    VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(fe)}, {q(te)}, {q(r_['type'])},
                            {q(r_.get('description','') or '')}, NOW(), NOW());""", dry)
                summary["inserted"].append(f"rel:{r_['from']}->{r_['to']}")

    # 8) worldbook
    if "worldbook" in data:
        run(f"DELETE FROM worldbook_entries WHERE project_id={q(proj)};", dry)
        for wb in data["worldbook"]:
            run(f"""INSERT INTO worldbook_entries (id, project_id, title, content_md, enabled, constant,
                keywords_json, exclude_recursion, prevent_recursion, char_limit, priority, updated_at)
                VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(wb['title'])}, {q(wb.get('content_md',''))},
                        {bool(wb.get('enabled',True))}, {bool(wb.get('constant',False))},
                        {jq(wb.get('keywords',[]))}, false, false, 0,
                        {q(wb.get('priority','important'))}, NOW());""", dry)
            summary["inserted"].append(f"wb:{wb['title']}")

    # 9) foreshadows
    if "foreshadows" in data:
        run(f"DELETE FROM foreshadows WHERE project_id={q(proj)};", dry)
        for fs in data["foreshadows"]:
            cid = get_chapter_id(proj, int(fs["chapter"]), cache) if fs.get("chapter") else None
            rcid = get_chapter_id(proj, int(fs["resolved_at_chapter"]), cache) if fs.get("resolved_at_chapter") else None
            run(f"""INSERT INTO foreshadows (id, project_id, chapter_id, resolved_at_chapter_id, title, content_md, resolved, created_at, updated_at)
                VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(cid) if cid else 'NULL'}, {q(rcid) if rcid else 'NULL'},
                        {q(fs['title'])}, {q(fs.get('content',''))}, {int(fs.get('resolved',0))}, NOW(), NOW());""", dry)
            summary["inserted"].append(f"fs:{fs['title']}")

    # 10) glossary
    if "glossary" in data:
        run(f"DELETE FROM glossary_terms WHERE project_id={q(proj)};", dry)
        for g in data["glossary"]:
            run(f"""INSERT INTO glossary_terms (id, project_id, term, aliases_json, sources_json, origin, enabled, created_at, updated_at)
                VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(g['term'])},
                        {jq(g.get('aliases',[]))}, {jq(g.get('sources',[]))},
                        'manual', 1, NOW(), NOW());""", dry)
            summary["inserted"].append(f"gl:{g['term']}")

    # 11) evidence
    if "evidence" in data:
        run(f"DELETE FROM evidence WHERE project_id={q(proj)};", dry)
        for ev in data["evidence"]:
            cid = get_chapter_id(proj, int(ev["chapter"]), cache) if ev.get("chapter") else None
            run(f"""INSERT INTO evidence (id, project_id, source_type, source_id, quote_md, attributes_json, created_at)
                VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, 'chapter', {q(cid) if cid else 'NULL'},
                        {q(ev['quote'])}, {jq(ev.get('attributes',{}))}, NOW());""", dry)
            summary["inserted"].append(f"ev:ch{ev.get('chapter')}")

    # 12) story_memories
    if "story_memories" in data:
        run(f"DELETE FROM story_memories WHERE project_id={q(proj)};", dry)
        for i, sm in enumerate(data["story_memories"], 1):
            cid = get_chapter_id(proj, int(sm["chapter"]), cache) if sm.get("chapter") else None
            run(f"""INSERT INTO story_memories (id, project_id, chapter_id, memory_type, title, content,
                importance_score, tags_json, story_timeline, text_position, text_length, is_foreshadow, created_at, updated_at)
                VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(cid) if cid else 'NULL'},
                        {q(sm.get('type','note'))}, {q(sm.get('title',''))}, {q(sm['content'])},
                        {float(sm.get('importance',0.7))}, {jq(sm.get('tags',[]))}, {i}, 0, 0,
                        {int(sm.get('is_foreshadow',0))}, NOW(), NOW());""", dry)
            summary["inserted"].append(f"sm:{sm.get('title','')[:30]}")

    # 13) plot_analysis
    if "plot_analysis" in data:
        run(f"DELETE FROM plot_analysis WHERE project_id={q(proj)};", dry)
        for pa in data["plot_analysis"]:
            cid = get_chapter_id(proj, int(pa["chapter"]), cache)
            if cid:
                run(f"""INSERT INTO plot_analysis (id, project_id, chapter_id, analysis_json,
                    overall_quality_score, coherence_score, engagement_score, pacing_score, analysis_report_md, created_at)
                    VALUES ({q(str(uuid.uuid4()))}, {q(proj)}, {q(cid)}, {jq(pa.get('analysis',{}))},
                            {float(pa.get('overall',0.8))}, {float(pa.get('coherence',0.8))},
                            {float(pa.get('engagement',0.8))}, {float(pa.get('pacing',0.8))},
                            {q(pa.get('report',''))}, NOW());""", dry)
                summary["inserted"].append(f"plot:ch{pa['chapter']}")

    print(json.dumps({"dry_run": dry, "summary": summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
