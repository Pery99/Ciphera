import { Loader2 } from "lucide-react";
import type { AuthSubmitPayload } from "./AuthFlow.tsx";
import { AuthFlow } from "./AuthFlow.tsx";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { InviteAcceptFlow } from "./InviteAcceptFlow.tsx";
import { SplashScreen } from "./SplashScreen.tsx";
import { ToastHost, type ToastMessage } from "./ToastHost.tsx";

type AppGateProps = {
  showSplash: boolean;
  splashExiting: boolean;
  restoringSession: boolean;
  hasSessionUser: boolean;
  mode: "login" | "signup";
  pendingInviteToken: string;
  inviteContext: { inviterName: string; username: string } | null;
  invitePreviewLoading: boolean;
  invitePreviewError: string;
  isAuthenticating: boolean;
  isAcceptingInvite: boolean;
  error: string;
  pushChecking: boolean;
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  onModeChange: (mode: "login" | "signup") => void;
  onErrorClear: () => void;
  onSubmit: (payload: AuthSubmitPayload) => Promise<void>;
  onAcceptInvite: () => void;
  onDismissInvite: () => void;
};

export function AppGate({
  showSplash,
  splashExiting,
  restoringSession,
  hasSessionUser,
  mode,
  pendingInviteToken,
  inviteContext,
  invitePreviewLoading,
  invitePreviewError,
  isAuthenticating,
  isAcceptingInvite,
  error,
  pushChecking,
  toasts,
  onDismissToast,
  onModeChange,
  onErrorClear,
  onSubmit,
  onAcceptInvite,
  onDismissInvite
}: AppGateProps) {
  if (showSplash) {
    return <SplashScreen exiting={splashExiting} />;
  }

  if (restoringSession || !hasSessionUser) {
    return (
      <>
        <AuthFlow
          mode={mode}
          onModeChange={onModeChange}
          inviteContext={inviteContext}
          restoring={restoringSession}
          loading={isAuthenticating}
          error={error || invitePreviewError}
          onErrorClear={onErrorClear}
          onSubmit={onSubmit}
        />
        <ToastHost toasts={toasts} onDismiss={onDismissToast} />
      </>
    );
  }

  if (pendingInviteToken) {
    if (invitePreviewLoading) {
      return (
        <main className="invite-accept-screen">
          <div className="invite-accept-inner">
            <Loader2 size={28} className="spin" />
            <p className="invite-accept-copy">Loading invite...</p>
          </div>
        </main>
      );
    }

    if (inviteContext) {
      return (
        <InviteAcceptFlow
          inviterName={inviteContext.inviterName}
          inviterUsername={inviteContext.username}
          loading={isAcceptingInvite}
          error={invitePreviewError}
          onAccept={onAcceptInvite}
          onDismiss={onDismissInvite}
        />
      );
    }

    return (
      <main className="invite-accept-screen">
        <div className="invite-accept-inner">
          <CipheraMascot size={88} animated />
          <h1>Invite unavailable</h1>
          <p className="invite-accept-copy">{invitePreviewError || "This invite link is invalid or expired."}</p>
          <button type="button" className="invite-accept-btn tap-spring" onClick={onDismissInvite}>
            Go to chats
          </button>
        </div>
      </main>
    );
  }

  if (pushChecking) {
    return (
      <main className="notification-gate">
        <div className="notification-gate-card">
          <Loader2 size={28} className="spin" />
          <p>Preparing Ciphera...</p>
        </div>
      </main>
    );
  }

  return null;
}
