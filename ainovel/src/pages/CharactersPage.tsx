import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { WizardNextBar } from "../components/atelier/WizardNextBar";
import { Drawer } from "../components/ui/Drawer";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { useAutoSave } from "../hooks/useAutoSave";
import { useProjectData } from "../hooks/useProjectData";
import { useWizardProgress } from "../hooks/useWizardProgress";
import { copyText } from "../lib/copyText";
import { duration, transition } from "../lib/motion";
import { ApiError, apiJson } from "../services/apiClient";
import { markWizardProjectChanged } from "../services/wizard";
import type { Character } from "../types";

type CharacterForm = {
  name: string;
  role: string;
  profile: string;
  notes: string;
};

export function CharactersPage() {
  const { projectId } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const reduceMotion = useReducedMotion();
  const wizard = useWizardProgress(projectId);
  const refreshWizard = wizard.refresh;
  const bumpWizardLocal = wizard.bumpLocal;

  const [loadError, setLoadError] = useState<null | { message: string; code: string; requestId?: string }>(null);

  const charactersQuery = useProjectData<Character[]>(projectId, async (id) => {
    try {
      const res = await apiJson<{ characters: Character[] }>(`/api/projects/${id}/characters`);
      setLoadError(null);
      return res.data.characters;
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setLoadError({ message: "요청이 실패했습니다.", code: "UNKNOWN_ERROR" });
      }
      throw e;
    }
  });
  const characters = useMemo(() => charactersQuery.data ?? [], [charactersQuery.data]);
  const loading = charactersQuery.loading;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef<null | { silent: boolean; close: boolean; snapshot?: CharacterForm }>(null);
  const wizardRefreshTimerRef = useRef<number | null>(null);
  const [baseline, setBaseline] = useState<CharacterForm | null>(null);
  const [form, setForm] = useState<CharacterForm>({ name: "", role: "", profile: "", notes: "" });
  const [searchText, setSearchText] = useState("");

  const filteredCharacters = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) => {
      const name = String(c.name ?? "").toLowerCase();
      const role = String(c.role ?? "").toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }, [characters, searchText]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      form.name !== baseline.name ||
      form.role !== baseline.role ||
      form.profile !== baseline.profile ||
      form.notes !== baseline.notes
    );
  }, [baseline, form]);

  const load = charactersQuery.refresh;
  const setCharacters = charactersQuery.setData;

  useEffect(() => {
    return () => {
      if (wizardRefreshTimerRef.current !== null) window.clearTimeout(wizardRefreshTimerRef.current);
    };
  }, []);

  const openNew = () => {
    setEditing(null);
    const next = { name: "", role: "", profile: "", notes: "" };
    setForm(next);
    setBaseline(next);
    setDrawerOpen(true);
  };

  const openEdit = (c: Character) => {
    setEditing(c);
    const next = {
      name: c.name ?? "",
      role: c.role ?? "",
      profile: c.profile ?? "",
      notes: c.notes ?? "",
    };
    setForm(next);
    setBaseline(next);
    setDrawerOpen(true);
  };

  const closeDrawer = async () => {
    if (dirty) {
      const ok = await confirm.confirm({
        title: "저장하지 않은 변경 사항을 닫겠습니까?",
        description: "저장하지 않고 닫으면 입력한 내용이 모두 사라집니다. 닫기 전에 먼저 “저장”을 클릭하세요.",
        confirmText: "포기하다.",
        cancelText: "취소하다.",
        danger: true,
      });
      if (!ok) return;
    }
    setDrawerOpen(false);
  };

  const saveCharacter = useCallback(
    async (opts?: { silent?: boolean; close?: boolean; snapshot?: CharacterForm }) => {
      if (!projectId) return false;
      const silent = Boolean(opts?.silent);
      const close = Boolean(opts?.close);
      const snapshot = opts?.snapshot ?? form;
      if (!snapshot.name.trim()) return false;

      if (savingRef.current) {
        queuedSaveRef.current = { silent, close, snapshot };
        return false;
      }

      const scheduleWizardRefresh = () => {
        if (wizardRefreshTimerRef.current !== null) window.clearTimeout(wizardRefreshTimerRef.current);
        wizardRefreshTimerRef.current = window.setTimeout(() => void refreshWizard(), 1200);
      };

      savingRef.current = true;
      setSaving(true);
      try {
        const res = !editing
          ? await apiJson<{ character: Character }>(`/api/projects/${projectId}/characters`, {
              method: "POST",
              body: JSON.stringify({
                name: snapshot.name.trim(),
                role: snapshot.role.trim() || null,
                profile: snapshot.profile || null,
                notes: snapshot.notes || null,
              }),
            })
          : await apiJson<{ character: Character }>(`/api/characters/${editing.id}`, {
              method: "PUT",
              body: JSON.stringify({
                name: snapshot.name.trim(),
                role: snapshot.role.trim() || null,
                profile: snapshot.profile || null,
                notes: snapshot.notes || null,
              }),
            });

        const saved = res.data.character;
        setEditing(saved);
        setCharacters((prev) => {
          const list = prev ?? [];
          const idx = list.findIndex((c) => c.id === saved.id);
          if (idx >= 0) return list.map((c) => (c.id === saved.id ? saved : c));
          return [saved, ...list];
        });

        const nextBaseline: CharacterForm = {
          name: saved.name ?? "",
          role: saved.role ?? "",
          profile: saved.profile ?? "",
          notes: saved.notes ?? "",
        };
        setBaseline(nextBaseline);
        setForm((prev) => {
          if (
            prev.name === snapshot.name &&
            prev.role === snapshot.role &&
            prev.profile === snapshot.profile &&
            prev.notes === snapshot.notes
          ) {
            return nextBaseline;
          }
          return prev;
        });

        markWizardProjectChanged(projectId);
        bumpWizardLocal();
        if (silent) scheduleWizardRefresh();
        else await refreshWizard();
        if (!silent) toast.toastSuccess("저장됨.");
        if (close) setDrawerOpen(false);
        return true;
      } catch (err) {
        const apiErr = err as ApiError;
        toast.toastError(`${apiErr.message} (${apiErr.code})`, apiErr.requestId);
        return false;
      } finally {
        setSaving(false);
        savingRef.current = false;
        if (queuedSaveRef.current) {
          const queued = queuedSaveRef.current;
          queuedSaveRef.current = null;
          void saveCharacter({ silent: queued.silent, close: queued.close, snapshot: queued.snapshot });
        }
      }
    },
    [bumpWizardLocal, editing, form, projectId, refreshWizard, setCharacters, toast],
  );

  useAutoSave({
    enabled: drawerOpen && Boolean(projectId) && Boolean(baseline),
    dirty,
    delayMs: 900,
    getSnapshot: () => ({ ...form }),
    onSave: async (snapshot) => {
      await saveCharacter({ silent: true, close: false, snapshot });
    },
    deps: [editing?.id ?? "", form.name, form.role, form.profile, form.notes],
  });

  return (
    <div className="grid gap-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-subtext">
            {searchText.trim()
              ? `함께. ${filteredCharacters.length}/${characters.length} 역할.`
              : `함께. ${characters.length} 역할.`}
          </div>
          <input
            className="input-underline w-full sm:w-64"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="검색: 이름 / 위치"
            aria-label="캐릭터 검색."
          />
          {searchText.trim() ? (
            <button className="btn btn-ghost px-3 py-2 text-xs" onClick={() => setSearchText("")} type="button">
              검색 결과 삭제.
            </button>
          ) : null}
        </div>
        <button className="btn btn-primary" onClick={openNew} type="button">
          새로운 캐릭터 추가.
        </button>
      </div>

      {loading && charactersQuery.data === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="panel p-6">
              <div className="skeleton h-5 w-24" />
              <div className="mt-3 grid gap-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && charactersQuery.data === null && loadError ? (
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
            <button className="btn btn-primary" onClick={() => void load()} type="button">
              다시 시도하세요.
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !loadError && characters.length === 0 ? (
        <div className="panel p-6">
          <div className="font-content text-xl text-ink">아직 역할이 지정되지 않았습니다.</div>
          <div className="mt-2 text-sm text-subtext">
            먼저 생성하는 것을 권장합니다. 3-5 주요 등장인물 (주인공) / 악당. / 핵심. NPC），다시 「개요」에 들어가서 장을 생성합니다.。
          </div>
          <button className="btn btn-primary mt-4" onClick={openNew} type="button">
            새로운 캐릭터 추가.
          </button>
        </div>
      ) : null}

      {!loading && !loadError && characters.length > 0 && filteredCharacters.length === 0 ? (
        <div className="panel p-6">
          <div className="font-content text-xl text-ink">해당하는 역할이 없습니다.</div>
          <div className="mt-2 text-sm text-subtext">검색어를 변경하거나 검색 결과를 모두 지우고 다시 시도해 보세요.。</div>
          <button className="btn btn-secondary mt-4" onClick={() => setSearchText("")} type="button">
            검색 결과 삭제.
          </button>
        </div>
      ) : null}

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduceMotion ? 0 : duration.stagger } },
        }}
      >
        {filteredCharacters.map((c) => (
          <motion.div
            key={c.id}
            className="panel-interactive ui-focus-ring p-6 text-left"
            initial="hidden"
            animate="show"
            variants={{
              hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
              show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
            }}
            transition={reduceMotion ? transition.reduced : transition.slow}
            whileHover={reduceMotion ? undefined : { y: -2, transition: transition.fast }}
            whileTap={reduceMotion ? undefined : { y: 0, scale: 0.98, transition: transition.fast }}
            onClick={() => openEdit(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openEdit(c);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-content text-xl text-ink">{c.name}</div>
                <div className="mt-1 text-xs text-subtext">{c.role ?? "역할 설정이 완료되지 않았습니다."}</div>
              </div>
              <button
                className="btn btn-ghost px-3 py-2 text-xs text-danger hover:bg-danger/10"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm.confirm({
                    title: "캐릭터를 삭제하시겠습니까?",
                    description: "해당 역할은 프로젝트에서 제외됩니다.",
                    confirmText: "삭제하다.",
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await apiJson<Record<string, never>>(`/api/characters/${c.id}`, { method: "DELETE" });
                    if (projectId) markWizardProjectChanged(projectId);
                    bumpWizardLocal();
                    toast.toastSuccess("삭제됨.");
                    await load();
                    await refreshWizard();
                  } catch (err) {
                    const apiErr = err as ApiError;
                    toast.toastError(`${apiErr.message} (${apiErr.code})`, apiErr.requestId);
                  }
                }}
                type="button"
              >
                삭제하다.
              </button>
            </div>
            {c.profile ? <div className="mt-3 line-clamp-4 text-sm text-subtext">{c.profile}</div> : null}
          </motion.div>
        ))}
      </motion.div>

      <Drawer
        open={drawerOpen}
        onClose={() => void closeDrawer()}
        panelClassName="h-full w-full max-w-xl border-l border-border bg-canvas p-6 shadow-sm"
        ariaLabel={editing ? "캐릭터 편집." : "새로운 캐릭터 추가."}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-content text-2xl text-ink">{editing ? "캐릭터 편집." : "새로운 캐릭터 추가."}</div>
            <div className="mt-1 text-xs text-subtext">{dirty ? "저장되지 않았습니다." : "저장됨."}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => void closeDrawer()} type="button">
              닫기.
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !form.name.trim()}
              onClick={() => void saveCharacter({ silent: false, close: true })}
              type="button"
            >
              저장.
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">성함.</span>
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="예를 들어, 린모(린모) 씨와 같은 경우를 들 수 있습니다."
            />
            <div className="text-[11px] text-subtext">독자가 기억하기 쉬운 짧은 이름을 사용하는 것이 좋습니다. 이후 검색 및 생성 과정에서 해당 이름이 활용될 예정입니다.。</div>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">캐릭터 설정 (또는 캐릭터 포지셔닝)</span>
            <input
              className="input"
              name="role"
              value={form.role}
              onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
              placeholder="예를 들어: 주인공 / 악당 / 핵심 NPC."
            />
            <div className="text-[11px] text-subtext">빠르게 검색할 때 사용하며, “주인공”이라고 적을 수 있습니다./악당./지도교수, 지도자, 스승. (문맥에 따라 적절한 단어 선택)/동료, 동반자, 함께하는 사람. (문맥에 따라 적절한 단어 선택)/“행인” 등.。</div>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">인물 정보.</span>
            <textarea
              className="textarea atelier-content"
              name="profile"
              rows={8}
              value={form.profile}
              onChange={(e) => setForm((v) => ({ ...v, profile: e.target.value }))}
              placeholder="외모, 성격, 동기, 관계, 말투, 성장 과정 등…"
            />
            <div className="text-[11px] text-subtext">생성 시 일관된 캐릭터 설정을 유지하는 데 사용됩니다. 항목별로 작성하면 재사용이 용이합니다.。</div>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">참고.</span>
            <textarea
              className="textarea atelier-content"
              name="notes"
              rows={6}
              value={form.notes}
              onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
              placeholder="등장 챕터, 금지 사항, 시간 순서, 추가 정보 필요…"
            />
            <div className="text-[11px] text-subtext">초안본./추가 정보가 필요하며, 다른 인물 정보와 혼동되어 오해를 불러일으키지 않도록 주의해야 합니다.。</div>
          </label>
        </div>
      </Drawer>

      <WizardNextBar
        projectId={projectId}
        currentStep="characters"
        progress={wizard.progress}
        loading={wizard.loading}
        primaryAction={
          wizard.progress.nextStep?.key === "characters" ? { label: "새로운 캐릭터 추가.", onClick: openNew } : undefined
        }
      />
    </div>
  );
}
