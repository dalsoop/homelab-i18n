import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Circle, CircleSlash2, Wand2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { GhostwriterIndicator } from "../components/atelier/GhostwriterIndicator";
import { WizardNextBar } from "../components/atelier/WizardNextBar";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { useProjects } from "../contexts/projects";
import { useChapterMetaList } from "../hooks/useChapterMetaList";
import { useProjectData } from "../hooks/useProjectData";
import { duration, transition } from "../lib/motion";
import { UI_COPY } from "../lib/uiCopy";
import { ApiError, apiJson } from "../services/apiClient";
import { chapterStore } from "../services/chapterStore";
import { computeWizardProgress, setWizardStepSkipped, type WizardStep, type WizardStepKey } from "../services/wizard";
import type { ChapterListItem, Character, LLMPreset, LLMProfile, Outline, ProjectSettings } from "../types";

type OutlineGenChapter = { number: number; title: string; beats: string[] };
type OutlineGenResult = {
  outline_md: string;
  chapters: OutlineGenChapter[];
  raw_output: string;
  parse_error?: { code: string; message: string };
};

type WizardLoaded = {
  settings: ProjectSettings;
  characters: Character[];
  outline: Outline;
  llmPreset: LLMPreset;
  profiles: LLMProfile[];
};

const EMPTY_CHARACTERS: Character[] = [];
const EMPTY_CHAPTERS: ChapterListItem[] = [];
const EMPTY_PROFILES: LLMProfile[] = [];

