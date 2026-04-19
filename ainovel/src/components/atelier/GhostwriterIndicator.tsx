import { useReducedMotion } from "framer-motion";

type GhostwriterIndicatorProps = {
  label?: string;
  className?: string;
};

export function GhostwriterIndicator({ label = "잉크가 번지고 있습니다…", className }: GhostwriterIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={
        "flex items-center gap-2 rounded-atelier border border-border bg-canvas px-3 py-2 text-xs text-subtext " +
        (className ?? "")
      }
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        <span
          className={
            "absolute inline-flex h-full w-full rounded-full bg-accent/40 " + (reduceMotion ? "" : "animate-ping")
          }
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
}
