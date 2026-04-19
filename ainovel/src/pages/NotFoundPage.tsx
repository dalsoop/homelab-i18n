import { Link, useLocation, useNavigate } from "react-router-dom";

import { UI_COPY } from "../lib/uiCopy";

function getProjectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)/.exec(pathname);
  if (!match) return null;
  return match[1] ?? null;
}

export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = getProjectIdFromPathname(location.pathname);

  return (
    <div className="panel p-6">
      <div className="font-content text-2xl">{UI_COPY.notFound.title}</div>
      <div className="mt-2 text-sm text-subtext">{UI_COPY.notFound.description}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/");
          }}
          type="button"
          aria-label="이전 페이지로 돌아가기 (페이지를 찾을 수 없음)"
        >
          返回上一页
        </button>
        {projectId ? (
          <Link
            className="btn btn-secondary"
            to={`/projects/${projectId}`}
            aria-label="현재 프로젝트로 돌아가기 (해당 프로젝트를 찾을 수 없음)"
          >
            返回项目
          </Link>
        ) : null}
        <Link className="btn btn-secondary" to="/" aria-label="홈페이지로 돌아가기 (페이지를 찾을 수 없음)">
          {UI_COPY.nav.backToHome}
        </Link>
      </div>

      <div className="mt-4 text-xs text-subtext">
        当前路径：<span className="atelier-mono text-ink">{location.pathname}</span>
      </div>
    </div>
  );
}
