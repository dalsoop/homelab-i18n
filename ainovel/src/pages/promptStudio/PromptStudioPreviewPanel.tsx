import type { ChangeEvent } from "react";

import { RequestIdBadge } from "../../components/ui/RequestIdBadge";
import { copyText } from "../../lib/copyText";
import type { PromptPreview } from "../../types";
import type { PromptStudioTask } from "./types";

export function PromptStudioPreviewPanel(props: {
  busy: boolean;
  selectedPresetId: string | null;
  previewTask: string;
  setPreviewTask: (task: string) => void;
  tasks: PromptStudioTask[];
  previewLoading: boolean;
  runPreview: () => Promise<void>;
  requestId: string | null;
  preview: PromptPreview | null;
  templateErrors: Array<{ identifier: string; error: string }>;
  renderLog: unknown | null;
}) {
  const {
    busy,
    preview,
    previewLoading,
    previewTask,
    requestId,
    renderLog,
    runPreview,
    selectedPresetId,
    setPreviewTask,
    tasks,
    templateErrors,
  } = props;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">미리 보기 (서버 측 렌더링)</div>
          {requestId ? <RequestIdBadge className="mt-2" requestId={requestId} /> : null}
        </div>
        <div className="flex gap-2">
          <select
            className="select w-auto"
            value={previewTask}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setPreviewTask(e.target.value)}
            disabled={busy}
          >
            {tasks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => void runPreview()}
            disabled={previewLoading || busy || !selectedPresetId}
            type="button"
          >
            {previewLoading ? "렌더링 중…" : "렌더링 미리보기."}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="grid gap-3">
          {templateErrors.length ? (
            <div className="rounded-atelier border border-border bg-surface/50 p-3 text-xs">
              <div className="font-semibold">템플릿 렌더링 오류.</div>
              <div className="mt-2 grid gap-1 text-subtext">
                {templateErrors.map((item) => (
                  <div key={`${item.identifier}:${item.error}`}>
                    <span className="font-mono text-ink">{item.identifier}</span>
                    <span className="text-subtext">：{item.error}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {preview.missing?.length ? (
            <div className="rounded-atelier border border-border bg-surface/50 p-3 text-xs">
              <div className="font-semibold">누락된 변수.</div>
              <div className="mt-1 text-subtext">{preview.missing.join(", ")}</div>
            </div>
          ) : null}

          <div className="rounded-atelier border border-border bg-surface/50 p-3 text-xs">
            <div className="font-semibold">Token 예상, 추정, 견적. (문맥에 따라 적절한 단어 선택)</div>
            <div className="mt-1 text-subtext">
              총계:{preview.prompt_tokens_estimate ?? 0}
              {preview.prompt_budget_tokens ? ` / 예산:${preview.prompt_budget_tokens}` : ""}
            </div>
          </div>

          {renderLog ? (
            <details className="rounded-atelier border border-border bg-surface/50 p-3">
              <summary className="ui-transition-fast cursor-pointer text-sm hover:text-ink">
                확인하다. render_log（다듬다, 자르다, 편집하다./이유./오류)
              </summary>
              <div className="mt-2 flex justify-end">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await copyText(JSON.stringify(renderLog, null, 2), { title: "복사가 실패했습니다. render_log 파일을 직접 복사해 주세요." });
                  }}
                  type="button"
                >
                  복사하다. render_log
                </button>
              </div>
              <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-atelier border border-border bg-surface p-3 text-xs">
                {JSON.stringify(renderLog, null, 2)}
              </pre>
            </details>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="grid gap-1">
              <div className="text-xs text-subtext">system</div>
              <textarea
                readOnly
                className="textarea atelier-mono min-h-[180px] resize-y bg-surface py-2 text-xs"
                value={preview.system}
              />
            </div>
            <div className="grid gap-1">
              <div className="text-xs text-subtext">user</div>
              <textarea
                readOnly
                className="textarea atelier-mono min-h-[180px] resize-y bg-surface py-2 text-xs"
                value={preview.user}
              />
            </div>
          </div>

          <details className="rounded-atelier border border-border bg-surface/50 p-3">
            <summary className="ui-transition-fast cursor-pointer text-sm hover:text-ink">분할 렌더링 결과를 확인합니다.</summary>
            <div className="mt-3 grid gap-2">
              {(preview.blocks ?? []).map((pb) => (
                <div key={pb.id} className="surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {pb.identifier} <span className="text-xs text-subtext">({pb.role})</span>
                    </div>
                    <div className="text-xs text-subtext">
                      tokens≈{pb.token_estimate ?? 0}
                      {pb.missing?.length ? ` · missing: ${pb.missing.join(", ")}` : ""}
                    </div>
                  </div>
                  <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-atelier border border-border bg-surface p-3 text-xs">
                    {pb.text}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="text-sm text-subtext">작업을 선택하고 “렌더링 미리보기”를 클릭하세요.”。</div>
      )}
    </div>
  );
}
