import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { DebugDetails, DebugPageShell } from "../components/atelier/DebugPageShell";
import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { RequestIdBadge } from "../components/ui/RequestIdBadge";
import { useChapterMetaList } from "../hooks/useChapterMetaList";
import { createRequestSeqGuard } from "../lib/requestSeqGuard";
import { ApiError, apiJson } from "../services/apiClient";
import type { ChapterListItem } from "../types";

type ForeshadowOpenLoop = {
  id: string;
  chapter_id: string | null;
  memory_type: string;
  title: string | null;
  importance_score: number;
  story_timeline: number;
  is_foreshadow: boolean;
  resolved_at_chapter_id: string | null;
  content_preview: string;
  updated_at: string | null;
};

type OpenLoopsResponse = { items: ForeshadowOpenLoop[]; has_more: boolean; returned: number };

type OrderKey = "timeline_desc" | "importance_desc" | "updated_desc";

const OPEN_LOOPS_LIMIT_INITIAL = 80;
const OPEN_LOOPS_LIMIT_STEP = 80;
const OPEN_LOOPS_LIMIT_MAX = 200;

function labelForChapter(chapter: ChapterListItem): string {
  const title = String(chapter.title || "").trim();
  return title ? `제.${chapter.number}장(章)${title}` : `제.${chapter.number}장(章)`;
}

