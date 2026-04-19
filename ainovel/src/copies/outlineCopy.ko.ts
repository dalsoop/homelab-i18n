export const OUTLINE_COPY = {
  loading: "로딩 중...",
  currentOutline: "현재 대강",
  create: "새로 만들기",
  rename: "이름 변경",
  delete: "삭제",
  hasChapters: "이 대강에 장이 이미 있습니다",
  noChapters: "이 대강에는 아직 장이 없습니다",
  createChapters: "대강에서 장 스켈레톤 만들기",
  createChaptersDisabledReason: "먼저 장 구조가 포함된 대강을 생성해주세요",
  generate: "AI 대강 생성",
  save: "대강 저장",
  saveSuccess: "저장 완료",
  createdAndSwitched: "대강을 만들고 전환했어요",
  renamed: "이름을 변경했어요",
  deleted: "대강을 삭제했어요",
  switched: "대강을 전환했어요",
  chaptersCreatedPrefix: "생성된",
  chaptersCreatedSuffix: "개 장",
  chaptersReplacedPrefix: "덮어써서 생성된",
  generateDone: "생성 완료",
  generateCanceled: "생성을 취소했어요",
  generateFailed: "스트리밍 생성에 실패했어요",
  generateFallback: "스트리밍 생성에 실패해서 일반 방식으로 되돌렸어요",
  generateParseFailed: "스트리밍은 완료됐지만 사용 가능한 결과를 받지 못했어요. 다시 시도해주세요",
  flowTitle: "작업 흐름 안내",
  flowDescription: "권장 흐름: AI 대강 생성 → 미리보기 후 적용(덮어쓰기/다른 이름으로 저장) → 편집 및 보완 → 대강에서 장 스켈레톤 만들기 → 집필 시작.",
  flowHint: "안내: '대강에서 장 스켈레톤 만들기'가 비활성화돼 있으면, 먼저 AI 대강을 생성하고 적용해주세요 (장 구조로 파싱 가능해야 함).",
  editorPlaceholder: "여기에 대강을 작성하세요 (Markdown)...",
  hotkeyHint: "단축키: Ctrl/Cmd + S 로 저장",
  titleModalHint: "여러 대강 사이를 전환해서 작업 흐름을 관리할 수 있어요.",
  titleLabel: "제목",
  titleRequired: "제목을 입력해주세요",
  close: "닫기",
  cancel: "취소",
  confirm: "확인",
  generateTitle: "AI 대강 생성",
  generateHint: "생성 결과는 먼저 미리보기로 확인한 뒤, 현재 대강에 덮어쓰거나 다른 이름으로 저장할 수 있어요.",
  generateFormTitle: "기본 설정",
  generateFormHint: "장 수 / 톤 / 페이스로 방향을 잡은 뒤, 생성 후 미리보기에서 세부 조정하세요.",
  chapterCount: "장 수",
  chapterCountHint: "장편 목표(예: 100/200)도 입력 가능해요. 시스템이 각 장의 세밀도를 자동으로 조정해서 목표 장 수에 맞춰요.",
  tone: "톤",
  tonePlaceholder: "예: 리얼리즘, 절제됐지만 임팩트 있음",
  pacing: "페이스",
  pacingPlaceholder: "예: 앞 3장에서 강한 훅, 중반 상승, 결말 반전",
  advancedTitle: "고급 설정",
  advancedHint: "세계관/캐릭터 카드를 주입하면 프로젝트 설정에 더 가깝게 생성돼요. 스트리밍 생성은 출력을 더 빨리 볼 수 있어요 (가끔 일반 방식으로 자동 전환).",
  includeWorldSetting: "세계관 주입",
  includeCharacters: "캐릭터 카드 주입",
  stream: "스트리밍 생성 (베타)",
  streamPreviewTitle: "실시간 장 미리보기 (JSON)",
  streamPreviewWaiting: "실시간 장 미리보기 (JSON): 첫 장이 도착하기를 기다리는 중...",
  streamRawTitle: "스트리밍 원본 조각 (raw)",
  streamRawWaiting: "스트리밍 원본 조각 (raw): 아직 출력이 없어요. 현재 분할 완료를 기다리는 중...",
  riskHint: "주의: 생성 시 모델을 호출하므로 토큰과 시간이 소모돼요. 미리보기 후 적용(다른 이름으로 저장 권장)해주세요.",
  generateButton: "생성",
  generatingButton: "생성 중...",
  cancelGenerate: "생성 취소",
  previewTitle: "생성 결과 미리보기",
  previewActionHint: "적용 방식: 덮어쓰기는 현재 대강을 교체하고 즉시 저장해요. 다른 이름으로 저장은 새 대강을 만들어 전환해요 (더 안전, 추천).",
  previewCancel: "취소",
  overwriteAndSave: "현재 대강에 덮어쓰고 저장",
  saveAsNew: "새 대강으로 저장하고 전환",
  confirms: {
    deleteOutline: {
      title: "현재 대강을 삭제할까요?",
      description: "이 대강 아래의 장도 함께 삭제되며, 복구할 수 없어요.",
      confirmText: "삭제",
    },
    switchOutline: {
      title: "저장되지 않은 변경이 있어요. 전환하시겠어요?",
      description: "전환 시 저장되지 않은 내용은 사라져요.",
      confirmText: "저장하고 전환",
      secondaryText: "저장 없이 전환",
      cancelText: "취소",
    },
    createSkeleton: {
      title: "대강에서 장 스켈레톤을 만들까요?",
      confirmText: "만들기",
    },
    replaceSkeleton: {
      title: "이미 장이 있어요. 덮어쓸까요?",
      description: "덮어쓰기하면 이 대강 아래 모든 장(본문/요약 포함)이 삭제되며 복구할 수 없어요.",
      confirmText: "덮어쓰고 만들기",
    },
    titleModalContinue: {
      title: "저장되지 않은 변경이 있어요. 계속하시겠어요?",
      description: "저장 후 전환하면 변경이 유지돼요. 저장 없이 계속하면 변경이 사라져요.",
      confirmText: "저장하고 계속",
      secondaryText: "저장 없이 계속",
      cancelText: "취소",
    },
    overwriteDirty: {
      title: "저장되지 않은 현재 대강에 덮어쓸까요?",
      description: "덮어쓰기하면 생성 결과로 현재 대강을 교체하고 즉시 저장해요.",
      confirmText: "덮어쓰고 저장",
    },
    saveAsNewDirty: {
      title: "저장되지 않은 변경이 있어요. 계속하시겠어요?",
      description: "저장 후 전환하면 변경이 유지돼요. 저장 없이 계속하면 변경이 사라져요.",
      confirmText: "저장하고 계속",
      secondaryText: "저장 없이 계속",
      cancelText: "취소",
    },
  },
} as const;

export function getOutlineTitleModalLabel(mode: "create" | "rename"): string {
  return mode === "create" ? "새 대강 만들기" : "대강 이름 변경";
}

export function getOutlinePreviewMetaText(chapterCount: number, parseErrorMessage?: string): string {
  return `파싱된 장: ${chapterCount}${parseErrorMessage ? `（${parseErrorMessage}）` : ""}`;
}

export function getOutlineCreateChaptersDescription(chapterCount: number): string {
  return `대강에 따라 ${chapterCount}개의 장을 생성해요.`;
}

export function getOutlineCreatedChaptersText(chapterCount: number, replaced = false): string {
  return `${replaced ? OUTLINE_COPY.chaptersReplacedPrefix : OUTLINE_COPY.chaptersCreatedPrefix} ${chapterCount} ${OUTLINE_COPY.chaptersCreatedSuffix}`;
}

export function getOutlineStreamRetryMessage(delayMs: number, retryCount: number, maxRetries: number): string {
  return `스트리밍 연결이 끊겼어요. ${Math.ceil(delayMs / 1000)}초 후 자동으로 재연결합니다 (${retryCount}/${maxRetries})...`;
}
