export type MemoryAnnotation = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  importance: number;
  position: number;
  length: number;
  tags: string[];
  metadata: Record<string, unknown>;
};

const TYPE_LABELS: Record<string, string> = {
  chapter_summary: "요약.",
  hook: "갈고리.",
  foreshadow: "복선.",
  plot_point: "감정적 클라이맥스.",
  character_state: "인물의 상태.",
};

export function labelForAnnotationType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function sortKeyForAnnotationType(type: string): number {
  switch (type) {
    case "chapter_summary":
      return 10;
    case "hook":
      return 20;
    case "foreshadow":
      return 30;
    case "plot_point":
      return 40;
    case "character_state":
      return 50;
    default:
      return 999;
  }
}
