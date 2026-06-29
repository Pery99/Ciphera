import { Image, Loader2, Video } from "lucide-react";

type MediaLoadingShellProps = {
  kind: "image" | "video";
  label?: string;
};

export function MediaLoadingShell({ kind, label }: MediaLoadingShellProps) {
  const Icon = kind === "video" ? Video : Image;

  return (
    <div className="attachment-loading" aria-busy="true" aria-live="polite">
      <div className="attachment-loading-shimmer" aria-hidden />
      <div className="attachment-loading-content">
        <Icon size={22} strokeWidth={2} />
        <Loader2 size={18} className="spin" />
        <span>{label ?? (kind === "video" ? "Sending video…" : "Sending photo…")}</span>
      </div>
    </div>
  );
}