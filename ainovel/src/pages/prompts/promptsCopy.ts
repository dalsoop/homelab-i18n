export const PROMPTS_COPY = {
  vectorRag: {
    saveBeforeTestToast: "RAG 설정을 먼저 저장한 후 테스트를 진행해 주세요. (테스트 시에는 저장된 설정을 사용합니다.)",
    saveBeforeTestHint: "참고: 테스트는 저장된 설정을 사용합니다. 먼저 “RAG 설정 저장”을 클릭하여 설정을 저장해 주세요.",
  },
  confirm: {
    deleteProfile: {
      title: "현재 설정된 백엔드 및 프론트엔드 설정을 삭제하시겠습니까?",
      description: "삭제하면 복구할 수 없습니다. 해당 프로젝트는 연결이 해제되며, 설정을 다시 선택하거나 새로 만들고 키를 저장해야 합니다.",
      confirmText: "삭제하다.",
    },
    clearProfileApiKey: {
      title: "API 키 삭제하시겠습니까?",
      description: "키를 다시 저장하기 전까지는 연결을 생성하거나 테스트할 수 없습니다. (키를 삭제한 후에는 연결을 생성하거나 테스트할 수 없습니다.)",
      confirmText: "제거하다.",
    },
  },
} as const;

export function buildDeleteTaskModuleConfirm(taskLabel: string) {
  return {
    title: "작업 모듈 삭제.",
    description: `작업 모듈 삭제를 확인합니다.「${taskLabel}」？삭제 후에는 기본 모듈로 돌아갑니다.。`,
    confirmText: "삭제하다.",
    cancelText: "취소하다.",
  } as const;
}

export function buildClearTaskApiKeyConfirm(profileName: string) {
  return {
    title: "작업 모듈과 연결된 API 키 설정을 삭제하는 방법은 무엇인가요?",
    description: `구성 파일이 삭제됩니다.「${profileName}」의. Key。해당 구성 파일이 다른 모듈에서 재사용될 경우 즉시 유효하지 않게 됩니다.。`,
    confirmText: "제거하다.",
    cancelText: "취소하다.",
  } as const;
}
