import { useEffect, useId, useRef } from "react";

import { Modal } from "./Modal";

export function CopyFallbackModal(props: { text: string; title: string; description?: string; onClose: () => void }) {
  const titleId = useId();
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [props.text]);

  return (
    <Modal
      open
      onClose={props.onClose}
      ariaLabelledBy={titleId}
      panelClassName="w-full max-w-2xl rounded-atelier border border-border bg-surface shadow-sm"
    >
      <div className="p-4">
        <div id={titleId} className="font-content text-lg text-ink">
          {props.title}
        </div>
        {props.description ? <div className="mt-1 text-xs text-subtext">{props.description}</div> : null}

        <div className="mt-3 grid gap-2">
          <label className="text-[11px] text-subtext" htmlFor={textareaId}>
            복사하여 사용할 수 있는 텍스트.
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            className="textarea font-mono text-xs"
            rows={10}
            value={props.text}
            readOnly
            spellCheck={false}
          />
          <div className="text-[11px] text-subtext">
            팁: 자동 복사가 되지 않을 경우, 텍스트 상자 안에서 직접 복사하세요. Ctrl/Cmd+A → Ctrl/Cmd+C 수동으로 복사하기.。
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => {
              const el = textareaRef.current;
              if (!el) return;
              el.focus();
              el.select();
            }}
            type="button"
          >
            전체 선택.
          </button>
          <button className="btn btn-primary" onClick={props.onClose} type="button">
            닫기.
          </button>
        </div>
      </div>
    </Modal>
  );
}
