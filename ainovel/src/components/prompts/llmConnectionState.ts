import type { LLMProfile, LLMProvider } from "../../types";

import type { LlmModelListState } from "./types";

export type LlmModuleAccessStage = "missing_profile" | "missing_key" | "provider_mismatch" | "ready";

export type LlmModuleAccessState = {
  stage: LlmModuleAccessStage;
  tone: "warning" | "success";
  title: string;
  detail: string;
  actionReason: string | null;
  effectiveProfile: LLMProfile | null;
};

type DeriveOptions = {
  scope: "main" | "task";
  moduleProvider: LLMProvider;
  selectedProfile: LLMProfile | null;
  boundProfile?: LLMProfile | null;
};

function profileSummary(profile: LLMProfile): string {
  const masked = profile.masked_api_key ? `，Key：${profile.masked_api_key}` : "";
  return `profile「${profile.name}」(${profile.provider}/${profile.model}${masked})`;
}

function createBlockedState(
  stage: Exclude<LlmModuleAccessStage, "ready">,
  title: string,
  detail: string,
  actionReason: string,
  effectiveProfile: LLMProfile | null = null,
): LlmModuleAccessState {
  return {
    stage,
    tone: "warning",
    title,
    detail,
    actionReason,
    effectiveProfile,
  };
}

export function deriveLlmModuleAccessState(options: DeriveOptions): LlmModuleAccessState {
  const boundProfile = options.boundProfile ?? null;
  const effectiveProfile = boundProfile ?? options.selectedProfile ?? null;
  const usingFallback = options.scope === "task" && !boundProfile;
  const sourceLabel = boundProfile ? "작업과 프로필 연결." : usingFallback ? "주 모듈의 프로필을 이전 버전으로 되돌립니다." : "주 모듈 프로필.";

  if (!effectiveProfile) {
    return createBlockedState(
      "missing_profile",
      "원격 연결 상태: 프로필이 연결되지 않았습니다.",
      options.scope === "task"
        ? "현재 작업에는 독립적인 프로필이 연결되어 있지도 않고, 이전 버전으로 되돌릴 수 있는 기본 프로필도 없습니다. 먼저 프로필을 연결한 후 API 키를 저장하십시오."
        : "현재 메인 모듈에는 프로필(API 설정 라이브러리)이 연결되어 있지 않습니다. 먼저 프로필을 선택하거나 새로 만들고, API 키를 저장하십시오.",
      options.scope === "task" ? "해당 작업에 프로필을 연결하거나, 먼저 메인 모듈 프로필을 설정하십시오." : "먼저 메인 모듈 프로필을 연결해 주세요.",
    );
  }

  if (effectiveProfile.provider !== options.moduleProvider) {
    return createBlockedState(
      "provider_mismatch",
      "원격 연결 상태: 제공업체가 일치하지 않음.",
      `현재 모듈. provider = ${options.moduleProvider}，${sourceLabel} provider = ${effectiveProfile.provider}。먼저 두 가지를 일치시킨 후 모델 목록을 가져오거나 연결 테스트를 수행합니다.。`,
      `${sourceLabel} 현재 모듈과 함께. provider 일치하지 않음.。`,
      effectiveProfile,
    );
  }

  if (!effectiveProfile.has_api_key) {
    return createBlockedState(
      "missing_key",
      "원격 연결 상태: 프로필과 연결되었으나 키가 저장되지 않았습니다.",
      `${sourceLabel} 연결되었지만 아직 저장되지 않았습니다. API Key。저장. Key 모델 목록을 가져오거나 연결 테스트를 수행하기 전에 먼저 해당 작업을 수행해야 합니다.。`,
      `${sourceLabel} 아직 저장되지 않았습니다. API Key。`,
      effectiveProfile,
    );
  }

  return {
    stage: "ready",
    tone: "success",
    title: "원격 상태: 원격 요청 가능.",
    detail: `${sourceLabel} 준비 완료.${profileSummary(effectiveProfile)}。이제 모델 목록을 가져오거나 연결 상태를 테스트할 수 있습니다.。`,
    actionReason: null,
    effectiveProfile,
  };
}

export function describeModelListState(modelList: LlmModelListState, accessState: LlmModuleAccessState): string {
  if (accessState.actionReason) return `현재 모델 목록을 가져올 수 없습니다.${accessState.actionReason}`;
  if (modelList.loading) return "현재 제공업체와 기본 URL을 기준으로 모델 목록을 가져오는 중입니다.";
  if (modelList.error) return `다운로드 실패:${modelList.error}。여전히 직접 입력할 수 있습니다. model。`;
  if (modelList.warning) return `원격 접속 종료 알림:${modelList.warning}。여전히 직접 입력할 수 있습니다. model。`;
  if (modelList.options.length > 0) {
    return `이미 가져왔습니다. / 이미 다운로드했습니다. / 이미 가져왔습니다. (문맥에 따라 적절하게 선택) ${modelList.options.length} 후보 모델을 여러 개 제시하며, 드롭다운 메뉴에서 선택하거나 직접 입력할 수도 있습니다. model。`;
  }
  if (modelList.requestId) {
    return "원격 서버에 모델 목록을 요청했지만, 후보 모델을 찾을 수 없습니다. 제공업체(provider) 또는 기본 URL(base_url)을 확인하거나, 직접 모델 이름을 입력해 주세요.";
  }
  return "모델 목록을 불러오는 방식과 사용자가 직접 모델을 입력하는 방식, 두 가지 모두 지원합니다.";
}
