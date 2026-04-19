import { Link } from "react-router-dom";

import { UI_COPY } from "../../lib/uiCopy";
import { formatIsoToLocal } from "./utils";

export function RagHeaderPanel(props: {
  projectId: string | undefined;
  statusLoading: boolean;
  ingestLoading: boolean;
  rebuildLoading: boolean;
  vectorIndexDirty: boolean | null;
  lastVectorBuildAt: string | null;
  vectorEnabled: boolean | null;
  vectorDisabledReason: string | null;
  runStatus: () => Promise<void>;
  runIngest: () => Promise<void>;
  runRebuild: () => Promise<void>;
}) {
  const {
    ingestLoading,
    lastVectorBuildAt,
    projectId,
    rebuildLoading,
    runIngest,
    runRebuild,
    runStatus,
    statusLoading,
    vectorDisabledReason,
    vectorEnabled,
    vectorIndexDirty,
  } = props;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-content text-2xl text-ink">{UI_COPY.rag.title}</div>
          <div className="mt-1 text-xs text-subtext">{UI_COPY.rag.subtitle}</div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            disabled={statusLoading}
            onClick={() => void runStatus()}
            aria-label="상태 업데이트 (상태 갱신)"
            type="button"
          >
            {statusLoading ? "불러오는 중…" : "상태 업데이트."}
          </button>
          <button
            className="btn btn-secondary"
            disabled={ingestLoading}
            onClick={() => void runIngest()}
            aria-label={`${UI_COPY.rag.ingest} (rag_ingest)`}
            type="button"
          >
            {ingestLoading ? "실행 중…" : UI_COPY.rag.ingest}
          </button>
          <button
            className={vectorIndexDirty ? "btn btn-primary" : "btn btn-secondary"}
            disabled={rebuildLoading}
            onClick={() => void runRebuild()}
            aria-label={`${UI_COPY.rag.rebuild} (rag_rebuild)`}
            type="button"
          >
            {rebuildLoading
              ? "실행 중…"
              : vectorIndexDirty && vectorEnabled === false
                ? UI_COPY.rag.rebuildNeedConfig
                : vectorIndexDirty
                  ? UI_COPY.rag.rebuildRecommended
                  : UI_COPY.rag.rebuild}
          </button>
          {projectId ? (
            <Link
              className="btn btn-secondary"
              to={`/projects/${projectId}/prompts#rag-config`}
              aria-label={`${UI_COPY.rag.settings} (rag_settings)`}
            >
              {UI_COPY.rag.settings}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-atelier border border-border bg-canvas p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-subtext">
            인덱스가 만료되었습니다.dirty）: {vectorIndexDirty === null ? "loading…" : String(vectorIndexDirty)} |
            이전 빌드.last_build_at）: {lastVectorBuildAt ?? "-"}
            {lastVectorBuildAt ? `（${formatIsoToLocal(lastVectorBuildAt)}）` : ""}
          </div>
          {vectorIndexDirty === null ? (
            <div className="text-subtext">인덱스 상태 로딩 중.…</div>
          ) : vectorIndexDirty ? (
            vectorEnabled === false ? (
              <div className="text-ink">
                인덱스는 오래되었지만 벡터 서비스는 활성화되지 않았습니다.disabled_reason: {vectorDisabledReason ?? "-"}）。먼저 다음 위치에 접속하세요.{" "}
                {UI_COPY.rag.settings} 벡터화 구성.Embedding），다시. {UI_COPY.rag.rebuild}。
              </div>
            ) : (
              <div className="text-ink">인덱스가 오래되었습니다. 오른쪽 상단 모서리를 클릭하여 업데이트하세요. “{UI_COPY.rag.rebuildRecommended}” 재구축하다.。</div>
            )
          ) : (
            <div className="text-subtext">색인: clean，재건할 필요가 없습니다.。</div>
          )}
        </div>
      </div>
    </>
  );
}
