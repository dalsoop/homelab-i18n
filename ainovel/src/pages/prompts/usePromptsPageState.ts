import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { WizardNextBar } from "../../components/atelier/WizardNextBar";
import { LlmPresetPanel } from "../../components/prompts/LlmPresetPanel";
import { deriveLlmModuleAccessState } from "../../components/prompts/llmConnectionState";
import type { LlmForm, LlmModelListState, LlmTaskFormDraft } from "../../components/prompts/types";
import { useConfirm } from "../../components/ui/confirm";
import { useToast } from "../../components/ui/toast";
import { useAutoSave } from "../../hooks/useAutoSave";
import { usePersistentOutletIsActive } from "../../hooks/usePersistentOutlet";
import { useSaveHotkey } from "../../hooks/useSaveHotkey";
import { useWizardProgress } from "../../hooks/useWizardProgress";
import { createRequestSeqGuard } from "../../lib/requestSeqGuard";
import { ApiError, apiJson } from "../../services/apiClient";
import { markWizardLlmTestOk } from "../../services/wizard";
import type {
  LLMPreset,
  LLMModelsResponse,
  LLMProfile,
  LLMTaskCatalogItem,
  LLMTaskPreset,
  Project,
  ProjectSettings,
} from "../../types";
import {
  buildPresetPayload,
  DEFAULT_LLM_FORM,
  DEFAULT_VECTOR_RAG_FORM,
  formFromProfile,
  formFromPreset,
  mapVectorFormFromSettings,
  payloadEquals,
  payloadFromPreset,
  parseTimeoutSecondsForTest,
  type LlmCapabilities,
  type VectorEmbeddingDryRunResult,
  type VectorRagForm,
  type VectorRerankDryRunResult,
} from "./models";
import { formatLlmTestApiError } from "./llmApiError";
import type { PromptsVectorRagSectionProps } from "./PromptsVectorRagSection";
import { buildClearTaskApiKeyConfirm, buildDeleteTaskModuleConfirm, PROMPTS_COPY } from "./promptsCopy";

type TaskModuleView = {
  task_key: string;
  label: string;
  group: string;
  description: string;
  llm_profile_id: string | null;
  form: LlmForm;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  modelList: LlmModelListState;
};

const EMPTY_MODEL_LIST_STATE: LlmModelListState = {
  loading: false,
  options: [],
  warning: null,
  error: null,
  requestId: null,
};

type PromptsPageBlockingLoadError = {
  message: string;
  code: string;
  requestId?: string;
};

type PromptsPageState = {
  loading: boolean;
  blockingLoadError: PromptsPageBlockingLoadError | null;
  reloadAll: () => Promise<void>;
  dirty: boolean;
  outletActive: boolean;
  projectId?: string;
  llmPresetPanelProps: ComponentProps<typeof LlmPresetPanel>;
  vectorRagSectionProps: PromptsVectorRagSectionProps;
  goToPromptStudio: () => void;
  wizardBarProps: ComponentProps<typeof WizardNextBar>;
};

