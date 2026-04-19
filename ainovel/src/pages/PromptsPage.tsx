import { WizardNextBar } from "../components/atelier/WizardNextBar";
import { LlmPresetPanel } from "../components/prompts/LlmPresetPanel";
import { UnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { copyText } from "../lib/copyText";

import { PromptsVectorRagSection } from "./prompts/PromptsVectorRagSection";
import { usePromptsPageState } from "./prompts/usePromptsPageState";

function PromptsPageSkeleton() {
  return (
    <div className="grid gap-6 pb-24" aria-busy="true" aria-live="polite">
      <span className="sr-only">모델 구성 파일을 불러오는 중입니다.…</span>
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="skeleton h-6 w-44" />
            <div className="skeleton h-4 w-72" />
          </div>
          <div className="skeleton h-9 w-40" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-28 w-full sm:col-span-2" />
        </div>
      </div>
      <div className="panel p-6">
        <div className="skeleton h-5 w-40" />
        <div className="mt-3 grid gap-2">
          <div className="skeleton h-4 w-80" />
          <div className="skeleton h-4 w-72" />
        </div>
      </div>
    </div>
  );
}

function PromptsPageErrorState(props: { message: string; code: string; requestId?: string; onRetry: () => void }) {
  return (
    <div className="grid gap-6 pb-24">
      <div className="error-card">
        <div className="state-title">불러오기 실패.</div>
        <div className="state-desc">{`${props.message} (${props.code})`}</div>
        {props.requestId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtext">
            <span>request_id: {props.requestId}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void copyText(props.requestId!, { title: "요청 ID를 복사합니다." })}
              type="button"
            >
              복사하다. request_id
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={props.onRetry} type="button">
            다시 시도하세요.
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptsPage() {
  const state = usePromptsPageState();

  if (state.loading) return <PromptsPageSkeleton />;

  if (state.blockingLoadError) {
    return (
      <PromptsPageErrorState
        message={state.blockingLoadError.message}
        code={state.blockingLoadError.code}
        requestId={state.blockingLoadError.requestId}
        onRetry={() => void state.reloadAll()}
      />
    );
  }

  return (
    <div className="grid gap-6 pb-24">
      {state.dirty && state.outletActive ? <UnsavedChangesGuard when={state.dirty} /> : null}
      <LlmPresetPanel {...state.llmPresetPanelProps} />
      <PromptsVectorRagSection {...state.vectorRagSectionProps} />

      <div className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">프롬프트 엔지니어링 스튜디오(프롬프트 제작 스튜디오)beta）</div>
            <div className="text-xs text-subtext">프롬프트는 ‘프롬프트 스튜디오’에서만 수정할 수 있습니다./실제 발송 내용과 동일하게 미리보기 제공.。</div>
          </div>
          <button className="btn btn-secondary" onClick={state.goToPromptStudio} type="button">
            프롬프트 편집기를 실행합니다.
          </button>
        </div>
      </div>

      <div className="text-xs text-subtext">단축키:Ctrl/Cmd + S 저장 (저장만) LLM 구성.</div>

      <WizardNextBar {...state.wizardBarProps} />
    </div>
  );
}
