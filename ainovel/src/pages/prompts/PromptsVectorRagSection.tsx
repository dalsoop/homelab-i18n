import type { Dispatch, SetStateAction } from "react";

import { RequestIdBadge } from "../../components/ui/RequestIdBadge";
import { UI_COPY } from "../../lib/uiCopy";
import type { ProjectSettings } from "../../types";

import { PROMPTS_COPY } from "./promptsCopy";
import type { VectorEmbeddingDryRunResult, VectorRagForm, VectorRerankDryRunResult } from "./models";

type DryRunErrorState = {
  message: string;
  code: string;
  requestId?: string;
};

type DryRunState<T> = {
  requestId: string;
  result: T;
};

export type PromptsVectorRagSectionProps = {
  baselineSettings: ProjectSettings | null;
  vectorForm: VectorRagForm;
  setVectorForm: Dispatch<SetStateAction<VectorRagForm>>;
  vectorRerankTopKDraft: string;
  setVectorRerankTopKDraft: Dispatch<SetStateAction<string>>;
  vectorRerankTimeoutDraft: string;
  setVectorRerankTimeoutDraft: Dispatch<SetStateAction<string>>;
  vectorRerankHybridAlphaDraft: string;
  setVectorRerankHybridAlphaDraft: Dispatch<SetStateAction<string>>;
  vectorApiKeyDraft: string;
  setVectorApiKeyDraft: Dispatch<SetStateAction<string>>;
  vectorApiKeyClearRequested: boolean;
  setVectorApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  rerankApiKeyDraft: string;
  setRerankApiKeyDraft: Dispatch<SetStateAction<string>>;
  rerankApiKeyClearRequested: boolean;
  setRerankApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  savingVector: boolean;
  vectorRagDirty: boolean;
  vectorApiKeyDirty: boolean;
  rerankApiKeyDirty: boolean;
  embeddingProviderPreview: string;
  embeddingDryRunLoading: boolean;
  embeddingDryRun: DryRunState<VectorEmbeddingDryRunResult> | null;
  embeddingDryRunError: DryRunErrorState | null;
  rerankDryRunLoading: boolean;
  rerankDryRun: DryRunState<VectorRerankDryRunResult> | null;
  rerankDryRunError: DryRunErrorState | null;
  onSave: () => void;
  onRunEmbeddingDryRun: () => void;
  onRunRerankDryRun: () => void;
};

