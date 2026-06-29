import { Loader2, MessageCircle } from "lucide-react";
import { BitmojiAvatar } from "./BitmojiAvatar.tsx";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { tapHaptic } from "../haptics.ts";

type InviteAcceptFlowProps = {
  inviterName: string;
  inviterUsername: string;
  loading?: boolean;
  error?: string;
  onAccept: () => void;
  onDismiss: () => void;
};

export function InviteAcceptFlow({
  inviterName,
  inviterUsername,
  loading = false,
  error = "",
  onAccept,
  onDismiss
}: InviteAcceptFlowProps) {
  return (
    <main className="invite-accept-screen">
      <div className="invite-accept-inner">
        <CipheraMascot size={72} animated className="invite-accept-mascot" />
        <BitmojiAvatar user={{ id: inviterUsername, username: inviterUsername, name: inviterName }} size={88} large />
        <h1>{inviterName}</h1>
        <p className="invite-accept-copy">invited you to a private chat on Ciphera</p>

        {error ? <div className="invite-accept-error">{error}</div> : null}

        <button
          type="button"
          className="invite-accept-btn tap-spring"
          onClick={() => {
            tapHaptic();
            onAccept();
          }}
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="spin" /> : <MessageCircle size={18} />}
          Start chatting
        </button>

        <button type="button" className="invite-accept-dismiss tap-spring" onClick={onDismiss} disabled={loading}>
          Not now
        </button>
      </div>
    </main>
  );
}