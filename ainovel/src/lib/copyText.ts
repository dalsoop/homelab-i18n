import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { CopyFallbackModal } from "../components/ui/CopyFallbackModal";

export type CopyTextOptions = {
  title?: string;
  description?: string;
};

function showCopyFallbackModal(text: string, opts: CopyTextOptions | undefined): void {
  if (typeof document === "undefined") return;

  const container = document.createElement("div");
  container.dataset.ainovel = "copy-fallback-modal";
  document.body.appendChild(container);

  const root = createRoot(container);
  const cleanup = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    createElement(CopyFallbackModal, {
      text,
      title: opts?.title ?? "복사가 실패했습니다. 내용을 직접 복사해 주세요.",
      description: opts?.description ?? "브라우저가 클립보드 API에 대한 접근을 거부했습니다. 아래 텍스트 상자에 내용을 직접 복사하여 붙여넣으세요.",
      onClose: cleanup,
    }),
  );
}

export async function copyText(text: string, opts?: CopyTextOptions): Promise<boolean> {
  const safeText = String(text ?? "");
  if (!safeText) return true;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(safeText);
      return true;
    }
  } catch {
    // noop
  }

  showCopyFallbackModal(safeText, opts);
  return false;
}
