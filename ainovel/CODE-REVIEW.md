# Ai-Novel Korean-i18n Automation — Code Review

Scope: `ainovel/scripts/zh-to-ko.py`, `db-zh-to-ko.py`, `backend-zh-to-ko.py`, `backend-final-fix.py`, `fix-prompts*.sql`, `pxi/pxi-ainovel`, `pxi/README.md`.
Review date: 2026-04-19.

## Summary

Verdict: **Ship, with fixes.** The design (segment-level translate + cache + guards + iterate-until-zero) is sound and defensive. Safety rails (`compile()` check, JSON validation, length cap, newline/backtick reject) catch the common failure modes. But there are several latent bugs in the same class as the `pct pull` issue you already hit, plus real concurrency/idempotency holes that will bite when the timer fires during a manual run.

Top 3 concerns:

1. **Concurrent timer-vs-manual (and timer-vs-timer on slow nodes) will clobber files and the cache** — no `flock`, no mtime check. `ainovel-translate.timer` at 10 min + `TimeoutStartSec=2h` means two instances can overlap.
2. **Frontend TS/TSX has no parser/compile check before `pct push`** — unlike `backend-zh-to-ko.py:170` which runs `compile()`. A corrupted `.tsx` only surfaces at the next `up -d --build frontend`.
3. **Multiple silent `pct pull/exec` failures** — same exit-0-on-failure class as the bug already fixed. `backend-final-fix.py:30` and several `pct exec` subprocess calls ignore return codes / don't `check=True`.

---

## Critical issues

### C1. Frontend translator has no syntax validation before push
`scripts/zh-to-ko.py:180-191`

`backend-zh-to-ko.py:170-172` correctly runs `compile(new_content, relpath, "exec")` before pushing back. The frontend equivalent is missing — `zh-to-ko.py` writes and pushes unconditionally once `hits > 0`.

Risk: a crafted Korean translation that slips past the newline/backtick reject (e.g., something that accidentally creates `</` or breaks JSX attribute parsing) ships to `/opt/ainovel/frontend/src` and only fails at Vite build. Because `cmd_translate` then runs `up -d --build frontend`, a build failure can leave the running container serving stale code with no alert.

Fix: pipe the new content through a fast TS/TSX parser (or at minimum a bracket/quote balancer) before push. A cheap proxy: run `node -e "require('@babel/parser').parse(src, {sourceType:'module', plugins:['typescript','jsx']})"` inside the LXC, or compare balanced-paren/brace/bracket counts before vs after and bail on divergence.

### C2. `backend-final-fix.py:30` — same `pct pull` exit-0-on-failure bug
`scripts/backend-final-fix.py:30`

```python
r = subprocess.run(["pct", "pull", LXC, src, str(local)], capture_output=True)
content = local.read_text()
```

No `check=True`, no inspection of `r.returncode`. If pull fails but a stale file exists at `local` from a previous run, you replay fixups against stale content and `pct push` it back — silently overwriting newer content in the LXC. This is the exact pattern that caused the initial 0-hits symptom.

Fix: `subprocess.run([...], check=True, capture_output=True)` and either delete `local` before pull or `local.unlink(missing_ok=True)` at the start of `fix_file`.

### C3. No lock between the systemd timer and manual/parallel runs
`pxi/pxi-ainovel:151-179` + every `process_file` in the Python scripts

The timer service runs `pxi-ainovel translate --include-templates` with `TimeoutStartSec=2h`. At `OnCalendar=*:0/10` (10 min) the README recommends, the previous run can still be going. Worse, `pxi run ainovel translate` manually does no coordination with the timer.

Concrete corruption scenario:
1. Timer run A: `pct pull` file X → modifies locally → (slow translate, 3 min pass).
2. Manual run B: `pct pull` file X (the already-modified-on-disk-in-LXC version? no — A hasn't pushed yet, so B gets the *original*) → modifies → `pct push` (LXC now has B's version).
3. A finishes → `pct push` its version (built from the original). **B's work is wiped.**

