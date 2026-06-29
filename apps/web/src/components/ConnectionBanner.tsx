import { Loader2 } from "lucide-react";
import { isNetworkAvailable } from "../outboundQueue.ts";
import type { SocketStatus } from "../appConfig.ts";

export function ConnectionBanner({ status }: { status: SocketStatus }) {
  if (status === "connected") return null;

  return (
    <div className="connection-banner" role="status" aria-live="polite">
      <Loader2 size={16} className="spin" />
      <span>
        {!isNetworkAvailable()
          ? "Offline - messages will send when you reconnect"
          : status === "connecting"
            ? "Connecting..."
            : "Reconnecting..."}
      </span>
    </div>
  );
}
