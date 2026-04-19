import { humanizeChapterStatus } from "../../lib/humanize";

const DRAFTING_LABEL = humanizeChapterStatus("drafting");
const DONE_LABEL = humanizeChapterStatus("done");

export const WRITING_PAGE_COPY = {
  loading: "로딩 중...",
  emptyState: "집필을 시작할 장을 선택하거나 새로 만들어주세요.",
  dirtyBadge: "（저장 안 됨）",
  updatedAtPrefix: "updated_at:",
  hotkeyHint: "단축키: Ctrl/Cmd + S 로 저장",
  titleLabel: "제목",
  statusLabel: "상태",
  planLabel: "이 장의 요점",
  contentLabel: "본문 (Markdown)",
  contentPlaceholder: "집필을 시작하세요...",
  summaryLabel: "요약 (선택)",
  analysis: "분석",
  trace: "표시 및 추적",
  delete: "삭제",
  saveAndTrigger: "저장 후 자동 업데이트 실행",
  saveAndTriggerPending: "저장 및 실행 중...",
  save: "저장",
  saving: "저장 중...",
  openTaskCenter: "작업 센터 열기",
  openChapterAnalysis: "분석 페이지 열기",
  switchedOutline: "대강을 전환했어요",
  saveQueued: "저장 중: 큐에 추가했어요. 자동으로 저장됩니다.",
  saveSuccess: "저장 완료",
  createSuccess: "생성 완료",
  deleteSuccess: "삭제 완료",
  chapterNumberInvalid: "장 번호는 1 이상이어야 해요",
  generateDoneUnsaved: "생성 완료 (저장을 잊지 마세요)",
  generateEmptyStream: "스트리밍 조각을 받지 못했어요 (상위 서비스가 조각을 반환하지 않았거나 출력이 비어있을 수 있어요)",
  generateFallback: "스트리밍 생성에 실패해서 일반 방식으로 되돌렸어요",
  generateUnsupportedProviderFallback: "일반 방식으로 생성했어요",
  generateCanceled: "생성을 취소했어요",
  generateFailed: "생성에 실패했어요",
  applyRunSuccess: "생성 결과를 적용했어요 (저장을 잊지 마세요)",
  applyRunEmpty: "생성 기록이 비어있어서 적용할 수 없어요",
  autoUpdatesCreated: "저장하고 자동 업데이트 작업을 생성했어요",
  locateExcerptFailed: "본문에서 이 인용 구간을 찾지 못했어요 (복사 후 Ctrl/Cmd+F 로 검색해보세요)",
  memoryUpdateNeedsSaveFirst: "현재 장을 먼저 저장한 뒤 기억 업데이트를 진행해주세요.",
  promptPresetRequired: "먼저 Prompts 페이지에서 LLM 설정을 저장해주세요",
  analyzeEmptyContent: "본문이 비어있어서 분석할 수 없어요",
  analyzeDone: "분석 완료",
  analyzeParseFailedPrefix: "분석 파싱에 실패했어요: ",
  analyzeInstructionDefault: "분석 제안에 따라 다시 쓰고, 반복을 줄이며 서사의 연속성을 유지해주세요.",
  rewriteNeedsAnalysis: "먼저 장 분석을 완료해주세요",
  rewriteEmptyContent: "본문이 비어있어서 다시 쓸 수 없어요",
  rewriteParseFailed: "다시 쓰기 결과 파싱에 실패했어요",
  rewriteAppliedUnsaved: "다시 쓴 결과를 에디터에 적용했어요 (저장 안 됨)",
  saveAndGenerateLastChapter: "저장했어요. 이미 마지막 장이에요",
  streamFloatingTitle: "AI 스트리밍 생성 중",
  streamFloatingPending: "처리 중...",
  streamFloatingExpand: "펼치기",
  cancel: "취소",
  postEditRawApplied: "원고를 적용했어요 (저장을 잊지 마세요)",
  postEditEditedApplied: "후처리된 원고를 적용했어요 (저장을 잊지 마세요)",
  contentOptimizeRawApplied: "최적화 전 원고를 적용했어요 (저장을 잊지 마세요)",
  contentOptimizeOptimizedApplied: "본문 최적화 결과를 적용했어요 (저장을 잊지 마세요)",
  adoptionRecordFailedPrefix: "채택 전략 기록에 실패했어요: ",
  readonlyCalloutAction: `${DRAFTING_LABEL} 로 되돌리고 편집`,
  confirms: {
    switchChapter: {
      title: "장에 저장되지 않은 변경이 있어요. 전환하시겠어요?",
      description: "전환 시 저장되지 않은 내용은 사라져요.",
      confirmText: "저장하고 전환",
      secondaryText: "저장 없이 전환",
      cancelText: "취소",
    },
    switchOutline: {
      title: "장에 저장되지 않은 변경이 있어요. 대강을 전환하시겠어요?",
      description: "대강을 전환하면 저장되지 않은 내용이 사라져요.",
      confirmText: "저장하고 전환",
      secondaryText: "저장 없이 전환",
      cancelText: "취소",
    },
    applyGenerationRun: {
      title: "장에 저장되지 않은 변경이 있어요. 생성 기록을 적용하시겠어요?",
      description: "적용 시 에디터 내용이 덮어써져요 (자동 저장되지 않아요).",
      confirmText: "저장하고 적용",
      secondaryText: "저장 없이 적용",
      cancelText: "취소",
    },
    generateWithDirty: {
      title: "장에 저장되지 않은 변경이 있어요. 어떻게 생성할까요?",
      description: "생성 결과가 에디터에 기록되지만 자동 저장되지는 않아요.",
      confirmText: "저장하고 생성",
      secondaryText: "저장 없이 생성",
      cancelText: "취소",
    },
    deleteChapter: {
      title: "장을 삭제할까요?",
      description: "삭제 시 이 장의 본문과 요약이 사라져요.",
      confirmText: "삭제",
    },
    nextChapterReplace: {
      description: "'교체' 모드로 초안을 생성해요 (생성 결과는 자동 저장되지 않아요).",
      confirmText: "계속",
      cancelText: "취소",
    },
  },
} as const;

