import clsx from "clsx";
import { BookOpen, ChevronLeft, Edit3, List, StickyNote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { WizardNextBar } from "../components/atelier/WizardNextBar";
import { PaperContent } from "../components/layout/AppShell";
import { ChapterVirtualList } from "../components/writing/ChapterVirtualList";
import { Drawer } from "../components/ui/Drawer";
import { useChapterDetail } from "../hooks/useChapterDetail";
import { useChapterMetaList } from "../hooks/useChapterMetaList";
import { useWizardProgress } from "../hooks/useWizardProgress";
import { chapterStore } from "../services/chapterStore";
import { markWizardPreviewSeen } from "../services/wizard";
import type { ChapterListItem } from "../types";

function humanizeChapterStatusZh(status: string): string {
  const s = String(status || "").trim();
  if (s === "planned") return "계획 중입니다.";
  if (s === "drafting") return "초안.";
  if (s === "done") return "최종본.";
  return s || "알 수 없음.";
}

export function PreviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { bumpLocal, loading: wizardLoading, progress: wizardProgress } = useWizardProgress(projectId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [onlyDone, setOnlyDone] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    markWizardPreviewSeen(projectId);
    bumpLocal();
  }, [bumpLocal, projectId]);

  const chapterListQuery = useChapterMetaList(projectId);
  const chapters = chapterListQuery.chapters as ChapterListItem[];
  const sortedChapters = useMemo(() => [...chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [chapters]);
  const doneCount = useMemo(
    () => sortedChapters.reduce((acc, c) => acc + (c.status === "done" ? 1 : 0), 0),
    [sortedChapters],
  );
  const visibleChapters = useMemo(() => {
    if (!onlyDone) return sortedChapters;
    return sortedChapters.filter((c) => c.status === "done");
  }, [onlyDone, sortedChapters]);

  const effectiveActiveId = useMemo(() => {
    if (activeId && visibleChapters.some((c) => c.id === activeId)) return activeId;
    return visibleChapters[0]?.id ?? null;
  }, [activeId, visibleChapters]);

  const activeIndex = useMemo(() => {
    if (!effectiveActiveId) return -1;
    return visibleChapters.findIndex((c) => c.id === effectiveActiveId);
  }, [effectiveActiveId, visibleChapters]);

  const activeChapterMeta = useMemo(() => {
    if (activeIndex < 0) return null;
    return visibleChapters[activeIndex] ?? null;
  }, [activeIndex, visibleChapters]);

  const prevChapter = useMemo(() => {
    if (activeIndex <= 0) return null;
    return visibleChapters[activeIndex - 1] ?? null;
  }, [activeIndex, visibleChapters]);

  const nextChapter = useMemo(() => {
    if (activeIndex < 0) return null;
    if (activeIndex >= visibleChapters.length - 1) return null;
    return visibleChapters[activeIndex + 1] ?? null;
  }, [activeIndex, visibleChapters]);

  const openEditor = (chapterId: string) => {
    if (!projectId) return;
    navigate(`/projects/${projectId}/writing?chapterId=${encodeURIComponent(chapterId)}`);
  };

  const openReader = (chapterId: string) => {
    if (!projectId) return;
    navigate(`/projects/${projectId}/reader?chapterId=${encodeURIComponent(chapterId)}`);
  };

  const openChapter = useCallback((chapterId: string) => {
    setActiveId(chapterId);
    setMobileListOpen(false);
  }, []);

  const { chapter: activeChapter, loading: loadingChapter } = useChapterDetail(effectiveActiveId, {
    enabled: Boolean(effectiveActiveId),
  });
  const activeChapterSummary = activeChapter ?? activeChapterMeta;

  useEffect(() => {
    if (prevChapter) void chapterStore.prefetchChapterDetail(prevChapter.id);
    if (nextChapter) void chapterStore.prefetchChapterDetail(nextChapter.id);
  }, [nextChapter, prevChapter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const activeEl = document.activeElement;
      const isTypingTarget =
        activeEl instanceof HTMLElement &&
        (activeEl.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName));
      if (isTypingTarget) return;

      if (e.key === "ArrowLeft" && prevChapter) {
        e.preventDefault();
        openChapter(prevChapter.id);
        return;
      }
      if (e.key === "ArrowRight" && nextChapter) {
        e.preventDefault();
        openChapter(nextChapter.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextChapter, openChapter, prevChapter]);

  const list = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="inline-flex items-center gap-2 text-sm text-ink">
          <BookOpen size={16} />
          {"장(장)"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={clsx("btn btn-ghost px-2 py-1 text-xs", onlyDone ? "text-accent" : "text-subtext")}
            onClick={() => setOnlyDone((v) => !v)}
            type="button"
          >
            {onlyDone ? "전체 내용 표시." : "최종본만 확인합니다."}
          </button>
          <span className="text-[11px] text-subtext">
            {doneCount}/{sortedChapters.length} {"최종본 확정."}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-2">
        <ChapterVirtualList
          chapters={visibleChapters}
          activeId={effectiveActiveId}
          ariaLabel="목차."
          className="h-full"
          emptyState={
            sortedChapters.length === 0 ? (
              <div className="p-3 text-sm text-subtext">{"아직 챕터가 없습니다."}</div>
            ) : (
              <div className="p-3 text-sm text-subtext">{"아직 확정된 내용은 없습니다."}</div>
            )
          }
          getStatusLabel={(chapter) => humanizeChapterStatusZh(chapter.status)}
          onSelectChapter={openChapter}
          variant="card"
        />
      </div>
    </div>
  );

  if (!chapterListQuery.hasLoaded && chapterListQuery.loading) return <div className="text-subtext">불러오는 중입니다....</div>;

  return (
    <PaperContent className="grid gap-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => navigate("/")} type="button">
            <ChevronLeft size={16} />
            홈페이지로 돌아가기.
          </button>
          <button
            className="btn btn-secondary"
            disabled={!projectId}
            onClick={() => (projectId ? navigate(`/projects/${projectId}/writing`) : undefined)}
            type="button"
          >
            <ChevronLeft size={16} />
            글쓰기로 돌아가기.
          </button>
          <button className="btn btn-secondary lg:hidden" onClick={() => setMobileListOpen(true)} type="button">
            <List size={16} />
            목차.
          </button>
          <button
            className="btn btn-secondary hidden lg:inline-flex"
            onClick={() => setCollapsed((v) => !v)}
            type="button"
          >
            <List size={16} />
            {collapsed ? "목차 보기." : "숨겨진 챕터 목록."}
          </button>

          <button
            className="btn btn-secondary"
            disabled={!prevChapter}
            onClick={() => (prevChapter ? openChapter(prevChapter.id) : undefined)}
            type="button"
          >
            이전 장.
          </button>
          <button
            className="btn btn-secondary"
            disabled={!nextChapter}
            onClick={() => (nextChapter ? openChapter(nextChapter.id) : undefined)}
            type="button"
          >
            다음 장.
          </button>
          <span className="text-[11px] text-subtext">단축키:← / →</span>
        </div>

        <div className="min-w-0 truncate text-xs text-subtext">
          {activeChapterSummary ? `현재 미리보기: 제[숫자]장. ${activeChapterSummary.number} 장(장)` : "장을 선택하세요."}
        </div>

        {activeChapterSummary ? (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={() => openReader(activeChapterSummary.id)} type="button">
              <StickyNote size={16} />
              주석을 읽어 보세요.
            </button>
            <button className="btn btn-secondary" onClick={() => openEditor(activeChapterSummary.id)} type="button">
              <Edit3 size={16} />
              편집하다.
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-4">
        {!collapsed ? (
          <aside className="hidden w-[280px] shrink-0 lg:block">
            <div className="panel h-[calc(100vh-260px)] min-h-[520px] overflow-hidden">{list}</div>
          </aside>
        ) : null}

        <section className="min-w-0 flex-1">
          <div className="panel p-8">
            {activeChapterSummary ? (
              <>
                <div className="mb-4">
                  <div className="font-content text-2xl text-ink">
                    제. {activeChapterSummary.number} 장(장)
                    {activeChapterSummary.title?.trim() ? ` · ${activeChapterSummary.title}` : ""}
                  </div>
                  {activeChapterSummary.status !== "done" ? (
                    <div className="mt-1 text-xs text-subtext">
                      참고: 이 장의 상태는 다음과 같습니다. {humanizeChapterStatusZh(activeChapterSummary.status)}，가이드가 안내해 드릴 것입니다.{" "}
                      {humanizeChapterStatusZh("done")} “작성 완료” 여부 판단 기준.。
                    </div>
                  ) : null}
                </div>
                <div className="atelier-content mx-auto max-w-4xl text-ink">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {loadingChapter ? "_(loading...)_" : activeChapter?.content_md || "(공)"}
                  </ReactMarkdown>
                </div>
              </>
            ) : (
              <div className="text-subtext">아직 미리보기 내용이 없습니다.</div>
            )}
          </div>
        </section>
      </div>

      <Drawer
        open={mobileListOpen}
        onClose={() => setMobileListOpen(false)}
        side="bottom"
        overlayClassName="lg:hidden"
        ariaLabel="목차."
        panelClassName="flex h-[85vh] w-full flex-col overflow-hidden rounded-atelier border border-border bg-surface shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm text-ink">목차.</div>
          <button className="btn btn-secondary" onClick={() => setMobileListOpen(false)} type="button">
            <ChevronLeft size={16} />
            닫기.
          </button>
        </div>
        <div className="min-h-0 flex-1">{list}</div>
      </Drawer>

      <WizardNextBar projectId={projectId} currentStep="preview" progress={wizardProgress} loading={wizardLoading} />
    </PaperContent>
  );
}
