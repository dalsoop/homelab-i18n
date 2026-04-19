import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { DebugDetails, DebugPageShell } from "../components/atelier/DebugPageShell";
import { GhostwriterIndicator } from "../components/atelier/GhostwriterIndicator";
import { useToast } from "../components/ui/toast";
import { createRequestSeqGuard } from "../lib/requestSeqGuard";
import { ApiError, apiJson, sanitizeFilename } from "../services/apiClient";
import { getImportProposalDisabledReason, mergeImportDocuments, type ImportDocument } from "./importState";

type ImportDocumentDetail = {
  document: ImportDocument;
  content_preview: string;
  vector_ingest_result: unknown;
  worldbook_proposal: unknown;
  story_memory_proposal: unknown;
};

type ImportChunk = {
  id: string;
  chunk_index: number;
  preview: string;
  vector_chunk_id: string | null;
};

type ProposalPreview = {
  summary: string;
  sampleTitles: string[];
  keys: string[];
};

function humanizeStatus(status: string): string {
  const s = (status || "").trim().toLowerCase();
  if (s === "queued") return "줄 서는 중입니다.";
  if (s === "running") return "처리 중.";
  if (s === "done") return "완료되었습니다.";
  if (s === "failed") return "실패.";
  return status || "unknown";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

export function ImportPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [listLoading, setListLoading] = useState(false);
  const [documents, setDocuments] = useState<ImportDocument[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ImportDocumentDetail | null>(null);

  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunks, setChunks] = useState<ImportChunk[]>([]);

  const [applyWorldbookLoading, setApplyWorldbookLoading] = useState(false);
  const [applyStoryMemoryLoading, setApplyStoryMemoryLoading] = useState(false);

  const [pollPaused, setPollPaused] = useState(false);

  const autoOpenedDocIdRef = useRef<string | null>(null);
  const lastPolledRef = useRef<{ id: string; status: string } | null>(null);
  const listGuardRef = useRef(createRequestSeqGuard());
  const detailGuardRef = useRef(createRequestSeqGuard());

  const selectedDoc = useMemo(() => {
    if (!selectedId) return null;
    const d = documents.find((x) => x.id === selectedId) ?? null;
    return d;
  }, [documents, selectedId]);

  const statusDoc = useMemo(() => selectedDoc ?? detail?.document ?? null, [detail?.document, selectedDoc]);
  const proposalPreview = useMemo(() => {
    const summarize = (value: unknown, arrayKeys: string[]): ProposalPreview => {
      if (value == null) return { summary: "(공)", sampleTitles: [], keys: [] };
      if (Array.isArray(value)) {
        const sampleTitles = value
          .map((it) => {
            if (!it || typeof it !== "object") return "";
            const o = it as Record<string, unknown>;
            const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
            return title.trim();
          })
          .filter(Boolean)
          .slice(0, 8);
        return { summary: `array(${value.length})`, sampleTitles, keys: [] };
      }
      if (typeof value !== "object") return { summary: String(value), sampleTitles: [], keys: [] };
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      for (const key of arrayKeys) {
        const arr = obj[key];
        if (!Array.isArray(arr)) continue;
        const sampleTitles = arr
          .map((it) => {
            if (!it || typeof it !== "object") return "";
            const o = it as Record<string, unknown>;
            const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
            return title.trim();
          })
          .filter(Boolean)
          .slice(0, 8);
        return { summary: `${key}: ${arr.length}`, sampleTitles, keys };
      }
      return {
        summary: keys.length ? `keys: ${keys.slice(0, 8).join(", ")}${keys.length > 8 ? "…" : ""}` : "(empty)",
        sampleTitles: [],
        keys,
      };
    };

    return {
      worldbook: summarize(detail?.worldbook_proposal, ["entries", "worldbook_entries", "items"]),
      storyMemory: summarize(detail?.story_memory_proposal, ["memories", "items", "records"]),
    };
  }, [detail?.story_memory_proposal, detail?.worldbook_proposal]);

  const pollStatus = String(selectedDoc?.status ?? detail?.document.status ?? "")
    .trim()
    .toLowerCase();
  const shouldPoll = !pollPaused && (pollStatus === "queued" || pollStatus === "running");
  const lastUpdateMs = useMemo(() => {
    const raw = statusDoc?.updated_at || statusDoc?.created_at || "";
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }, [statusDoc?.created_at, statusDoc?.updated_at]);
  const lastUpdateAgoMs = useMemo(() => {
    if (!lastUpdateMs) return null;
    return Date.now() - lastUpdateMs;
  }, [lastUpdateMs]);
  const isPollingStalled = useMemo(() => {
    if (pollStatus !== "queued" && pollStatus !== "running") return false;
    if (lastUpdateAgoMs == null) return false;
    return lastUpdateAgoMs >= 5 * 60_000;
  }, [lastUpdateAgoMs, pollStatus]);
  const proposalDisabledReason = useMemo(() => {
    if (!detail) return "먼저 가져올 기록을 하나 선택하세요.";
    return getImportProposalDisabledReason(statusDoc?.status ?? detail.document.status);
  }, [detail, statusDoc?.status]);

  useEffect(() => {
    const listGuard = listGuardRef.current;
    const detailGuard = detailGuardRef.current;
    return () => {
      listGuard.invalidate();
      detailGuard.invalidate();
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!projectId) return;
    const seq = listGuardRef.current.next();
    setListLoading(true);
    try {
      const res = await apiJson<{ documents: ImportDocument[] }>(`/api/projects/${projectId}/imports`);
      if (!listGuardRef.current.isLatest(seq)) return;
      const documents = Array.isArray(res.data.documents) ? res.data.documents : [];
      setDocuments((prev) => mergeImportDocuments(prev, documents));
    } catch (e) {
      if (!listGuardRef.current.isLatest(seq)) return;
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      if (listGuardRef.current.isLatest(seq)) setListLoading(false);
    }
  }, [projectId, toast]);

  const selectDocAndLoad = useCallback(
    async (docId: string) => {
      if (!projectId) return;
      const id = String(docId || "").trim();
      if (!id) return;
      const seq = detailGuardRef.current.next();
      setPollPaused(false);
      setSelectedId(id);
      setChunks([]);
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await apiJson<ImportDocumentDetail>(`/api/projects/${projectId}/imports/${encodeURIComponent(id)}`);
        if (!detailGuardRef.current.isLatest(seq)) return;
        setDetail(res.data);
        setDocuments((prev) => mergeImportDocuments(prev, [res.data.document]));
      } catch (e) {
        if (!detailGuardRef.current.isLatest(seq)) return;
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        if (detailGuardRef.current.isLatest(seq)) setDetailLoading(false);
      }
    },
    [projectId, toast],
  );

  const retryImport = useCallback(
    async (docId: string) => {
      if (!projectId) return;
      const id = String(docId || "").trim();
      if (!id) return;
      try {
        const res = await apiJson<{ document: ImportDocument }>(
          `/api/projects/${projectId}/imports/${encodeURIComponent(id)}/retry`,
          { method: "POST", body: JSON.stringify({}) },
        );
        toast.toastSuccess("이미 가져오기를 다시 시도했습니다.", res.request_id);
        setDocuments((prev) => mergeImportDocuments(prev, [res.data.document]));
        setSelectedId(res.data.document.id);
        await Promise.all([loadList(), selectDocAndLoad(res.data.document.id)]);
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [loadList, projectId, selectDocAndLoad, toast],
  );

  const loadChunks = useCallback(async () => {
    if (!projectId) return;
    if (!selectedId) return;
    if (chunksLoading) return;
    setChunksLoading(true);
    try {
      const res = await apiJson<{ chunks: ImportChunk[] }>(
        `/api/projects/${projectId}/imports/${encodeURIComponent(selectedId)}/chunks?limit=200`,
      );
      setChunks(Array.isArray(res.data.chunks) ? res.data.chunks : []);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setChunksLoading(false);
    }
  }, [chunksLoading, projectId, selectedId, toast]);

  const createImport = useCallback(async () => {
    if (!projectId) return;
    if (!file) return;
    if (creating) return;

    const safeName = sanitizeFilename(file.name) || "import.txt";
    const contentType =
      safeName.toLowerCase().endsWith(".md") || safeName.toLowerCase().endsWith(".markdown") ? "md" : "txt";
    const maxBytes = 5_000_000;
    if (file.size > maxBytes) {
      toast.toastError(
        `파일 크기가 너무 큽니다.${Math.ceil(file.size / 1024)} KB（최대치, 상한, 한계치. ${Math.ceil(maxBytes / 1024)} KB）`,
        "client",
      );
      return;
    }

    setCreating(true);
    try {
      const contentText = await file.text();
      const res = await apiJson<{ document: ImportDocument; job_id: string | null }>(
        `/api/projects/${projectId}/imports`,
        {
          method: "POST",
          body: JSON.stringify({ filename: safeName, content_text: contentText, content_type: contentType }),
          timeoutMs: 180_000,
        },
      );
      toast.toastSuccess("가져오기 작업이 제출되었습니다.", res.request_id);
      setDocuments((prev) => mergeImportDocuments(prev, [res.data.document]));
      await Promise.all([loadList(), selectDocAndLoad(res.data.document.id)]);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setCreating(false);
    }
  }, [creating, file, loadList, projectId, selectDocAndLoad, toast]);

  const applyWorldbook = useCallback(async () => {
    if (!projectId) return;
    if (!detail) return;
    if (applyWorldbookLoading) return;
    setApplyWorldbookLoading(true);
    try {
      const res = await apiJson(`/api/projects/${projectId}/worldbook_entries/import_all`, {
        method: "POST",
        body: JSON.stringify(detail.worldbook_proposal ?? {}),
      });
      toast.toastSuccess("WorldBook 제안이 적용되었습니다.", res.request_id);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setApplyWorldbookLoading(false);
    }
  }, [applyWorldbookLoading, detail, projectId, toast]);

  const applyStoryMemory = useCallback(async () => {
    if (!projectId) return;
    if (!detail) return;
    if (applyStoryMemoryLoading) return;
    setApplyStoryMemoryLoading(true);
    try {
      const res = await apiJson(`/api/projects/${projectId}/story_memories/import_all`, {
        method: "POST",
        body: JSON.stringify(detail.story_memory_proposal ?? {}),
      });
      toast.toastSuccess("story_memory 제안이 적용되었습니다.", res.request_id);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setApplyStoryMemoryLoading(false);
    }
  }, [applyStoryMemoryLoading, detail, projectId, toast]);

  useEffect(() => {
    if (!projectId) return;
    const requested = String(searchParams.get("docId") ?? "").trim();
    void Promise.resolve().then(async () => {
      await loadList();
      if (!requested) return;
      if (autoOpenedDocIdRef.current === requested) return;
      autoOpenedDocIdRef.current = requested;
      await selectDocAndLoad(requested);
    });
  }, [loadList, projectId, searchParams, selectDocAndLoad]);

  useEffect(() => {
    if (!shouldPoll) return;
    const intervalMs = 2000;
    const timerId = window.setInterval(() => {
      void loadList();
    }, intervalMs);
    return () => window.clearInterval(timerId);
  }, [loadList, shouldPoll]);

  useEffect(() => {
    if (!selectedId) return;
    const prev = lastPolledRef.current;
    lastPolledRef.current = { id: selectedId, status: pollStatus };
    if (!prev || prev.id !== selectedId) return;

    const prevRunning = prev.status === "queued" || prev.status === "running";
    const nowDone = pollStatus === "done" || pollStatus === "failed";
    if (!prevRunning || !nowDone) return;

    void selectDocAndLoad(selectedId);
  }, [pollStatus, selectedId, selectDocAndLoad]);

  return (
    <DebugPageShell
      title="소설/자료 가져오기."
      description={
        <div className="grid gap-2">
          <div>절차: 업로드. txt/md → 백엔드 분할. chunk →（선택 사항: 벡터를 기록합니다. KB → 제안서 작성.proposal）。</div>
          <ul className="grid list-disc gap-1 pl-5 text-xs text-subtext">
            <li>
              세계 도서(세계 도서).worldbook）：생성됩니다. WorldBookEntry
              제안된 항목을 추가하면 ‘세계 책’ 페이지에서 확인할 수 있으며, 글을 작성할 때도 문맥에 맞게 활용할 수 있습니다.。
            </li>
            <li>이야기 속 기억 (story_memory）：생성됩니다. StoryMemory 선택된 항목이 후보 목록에 추가됩니다. 적용 후에는 미리보기에서 확인할 수 있습니다./검색 결과가 발견되었습니다.。</li>
            <li>벡터. KB（vector_kb / kb）：사용 용도. RAG 의미 기반 검색(다양한 플랫폼에서 사용 가능)「RAG」페이지 관리.。</li>
            <li>Chunk（chunk）：시스템 분할 후 생성된 텍스트 조각(검색 및 출처 추적에 사용)。</li>
          </ul>
          <div className="callout-warning">참고: 가져온 후에는 먼저 미리 보기를 하고, 필요에 따라 적용하세요. (기본적으로는 자동으로 장기 기억에 저장되지 않습니다.)。</div>
        </div>
      }
      actions={
        projectId ? (
          <Link className="btn btn-secondary" to={`/projects/${projectId}/rag`}>
            돌아가기. RAG
          </Link>
        ) : null
      }
    >
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-ink">파일 업로드.</div>
          <button
            className="btn btn-secondary"
            aria-label="import_refresh"
            onClick={() => void loadList()}
            type="button"
          >
            목록 새로 고침.
          </button>
        </div>
        <div className="grid gap-3 rounded-atelier border border-border bg-canvas p-4">
          <div className="grid gap-1">
            <div className="text-xs text-subtext">파일 선택.≤ 5MB）</div>
            <input
              aria-label="import_file"
              accept=".txt,.md,text/plain,text/markdown"
              className="input"
              disabled={creating}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              type="file"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary"
              disabled={!projectId || !file || creating}
              onClick={() => void createImport()}
              type="button"
            >
              {creating ? "가져오는 중…" : "가져오기를 시작합니다."}
            </button>
            {creating ? <GhostwriterIndicator label="가져오기 및 처리 중입니다." /> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="text-sm font-semibold text-ink">데이터 가져오기.</div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            {listLoading ? <div className="text-xs text-subtext">불러오는 중입니다.…</div> : null}
            {documents.length === 0 && !listLoading && !statusDoc ? (
              <div className="rounded-atelier border border-border bg-canvas p-4 text-sm text-subtext">
                가져올 데이터가 없습니다. 먼저 파일을 업로드해주세요. txt/md 문서.。
              </div>
            ) : null}
            <div className="grid gap-2">
              {documents.map((d) => {
                const active = d.id === selectedId;
                return (
                  <button
                    key={d.id}
                    className={
                      active
                        ? "panel-interactive ui-focus-ring border-accent/60 bg-surface-hover p-4 text-left"
                        : "panel-interactive ui-focus-ring p-4 text-left"
                    }
                    onClick={() => void selectDocAndLoad(d.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{d.filename || "import.txt"}</div>
                        <div className="mt-1 text-xs text-subtext">
                          {humanizeStatus(d.status)} · {Math.max(0, Math.min(100, Math.floor(d.progress ?? 0)))}% ·{" "}
                          {d.progress_message || ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-subtext">{d.chunk_count ?? 0} chunks</div>
                    </div>
                    {d.error_message ? (
                      <div className="mt-2 rounded-atelier border border-border bg-surface p-2 text-xs text-danger">
                        {d.error_message}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3">
            {!selectedId ? (
              <div className="rounded-atelier border border-border bg-canvas p-4 text-sm text-subtext">
                왼쪽에 있는 가져오기 기록을 선택하여 자세한 내용을 확인하세요.。
              </div>
            ) : detailLoading ? (
              <div className="rounded-atelier border border-border bg-canvas p-4 text-sm text-subtext">세부 정보 로딩 중.…</div>
            ) : detail?.document?.id === selectedId ? (
              <div className="grid gap-3 rounded-atelier border border-border bg-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{statusDoc?.filename || "import.txt"}</div>
                    <div className="mt-1 text-xs text-subtext">
                      {humanizeStatus(statusDoc?.status ?? detail.document.status)} ·{" "}
                      {Math.max(0, Math.min(100, Math.floor(statusDoc?.progress ?? 0)))}% ·{" "}
                      {statusDoc?.progress_message || ""}
                      {shouldPoll ? "· 자동으로 새로 고침 중입니다." : ""}
                    </div>
                    {isPollingStalled ? (
                      <div className="mt-2 rounded-atelier border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                        해당 가져오기는 허용량을 초과했습니다. 5
                        몇 분 동안 업데이트가 되지 않아 문제가 발생했을 수 있습니다. 다음을 시도해 보세요. 자동 새로고침을 중단한 후 다시 시도하거나 잠시 후 페이지를 다시 방문하여 결과를 확인해 보세요.。
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pollPaused && (pollStatus === "queued" || pollStatus === "running") ? (
                      <button className="btn btn-secondary" onClick={() => setPollPaused(false)} type="button">
                        자동 새로고침 재개.
                      </button>
                    ) : shouldPoll ? (
                      <button className="btn btn-secondary" onClick={() => setPollPaused(true)} type="button">
                        자동 새로고침 기능 중지.
                      </button>
                    ) : null}
                    {pollStatus === "failed" || isPollingStalled ? (
                      <button className="btn btn-secondary" onClick={() => void retryImport(selectedId)} type="button">
                        다시 시도하세요.
                      </button>
                    ) : null}
                    <button
                      className="btn btn-secondary"
                      onClick={() => void selectDocAndLoad(selectedId)}
                      type="button"
                    >
                      새로 고침.
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs text-subtext">내용 미리보기.</div>
                  <div className="whitespace-pre-wrap rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                    {detail.content_preview || "(공)"}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-subtext">Chunks（{statusDoc?.chunk_count ?? 0}）</div>
                    <button
                      className="btn btn-secondary"
                      disabled={chunksLoading}
                      onClick={() => void loadChunks()}
                      type="button"
                    >
                      {chunksLoading ? "불러오는 중…" : "데이터 청크 로드 중."}
                    </button>
                  </div>
                  {chunks.length ? (
                    <div className="grid gap-2">
                      {chunks.slice(0, 40).map((c) => (
                        <div key={c.id} className="rounded-atelier border border-border bg-surface p-3">
                          <div className="text-xs text-subtext">#{c.chunk_index}</div>
                          <div className="mt-1 whitespace-pre-wrap text-xs text-ink">{c.preview}</div>
                        </div>
                      ))}
                      {chunks.length > 40 ? <div className="text-xs text-subtext">처음 부분만 표시합니다. 40 개。</div> : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-primary"
                      disabled={applyWorldbookLoading || Boolean(proposalDisabledReason)}
                      onClick={() => void applyWorldbook()}
                      type="button"
                    >
                      {applyWorldbookLoading ? "앱 실행 중…" : "WorldBook에 적용합니다."}
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={applyStoryMemoryLoading || Boolean(proposalDisabledReason)}
                      onClick={() => void applyStoryMemory()}
                      type="button"
                    >
                      {applyStoryMemoryLoading ? "앱 실행 중…" : "스토리 메모리에 적용합니다."}
                    </button>
                  </div>
                  <div className={proposalDisabledReason ? "text-xs text-warning" : "text-xs text-subtext"}>
                    {proposalDisabledReason ??
                      "가져오기가 완료되었습니다. 이제 WorldBook 또는 story_memory에 제안 내용을 입력할 수 있습니다. 입력 후에는 해당 페이지에서 내용을 계속 수정하고 검색할 수 있습니다."}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs text-subtext">WorldBook 제안서 개요 (또는 제안서 미리보기)</div>
                  <div className="rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                    <div>{proposalPreview.worldbook.summary}</div>
                    {proposalPreview.worldbook.sampleTitles.length ? (
                      <div className="mt-1 text-subtext">예시:{proposalPreview.worldbook.sampleTitles.join("、")}</div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs text-subtext">story_memory 제안서 개요 (또는 제안서 미리보기)</div>
                  <div className="rounded-atelier border border-border bg-surface p-3 text-xs text-ink">
                    <div>{proposalPreview.storyMemory.summary}</div>
                    {proposalPreview.storyMemory.sampleTitles.length ? (
                      <div className="mt-1 text-subtext">
                        예시:{proposalPreview.storyMemory.sampleTitles.join("、")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <DebugDetails title="WorldBook 제안 (JSON 형식)">
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-subtext">
                    {safeStringify(detail.worldbook_proposal)}
                  </pre>
                </DebugDetails>
                <DebugDetails title="스토리 메모리 제안 (JSON)">
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-subtext">
                    {safeStringify(detail.story_memory_proposal)}
                  </pre>
                </DebugDetails>
                <DebugDetails title="벡터 삽입 결과 (JSON 형식)">
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-subtext">
                    {safeStringify(detail.vector_ingest_result)}
                  </pre>
                </DebugDetails>
              </div>
            ) : (
              <div className="rounded-atelier border border-border bg-canvas p-4 text-sm text-subtext">
                가져오기 정보가 없습니다. 다시 시도하려면 왼쪽 버튼을 클릭하세요.。
              </div>
            )}
          </div>
        </div>
      </section>
    </DebugPageShell>
  );
}
