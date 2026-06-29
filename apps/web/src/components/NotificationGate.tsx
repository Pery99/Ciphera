import { useState } from "react";
import { Bell, Loader2, Settings2 } from "lucide-react";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { getPushPermissionState, getPushSupportState, isBraveBrowser, requestPushAccess } from "../push.ts";
import { tapHaptic } from "../haptics.ts";

type NotificationGateProps = {
  onEnabled: () => void;
  onSkip: () => void;
  overlay?: boolean;
};

export function NotificationGate({ onEnabled, onSkip, overlay = false }: NotificationGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const permission = getPushPermissionState();
  const denied = permission === "denied";
  const pushSupport = getPushSupportState();
  const iosInstall = pushSupport.status === "ios-install";
  const unsupported = pushSupport.status === "unsupported";
  const brave = isBraveBrowser();

  async function handleEnable() {
    setError("");
    setLoading(true);
    tapHaptic();
    const result = await requestPushAccess();
    if (!result.ok) {
      setError(result.reason);
      setLoading(false);
      return;
    }
    onEnabled();
    setLoading(false);
  }

  function handleSkip() {
    tapHaptic();
    onSkip();
  }

  return (
    <main className={`notification-gate ${overlay ? "notification-gate--overlay" : ""}`}>
      <div className="notification-gate-card">
        <CipheraMascot size={88} animated />
        <h1>Enable notifications</h1>
        <p>
          Ciphera only sends generic alerts like <strong>“You have a new message.”</strong> Message content never
          appears in notifications. This is optional — you can set it up later.
        </p>

        {iosInstall ? (
          <div className="notification-gate-note">{pushSupport.message}</div>
        ) : unsupported ? (
          <div className="notification-gate-note">{pushSupport.message}</div>
        ) : denied ? (
          <div className="notification-gate-note">
            Notifications are blocked. Open your browser settings, allow notifications for Ciphera, then try again.
          </div>
        ) : brave ? (
          <div className="notification-gate-note">
            On Brave, you may need to enable Google services for push messaging in{" "}
            <strong>brave://settings/privacy</strong>.
          </div>
        ) : (
          <div className="notification-gate-note">Get alerted when someone messages you, even when Ciphera is closed.</div>
        )}

        {error ? <div className="notification-gate-error">{error}</div> : null}

        <div className="notification-gate-actions">
          <button
            type="button"
            className="notification-gate-btn tap-spring"
            onClick={() => void handleEnable()}
            disabled={loading || unsupported || iosInstall}
          >
            {loading ? <Loader2 size={18} className="spin" /> : denied ? <Settings2 size={18} /> : <Bell size={18} />}
            {iosInstall ? "Use Safari home screen app" : unsupported ? "Not supported" : denied ? "Try again" : "Enable notifications"}
          </button>
          <button type="button" className="notification-gate-skip tap-spring" onClick={handleSkip} disabled={loading}>
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}