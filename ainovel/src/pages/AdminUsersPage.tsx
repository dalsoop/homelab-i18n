import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfirm } from "../components/ui/confirm";
import { useToast } from "../components/ui/toast";
import { useAuth } from "../contexts/auth";
import { copyText } from "../lib/copyText";
import { humanizeYesNo } from "../lib/humanize";
import { ApiError, apiJson } from "../services/apiClient";

const PAGE_SIZE = 50;

type AdminUserActivity = {
  online: boolean;
  last_seen_at?: string | null;
  last_seen_request_id?: string | null;
  last_seen_path?: string | null;
  last_seen_method?: string | null;
  last_seen_status?: number | null;
};

type AdminUserUsage = {
  total_generation_calls: number;
  total_generation_error_calls: number;
  total_generated_chars: number;
  last_generation_at?: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  disabled: boolean;
  password_updated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  activity?: AdminUserActivity;
  usage?: AdminUserUsage;
};

type AdminUsersSummary = {
  generated_at?: string | null;
  online_window_seconds: number;
  total_users: number;
  total_admin_users: number;
  total_disabled_users: number;
  total_online_users: number;
  filtered_total_users: number;
  total_generation_calls: number;
  total_generation_error_calls: number;
  total_generated_chars: number;
};

type AdminUsersPagination = {
  limit: number;
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
};

type AdminUsersResponse = {
  users: AdminUser[];
  summary: AdminUsersSummary;
  pagination: AdminUsersPagination;
};

type CreateUserForm = {
  user_id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  password: string;
};

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtCount(value: number | null | undefined): string {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(n)));
}

