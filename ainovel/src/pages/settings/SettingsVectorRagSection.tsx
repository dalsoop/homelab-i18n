import type { Dispatch, SetStateAction } from "react";

import { RequestIdBadge } from "../../components/ui/RequestIdBadge";
import { UI_COPY } from "../../lib/uiCopy";
import type { ProjectSettings } from "../../types";

import type { SettingsForm, VectorEmbeddingDryRunResult, VectorRerankDryRunResult } from "./models";
import { SETTINGS_COPY } from "./settingsCopy";

export type SettingsVectorRagSectionProps = {
  projectId?: string;
  onOpenPromptsConfig: () => void;
  baselineSettings: ProjectSettings;
  settingsForm: SettingsForm;
  setSettingsForm: Dispatch<SetStateAction<SettingsForm>>;
  saving: boolean;
  dirty: boolean;
  vectorApiKeyDirty: boolean;
  rerankApiKeyDirty: boolean;
  vectorRerankTopKDraft: string;
  setVectorRerankTopKDraft: Dispatch<SetStateAction<string>>;
  vectorRerankTimeoutDraft: string;
  setVectorRerankTimeoutDraft: Dispatch<SetStateAction<string>>;
  vectorRerankHybridAlphaDraft: string;
  setVectorRerankHybridAlphaDraft: Dispatch<SetStateAction<string>>;
  rerankApiKeyDraft: string;
  setRerankApiKeyDraft: Dispatch<SetStateAction<string>>;
  rerankApiKeyClearRequested: boolean;
  setRerankApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  vectorApiKeyDraft: string;
  setVectorApiKeyDraft: Dispatch<SetStateAction<string>>;
  vectorApiKeyClearRequested: boolean;
  setVectorApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  embeddingProviderPreview: string;
  embeddingDryRunLoading: boolean;
  embeddingDryRun: null | { requestId: string; result: VectorEmbeddingDryRunResult };
  embeddingDryRunError: null | { message: string; code: string; requestId?: string };
  rerankDryRunLoading: boolean;
  rerankDryRun: null | { requestId: string; result: VectorRerankDryRunResult };
  rerankDryRunError: null | { message: string; code: string; requestId?: string };
  onRunEmbeddingDryRun: () => void;
  onRunRerankDryRun: () => void;
};

