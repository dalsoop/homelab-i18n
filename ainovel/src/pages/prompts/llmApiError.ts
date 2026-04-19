import { ApiError } from "../../services/apiClient";

export function formatLlmTestApiError(err: ApiError): string {
  const details =
    err.details && typeof err.details === "object" && err.details !== null
      ? (err.details as Record<string, unknown>)
      : null;
  const upstreamStatusCode = details && "status_code" in details ? details.status_code : undefined;
  const upstreamErrorRaw = details && "upstream_error" in details ? details.upstream_error : undefined;
  const upstreamError = (() => {
    if (!upstreamErrorRaw) return null;
    if (typeof upstreamErrorRaw === "string") {
      const s = upstreamErrorRaw.trim();
      if (!s) return null;
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === "object") {
          const obj = parsed as Record<string, unknown>;
          if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
          if (obj.error && typeof obj.error === "object") {
            const errObj = obj.error as Record<string, unknown>;
            if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message.trim();
          }
        }
      } catch {
        // ignore nested parse errors
      }
      return s.length > 160 ? `${s.slice(0, 160)}…` : s;
    }
    return String(upstreamErrorRaw);
  })();
  const compatAdjustments =
    details && "compat_adjustments" in details && Array.isArray(details.compat_adjustments)
      ? (details.compat_adjustments as unknown[])
          .filter((x) => typeof x === "string" && x)
          .slice(0, 6)
          .join("、")
      : null;
  return err.code === "LLM_KEY_MISSING"
    ? "먼저 API 키를 저장해 주세요."
    : err.code === "LLM_AUTH_ERROR"
      ? "API 키가 유효하지 않거나 만료되었으니 확인 후 다시 시도해 주세요."
      : err.code === "LLM_TIMEOUT"
        ? "연결 시간이 초과되었습니다. 네트워크 연결 상태 또는 기본 URL 주소가 올바른지 확인해 주세요."
        : err.code === "LLM_BAD_REQUEST"
          ? `요청 매개변수가 잘못되었습니다. 모델 이름이나 매개변수가 지원되지 않는 것일 수 있습니다.${upstreamError ? `（상류(상류).${upstreamError}）` : ""}${
              compatAdjustments ? `（호환성.${compatAdjustments}）` : ""
            }`
          : err.code === "LLM_UPSTREAM_ERROR"
            ? `현재 서비스 이용이 불가능합니다. 잠시 후 다시 시도해 주시기 바랍니다.${
                typeof upstreamStatusCode === "number" ? upstreamStatusCode : err.status
              }）`
            : err.message;
}
