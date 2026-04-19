import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { isChunkLoadError } from "../lib/lazyImportRetry";

function summarizeError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === "string" ? error.data : "";
    return [String(error.status), error.statusText, detail].filter(Boolean).join(" ");
  }
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

export function RouteErrorPage() {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);
  const detail = summarizeError(error);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen max-w-screen-md items-center px-4 py-12">
        <div className="surface w-full p-6 sm:p-8">
          <div className="font-content text-2xl text-ink">
            {chunkError ? "페이지 내용이 업데이트되었습니다. 새로 고침 후 다시 시도해 주세요." : "페이지 로딩에 실패했습니다."}
          </div>
          <div className="mt-2 text-sm text-subtext">
            {chunkError
              ? "프런트엔드 리소스 버전 변경으로 인해 일부 콘텐츠 로딩에 실패했습니다. 자동 복구를 시도했지만, 문제가 지속될 경우 페이지를 새로 고침한 후 다시 시도해 주세요."
              : "응용 프로그램에서 오류가 발생했습니다. 페이지를 새로 고치거나 홈페이지로 돌아가서 다시 시도해 보세요."}
          </div>

          {detail ? (
            <div className="mt-4 rounded-atelier border border-border bg-surface px-3 py-2 text-xs text-subtext">
              {detail}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={() => window.location.reload()} type="button">
              페이지 새로 고침.
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.assign("/")} type="button">
              홈페이지로 돌아가기.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