export function SettingsVectorRagSection(props: SettingsVectorRagSectionProps) {
  return (
    <details className="panel" aria-label="벡터 검색 (벡터 기반 RAG)">
      <summary className="ui-focus-ring ui-transition-fast cursor-pointer select-none p-6">
        <div className="grid gap-1">
          <div className="font-content text-xl text-ink">{UI_COPY.vectorRag.title}</div>
          <div className="text-xs text-subtext">{UI_COPY.vectorRag.subtitle}</div>
          <div className="text-xs text-subtext">{UI_COPY.vectorRag.apiKeyHint}</div>
        </div>
      </summary>

      <div className="px-6 pb-6 pt-0">
        <div className="mt-4 grid gap-4">
          {props.projectId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-atelier border border-border bg-canvas p-4 text-xs text-subtext">
              <div className="min-w-0">{SETTINGS_COPY.vectorRag.openPromptsConfigHint}</div>
              <button className="btn btn-secondary" onClick={props.onOpenPromptsConfig} type="button">
                {SETTINGS_COPY.vectorRag.openPromptsConfigCta}
              </button>
            </div>
          ) : null}

          <div className="rounded-atelier border border-border bg-canvas p-4 text-xs text-subtext">
            <div className="font-medium text-ink">구성 사양 (Embedding vs Rerank）</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-mono">Embedding</span> 벡터화(색인)에 사용됩니다./리콜(회수)
                <span className="font-mono">Rerank</span>
                후보 세그먼트를 재정렬하는 데 사용됩니다. 두 가지 설정을 각각 구성할 수 있습니다.provider/base_url/model/api_key 다를 수 있음.。
              </li>
              <li>
                저장한 후 상단의 “테스트” 버튼을 사용할 수 있습니다. embedding / 테스트. rerank” 하다. <span className="font-mono">dry-run</span>
                자체 점검(결과를 반환합니다). request_id，백엔드 로그를 쉽게 확인하여 문제 해결 및 디버깅에 용이하도록.。
              </li>
              <li>
                정상 작동 여부 확인: 프로젝트 내부로 이동.「RAG」페이지 실행 중. Query；결과 패널에 표시됩니다. <span className="font-mono">rerank:</span>
                개요이며, 필요에 따라 자세한 내용을 추가할 수 있습니다. <span className="font-mono">rerank_obs</span> 자세히 보기.。
              </li>
            </ul>
          </div>

          <div className="rounded-atelier border border-border bg-canvas p-4 text-xs text-subtext">
            <div>
              현재 유효:Embedding 제공자(제공하는 주체).provider）=
              {props.baselineSettings.vector_embedding_effective_provider || "openai_compatible"}
              （상태.: {props.baselineSettings.vector_embedding_effective_disabled_reason ?? "enabled"}；출처:
              {props.baselineSettings.vector_embedding_effective_source}）
            </div>
            <div className="mt-1">
              Rerank：{props.baselineSettings.vector_rerank_effective_enabled ? "enabled" : "disabled"}（method:
              {props.baselineSettings.vector_rerank_effective_method}；provider:
              {props.baselineSettings.vector_rerank_effective_provider || "(공)"}；model:
              {props.baselineSettings.vector_rerank_effective_model || "(공)"}；top_k:
              {props.baselineSettings.vector_rerank_effective_top_k}；alpha:
              {props.baselineSettings.vector_rerank_effective_hybrid_alpha ?? 0}；출처.:
              {props.baselineSettings.vector_rerank_effective_source}；구성, 설정, 장비 구성 (문맥에 따라 적절하게 선택):
              {props.baselineSettings.vector_rerank_effective_config_source}）
            </div>
          </div>

          <div className="rounded-atelier border border-border bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink">{UI_COPY.vectorRag.dryRunTitle}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={
                    props.saving ||
                    props.dirty ||
                    props.embeddingDryRunLoading ||
                    props.rerankDryRunLoading ||
                    props.vectorApiKeyDirty ||
                    props.rerankApiKeyDirty
                  }
                  onClick={props.onRunEmbeddingDryRun}
                  type="button"
                >
                  {props.embeddingDryRunLoading ? "임베딩 테스트 중…" : "임베딩 테스트."}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={
                    props.saving ||
                    props.dirty ||
                    props.embeddingDryRunLoading ||
                    props.rerankDryRunLoading ||
                    props.vectorApiKeyDirty ||
                    props.rerankApiKeyDirty
                  }
                  onClick={props.onRunRerankDryRun}
                  type="button"
                >
                  {props.rerankDryRunLoading ? "재평가 및 순위 재조정 테스트…" : "재평가 테스트."}
                </button>
              </div>
            </div>
            {props.dirty || props.vectorApiKeyDirty || props.rerankApiKeyDirty ? (
              <div className="mt-1 text-[11px] text-subtext">{SETTINGS_COPY.vectorRag.saveBeforeTestHint}</div>
            ) : null}

            {props.embeddingDryRunError ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-danger">
                  Embedding 테스트 실패:{props.embeddingDryRunError.message} ({props.embeddingDryRunError.code})
                </div>
                <RequestIdBadge requestId={props.embeddingDryRunError.requestId} className="mt-2" />
                <div className="mt-1 text-[11px] text-subtext">
                  장애물 제거: 점검. embedding base_url/model/api_key；백엔드 로그를 열고 검색합니다. request_id。
                </div>
              </div>
            ) : null}

            {props.embeddingDryRun ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-subtext">
                  Embedding：{props.embeddingDryRun.result.enabled ? "enabled" : "disabled"}；dims:
                  {props.embeddingDryRun.result.dims ?? "(알 수 없음)"}；시간 소요.:
                  {props.embeddingDryRun.result.timings_ms?.total ?? "(알 수 없음)"}ms
                  {props.embeddingDryRun.result.error ? `；error: ${props.embeddingDryRun.result.error}` : ""}
                </div>
                <RequestIdBadge requestId={props.embeddingDryRun.requestId} className="mt-2" />
              </div>
            ) : null}

            {props.rerankDryRunError ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-danger">
                  Rerank 테스트 실패:{props.rerankDryRunError.message} ({props.rerankDryRunError.code})
                </div>
                <RequestIdBadge requestId={props.rerankDryRunError.requestId} className="mt-2" />
                <div className="mt-1 text-[11px] text-subtext">
                  장애물 제거: 점검. rerank base_url/model/api_key；사용하는 경우. external_rerank_api，확인했습니다. /v1/rerank 접근 가능.。
                </div>
              </div>
            ) : null}

            {props.rerankDryRun ? (
              <div className="mt-3 rounded-atelier border border-border bg-surface p-3">
                <div className="text-xs text-subtext">
                  Rerank：{props.rerankDryRun.result.enabled ? "enabled" : "disabled"}；method:
                  {props.rerankDryRun.result.method ?? "(알 수 없음)"}；provider:
                  {(props.rerankDryRun.result.rerank as { provider?: string } | undefined)?.provider ?? "(알 수 없음)"}
                  ；시간 소요.:
                  {props.rerankDryRun.result.timings_ms?.total ?? "(알 수 없음)"}ms；order:
                  {(props.rerankDryRun.result.order ?? []).join(" → ") || "(공)"}
                </div>
                <RequestIdBadge requestId={props.rerankDryRun.requestId} className="mt-2" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="text-sm text-ink">{UI_COPY.vectorRag.rerankTitle}</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-3">
                <input
                  className="checkbox"
                  checked={props.settingsForm.vector_rerank_enabled}
                  onChange={(e) =>
                    props.setSettingsForm((value) => ({ ...value, vector_rerank_enabled: e.target.checked }))
                  }
                  type="checkbox"
                />
                활성화하다. rerank（후보 세그먼트의 관련성을 기준으로 재정렬합니다.
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-subtext">재정렬 알고리즘(rerank method）</span>
                <select
                  className="select"
                  id="settings_vector_rerank_method"
                  name="vector_rerank_method"
                  aria-label="settings_vector_rerank_method"
                  value={props.settingsForm.vector_rerank_method}
                  onChange={(e) =>
                    props.setSettingsForm((value) => ({ ...value, vector_rerank_method: e.target.value }))
                  }
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
                  id="settings_vector_rerank_top_k"
                  name="vector_rerank_top_k"
                  aria-label="settings_vector_rerank_top_k"
                  type="number"
                  min={1}
                  max={1000}
                  value={props.vectorRerankTopKDraft}
                  onBlur={() => {
                    const raw = props.vectorRerankTopKDraft.trim();
                    if (!raw) {
                      props.setVectorRerankTopKDraft(String(props.settingsForm.vector_rerank_top_k));
                      return;
                    }
                    const next = Math.floor(Number(raw));
                    if (!Number.isFinite(next)) {
                      props.setVectorRerankTopKDraft(String(props.settingsForm.vector_rerank_top_k));
                      return;
                    }
                    const clamped = Math.max(1, Math.min(1000, next));
                    props.setSettingsForm((value) => ({ ...value, vector_rerank_top_k: clamped }));
                    props.setVectorRerankTopKDraft(String(clamped));
                  }}
                  onChange={(e) => props.setVectorRerankTopKDraft(e.target.value)}
                />
              </label>
            </div>
            <div className="text-[11px] text-subtext">
              참고: 활성화하면 검색 결과에 대해 추가적인 순위 재정렬을 수행하여 일반적으로 더 정확한 결과를 얻을 수 있지만, 처리 시간이 다소 늘어날 수 있습니다./비용.。
            </div>

            <details className="rounded-atelier border border-border bg-canvas p-4" aria-label="재정렬 결과 제공업체 구성.">
              <summary className="ui-transition-fast cursor-pointer select-none text-sm text-ink hover:text-ink">
                {UI_COPY.vectorRag.rerankConfigDetailsTitle}
              </summary>
              <div className="mt-4 grid gap-4">
                <div className="text-xs text-subtext">{UI_COPY.vectorRag.backendEnvFallbackHint}</div>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankProviderLabel}</span>
                  <select
                    className="select"
                    id="settings_vector_rerank_provider"
                    name="vector_rerank_provider"
                    aria-label="settings_vector_rerank_provider"
                    value={props.settingsForm.vector_rerank_provider}
                    onChange={(e) =>
                      props.setSettingsForm((value) => ({ ...value, vector_rerank_provider: e.target.value }))
                    }
                  >
                    <option value="">（백엔드 환경 변수 사용.</option>
                    <option value="external_rerank_api">external_rerank_api</option>
                  </select>
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{props.baselineSettings.vector_rerank_effective_provider || "(공)"}
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankBaseUrlLabel}</span>
                  <input
                    className="input"
                    id="settings_vector_rerank_base_url"
                    name="vector_rerank_base_url"
                    aria-label="settings_vector_rerank_base_url"
                    value={props.settingsForm.vector_rerank_base_url}
                    onChange={(e) => {
                      const next = e.target.value;
                      props.setSettingsForm((value) => {
                        const shouldAutoSetProvider = !value.vector_rerank_provider.trim() && next.trim().length > 0;
                        return {
                          ...value,
                          vector_rerank_base_url: next,
                          ...(shouldAutoSetProvider ? { vector_rerank_provider: "external_rerank_api" } : {}),
                        };
                      });
                    }}
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{props.baselineSettings.vector_rerank_effective_base_url || "(공)"}
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankModelLabel}</span>
                  <input
                    className="input"
                    id="settings_vector_rerank_model"
                    name="vector_rerank_model"
                    aria-label="settings_vector_rerank_model"
                    value={props.settingsForm.vector_rerank_model}
                    onChange={(e) =>
                      props.setSettingsForm((value) => ({ ...value, vector_rerank_model: e.target.value }))
                    }
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.{props.baselineSettings.vector_rerank_effective_model || "(공)"}
                  </div>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankTimeoutLabel}</span>
                    <input
                      className="input"
                      id="settings_vector_rerank_timeout_seconds"
                      name="vector_rerank_timeout_seconds"
                      aria-label="settings_vector_rerank_timeout_seconds"
                      type="number"
                      min={1}
                      max={120}
                      value={props.vectorRerankTimeoutDraft}
                      onBlur={() => {
                        const raw = props.vectorRerankTimeoutDraft.trim();
                        if (!raw) {
                          props.setSettingsForm((value) => ({ ...value, vector_rerank_timeout_seconds: null }));
                          props.setVectorRerankTimeoutDraft("");
                          return;
                        }
                        const next = Math.floor(Number(raw));
                        if (!Number.isFinite(next)) {
                          props.setVectorRerankTimeoutDraft(
                            props.settingsForm.vector_rerank_timeout_seconds != null
                              ? String(props.settingsForm.vector_rerank_timeout_seconds)
                              : "",
                          );
                          return;
                        }
                        const clamped = Math.max(1, Math.min(120, next));
                        props.setSettingsForm((value) => ({ ...value, vector_rerank_timeout_seconds: clamped }));
                        props.setVectorRerankTimeoutDraft(String(clamped));
                      }}
                      onChange={(e) => props.setVectorRerankTimeoutDraft(e.target.value)}
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{props.baselineSettings.vector_rerank_effective_timeout_seconds ?? 15}
                    </div>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankHybridAlphaLabel}</span>
                    <input
                      className="input"
                      id="settings_vector_rerank_hybrid_alpha"
                      name="vector_rerank_hybrid_alpha"
                      aria-label="settings_vector_rerank_hybrid_alpha"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={props.vectorRerankHybridAlphaDraft}
                      onBlur={() => {
                        const raw = props.vectorRerankHybridAlphaDraft.trim();
                        if (!raw) {
                          props.setSettingsForm((value) => ({ ...value, vector_rerank_hybrid_alpha: null }));
                          props.setVectorRerankHybridAlphaDraft("");
                          return;
                        }
                        const next = Number(raw);
                        if (!Number.isFinite(next)) {
                          props.setVectorRerankHybridAlphaDraft(
                            props.settingsForm.vector_rerank_hybrid_alpha != null
                              ? String(props.settingsForm.vector_rerank_hybrid_alpha)
                              : "",
                          );
                          return;
                        }
                        const clamped = Math.max(0, Math.min(1, next));
                        props.setSettingsForm((value) => ({ ...value, vector_rerank_hybrid_alpha: clamped }));
                        props.setVectorRerankHybridAlphaDraft(String(clamped));
                      }}
                      onChange={(e) => props.setVectorRerankHybridAlphaDraft(e.target.value)}
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{props.baselineSettings.vector_rerank_effective_hybrid_alpha ?? 0}
                    </div>
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">{UI_COPY.vectorRag.rerankApiKeyLabel}</span>
                  <input
                    className="input"
                    id="settings_vector_rerank_api_key"
                    name="vector_rerank_api_key"
                    aria-label="settings_vector_rerank_api_key"
                    type="password"
                    autoComplete="off"
                    value={props.rerankApiKeyDraft}
                    onChange={(e) => {
                      props.setRerankApiKeyDraft(e.target.value);
                      props.setRerankApiKeyClearRequested(false);
                    }}
                  />
                  <div className="text-[11px] text-subtext">
                    저장됨 (덮어쓰기):
                    {props.baselineSettings.vector_rerank_has_api_key
                      ? props.baselineSettings.vector_rerank_masked_api_key
                      : "(해당 사항 없음)"}
                    {props.baselineSettings.vector_rerank_effective_has_api_key
                      ? ` | 현재 유효합니다.${props.baselineSettings.vector_rerank_effective_masked_api_key}`
                      : "현재 유효한 항목은 없습니다. (현재 유효한 것은 없습니다.)"}
                    {props.rerankApiKeyClearRequested ? UI_COPY.vectorRag.pendingClearSuffix : ""}
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary"
                    aria-label="settings_vector_rerank_api_key_clear"
                    disabled={props.saving || !props.baselineSettings.vector_rerank_has_api_key}
                    onClick={() => {
                      props.setRerankApiKeyDraft("");
                      props.setRerankApiKeyClearRequested(true);
                    }}
                    type="button"
                  >
                    {UI_COPY.vectorRag.rerankClearApiKey}
                  </button>
                  <button
                    className="btn btn-secondary"
                    aria-label="settings_vector_rerank_reset_overrides"
                    disabled={props.saving}
                    onClick={() => {
                      props.setSettingsForm((value) => ({
                        ...value,
                        vector_rerank_provider: "",
                        vector_rerank_base_url: "",
                        vector_rerank_model: "",
                        vector_rerank_timeout_seconds: null,
                        vector_rerank_hybrid_alpha: null,
                      }));
                      props.setVectorRerankTimeoutDraft("");
                      props.setVectorRerankHybridAlphaDraft("");
                      props.setRerankApiKeyDraft("");
                      props.setRerankApiKeyClearRequested(true);
                    }}
                    type="button"
                  >
                    {UI_COPY.vectorRag.rerankResetOverrides}
                  </button>
                </div>
              </div>
            </details>
          </div>

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
                  value={props.settingsForm.vector_embedding_provider}
                  onChange={(e) =>
                    props.setSettingsForm((value) => ({ ...value, vector_embedding_provider: e.target.value }))
                  }
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
                  현재 유효합니다.{props.baselineSettings.vector_embedding_effective_provider || "openai_compatible"}
                </div>
              </label>

              {props.embeddingProviderPreview === "azure_openai" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">
                      Azure 부서명 (deployment；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                    </span>
                    <input
                      className="input"
                      value={props.settingsForm.vector_embedding_azure_deployment}
                      onChange={(e) =>
                        props.setSettingsForm((value) => ({
                          ...value,
                          vector_embedding_azure_deployment: e.target.value,
                        }))
                      }
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{props.baselineSettings.vector_embedding_effective_azure_deployment || "(공)"}
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">
                      Azure API 버전.api_version；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.
                    </span>
                    <input
                      className="input"
                      value={props.settingsForm.vector_embedding_azure_api_version}
                      onChange={(e) =>
                        props.setSettingsForm((value) => ({
                          ...value,
                          vector_embedding_azure_api_version: e.target.value,
                        }))
                      }
                    />
                    <div className="text-[11px] text-subtext">
                      현재 유효합니다.{props.baselineSettings.vector_embedding_effective_azure_api_version || "(공)"}
                    </div>
                  </label>
                </div>
              ) : null}

              {props.embeddingProviderPreview === "sentence_transformers" ? (
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">
                    SentenceTransformers 모델(프로젝트 범위; 비워두기)=백엔드 환경 변수 사용.
                  </span>
                  <input
                    className="input"
                    value={props.settingsForm.vector_embedding_sentence_transformers_model}
                    onChange={(e) =>
                      props.setSettingsForm((value) => ({
                        ...value,
                        vector_embedding_sentence_transformers_model: e.target.value,
                      }))
                    }
                  />
                  <div className="text-[11px] text-subtext">
                    현재 유효합니다.
                    {props.baselineSettings.vector_embedding_effective_sentence_transformers_model || "(공)"}
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
                  value={props.settingsForm.vector_embedding_base_url}
                  onChange={(e) =>
                    props.setSettingsForm((value) => ({ ...value, vector_embedding_base_url: e.target.value }))
                  }
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{props.baselineSettings.vector_embedding_effective_base_url || "(공)"}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-subtext">Embedding 모델(model；프로젝트 범위; 비워두기.=백엔드 환경 변수 사용.</span>
                <input
                  className="input"
                  id="vector_embedding_model"
                  name="vector_embedding_model"
                  value={props.settingsForm.vector_embedding_model}
                  onChange={(e) =>
                    props.setSettingsForm((value) => ({ ...value, vector_embedding_model: e.target.value }))
                  }
                />
                <div className="text-[11px] text-subtext">
                  현재 유효합니다.{props.baselineSettings.vector_embedding_effective_model || "(공)"}
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
                  value={props.vectorApiKeyDraft}
                  onChange={(e) => {
                    props.setVectorApiKeyDraft(e.target.value);
                    props.setVectorApiKeyClearRequested(false);
                  }}
                />
                <div className="text-[11px] text-subtext">
                  저장됨 (덮어쓰기):
                  {props.baselineSettings.vector_embedding_has_api_key
                    ? props.baselineSettings.vector_embedding_masked_api_key
                    : "(해당 사항 없음)"}
                  {props.baselineSettings.vector_embedding_effective_has_api_key
                    ? ` | 현재 유효합니다.${props.baselineSettings.vector_embedding_effective_masked_api_key}`
                    : "현재 유효한 항목은 없습니다. (현재 유효한 것은 없습니다.)"}
                  {props.vectorApiKeyClearRequested ? UI_COPY.vectorRag.pendingClearSuffix : ""}
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={props.saving || !props.baselineSettings.vector_embedding_has_api_key}
                  onClick={() => {
                    props.setVectorApiKeyDraft("");
                    props.setVectorApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  {UI_COPY.vectorRag.embeddingClearApiKey}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={props.saving}
                  onClick={() => {
                    props.setSettingsForm((value) => ({
                      ...value,
                      vector_embedding_provider: "",
                      vector_embedding_base_url: "",
                      vector_embedding_model: "",
                      vector_embedding_azure_deployment: "",
                      vector_embedding_azure_api_version: "",
                      vector_embedding_sentence_transformers_model: "",
                    }));
                    props.setVectorApiKeyDraft("");
                    props.setVectorApiKeyClearRequested(true);
                  }}
                  type="button"
                >
                  백엔드 환경 변수 사용 재개 (프로젝트 설정을 덮어쓰지 않도록 설정)
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </details>
  );
}