Same hazard on `CACHE_FILE` at `/tmp/ainovel-gemma-translate/translations.json`: `save_cache` is atomic within a single process (`cache_lock`) but there is no cross-process locking. Last writer wins; cache entries produced by one run get dropped.

Fix: wrap the ExecStart in `flock`:

```ini
ExecStart=/usr/bin/flock -n /var/lock/ainovel-translate.lock /usr/local/bin/pxi-ainovel translate --include-templates
```

And in `pxi-ainovel translate`, acquire the same lock (fail fast with a clear message if held). For the cache file, either `fcntl.flock` around read-modify-write, or move to SQLite which gives you atomic upserts for free.

### C4. Auto-on default in `install` disagrees with the architecture
`pxi/pxi-ainovel:64` → `cmd_auto_on daily`
`pxi/README.md:37` → recommends `*:0/10` (10 min)
`CLAUDE.md` context you supplied → "systemd timer every 10 min"

`cmd_install` wires up `daily`, which defeats the "new prompt drift is backfilled before user opens prompt-studio" design described in `pxi/README.md:46-51`. Users who follow the happy-path installer get daily translation; the 10-min drift-minimization behavior is latent.

Fix: change `cmd_install`'s default to `"*:0/10"`, or add an `--interval` flag and document the trade-off (daily is cheap; 10-min catches new projects fast).

---

## High-priority issues

### H1. `zh-to-ko.py:86` rejects `\\` via a different mechanism than `backend-zh-to-ko.py:75` — lossy for frontend
`scripts/zh-to-ko.py:86` vs `scripts/zh-to-ko.py:174`

