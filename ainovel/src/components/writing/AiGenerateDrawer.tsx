import { useCallback, useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { Drawer } from "../ui/Drawer";
import { ProgressBar } from "../ui/ProgressBar";
import { UI_COPY } from "../../lib/uiCopy";
import type { Character, LLMPreset } from "../../types";
import type { GenerateForm } from "./types";
import { ApiError, apiJson } from "../../services/apiClient";

type Props = {
  open: boolean;
  generating: boolean;
  preset: LLMPreset | null;
  projectId?: string;
  activeChapter: boolean;
  dirty: boolean;
  saving?: boolean;
  genForm: GenerateForm;
  setGenForm: Dispatch<SetStateAction<GenerateForm>>;
  characters: Character[];
  streamProgress?: { message: string; progress: number; status: string; charCount?: number } | null;
  onClose: () => void;
  onSave: () => void | Promise<unknown>;
  onSaveAndGenerateNext?: () => void | Promise<unknown>;
  onGenerateAppend: () => void;
  onGenerateReplace: () => void;
  onCancelGenerate?: () => void;
  onOpenPromptInspector: () => void;
  postEditCompareAvailable?: boolean;
  onOpenPostEditCompare?: () => void;
  contentOptimizeCompareAvailable?: boolean;
  onOpenContentOptimizeCompare?: () => void;
};

type WritingStyle = {
  id: string;
  name: string;
  is_preset: boolean;
};

export function AiGenerateDrawer(props: Props) {
  const { onClose, open } = props;
  const streamProviderSupported = !!props.preset && props.preset.provider.startsWith("openai");
  const reliableTransportRequired =
    props.genForm.plan_first || props.genForm.post_edit || props.genForm.content_optimize;
  const autoReliableTransport = !props.genForm.stream && reliableTransportRequired;
  const titleId = useId();
  const advancedPanelId = useId();
  const hasPromptOverride = props.genForm.prompt_override != null;

  const [stylesLoading, setStylesLoading] = useState(false);
  const [presets, setPresets] = useState<WritingStyle[]>([]);
  const [userStyles, setUserStyles] = useState<WritingStyle[]>([]);
  const [projectDefaultStyleId, setProjectDefaultStyleId] = useState<string | null>(null);
  const [stylesError, setStylesError] = useState<ApiError | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const allStyles = useMemo(() => [...presets, ...userStyles], [presets, userStyles]);
  const projectDefaultStyle = useMemo(
    () => allStyles.find((s) => s.id === projectDefaultStyleId) ?? null,
    [allStyles, projectDefaultStyleId],
  );

  const closeDrawer = useCallback(() => {
    setAdvancedOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, open]);

  useEffect(() => {
    if (!open) return;
    if (!props.projectId) return;
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (cancelled) return null;
        setStylesLoading(true);
        setStylesError(null);
        const [presetRes, userRes, defRes] = await Promise.all([
          apiJson<{ styles: WritingStyle[] }>("/api/writing_styles/presets"),
          apiJson<{ styles: WritingStyle[] }>("/api/writing_styles"),
          apiJson<{ default: { style_id?: string | null } }>(`/api/projects/${props.projectId}/writing_style_default`),
        ]);
        return { presetRes, userRes, defRes };
      })
      .then((res) => {
        if (cancelled || !res) return;
        setPresets(res.presetRes.data.styles ?? []);
        setUserStyles(res.userRes.data.styles ?? []);
        setProjectDefaultStyleId(res.defRes.data.default?.style_id ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        setStylesError(err);
      })
      .finally(() => {
        if (cancelled) return;
        setStylesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, props.projectId]);

  return (
    <Drawer
      open={open}
      onClose={closeDrawer}
      side="bottom"
      ariaLabelledBy={titleId}
      panelClassName="h-[85vh] w-full overflow-y-auto rounded-atelier border-t border-border bg-canvas p-6 shadow-sm sm:h-full sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-content text-2xl text-ink" id={titleId}>
            AI 생성.
          </div>
          <div className="mt-1 text-xs text-subtext">
            {props.preset ? `${props.preset.provider} / ${props.preset.model}` : "LLM 구성 정보가 로드되지 않았습니다."}
          </div>
          {hasPromptOverride ? (
            <div className="mt-2 callout-warning">
              활성화되었습니다. Prompt 덮어쓰기: 생성 시 덮어쓰기할 텍스트를 사용합니다(다음에서 설정 가능). Prompt Inspector 기본 설정으로 되돌리기 (기본값으로 복원)。
            </div>
          ) : null}
        </div>
        <button className="btn btn-secondary" aria-label="닫기." onClick={closeDrawer} type="button">
          닫기.
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">기본 생성.</div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-subtext">사용자 명령어.</span>
              <textarea
                className="textarea atelier-content"
                disabled={props.generating}
                name="instruction"
                rows={5}
                value={props.genForm.instruction}
                onChange={(e) => {
                  const value = e.target.value;
                  props.setGenForm((v) => ({ ...v, instruction: value }));
                }}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-subtext">목표 글자 수 (중국어 원문 기준 글자 수)=문자 수</span>
              <input
                className="input"
                disabled={props.generating}
                min={100}
                name="target_word_count"
                type="number"
                value={props.genForm.target_word_count ?? ""}
                onChange={(e) => {
                  const next = e.currentTarget.valueAsNumber;
                  props.setGenForm((v) => ({ ...v, target_word_count: Number.isNaN(next) ? null : next }));
                }}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-subtext">스타일.</span>
              <select
                className="select"
                disabled={props.generating || stylesLoading}
                name="style_id"
                value={props.genForm.style_id ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  props.setGenForm((v) => ({ ...v, style_id: value ? value : null }));
                }}
                aria-label="gen_style_id"
              >
                <option value="">자동 (기본 설정 사용)</option>
                <optgroup label="시스템 기본 설정.">
                  {presets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="제 스타일입니다.">
                  {userStyles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="text-[11px] text-subtext">
                기본 프로젝트 설정:{projectDefaultStyle ? projectDefaultStyle.name : "(설정되지 않음)"}
                {stylesError ? ` | 불러오기 실패.${stylesError.code}` : ""}
              </div>
            </label>
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">기억 주입.</div>

          <div className="mt-3">
            <label className="flex items-center justify-between gap-3 text-sm text-ink">
              <span>{UI_COPY.writing.memoryInjectionToggle}</span>
              <input
                className="checkbox"
                checked={props.genForm.memory_injection_enabled}
                disabled={props.generating}
                name="memory_injection_enabled"
                onChange={(e) => {
                  const checked = e.target.checked;
                  props.setGenForm((v) => ({ ...v, memory_injection_enabled: checked }));
                }}
                type="checkbox"
              />
            </label>
            <div className="mt-1 text-[11px] text-subtext">{UI_COPY.writing.memoryInjectionHint}</div>

            {props.genForm.memory_injection_enabled ? (
              <div className="mt-2 rounded-atelier border border-border bg-surface p-3">
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">검색어 (선택 사항)를 입력하여 과거 기록을 검색할 수 있습니다.</span>
                  <input
                    className="input"
                    disabled={props.generating}
                    aria-label="memory_query_text"
                    value={props.genForm.memory_query_text}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      props.setGenForm((v) => ({ ...v, memory_query_text: value }));
                    }}
                  />
                </label>
                <div className="mt-1 text-[11px] text-subtext">빈칸으로 두면 자동으로 “사용자 지정”이 적용됩니다. + 장(장)별 계획.”。</div>

                <div className="mt-3 grid gap-2">
                  <div className="text-xs text-subtext">주입 모듈.</div>
                  <div className="text-[11px] text-subtext">이번 프롬프트 생성에 영향을 미치며, 변경 사항은 ‘컨텍스트 미리보기’에 즉시 반영됩니다.」。</div>

                  <label className="flex items-center justify-between gap-3 text-sm text-ink">
                    <span>세계 도서(세계 도서).worldbook）</span>
                    <input
                      className="checkbox"
                      checked={props.genForm.memory_modules.worldbook}
                      disabled={props.generating}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        props.setGenForm((v) => ({
                          ...v,
                          memory_modules: { ...v.memory_modules, worldbook: checked },
                        }));
                      }}
                      type="checkbox"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-sm text-ink">
                    <span>테이블 시스템(tables）</span>
                    <input
                      className="checkbox"
                      checked={props.genForm.memory_modules.tables}
                      disabled={props.generating}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        props.setGenForm((v) => ({
                          ...v,
                          memory_modules: { ...v.memory_modules, tables: checked },
                        }));
                      }}
                      type="checkbox"
                    />
                  </label>

                  <details className="rounded-atelier border border-border bg-surface p-2">
                    <summary className="cursor-pointer text-sm text-ink">더 많은 모듈(고급)</summary>
                    <div className="mt-2 grid gap-2">
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>이야기 속 기억 (story_memory）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.story_memory}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, story_memory: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>의미론적 역사(의미 변화사)semantic_history）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.semantic_history}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, semantic_history: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>회수되지 않은 복선.foreshadow_open_loops）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.foreshadow_open_loops}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, foreshadow_open_loops: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>구조화된 기억 (structured）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.structured}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, structured: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>벡터. RAG（vector_rag）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.vector_rag}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, vector_rag: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>관계도.graph）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.graph}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, graph: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-ink">
                        <span>Fractal（fractal）</span>
                        <input
                          className="checkbox"
                          checked={props.genForm.memory_modules.fractal}
                          disabled={props.generating}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            props.setGenForm((v) => ({
                              ...v,
                              memory_modules: { ...v.memory_modules, fractal: checked },
                            }));
                          }}
                          type="checkbox"
                        />
                      </label>
                    </div>
                  </details>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {props.genForm.stream && props.generating ? (
          <div className="panel p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-subtext">
              <span className="truncate">{props.streamProgress?.message ?? "연결 중..."}</span>
              <span className="shrink-0">{props.streamProgress?.progress ?? 0}%</span>
            </div>
            <ProgressBar ariaLabel="장(장)별 내용 생성 진행 상황." value={props.streamProgress?.progress ?? 0} />
            {props.onCancelGenerate ? (
              <div className="flex justify-end">
                <button className="btn btn-secondary" onClick={props.onCancelGenerate} type="button">
                  생성 취소.
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="panel p-3">
          <div className="text-sm font-medium text-ink">맥락.</div>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2">
              <div className="text-xs text-subtext">컨텍스트 주입.</div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.include_world_setting}
                  disabled={props.generating}
                  name="context_include_world_setting"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, include_world_setting: checked } }));
                  }}
                  type="checkbox"
                />
                세계관.
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.include_style_guide}
                  disabled={props.generating}
                  name="context_include_style_guide"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, include_style_guide: checked } }));
                  }}
                  type="checkbox"
                />
                스타일.
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.include_constraints}
                  disabled={props.generating}
                  name="context_include_constraints"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, include_constraints: checked } }));
                  }}
                  type="checkbox"
                />
                제한.
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.include_outline}
                  disabled={props.generating}
                  name="context_include_outline"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, include_outline: checked } }));
                  }}
                  type="checkbox"
                />
                개요.
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.include_smart_context}
                  disabled={props.generating}
                  name="context_include_smart_context"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, include_smart_context: checked } }));
                  }}
                  type="checkbox"
                />
                지능형 상황 인식.
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context.require_sequential}
                  disabled={props.generating}
                  name="context_require_sequential"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, context: { ...v.context, require_sequential: checked } }));
                  }}
                  type="checkbox"
                />
                엄격한 순서.
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-subtext">이전 장 내용 참조.</span>
              <select
                className="select"
                disabled={props.generating}
                name="previous_chapter"
                value={props.genForm.context.previous_chapter}
                onChange={(e) => {
                  const value = e.target.value as GenerateForm["context"]["previous_chapter"];
                  props.setGenForm((v) => ({
                    ...v,
                    context: {
                      ...v.context,
                      previous_chapter: value,
                    },
                  }));
                }}
              >
                <option value="none">주입하지 않다.</option>
                <option value="tail">마무리 (추천)</option>
                <option value="summary">요약.</option>
                <option value="content">본문.</option>
              </select>
              <div className="text-[11px] text-subtext">결론 부분을 강화하여 내용의 연결성을 높이고, 서두 부분의 반복적인 설명을 줄이는 것이 좋습니다.。</div>
            </label>

            <div className="grid gap-2">
              <div className="text-xs text-subtext">캐릭터 삽입 (선택 사항)</div>
              {props.characters.length === 0 ? <div className="text-sm text-subtext">아직 역할이 지정되지 않았습니다.</div> : null}
              <div className="max-h-40 overflow-auto rounded-atelier border border-border bg-surface p-2">
                {props.characters.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
                    <input
                      className="checkbox"
                      checked={props.genForm.context.character_ids.includes(c.id)}
                      disabled={props.generating}
                      name={`character_${c.id}`}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        props.setGenForm((v) => {
                          const next = new Set(v.context.character_ids);
                          if (checked) next.add(c.id);
                          else next.delete(c.id);
                          return { ...v, context: { ...v.context, character_ids: Array.from(next) } };
                        });
                      }}
                      type="checkbox"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-3">
          <button
            className="ui-focus-ring ui-pressable flex w-full items-center justify-between gap-3 rounded-atelier px-2 py-2 text-left hover:bg-canvas"
            aria-controls={advancedPanelId}
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
            type="button"
          >
            <span className="text-sm font-medium text-ink">고급 설정.</span>
            <span aria-hidden="true" className="text-xs text-subtext">
              {advancedOpen ? "접다." : "펼치다."}
            </span>
          </button>

          {!advancedOpen ? (
            <div className="mt-2 text-[11px] text-subtext">기본적으로는 스트리밍 방식의 콘텐츠 생성, 계획 수립, 내용 다듬기 등의 기능이 숨겨진 상태로 설정됩니다.。</div>
          ) : null}

          {autoReliableTransport ? (
            <div className="mt-2 text-xs text-warning">계획은 이미 수립되었습니다./다듬다./본문 최적화 기능이 자동으로 활성화되어 안정적인 연결을 유지하고 요청 시간 초과를 방지합니다.。</div>
          ) : null}

          {props.preset && props.genForm.stream && !streamProviderSupported && !reliableTransportRequired ? (
            <div className="mt-2 text-xs text-warning">스트리밍 방식은 지원하지 않으므로, 생성 과정에서 스트리밍 방식이 아닌 방식으로 자동 전환됩니다.</div>
          ) : null}

          {advancedOpen ? (
            <div className="mt-3 grid gap-2" id={advancedPanelId}>
              <label className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>스트리밍 생성(스트리밍 생성).beta）</span>
                <input
                  className="checkbox"
                  checked={props.genForm.stream}
                  disabled={props.generating}
                  name="stream"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, stream: checked }));
                  }}
                  type="checkbox"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>선생님, 계획을 세우겠습니다.</span>
                <input
                  className="checkbox"
                  checked={props.genForm.plan_first}
                  disabled={props.generating}
                  name="plan_first"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, plan_first: checked }));
                  }}
                  type="checkbox"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>다듬다.</span>
                <input
                  className="checkbox"
                  checked={props.genForm.post_edit}
                  disabled={props.generating}
                  name="post_edit"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({
                      ...v,
                      post_edit: checked,
                      post_edit_sanitize: checked ? v.post_edit_sanitize : false,
                    }));
                  }}
                  type="checkbox"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>냄새 제거./일관성 수정.</span>
                <input
                  className="checkbox"
                  checked={props.genForm.post_edit_sanitize}
                  disabled={props.generating || !props.genForm.post_edit}
                  name="post_edit_sanitize"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, post_edit_sanitize: checked }));
                  }}
                  type="checkbox"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>본문 내용 개선.</span>
                <input
                  className="checkbox"
                  checked={props.genForm.content_optimize}
                  disabled={props.generating}
                  name="content_optimize"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    props.setGenForm((v) => ({ ...v, content_optimize: checked }));
                  }}
                  type="checkbox"
                />
              </label>
              <div className="text-[11px] text-subtext">실패 시에는 원래 내용을 유지하고 실패 원인을 기록합니다.。</div>
            </div>
          ) : (
            <div id={advancedPanelId} hidden />
          )}
        </div>

        <div className="panel p-3 text-xs text-subtext">
          생성하거나 편집한 내용은 자동으로 저장됩니다(저장하는 데 약간의 시간이 걸릴 수 있습니다). 또한 언제든지 “저장” 버튼을 클릭하여 저장할 수도 있습니다. Ctrl/Cmd+S 지금 저장하세요.。
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          className="btn btn-secondary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onOpenPromptInspector}
          type="button"
        >
          사전 점검./검토하다, 조사하다, 심사하다.{hasPromptOverride ? "(현재 적용 중입니다.)" : ""}
        </button>
        {props.postEditCompareAvailable ? (
          <button
            className="btn btn-secondary"
            disabled={props.generating || !props.onOpenPostEditCompare}
            onClick={() => props.onOpenPostEditCompare?.()}
            type="button"
          >
            다듬고 비교하기./후퇴하다. / 후퇴. / (명령형) 후퇴!
          </button>
        ) : null}
        {props.contentOptimizeCompareAvailable ? (
          <button
            className="btn btn-secondary"
            disabled={props.generating || !props.onOpenContentOptimizeCompare}
            onClick={() => props.onOpenContentOptimizeCompare?.()}
            type="button"
          >
            본문 내용 개선 비교 분석./후퇴하다. / 후퇴. / (명령형) 후퇴!
          </button>
        ) : null}
        {hasPromptOverride ? (
          <button
            className="btn btn-secondary"
            disabled={props.generating}
            onClick={() => props.setGenForm((v) => ({ ...v, prompt_override: null }))}
            type="button"
          >
            기본 설정으로 되돌리기.
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onGenerateReplace}
          type="button"
        >
          {props.generating ? "생성 중..." : "생성."}
        </button>
        {props.onSaveAndGenerateNext ? (
          <button
            className="btn btn-primary"
            disabled={props.generating || props.saving || !props.activeChapter}
            onClick={() => void props.onSaveAndGenerateNext?.()}
            type="button"
          >
            {props.saving ? "저장 중..." : "저장 후 계속 진행합니다."}
          </button>
        ) : null}
        <button
          className="btn btn-secondary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onGenerateAppend}
          type="button"
        >
          {props.generating ? "생성 중..." : "추가 생성."}
        </button>
        <button
          className="btn btn-secondary"
          disabled={props.generating || props.saving || !props.activeChapter || !props.dirty}
          onClick={() => void props.onSave()}
          type="button"
        >
          {props.saving ? "저장 중..." : "저장."}
        </button>
      </div>
    </Drawer>
  );
}
