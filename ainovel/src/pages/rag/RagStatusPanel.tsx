import type { VectorRagResult } from "./types";
import { formatRerankSummary, normalizeRerankObs, safeJson } from "./utils";

export function RagStatusPanel(props: { status: VectorRagResult | null }) {
  const { status } = props;

  return (
    <section
      className="mt-6 rounded-atelier border border-border bg-surface p-4"
      aria-label="상태 (rag_상태_섹션)"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink">상태.</div>
        <div className="text-xs text-subtext">
          {status ? `활성화하다.:${String(status.enabled)} | 백엔드 우선 개발.:${status.backend_preferred ?? "-"}` : null}
        </div>
      </div>
      {status ? (
        <div className="mt-3 text-xs text-subtext">
          <div>disabled_reason: {status.disabled_reason ?? "-"}（사용 금지 사유.</div>
          <div>hybrid_enabled: {String(status.hybrid_enabled ?? "-")}（혼합 검색.</div>
          {normalizeRerankObs(status.rerank) ? (
            <div className="mt-2">재배치하다.rerank）: {formatRerankSummary(normalizeRerankObs(status.rerank)!)}</div>
          ) : null}
          {status.counts ? (
            <div className="mt-2">
              counts: {status.counts.candidates_total}/{status.counts.candidates_returned} | final:
              {status.counts.final_selected} | dropped:{status.counts.dropped_total}
            </div>
          ) : null}
          <details className="mt-3 rounded-atelier border border-border bg-canvas p-3">
            <summary className="cursor-pointer select-none text-xs">원시적인. status 결과.raw）</summary>
            <pre className="mt-2 max-h-80 overflow-auto text-[11px] leading-4 text-subtext">{safeJson(status)}</pre>
          </details>
        </div>
      ) : (
        <div className="mt-3 text-xs text-subtext">“상태 정보 갱신”을 클릭하여 자세한 상태 정보를 확인하세요.。</div>
      )}
    </section>
  );
}
