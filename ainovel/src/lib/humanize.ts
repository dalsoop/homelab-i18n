function formatWithKey(label: string, key: string): string {
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) return label || "알 수 없음.";
  return `${label || "알 수 없음."}（${normalizedKey}）`;
}

export function humanizeYesNo(value: boolean): string {
  return value ? "네." : "아니요.";
}

export function humanizeChapterStatus(status: string): string {
  const s = String(status || "").trim();
  if (s === "planned") return formatWithKey("계획 중입니다.", s);
  if (s === "drafting") return formatWithKey("초안.", s);
  if (s === "done") return formatWithKey("최종본.", s);
  return s || "알 수 없음.";
}

export function humanizeTaskStatus(status: string): string {
  const s = String(status || "").trim();
  if (s === "queued") return formatWithKey("줄 서는 중입니다.", s);
  if (s === "running") return formatWithKey("실행 중.", s);
  if (s === "done") return formatWithKey("완료되었습니다.", s);
  if (s === "succeeded") return formatWithKey("완료되었습니다.", s);
  if (s === "failed") return formatWithKey("실패.", s);
  return s || "알 수 없음.";
}

export function humanizeChangeSetStatus(status: string): string {
  const s = String(status || "").trim();
  if (s === "proposed") return formatWithKey("적용되지 않음.", s);
  if (s === "applied") return formatWithKey("적용 완료.", s);
  if (s === "rolled_back") return formatWithKey("롤백 완료.", s);
  if (s === "failed") return formatWithKey("실패.", s);
  return s || "알 수 없음.";
}

export function humanizeMemberRole(role: string): string {
  const s = String(role || "").trim();
  if (s === "viewer") return formatWithKey("보는 사람.", s);
  if (s === "editor") return formatWithKey("편집자.", s);
  if (s === "owner") return formatWithKey("소유자.", s);
  return s || "알 수 없음.";
}