export function ProjectWizardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const reduceMotion = useReducedMotion();
  const { projects } = useProjects();

  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projectId, projects]);

  const [version, setVersion] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const chapterListQuery = useChapterMetaList(projectId);

  const wizardQuery = useProjectData<WizardLoaded>(projectId, async (id) => {
    const [settingsRes, charsRes, outlineRes, presetRes, profilesRes] = await Promise.all([
      apiJson<{ settings: ProjectSettings }>(`/api/projects/${id}/settings`),
      apiJson<{ characters: Character[] }>(`/api/projects/${id}/characters`),
      apiJson<{ outline: Outline }>(`/api/projects/${id}/outline`),
      apiJson<{ llm_preset: LLMPreset }>(`/api/projects/${id}/llm_preset`),
      apiJson<{ profiles: LLMProfile[] }>(`/api/llm_profiles`),
    ]);
    return {
      settings: settingsRes.data.settings,
      characters: charsRes.data.characters,
      outline: outlineRes.data.outline,
      llmPreset: presetRes.data.llm_preset,
      profiles: profilesRes.data.profiles,
    };
  });

  const refreshWizardData = wizardQuery.refresh;
  const refreshChapters = chapterListQuery.refresh;
  const reload = useCallback(async () => {
    await Promise.all([refreshWizardData(), refreshChapters()]);
  }, [refreshChapters, refreshWizardData]);
  const settings = wizardQuery.data?.settings ?? null;
  const characters = wizardQuery.data?.characters ?? EMPTY_CHARACTERS;
  const outline = wizardQuery.data?.outline ?? null;
  const chapters = (chapterListQuery.chapters as ChapterListItem[]) ?? EMPTY_CHAPTERS;
  const llmPreset = wizardQuery.data?.llmPreset ?? null;
  const profiles = wizardQuery.data?.profiles ?? EMPTY_PROFILES;

  const progress = useMemo(() => {
    void version;
    const selectedProfileId = project?.llm_profile_id ?? null;
    const llmProfile = selectedProfileId ? (profiles.find((p) => p.id === selectedProfileId) ?? null) : null;
    return computeWizardProgress({
      project,
      settings,
      characters,
      outline,
      chapters,
      llmPreset,
      llmProfile,
    });
  }, [project, settings, characters, outline, chapters, llmPreset, profiles, version]);

  const goStep = useCallback(
    (step: WizardStep) => {
      if (!step.href) return;
      navigate(step.href);
    },
    [navigate],
  );

  const setSkipped = useCallback(
    (step: WizardStepKey, skipped: boolean) => {
      if (!projectId) return;
      setWizardStepSkipped(projectId, step, skipped);
      setVersion((v) => v + 1);
    },
    [projectId],
  );

  const scrollToSteps = useCallback(() => {
    const el = document.getElementById("wizard-steps");
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [reduceMotion]);

  const autoOutlineAndChapters = useCallback(async () => {
    if (!projectId) return;
    if (!llmPreset) {
      toast.toastError(`모델 구성 정보가 로드되지 않았습니다. 먼저 다음에서 구성 정보를 로드해 주세요.「${UI_COPY.nav.prompts}」모델 설정을 페이지에 저장합니다.`);
      navigate(`/projects/${projectId}/prompts`);
      return;
    }
    const headers: Record<string, string> = { "X-LLM-Provider": llmPreset.provider };

    const ok = await confirm.confirm({
      title: "자동으로 목차를 생성하고 챕터의 기본 구조를 만들 수 있나요?",
      description: "LLM을 활용하여 개요를 생성하고, 이를 새로운 버전의 개요로 저장한 다음, 각 장의 기본 구조를 설정합니다.",
      confirmText: "시작합니다.",
    });
    if (!ok) return;

    setAutoRunning(true);
    try {
      const outlineGen = await apiJson<OutlineGenResult>(`/api/projects/${projectId}/outline/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requirements: {
            chapter_count: 12,
            tone: "현실적이지만 절제된 가운데도 강렬한 순간들이 있다.",
            pacing: "초반 3장에서는 흥미를 유발하는 요소들을 집중적으로 배치하고, 중간 부분에서는 이야기의 전개를 강화하며, 마지막 부분에서는 예상치 못한 반전을 통해 이야기를 마무리한다.",
          },
          context: {
            include_world_setting: true,
            include_characters: true,
          },
        }),
      });

      const outlineMd = outlineGen.data.outline_md ?? "";
      const genChapters = outlineGen.data.chapters ?? [];
      if (genChapters.length === 0) {
        toast.toastError("개요가 생성되었지만, 장 구조가 자동으로 설정되지 않았습니다. 개요 페이지에서 직접 장 구조를 설정하고 각 장을 만들어 주십시오.");
        navigate(`/projects/${projectId}/outline`);
        return;
      }

      await apiJson<{ outline: Outline }>(`/api/projects/${projectId}/outlines`, {
        method: "POST",
        body: JSON.stringify({
          title: `AI 개요. ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
          content_md: outlineMd,
          structure: { chapters: genChapters },
        }),
      });

      const payload = {
        chapters: genChapters.map((c) => ({
          number: c.number,
          title: c.title,
          plan: (c.beats ?? []).join("；"),
        })),
      };

      try {
        await chapterStore.bulkCreateProjectChapters(projectId, payload);
      } catch (e) {
        const err = e as ApiError;
        if (err.code === "CONFLICT" && err.status === 409) {
          const replaceOk = await confirm.confirm({
            title: "이미 해당 장이 존재합니다. 덮어쓰기를 진행하시겠습니까?",
            description: `현재 개요 아래의 모든 챕터(본문 포함)가 영구적으로 삭제됩니다. 덮어쓰기 기능을 사용하면 이 작업을 되돌릴 수 없습니다./요약, 약 ${chapters.length} 제(章)를 변경할 수 없을 뿐만 아니라, 변경하더라도 되돌릴 수도 없습니다.。`,
            confirmText: "계속해서 덮다.",
            danger: true,
          });
          if (!replaceOk) return;
          const doubleCheckOk = await confirm.confirm({
            title: "마지막으로 확인합니다. 모든 내용을 포함하고 기본 구조를 만들까요?",
            description: "이 작업은 되돌릴 수 없습니다. 이미 작성된 내용을 보존하고 싶으시다면 ‘취소’를 클릭하여 이전 화면으로 돌아가십시오.",
            confirmText: "이미 알고 있습니다. 계속 진행하겠습니다.",
            danger: true,
          });
          if (!doubleCheckOk) return;
          await chapterStore.bulkCreateProjectChapters(projectId, payload, { replace: true });
        } else {
          throw e;
        }
      }

      toast.toastSuccess("개요가 작성되었고 각 장의 기본 구조가 완성되었습니다.");
      navigate(`/projects/${projectId}/writing`);
    } catch (e) {
      const err = e as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setAutoRunning(false);
    }
  }, [chapters.length, confirm, llmPreset, navigate, projectId, toast]);

  if (!projectId) {
    return (
      <div className="panel p-6">
        <div className="font-content text-xl text-ink">프로젝트가 누락되었습니다. ID</div>
        <div className="mt-2 text-sm text-subtext">홈페이지에서 먼저 프로젝트를 선택한 후, 시작 가이드로 이동하세요.。</div>
        <button className="btn btn-secondary mt-4" onClick={() => navigate("/")} type="button">
          홈페이지로 돌아가기.
        </button>
      </div>
    );
  }
  if (wizardQuery.loading) {
    return (
      <div className="panel p-6">
        <div className="text-sm text-subtext">가이드 데이터 로드 중입니다....</div>
      </div>
    );
  }

  const nextStep = progress.nextStep;

  return (
    <div className="grid gap-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="font-content text-xl">공사 시작 안내서.</div>
            <div className="text-xs text-subtext">
              {project ? (
                <>
                  {UI_COPY.nav.currentProject}：<span className="text-ink">{project.name}</span>
                  <span className="mx-2 text-subtext/60">·</span>
                  단계별로 전체 과정을 문제 없이 진행한다.{UI_COPY.nav.projectSettings} → {UI_COPY.nav.characters} → {UI_COPY.nav.prompts} →{" "}
                  {UI_COPY.nav.outline} → {UI_COPY.nav.writing} → {UI_COPY.nav.preview} → {UI_COPY.nav.export}
                </>
              ) : (
                <>
                  단계별로 전체 과정을 문제 없이 진행한다.{UI_COPY.nav.projectSettings} → {UI_COPY.nav.characters} → {UI_COPY.nav.prompts} →{" "}
                  {UI_COPY.nav.outline} → {UI_COPY.nav.writing} → {UI_COPY.nav.preview} → {UI_COPY.nav.export}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={() => void reload()} type="button">
              진행 상황을 업데이트합니다. / 진행 상황을 최신으로 업데이트합니다. / 업데이트 중입니다.
            </button>
            <div className="rounded-atelier border border-border bg-canvas px-3 py-2 text-xs text-subtext">
              {nextStep ? `다음 단계:${nextStep.title}` : "완료되었습니다."}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar ariaLabel="프로젝트 시작 가이드 완료율." value={progress.percent} />
          <div className="mt-2 text-xs text-subtext">완성도:{progress.percent}%</div>
        </div>
      </section>

      <section className="panel p-6">
        <div className="grid gap-1">
          <div className="font-content text-xl">여기서부터 시작하세요.</div>
          <div className="text-xs text-subtext">「단계별 설정(권장)」 또는 「자동 설정(빠른 시작)」을 선택하세요. 필요에 따라 언제든지 설정을 변경할 수 있습니다.。</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="surface p-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <div className="font-content text-base text-ink">단계별로 진행하는 것을 권장합니다.</div>
                <div className="rounded-atelier bg-accent/15 px-2 py-0.5 text-[11px] text-accent">추천합니다.</div>
              </div>
              <div className="text-xs text-subtext">
                순서대로 전체 과정을 거쳐 확인한다.{UI_COPY.nav.projectSettings} → {UI_COPY.nav.characters} → {UI_COPY.nav.prompts} →{" "}
                {UI_COPY.nav.outline} → {UI_COPY.nav.writing} → {UI_COPY.nav.preview} → {UI_COPY.nav.export}
              </div>
              <div className="text-xs text-subtext">{nextStep ? `다음 단계:${nextStep.title}` : "모든 절차가 완료되었습니다."}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStep ? (
                <button className="btn btn-primary" onClick={() => goStep(nextStep)} type="button">
                  다음 단계로 진행합니다.
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate("/")} type="button">
                  프로젝트 개요로 돌아가기.
                </button>
              )}
              <button className="btn btn-secondary" onClick={scrollToSteps} type="button">
                단계별 지침을 확인하세요.
              </button>
            </div>
          </div>
          <div className="surface p-4">
            <div className="grid gap-2">
              <div className="font-content text-base text-ink">빠른 시작 (자동)</div>
              <div className="text-xs text-subtext">한 번의 클릭으로 개요 생성. → 저장. → 장(章)의 기본 구조 만들기. → 글쓰기 페이지로 이동합니다.。</div>
              <div className="text-xs text-subtext">
                먼저 완료하는 것을 권장합니다.「{UI_COPY.nav.projectSettings} / {UI_COPY.nav.prompts}」，생성 실패를 방지하기 위해.。
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                disabled={autoRunning}
                onClick={() => void autoOutlineAndChapters()}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={18} />
                  {autoRunning ? "실행 중..." : "한 번의 클릭으로 바로 시작합니다."}
                </span>
              </button>
              <button className="btn btn-secondary" onClick={scrollToSteps} type="button">
                단계별로 진행하도록 변경합니다.
              </button>
            </div>
          </div>
        </div>
        {autoRunning ? <GhostwriterIndicator className="mt-4" label="모델을 사용하여 개요 및 장별 구조를 생성 중입니다…" /> : null}
      </section>

      <section className="panel p-6" id="wizard-steps">
        <div className="grid gap-1">
          <div className="font-content text-xl">단계별 절차 목록.</div>
          <div className="text-xs text-subtext">위에서부터 아래로 순서대로 진행합니다. 필요 없는 단계는 일단 건너뛰고, 나중에 다시 진행할 수도 있습니다.。</div>
        </div>
        <motion.div
          className="mt-4 grid gap-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduceMotion ? 0 : duration.stagger } },
          }}
        >
          {progress.steps.map((s) => {
            const Icon = s.state === "done" ? CheckCircle2 : s.state === "skipped" ? CircleSlash2 : Circle;
            const badge =
              s.state === "done"
                ? "완료되었습니다."
                : s.state === "skipped"
                  ? "건너뛰었습니다."
                  : progress.nextStep?.key === s.key
                    ? "다음 단계."
                    : "미완성.";
            return (
              <motion.div
                key={s.key}
                className="surface p-4"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
                  show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
                }}
                transition={reduceMotion ? { duration: 0.01 } : transition.base}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={clsx(
                        "shrink-0",
                        s.state === "done" ? "text-success" : s.state === "skipped" ? "text-subtext" : "text-subtext",
                      )}
                      size={18}
                    />
                    <div className="min-w-0 truncate text-sm text-ink">{s.title}</div>
                    <div
                      className={clsx(
                        "shrink-0 rounded-atelier px-2 py-0.5 text-[11px]",
                        s.state === "done"
                          ? "bg-success/15 text-success"
                          : s.state === "skipped"
                            ? "bg-border/60 text-subtext"
                            : progress.nextStep?.key === s.key
                              ? "bg-accent/15 text-accent"
                              : "bg-border/60 text-subtext",
                      )}
                    >
                      {badge}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-subtext">{s.description}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button className="btn btn-secondary" onClick={() => goStep(s)} type="button">
                    향하다, 가다, 향하여 가다.
                  </button>
                  {s.state === "todo" ? (
                    <button
                      className="btn btn-secondary text-subtext"
                      onClick={() => setSkipped(s.key, true)}
                      type="button"
                    >
                      건너뛰다.
                    </button>
                  ) : s.state === "skipped" ? (
                    <button
                      className="btn btn-secondary text-subtext"
                      onClick={() => setSkipped(s.key, false)}
                      type="button"
                    >
                      건너뛰기 기능 해제.
                    </button>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <WizardNextBar
        projectId={projectId}
        currentStep={nextStep?.key ?? "export"}
        progress={progress}
        primaryAction={
          nextStep
            ? {
                label: `다음 단계:${nextStep.title}`,
                onClick: () => goStep(nextStep),
              }
            : {
                label: "완료: 프로젝트 개요 페이지로 돌아가기.",
                onClick: () => navigate("/"),
              }
        }
      />
    </div>
  );
}