export function getWritingChapterHeading(chapterNumber: number): string {
  return `${chapterNumber}장`;
}

export function getWritingReadonlyCallout(): string {
  return `이 장은 탈고 상태예요. 실수를 막기 위해 에디터가 기본적으로 읽기 전용입니다. 수정하려면 먼저 ${DRAFTING_LABEL} 로 되돌려주세요.`;
}

export function getWritingStatusHint(): string {
  return `안내: 저장은 탈고가 아니에요. ${DONE_LABEL} 상태의 장만 기억 업데이트(Memory Update)로 장기 기억에 기록할 수 있어요. 탈고된 장은 기본적으로 읽기 전용이며, 수정하려면 ${DRAFTING_LABEL} 로 되돌려주세요.`;
}

export function getWritingDoneOnlyWarning(): string {
  return `${DONE_LABEL} 상태의 장만 기억 업데이트가 가능해요. 먼저 장을 ${DONE_LABEL} 로 표시해주세요.`;
}

export function getWritingAnalysisHref(projectId: string, chapterId: string): string {
  return `/projects/${projectId}/chapter-analysis?chapterId=${chapterId}`;
}

export function getWritingNextChapterReplaceTitle(chapterNumber: number): string {
  return `다음 장 (${chapterNumber}장)에 이미 내용이 있어요. 그래도 생성할까요?`;
}

export function getWritingGenerateIndicatorLabel(message?: string, progress?: number): string {
  if (!message) return "잉크가 종이에 스며드는 중... 생성에 시간이 좀 걸려요";
  return `${message} (${Math.max(0, Math.min(100, progress ?? 0))}%)`;
}

export function getWritingMissingPrerequisiteMessage(numbers: number[]): string {
  return `선행 장 내용이 없어요: ${numbers.join(", ")}장`;
}

export function getWritingJumpToChapterLabel(chapterNumber: number): string {
  return `${chapterNumber}장으로 이동`;
}

export function getWritingApplyMemorySuccess(count: number): string {
  return `${count}개의 기억을 생성했어요 (표시 가능)`;
}
