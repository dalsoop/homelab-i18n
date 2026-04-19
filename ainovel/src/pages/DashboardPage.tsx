import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "../components/ui/Modal";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { useProjects } from "../contexts/projects";
import { duration, transition } from "../lib/motion";
import { UI_COPY } from "../lib/uiCopy";
import { ApiError, apiJson } from "../services/apiClient";
import { computeWizardProgressFromSummary } from "../services/wizard";
import type { Project, ProjectSummaryItem } from "../types";

type CreateProjectForm = {
  name: string;
  genre: string;
  logline: string;
};

export function DashboardPage() {
  const { projects, loading, error, refresh } = useProjects();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateProjectForm>({ name: "", genre: "", logline: "" });

  const sorted = useMemo(() => [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at)), [projects]);
  const recommendedProject = sorted[0] ?? null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "밤이 깊었다.";
    if (hour < 12) return "안녕하세요.";
    if (hour < 18) return "안녕하세요.";
    return "안녕하세요.";
  }, []);

  type WizardSummary = { percent: number; nextTitle: string | null; nextHref: string | null };
  const [wizardByProjectId, setWizardByProjectId] = useState<Record<string, WizardSummary>>({});
  const [wizardLoadingByProjectId, setWizardLoadingByProjectId] = useState<Record<string, boolean>>({});
  const recommendedWizard = recommendedProject ? wizardByProjectId[recommendedProject.id] : null;
  const recommendedWizardLoading = recommendedProject
    ? Boolean(wizardLoadingByProjectId[recommendedProject.id])
    : false;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (sorted.length === 0) {
        setWizardByProjectId({});
        setWizardLoadingByProjectId({});
        return;
      }

      setWizardLoadingByProjectId(Object.fromEntries(sorted.map((p) => [p.id, true])));
      try {
        const res = await apiJson<{ items: ProjectSummaryItem[] }>(`/api/projects/summary`);
        if (cancelled) return;

        const summaryByProjectId = Object.fromEntries(res.data.items.map((it) => [it.project.id, it]));
        const nextWizardByProjectId: Record<string, WizardSummary> = {};
        for (const p of sorted) {
          const summary = summaryByProjectId[p.id];
          if (!summary) continue;
          const progress = computeWizardProgressFromSummary({
            project: summary.project,
            settings: summary.settings,
            characters_count: summary.characters_count,
            outline_content_md: summary.outline_content_md,
            chapters_total: summary.chapters_total,
            chapters_done: summary.chapters_done,
            llm_preset: summary.llm_preset,
            llm_profile_has_api_key: summary.llm_profile_has_api_key,
          });

          nextWizardByProjectId[p.id] = {
            percent: progress.percent,
            nextTitle: progress.nextStep?.title ?? null,
            nextHref: progress.nextStep?.href ?? null,
          };
        }
        setWizardByProjectId(nextWizardByProjectId);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setWizardLoadingByProjectId(Object.fromEntries(sorted.map((p) => [p.id, false])));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sorted]);

  const enterProject = useCallback(
    (p: Project) => {
      const w = wizardByProjectId[p.id];
      if (!w) {
        navigate(`/projects/${p.id}/wizard`);
        return;
      }
      navigate(w.percent >= 100 ? `/projects/${p.id}/writing` : `/projects/${p.id}/wizard`);
    },
    [navigate, wizardByProjectId],
  );

  type PrimaryCta = { label: string; onClick: () => void; disabled?: boolean; ariaLabel: string };
  const primaryCta: PrimaryCta = useMemo(() => {
    if (!recommendedProject) {
      return {
        label: "첫 번째 프로젝트를 생성합니다.",
        onClick: () => setCreateOpen(true),
        ariaLabel: "첫 번째 프로젝트 만들기 (대시보드_기본_생성)",
      };
    }

    if (recommendedWizardLoading) {
      return { label: "불러오는 중...", onClick: () => {}, disabled: true, ariaLabel: "로드 중 (대시보드 기본 정보 로딩 중)" };
    }

    const wizard = recommendedWizard;
    if (wizard && wizard.percent >= 100) {
      return {
        label: "계속해서 글을 쓰세요.",
        onClick: () => navigate(`/projects/${recommendedProject.id}/writing`),
        ariaLabel: "글쓰기를 계속합니다. (or 글쓰기를 이어갑니다.)",
      };
    }

    const nextHref = wizard?.nextHref;
    if (wizard && nextHref) {
      return {
        label: wizard.nextTitle ? `继续：${wizard.nextTitle}` : "공사를 계속 진행한다.",
        onClick: () => navigate(nextHref),
        ariaLabel: "다음 단계로 진행합니다. (다음 단계로)",
      };
    }

    return {
      label: "최근 프로젝트 열기.",
      onClick: () => enterProject(recommendedProject),
      ariaLabel: "최근 프로젝트 열기 (대시보드 기본 기능)",
    };
  }, [enterProject, navigate, recommendedProject, recommendedWizard, recommendedWizardLoading]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-content text-3xl text-ink">{greeting}，欢迎回来</div>
          <div className="mt-1 text-sm text-subtext">
            {recommendedProject
              ? `继续「${recommendedProject.name}」的创作，或从下方选择其他项目。`
              : "첫 번째 프로젝트를 시작하는 것부터 시작하세요."}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={primaryCta.onClick}
          disabled={primaryCta.disabled}
          aria-label={primaryCta.ariaLabel}
          type="button"
        >
          {primaryCta.label}
        </button>
      </div>
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: reduceMotion ? 0 : duration.stagger },
          },
        }}
      >
        <button
          className="panel-interactive ui-focus-ring group relative flex min-h-[180px] flex-col items-center justify-center gap-2 border-dashed p-5 text-center"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <div className="font-content text-2xl text-ink">+</div>
          <div className="text-sm text-subtext">新建项目</div>
        </button>

        <div className="panel p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-content text-xl text-ink">推荐流程</div>
              <div className="mt-1 text-xs text-subtext">
                {recommendedProject ? `基于最近项目「${recommendedProject.name}」：` : "프로젝트를 생성한 후, 다음 단계로 바로 진행할 수 있습니다."}
              </div>
            </div>
            {recommendedProject ? (
              <button
                className="btn btn-ghost px-3 py-2 text-xs"
                onClick={() => enterProject(recommendedProject)}
                aria-label="최근 프로젝트 계속하기 (dashboard_continue_latest)"
                type="button"
              >
                继续
              </button>
            ) : null}
          </div>
          {recommendedProject ? (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button
                  className="btn btn-secondary justify-start"
                  onClick={() => navigate(`/projects/${recommendedProject.id}/settings`)}
                  aria-label="프로젝트 설정 (대시보드 추천 설정)"
                  type="button"
                >
                  项目设置
                </button>
                <button
                  className="btn btn-secondary justify-start"
                  onClick={() => navigate(`/projects/${recommendedProject.id}/wizard`)}
                  aria-label="시작 가이드 (대시보드 추천 마법사)"
                  type="button"
                >
                  开工向导
                </button>
                <button
                  className="btn btn-secondary justify-start"
                  onClick={() => navigate(`/projects/${recommendedProject.id}/writing`)}
                  aria-label="글쓰기 (글쓰기)"
                  type="button"
                >
                  写作
                </button>
              </div>

              {recommendedWizardLoading ? (
                <div className="mt-3 text-xs text-subtext">计算完成度...</div>
              ) : recommendedWizard ? (
                <div className="mt-3 rounded-atelier border border-border bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-subtext">
                    <div>完成度：{recommendedWizard.percent}%</div>
                    <div className="truncate">
                      {recommendedWizard.nextTitle ? `下一步：${recommendedWizard.nextTitle}` : "완료되었습니다."}
                    </div>
                  </div>
                  <ProgressBar ariaLabel="추천 절차 완료율." className="mt-2" value={recommendedWizard.percent} />
                  {recommendedWizard.nextHref ? (
                    <button
                      className="btn btn-primary mt-3 w-full"
                      onClick={() => navigate(recommendedWizard.nextHref ?? "")}
                      type="button"
                    >
                      {recommendedWizard.nextTitle ? `继续：${recommendedWizard.nextTitle}` : "계속하세요. / 계속 진행하세요. / 계속합니다. (문맥에 따라 적절하게 선택)"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 grid gap-2">
              <div className="text-xs text-subtext">建议流程：</div>
              <ol className="list-decimal pl-5 text-xs text-subtext">
                <li>新建项目</li>
                <li>项目设置：补齐世界观/风格/约束</li>
                <li>模型配置：保存并测试连接</li>
                <li>大纲 → 写作 → 预览/导出</li>
              </ol>
              <div className="mt-1 text-xs text-subtext">提示：也可以先新建项目，再从“推荐流程”一键进入下一步。</div>
              <button className="btn btn-secondary mt-2 w-full" onClick={() => setCreateOpen(true)} type="button">
                打开创建项目
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="panel p-6">
            <div className="skeleton h-5 w-40" />
            <div className="mt-3 grid gap-2">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-3 w-52" />
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-border/60">
              <div className="skeleton h-2 w-1/3 rounded-full" />
            </div>
          </div>
        ) : null}

        {!loading && projects.length === 0 && error ? (
          <div className="panel p-6">
            <div className="font-content text-xl text-ink">项目加载失败</div>
            <div className="mt-2 text-sm text-subtext">{error.message}</div>
            {error.requestId ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-subtext">
                <span className="truncate">
                  {UI_COPY.common.requestIdLabel}: <span className="font-mono">{error.requestId}</span>
                </span>
                <button
                  className="btn btn-ghost px-2 py-1 text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(error.requestId ?? "");
                  }}
                  type="button"
                >
                  {UI_COPY.common.copy}
                </button>
              </div>
            ) : null}
            <button className="btn btn-secondary mt-4" onClick={() => void refresh()} type="button">
              重试
            </button>
          </div>
        ) : null}

        {sorted.map((p) => {
          const wizard = wizardByProjectId[p.id];
          const wizardLoading = wizardLoadingByProjectId[p.id];
          return (
            <motion.div
              key={p.id}
              className="panel-interactive group relative flex min-h-[180px] flex-col overflow-hidden p-5 text-left"
              initial="hidden"
              animate="show"
              variants={{
                hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
                show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
              }}
              transition={reduceMotion ? { duration: 0.01 } : transition.base}
              whileHover={reduceMotion ? undefined : { y: -2, transition: transition.fast }}
              whileTap={reduceMotion ? undefined : { y: 0, scale: 0.98, transition: transition.fast }}
              onClick={() => enterProject(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  enterProject(p);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-border/55" />
              <div className="pointer-events-none absolute inset-y-0 left-3 w-8 bg-gradient-to-r from-border/25 to-transparent" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-content text-xl text-ink">{p.name}</div>
                  <div className="mt-1 text-xs text-subtext">{p.genre ? `类型：${p.genre}` : "유형이 입력되지 않았습니다."}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="btn btn-secondary px-3 py-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${p.id}/wizard`);
                    }}
                    type="button"
                  >
                    向导
                  </button>
                  <button
                    className="btn btn-ghost px-3 py-2 text-xs text-accent hover:bg-accent/10"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm.confirm({
                        title: "항목을 삭제하시겠습니까?",
                        description: "이 작업은 해당 프로젝트와 관련된 설정, 캐릭터, 챕터, 생성 기록 등을 모두 삭제하며, 삭제된 내용은 복구할 수 없습니다.",
                        confirmText: "삭제하다.",
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        const res = await apiJson<Record<string, never>>(`/api/projects/${p.id}`, { method: "DELETE" });
                        await refresh();
                        toast.toastSuccess("삭제됨.");
                        return res;
                      } catch (e) {
                        const err = e as ApiError;
                        toast.toastError(`${err.message} (${err.code})`, err.requestId);
                      }
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="mt-3 flex-1">
                {p.logline ? <div className="line-clamp-5 text-sm text-subtext">{p.logline}</div> : null}
              </div>

              <div className="mt-4">
                {wizardLoading ? (
                  <div className="text-xs text-subtext">计算完成度...</div>
                ) : wizard ? (
                  <>
                    <div className="flex items-center justify-between gap-3 text-xs text-subtext">
                      <div>完成度：{wizard.percent}%</div>
                      <div className="truncate">{wizard.nextTitle ? `下一步：${wizard.nextTitle}` : "완료되었습니다."}</div>
                    </div>
                    <ProgressBar ariaLabel={`${p.name} 完成度`} className="mt-2" value={wizard.percent} />
                  </>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        panelClassName="surface max-w-lg p-6"
        ariaLabel="프로젝트 생성하기."
      >
        <div className="font-content text-2xl text-ink">创建项目</div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">项目名</span>
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">类型（可选）</span>
            <input
              className="input"
              name="genre"
              value={form.genre}
              onChange={(e) => setForm((v) => ({ ...v, genre: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">一句话梗概（可选）</span>
            <textarea
              className="textarea"
              name="logline"
              rows={3}
              value={form.logline}
              onChange={(e) => setForm((v) => ({ ...v, logline: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)} type="button">
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={creating || !form.name.trim()}
            onClick={async () => {
              setCreating(true);
              try {
                const res = await apiJson<{ project: Project }>("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({
                    name: form.name.trim(),
                    genre: form.genre.trim() || undefined,
                    logline: form.logline.trim() || undefined,
                  }),
                });
                await refresh();
                toast.toastSuccess("생성 완료.");
                setCreateOpen(false);
                setForm({ name: "", genre: "", logline: "" });
                navigate(`/projects/${res.data.project.id}/settings`);
              } catch (e) {
                const err = e as ApiError;
                toast.toastError(`${err.message} (${err.code})`, err.requestId);
              } finally {
                setCreating(false);
              }
            }}
            type="button"
          >
            创建
          </button>
        </div>
      </Modal>
    </div>
  );
}
