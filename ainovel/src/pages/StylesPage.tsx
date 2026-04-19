import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { ApiError, apiJson } from "../services/apiClient";

type WritingStyle = {
  id: string;
  owner_user_id?: string | null;
  name: string;
  description?: string | null;
  prompt_content: string;
  is_preset: boolean;
  created_at?: string;
  updated_at?: string;
};

type ProjectDefaultStyle = {
  project_id: string;
  style_id?: string | null;
  updated_at?: string | null;
};

function resolveStyleLabel(style: WritingStyle): string {
  const name = style.name?.trim() || "(제목 없음)";
  return style.is_preset ? `${name}（사전 설정.` : name;
}

export function StylesPage() {
  const { projectId } = useParams();
  const toast = useToast();
  const confirm = useConfirm();

  const [presets, setPresets] = useState<WritingStyle[]>([]);
  const [userStyles, setUserStyles] = useState<WritingStyle[]>([]);
  const [defaultStyleId, setDefaultStyleId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPromptContent, setDraftPromptContent] = useState("");
  const [saving, setSaving] = useState(false);

  const allStyles = useMemo(() => [...presets, ...userStyles], [presets, userStyles]);
  const defaultStyle = useMemo(
    () => allStyles.find((s) => s.id === defaultStyleId) ?? null,
    [allStyles, defaultStyleId],
  );

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [presetRes, userRes, defaultRes] = await Promise.all([
        apiJson<{ styles: WritingStyle[] }>("/api/writing_styles/presets"),
        apiJson<{ styles: WritingStyle[] }>("/api/writing_styles"),
        apiJson<{ default: ProjectDefaultStyle }>(`/api/projects/${projectId}/writing_style_default`),
      ]);
      setPresets(presetRes.data.styles ?? []);
      setUserStyles(userRes.data.styles ?? []);
      setDefaultStyleId(defaultRes.data.default?.style_id ?? null);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      setError(err);
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setModalMode("create");
    setEditingStyleId(null);
    setDraftName("");
    setDraftDescription("");
    setDraftPromptContent("");
    setModalOpen(true);
  };

  const openEdit = (style: WritingStyle) => {
    setModalMode("edit");
    setEditingStyleId(style.id);
    setDraftName(style.name ?? "");
    setDraftDescription(style.description ?? "");
    setDraftPromptContent(style.prompt_content ?? "");
    setModalOpen(true);
  };

  const saveDraft = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: draftName,
        description: draftDescription || null,
        prompt_content: draftPromptContent,
      };

      if (modalMode === "create") {
        await apiJson<{ style: WritingStyle }>("/api/writing_styles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.toastSuccess("스타일이 설정되었습니다.");
      } else if (editingStyleId) {
        await apiJson<{ style: WritingStyle }>(`/api/writing_styles/${editingStyleId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.toastSuccess("변경 내용이 저장되었습니다.");
      }

      setModalOpen(false);
      await refresh();
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setSaving(false);
    }
  }, [draftDescription, draftName, draftPromptContent, editingStyleId, modalMode, refresh, saving, toast]);

  const deleteStyle = useCallback(
    async (style: WritingStyle) => {
      const ok = await confirm.confirm({
        title: "스타일 삭제하시겠습니까?",
        description: `삭제합니다.「${style.name}」。해당 스타일이 프로젝트의 기본 설정으로 지정되면, 기존 기본 설정이 자동으로 삭제됩니다.。`,
        confirmText: "삭제하다.",
        cancelText: "취소하다.",
        danger: true,
      });
      if (!ok) return;

      try {
        await apiJson(`/api/writing_styles/${style.id}`, { method: "DELETE" });
        toast.toastSuccess("삭제됨.");
        await refresh();
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [confirm, refresh, toast],
  );

  const setDefault = useCallback(
    async (styleId: string | null) => {
      if (!projectId) return;
      try {
        const res = await apiJson<{ default: ProjectDefaultStyle }>(
          `/api/projects/${projectId}/writing_style_default`,
          {
            method: "PUT",
            body: JSON.stringify({ style_id: styleId }),
          },
        );
        setDefaultStyleId(res.data.default?.style_id ?? null);
        toast.toastSuccess(styleId ? "기본 프로젝트 설정으로 지정됨." : "프로젝트 기본 설정이 초기화되었습니다.");
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [projectId, toast],
  );

  return (
    <div className="grid gap-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-content text-2xl text-ink">스타일.</div>
            <div className="mt-1 text-xs text-subtext">
              글쓰기 스타일: 텍스트를 생성할 때 적용할 “글쓰기 지침”을 설정할 수 있습니다. 이 지침은 프로젝트의 기본 설정으로 지정하거나, 필요에 따라 개별적으로 설정할 수 있습니다.「AI 생성 과정에서 각 장별로 임시 선택 기능을 사용합니다.。
            </div>
            <div className="mt-1 text-[11px] text-subtext">
              고급 설정에서 ‘다듬기’ 기능 사용 팁. / “디노이징” 기능을 통해 생성된 결과물을 추가적으로 수정할 수 있으며, 다른 스타일과 함께 적용하여 사용할 수 있습니다.。
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={() => void refresh()} disabled={loading} type="button">
              {loading ? "새로 고침 중..." : "새로 고침."}
            </button>
            <button className="btn btn-primary btn-icon" onClick={openCreate} type="button" aria-label="새로운 스타일.">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-atelier border border-border bg-surface p-3 text-xs text-subtext">
            {error.message} ({error.code}) {error.requestId ? `| request_id: ${error.requestId}` : ""}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div className="rounded-atelier border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-ink">기본 설정.</div>
                <div className="mt-1 text-xs text-subtext" aria-label="project_default_style">
                  {defaultStyle ? resolveStyleLabel(defaultStyle) : "(설정되지 않음)"}
                </div>
                <div className="mt-1 text-[11px] text-subtext">
                  아직 완료되지 않았습니다.「AI “생성” 과정에서 스타일을 직접 선택하면 기본 설정이 자동으로 적용됩니다.。
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => void setDefault(null)}
                  disabled={!defaultStyleId}
                  type="button"
                >
                  기본 설정 해제.
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-atelier border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-ink">시스템 기본 설정.</div>
                <div className="text-xs text-subtext">읽기 전용.</div>
              </div>
              <div className="mt-3 grid gap-2">
                {presets.map((s) => (
                  <div key={s.id} className="rounded-atelier border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm text-ink">{s.name}</div>
                          <Badge tone="neutral">사전 설정.</Badge>
                          {defaultStyleId === s.id ? <Badge tone="accent">기본값.</Badge> : null}
                        </div>
                        {s.description ? <div className="mt-1 text-xs text-subtext">{s.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          className="btn btn-secondary"
                          onClick={() => void setDefault(s.id)}
                          disabled={defaultStyleId === s.id}
                          type="button"
                          aria-label={`기본 설정으로 지정.:${s.name}`}
                        >
                          기본 설정으로 지정.
                        </button>
                      </div>
                    </div>
                    <pre className="mt-3 max-h-40 overflow-auto rounded-atelier border border-border bg-canvas p-2 text-xs text-ink">
                      {s.prompt_content || "(공)"}
                    </pre>
                  </div>
                ))}
                {presets.length === 0 ? <div className="text-xs text-subtext">（어떤 선입견도 없이.</div> : null}
              </div>
            </div>

            <div className="rounded-atelier border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-ink">제 스타일입니다.</div>
                <div className="text-xs text-subtext">수정 가능.</div>
              </div>
              <div className="mt-3 grid gap-2">
                {userStyles.map((s) => (
                  <div key={s.id} className="rounded-atelier border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm text-ink">{s.name}</div>
                          <Badge tone="neutral">나의.</Badge>
                          {defaultStyleId === s.id ? <Badge tone="accent">기본값.</Badge> : null}
                        </div>
                        {s.description ? <div className="mt-1 text-xs text-subtext">{s.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          className="btn btn-secondary"
                          onClick={() => void setDefault(s.id)}
                          disabled={defaultStyleId === s.id}
                          type="button"
                          aria-label={`기본 설정으로 지정.:${s.name}`}
                        >
                          기본 설정으로 지정.
                        </button>
                        <button className="btn btn-secondary" onClick={() => openEdit(s)} type="button">
                          편집하다.
                        </button>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => void deleteStyle(s)}
                          type="button"
                          aria-label={`삭제하다.:${s.name}`}
                          title="삭제하다."
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <pre className="mt-3 max-h-40 overflow-auto rounded-atelier border border-border bg-canvas p-2 text-xs text-ink">
                      {s.prompt_content || "(공)"}
                    </pre>
                  </div>
                ))}
                {userStyles.length === 0 ? <div className="text-xs text-subtext">（사용자 지정 스타일이 아직 설정되지 않았습니다.</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Drawer
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ariaLabel={modalMode === "create" ? "새로운 스타일." : "편집 스타일."}
        panelClassName="h-[92vh] w-full overflow-y-auto border-l border-border bg-canvas p-6 shadow-sm sm:h-full sm:max-w-3xl sm:p-8"
      >
        <div className="panel w-full p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-content text-xl text-ink">{modalMode === "create" ? "새로운 스타일." : "편집 스타일."}</div>
              <div className="mt-1 text-xs text-subtext">스타일 프롬프트 (스타일 지시어)prompt_content）생성 시 우선순위에 따라 주입됩니다.。</div>
            </div>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} type="button">
              닫기.
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <div className="text-xs text-subtext">이름.</div>
              <input
                className="input mt-1"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="예를 들어, 사실주의를 절제하다."
                aria-label="style_name"
              />
            </label>
            <label className="block">
              <div className="text-xs text-subtext">설명 (선택 사항)</div>
              <input
                className="input mt-1"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="자신이 선택할 때 참고할 수 있도록 힌트를 제공합니다."
                aria-label="style_description"
              />
            </label>
            <label className="block">
              <div className="text-xs text-subtext">스타일 프롬프트 (스타일 지시어)prompt_content）</div>
              <textarea
                className="textarea mt-1 min-h-[320px] font-mono text-xs sm:min-h-[520px]"
                value={draftPromptContent}
                onChange={(e) => setDraftPromptContent(e.target.value)}
                placeholder="작성 요령: ..."
                aria-label="style_prompt_content"
              />
              <div className="mt-1 text-xs text-subtext">제안: 스타일 가이드라인을 항목별로 정리하여 제시하면, 내용이 길어지는 것을 방지할 수 있습니다.。</div>
            </label>
            <details className="rounded-atelier border border-border bg-canvas px-3 py-2 text-xs text-subtext">
              <summary className="cursor-pointer select-none">예시(자세히 보려면 클릭하세요).</summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-ink">{`작성 요령:
- 서술 시점: 3인칭 시점.
- 어조: 절제되고 현실적.
- 리듬: 짧은 문장을 주로 사용하고, 느낌표는 가급적 사용하지 않는다.
- “~로서” 또는 “~로서”와 같은 표현은 사용하지 마십시오.AI”이와 유사한 자기 표현 방식.`}</pre>
            </details>

            <div className="flex items-center justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} type="button">
                취소하다.
              </button>
              <button className="btn btn-primary" onClick={() => void saveDraft()} disabled={saving} type="button">
                {saving ? "저장 중..." : "저장."}
              </button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