export function ForeshadowsPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const titleId = useId();

  const initialResolvedAtChapterId = useMemo(() => searchParams.get("chapterId") || "", [searchParams]);

  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [items, setItems] = useState<ForeshadowOpenLoop[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(OPEN_LOOPS_LIMIT_INITIAL);

  const [searchText, setSearchText] = useState("");
  const [queryText, setQueryText] = useState("");
  const [order, setOrder] = useState<OrderKey>("timeline_desc");

  const [resolvedAtChapterId, setResolvedAtChapterId] = useState<string>("");

  const listGuard = useMemo(() => createRequestSeqGuard(), []);
  const chapterListQuery = useChapterMetaList(projectId);
  const chapters = chapterListQuery.chapters as ChapterListItem[];
  const loadingChapters = !chapterListQuery.hasLoaded && chapterListQuery.loading;

  const fetchOpenLoops = useCallback(async () => {
    if (!projectId) return;
    const seq = listGuard.next();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (queryText.trim()) params.set("q", queryText.trim());
      params.set("order", order);
      const res = await apiJson<OpenLoopsResponse>(
        `/api/projects/${projectId}/story_memories/foreshadows/open_loops?${params.toString()}`,
      );
      if (!listGuard.isLatest(seq)) return;
      setRequestId(res.request_id ?? null);
      setItems(res.data.items ?? []);
      setHasMore(Boolean(res.data.has_more));
    } catch (e) {
      if (!listGuard.isLatest(seq)) return;
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      setRequestId(err.requestId ?? null);
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      if (listGuard.isLatest(seq)) {
        setLoading(false);
      }
    }
  }, [limit, listGuard, order, projectId, queryText, toast]);

  useEffect(() => {
    const guard1 = listGuard;
    return () => {
      guard1.invalidate();
    };
  }, [listGuard]);

  useEffect(() => {
    void fetchOpenLoops();
  }, [fetchOpenLoops]);

  useEffect(() => {
    if (!initialResolvedAtChapterId) return;
    if (!chapters.some((c) => c.id === initialResolvedAtChapterId)) return;
    setResolvedAtChapterId(initialResolvedAtChapterId);
  }, [chapters, initialResolvedAtChapterId]);

  const chapterOptions = useMemo(() => chapters.map((c) => ({ id: c.id, label: labelForChapter(c) })), [chapters]);
  const resolvedChapterLabel = useMemo(() => {
    const found = chapters.find((c) => c.id === resolvedAtChapterId);
    return found ? labelForChapter(found) : null;
  }, [chapters, resolvedAtChapterId]);

  const resolve = useCallback(
    async (foreshadowId: string) => {
      if (!projectId) return;
      const chapterId = resolvedAtChapterId || null;
      const ok = await confirm.confirm({
        title: "앞서 언급된 힌트나 복선이 모두 회수되었나요?",
        description: chapterId
          ? `해당 힌트를 회수된 것으로 표시하고, 회수가 발생한 장을 기록합니다.${resolvedChapterLabel ?? chapterId}）。`
          : "해당 복선.은 처리 완료로 표시하되, 처리 내용에 대한 기록은 남기지 않습니다.",
        confirmText: "재활용 표시.",
        cancelText: "취소하다.",
      });
      if (!ok) return;

      setLoading(true);
      try {
        const res = await apiJson<{ foreshadow: { id: string } }>(
          `/api/projects/${projectId}/story_memories/foreshadows/${foreshadowId}/resolve`,
          {
            method: "POST",
            body: JSON.stringify({ resolved_at_chapter_id: chapterId }),
          },
        );
        setRequestId(res.request_id ?? null);
        setItems((prev) => prev.filter((it) => it.id !== foreshadowId));
        toast.toastSuccess("재활용 처리 완료.", res.request_id ?? undefined);
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        setRequestId(err.requestId ?? null);
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        setLoading(false);
      }
    },
    [confirm, projectId, resolvedAtChapterId, resolvedChapterLabel, toast],
  );

  const submitQuery = useCallback(() => {
    setLimit(OPEN_LOOPS_LIMIT_INITIAL);
    setQueryText(searchText.trim());
  }, [searchText]);

  return (
    <DebugPageShell
      title="복선이 드러나는 시간 순서."
      description={<>회수되지 않은 떡밥 목록.open loops），필터링 기능 지원./정렬 및 마킹을 통한 재활용(선택적으로 관련 장을 연결하여 추적 가능하도록 함).。</>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <RequestIdBadge requestId={requestId} />
          <button className="btn btn-secondary" onClick={() => void fetchOpenLoops()} disabled={loading} type="button">
            {loading ? "새로 고침 중..." : "새로 고침."}
          </button>
        </div>
      }
    >
      <DebugDetails title="도움.">
        <div className="grid gap-1 text-xs text-subtext">
          <div>회수되지 않은 힌트만 표시: 회수됨 (resolved_at_chapter_id != null）목록에 나타나지 않습니다.。</div>
          <div>제안: 재활용하기 전에 ‘재활용할 부분’을 선택하여, 나중에 이야기의 흐름이 어떻게 연결되는지 추적할 때 어느 부분에서 이야기가 마무리되는지 확인할 수 있도록 합니다.。</div>
        </div>
      </DebugDetails>

      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">선별 (제목)/내용)</span>
            <input
              className="input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="키워드를 입력하고 엔터 키를 누르거나 ‘적용’ 버튼을 클릭하세요."
              onKeyDown={(e) => {
                if (e.key === "Enter") submitQuery();
              }}
              aria-label="foreshadows_query"
            />
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => submitQuery()} disabled={loading} type="button">
                응용.
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSearchText("");
                  setQueryText("");
                  setLimit(OPEN_LOOPS_LIMIT_INITIAL);
                }}
                disabled={loading}
                type="button"
              >
                비우다.
              </button>
            </div>
            {queryText ? <div className="text-[11px] text-subtext">현재 필터링 조건:{queryText}</div> : null}
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">정렬하다.</span>
            <select
              className="select"
              value={order}
              onChange={(e) => {
                setLimit(OPEN_LOOPS_LIMIT_INITIAL);
                setOrder((e.target.value as OrderKey) || "timeline_desc");
              }}
              aria-label="foreshadows_order"
            >
              <option value="timeline_desc">시간 순서대로 (최신순에서 오래된 순서대로).</option>
              <option value="importance_desc">중요도에 따라 (높은 것부터 낮은 순서대로).</option>
              <option value="updated_desc">최신순으로 (가장 최근부터 오래된 순서대로)</option>
            </select>
            <div className="text-[11px] text-subtext">정렬 작업은 서버 측에서 처리됩니다.。</div>
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">이전 장(챕터)으로 돌아가기 (선택 사항, 이전 단계로 되돌릴 때 사용).</span>
          <select
            className="select"
            value={resolvedAtChapterId}
            onChange={(e) => setResolvedAtChapterId(e.target.value)}
            disabled={loadingChapters || chapterOptions.length === 0}
            aria-label="foreshadows_resolve_chapter_id"
          >
            <option value="">관련 없는 장(章)</option>
            {chapterOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {chapterOptions.length === 0 ? (
            <div className="text-[11px] text-subtext">아직 챕터가 생성되지 않았거나 목차 구성이 완료되지 않았습니다. 하지만 챕터와 연결하지 않고도 바로 회수할 수 있습니다.。</div>
          ) : null}
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-subtext" aria-labelledby={titleId}>
        <div id={titleId}>
          회수되지 않음:{items.length}
          {hasMore ? "(내용이 잘림)" : ""}
        </div>
        <div className="flex items-center gap-2">
          {hasMore ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setLimit((prev) =>
                  prev >= OPEN_LOOPS_LIMIT_MAX ? prev : Math.min(OPEN_LOOPS_LIMIT_MAX, prev + OPEN_LOOPS_LIMIT_STEP),
                );
              }}
              disabled={loading || limit >= OPEN_LOOPS_LIMIT_MAX}
              type="button"
              aria-label="foreshadows_load_more"
            >
              {limit >= OPEN_LOOPS_LIMIT_MAX ? "최대치에 도달했습니다." : "더 불러오기."}
            </button>
          ) : null}
          {loading ? <div>불러오는 중입니다....</div> : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-atelier border border-border bg-surface p-4 text-sm text-subtext">아직 회수되지 않은 복선이 없습니다.。</div>
      ) : (
        <div className="grid gap-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-atelier border border-border bg-surface p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{it.title || "제목 없음."}</div>
                  <div className="mt-1 text-[11px] text-subtext">
                    chapter_id:{it.chapter_id || "-"} | score:{String(it.importance_score ?? 0)} | timeline:
                    {String(it.story_timeline ?? 0)}
                    {it.updated_at ? ` | updated:${it.updated_at}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="btn btn-secondary"
                    disabled={!it.chapter_id}
                    onClick={() => navigate(`/projects/${projectId}/writing?chapterId=${it.chapter_id}`)}
                    type="button"
                  >
                    해당 장으로 이동.
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={!it.chapter_id}
                    onClick={() => navigate(`/projects/${projectId}/chapter-analysis?chapterId=${it.chapter_id}`)}
                    type="button"
                  >
                    주석 페이지.
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={loading}
                    onClick={() => void resolve(it.id)}
                    type="button"
                  >
                    재활용 표시.
                  </button>
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-xs text-subtext">{it.content_preview || "(초록 없음)"}</div>
            </div>
          ))}
        </div>
      )}
    </DebugPageShell>
  );
}