export function AdminUsersPage() {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  type RowBusy = { resetPassword?: number; toggleDisabled?: number };
  const [rowBusy, setRowBusy] = useState<Record<string, RowBusy>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminUsersSummary>({
    generated_at: null,
    online_window_seconds: 300,
    total_users: 0,
    total_admin_users: 0,
    total_disabled_users: 0,
    total_online_users: 0,
    filtered_total_users: 0,
    total_generation_calls: 0,
    total_generation_error_calls: 0,
    total_generated_chars: 0,
  });
  const [pagination, setPagination] = useState<AdminUsersPagination>({
    limit: PAGE_SIZE,
    cursor: null,
    next_cursor: null,
    has_more: false,
  });
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CreateUserForm>({
    user_id: "",
    display_name: "",
    email: "",
    is_admin: false,
    password: "",
  });

  const canManage = auth.status === "authenticated" && Boolean(auth.user?.isAdmin);

  const bumpRowBusy = useCallback((userId: string, action: keyof RowBusy, delta: number) => {
    setRowBusy((prev) => {
      const current = prev[userId] ?? {};
      const nextCount = (current[action] ?? 0) + delta;
      const nextUser: RowBusy = { ...current };
      if (nextCount <= 0) {
        delete nextUser[action];
      } else {
        nextUser[action] = nextCount;
      }
      const next = { ...prev };
      if (Object.keys(nextUser).length === 0) {
        delete next[userId];
        return next;
      }
      next[userId] = nextUser;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);
      if (searchQuery) params.set("q", searchQuery);
      if (onlineOnly) params.set("online_only", "true");

      const path = `/api/auth/admin/users?${params.toString()}`;
      const res = await apiJson<AdminUsersResponse>(path);
      const nextUsers = Array.isArray(res.data.users) ? res.data.users : [];

      setUsers(nextUsers);
      setSummary({
        generated_at: res.data.summary?.generated_at ?? null,
        online_window_seconds: Number(res.data.summary?.online_window_seconds ?? 300),
        total_users: Number(res.data.summary?.total_users ?? 0),
        total_admin_users: Number(res.data.summary?.total_admin_users ?? 0),
        total_disabled_users: Number(res.data.summary?.total_disabled_users ?? 0),
        total_online_users: Number(res.data.summary?.total_online_users ?? 0),
        filtered_total_users: Number(res.data.summary?.filtered_total_users ?? 0),
        total_generation_calls: Number(res.data.summary?.total_generation_calls ?? 0),
        total_generation_error_calls: Number(res.data.summary?.total_generation_error_calls ?? 0),
        total_generated_chars: Number(res.data.summary?.total_generated_chars ?? 0),
      });
      setPagination({
        limit: Number(res.data.pagination?.limit ?? PAGE_SIZE),
        cursor: res.data.pagination?.cursor ?? null,
        next_cursor: res.data.pagination?.next_cursor ?? null,
        has_more: Boolean(res.data.pagination?.has_more),
      });
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setLoading(false);
    }
  }, [cursor, onlineOnly, searchQuery, toast]);

  useEffect(() => {
    if (!canManage) return;
    void load();
  }, [canManage, load]);

  const createUser = useCallback(async () => {
    if (!canManage) return;
    const userId = form.user_id.trim();
    if (!userId) {
      toast.toastError("사용자 ID는 필수 입력 항목입니다.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await apiJson<{ user: AdminUser; temp_password: string | null }>("/api/auth/admin/users", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          display_name: form.display_name.trim() || null,
          email: form.email.trim() || null,
          is_admin: Boolean(form.is_admin),
          password: form.password.trim() || null,
        }),
      });
      const user = res.data.user;
      if (res.data.temp_password) {
        setTempPasswords((v) => ({ ...v, [user.id]: res.data.temp_password ?? "" }));
      }
      toast.toastSuccess("사용자가 생성했습니다.", res.request_id);
      setForm((v) => ({ ...v, user_id: "", password: "" }));
      setSearchInput(userId);
      setSearchQuery(userId);
      setOnlineOnly(false);
      setCursor(null);
      setCursorHistory([]);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setCreatingUser(false);
    }
  }, [canManage, form.display_name, form.email, form.is_admin, form.password, form.user_id, toast]);

  const resetPassword = useCallback(
    async (targetUserId: string) => {
      if (!canManage) return;
      const ok = await confirm.confirm({
        title: "비밀번호 재설정하시겠습니까?",
        description: "일회용 비밀번호가 생성됩니다. 이 비밀번호는 현재 페이지에서 한 번만 표시되며, 복사하면 자동으로 숨겨집니다.",
        confirmText: "초기화하다.",
        cancelText: "취소하다.",
        danger: true,
      });
      if (!ok) return;
      bumpRowBusy(targetUserId, "resetPassword", 1);
      try {
        const res = await apiJson<{ temp_password: string }>(`/api/auth/admin/users/${targetUserId}/password/reset`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        setTempPasswords((v) => ({ ...v, [targetUserId]: res.data.temp_password }));
        toast.toastSuccess("비밀번호가 재설정되었습니다. (일회용 비밀번호를 복사하여 사용하세요.)", res.request_id);
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        bumpRowBusy(targetUserId, "resetPassword", -1);
      }
    },
    [bumpRowBusy, canManage, confirm, toast],
  );

  const setDisabled = useCallback(
    async (targetUserId: string, disabled: boolean) => {
      if (!canManage) return;
      const ok = await confirm.confirm({
        title: disabled ? "사용자 계정을 정지하시겠습니까?" : "사용자 계정을 활성화하시겠습니까?",
        description: disabled ? "해당 사용자는 사용 중지된 후에는 더 이상 로그인할 수 없습니다. 필요에 따라 언제든지 다시 활성화하여 사용할 수 있습니다." : "활성화되면 해당 사용자는 다시 로그인할 수 있습니다.",
        confirmText: disabled ? "사용 금지." : "활성화하다.",
        cancelText: "취소하다.",
        danger: disabled,
      });
      if (!ok) return;
      bumpRowBusy(targetUserId, "toggleDisabled", 1);
      try {
        await apiJson<Record<string, never>>(`/api/auth/admin/users/${targetUserId}/disable`, {
          method: "POST",
          body: JSON.stringify({ disabled }),
        });
        toast.toastSuccess(disabled ? "사용 중지됨." : "활성화되었습니다.");
        await load();
      } catch (e) {
        const err =
          e instanceof ApiError
            ? e
            : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      } finally {
        bumpRowBusy(targetUserId, "toggleDisabled", -1);
      }
    },
    [bumpRowBusy, canManage, confirm, load, toast],
  );

  const copyTempPassword = useCallback(
    async (userId: string) => {
      const pwd = tempPasswords[userId];
      if (!pwd) return;
      const ok = await copyText(pwd, {
        title: "복사 실패: 일회용 비밀번호를 직접 복사해 주세요.",
        description: "닫으면 페이지에서 사라집니다.",
      });
      if (ok) {
        toast.toastSuccess("일회용 비밀번호가 복사되었습니다(페이지에서 삭제됨).");
      } else {
        toast.toastWarning("자동 복사가 실패했습니다. 수동 복사 팝업 창이 열렸습니다. (팝업 창을 닫으면 페이지에서 사라집니다.)");
      }
      setTempPasswords((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    },
    [tempPasswords, toast],
  );

  const onApplySearch = useCallback(() => {
    const nextQuery = searchInput.trim();
    setSearchQuery(nextQuery);
    setCursor(null);
    setCursorHistory([]);
  }, [searchInput]);

  const onResetSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setCursor(null);
    setCursorHistory([]);
  }, []);

  const onToggleOnlineOnly = useCallback((next: boolean) => {
    setOnlineOnly(next);
    setCursor(null);
    setCursorHistory([]);
  }, []);

  const onNextPage = useCallback(() => {
    if (!pagination.has_more || !pagination.next_cursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? ""]);
    setCursor(pagination.next_cursor);
  }, [cursor, pagination.has_more, pagination.next_cursor]);

  const onPrevPage = useCallback(() => {
    setCursorHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousCursor = next.pop() ?? "";
      setCursor(previousCursor || null);
      return next;
    });
  }, []);

  const visibleUsers = useMemo(() => users, [users]);
  const hasPrevPage = cursorHistory.length > 0;
  const hasNextPage = pagination.has_more && Boolean(pagination.next_cursor);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-atelier border border-border bg-surface p-6">
          <div className="font-content text-xl text-ink">관리자 사용자 관리.</div>
          <div className="mt-2 text-sm text-subtext">현재 계정으로는 관리자 권한이 없습니다. 관리자 계정으로 로그인해 주세요.。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-content text-2xl text-ink">관리자 사용자 관리.</div>
          <div className="mt-1 text-xs text-subtext">사용자 생성. / 비밀번호 재설정. / 사용/사용 중지. / 온라인 통계 요약 및 개요.</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" disabled={loading} onClick={() => void load()} type="button">
            {loading ? "불러오는 중…" : "목록 새로 고침."}
          </button>
        </div>
      </div>

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-atelier border border-border bg-surface p-4">
          <div className="text-xs text-subtext">온라인 사용자.</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{fmtCount(summary.total_online_users)}</div>
          <div className="mt-1 text-xs text-subtext">
            창문. {Math.max(1, Math.floor(summary.online_window_seconds / 60))} 분.
          </div>
        </div>
        <div className="rounded-atelier border border-border bg-surface p-4">
          <div className="text-xs text-subtext">전체 사용자 수. / 선별 후.</div>
          <div className="mt-1 text-2xl font-semibold text-ink">
            {fmtCount(summary.total_users)} / {fmtCount(summary.filtered_total_users)}
          </div>
          <div className="mt-1 text-xs text-subtext">
            관리자 {fmtCount(summary.total_admin_users)}，사용 금지. {fmtCount(summary.total_disabled_users)}
          </div>
        </div>
        <div className="rounded-atelier border border-border bg-surface p-4">
          <div className="text-xs text-subtext">총 호출 횟수(LLM API）</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{fmtCount(summary.total_generation_calls)}</div>
          <div className="mt-1 text-xs text-subtext">실패. {fmtCount(summary.total_generation_error_calls)}</div>
        </div>
        <div className="rounded-atelier border border-border bg-surface p-4">
          <div className="text-xs text-subtext">지금까지 생성된 글자 수.</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{fmtCount(summary.total_generated_chars)}</div>
          <div className="mt-1 text-xs text-subtext">통계 업데이트 시간:{fmtDateTime(summary.generated_at)}</div>
        </div>
      </section>

      <form
        className="mt-4 rounded-atelier border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onApplySearch();
        }}
      >
        <div className="text-sm font-medium text-ink">필터링 및 페이지 나누기.</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <label className="text-sm text-ink">
            <div className="text-xs text-subtext">사용자 요청에 따라. ID / 표시 이름. / 이메일 주소 필터링.</div>
            <input
              id="admin_users_search"
              className="input mt-1"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="키워드를 입력한 후 엔터 키를 누르거나 “필터 적용”을 클릭하세요."
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-ink">
            <input
              id="admin_users_online_only"
              className="checkbox"
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => onToggleOnlineOnly(e.target.checked)}
            />
            <span>온라인 사용자만 보기.</span>
          </label>
          <button className="btn btn-secondary self-end" type="submit">
            응용 프로그램 필터링.
          </button>
          <button className="btn btn-secondary self-end" onClick={onResetSearch} type="button">
            초기화하다.
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-subtext">
          <div>
            현재 페이지. {fmtCount(pagination.limit)} 완료되었습니다. {fmtCount(visibleUsers.length)} 개
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasPrevPage || loading}
              onClick={onPrevPage}
              type="button"
            >
              이전 페이지.
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasNextPage || loading}
              onClick={onNextPage}
              type="button"
            >
              다음 페이지.
            </button>
          </div>
        </div>
      </form>

      <form
        className="mt-6 rounded-atelier border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (creatingUser) return;
          void createUser();
        }}
      >
        <div className="text-sm font-medium text-ink">사용자 생성.</div>
        <div className="mt-1 text-xs text-subtext">
          알림: “초기 비밀번호”를 입력하지 않으면 시스템에서 일회용 비밀번호를 자동으로 생성합니다. 이 일회용 비밀번호는 저장되지 않으며, 페이지를 새로 고치면 다시 사용할 수 없습니다. 따라서 비밀번호를 설정하는 것이 좋습니다./초기화 후 즉시 복사하여 안전한 경로를 통해 사용자에게 전달합니다.。
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-ink">
            <div className="text-xs text-subtext">사용자. ID（user_id）</div>
            <input
              id="admin_users_user_id"
              className="input mt-1"
              value={form.user_id}
              onChange={(e) => setForm((v) => ({ ...v, user_id: e.target.value }))}
              placeholder="예: admin2."
            />
          </label>
          <label className="text-sm text-ink">
            <div className="text-xs text-subtext">표시 이름 (display_name）</div>
            <input
              id="admin_users_display_name"
              className="input mt-1"
              value={form.display_name}
              onChange={(e) => setForm((v) => ({ ...v, display_name: e.target.value }))}
              placeholder="예: 관리자 2."
            />
          </label>
          <label className="text-sm text-ink">
            <div className="text-xs text-subtext">이메일 주소email，선택 사항입니다.</div>
            <input
              id="admin_users_email"
              className="input mt-1"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              placeholder="예: admin2@example.com"
            />
          </label>
          <label className="text-sm text-ink">
            <div className="text-xs text-subtext">초기 비밀번호:password，선택 사항입니다.</div>
            <input
              id="admin_users_password"
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              placeholder="빈칸으로 두면 일회용 비밀번호가 생성됩니다."
            />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              id="admin_users_is_admin"
              className="checkbox"
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm((v) => ({ ...v, is_admin: e.target.checked }))}
            />
            <span>관리자(is_admin）</span>
          </label>
          <button className="btn btn-primary" disabled={creatingUser} type="submit">
            {creatingUser ? "전송 중…" : "생성하다."}
          </button>
        </div>
      </form>

      <section className="mt-6 rounded-atelier border border-border bg-surface p-4">
        <div className="text-sm font-medium text-ink">사용자 목록.</div>
        <div className="mt-1 text-xs text-subtext">
          보안 안내: 일회용 비밀번호는 최초 로그인 시에만 사용하십시오./찾아올 수 있습니다. 사용자는 처음 로그인한 후 가능한 한 빨리 비밀번호를 변경하는 것이 좋습니다. 보안 위험을 줄이기 위해 이 페이지에서는 기본적으로 비밀번호를 텍스트 형태로 표시하지 않으며, 복사 버튼을 클릭하면 자동으로 숨겨집니다.。
        </div>

        <div className="mt-3 grid gap-3 md:hidden" aria-label="admin_users_cards">
          {visibleUsers.map((u) => (
            <div key={u.id} className="rounded-atelier border border-border bg-canvas p-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-ink">{u.display_name ?? "-"}</div>
                  <span
                    className={
                      u.activity?.online
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700"
                        : "rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] text-subtext"
                    }
                  >
                    {u.activity?.online ? "온라인." : "오프라인."}
                  </span>
                </div>
                <div className="mt-1 break-all font-mono text-xs text-subtext">{u.id}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-subtext">
                  <span>관리자:{humanizeYesNo(u.is_admin)}</span>
                  <span>사용 중지됨:{humanizeYesNo(u.disabled)}</span>
                  <span>호출:{fmtCount(u.usage?.total_generation_calls ?? 0)}</span>
                  <span>단어 수:{fmtCount(u.usage?.total_generated_chars ?? 0)}</span>
                  <span className="col-span-2">최근 활동:{fmtDateTime(u.activity?.last_seen_at)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {tempPasswords[u.id] ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(rowBusy[u.id]?.resetPassword)}
                    onClick={() => void copyTempPassword(u.id)}
                    type="button"
                  >
                    복사하여 숨기기.
                  </button>
                ) : null}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={Boolean(rowBusy[u.id]?.resetPassword)}
                  onClick={() => void resetPassword(u.id)}
                  type="button"
                  title="일회용 비밀번호가 생성되었습니다. (현재 페이지에서만 표시되며, 즉시 복사하여 사용하시기 바랍니다.)"
                >
                  비밀번호 재설정.
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={Boolean(rowBusy[u.id]?.toggleDisabled)}
                  onClick={() => void setDisabled(u.id, !u.disabled)}
                  type="button"
                >
                  {u.disabled ? "활성화하다." : "사용 금지."}
                </button>
              </div>
            </div>
          ))}
          {visibleUsers.length === 0 ? <div className="p-2 text-xs text-subtext">데이터가 없습니다.</div> : null}
        </div>

        <div className="mt-3 hidden overflow-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtext">
              <tr>
                <th className="py-2 pr-3" scope="col">
                  사용자. ID
                </th>
                <th className="py-2 pr-3" scope="col">
                  표시 이름.
                </th>
                <th className="py-2 pr-3" scope="col">
                  관리자
                </th>
                <th className="py-2 pr-3" scope="col">
                  사용 중지됨.
                </th>
                <th className="py-2 pr-3" scope="col">
                  온라인.
                </th>
                <th className="py-2 pr-3" scope="col">
                  최근 활동
                </th>
                <th className="py-2 pr-3" scope="col">
                  호출 횟수.
                </th>
                <th className="py-2 pr-3" scope="col">
                  생성된 글자 수.
                </th>
                <th className="py-2 pr-3" scope="col">
                  일회용 비밀번호.
                </th>
                <th className="py-2 pr-3" scope="col">
                  작동하다, 조작하다, 실행하다. (문맥에 따라 적절한 단어 선택)
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2 pr-3 break-all font-mono text-xs">{u.id}</td>
                  <td className="py-2 pr-3">{u.display_name ?? "-"}</td>
                  <td className="py-2 pr-3">{humanizeYesNo(u.is_admin)}</td>
                  <td className="py-2 pr-3">{humanizeYesNo(u.disabled)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        u.activity?.online
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700"
                          : "rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-subtext"
                      }
                    >
                      {u.activity?.online ? "온라인." : "오프라인."}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-subtext">{fmtDateTime(u.activity?.last_seen_at)}</td>
                  <td className="py-2 pr-3">{fmtCount(u.usage?.total_generation_calls ?? 0)}</td>
                  <td className="py-2 pr-3">{fmtCount(u.usage?.total_generated_chars ?? 0)}</td>
                  <td className="py-2 pr-3">
                    {tempPasswords[u.id] ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={Boolean(rowBusy[u.id]?.resetPassword)}
                        onClick={() => void copyTempPassword(u.id)}
                        type="button"
                      >
                        복사하여 숨기기.
                      </button>
                    ) : (
                      <span className="text-subtext">-</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={Boolean(rowBusy[u.id]?.resetPassword)}
                        onClick={() => void resetPassword(u.id)}
                        type="button"
                        title="일회용 비밀번호가 생성되었습니다. (현재 페이지에서만 표시되며, 즉시 복사하여 사용하시기 바랍니다.)"
                      >
                        비밀번호 재설정.
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={Boolean(rowBusy[u.id]?.toggleDisabled)}
                        onClick={() => void setDisabled(u.id, !u.disabled)}
                        type="button"
                      >
                        {u.disabled ? "활성화하다." : "사용 금지."}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleUsers.length === 0 ? (
                <tr>
                  <td className="py-3 text-xs text-subtext" colSpan={10}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
