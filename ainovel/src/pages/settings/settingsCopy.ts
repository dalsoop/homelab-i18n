export function formatBinaryStatus(enabled: boolean): "enabled" | "disabled" {
  return enabled ? "enabled" : "disabled";
}

export const SETTINGS_COPY = {
  featureDefaults: {
    status: (enabled: boolean) => `status: memory_injection_default=${formatBinaryStatus(enabled)} (localStorage)`,
  },
  contextOptimizer: {
    status: (enabled: boolean) => `status: ${formatBinaryStatus(enabled)}`,
  },
  queryPreprocess: {
    ariaLabel: "쿼리 전처리 (쿼리 사전 처리)",
    title: "쿼리 전처리 (쿼리 사전 처리)",
    subtitle: "`query_text`를 먼저 “정제/노이즈 제거”하여 WorldBook, Vector RAG, Graph 검색의 안정성을 높입니다(기본적으로 비활성화).",
    featureHint: "기능: #태그 추출, 제외 규칙 제거, 그리고 선택적으로 장(장) 참조 인식 기능 강화(index_ref_enhance).",
    enableLabel: "`query_preprocessing` 기능 활성화 (기본적으로 비활성화되어 있음).",
    tagsLabel: "태그(각 줄에 하나씩 입력; #태그와 일치하는 항목만 추출; 비워두면 모든 태그 추출)",
    tagsHint: "최대 50개 항목까지 가능하며, 각 항목은 최대 64자까지 입력할 수 있습니다.",
    exclusionRulesLabel: "제외 규칙 (각 줄에 하나씩 입력; 해당 조건이 발견되면 삭제)",
    exclusionRulesHint: "최대 50개 항목까지 가능하며, 각 항목은 최대 256자까지 입력할 수 있습니다.",
    indexRefEnhanceLabel: "`index_ref_enhance`: “제N장 / Chapter N” 패턴을 인식하여 참조 토큰을 추가합니다.",
    previewTitle: "저장된 유효한(effective) 설정을 기반으로 정규화(normalize)합니다.",
    previewHint: "설정을 변경한 후에는 먼저 저장한 다음 미리 보기를 클릭하세요.",
    previewPlaceholder: "예를 들어: 1장의 내용을 다시 살펴보되, `#foo`는 삭제합니다.",
    previewButton: "미리 보기.",
    previewLoadingButton: "미리 보기 중…",
    clearResultButton: "결과를 모두 지우다.",
    emptyState: "활성화하면 태그 또는 제외 규칙을 설정할 수 있으며, 설정한 내용이 정규화된 쿼리 텍스트에 어떻게 반영되는지 아래에서 미리 볼 수 있습니다(저장 후 적용).",
  },
  vectorRag: {
    openPromptsConfigHint:
      "설정 항목이 ‘모델 설정’ 페이지(벡터 검색)로 이동되었습니다. 임베딩/재정렬 설정을 완료한 후, 해당 설정이 적용되었는지 확인하려면 이 페이지로 돌아오세요.",
    openPromptsConfigCta: "모델 설정을 엽니다.",
    saveBeforeTestToast: "설정을 먼저 저장한 후 테스트를 진행해 주세요. (테스트 시에는 저장된 설정을 사용합니다.)",
    saveBeforeTestHint: "참고: 테스트는 저장된 설정을 사용합니다. 현재 설정을 먼저 저장해 주세요.",
  },
} as const;
