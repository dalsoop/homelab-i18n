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
      `当前模块 provider = ${options.moduleProvider}，${sourceLabel} provider = ${effectiveProfile.provider}。先让两者一致，再拉取模型列表或测试连接。`,
      `${sourceLabel} 与当前模块 provider 不一致。`,
      effectiveProfile,
    );
  }

  if (!effectiveProfile.has_api_key) {
    return createBlockedState(
      "missing_key",
      "원격 연결 상태: 프로필과 연결되었으나 키가 저장되지 않았습니다.",
      `${sourceLabel} 已绑定，但还没有保存 API Key。保存 Key 后才能拉取模型列表或测试连接。`,
      `${sourceLabel} 还没有保存 API Key。`,
      effectiveProfile,
    );
  }

  return {
    stage: "ready",
    tone: "success",
    title: "원격 상태: 원격 요청 가능.",
    detail: `${sourceLabel} 已就绪：${profileSummary(effectiveProfile)}。现在可以拉取模型列表，也可以测试连接。`,
    actionReason: null,
    effectiveProfile,
  };
}

export function describeModelListState(modelList: LlmModelListState, accessState: LlmModuleAccessState): string {
  if (accessState.actionReason) return `当前不可拉取模型列表：${accessState.actionReason}`;
  if (modelList.loading) return "현재 제공업체와 기본 URL을 기준으로 모델 목록을 가져오는 중입니다.";
  if (modelList.error) return `拉取失败：${modelList.error}。仍可手动输入 model。`;
  if (modelList.warning) return `远端返回提醒：${modelList.warning}。仍可手动输入 model。`;
  if (modelList.options.length > 0) {
    return `已拉取 ${modelList.options.length} 个候选模型；可下拉选择，也可手动输入 model。`;
  }
  if (modelList.requestId) {
    return "원격 서버에 모델 목록을 요청했지만, 후보 모델을 찾을 수 없습니다. 제공업체(provider) 또는 기본 URL(base_url)을 확인하거나, 직접 모델 이름을 입력해 주세요.";
  }
  return "모델 목록을 불러오는 방식과 사용자가 직접 모델을 입력하는 방식, 두 가지 모두 지원합니다.";
}