Frontend `translate_segment` accepts a translation that contains `\`, then `process_file` silently **strips** backslashes via `ko.replace("\\", "")` at line 174. Backend rejects entirely. The frontend behavior is more aggressive than documented and can drop legitimate characters (e.g., a translated string containing a literal `\` for escaping). It can also yield broken escapes — if Gemma returns `번호: \\n` it strips to `번호: n`, nonsense.

Fix: align with backend — **reject** translations containing `\` (or any of `\n \r \t \` ` `). The strip approach hides problems instead of retrying/skipping.

### H2. `zh-to-ko.py` has no guard against `${...}` template-literal reintroduction after regex sub
`scripts/zh-to-ko.py:86`

Guard rejects if `"${" in ko`. Good. But a JSX/TS block like:
```ts
const msg = `你好 ${name}`;  // CJK matches regex
```
The CJK segment matched is just `你好`. If Gemma returns `"안녕 $"`, the resulting line becomes:
```ts
const msg = `안녕 $ ${name}`;
```
which is still valid but semantic drift. Lower risk: if Gemma returns `안녕 ${'`, post-sub you get `안녕 ${'${name}` — syntax-broken template literal. The `"${" in ko` guard catches this specific case. But **partial** substrings like trailing `${` in adjacent context after substitution aren't blocked (ko ends with `$`, next char is `{` from surrounding line).

Fix: scan the rewritten *line* (not just `ko`) for newly introduced `${` and revert on detection. Or require `ko` to not end with `$`.

### H3. `db-zh-to-ko.py` `sql()` uses unsafe bash interpolation; `sql_write()` does it right — inconsistent
`scripts/db-zh-to-ko.py:69-78` vs `:81-89`

`sql()` interpolates the query into `bash -c "... psql -Atc \"{query}\""`. All read queries in this file are hardcoded, so no current exploit — but the pattern is the same shape as the injection vector you want to avoid. Any future query touching a variable (e.g., filtering by a computed `pk` or column name) would be immediately injectable.

`sql_write()` correctly pipes via stdin and uses `ON_ERROR_STOP=1`.

Fix: change `sql()` to the same stdin pattern:
```python
r = subprocess.run(
    ["pct","exec",LXC,"--","bash","-c",
     "cd /opt/ainovel && docker compose --env-file .env.docker exec -T postgres psql -U ainovel -d ainovel -Atc -"],
    input=query, capture_output=True, text=True, timeout=60, check=False,
)
```

### H4. `db-zh-to-ko.py:203` — dollar-quoting can collide with translated content
`scripts/db-zh-to-ko.py:202-203`

```python
delim = f"ko{idx}"
stmt = f"UPDATE {table} SET {col} = ${delim}${new}${delim}$ WHERE id = '{pk}';"
```

If `new` happens to contain `$ko0$` (e.g., Gemma returns a `$k`-containing string on row 0), the UPDATE becomes syntactically malformed and the write fails (loudly — `sql_write` raises). Not corruption, but a source of mystery errors on specific rows.

Additionally: `pk` is string-interpolated with `'` quoting. If `pk` contains `'` the update fails. Ai-Novel PKs appear to be UUIDs, so this is practically safe — but documenting the assumption would help.

Fix: randomize/hash `delim` based on `new`'s content (e.g., `delim = "k" + secrets.token_hex(4)` and loop if collision), or switch the entire write path to parameterized psql with `-v` bindings or a Python psycopg connection and `cursor.execute(sql, (new, pk))`.

### H5. Dead code + missed coverage in `db-zh-to-ko.py`
`scripts/db-zh-to-ko.py:10, 52-56`

- Docstring advertises `project_default_styles (있으면)` as in scope (line 10) but `UI_TARGETS` does not include it. Silent gap.
- `INDEX_TARGETS` is defined (lines 52-56) and never referenced anywhere. Dead (per `feedback_no_dead_code.md` in project memory) **and** misleading — anyone reading the whitelist thinks `search_documents` is handled.

Fix: either wire up `INDEX_TARGETS` (probably with a `source_type != 'outline'` WHERE clause), or delete it with a comment that search_documents is rebuilt from already-translated sources.

### H6. Timer + compile check absent for `strip-parenthetical` and `clean-nested`
`scripts/zh-to-ko.py:233-295`

Both remote-executed snippets do `.sub()` and `p.write_text(new)` unconditionally on `.ts/.tsx` source. No parser check. The `clean-nested` final pattern `r'\([\u4e00-\u9fff]+\)'` is particularly broad — if a file had `call(漢字)` (function call with Chinese identifier, extremely unlikely in a real repo but nothing prevents it), it'd rewrite to `call` — **syntax error on next build**. Worse: the regex also matches inside comments and strings, so `/* 설명 (中) */` → `/* 설명  */`, which is benign, but `\`hi (中)\`` → `\`hi \`` is still valid, while `"(中)"` → `""` silently loses a string literal.

Fix: at minimum, after `strip_parenthetical` and `clean_nested`, re-run the scan and if *total files* went down unexpectedly or any file shrank by >N%, alert. Better: post-modify, try `node -c` (or a JS parser) on changed files.

### H7. `backend-final-fix.py` `"。" → "."` replaces across the whole file, including user-visible strings
`scripts/backend-final-fix.py:24`

`"。"` (U+3002 CJK full stop) is not in the `\u4e00-\u9fff` CJK-ideograph range, but this rule rewrites it to ASCII `.` wherever it appears in any .py file that had ideographs. If a Python file has a translated Korean sentence that happens to contain `。` (shouldn't, but if Gemma leaked one in), it gets rewritten. Minor, but also: **this is a blanket replace with no context**, and if the file contains e.g. `regex = r".+。"` with `。` deliberately matching that char, it silently changes behavior.

Fix: scope the replace to lines that still have CJK ideographs (i.e., only clean up `。` that co-occurs with untranslated content), or make the rule opt-in with a `--aggressive` flag.

### H8. `backend-final-fix.py` REPLACEMENTS contains `("章", "장")` — too coarse
`scripts/backend-final-fix.py:21`

A simple-string replace of `"章"` across arbitrary Python. If any identifier, type annotation, regex, or docstring deliberately uses `章` (e.g., `CHAPTER_MARKER = "章"` as a sentinel value for compatibility with externally-generated data), it silently becomes `장`. The `compile()` check catches *syntax* breakage but not *semantic* breakage like "constant value changed".

Fix: scope to only `.replace("章", "장")` inside string literals or only within files from a known list of seed-constants. Or: before applying, `grep -n '章'` and eyeball the hits; don't run blindly on new files you haven't reviewed.

### H9. `pxi-ainovel` unquoted variable expansion inside `pct exec bash -lc "..."`
`pxi/pxi-ainovel:26, 39, 74-85, 117, 138`

```bash
in_lxc(){ pct exec "$VMID" -- bash -lc "$*"; }
compose(){ in_lxc "cd $APP_ROOT && docker compose --env-file .env.docker $*"; }
cmd_logs(){ local svc="${1:-backend}"; compose "logs -f --tail=100 $svc"; }
```

`svc` is user-supplied and ends up inside `bash -lc` without quoting. `pxi run ainovel logs 'foo; touch /tmp/pwned'` executes on the LXC. Same pattern in `cmd_rebuild`, `cmd_translate` (`up -d --build frontend` is hardcoded so OK there, but the template is dangerous).

Severity is low because this is a root-only CLI on a trusted host, but the pattern is one refactor away from being externally-reachable (e.g., if this ever gets called from a webhook or chatops bot).

Fix: validate `svc` against a whitelist of compose services (`frontend|backend|postgres|redis|rq_worker`) before passing it through; reject unknown values. Or use an array and avoid `bash -lc` entirely where possible.

---

## Nice-to-have improvements

### N1. `*.split("\n")` + `"\n".join(...)` drops trailing newlines
`scripts/zh-to-ko.py:156, 183` and `scripts/backend-zh-to-ko.py:141, 168`

If the original file ended with `\n`, the rewritten file won't. POSIX tooling and git diffs will whine about "no newline at end of file". Use `str.splitlines(keepends=True)` or preserve the trailing newline explicitly.

### N2. `process_file` local filename collisions
`scripts/zh-to-ko.py:146`, `scripts/backend-zh-to-ko.py:131`

`WORK / relpath.replace("/", "__")` can collide: `foo/bar.py` and `foo__bar.py` both map to `foo__bar.py`. Not a practical concern in this repo, but if parallel workers pick the two simultaneously they race on the temp file. Use `hashlib.sha1(relpath.encode()).hexdigest()[:16]` or keep a nested dir structure.

### N3. `CJK_BLOCK` regex tolerates but doesn't require CJK on both ends consistently
`scripts/zh-to-ko.py:39-44`, `scripts/db-zh-to-ko.py:59-64`, `scripts/backend-zh-to-ko.py:38-43`

Two alternations: the long form ending in `[\uff00-\uffef]` + punctuation, and the short fallback `[\u4e00-\u9fff]+`. In practice the first alternation can extend into fullwidth Latin characters (U+FF00-U+FFEF) that aren't CJK ideographs — e.g., a fullwidth `！` trailing Chinese gets swept into the segment. Usually fine because Gemma handles it, but the segment boundary is wider than the name implies. Worth a comment in the source explaining intent.

### N4. `scan_cmd` filter uses substring `'.test.' in p.name` but file list uses regex `\.test\.(ts|tsx)$`
`scripts/zh-to-ko.py:110` vs `:123`

Consistent for normal filenames. Diverges on edge cases like `foo.test.ts.bak`, `foo.test.old.tsx`. Unlikely in real code, but makes the scan's "remaining" count potentially disagree with what translate actually processes. Pick one and reuse.

### N5. Frontend `process_file` comment detection is line-heuristic
`scripts/zh-to-ko.py:161`

Skips lines starting with `//` or `*`. Does not skip:
- Trailing line comments: `const x = 1; // 中文`
- First line of a block comment: `/* 中文 comment`
- JSDoc blocks starting with `/**`

Line comments with trailing `//` are probably rare but would get translated as-if they were code. Consequence: translation happens (fine) but the surrounding regex treats it as a string context — could still produce valid TS. Low-impact; flagging for completeness.

### N6. `process_file` uses `local.read_text()` / `write_text()` without explicit encoding
`scripts/zh-to-ko.py:152, 183`, `scripts/backend-zh-to-ko.py:137, 174`

Relies on `locale.getpreferredencoding()`. On pve this is probably UTF-8, but if someone ever runs these in a C-locale systemd unit, it'd mojibake on read. Use `encoding="utf-8"` explicitly. Same for `backend-final-fix.py`.

### N7. `backend-zh-to-ko.py` loads cache at module import
`scripts/backend-zh-to-ko.py:46-47`

```python
cache: dict[str, str] = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}
print(f"캐시: {len(cache)}개", file=sys.stderr)
```

Side effect on import. If this file ever gets imported by another script (not unthinkable), both scripts pay the I/O + print cost. Move into a `main()` or a lazy `get_cache()`.

### N8. Shim failure produces silent skip but consumes full run time
`scripts/zh-to-ko.py:82-84`, `scripts/backend-zh-to-ko.py:71-73`, `scripts/db-zh-to-ko.py:112-118`

If all four Gemma shims are down, every segment returns `None`. `translate_cmd` happily reports `ok=0 hits=0` and the outer `run_all_cmd` detects "진행 정체" after the second round — so it halts, but only after two empty passes. Worse for the 2h systemd timeout: nothing exits early.

Fix: add a circuit breaker — if the first N `call_shim` attempts all raise, bail with a clear error and exit non-zero so the timer marks the run as failed (visible in `systemctl status`). 5 consecutive failures is a reasonable threshold.

### N9. README says `ainovel-translate.timer` every 10 min, installer says `daily`, README usage example says `"*:0/10"` — pick one
`pxi/README.md:37-39` and `pxi/pxi-ainovel:64`

Already flagged in C4. Nice-to-have: also mention in README that `daily` is a cheap default for dormant instances and `*:0/10` is for active authoring sessions.

### N10. `rollback-broken.sh`, `safe-translate-cache.py`, `translate-all.py`, `apply-translations.sh`, `find-skip.sh`, `scripts-translate-uicopy.py` exist but are not in review scope
out-of-scope files

You scoped this to the seven files listed. Flagging: several adjacent scripts in the same directory (`scan-cjk.sh`, `rollback-broken.sh`, etc.) may duplicate or contradict the in-scope logic. Worth a cleanup pass to delete unused ones (per project memory `feedback_no_dead_code.md`) or mark them clearly as archival.

---

## Missing coverage (the "what still slips through" question)

Gaps the current pipeline does not touch:

1. **Chinese filenames.** `list_target_files` uses `p.relative_to(...)` and then the path string flows through `pct pull`/`pct push`. If a source file is named `组件.tsx`, the pipeline iterates it but the filename itself is never renamed. Not a translation-correctness bug, but user-visible in the IDE and in build output. Separate rename pass needed; must also update imports.
2. **Frontend non-TS/TSX.** `.json` (especially any `i18n/*.json`, `locale.json`, `zh-CN.json`), `.md`, `.html`, `.svg` with text, `.css` `content: "..."` are all out of scope. If ai-novel ships any of these with CJK seed, they ship untranslated.
3. **Backend non-`.py` under `app/`.** `.sql` migration files (`alembic/versions/*.py` is probably covered since it ends in `.py`, but raw `.sql` isn't). Jinja/HTML templates if any. `pyproject.toml`/`README.md` module-level doc.
4. **Backend outside `app/`.** `backend-zh-to-ko.py` restricts to `/opt/ainovel/backend/app`. Anything under `backend/scripts/`, `backend/tests/`, `backend/alembic/` (the migration dir) is skipped. Migration files often contain Chinese comments from upstream; if a migration's Chinese docstring affects auto-generated rollback messages, you'd notice later.
5. **Database tables not in whitelist.** Confirmed gaps vs. the docstring:
   - `project_default_styles` — claimed in docstring, not in list.
   - `search_documents` — `INDEX_TARGETS` declared but dead code (H5).
   - Potentially: `prompt_preset_blocks` join table, `prompt_presets.description` if such a column exists. Run `\d+ prompt_presets` and `\dt` on a fresh seed to enumerate.
6. **Environment and config.** `.env.docker`, `docker-compose.yml` defaults, `ainovel.toml` recipe values. Low probability of CJK but not zero (e.g., `AUTH_ADMIN_NAME`).
7. **`.test.ts` intentionally skipped.** You already flagged this. If/when you want tests translated, add `--include-tests` to the timer unit.

---

## What's done well

- **Per-language guards are tuned**: backend rejects `\\`, `{{`, `}}`, `${` and substitutes straight quotes with fullwidth `\u201d`/`\u2019` to avoid literal-string boundary issues. Frontend uses `'` substitution. This is exactly the kind of file-type-specific hardening that survives production.
- **`compile()` pre-push check on backend** (`backend-zh-to-ko.py:170`) is the single best safety rail in the codebase — keep it, copy to frontend (C1).
- **JSON column validation on DB path** (`db-zh-to-ko.py:194-199`) — `json.loads(new)` before UPDATE. Great.
- **`sql_write` uses stdin + `ON_ERROR_STOP=1`** (`db-zh-to-ko.py:81-89`). The right pattern; now propagate to `sql()` (H3).
- **Cache hit-or-skip is idempotent**: re-running is cheap because `translations.json` dedupes. Timer at 10 min is only expensive on the first seed.
- **DB whitelist is explicit, not discovered** — code review catches accidental user-data translation at PR time. Exactly how a user-data-safe pipeline should be shaped. Extend with H5/missing-coverage gaps and it's complete.
- **`run_all_cmd` stall detection** (`zh-to-ko.py:313-314`) — comparing `before >= after` halts the loop on no-progress instead of infinite-looping. Nice safety.
- **Dispatcher separates lifecycle from translation** — `pxi-ainovel install/up/down/translate/auto-*` is clean and the README accurately describes the architecture.
- **Length cap** (`ko > len(text) * 6 + 80`) — cheap sanity guard against Gemma hallucinating paragraphs from a single glyph.

---

## Suggested fix order

1. C2, C3 (data-loss risks) — `flock` + `pct pull check=True` are quick mechanical fixes.
2. C1 (frontend compile check) + H1 (backslash handling) — tighten the reject rules to match backend.
3. C4 (installer interval) — one-line change; align with docs.
4. H3, H4 (DB `sql()` hygiene + dollar-quote collision).
5. H5 (wire or delete `INDEX_TARGETS`, add `project_default_styles`).
6. H6, H7, H8 — scope the "final fix" replacements narrower; run parser check after nested-clean.
7. N-series at leisure.

Relevant files referenced in this review (absolute paths):

- `/root/homelab-i18n/ainovel/scripts/zh-to-ko.py`
- `/root/homelab-i18n/ainovel/scripts/db-zh-to-ko.py`
- `/root/homelab-i18n/ainovel/scripts/backend-zh-to-ko.py`
- `/root/homelab-i18n/ainovel/scripts/backend-final-fix.py`
- `/root/homelab-i18n/ainovel/scripts/fix-prompts.sql`
- `/root/homelab-i18n/ainovel/scripts/fix-prompts2.sql`
- `/root/homelab-i18n/ainovel/pxi/pxi-ainovel`
- `/root/homelab-i18n/ainovel/pxi/README.md`