export function usePromptsPageState(): PromptsPageState {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const outletActive = usePersistentOutletIsActive();
  const wizard = useWizardProgress(projectId);
  const refreshWizard = wizard.refresh;
  const bumpWizardLocal = wizard.bumpLocal;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<null | { message: string; code: string; requestId?: string }>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [testing, setTesting] = useState(false);
  const savingPresetRef = useRef(false);
  const queuedPresetSaveRef = useRef<null | { silent: boolean; snapshot?: LlmForm }>(null);
  const wizardRefreshTimerRef = useRef<number | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [baselinePreset, setBaselinePreset] = useState<LLMPreset | null>(null);
  const [capabilities, setCapabilities] = useState<LlmCapabilities | null>(null);
  const capsGuardRef = useRef(createRequestSeqGuard());

  const [apiKey, setApiKey] = useState("");
  const [baselineSettings, setBaselineSettings] = useState<ProjectSettings | null>(null);
  const [vectorForm, setVectorForm] = useState<VectorRagForm>(DEFAULT_VECTOR_RAG_FORM);
  const [vectorRerankTopKDraft, setVectorRerankTopKDraft] = useState(
    String(DEFAULT_VECTOR_RAG_FORM.vector_rerank_top_k),
  );
  const [vectorRerankTimeoutDraft, setVectorRerankTimeoutDraft] = useState("");
  const [vectorRerankHybridAlphaDraft, setVectorRerankHybridAlphaDraft] = useState("");
  const [vectorApiKeyDraft, setVectorApiKeyDraft] = useState("");
  const [vectorApiKeyClearRequested, setVectorApiKeyClearRequested] = useState(false);
  const [rerankApiKeyDraft, setRerankApiKeyDraft] = useState("");
  const [rerankApiKeyClearRequested, setRerankApiKeyClearRequested] = useState(false);
  const [savingVector, setSavingVector] = useState(false);
  const savingVectorRef = useRef(false);
  const [embeddingDryRunLoading, setEmbeddingDryRunLoading] = useState(false);
  const [embeddingDryRun, setEmbeddingDryRun] = useState<null | {
    requestId: string;
    result: VectorEmbeddingDryRunResult;
  }>(null);
  const [embeddingDryRunError, setEmbeddingDryRunError] = useState<null | {
    message: string;
    code: string;
    requestId?: string;
  }>(null);
  const [rerankDryRunLoading, setRerankDryRunLoading] = useState(false);
  const [rerankDryRun, setRerankDryRun] = useState<null | { requestId: string; result: VectorRerankDryRunResult }>(
    null,
  );
  const [rerankDryRunError, setRerankDryRunError] = useState<null | {
    message: string;
    code: string;
    requestId?: string;
  }>(null);

  const [llmForm, setLlmForm] = useState<LlmForm>({ ...DEFAULT_LLM_FORM });
  const [mainModelList, setMainModelList] = useState<LlmModelListState>({ ...EMPTY_MODEL_LIST_STATE });

  const [taskCatalog, setTaskCatalog] = useState<LLMTaskCatalogItem[]>([]);
  const [taskBaseline, setTaskBaseline] = useState<Record<string, LLMTaskPreset>>({});
  const [taskDrafts, setTaskDrafts] = useState<Record<string, LlmTaskFormDraft>>({});
  const [taskModelLists, setTaskModelLists] = useState<Record<string, LlmModelListState>>({});
  const [taskSaving, setTaskSaving] = useState<Record<string, boolean>>({});
  const [taskDeleting, setTaskDeleting] = useState<Record<string, boolean>>({});
  const [taskTesting, setTaskTesting] = useState<Record<string, boolean>>({});
  const [taskProfileBusy, setTaskProfileBusy] = useState<Record<string, boolean>>({});
  const [taskApiKeyDrafts, setTaskApiKeyDrafts] = useState<Record<string, string>>({});
  const [selectedAddTaskKey, setSelectedAddTaskKey] = useState("");

  const reloadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [presetRes, pRes, profilesRes, settingsRes, taskRes] = await Promise.all([
        apiJson<{ llm_preset: LLMPreset }>(`/api/projects/${projectId}/llm_preset`),
        apiJson<{ project: Project }>(`/api/projects/${projectId}`),
        apiJson<{ profiles: LLMProfile[] }>(`/api/llm_profiles`),
        apiJson<{ settings: ProjectSettings }>(`/api/projects/${projectId}/settings`),
        apiJson<{ catalog: LLMTaskCatalogItem[]; task_presets: LLMTaskPreset[] }>(
          `/api/projects/${projectId}/llm_task_presets`,
        ),
      ]);

      setProject(pRes.data.project);
      setProfiles(profilesRes.data.profiles ?? []);
      setProfileName("");

      setBaselinePreset(presetRes.data.llm_preset);
      setCapabilities({
        provider: presetRes.data.llm_preset.provider,
        model: presetRes.data.llm_preset.model,
        max_tokens_limit: presetRes.data.llm_preset.max_tokens_limit ?? null,
        max_tokens_recommended: presetRes.data.llm_preset.max_tokens_recommended ?? null,
        context_window_limit: presetRes.data.llm_preset.context_window_limit ?? null,
      });
      setLlmForm(formFromPreset(presetRes.data.llm_preset));

      const nextTaskCatalog = taskRes.data.catalog ?? [];
      const nextTaskBaseline: Record<string, LLMTaskPreset> = {};
      const nextTaskDrafts: Record<string, LlmTaskFormDraft> = {};
      for (const row of taskRes.data.task_presets ?? []) {
        const key = String(row.task_key || "").trim();
        if (!key) continue;
        nextTaskBaseline[key] = row;
        nextTaskDrafts[key] = {
          task_key: key,
          llm_profile_id: row.llm_profile_id ?? null,
          form: formFromPreset(row),
          isNew: false,
        };
      }
      setTaskCatalog(nextTaskCatalog);
      setTaskBaseline(nextTaskBaseline);
      setTaskDrafts(nextTaskDrafts);
      setTaskModelLists({});
      setTaskSaving({});
      setTaskDeleting({});
      setTaskTesting({});
      setTaskProfileBusy({});
      setTaskApiKeyDrafts({});
      const firstAddable = nextTaskCatalog.find((item) => !nextTaskDrafts[item.key])?.key ?? "";
      setSelectedAddTaskKey(firstAddable);

      const settings = settingsRes.data.settings;
      const mappedVector = mapVectorFormFromSettings(settings);
      setBaselineSettings(settings);
      setVectorForm(mappedVector.vectorForm);
      setVectorRerankTopKDraft(mappedVector.vectorRerankTopKDraft);
      setVectorRerankTimeoutDraft(mappedVector.vectorRerankTimeoutDraft);
      setVectorRerankHybridAlphaDraft(mappedVector.vectorRerankHybridAlphaDraft);
      setVectorApiKeyDraft("");
      setVectorApiKeyClearRequested(false);
      setRerankApiKeyDraft("");
      setRerankApiKeyClearRequested(false);

      setApiKey("");
      setMainModelList({ ...EMPTY_MODEL_LIST_STATE });
      setLoadError(null);
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
  }, [projectId, toast]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    return () => {
      if (wizardRefreshTimerRef.current !== null) window.clearTimeout(wizardRefreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const guard = capsGuardRef.current;
    return () => {
      guard.invalidate();
    };
  }, []);

  useEffect(() => {
    const provider = llmForm.provider;
    const model = llmForm.model.trim();
    const guard = capsGuardRef.current;
    if (!model) {
      guard.invalidate();
      setCapabilities(null);
      return;
    }
    const seq = guard.next();
    void (async () => {
      try {
        const res = await apiJson<{ capabilities: LlmCapabilities }>(
          `/api/llm_capabilities?provider=${provider}&model=${encodeURIComponent(model)}`,
        );
        if (!guard.isLatest(seq)) return;
        setCapabilities(res.data.capabilities);
      } catch {
        if (!guard.isLatest(seq)) return;
        setCapabilities(null);
      }
    })();
  }, [llmForm.model, llmForm.provider]);

  useEffect(() => {
    setApiKey("");
  }, [llmForm.provider, project?.llm_profile_id]);

  const currentMainPayload = useMemo(() => buildPresetPayload(llmForm), [llmForm]);
  const baselineMainPayload = useMemo(
    () => (baselinePreset ? payloadFromPreset(baselinePreset) : null),
    [baselinePreset],
  );
  const presetDirty = useMemo(() => {
    if (!baselineMainPayload) return false;
    if (!currentMainPayload.ok) return true;
    return !payloadEquals(currentMainPayload.payload, baselineMainPayload);
  }, [baselineMainPayload, currentMainPayload]);

  const selectedProfileId = project?.llm_profile_id ?? null;
  const selectedProfile = selectedProfileId ? (profiles.find((p) => p.id === selectedProfileId) ?? null) : null;
  const upsertProfile = useCallback((profile: LLMProfile) => {
    setProfiles((prev) => [profile, ...prev.filter((item) => item.id !== profile.id)]);
  }, []);

  const taskCatalogByKey = useMemo(() => {
    const map = new Map<string, LLMTaskCatalogItem>();
    for (const item of taskCatalog) map.set(item.key, item);
    return map;
  }, [taskCatalog]);

  const taskModules = useMemo<TaskModuleView[]>(() => {
    return Object.values(taskDrafts)
      .map((draft) => {
        const baseline = taskBaseline[draft.task_key] ?? null;
        const baselinePayload = baseline ? payloadFromPreset(baseline) : null;
        const payload = buildPresetPayload(draft.form);
        const payloadDirty =
          baselinePayload === null || !payload.ok ? true : !payloadEquals(payload.payload, baselinePayload);
        const bindingDirty = (draft.llm_profile_id ?? null) !== (baseline?.llm_profile_id ?? null);
        const item = taskCatalogByKey.get(draft.task_key);
        return {
          task_key: draft.task_key,
          label: item?.label ?? draft.task_key,
          group: item?.group ?? "custom",
          description: item?.description ?? "태스크 레벨 모델의 적용 범위.",
          llm_profile_id: draft.llm_profile_id,
          form: draft.form,
          dirty: draft.isNew || payloadDirty || bindingDirty,
          saving: Boolean(taskSaving[draft.task_key]),
          deleting: Boolean(taskDeleting[draft.task_key]),
          modelList: taskModelLists[draft.task_key] ?? { ...EMPTY_MODEL_LIST_STATE },
        };
      })
      .sort((a, b) => a.group.localeCompare(b.group, "zh-Hans-CN") || a.label.localeCompare(b.label, "zh-Hans-CN"));
  }, [taskBaseline, taskCatalogByKey, taskDeleting, taskDrafts, taskModelLists, taskSaving]);

  const taskDirty = useMemo(() => taskModules.some((item) => item.dirty), [taskModules]);
  const addableTasks = useMemo(() => taskCatalog.filter((item) => !taskDrafts[item.key]), [taskCatalog, taskDrafts]);

  const dirty = presetDirty || taskDirty;
  const mainAccessState = useMemo(
    () =>
      deriveLlmModuleAccessState({
        scope: "main",
        moduleProvider: llmForm.provider,
        selectedProfile,
      }),
    [llmForm.provider, selectedProfile],
  );
  const llmCtaBlockedReason = mainAccessState.actionReason;

  useEffect(() => {
    if (!addableTasks.length) {
      if (selectedAddTaskKey) setSelectedAddTaskKey("");
      return;
    }
    if (selectedAddTaskKey && addableTasks.some((item) => item.key === selectedAddTaskKey)) return;
    setSelectedAddTaskKey(addableTasks[0].key);
  }, [addableTasks, selectedAddTaskKey]);

  const saveAll = useCallback(
    async (opts?: { silent?: boolean; snapshot?: LlmForm }): Promise<boolean> => {
      if (!projectId) return false;
      const silent = Boolean(opts?.silent);
      const snapshot = opts?.snapshot ?? llmForm;
      if (!presetDirty && !opts?.snapshot) return true;
      if (savingPresetRef.current) {
        queuedPresetSaveRef.current = { silent, snapshot };
        return false;
      }

      const payload = buildPresetPayload(snapshot);
      if (!payload.ok) {
        if (!silent) toast.toastError(payload.message);
        return false;
      }

      const scheduleWizardRefresh = () => {
        if (wizardRefreshTimerRef.current !== null) window.clearTimeout(wizardRefreshTimerRef.current);
        wizardRefreshTimerRef.current = window.setTimeout(() => void refreshWizard(), 1200);
      };

      savingPresetRef.current = true;
      setSavingPreset(true);
      try {
        if (selectedProfileId) {
          const currentProvider = selectedProfile?.provider ?? null;
          const currentModel = selectedProfile?.model ?? null;
          const currentBaseUrl = (selectedProfile?.base_url ?? "").trim();
          const needsProfileSync =
            currentProvider !== payload.payload.provider ||
            currentModel !== payload.payload.model ||
            currentBaseUrl !== (payload.payload.base_url ?? "");
          if (needsProfileSync) {
            const res = await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${selectedProfileId}`, {
              method: "PUT",
              body: JSON.stringify({
                provider: payload.payload.provider,
                base_url: payload.payload.base_url,
                model: payload.payload.model,
              }),
            });
            setProfiles((prev) => prev.map((p) => (p.id === res.data.profile.id ? res.data.profile : p)));
          }
        }

        if (presetDirty) {
          const res = await apiJson<{ llm_preset: LLMPreset }>(`/api/projects/${projectId}/llm_preset`, {
            method: "PUT",
            body: JSON.stringify(payload.payload),
          });
          setBaselinePreset(res.data.llm_preset);

          setLlmForm((current) => {
            if (current.provider !== snapshot.provider) return current;
            if (current.base_url !== snapshot.base_url) return current;
            if (current.model !== snapshot.model) return current;
            if (current.temperature !== snapshot.temperature) return current;
            if (current.top_p !== snapshot.top_p) return current;
            if (current.max_tokens !== snapshot.max_tokens) return current;
            if (current.presence_penalty !== snapshot.presence_penalty) return current;
            if (current.frequency_penalty !== snapshot.frequency_penalty) return current;
            if (current.top_k !== snapshot.top_k) return current;
            if (current.stop !== snapshot.stop) return current;
            if (current.timeout_seconds !== snapshot.timeout_seconds) return current;
            if (current.reasoning_effort !== snapshot.reasoning_effort) return current;
            if (current.text_verbosity !== snapshot.text_verbosity) return current;
            if (current.anthropic_thinking_enabled !== snapshot.anthropic_thinking_enabled) return current;
            if (current.anthropic_thinking_budget_tokens !== snapshot.anthropic_thinking_budget_tokens) return current;
            if (current.gemini_thinking_budget !== snapshot.gemini_thinking_budget) return current;
            if (current.gemini_include_thoughts !== snapshot.gemini_include_thoughts) return current;
            if (current.extra !== snapshot.extra) return current;
            return formFromPreset(res.data.llm_preset);
          });
        }

        bumpWizardLocal();
        if (silent) scheduleWizardRefresh();
        else {
          toast.toastSuccess("저장됨.");
          await refreshWizard();
        }
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setSavingPreset(false);
        savingPresetRef.current = false;
        if (queuedPresetSaveRef.current) {
          const queued = queuedPresetSaveRef.current;
          queuedPresetSaveRef.current = null;
          void saveAll({ silent: queued.silent, snapshot: queued.snapshot });
        }
      }
    },
    [bumpWizardLocal, llmForm, presetDirty, projectId, refreshWizard, selectedProfile, selectedProfileId, toast],
  );

  const updateTaskForm = useCallback((taskKey: string, updater: (prev: LlmForm) => LlmForm) => {
    setTaskDrafts((prev) => {
      const current = prev[taskKey];
      if (!current) return prev;
      return {
        ...prev,
        [taskKey]: {
          ...current,
          form: updater(current.form),
        },
      };
    });
  }, []);

  const updateTaskProfile = useCallback(
    (taskKey: string, profileId: string | null) => {
      const targetProfile = profileId ? (profiles.find((item) => item.id === profileId) ?? null) : null;
      const nextForm = targetProfile ? formFromProfile(targetProfile) : { ...llmForm };
      setTaskDrafts((prev) => {
        const current = prev[taskKey];
        if (!current) return prev;
        return {
          ...prev,
          [taskKey]: {
            ...current,
            llm_profile_id: profileId,
            form: nextForm,
          },
        };
      });
      setTaskApiKeyDrafts((prev) => ({ ...prev, [taskKey]: "" }));
    },
    [llmForm, profiles],
  );

  const updateTaskApiKeyDraft = useCallback((taskKey: string, value: string) => {
    setTaskApiKeyDrafts((prev) => ({ ...prev, [taskKey]: value }));
  }, []);

  const addTaskModule = useCallback(() => {
    const taskKey = selectedAddTaskKey.trim();
    if (!taskKey) return;
    setTaskDrafts((prev) => {
      if (prev[taskKey]) return prev;
      return {
        ...prev,
        [taskKey]: {
          task_key: taskKey,
          llm_profile_id: null,
          form: { ...llmForm },
          isNew: true,
        },
      };
    });
    setTaskModelLists((prev) => ({ ...prev, [taskKey]: { ...EMPTY_MODEL_LIST_STATE } }));
    setTaskApiKeyDrafts((prev) => ({ ...prev, [taskKey]: "" }));
  }, [llmForm, selectedAddTaskKey]);

  const saveTaskModule = useCallback(
    async (taskKey: string, opts?: { silent?: boolean }): Promise<boolean> => {
      if (!projectId) return false;
      const draft = taskDrafts[taskKey];
      if (!draft) return false;
      if (taskProfileBusy[taskKey]) {
        if (!opts?.silent) toast.toastError("현재 API 키를 업데이트하는 중입니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      const payload = buildPresetPayload(draft.form);
      if (!payload.ok) {
        if (!opts?.silent) toast.toastError(payload.message);
        return false;
      }
      if (draft.llm_profile_id) {
        const boundProfile = profiles.find((item) => item.id === draft.llm_profile_id) ?? null;
        if (!boundProfile) {
          if (!opts?.silent) toast.toastError("할당된 작업 모듈의 구성 파일이 존재하지 않습니다. 다시 선택해 주세요.");
          return false;
        }
        if (boundProfile.provider !== payload.payload.provider) {
          if (!opts?.silent) toast.toastError("선택한 API 구성 라이브러리 제공업체와 작업 모듈 제공업체가 일치해야 합니다.");
          return false;
        }
      }

      setTaskSaving((prev) => ({ ...prev, [taskKey]: true }));
      try {
        const res = await apiJson<{ task_preset: LLMTaskPreset }>(
          `/api/projects/${projectId}/llm_task_presets/${encodeURIComponent(taskKey)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              ...payload.payload,
              llm_profile_id: draft.llm_profile_id,
            }),
          },
        );
        const row = res.data.task_preset;
        setTaskBaseline((prev) => ({ ...prev, [taskKey]: row }));
        setTaskDrafts((prev) => {
          const current = prev[taskKey];
          if (!current) return prev;
          return {
            ...prev,
            [taskKey]: {
              ...current,
              llm_profile_id: row.llm_profile_id ?? null,
              form: formFromPreset(row),
              isNew: false,
            },
          };
        });
        if (!opts?.silent) toast.toastSuccess("작업 모듈이 저장되었습니다.", res.request_id);
        return true;
      } catch (e) {
        const err = e as ApiError;
        if (!opts?.silent) toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setTaskSaving((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [profiles, projectId, taskDrafts, taskProfileBusy, toast],
  );

  const deleteTaskModule = useCallback(
    async (taskKey: string): Promise<boolean> => {
      if (!projectId) return false;
      const draft = taskDrafts[taskKey];
      if (!draft) return false;
      const yes = await confirm.confirm({
        ...buildDeleteTaskModuleConfirm(taskCatalogByKey.get(taskKey)?.label ?? taskKey),
        danger: true,
      });
      if (!yes) return false;

      if (draft.isNew && !taskBaseline[taskKey]) {
        setTaskDrafts((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskModelLists((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskTesting((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskProfileBusy((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskApiKeyDrafts((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        toast.toastSuccess("저장되지 않은 모듈이 삭제되었습니다.");
        return true;
      }

      setTaskDeleting((prev) => ({ ...prev, [taskKey]: true }));
      try {
        await apiJson<Record<string, never>>(
          `/api/projects/${projectId}/llm_task_presets/${encodeURIComponent(taskKey)}`,
          {
            method: "DELETE",
          },
        );
        setTaskBaseline((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskDrafts((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskModelLists((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskTesting((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskProfileBusy((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        setTaskApiKeyDrafts((prev) => {
          const next = { ...prev };
          delete next[taskKey];
          return next;
        });
        toast.toastSuccess("작업 모듈이 삭제되었습니다.");
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setTaskDeleting((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [confirm, projectId, taskBaseline, taskCatalogByKey, taskDrafts, toast],
  );

  const loadModels = useCallback(
    async (opts: { scope: "main" | "task"; taskKey?: string; form: LlmForm; profileId: string | null }) => {
      if (!projectId) return;
      const setLoading = (loading: boolean) => {
        if (opts.scope === "main") {
          setMainModelList((prev) => ({ ...prev, loading }));
          return;
        }
        const key = opts.taskKey ?? "";
        setTaskModelLists((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] ?? { ...EMPTY_MODEL_LIST_STATE }),
            loading,
          },
        }));
      };
      const setResult = (state: LlmModelListState) => {
        if (opts.scope === "main") {
          setMainModelList(state);
          return;
        }
        const key = opts.taskKey ?? "";
        setTaskModelLists((prev) => ({ ...prev, [key]: state }));
      };

      const params = new URLSearchParams();
      params.set("provider", opts.form.provider);
      if (opts.form.base_url.trim()) params.set("base_url", opts.form.base_url.trim());
      if (opts.profileId) params.set("profile_id", opts.profileId);
      else params.set("project_id", projectId);

      setLoading(true);
      try {
        const res = await apiJson<LLMModelsResponse>(`/api/llm_models?${params.toString()}`);
        const options = (res.data.models ?? [])
          .map((item) => ({
            id: String(item.id || "").trim(),
            display_name: String(item.display_name || item.id || "").trim(),
          }))
          .filter((item) => item.id);
        setResult({
          loading: false,
          options,
          warning: res.data.warning?.message ?? null,
          error: null,
          requestId: res.request_id,
        });
      } catch (e) {
        const err = e as ApiError;
        setResult({
          loading: false,
          options: [],
          warning: null,
          error: `${err.message} (${err.code})`,
          requestId: err.requestId ?? null,
        });
      }
    },
    [projectId],
  );

  const reloadMainModels = useCallback(() => {
    if (mainAccessState.actionReason) {
      toast.toastError(mainAccessState.actionReason);
      return;
    }
    void loadModels({
      scope: "main",
      form: llmForm,
      profileId: selectedProfileId,
    });
  }, [llmForm, loadModels, mainAccessState.actionReason, selectedProfileId, toast]);

  const reloadTaskModels = useCallback(
    (taskKey: string) => {
      const draft = taskDrafts[taskKey];
      if (!draft) return;
      const boundProfileId = (draft.llm_profile_id ?? "").trim() || null;
      const boundProfile = boundProfileId ? (profiles.find((item) => item.id === boundProfileId) ?? null) : null;
      const taskAccessState = deriveLlmModuleAccessState({
        scope: "task",
        moduleProvider: draft.form.provider,
        selectedProfile,
        boundProfile,
      });
      if (taskAccessState.actionReason) {
        toast.toastError(taskAccessState.actionReason);
        return;
      }
      void loadModels({
        scope: "task",
        taskKey,
        form: draft.form,
        profileId: draft.llm_profile_id,
      });
    },
    [loadModels, profiles, selectedProfile, taskDrafts, toast],
  );

  const saveAllDirtyModules = useCallback(async (): Promise<boolean> => {
    let ok = true;
    let savedAny = false;
    if (presetDirty) {
      savedAny = true;
      ok = (await saveAll({ silent: true })) && ok;
    }
    for (const item of taskModules) {
      if (!item.dirty) continue;
      savedAny = true;
      ok = (await saveTaskModule(item.task_key, { silent: true })) && ok;
    }
    if (savedAny && !ok) {
      toast.toastError("저장되지 않은 모듈이 존재합니다. 먼저 매개변수와 설정이 올바르게 연결되었는지 확인해 주세요.");
    }
    if (savedAny && ok) {
      toast.toastSuccess("모든 모듈이 저장되었습니다.");
      await refreshWizard();
    }
    return ok;
  }, [presetDirty, refreshWizard, saveAll, saveTaskModule, taskModules, toast]);

  useSaveHotkey(() => void saveAllDirtyModules(), dirty);

  useAutoSave({
    enabled: Boolean(projectId),
    dirty: presetDirty,
    delayMs: 1200,
    getSnapshot: () => ({ ...llmForm }),
    onSave: async (snapshot) => {
      await saveAll({ silent: true, snapshot });
    },
    deps: [
      llmForm.provider,
      llmForm.base_url,
      llmForm.model,
      llmForm.temperature,
      llmForm.top_p,
      llmForm.max_tokens,
      llmForm.presence_penalty,
      llmForm.frequency_penalty,
      llmForm.top_k,
      llmForm.stop,
      llmForm.timeout_seconds,
      llmForm.reasoning_effort,
      llmForm.text_verbosity,
      llmForm.anthropic_thinking_enabled ? "1" : "0",
      llmForm.anthropic_thinking_budget_tokens,
      llmForm.gemini_thinking_budget,
      llmForm.gemini_include_thoughts ? "1" : "0",
      llmForm.extra,
      projectId ?? "",
    ],
  });

  const vectorApiKeyDirty = vectorApiKeyClearRequested || vectorApiKeyDraft.trim().length > 0;
  const rerankApiKeyDirty = rerankApiKeyClearRequested || rerankApiKeyDraft.trim().length > 0;
  const vectorRagDirty = useMemo(() => {
    if (!baselineSettings) return false;
    return (
      vectorForm.vector_rerank_enabled !== baselineSettings.vector_rerank_effective_enabled ||
      vectorForm.vector_rerank_method.trim() !== baselineSettings.vector_rerank_effective_method ||
      Math.max(1, Math.min(1000, Math.floor(vectorForm.vector_rerank_top_k))) !==
        baselineSettings.vector_rerank_effective_top_k ||
      vectorForm.vector_rerank_provider !== baselineSettings.vector_rerank_provider ||
      vectorForm.vector_rerank_base_url !== baselineSettings.vector_rerank_base_url ||
      vectorForm.vector_rerank_model !== baselineSettings.vector_rerank_model ||
      (vectorForm.vector_rerank_timeout_seconds ?? null) !== (baselineSettings.vector_rerank_timeout_seconds ?? null) ||
      (vectorForm.vector_rerank_hybrid_alpha ?? null) !== (baselineSettings.vector_rerank_hybrid_alpha ?? null) ||
      vectorForm.vector_embedding_provider !== baselineSettings.vector_embedding_provider ||
      vectorForm.vector_embedding_base_url !== baselineSettings.vector_embedding_base_url ||
      vectorForm.vector_embedding_model !== baselineSettings.vector_embedding_model ||
      vectorForm.vector_embedding_azure_deployment !== baselineSettings.vector_embedding_azure_deployment ||
      vectorForm.vector_embedding_azure_api_version !== baselineSettings.vector_embedding_azure_api_version ||
      vectorForm.vector_embedding_sentence_transformers_model !==
        baselineSettings.vector_embedding_sentence_transformers_model
    );
  }, [baselineSettings, vectorForm]);

  const saveVectorRagConfig = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    if (!baselineSettings) return false;
    if (!vectorRagDirty && !vectorApiKeyDirty && !rerankApiKeyDirty) return true;
    if (savingVectorRef.current) return false;

    const rerankMethod = vectorForm.vector_rerank_method.trim() || "auto";
    const rawTopK = vectorRerankTopKDraft.trim();
    const parsedTopK = Math.floor(Number(rawTopK || String(vectorForm.vector_rerank_top_k)));
    if (!Number.isFinite(parsedTopK) || parsedTopK < 1 || parsedTopK > 1000) {
      toast.toastError("rerank 상위 k개의 결과를 재정렬할 때, k 값은 1에서 1000 사이의 정수여야 합니다.");
      return false;
    }

    const timeoutRaw = vectorRerankTimeoutDraft.trim();
    const parsedTimeoutSeconds = timeoutRaw ? Math.floor(Number(timeoutRaw)) : null;
    if (
      parsedTimeoutSeconds !== null &&
      (!Number.isFinite(parsedTimeoutSeconds) || parsedTimeoutSeconds < 1 || parsedTimeoutSeconds > 120)
    ) {
      toast.toastError("재정렬 시간 제한(timeout_seconds)은 1에서 120 사이의 정수 값으로 설정하거나, 값을 설정하지 않고 비워둘 수 있습니다.");
      return false;
    }

    const alphaRaw = vectorRerankHybridAlphaDraft.trim();
    const parsedHybridAlpha = alphaRaw ? Number(alphaRaw) : null;
    if (
      parsedHybridAlpha !== null &&
      (!Number.isFinite(parsedHybridAlpha) || parsedHybridAlpha < 0 || parsedHybridAlpha > 1)
    ) {
      toast.toastError("rerank_hybrid_alpha 값은 0과 1 사이의 숫자(또는 비워둘 수 있음)로 설정해야 합니다.");
      return false;
    }

    savingVectorRef.current = true;
    setSavingVector(true);
    try {
      const res = await apiJson<{ settings: ProjectSettings }>(`/api/projects/${projectId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          vector_rerank_enabled: Boolean(vectorForm.vector_rerank_enabled),
          vector_rerank_method: rerankMethod,
          vector_rerank_top_k: parsedTopK,
          vector_rerank_provider: vectorForm.vector_rerank_provider,
          vector_rerank_base_url: vectorForm.vector_rerank_base_url,
          vector_rerank_model: vectorForm.vector_rerank_model,
          vector_rerank_timeout_seconds: parsedTimeoutSeconds,
          vector_rerank_hybrid_alpha: parsedHybridAlpha,
          vector_embedding_provider: vectorForm.vector_embedding_provider,
          vector_embedding_base_url: vectorForm.vector_embedding_base_url,
          vector_embedding_model: vectorForm.vector_embedding_model,
          vector_embedding_azure_deployment: vectorForm.vector_embedding_azure_deployment,
          vector_embedding_azure_api_version: vectorForm.vector_embedding_azure_api_version,
          vector_embedding_sentence_transformers_model: vectorForm.vector_embedding_sentence_transformers_model,
          ...(rerankApiKeyDirty ? { vector_rerank_api_key: rerankApiKeyClearRequested ? "" : rerankApiKeyDraft } : {}),
          ...(vectorApiKeyDirty
            ? { vector_embedding_api_key: vectorApiKeyClearRequested ? "" : vectorApiKeyDraft }
            : {}),
        }),
      });

      const settings = res.data.settings;
      const nextTopK = Number(settings.vector_rerank_effective_top_k ?? 20) || 20;
      setBaselineSettings(settings);
      setVectorForm({
        vector_rerank_enabled: Boolean(settings.vector_rerank_effective_enabled),
        vector_rerank_method: String(settings.vector_rerank_effective_method ?? "auto") || "auto",
        vector_rerank_top_k: nextTopK,
        vector_rerank_provider: settings.vector_rerank_provider ?? "",
        vector_rerank_base_url: settings.vector_rerank_base_url ?? "",
        vector_rerank_model: settings.vector_rerank_model ?? "",
        vector_rerank_timeout_seconds: settings.vector_rerank_timeout_seconds ?? null,
        vector_rerank_hybrid_alpha: settings.vector_rerank_hybrid_alpha ?? null,
        vector_embedding_provider: settings.vector_embedding_provider ?? "",
        vector_embedding_base_url: settings.vector_embedding_base_url ?? "",
        vector_embedding_model: settings.vector_embedding_model ?? "",
        vector_embedding_azure_deployment: settings.vector_embedding_azure_deployment ?? "",
        vector_embedding_azure_api_version: settings.vector_embedding_azure_api_version ?? "",
        vector_embedding_sentence_transformers_model: settings.vector_embedding_sentence_transformers_model ?? "",
      });
      setVectorRerankTopKDraft(String(nextTopK));
      setVectorRerankTimeoutDraft(
        settings.vector_rerank_timeout_seconds != null ? String(settings.vector_rerank_timeout_seconds) : "",
      );
      setVectorRerankHybridAlphaDraft(
        settings.vector_rerank_hybrid_alpha != null ? String(settings.vector_rerank_hybrid_alpha) : "",
      );
      setVectorApiKeyDraft("");
      setVectorApiKeyClearRequested(false);
      setRerankApiKeyDraft("");
      setRerankApiKeyClearRequested(false);

      toast.toastSuccess("저장됨.");
      return true;
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
      return false;
    } finally {
      setSavingVector(false);
      savingVectorRef.current = false;
    }
  }, [
    baselineSettings,
    projectId,
    rerankApiKeyClearRequested,
    rerankApiKeyDirty,
    rerankApiKeyDraft,
    toast,
    vectorApiKeyClearRequested,
    vectorApiKeyDirty,
    vectorApiKeyDraft,
    vectorForm,
    vectorRagDirty,
    vectorRerankHybridAlphaDraft,
    vectorRerankTopKDraft,
    vectorRerankTimeoutDraft,
  ]);

  const runEmbeddingDryRun = useCallback(async () => {
    if (!projectId) return;
    if (savingVector || embeddingDryRunLoading || rerankDryRunLoading) return;

    if (vectorRagDirty || vectorApiKeyDirty || rerankApiKeyDirty) {
      toast.toastError(PROMPTS_COPY.vectorRag.saveBeforeTestToast);
      return;
    }

    setEmbeddingDryRunLoading(true);
    setEmbeddingDryRunError(null);
    try {
      const res = await apiJson<{ result: VectorEmbeddingDryRunResult }>(
        `/api/projects/${projectId}/vector/embeddings/dry-run`,
        {
          method: "POST",
          body: JSON.stringify({ text: "hello world" }),
        },
      );
      setEmbeddingDryRun({ requestId: res.request_id, result: res.data.result });
      toast.toastSuccess("임베딩 테스트가 완료되었습니다.", res.request_id);
    } catch (e) {
      const err = e as ApiError;
      setEmbeddingDryRunError({ message: err.message, code: err.code, requestId: err.requestId });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setEmbeddingDryRunLoading(false);
    }
  }, [
    embeddingDryRunLoading,
    projectId,
    rerankApiKeyDirty,
    rerankDryRunLoading,
    savingVector,
    toast,
    vectorApiKeyDirty,
    vectorRagDirty,
  ]);

  const runRerankDryRun = useCallback(async () => {
    if (!projectId) return;
    if (savingVector || embeddingDryRunLoading || rerankDryRunLoading) return;

    if (vectorRagDirty || vectorApiKeyDirty || rerankApiKeyDirty) {
      toast.toastError(PROMPTS_COPY.vectorRag.saveBeforeTestToast);
      return;
    }

    setRerankDryRunLoading(true);
    setRerankDryRunError(null);
    try {
      const res = await apiJson<{ result: VectorRerankDryRunResult }>(
        `/api/projects/${projectId}/vector/rerank/dry-run`,
        {
          method: "POST",
          body: JSON.stringify({
            query_text: "dragon castle",
            documents: ["apple banana", "dragon castle"],
          }),
        },
      );
      setRerankDryRun({ requestId: res.request_id, result: res.data.result });
      toast.toastSuccess("재정렬 테스트가 완료되었습니다.", res.request_id);
    } catch (e) {
      const err = e as ApiError;
      setRerankDryRunError({ message: err.message, code: err.code, requestId: err.requestId });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setRerankDryRunLoading(false);
    }
  }, [
    embeddingDryRunLoading,
    projectId,
    rerankApiKeyDirty,
    rerankDryRunLoading,
    savingVector,
    toast,
    vectorApiKeyDirty,
    vectorRagDirty,
  ]);

  const selectProfile = useCallback(
    async (profileId: string | null) => {
      if (!projectId) return;
      if (profileBusy) return;
      if (profileId === selectedProfileId) return;

      if (dirty) {
        const choice = await confirm.choose({
          title: "현재 변경 사항이 저장되지 않았습니다. 설정을 변경하시겠습니까?",
          description: "변경 후에는 양식이 초기화되므로, 먼저 저장하는 것이 좋습니다.",
          confirmText: "저장하고 변경하기.",
          secondaryText: "변경 사항 저장하지 않음.",
          cancelText: "취소하다.",
        });
        if (choice === "cancel") return;
        if (choice === "confirm") {
          const ok = await saveAllDirtyModules();
          if (!ok) return;
        }
      }

      setProfileBusy(true);
      try {
        await apiJson<{ project: Project }>(`/api/projects/${projectId}`, {
          method: "PUT",
          body: JSON.stringify({ llm_profile_id: profileId }),
        });
        await reloadAll();
        await refreshWizard();
        toast.toastSuccess("설정이 변경되었습니다.");
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setProfileBusy(false);
      }
    },
    [confirm, dirty, profileBusy, projectId, reloadAll, refreshWizard, saveAllDirtyModules, selectedProfileId, toast],
  );

  const createProfile = useCallback(async () => {
    if (!projectId) return;
    if (profileBusy) return;
    const name = profileName.trim();
    if (!name) {
      toast.toastError("먼저 “새 구성 파일 이름”을 입력해 주세요.");
      return;
    }
    const payload = buildPresetPayload(llmForm);
    if (!payload.ok) {
      toast.toastError(payload.message);
      return;
    }

    setProfileBusy(true);
    try {
      const apiKeyInput = apiKey.trim();
      const res = await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles`, {
        method: "POST",
        body: JSON.stringify({
          name,
          provider: payload.payload.provider,
          base_url: payload.payload.base_url,
          model: payload.payload.model,
          temperature: payload.payload.temperature,
          top_p: payload.payload.top_p,
          max_tokens: payload.payload.max_tokens,
          presence_penalty: payload.payload.presence_penalty,
          frequency_penalty: payload.payload.frequency_penalty,
          top_k: payload.payload.top_k,
          stop: payload.payload.stop,
          timeout_seconds: payload.payload.timeout_seconds,
          extra: payload.payload.extra,
          api_key: apiKeyInput ? apiKeyInput : undefined,
        }),
      });
      await apiJson<{ project: Project }>(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({ llm_profile_id: res.data.profile.id }),
      });
      setApiKey("");
      await reloadAll();
      await refreshWizard();
      toast.toastSuccess("새 구성으로 저장되었고 프로젝트에 적용되었습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setProfileBusy(false);
    }
  }, [apiKey, llmForm, profileBusy, profileName, projectId, reloadAll, refreshWizard, toast]);

  const updateProfile = useCallback(async () => {
    if (!projectId) return;
    if (profileBusy) return;
    if (!selectedProfileId) {
      toast.toastError("먼저 백엔드 설정을 하나 선택해 주세요.");
      return;
    }
    if (dirty) {
      const ok = await saveAllDirtyModules();
      if (!ok) return;
    }
    const payload = buildPresetPayload(llmForm);
    if (!payload.ok) {
      toast.toastError(payload.message);
      return;
    }
    const name = profileName.trim();
    setProfileBusy(true);
    try {
      await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${selectedProfileId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name ? name : undefined,
          provider: payload.payload.provider,
          base_url: payload.payload.base_url,
          model: payload.payload.model,
          temperature: payload.payload.temperature,
          top_p: payload.payload.top_p,
          max_tokens: payload.payload.max_tokens,
          presence_penalty: payload.payload.presence_penalty,
          frequency_penalty: payload.payload.frequency_penalty,
          top_k: payload.payload.top_k,
          stop: payload.payload.stop,
          timeout_seconds: payload.payload.timeout_seconds,
          extra: payload.payload.extra,
        }),
      });
      await reloadAll();
      toast.toastSuccess("구성이 업데이트되었습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setProfileBusy(false);
    }
  }, [dirty, llmForm, profileBusy, profileName, projectId, reloadAll, saveAllDirtyModules, selectedProfileId, toast]);

  const deleteProfile = useCallback(async () => {
    if (!selectedProfileId) {
      toast.toastError("먼저 백엔드 설정을 하나 선택해 주세요.");
      return;
    }
    if (profileBusy) return;

    const ok = await confirm.confirm({
      ...PROMPTS_COPY.confirm.deleteProfile,
      danger: true,
    });
    if (!ok) return;

    setProfileBusy(true);
    try {
      await apiJson<Record<string, never>>(`/api/llm_profiles/${selectedProfileId}`, { method: "DELETE" });
      setApiKey("");
      await reloadAll();
      await refreshWizard();
      toast.toastSuccess("구성 설정이 삭제되었습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setProfileBusy(false);
    }
  }, [confirm, profileBusy, reloadAll, refreshWizard, selectedProfileId, toast]);

  const saveApiKeyToProfile = useCallback(async (): Promise<boolean> => {
    if (!selectedProfileId) {
      toast.toastError("먼저 백엔드 설정을 선택하거나 새로 만드세요.");
      return false;
    }
    const key = apiKey.trim();
    if (!key) {
      toast.toastError("먼저 API 키를 입력해 주세요.");
      return false;
    }
    if (profileBusy) return false;

    setProfileBusy(true);
    try {
      await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${selectedProfileId}`, {
        method: "PUT",
        body: JSON.stringify({ api_key: key }),
      });
      setApiKey("");
      await reloadAll();
      await refreshWizard();
      bumpWizardLocal();
      toast.toastSuccess("키가 저장되었습니다.");
      return true;
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
      return false;
    } finally {
      setProfileBusy(false);
    }
  }, [apiKey, bumpWizardLocal, profileBusy, refreshWizard, reloadAll, selectedProfileId, toast]);

  const clearApiKeyInProfile = useCallback(async () => {
    if (!selectedProfileId) {
      toast.toastError("먼저 백엔드 설정을 하나 선택해 주세요.");
      return;
    }
    if (profileBusy) return;

    const ok = await confirm.confirm({
      ...PROMPTS_COPY.confirm.clearProfileApiKey,
      danger: true,
    });
    if (!ok) return;

    setProfileBusy(true);
    try {
      await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${selectedProfileId}`, {
        method: "PUT",
        body: JSON.stringify({ api_key: null }),
      });
      setApiKey("");
      await reloadAll();
      await refreshWizard();
      bumpWizardLocal();
      toast.toastSuccess("키가 삭제되었습니다.");
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setProfileBusy(false);
    }
  }, [bumpWizardLocal, confirm, profileBusy, refreshWizard, reloadAll, selectedProfileId, toast]);

  const saveTaskApiKey = useCallback(
    async (taskKey: string): Promise<boolean> => {
      const draft = taskDrafts[taskKey];
      if (!draft) return false;
      const profileId = (draft.llm_profile_id ?? selectedProfileId ?? "").trim();
      if (!profileId) {
        toast.toastError("해당 작업에 먼저 설정 파일을 연결하거나, 기본 설정을 먼저 설정하십시오.");
        return false;
      }
      const profile = profiles.find((item) => item.id === profileId) ?? null;
      if (!profile) {
        toast.toastError("유효한 구성 파일이 없습니다. 새로 고침 후 다시 시도해 주세요.");
        return false;
      }

      const key = (taskApiKeyDrafts[taskKey] ?? "").trim();
      if (!key) {
        toast.toastError("먼저 API 키를 입력해 주세요.");
        return false;
      }
      if (taskProfileBusy[taskKey]) return false;

      setTaskProfileBusy((prev) => ({ ...prev, [taskKey]: true }));
      try {
        const res = await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${profileId}`, {
          method: "PUT",
          body: JSON.stringify({ api_key: key }),
        });
        upsertProfile(res.data.profile);
        setTaskApiKeyDrafts((prev) => ({ ...prev, [taskKey]: "" }));
        await refreshWizard();
        bumpWizardLocal();
        toast.toastSuccess(`구성 라이브러리.「${profile.name}」Key 저장됨.`, res.request_id);
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setTaskProfileBusy((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [
      bumpWizardLocal,
      profiles,
      refreshWizard,
      selectedProfileId,
      taskApiKeyDrafts,
      taskDrafts,
      taskProfileBusy,
      toast,
      upsertProfile,
    ],
  );

  const clearTaskApiKey = useCallback(
    async (taskKey: string): Promise<boolean> => {
      const draft = taskDrafts[taskKey];
      if (!draft) return false;
      const profileId = (draft.llm_profile_id ?? selectedProfileId ?? "").trim();
      if (!profileId) {
        toast.toastError("해당 작업에 먼저 설정 파일을 연결하거나, 기본 설정을 먼저 설정하십시오.");
        return false;
      }
      const profile = profiles.find((item) => item.id === profileId) ?? null;
      if (!profile) {
        toast.toastError("유효한 구성 파일이 없습니다. 새로 고침 후 다시 시도해 주세요.");
        return false;
      }
      if (!profile?.has_api_key) return true;
      if (taskProfileBusy[taskKey]) return false;

      const taskLabel = taskCatalogByKey.get(taskKey)?.label ?? taskKey;
      const ok = await confirm.confirm({
        ...buildClearTaskApiKeyConfirm(profile.name),
        danger: true,
      });
      if (!ok) return false;

      setTaskProfileBusy((prev) => ({ ...prev, [taskKey]: true }));
      try {
        const res = await apiJson<{ profile: LLMProfile }>(`/api/llm_profiles/${profileId}`, {
          method: "PUT",
          body: JSON.stringify({ api_key: null }),
        });
        upsertProfile(res.data.profile);
        setTaskApiKeyDrafts((prev) => ({ ...prev, [taskKey]: "" }));
        await refreshWizard();
        bumpWizardLocal();
        toast.toastSuccess(`모듈.「${taskLabel}」바인딩된 설정. Key 제거 완료.`, res.request_id);
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
        return false;
      } finally {
        setTaskProfileBusy((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [
      bumpWizardLocal,
      confirm,
      profiles,
      refreshWizard,
      selectedProfileId,
      taskCatalogByKey,
      taskDrafts,
      taskProfileBusy,
      toast,
      upsertProfile,
    ],
  );

  const testTaskConnection = useCallback(
    async (taskKey: string): Promise<boolean> => {
      if (!projectId) return false;
      const draft = taskDrafts[taskKey];
      if (!draft) return false;

      const payload = buildPresetPayload(draft.form);
      if (!payload.ok) {
        toast.toastError(payload.message);
        return false;
      }

      const boundProfileId = (draft.llm_profile_id ?? "").trim() || null;
      const boundProfile = boundProfileId ? (profiles.find((item) => item.id === boundProfileId) ?? null) : null;
      if (boundProfileId && !boundProfile) {
        toast.toastError("할당된 작업 모듈의 구성 파일이 존재하지 않습니다. 다시 선택해 주세요.");
        return false;
      }
      const taskAccessState = deriveLlmModuleAccessState({
        scope: "task",
        moduleProvider: payload.payload.provider,
        selectedProfile,
        boundProfile,
      });
      if (taskAccessState.actionReason) {
        toast.toastError(taskAccessState.actionReason);
        return false;
      }
      const effectiveProfile = taskAccessState.effectiveProfile;
      if (!effectiveProfile) return false;

      const model = payload.payload.model.trim();
      const baseUrl = payload.payload.base_url;
      const taskLabel = taskCatalogByKey.get(taskKey)?.label ?? taskKey;

      setTaskTesting((prev) => ({ ...prev, [taskKey]: true }));
      try {
        const res = await apiJson<{ latency_ms: number; text?: string }>("/api/llm/test", {
          method: "POST",
          headers: {
            "X-LLM-Provider": payload.payload.provider,
          },
          body: JSON.stringify({
            project_id: projectId,
            profile_id: boundProfileId,
            provider: payload.payload.provider,
            base_url: baseUrl,
            model,
            timeout_seconds: parseTimeoutSecondsForTest(draft.form.timeout_seconds),
            extra: payload.payload.extra,
            params: {
              temperature: payload.payload.temperature ?? 0,
              // Some models may emit "thinking" blocks before final text; keep this > tiny to ensure we get a text preview.
              max_tokens: 64,
            },
          }),
        });
        const preview = (res.data.text ?? "").trim();
        toast.toastSuccess(
          `모듈.「${taskLabel}」연결 성공 (지연 발생). ${res.data.latency_ms}ms${preview ? `，출력:${preview}` : ""}）`,
          res.request_id,
        );
        return true;
      } catch (e) {
        const err = e as ApiError;
        toast.toastError(formatLlmTestApiError(err), err.requestId);
        return false;
      } finally {
        setTaskTesting((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [profiles, projectId, selectedProfile, taskCatalogByKey, taskDrafts, toast],
  );

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    const payload = buildPresetPayload(llmForm);
    if (!payload.ok) {
      toast.toastError(payload.message);
      return false;
    }

    const connectionState = deriveLlmModuleAccessState({
      scope: "main",
      moduleProvider: payload.payload.provider,
      selectedProfile,
    });
    if (connectionState.actionReason) {
      toast.toastError(connectionState.actionReason);
      return false;
    }

    const model = payload.payload.model.trim();
    const baseUrl = payload.payload.base_url;

    setTesting(true);
    try {
      const res = await apiJson<{ latency_ms: number; text?: string }>("/api/llm/test", {
        method: "POST",
        headers: {
          "X-LLM-Provider": payload.payload.provider,
        },
        body: JSON.stringify({
          project_id: projectId,
          provider: payload.payload.provider,
          base_url: baseUrl,
          model,
          timeout_seconds: parseTimeoutSecondsForTest(llmForm.timeout_seconds),
          extra: payload.payload.extra,
          params: {
            temperature: payload.payload.temperature ?? 0,
            // Some models may emit "thinking" blocks before final text; keep this > tiny to ensure we get a text preview.
            max_tokens: 64,
          },
        }),
      });
      const preview = (res.data.text ?? "").trim();
      toast.toastSuccess(
        `연결 성공 (지연 발생). ${res.data.latency_ms}ms${preview ? `，출력:${preview}` : ""}）`,
        res.request_id,
      );
      if (projectId) {
        markWizardLlmTestOk(projectId, payload.payload.provider, model);
        bumpWizardLocal();
      }
      return true;
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(formatLlmTestApiError(err), err.requestId);
      return false;
    } finally {
      setTesting(false);
    }
  }, [bumpWizardLocal, llmForm, projectId, selectedProfile, toast]);

  const nextAfterLlm = useMemo(() => {
    const idx = wizard.progress.steps.findIndex((s) => s.key === "llm");
    if (idx < 0) return wizard.progress.nextStep;
    for (let i = idx + 1; i < wizard.progress.steps.length; i++) {
      const s = wizard.progress.steps[i];
      if (s.state === "todo") return s;
    }
    return null;
  }, [wizard.progress]);

  const testAndGoNext = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;

    const saved = await saveAllDirtyModules();
    if (!saved) return false;

    const ok = await testConnection();
    if (!ok) return false;

    if (nextAfterLlm?.href) navigate(nextAfterLlm.href);
    else navigate(`/projects/${projectId}/outline`);
    return true;
  }, [navigate, nextAfterLlm?.href, projectId, saveAllDirtyModules, testConnection]);

  const embeddingProviderPreview = (
    vectorForm.vector_embedding_provider.trim() ||
    baselineSettings?.vector_embedding_effective_provider ||
    "openai_compatible"
  ).trim();

  return {
    loading,
    blockingLoadError: loadError && !project && !baselinePreset ? loadError : null,
    reloadAll,
    dirty,
    outletActive,
    projectId,
    llmPresetPanelProps: {
      llmForm,
      setLlmForm,
      presetDirty,
      saving: savingPreset,
      testing,
      capabilities,
      onTestConnection: () => void testConnection(),
      onSave: () => void saveAll(),
      mainModelList,
      onReloadMainModels: reloadMainModels,
      profiles,
      selectedProfileId,
      onSelectProfile: (id) => void selectProfile(id),
      profileName,
      onChangeProfileName: setProfileName,
      profileBusy: profileBusy || testing || savingPreset,
      onCreateProfile: () => void createProfile(),
      onUpdateProfile: () => void updateProfile(),
      onDeleteProfile: () => void deleteProfile(),
      apiKey,
      onChangeApiKey: setApiKey,
      onSaveApiKey: () => void saveApiKeyToProfile(),
      onClearApiKey: () => void clearApiKeyInProfile(),
      taskModules,
      addableTasks,
      selectedAddTaskKey,
      onSelectAddTaskKey: setSelectedAddTaskKey,
      onAddTaskModule: addTaskModule,
      onTaskProfileChange: updateTaskProfile,
      onTaskFormChange: updateTaskForm,
      onSaveTask: (taskKey) => void saveTaskModule(taskKey),
      onDeleteTask: (taskKey) => void deleteTaskModule(taskKey),
      taskTesting,
      onTestTaskConnection: (taskKey) => void testTaskConnection(taskKey),
      taskApiKeyDrafts,
      onTaskApiKeyDraftChange: updateTaskApiKeyDraft,
      taskProfileBusy,
      onSaveTaskApiKey: (taskKey) => void saveTaskApiKey(taskKey),
      onClearTaskApiKey: (taskKey) => void clearTaskApiKey(taskKey),
      onReloadTaskModels: reloadTaskModels,
    },
    vectorRagSectionProps: {
      baselineSettings,
      vectorForm,
      setVectorForm,
      vectorRerankTopKDraft,
      setVectorRerankTopKDraft,
      vectorRerankTimeoutDraft,
      setVectorRerankTimeoutDraft,
      vectorRerankHybridAlphaDraft,
      setVectorRerankHybridAlphaDraft,
      vectorApiKeyDraft,
      setVectorApiKeyDraft,
      vectorApiKeyClearRequested,
      setVectorApiKeyClearRequested,
      rerankApiKeyDraft,
      setRerankApiKeyDraft,
      rerankApiKeyClearRequested,
      setRerankApiKeyClearRequested,
      savingVector,
      vectorRagDirty,
      vectorApiKeyDirty,
      rerankApiKeyDirty,
      embeddingProviderPreview,
      embeddingDryRunLoading,
      embeddingDryRun,
      embeddingDryRunError,
      rerankDryRunLoading,
      rerankDryRun,
      rerankDryRunError,
      onSave: () => void saveVectorRagConfig(),
      onRunEmbeddingDryRun: () => void runEmbeddingDryRun(),
      onRunRerankDryRun: () => void runRerankDryRun(),
    },
    goToPromptStudio: () => {
      if (!projectId) return;
      navigate(`/projects/${projectId}/prompt-studio`);
    },
    wizardBarProps: {
      projectId,
      currentStep: "llm",
      progress: wizard.progress,
      loading: wizard.loading,
      dirty,
      saving: savingPreset || testing,
      onSave: saveAll,
      primaryAction:
        wizard.progress.nextStep?.key === "llm"
          ? {
              label: llmCtaBlockedReason ?? `연결 테스트를 진행하고 다음 단계로 넘어갑니다.${nextAfterLlm ? nextAfterLlm.title : "계속하세요. / 계속 진행하세요. / 계속합니다. (문맥에 따라 적절하게 선택)"}`,
              disabled: Boolean(savingPreset || testing || llmCtaBlockedReason),
              onClick: testAndGoNext,
            }
          : undefined,
    },
  };
}
