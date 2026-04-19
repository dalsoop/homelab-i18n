import { useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { GenerateForm } from "./types";
import type { LLMPreset } from "../../types";
import { ApiError, apiJson } from "../../services/apiClient";
import { Drawer } from "../ui/Drawer";
import { useToast } from "../ui/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  chapterId?: string;
  draftContentMd?: string;
  preset: LLMPreset | null;
  generating: boolean;
  genForm: GenerateForm;
  setGenForm: Dispatch<SetStateAction<GenerateForm>>;
  onGenerate: (
    mode: "replace" | "append",
    overrides?: { macro_seed?: string | null; prompt_override?: GenerateForm["prompt_override"] },
  ) => Promise<void>;
};

type PrecheckMessage = { role: string; content: string; name?: string | null };

type Precheck = {
  task: string;
  macro_seed: string;
  prompt_system: string;
  prompt_user: string;
  messages: PrecheckMessage[];
  render_log: unknown;
  memory_pack?: unknown;
  memory_injection_config?: unknown;
  memory_retrieval_log_json?: unknown;
  prompt_overridden: boolean;
};

function createMacroSeed(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `seed:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function extractTextMdFromPackSection(pack: unknown, section: string): string {
  if (!pack || typeof pack !== "object") return "";
  const o = pack as Record<string, unknown>;
  const raw = o[section];
  if (!raw || typeof raw !== "object") return "";
  const s = raw as Record<string, unknown>;
  const textMd = s.text_md;
  return typeof textMd === "string" ? textMd : "";
}

export function PromptInspectorDrawer(props: Props) {
  const { open, onClose, preset, chapterId, draftContentMd, genForm, setGenForm, onGenerate } = props;
  const toast = useToast();
  const titleId = useId();
  const loadedOnceRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [precheck, setPrecheck] = useState<Precheck | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId?: string } | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const [overrideSystem, setOverrideSystem] = useState("");
  const [overrideUser, setOverrideUser] = useState("");

  const overrideEnabled = genForm.prompt_override != null;

  const effectiveMacroSeed = useMemo(() => {
    const seed = typeof genForm.macro_seed === "string" ? genForm.macro_seed.trim() : "";
    return seed || null;
  }, [genForm.macro_seed]);

  const currentDraftTail = useMemo(() => {
    if (mode !== "append") return null;
    const md = String(draftContentMd ?? "");
    return md.trimEnd().slice(-1200) || null;
  }, [draftContentMd, mode]);

  const loadPrecheck = useCallback(async () => {
    if (!chapterId) {
      setError({ code: "NO_CHAPTER", message: "선택된 장이 없습니다." });
      return;
    }
    if (!preset) {
      setError({ code: "NO_PRESET", message: "먼저 프롬프트 페이지에서 LLM 설정을 저장해 주세요." });
      return;
    }
    if (genForm.plan_first) {
      setError({ code: "UNSUPPORTED", message: "사전 검사에서 “생성 우선 계획” 기능을 지원하지 않습니다. (plan_first)" });
      return;
    }

    const macroSeed = effectiveMacroSeed ?? createMacroSeed();
    if (!effectiveMacroSeed) {
      setGenForm((v) => ({ ...v, macro_seed: macroSeed }));
    }

    const safeTargetWordCount =
      typeof genForm.target_word_count === "number" && genForm.target_word_count >= 100
        ? genForm.target_word_count
        : null;

    const payload = {
      mode,
      instruction: genForm.instruction,
      target_word_count: safeTargetWordCount,
      plan_first: false,
      post_edit: genForm.post_edit,
      post_edit_sanitize: genForm.post_edit_sanitize,
      content_optimize: genForm.content_optimize,
      macro_seed: macroSeed,
      ...(genForm.prompt_override != null ? { prompt_override: genForm.prompt_override } : {}),
      style_id: genForm.style_id,
      memory_injection_enabled: genForm.memory_injection_enabled,
      memory_query_text: genForm.memory_query_text.trim() ? genForm.memory_query_text : null,
      memory_modules: genForm.memory_modules,
      context: {
        include_world_setting: genForm.context.include_world_setting,
        include_style_guide: genForm.context.include_style_guide,
        include_constraints: genForm.context.include_constraints,
        include_outline: genForm.context.include_outline,
        include_smart_context: genForm.context.include_smart_context,
        require_sequential: genForm.context.require_sequential,
        character_ids: genForm.context.character_ids,
        previous_chapter: genForm.context.previous_chapter === "none" ? null : genForm.context.previous_chapter,
        current_draft_tail: currentDraftTail,
      },
    };

    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ precheck: Precheck }>(`/api/chapters/${chapterId}/generate-precheck`, {
        method: "POST",
        headers: { "X-LLM-Provider": preset.provider },
        body: JSON.stringify(payload),
      });
      setRequestId(res.request_id ?? null);
      setPrecheck(res.data.precheck);
      setOverrideSystem(res.data.precheck.prompt_system ?? "");
      setOverrideUser(res.data.precheck.prompt_user ?? "");
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ code: e.code, message: e.message, requestId: e.requestId });
      } else {
        setError({ code: "UNKNOWN", message: "불러오기 실패." });
      }
      setPrecheck(null);
      setRequestId(null);
    } finally {
      setLoading(false);
    }
  }, [chapterId, currentDraftTail, effectiveMacroSeed, genForm, mode, preset, setGenForm]);

  useEffect(() => {
    if (open) return;
    loadedOnceRef.current = false;
    setError(null);
    setRequestId(null);
    setPrecheck(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void loadPrecheck();
  }, [loadPrecheck, open]);

  const clearOverride = useCallback(() => {
    setGenForm((v) => ({ ...v, prompt_override: null }));
    toast.toastSuccess("기본 프롬프트가 이전 버전으로 되돌려졌습니다.");
  }, [setGenForm, toast]);

  const executeOverride = useCallback(() => {
    if (!preset || !chapterId) return;
    const macroSeed = precheck?.macro_seed || effectiveMacroSeed || createMacroSeed();
    const promptOverride = { system: overrideSystem, user: overrideUser };
    setGenForm((v) => ({ ...v, macro_seed: macroSeed, prompt_override: promptOverride }));
    void onGenerate(mode, { macro_seed: macroSeed, prompt_override: promptOverride });
    onClose();
  }, [
    chapterId,
    effectiveMacroSeed,
    mode,
    onClose,
    onGenerate,
    overrideSystem,
    overrideUser,
    precheck?.macro_seed,
    preset,
    setGenForm,
  ]);

  const packTextBlocks = useMemo(() => {
    const pack = precheck?.memory_pack;
    if (!pack) return [];
    const sections = ["worldbook", "story_memory", "structured", "vector_rag", "graph", "fractal"];
    const out: Array<{ section: string; textMd: string }> = [];
    for (const s of sections) {
      const textMd = extractTextMdFromPackSection(pack, s);
      if (textMd.trim()) out.push({ section: s, textMd });
    }
    return out;
  }, [precheck?.memory_pack]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      ariaLabelledBy={titleId}
      panelClassName="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-canvas p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-content text-2xl text-ink" id={titleId}>
            Prompt Inspector
          </div>
          <div className="mt-1 text-xs text-subtext">
            생성 전 사전 점검 (함수 호출하지 않음). LLM）{requestId ? <span className="ml-2">request_id: {requestId}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overrideEnabled ? (
            <button className="btn btn-secondary" disabled={loading} onClick={clearOverride} type="button">
              기본 설정으로 되돌리기.
            </button>
          ) : null}
          <button
            className="btn btn-secondary"
            disabled={loading || !preset || !chapterId}
            onClick={() => void loadPrecheck()}
            type="button"
          >
            새로 고침을 통해 사전 검사를 다시 시작합니다.
          </button>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            닫기.
          </button>
        </div>
      </div>

      {overrideEnabled ? (
        <div className="mt-3 callout-warning">덮어쓰기 프롬프트가 활성화되었습니다. 이제 입력하신 텍스트를 기준으로 결과물이 생성되며, 필요에 따라 언제든지 이전 설정으로 되돌릴 수 있습니다.。</div>
      ) : null}

      {error ? (
        <div className="mt-3 callout-danger">
          <div className="font-medium">사전 검사 실패.</div>
          <div className="mt-1">
            {error.code}: {error.message}
            {error.requestId ? <span className="ml-2 text-[11px]">request_id: {error.requestId}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <div className="panel p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-ink">사전 점검 매개변수.</div>
            <div className="flex items-center gap-3 text-xs text-subtext">
              <label className="flex items-center gap-2">
                <input
                  className="radio"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  type="radio"
                  name="prompt_inspector_mode"
                />
                대체하다.
              </label>
              <label className="flex items-center gap-2">
                <input
                  className="radio"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                  type="radio"
                  name="prompt_inspector_mode"
                />
                추가.
              </label>
              {precheck?.macro_seed ? <span>macro_seed: {precheck.macro_seed}</span> : null}
              {precheck?.task ? <span>task: {precheck.task}</span> : null}
            </div>
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">결국. Prompt（읽기 전용.</div>
          <div className="mt-2 grid gap-3">
            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                system
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                {precheck?.prompt_system ?? ""}
              </pre>
            </details>
            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">user</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                {precheck?.prompt_user ?? ""}
              </pre>
            </details>
            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                messages
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                {JSON.stringify(precheck?.messages ?? [], null, 2)}
              </pre>
            </details>
            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                render_log
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                {JSON.stringify(precheck?.render_log ?? null, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">[텍스트 삽입]memory_pack）</div>
          <div className="mt-2 grid gap-2">
            {packTextBlocks.length === 0 ? (
              <div className="text-xs text-subtext">
                {genForm.memory_injection_enabled
                  ? "이번에는 표시할 만한 삽입 가능한 텍스트가 생성되지 않았습니다(텍스트가 없거나, 해당 조건을 만족하는 텍스트를 찾지 못했을 가능성이 있습니다)."
                  : "메모리 주입 기능이 활성화되지 않았습니다."}
              </div>
            ) : (
              packTextBlocks.map((it) => (
                <details key={it.section}>
                  <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                    {it.section}
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                    {it.textMd}
                  </pre>
                </details>
              ))
            )}

            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                memory_pack raw
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                {JSON.stringify(precheck?.memory_pack ?? null, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">덮어쓸 텍스트(선택 사항)</div>
          <div className="mt-2 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-subtext">system（포함하다, 포함시키다, 포괄하다, 덮다, 덮어씌우다.</span>
              <textarea
                className="textarea min-h-[140px]"
                aria-label="prompt_override_system"
                disabled={loading || props.generating}
                value={overrideSystem}
                onChange={(e) => setOverrideSystem(e.currentTarget.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-subtext">user（포함하다, 포함시키다, 포괄하다, 덮다, 덮어씌우다.</span>
              <textarea
                className="textarea min-h-[140px]"
                aria-label="prompt_override_user"
                disabled={loading || props.generating}
                value={overrideUser}
                onChange={(e) => setOverrideUser(e.currentTarget.value)}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn btn-primary"
                disabled={loading || props.generating || !preset || !chapterId || !precheck}
                onClick={() => void executeOverride()}
                type="button"
              >
                덮어쓰기 텍스트를 사용하여 실행합니다.
              </button>
            </div>
            <div className="text-[11px] text-subtext">
              덮어쓰기 기능을 사용한 후에는 “생성”이 나타납니다./추가 생성 기능은 기본 설정으로 되돌릴 때까지 기존 텍스트를 덮어쓰는 방식으로 계속 작동합니다.。
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