export function PromptsVectorRagSection(props: PromptsVectorRagSectionProps) {
  const {
    baselineSettings,
    vectorForm,
    setVectorForm,
    vectorRerankTopKDraft,
    setVectorRerankTopKDraft,
    vectorRerankTimeoutDraft,
    setVectorRerankTimeoutDraft,
    vectorRerankHybridAlphaDraft,
    setVectorRerankHybridAlphaDraft,
    vectorApiKeyDraft,
    setVectorApiKeyDraft,
    vectorApiKeyClearRequested,
    setVectorApiKeyClearRequested,
    rerankApiKeyDraft,
    setRerankApiKeyDraft,
    rerankApiKeyClearRequested,
    setRerankApiKeyClearRequested,
    savingVector,
    vectorRagDirty,
    vectorApiKeyDirty,
    rerankApiKeyDirty,
    embeddingProviderPreview,
    embeddingDryRunLoading,
    embeddingDryRun,
    embeddingDryRunError,
    rerankDryRunLoading,
    rerankDryRun,
    rerankDryRunError,
    onSave,
    onRunEmbeddingDryRun,
    onRunRerankDryRun,
  } = props;

  return (
    <section className="panel p-6" id="rag-config" aria-label={UI_COPY.vectorRag.title} role="region">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="font-content text-xl text-ink">{UI_COPY.vectorRag.title}</div>
          <div className="text-xs text-subtext">{UI_COPY.vectorRag.subtitle}</div>
          <div className="text-xs text-subtext">{UI_COPY.vectorRag.apiKeyHint}</div>
        </div>
        <button
          className="btn btn-primary"
          disabled={savingVector || (!vectorRagDirty && !vectorApiKeyDirty && !rerankApiKeyDirty)}
          onClick={onSave}
          type="button"
        >
          {UI_COPY.vectorRag.save}
        </button>
      </div>

      {baselineSettings ? (
        <div className="mt-4 grid gap-4">
          <div className="rounded-atelier border border-border bg-canvas p-4 text-xs text-subtext">
            <div>
              현재 유효:Embedding 제공자(제공하는 주체).provider）=
              {baselineSettings.vector_embedding_effective_provider || "openai_compatible"}
              （상태.: {baselineSettings.vector_embedding_effective_disabled_reason ?? "enabled"}；출처.:{" "}
              {baselineSettings.vector_embedding_effective_source}）
            </div>
            <div className="mt-1">
              Rerank：{baselineSettings.vector_rerank_effective_enabled ? "enabled" : "disabled"}（method:{" "}
              {baselineSettings.vector_rerank_effective_method}；provider:{" "}
              {baselineSettings.vector_rerank_effective_provider || "(공)"}；model:{" "}
              {baselineSettings.vector_rerank_effective_model || "(공)"}；top_k:{" "}
              {baselineSettings.vector_rerank_effective_top_k}；alpha:{" "}
              {baselineSettings.vector_rerank_effective_hybrid_alpha ?? 0}；출처.:{" "}
              {baselineSettings.vector_rerank_effective_source}；구성, 설정, 장비 구성 (문맥에 따라 적절하게 선택):{" "}
              {baselineSettings.vector_rerank_effective_config_source}）
            </div>
          </div>

          <div className="rounded-atelier border border-border bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink">{UI_COPY.vectorRag.dryRunTitle}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={
                    savingVector ||
                    embeddingDryRunLoading ||
                    rerankDryRunLoading ||
                    vectorRagDirty ||
                    vectorApiKeyDirty ||
                    rerankApiKeyDirty
                  }
                  onClick={onRunEmbeddingDryRun}
                  type="button"
                >
                  {embeddingDryRunLoading ? "임베딩 테스트 중…" : "임베딩 테스트."}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={
                    savingVector ||
                    embeddingDryRunLoading ||
                    rerankDryRunLoading ||
                    vectorRagDirty ||
                    vectorApiKeyDirty ||
                    rerankApiKeyDirty
                  }
                  onClick={onRunRerankDryRun}
                  type="button"
                >
                  {rerankDryRunLoading ? "재평가 및 순위 재조정 테스트…" : "재평가 테스트."}
                </button>
              </div>
            </div>
            {vectorRagDirty || vectorApiKeyDirty || rerankApiKeyDirty ? (
              <div className="mt-1 text-[11px] text-subtext">{PROMPTS_COPY.vectorRag.saveBeforeTestHint}</div>
            ) : null}

            {embeddingDryRunError ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-danger">
                  Embedding 테스트 실패:{embeddingDryRunError.message} ({embeddingDryRunError.code})
                </div>
                <RequestIdBadge requestId={embeddingDryRunError.requestId} className="mt-2" />
                <div className="mt-1 text-[11px] text-subtext">
                  장애물 제거: 점검. embedding base_url/model/api_key；백엔드 로그를 열고 검색합니다. request_id。
                </div>
              </div>
            ) : null}

            {embeddingDryRun ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-subtext">
                  Embedding：{embeddingDryRun.result.enabled ? "enabled" : "disabled"}；dims:
                  {embeddingDryRun.result.dims ?? "(알 수 없음)"}；시간 소요.:
                  {embeddingDryRun.result.timings_ms?.total ?? "(알 수 없음)"}ms
                  {embeddingDryRun.result.error ? `；error: ${embeddingDryRun.result.error}` : ""}
                </div>
                <RequestIdBadge requestId={embeddingDryRun.requestId} className="mt-2" />
              </div>
            ) : null}

            {rerankDryRunError ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-danger">
                  Rerank 테스트 실패:{rerankDryRunError.message} ({rerankDryRunError.code})
                </div>
                <RequestIdBadge requestId={rerankDryRunError.requestId} className="mt-2" />
                <div className="mt-1 text-[11px] text-subtext">
                  장애물 제거: 점검. rerank base_url/model/api_key；사용하는 경우. external_rerank_api，확인했습니다. /v1/rerank 접근 가능.。
                </div>
              </div>
            ) : null}

            {rerankDryRun ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-subtext">
                  Rerank：{rerankDryRun.result.enabled ? "enabled" : "disabled"}；method:
                  {rerankDryRun.result.method ?? "(알 수 없음)"}；provider:
                  {(rerankDryRun.result.rerank as { provider?: string } | undefined)?.provider ?? "(알 수 없음)"}；시간 소요.:
                  {rerankDryRun.result.timings_ms?.total ?? "(알 수 없음)"}ms；order:
                  {(rerankDryRun.result.order ?? []).join(" → ") || "(공)"}
                </div>
                <RequestIdBadge requestId={rerankDryRun.requestId} className="mt-2" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="text-sm text-ink">{UI_COPY.vectorRag.rerankTitle}</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-3">
                <input
                  className="checkbox"
                  checked={vectorForm.vector_rerank_enabled}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_enabled: e.target.checked }))}
                  type="checkbox"
                  name="vector_rerank_enabled"
                />
                활성화하다. rerank（후보 세그먼트의 관련성을 기준으로 재정렬합니다.
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-subtext">재정렬 알고리즘(rerank method）</span>
                <select
                  className="select"
                  value={vectorForm.vector_rerank_method}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_method: e.target.value }))}
                  name="vector_rerank_method"
                >
                  <option value="auto">auto</option>
                  <option value="rapidfuzz_token_set_ratio">rapidfuzz_token_set_ratio</option>
                  <option value="token_overlap">token_overlap</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">후보자 수 (후보자 명수)top_k）</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={1000}
                  value={vectorRerankTopKDraft}
                  onBlur={() => {
                    const raw = vectorRerankTopKDraft.trim();
                    if (!raw) {
                      setVectorRerankTopKDraft(String(vectorForm.vector_rerank_top_k));
                      return;
                    }
                    const next = Math.floor(Number(raw));
                    if (!Number.isFinite(next)) {
                      setVectorRerankTopKDraft(String(vectorForm.vector_rerank_top_k));
                      return;
                    }
                    const clamped = Math.max(1, Math.min(1000, next));
                    setVectorForm((v) => ({ ...v, vector_rerank_top_k: clamped }));
                    setVectorRerankTopKDraft(String(clamped));
                  }}
                  onChange={(e) => setVectorRerankTopKDraft(e.target.value)}
                  name="vector_rerank_top_k"
                />
              </label>
            </div>
            <div className="text-[11px] text-subtext">
              참고: 활성화하면 검색 결과에 대해 추가적인 순위 재정렬을 수행하여 일반적으로 더 정확한 결과를 얻을 수 있지만, 처리 시간이 다소 늘어날 수 있습니다./비용.。
            </div>
          </div>

          <details className="rounded-atelier border border-border bg-canvas p-4" aria-label="재정렬 결과 제공업체 구성.">
            <summary className="ui-transition-fast cursor-pointer select-none text-sm text-ink hover:text-ink">
              {UI_COPY.vectorRag.rerankConfigDetailsTitle}
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="text-xs text-subtext">{UI_COPY.vectorRag.backendEnvFallbackHint}</div>
              <div className="text-xs text-subtext">
                활성화하다. external_rerank_api：method 유지하는 것이 좋겠습니다. auto；provider 선택하다. external_rerank_api，그리고 작성하십시오.
                base_url/model（선택 가능. api_key）。
              </div>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankProviderLabel}</span>
                <select
                  className="select"
                  value={vectorForm.vector_rerank_provider}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_provider: e.target.value }))}
                  name="vector_rerank_provider"
                >
                  <option value="">（백엔드 환경 변수 사용.</option>
                  <option value="external_rerank_api">external_rerank_api</option>
                </select>
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_rerank_effective_provider || "(공)"}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankBaseUrlLabel}</span>
                <input
                  className="input"
                  value={vectorForm.vector_rerank_base_url}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVectorForm((v) => {
                      const shouldAutoSetProvider = !v.vector_rerank_provider.trim() && next.trim().length > 0;
                      return {
                        ...v,
                        vector_rerank_base_url: next,
                        ...(shouldAutoSetProvider ? { vector_rerank_provider: "external_rerank_api" } : {}),
                      };
                    });
                  }}
                  name="vector_rerank_base_url"
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_rerank_effective_base_url || "(공)"}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankModelLabel}</span>
                <input
                  className="input"
                  value={vectorForm.vector_rerank_model}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_model: e.target.value }))}
                  name="vector_rerank_model"
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_rerank_effective_model || "(공)"}
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankTimeoutLabel}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={120}
                    value={vectorRerankTimeoutDraft}
                    onBlur={() => {
                      const raw = vectorRerankTimeoutDraft.trim();
                      if (!raw) {
                        setVectorForm((v) => ({ ...v, vector_rerank_timeout_seconds: null }));
                        setVectorRerankTimeoutDraft("");
                        return;
                      }
                      const next = Math.floor(Number(raw));
                      if (!Number.isFinite(next)) {
                        setVectorRerankTimeoutDraft(
                          vectorForm.vector_rerank_timeout_seconds != null
                            ? String(vectorForm.vector_rerank_timeout_seconds)
                            : "",
                        );
                        return;
                      }
                      const clamped = Math.max(1, Math.min(120, next));
                      setVectorForm((v) => ({ ...v, vector_rerank_timeout_seconds: clamped }));
                      setVectorRerankTimeoutDraft(String(clamped));
                    }}
                    onChange={(e) => setVectorRerankTimeoutDraft(e.target.value)}
                    name="vector_rerank_timeout_seconds"
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{baselineSettings.vector_rerank_effective_timeout_seconds ?? 15}
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankHybridAlphaLabel}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={vectorRerankHybridAlphaDraft}
                    onBlur={() => {
                      const raw = vectorRerankHybridAlphaDraft.trim();
                      if (!raw) {
                        setVectorForm((v) => ({ ...v, vector_rerank_hybrid_alpha: null }));
                        setVectorRerankHybridAlphaDraft("");
                        return;
                      }
                      const next = Number(raw);
                      if (!Number.isFinite(next)) {
                        setVectorRerankHybridAlphaDraft(
                          vectorForm.vector_rerank_hybrid_alpha != null
                            ? String(vectorForm.vector_rerank_hybrid_alpha)
                            : "",
                        );
                        return;
                      }
                      const clamped = Math.max(0, Math.min(1, next));
                      setVectorForm((v) => ({ ...v, vector_rerank_hybrid_alpha: clamped }));
                      setVectorRerankHybridAlphaDraft(String(clamped));
                    }}
                    onChange={(e) => setVectorRerankHybridAlphaDraft(e.target.value)}
                    name="vector_rerank_hybrid_alpha"
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{baselineSettings.vector_rerank_effective_hybrid_alpha ?? 0}
                  </div>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankApiKeyLabel}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={rerankApiKeyDraft}
                  onChange={(e) => {
                    setRerankApiKeyDraft(e.target.value);
                    setRerankApiKeyClearRequested(false);
                  }}
                  name="vector_rerank_api_key"
                />
                <div className="text-[11px] text-subtext">
                  저장됨 (덮어쓰기):
                  {baselineSettings.vector_rerank_has_api_key
                    ? baselineSettings.vector_rerank_masked_api_key
                    : "(해당 사항 없음)"}
                  {baselineSettings.vector_rerank_effective_has_api_key
                    ? ` | 현재 유효합니다.${baselineSettings.vector_rerank_effective_masked_api_key}`
                    : "현재 유효한 항목은 없습니다. (현재 유효한 것은 없습니다.)"}
                  {rerankApiKeyClearRequested ? UI_COPY.vectorRag.pendingClearSuffix : ""}
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={savingVector || !baselineSettings.vector_rerank_has_api_key}
                  onClick={() => {
                    setRerankApiKeyDraft("");
                    setRerankApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  {UI_COPY.vectorRag.rerankClearApiKey}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={savingVector}
                  onClick={() => {
                    setVectorForm((v) => ({
                      ...v,
                      vector_rerank_provider: "",
                      vector_rerank_base_url: "",
                      vector_rerank_model: "",
                      vector_rerank_timeout_seconds: null,
                      vector_rerank_hybrid_alpha: null,
                    }));
                    setVectorRerankTimeoutDraft("");
                    setVectorRerankHybridAlphaDraft("");
                    setRerankApiKeyDraft("");
                    setRerankApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  {UI_COPY.vectorRag.rerankResetOverrides}
                </button>
              </div>
            </div>
          </details>

          <details className="rounded-atelier border border-border bg-canvas p-4">
            <summary className="ui-transition-fast cursor-pointer select-none text-sm text-ink hover:text-ink">
              {UI_COPY.vectorRag.embeddingTitle}
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="text-xs text-subtext">{UI_COPY.vectorRag.backendEnvFallbackHint}</div>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">
                  Embedding 제공자(제공하는 주체).provider；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                </span>
                <select
                  className="select"
                  value={vectorForm.vector_embedding_provider}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_provider: e.target.value }))}
                  name="vector_embedding_provider"
                >
                  <option value="">（백엔드 환경 변수 사용.</option>
                  <option value="openai_compatible">openai_compatible</option>
                  <option value="azure_openai">azure_openai</option>
                  <option value="google">google</option>
                  <option value="custom">custom</option>
                  <option value="local_proxy">local_proxy</option>
                  <option value="sentence_transformers">sentence_transformers</option>
                </select>
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_embedding_effective_provider || "openai_compatible"}
                </div>
              </label>

              {embeddingProviderPreview === "azure_openai" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">
                      Azure 부서명 (deployment；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                    </span>
                    <input
                      className="input"
                      value={vectorForm.vector_embedding_azure_deployment}
                      onChange={(e) =>
                        setVectorForm((v) => ({ ...v, vector_embedding_azure_deployment: e.target.value }))
                      }
                      name="vector_embedding_azure_deployment"
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{baselineSettings.vector_embedding_effective_azure_deployment || "(공)"}
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">
                      Azure API 버전.api_version；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                    </span>
                    <input
                      className="input"
                      value={vectorForm.vector_embedding_azure_api_version}
                      onChange={(e) =>
                        setVectorForm((v) => ({ ...v, vector_embedding_azure_api_version: e.target.value }))
                      }
                      name="vector_embedding_azure_api_version"
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{baselineSettings.vector_embedding_effective_azure_api_version || "(공)"}
                    </div>
                  </label>
                </div>
              ) : null}

              {embeddingProviderPreview === "sentence_transformers" ? (
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">
                    SentenceTransformers 모델(프로젝트 범위; 비워두기)=백엔드 환경 변수 사용.
                  </span>
                  <input
                    className="input"
                    value={vectorForm.vector_embedding_sentence_transformers_model}
                    onChange={(e) =>
                      setVectorForm((v) => ({
                        ...v,
                        vector_embedding_sentence_transformers_model: e.target.value,
                      }))
                    }
                    name="vector_embedding_sentence_transformers_model"
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{baselineSettings.vector_embedding_effective_sentence_transformers_model || "(공)"}
                  </div>
                </label>
              ) : null}

              <label className="grid gap-1">
                <span className="text-xs text-subtext">
                  Embedding 기본 주소(base_url；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                </span>
                <input
                  className="input"
                  id="vector_embedding_base_url"
                  name="vector_embedding_base_url"
                  value={vectorForm.vector_embedding_base_url}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_base_url: e.target.value }))}
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_embedding_effective_base_url || "(공)"}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">Embedding 모델(model；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.</span>
                <input
                  className="input"
                  id="vector_embedding_model"
                  name="vector_embedding_model"
                  value={vectorForm.vector_embedding_model}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_model: e.target.value }))}
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{baselineSettings.vector_embedding_effective_model || "(공)"}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">API Key（api_key；해당 항목은 변경하지 않고 그대로 둡니다. (해당 항목에 내용이 없을 경우, 빈칸으로 둡니다.)</span>
                <input
                  className="input"
                  id="vector_embedding_api_key"
                  name="vector_embedding_api_key"
                  type="password"
                  autoComplete="off"
                  value={vectorApiKeyDraft}
                  onChange={(e) => {
                    setVectorApiKeyDraft(e.target.value);
                    setVectorApiKeyClearRequested(false);
                  }}
                />
                <div className="text-[11px] text-subtext">
                  저장됨 (덮어쓰기):
                  {baselineSettings.vector_embedding_has_api_key
                    ? baselineSettings.vector_embedding_masked_api_key
                    : "(해당 사항 없음)"}
                  {baselineSettings.vector_embedding_effective_has_api_key
                    ? ` | 현재 유효합니다.${baselineSettings.vector_embedding_effective_masked_api_key}`
                    : "현재 유효한 항목은 없습니다. (현재 유효한 것은 없습니다.)"}
                  {vectorApiKeyClearRequested ? UI_COPY.vectorRag.pendingClearSuffix : ""}
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={savingVector || !baselineSettings.vector_embedding_has_api_key}
                  onClick={() => {
                    setVectorApiKeyDraft("");
                    setVectorApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  {UI_COPY.vectorRag.embeddingClearApiKey}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={savingVector}
                  onClick={() => {
                    setVectorForm((v) => ({
                      ...v,
                      vector_embedding_provider: "",
                      vector_embedding_base_url: "",
                      vector_embedding_model: "",
                      vector_embedding_azure_deployment: "",
                      vector_embedding_azure_api_version: "",
                      vector_embedding_sentence_transformers_model: "",
                    }));
                    setVectorApiKeyDraft("");
                    setVectorApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  백엔드 환경 변수 사용 재개 (프로젝트 설정을 덮어쓰지 않도록 설정)
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-4 text-xs text-subtext">벡터 검색 구성 정보를 불러오는 중입니다.…</div>
      )}
    </section>
  );
}
