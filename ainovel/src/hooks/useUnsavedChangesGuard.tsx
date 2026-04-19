import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

import { useConfirm } from "../components/ui/confirm";

export function UnsavedChangesGuard(props: { when: boolean }) {
  const { confirm } = useConfirm();
  const blocker = useBlocker(props.when);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void (async () => {
      const ok = await confirm({
        title: "저장하지 않은 변경 사항이 있습니다. 정말 종료하시겠습니까?",
        description: "저장하지 않고 페이지를 떠나면 입력한 내용이 삭제됩니다.",
        confirmText: "떠나다.",
        cancelText: "취소하다.",
        danger: true,
      });
      if (ok) blocker.proceed();
      else blocker.reset();
    })();
  }, [blocker, confirm]);

  useEffect(() => {
    if (!props.when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [props.when]);

  return null;
}
