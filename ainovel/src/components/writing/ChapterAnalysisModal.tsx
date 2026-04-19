import { useId } from "react";

import { Modal } from "../ui/Modal";

import type { ChapterAnalyzeResult } from "./types";

export function ChapterAnalysisModal(props: {
  open: boolean;
  analysisLoading: boolean;
  rewriteLoading: boolean;
  applyLoading: boolean;
  analysisFocus: string;
  setAnalysisFocus: (value: string) => void;
  analysisResult: ChapterAnalyzeResult | null;
  rewriteInstruction: string;
  setRewriteInstruction: (value: string) => void;
  onClose: () => void;
  onAnalyze: () => void;
  onApplyAnalysisToMemory: () => void;
  onLocateInEditor: (excerpt: string) => void;
  onRewriteFromAnalysis: () => void;
}) {
  const busy = props.analysisLoading || props.rewriteLoading || props.applyLoading;
  const titleId = useId();
  return (
    <Modal
      open={props.open}
      onClose={busy ? undefined : props.onClose}
      panelClassName="surface max-w-3xl p-5"
      ariaLabelledBy={titleId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-content text-xl text-ink" id={titleId}>
            章节分析
          </div>
          <div className="mt-1 text-xs text-subtext">
            分析与重写只会写入“生成记录”；保存到记忆库会写入长期记忆（不影响章节正文）。
          </div>
        </div>
        <button className="btn btn-secondary" aria-label="닫기." onClick={props.onClose} disabled={busy} type="button">
          关闭
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">分析重点（可选）</span>
          <input
            className="input"
            value={props.analysisFocus}
            onChange={(e) => props.setAnalysisFocus(e.target.value)}
            disabled={busy}
            placeholder="예를 들어, 이야기 속에서 제시되었지만 아직 풀리지 않은 설정이나 복선, 이야기의 전개 속도, 등장인물의 행동 이유, 이야기의 논리적 모순 등."
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={props.onAnalyze} type="button">
            {props.analysisLoading ? "분석 중..." : props.analysisResult ? "재분석하다." : "분석을 시작합니다."}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!props.analysisResult || busy}
            onClick={props.onApplyAnalysisToMemory}
            type="button"
          >
            {props.applyLoading ? "저장 중..." : "메모리에 저장합니다."}
          </button>
          {props.analysisResult?.generation_run_id ? (
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void navigator.clipboard.writeText(props.analysisResult?.generation_run_id ?? "")}
              type="button"
            >
              复制 run_id
            </button>
          ) : null}
        </div>

        {props.analysisResult ? (
          <div className="grid gap-4">
            {props.analysisResult.parse_error?.message ? (
              <div className="rounded-atelier border border-border bg-surface p-3 text-sm text-accent">
                解析失败：{props.analysisResult.parse_error.message}
                {props.analysisResult.parse_error.hint ? (
                  <div className="mt-1 text-xs text-subtext">hint: {props.analysisResult.parse_error.hint}</div>
                ) : null}
              </div>
            ) : null}

            {props.analysisResult.warnings && props.analysisResult.warnings.length > 0 ? (
              <div className="rounded-atelier border border-border bg-surface p-3 text-xs text-subtext">
                warnings: {props.analysisResult.warnings.join(", ")}
              </div>
            ) : null}

            <div className="grid gap-3 rounded-atelier border border-border bg-surface p-3">
              <div className="text-sm text-ink">本章摘要</div>
              <div className="text-sm text-ink">
                {(props.analysisResult.analysis?.chapter_summary ?? "").trim() || "(공)"}
              </div>
            </div>

            <div className="grid gap-2 rounded-atelier border border-border bg-surface p-3">
              <div className="text-sm text-ink">Hooks / 钩子</div>
              {(props.analysisResult.analysis?.hooks ?? []).length === 0 ? (
                <div className="text-sm text-subtext">（无）</div>
              ) : (
                <div className="grid gap-2">
                  {(props.analysisResult.analysis?.hooks ?? []).map((it, idx) => (
                    <div key={idx} className="rounded-atelier border border-border bg-canvas p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-subtext">{(it.excerpt ?? "").trim() || "(제공된 텍스트가 없습니다.)"}</div>
                        {it.excerpt ? (
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => props.onLocateInEditor(it.excerpt ?? "")}
                            type="button"
                          >
                            定位
                          </button>
                        ) : null}
                      </div>
                      {it.note ? <div className="mt-2 text-sm text-ink">{it.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-atelier border border-border bg-surface p-3">
              <div className="text-sm text-ink">Foreshadows / 伏笔</div>
              {(props.analysisResult.analysis?.foreshadows ?? []).length === 0 ? (
                <div className="text-sm text-subtext">（无）</div>
              ) : (
                <div className="grid gap-2">
                  {(props.analysisResult.analysis?.foreshadows ?? []).map((it, idx) => (
                    <div key={idx} className="rounded-atelier border border-border bg-canvas p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-subtext">{(it.excerpt ?? "").trim() || "(제공된 텍스트가 없습니다.)"}</div>
                        {it.excerpt ? (
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => props.onLocateInEditor(it.excerpt ?? "")}
                            type="button"
                          >
                            定位
                          </button>
                        ) : null}
                      </div>
                      {it.note ? <div className="mt-2 text-sm text-ink">{it.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-atelier border border-border bg-surface p-3">
              <div className="text-sm text-ink">Plot Points / 情节点</div>
              {(props.analysisResult.analysis?.plot_points ?? []).length === 0 ? (
                <div className="text-sm text-subtext">（无）</div>
              ) : (
                <div className="grid gap-2">
                  {(props.analysisResult.analysis?.plot_points ?? []).map((it, idx) => (
                    <div key={idx} className="rounded-atelier border border-border bg-canvas p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-ink">{(it.beat ?? "").trim() || "(비트 없음)"}</div>
                        {it.excerpt ? (
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => props.onLocateInEditor(it.excerpt ?? "")}
                            type="button"
                          >
                            定位
                          </button>
                        ) : null}
                      </div>
                      {it.excerpt ? <div className="mt-2 text-xs text-subtext">{it.excerpt}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-atelier border border-border bg-surface p-3">
              <div className="text-sm text-ink">Suggestions / 修改建议</div>
              {(props.analysisResult.analysis?.suggestions ?? []).length === 0 ? (
                <div className="text-sm text-subtext">（无）</div>
              ) : (
                <div className="grid gap-2">
                  {(props.analysisResult.analysis?.suggestions ?? []).map((it, idx) => (
                    <div key={idx} className="rounded-atelier border border-border bg-canvas p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-ink">
                          {(it.title ?? "").trim() || "제안합니다. / 제안 드립니다. / 권장합니다. / 건의합니다. / 추천합니다. (문맥에 따라 적절한 표현을 선택하세요.)"}{" "}
                          {(it.priority ?? "").trim() ? (
                            <span className="text-xs text-subtext">({it.priority})</span>
                          ) : null}
                        </div>
                        {it.excerpt ? (
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => props.onLocateInEditor(it.excerpt ?? "")}
                            type="button"
                          >
                            定位
                          </button>
                        ) : null}
                      </div>
                      {it.excerpt ? <div className="mt-2 text-xs text-subtext">{it.excerpt}</div> : null}
                      {it.issue ? <div className="mt-2 text-sm text-ink">问题：{it.issue}</div> : null}
                      {it.recommendation ? (
                        <div className="mt-2 text-sm text-ink">建议：{it.recommendation}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {props.analysisResult.analysis?.overall_notes ? (
              <div className="grid gap-2 rounded-atelier border border-border bg-surface p-3">
                <div className="text-sm text-ink">总体备注</div>
                <div className="text-sm text-ink">{props.analysisResult.analysis.overall_notes}</div>
              </div>
            ) : null}

            <details>
              <summary className="ui-transition-fast cursor-pointer text-xs text-subtext hover:text-ink">
                raw_output
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-atelier border border-border bg-canvas p-3 text-xs text-ink">
                {props.analysisResult.raw_output ?? ""}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-sm text-subtext">暂无分析结果。</div>
        )}

        <div className="grid gap-3 rounded-atelier border border-border bg-surface p-3">
          <div className="text-sm text-ink">按建议重写（覆盖编辑器正文）</div>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">重写指令（可选）</span>
            <input
              className="input"
              value={props.rewriteInstruction}
              onChange={(e) => props.setRewriteInstruction(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-subtext">重写结果不会自动保存，记得 Ctrl/Cmd+S 保存。</div>
            <button
              className="btn btn-primary"
              disabled={!props.analysisResult || busy}
              onClick={props.onRewriteFromAnalysis}
              type="button"
            >
              {props.rewriteLoading ? "다시 작성 중입니다." : "제안에 따라 수정하여 적용합니다."}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
