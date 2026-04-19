import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DebugDetails } from "../components/atelier/DebugPageShell";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { copyText } from "../lib/copyText";
import { PROMPT_STUDIO_TASKS } from "../lib/promptTaskCatalog";
import { UI_COPY } from "../lib/uiCopy";
import { ApiError, apiJson, sanitizeFilename } from "../services/apiClient";
import type { Character, Outline, Project, ProjectSettings, PromptBlock, PromptPreset, PromptPreview } from "../types";
import { PromptStudioPresetEditorPanel } from "./promptStudio/PromptStudioPresetEditorPanel";
import { PromptStudioPresetListPanel } from "./promptStudio/PromptStudioPresetListPanel";
import { PromptStudioPreviewPanel } from "./promptStudio/PromptStudioPreviewPanel";
import type { BlockDraft, PresetDetails, PromptStudioTask } from "./promptStudio/types";
import { formatTriggers, guessPreviewValues, parseTriggersWithValidation } from "./promptStudio/utils";

const RECOMMENDED_OUTLINE_PRESET_NAME = "기본 개요 생성(v3, 권장)";
const RECOMMENDED_CHAPTER_PRESET_NAME = "기본 · 챕터 생성 v3 (권장)";

export function PromptStudioPage() {
  const { projectId } = useParams();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<null | { message: string; code: string; requestId?: string }>(null);
  const [busy, setBusy] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);

  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PromptPreset | null>(null);
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BlockDraft>>({});

  const [presetDraftName, setPresetDraftName] = useState("");
  const [presetDraftActiveFor, setPresetDraftActiveFor] = useState<string[]>([]);

  const [importBusy, setImportBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [previewTask, setPreviewTask] = useState<string>("chapter_generate");
  const [preview, setPreview] = useState<PromptPreview | null>(null);
  const [renderLog, setRenderLog] = useState<unknown | null>(null);
  const [previewRequestId, setPreviewRequestId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewValues = useMemo(
    () => guessPreviewValues({ project, settings, outline, characters }),
    [characters, outline, project, settings],
  );

  const reloadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [pRes, sRes, oRes, cRes, presetsRes] = await Promise.all([
        apiJson<{ project: Project }>(`/api/projects/${projectId}`),
        apiJson<{ settings: ProjectSettings }>(`/api/projects/${projectId}/settings`),
        apiJson<{ outline: Outline }>(`/api/projects/${projectId}/outline`),
        apiJson<{ characters: Character[] }>(`/api/projects/${projectId}/characters`),
        apiJson<{ presets: PromptPreset[] }>(`/api/projects/${projectId}/prompt_presets`),
      ]);

      setProject(pRes.data.project);
      setSettings(sRes.data.settings);
      setOutline(oRes.data.outline);
      setCharacters(cRes.data.characters);
      setPresets(presetsRes.data.presets ?? []);
      setLoadError(null);

      const nextPresetId =
        selectedPresetId && (presetsRes.data.presets ?? []).some((p) => p.id === selectedPresetId)
          ? selectedPresetId
          : (presetsRes.data.presets?.[0]?.id ?? null);
      setSelectedPresetId(nextPresetId);
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadError({ message: e.message, code: e.code, requestId: e.requestId });
        toast.toastError(`${e.message} (${e.code})`, e.requestId);
      } else {
        setLoadError({ message: "요청이 실패했습니다.", code: "UNKNOWN_ERROR" });
        toast.toastError("요청에 실패했습니다. (알 수 없는 오류)");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedPresetId, toast]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const loadPreset = useCallback(
    async (presetId: string) => {
      setBusy(true);
      try {
        const res = await apiJson<PresetDetails>(`/api/prompt_presets/${presetId}`);
        setSelectedPreset(res.data.preset);
        setBlocks(res.data.blocks ?? []);
        setPresetDraftName(res.data.preset.name ?? "");
        setPresetDraftActiveFor(res.data.preset.active_for ?? []);
        const nextDrafts: Record<string, BlockDraft> = {};
        for (const b of res.data.blocks ?? []) {
          nextDrafts[b.id] = {
            identifier: b.identifier,
            name: b.name,
            role: b.role,
            enabled: b.enabled,
            template: b.template ?? "",
            marker_key: b.marker_key ?? "",
            triggers: formatTriggers(b.triggers ?? []),
          };
        }
        setDrafts(nextDrafts);
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!selectedPresetId) return;
    void loadPreset(selectedPresetId);
  }, [loadPreset, selectedPresetId]);

  const createPreset = useCallback(
    async (rawName: string): Promise<boolean> => {
      if (!projectId) return false;
      const name = rawName.trim();
      if (!name) {
        toast.toastError("미리 설정된 이름을 입력하세요.");
        return false;
      }
      setBusy(true);
      try {
        const res = await apiJson<{ preset: PromptPreset }>(`/api/projects/${projectId}/prompt_presets`, {
          method: "POST",
          body: JSON.stringify({ name, scope: "project", version: 1, active_for: [] }),
        });
        await reloadAll();
        setSelectedPresetId(res.data.preset.id);
        toast.toastSuccess("사전 설정이 생성되었습니다.");
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [projectId, reloadAll, toast],
  );

  const deletePreset = useCallback(async () => {
    if (!selectedPresetId || !selectedPreset) return;
    const ok = await confirm.confirm({
      title: UI_COPY.promptStudio.confirmDeletePresetTitle,
      description: `설정된 기본값을 삭제합니다.“${selectedPreset.name}”해당 작업은 해당 블록을 모두 포함하며, 실행 후에는 되돌릴 수 없습니다.。`,
      confirmText: UI_COPY.promptStudio.confirmDeletePresetConfirm,
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await apiJson<Record<string, never>>(`/api/prompt_presets/${selectedPresetId}`, { method: "DELETE" });
      toast.toastSuccess(UI_COPY.promptStudio.toastPresetDeleted);
      setSelectedPreset(null);
      setBlocks([]);
      setDrafts({});
      setSelectedPresetId(null);
      await reloadAll();
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBusy(false);
    }
  }, [confirm, reloadAll, selectedPreset, selectedPresetId, toast]);

  const enableRecommendedDefaults = useCallback(async () => {
    if (!projectId) return;
    const outline = presets.find((p) => p.name === RECOMMENDED_OUTLINE_PRESET_NAME);
    const chapter = presets.find((p) => p.name === RECOMMENDED_CHAPTER_PRESET_NAME);
    if (!outline || !chapter) {
      toast.toastError(UI_COPY.promptStudio.toastRecommendedNotFound);
      return;
    }

    setBusy(true);
    try {
      const outlineActive = new Set(outline.active_for ?? []);
      outlineActive.add("outline_generate");
      await apiJson<{ preset: PromptPreset }>(`/api/prompt_presets/${outline.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: null, active_for: [...outlineActive] }),
      });

      const chapterActive = new Set(chapter.active_for ?? []);
      chapterActive.add("chapter_generate");
      await apiJson<{ preset: PromptPreset }>(`/api/prompt_presets/${chapter.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: null, active_for: [...chapterActive] }),
      });

      toast.toastSuccess(UI_COPY.promptStudio.toastRecommendedEnabled);
      await reloadAll();
      setSelectedPresetId(chapter.id);
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBusy(false);
    }
  }, [presets, projectId, reloadAll, toast]);

  const savePreset = useCallback(async () => {
    if (!selectedPresetId) return;
    setBusy(true);
    try {
      const res = await apiJson<{ preset: PromptPreset }>(`/api/prompt_presets/${selectedPresetId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: presetDraftName.trim() || null,
          active_for: presetDraftActiveFor,
        }),
      });
      setSelectedPreset(res.data.preset);
      await reloadAll();
      toast.toastSuccess(UI_COPY.promptStudio.toastPresetSaved);
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBusy(false);
    }
  }, [presetDraftActiveFor, presetDraftName, reloadAll, selectedPresetId, toast]);

  const addBlock = useCallback(async () => {
    if (!selectedPresetId) return;
    setBusy(true);
    try {
      const idx = blocks.length + 1;
      const identifier = `block.${Date.now()}.${idx}`;
      const res = await apiJson<{ block: PromptBlock }>(`/api/prompt_presets/${selectedPresetId}/blocks`, {
        method: "POST",
        body: JSON.stringify({
          identifier,
          name: `New block ${idx}`,
          role: "system",
          enabled: true,
          template: "",
          marker_key: null,
          injection_position: "relative",
          injection_depth: null,
          injection_order: blocks.length,
          triggers: [],
          forbid_overrides: false,
          budget: {},
          cache: {},
        }),
      });
      const next = [...blocks, res.data.block];
      setBlocks(next);
      setDrafts((prev) => ({
        ...prev,
        [res.data.block.id]: {
          identifier: res.data.block.identifier,
          name: res.data.block.name,
          role: res.data.block.role,
          enabled: res.data.block.enabled,
          template: res.data.block.template ?? "",
          marker_key: res.data.block.marker_key ?? "",
          triggers: formatTriggers(res.data.block.triggers ?? []),
        },
      }));
      toast.toastSuccess("블록이 추가되었습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBusy(false);
    }
  }, [blocks, selectedPresetId, toast]);

  const saveBlock = useCallback(
    async (blockId: string) => {
      const draft = drafts[blockId];
      if (!draft) return;

      const triggerValidation = parseTriggersWithValidation(draft.triggers);
      if (triggerValidation.invalid.length) {
        toast.toastError(`triggers 유효하지 않음.${triggerValidation.invalid.join(", ")}`);
        return;
      }

      setBusy(true);
      try {
        const res = await apiJson<{ block: PromptBlock }>(`/api/prompt_blocks/${blockId}`, {
          method: "PUT",
          body: JSON.stringify({
            identifier: draft.identifier.trim() || null,
            name: draft.name.trim() || null,
            role: draft.role,
            enabled: draft.enabled,
            template: draft.template,
            marker_key: draft.marker_key.trim() || null,
            triggers: triggerValidation.triggers,
          }),
        });
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? res.data.block : b)));
        setDrafts((prev) => ({
          ...prev,
          [blockId]: {
            identifier: res.data.block.identifier,
            name: res.data.block.name,
            role: res.data.block.role,
            enabled: res.data.block.enabled,
            template: res.data.block.template ?? "",
            marker_key: res.data.block.marker_key ?? "",
            triggers: formatTriggers(res.data.block.triggers ?? []),
          },
        }));
        toast.toastSuccess(UI_COPY.promptStudio.toastBlockSaved);
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setBusy(false);
      }
    },
    [drafts, toast],
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      const b = blocks.find((x) => x.id === blockId);
      const ok = await confirm.confirm({
        title: UI_COPY.promptStudio.confirmDeleteBlockTitle,
        description: b
          ? `알림 상자를 삭제합니다.“${b.name}”。이 작업은 되돌릴 수 없습니다.。`
          : UI_COPY.promptStudio.confirmDeleteBlockDescFallback,
        confirmText: UI_COPY.promptStudio.confirmDeleteBlockConfirm,
        danger: true,
      });
      if (!ok) return;

      setBusy(true);
      try {
        await apiJson<Record<string, never>>(`/api/prompt_blocks/${blockId}`, { method: "DELETE" });
        setBlocks((prev) => prev.filter((x) => x.id !== blockId));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[blockId];
          return next;
        });
        toast.toastSuccess(UI_COPY.promptStudio.toastBlockDeleted);
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setBusy(false);
      }
    },
    [blocks, confirm, toast],
  );

  const onReorder = useCallback(
    async (orderedIds: string[]) => {
      if (!selectedPresetId) return;
      setBusy(true);
      try {
        const res = await apiJson<{ blocks: PromptBlock[] }>(`/api/prompt_presets/${selectedPresetId}/blocks/reorder`, {
          method: "POST",
          body: JSON.stringify({ ordered_block_ids: orderedIds }),
        });
        setBlocks(res.data.blocks ?? []);
        toast.toastSuccess(UI_COPY.promptStudio.toastReordered);
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setBusy(false);
      }
    },
    [selectedPresetId, toast],
  );

  type ImportAllReport = {
    dry_run: boolean;
    created: number;
    updated: number;
    skipped: number;
    conflicts: unknown[];
    actions: unknown[];
  };

  const formatImportAllReport = useCallback((report: ImportAllReport): string => {
    const conflicts = Array.isArray(report.conflicts) ? report.conflicts : [];
    const actions = Array.isArray(report.actions) ? report.actions : [];

    const lines = [
      `dry_run: ${Boolean(report.dry_run)}`,
      `created: ${Number(report.created) || 0}`,
      `updated: ${Number(report.updated) || 0}`,
      `skipped: ${Number(report.skipped) || 0}`,
      `conflicts: ${conflicts.length}`,
      "",
      "conflicts sample:",
      ...(conflicts.slice(0, 10).map((c) => JSON.stringify(c)) || ["(none)"]),
      "",
      "actions sample:",
      ...(actions.slice(0, 20).map((a) => JSON.stringify(a)) || ["(none)"]),
      actions.length > 20 ? `...(${actions.length - 20} more actions)` : "",
    ].filter((v) => typeof v === "string");

    return lines.join("\n").trim();
  }, []);

  const exportPreset = useCallback(async () => {
    if (!selectedPresetId || !selectedPreset) return;
    setBusy(true);
    try {
      const res = await apiJson<{ export: unknown }>(`/api/prompt_presets/${selectedPresetId}/export`);
      const jsonText = JSON.stringify(res.data.export, null, 2);
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = sanitizeFilename(selectedPreset.name) || "prompt_preset";
      a.download = `${safeName}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.toastSuccess("내보내기 완료.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBusy(false);
    }
  }, [selectedPreset, selectedPresetId, toast]);

  const exportAllPresets = useCallback(async () => {
    if (!projectId) return;
    setBulkBusy(true);
    try {
      const res = await apiJson<{ export: unknown }>(`/api/projects/${projectId}/prompt_presets/export_all`);
      const jsonText = JSON.stringify(res.data.export, null, 2);
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = sanitizeFilename(project?.name || "prompt_presets_all") || "prompt_presets_all";
      const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      a.download = `${safeName}_${stamp}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.toastSuccess("전체 데이터가 내보내졌습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setBulkBusy(false);
    }
  }, [project?.name, projectId, toast]);

  const importPreset = useCallback(
    async (file: File) => {
      if (!projectId) return;
      setImportBusy(true);
      try {
        const text = await file.text();
        const obj = JSON.parse(text) as unknown;
        await apiJson<{ preset: PromptPreset }>(`/api/projects/${projectId}/prompt_presets/import`, {
          method: "POST",
          body: JSON.stringify(obj),
        });
        toast.toastSuccess("가져오기 완료.");
        await reloadAll();
      } catch (e) {
        if (e instanceof SyntaxError) {
          toast.toastError("가져오기 실패: 유효하지 않은 JSON 형식입니다.");
          return;
        }
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setImportBusy(false);
      }
    },
    [projectId, reloadAll, toast],
  );

  const importAllPresets = useCallback(
    async (file: File) => {
      if (!projectId) return;
      setBulkBusy(true);
      try {
        const text = await file.text();
        const obj = JSON.parse(text) as Record<string, unknown>;

        const dryRunRes = await apiJson<ImportAllReport>(`/api/projects/${projectId}/prompt_presets/import_all`, {
          method: "POST",
          body: JSON.stringify({ ...obj, dry_run: true }),
        });

        const report = dryRunRes.data;
        const ok = await confirm.confirm({
          title: "전체 PromptPresets 세트를 가져옵니다(실제 실행은 하지 않음).",
          description: formatImportAllReport(report),
          confirmText: "애플리케이션 가져오기.",
          cancelText: "취소하다.",
          danger: Array.isArray(report.conflicts) && report.conflicts.length > 0,
        });
        if (!ok) return;

        const applyRes = await apiJson<ImportAllReport>(`/api/projects/${projectId}/prompt_presets/import_all`, {
          method: "POST",
          body: JSON.stringify({ ...obj, dry_run: false }),
        });

        toast.toastSuccess(
          `전체 세트가 가져와졌습니다. created:${applyRes.data.created} updated:${applyRes.data.updated} skipped:${applyRes.data.skipped}`,
        );
        await reloadAll();
      } catch (e) {
        if (e instanceof SyntaxError) {
          toast.toastError("가져오기 실패: 유효하지 않은 JSON 형식입니다.");
          return;
        }
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setBulkBusy(false);
      }
    },
    [confirm, formatImportAllReport, projectId, reloadAll, toast],
  );

  const runPreview = useCallback(async () => {
    if (!projectId || !selectedPresetId) return;
    setPreviewLoading(true);
    setPreviewRequestId(null);
    try {
      const res = await apiJson<{ preview: PromptPreview; render_log?: unknown }>(
        `/api/projects/${projectId}/prompt_preview`,
        {
          method: "POST",
          body: JSON.stringify({ task: previewTask, preset_id: selectedPresetId, values: previewValues }),
        },
      );
      setPreview(res.data.preview);
      setRenderLog(res.data.render_log ?? null);
      setPreviewRequestId(res.request_id ?? null);
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
      setPreviewRequestId(err.requestId ?? null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewTask, previewValues, projectId, selectedPresetId, toast]);

  const templateErrors = useMemo(() => {
    const blocks = (renderLog as { blocks?: unknown } | null)?.blocks;
    if (!Array.isArray(blocks)) return [];
    return blocks
      .map((b) => b as { identifier?: unknown; render_error?: unknown })
      .filter((b) => typeof b.render_error === "string" && b.render_error.trim())
      .map((b) => ({ identifier: String(b.identifier ?? ""), error: String(b.render_error ?? "") }))
      .filter((b) => b.identifier && b.error);
  }, [renderLog]);

  const tasks: PromptStudioTask[] = PROMPT_STUDIO_TASKS;

  if (!projectId) return <div className="text-subtext">{UI_COPY.promptStudio.missingProjectId}</div>;
  if (loading) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{UI_COPY.promptStudio.loadingA11y}</span>
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-2">
              <div className="skeleton h-6 w-56" />
              <div className="skeleton h-4 w-96" />
            </div>
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[320px_1fr_360px]">
            <div className="grid gap-3">
              <div className="skeleton h-10 w-full" />
              <div className="grid gap-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-4 w-3/5" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-4/5" />
              </div>
            </div>
            <div className="grid gap-3">
              <div className="skeleton h-10 w-48" />
              <div className="skeleton h-96 w-full" />
            </div>
            <div className="grid gap-3">
              <div className="skeleton h-10 w-44" />
              <div className="skeleton h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !project && !settings && !outline) {
    return (
      <div className="grid gap-6">
        <div className="error-card">
          <div className="state-title">불러오기 실패.</div>
          <div className="state-desc">{`${loadError.message} (${loadError.code})`}</div>
          {loadError.requestId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtext">
              <span>request_id: {loadError.requestId}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => void copyText(loadError.requestId!, { title: "요청 ID를 복사합니다." })}
                type="button"
              >
                복사하다. request_id
              </button>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void reloadAll()} type="button">
              다시 시도하세요.
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{UI_COPY.promptStudio.titleBeta}</div>
            <div className="text-xs text-subtext">
              {UI_COPY.promptStudio.previewNote}{" "}
              <Link className="underline" to={`/projects/${projectId}/prompts`}>
                {UI_COPY.promptStudio.backToPrompts}
              </Link>
              {" · "}
              <Link className="underline" to={`/projects/${projectId}/prompt-templates`}>
                {UI_COPY.promptStudio.newbiePromptTemplates}
              </Link>
              {" · "}
              <Link className="underline" to={`/projects/${projectId}/writing`}>
                {UI_COPY.promptStudio.goWriting}
              </Link>
            </div>
          </div>
          <div className="text-xs text-subtext">
            {busy || importBusy || bulkBusy ? UI_COPY.promptStudio.processing : ""}
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <div className="text-sm text-subtext">{UI_COPY.promptStudio.intro}</div>
          <DebugDetails title={UI_COPY.help.title}>
            <div className="grid gap-2 text-xs text-subtext">
              <div>{UI_COPY.promptStudio.recommendedFlow}</div>
              <div>{UI_COPY.promptStudio.quickStart}</div>
              <div className="text-warning">{UI_COPY.promptStudio.advancedHint}</div>
            </div>
          </DebugDetails>
          <DebugDetails title={UI_COPY.promptStudio.conceptTitle}>
            <div className="grid gap-1 text-sm text-subtext">
              <div>
                <span className="font-medium text-ink">사전 설정(사전 설정).Preset）</span>：“힌트 청사진” 세트를 통해.{" "}
                <span className="font-medium text-ink">active_for</span> 어떤 작업에 이 도구를 사용할지 결정합니다(개요)./장(장)/계획./다듬어서.。
              </div>
              <div>
                <span className="font-medium text-ink">힌트 블록.Block）</span>：정렬 가능./시작 및 종료, 지원합니다.
                role、triggers（임무를 수행하면 활성화됩니다. 、token 예산 및 백엔드 통합 렌더링.。
              </div>
              <div>동일한 작업에 대해 여러 개의 기본 설정이 선택된 경우, 시스템은 가장 최근에 업데이트된 설정을 우선적으로 사용합니다. (이전에 가져온 설정은 기본 설정으로 사용됩니다.)。</div>
            </div>
          </DebugDetails>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => void enableRecommendedDefaults()}
            disabled={busy || importBusy}
            type="button"
          >
            {UI_COPY.promptStudio.enableRecommendedPresets}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
        <PromptStudioPresetListPanel
          busy={busy}
          importBusy={importBusy}
          bulkBusy={bulkBusy}
          tasks={tasks}
          presets={presets}
          selectedPresetId={selectedPresetId}
          setSelectedPresetId={setSelectedPresetId}
          createPreset={createPreset}
          exportPreset={exportPreset}
          exportAllPresets={exportAllPresets}
          importPreset={importPreset}
          importAllPresets={importAllPresets}
        />

        <div className="grid gap-6">
          <PromptStudioPresetEditorPanel
            busy={busy}
            selectedPresetId={selectedPresetId}
            tasks={tasks}
            presetDraftName={presetDraftName}
            setPresetDraftName={setPresetDraftName}
            presetDraftActiveFor={presetDraftActiveFor}
            setPresetDraftActiveFor={setPresetDraftActiveFor}
            savePreset={savePreset}
            deletePreset={deletePreset}
            blocks={blocks}
            drafts={drafts}
            setDrafts={setDrafts}
            addBlock={addBlock}
            saveBlock={saveBlock}
            deleteBlock={deleteBlock}
            onReorder={onReorder}
          />

          <PromptStudioPreviewPanel
            busy={busy}
            selectedPresetId={selectedPresetId}
            previewTask={previewTask}
            setPreviewTask={setPreviewTask}
            tasks={tasks}
            previewLoading={previewLoading}
            runPreview={runPreview}
            requestId={previewRequestId}
            preview={preview}
            templateErrors={templateErrors}
            renderLog={renderLog}
          />
        </div>
      </div>
    </div>
  );
}
