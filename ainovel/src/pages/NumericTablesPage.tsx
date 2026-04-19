import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DebugDetails, DebugPageShell } from "../components/atelier/DebugPageShell";
import { TablesPanelInline } from "../components/writing/TablesPanel";
import { useToast } from "../components/ui/toast";
import { copyText } from "../lib/copyText";
import { UI_COPY } from "../lib/uiCopy";
import { ApiError, apiJson } from "../services/apiClient";

type ProjectTable = {
  id: string;
  project_id: string;
  table_key: string;
  name: string;
  row_count?: number;
  updated_at?: string | null;
};

export function NumericTablesPage() {
  const { projectId } = useParams();
  const toast = useToast();
  const pid = String(projectId || "");

  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tables, setTables] = useState<ProjectTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  const [focus, setFocus] = useState<string>("");
  const [scheduling, setScheduling] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string>("");

  const selectedTable = useMemo(() => tables.find((t) => t.id === selectedTableId) ?? null, [selectedTableId, tables]);

  const loadTables = useCallback(async () => {
    if (!pid) return;
    setTablesLoading(true);
    setTablesError(null);
    try {
      const res = await apiJson<{ tables: ProjectTable[] }>(`/api/projects/${pid}/tables?include_schema=false`);
      const next = Array.isArray(res.data?.tables) ? res.data.tables : [];
      setTables(next);
      setSelectedTableId((prev) => {
        if (prev && next.some((t) => t.id === prev)) return prev;
        return next[0]?.id ?? "";
      });
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      setTablesError(`${err.message} (${err.code})${err.requestId ? ` request_id:${err.requestId}` : ""}`);
    } finally {
      setTablesLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    if (!pid) return;
    void loadTables();
  }, [loadTables, pid]);

  const scheduleAiUpdate = useCallback(async () => {
    if (!pid) return;
    const tableId = selectedTableId.trim();
    if (!tableId) {
      toast.toastError("먼저 표를 하나 선택해 주세요.");
      return;
    }
    setScheduling(true);
    try {
      const res = await apiJson<{ task_id: string; chapter_id?: string | null; table_id?: string | null }>(
        `/api/projects/${pid}/tables/${encodeURIComponent(tableId)}/ai_update`,
        {
          method: "POST",
          body: JSON.stringify({ focus: focus.trim() || null }),
        },
      );
      const taskId = String(res.data?.task_id || "").trim();
      if (taskId) setLastTaskId(taskId);
      toast.toastSuccess("AI 업데이트 작업이 생성되었습니다.", res.request_id);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError({ code: "UNKNOWN", message: String(e), requestId: "unknown", status: 0 });
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setScheduling(false);
    }
  }, [focus, pid, selectedTableId, toast]);

  if (!pid) return <div className="text-subtext">부족하다. / 부족하다. projectId</div>;

  return (
    <DebugPageShell
      title={UI_COPY.nav.numericTables}
      description="수치 테이블(NumericTables)은 금전, 시간, 레벨, 자원 등과 같이 수치화할 수 있는 상태를 기록하는 데 사용되며, 이는 구조화된 메모리(StructuredMemory)와는 다릅니다."
    >
      <DebugDetails title="설명.">
        <div className="grid gap-1 text-xs text-subtext">
          <div>
            이 페이지는 ‘수치 표(NumericTables）」의. AdvancedDebug：표를 사용하여 돈을 기록합니다./시간./등급./자료; 맵 데이터의 기본 데이터는 아님.。
          </div>
          <div>테이블과 행을 직접 편집할 수 있도록 지원합니다.project_tables / project_table_rows）。</div>
        </div>
      </DebugDetails>

      <DebugDetails title="AI 업데이트 (table_ai_update)">
        <div className="grid gap-3">
          <div className="grid gap-1 text-xs text-subtext">
            <div>클릭하면 새로운 항목이 생성됩니다. ProjectTask（가능합니다. Task Center 결과 확인, 실패 시 재시도 가능.。</div>
            <div>임무가 성공적으로 완료되면 결과물이 생성됩니다. ChangeSet（괜찮습니다. / 좋습니다. / 가능합니다. / 허락합니다. apply / rollback）。</div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[1fr,2fr]">
            <label className="grid gap-1">
              <div className="text-xs text-subtext">목표표.</div>
              <select
                className="select"
                id="numeric_tables_select_table"
                name="numeric_tables_select_table"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                aria-label="목표 테이블 선택 (numeric_tables_select_table)"
              >
                <option value="" disabled>
                  {tablesLoading ? "불러오는 중..." : tablesError ? "불러오기 실패." : "선택해 주세요."}
                </option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.table_key})
                  </option>
                ))}
              </select>
              {tablesError ? <div className="text-xs text-danger">{tablesError}</div> : null}
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => void loadTables()} type="button">
                  표 목록 새로 고침.
                </button>
              </div>
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-subtext">Focus（선택 사항입니다.</div>
              <textarea
                className="textarea min-h-[88px]"
                id="numeric_tables_ai_focus"
                name="numeric_tables_ai_focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="예를 들어, 최신 업데이트 내용을 바탕으로 게임 내 화폐 및 장비의 수량을 정확하게 반영해야 하며, 허위 정보를 만들거나 날조해서는 안 됩니다."
                aria-label="AI 업데이트: 표 형식 데이터에 집중 (AI 업데이트: 표 형식 데이터에 집중)"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void scheduleAiUpdate()}
              disabled={scheduling || !selectedTableId}
              aria-label="AI 업데이트 작업을 생성합니다 (numeric_tables_ai_schedule)."
              type="button"
            >
              {scheduling ? "생성 중..." : `AI 제안합니다. 변경을 제안합니다.${selectedTable ? `：${selectedTable.name}` : ""}`}
            </button>

            {lastTaskId ? (
              <>
                <Link
                  className="btn btn-secondary"
                  to={`/projects/${pid}/tasks?project_task_id=${encodeURIComponent(lastTaskId)}`}
                >
                  열다. Task Center（이번 임무의 목표를 설정합니다.
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => void copyText(lastTaskId, { title: "복사가 실패했습니다. task_id를 직접 복사해 주세요." })}
                  type="button"
                >
                  복사하다. task_id
                </button>
              </>
            ) : (
              <Link className="btn btn-secondary" to={`/projects/${pid}/tasks`}>
                열다. Task Center
              </Link>
            )}
          </div>
        </div>
      </DebugDetails>

      <TablesPanelInline projectId={pid} />
    </DebugPageShell>
  );
}
