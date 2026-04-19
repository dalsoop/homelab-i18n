import { Link, Outlet, useParams } from "react-router-dom";

import { useProjects } from "../../contexts/projects";
import { UI_COPY } from "../../lib/uiCopy";

export function ProjectProviderGuard() {
  const { projectId } = useParams();
  const { projects, loading, error, refresh } = useProjects();

  if (!projectId) return <Outlet />;
  if (loading) {
    return (
      <div className="panel p-6">
        <div className="text-sm text-subtext">프로젝트 로딩 중입니다....</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel p-6">
        <div className="font-content text-xl text-ink">프로젝트 로딩에 실패했습니다.</div>
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-secondary" onClick={() => void refresh()} type="button">
            다시 시도하세요.
          </button>
          <Link className="btn btn-ghost" to="/" aria-label="홈페이지로 돌아가기 (project_guard_back_home)">
            {UI_COPY.nav.backToHome}
          </Link>
        </div>
      </div>
    );
  }

  const exists = projects.some((p) => p.id === projectId);
  if (!exists) {
    return (
      <div className="panel p-6">
        <div className="font-content text-xl text-ink">해당 프로젝트가 존재하지 않거나 접근 권한이 없습니다.</div>
        <div className="mt-2 text-sm text-subtext">돌아가 주세요.{UI_COPY.nav.home}프로젝트를 다시 선택하거나, 왼쪽에서 다른 프로젝트로 전환하세요.。</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link className="btn btn-secondary" to="/" aria-label="홈페이지로 돌아가기 (project_guard_back_home)">
            {UI_COPY.nav.backToHome}
          </Link>
          <button className="btn btn-ghost" onClick={() => void refresh()} type="button">
            프로젝트 목록을 다시 로드합니다.
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
