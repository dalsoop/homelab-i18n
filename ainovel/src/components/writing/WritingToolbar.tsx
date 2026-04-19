import { List } from "lucide-react";

import { UI_COPY } from "../../lib/uiCopy";
import type { OutlineListItem } from "../../types";

export function WritingToolbar(props: {
  outlines: OutlineListItem[];
  activeOutlineId: string;
  chaptersCount: number;
  batchProgressText: string;
  aiGenerateDisabled: boolean;
  onSwitchOutline: (outlineId: string) => void;
  onOpenChapterList: () => void;
  onOpenBatch: () => void;
  onOpenHistory: () => void;
  onOpenAiGenerate: () => void;
  onOpenContextPreview: () => void;
  onOpenMemoryUpdate: () => void;
  onOpenTaskCenter: () => void;
  onOpenForeshadow: () => void;
  onOpenTables: () => void;
  onCreateChapter: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-subtext">현재 개요.</span>
          <select
            className="select w-auto"
            name="active_outline_id"
            value={props.activeOutlineId}
            onChange={(e) => props.onSwitchOutline(e.target.value)}
          >
            {props.outlines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.has_chapters ? "(이미 작성된 내용)" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-subtext">함께. {props.chaptersCount} 장(章)</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-secondary lg:hidden" onClick={props.onOpenChapterList} type="button">
            <List size={16} />
            목차.
          </button>
          <button className="btn btn-primary" onClick={props.onCreateChapter} type="button">
            새로운 장 추가.
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-subtext">생성.</span>
        <button
          className="btn btn-secondary"
          disabled={props.aiGenerateDisabled}
          onClick={props.onOpenAiGenerate}
          type="button"
        >
          AI 생성.
        </button>
        <button
          className="btn btn-secondary"
          aria-label="Open batch generation (writing_open_batch_generation)"
          onClick={props.onOpenBatch}
          type="button"
        >
          대량 생성.{props.batchProgressText}
        </button>
        <button
          className="btn btn-secondary"
          aria-label="Open generation history (writing_open_generation_history)"
          onClick={props.onOpenHistory}
          type="button"
        >
          생성 기록.
        </button>

        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <span className="text-[11px] text-subtext">도구.</span>
        <button className="btn btn-secondary" onClick={props.onOpenForeshadow} type="button">
          복선 암시 패널.
        </button>
        <button className="btn btn-secondary" onClick={props.onOpenTables} type="button">
          표 형식 패널.
        </button>
        <button className="btn btn-secondary" onClick={props.onOpenContextPreview} type="button">
          {UI_COPY.writing.contextPreview}
        </button>
        <button
          className="btn btn-secondary"
          aria-label="Memory Update"
          onClick={props.onOpenMemoryUpdate}
          type="button"
        >
          기억 업데이트.Memory Update）
        </button>
        <button className="btn btn-secondary" onClick={props.onOpenTaskCenter} type="button">
          과제 센터.
        </button>
      </div>

      <div className="mt-3 text-xs text-subtext">
        참고: 기본적으로 생성 시 자동으로 저장되지 않습니다. 변경한 내용이 저장되지 않은 챕터가 있을 경우, 생성하기 전에 “저장 후 생성”하라는 메시지가 표시됩니다. / 바로 생성합니다.”。
      </div>
    </div>
  );
}
