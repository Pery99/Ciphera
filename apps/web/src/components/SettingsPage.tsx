import type { ReactNode } from "react";
import { ArrowLeft, Bell, BellOff, KeyRound, LogOut, Shield } from "lucide-react";
import type { UserProfile } from "@ciphera/types";
import { BitmojiAvatar } from "./BitmojiAvatar.tsx";
import { tapHaptic } from "../haptics.ts";
import { getPushSupportState } from "../push.ts";

type SettingsPageProps = {
  user: UserProfile;
  pushActive: boolean;
  encryptionReady: boolean;
  onBack: () => void;
  onLogout: () => void;
  onEnableNotifications?: () => void;
};

export function SettingsPage({
  user,
  pushActive,
  encryptionReady,
  onBack,
  onLogout,
  onEnableNotifications
}: SettingsPageProps) {
  const pushSupport = getPushSupportState();
  const iosInstall = pushSupport.status === "ios-install";

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="chat-back-btn tap-spring" onClick={onBack} aria-label="Back to chats">
          <ArrowLeft size={22} />
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-body">
        <section className="settings-profile-card">
          <BitmojiAvatar user={user} size={88} large />
          <div className="settings-profile-copy">
            <h2>{user.name}</h2>
            <span>@{user.username}</span>
          </div>
        </section>

        <section className="settings-section">
          <h3>Account</h3>
          <div className="settings-card">
            <SettingsRow label="Display name" value={user.name} />
            <SettingsRow label="Username" value={`@${user.username}`} />
          </div>
        </section>

        <section className="settings-section">
          <h3>Security</h3>
          <div className="settings-card">
            <SettingsRow
              label="Encryption"
              value={encryptionReady ? "Active on this device" : "Preparing keys"}
              icon={<Shield size={16} />}
            />
            <SettingsRow
              label="Identity key"
              value={formatIdentityKey(user.publicIdentityKey)}
              mono
              icon={<KeyRound size={16} />}
            />
          </div>
        </section>

        <section className="settings-section">
          <h3>Notifications</h3>
          <div className="settings-card">
            <div className="settings-row settings-row--inline">
              <div className="settings-row-label">
                {pushActive ? <Bell size={16} /> : <BellOff size={16} />}
                <span>Push alerts</span>
              </div>
              <span className={pushActive ? "settings-status settings-status--on" : "settings-status settings-status--off"}>
                {pushActive ? "Enabled" : "Not enabled"}
              </span>
            </div>
            {iosInstall ? (
              <div className="settings-card-footer settings-card-footer--note">
                <p>{pushSupport.message}</p>
              </div>
            ) : null}
            {!pushActive && onEnableNotifications && !iosInstall ? (
              <div className="settings-card-footer">
                <button type="button" className="settings-enable-btn tap-spring" onClick={onEnableNotifications}>
                  <Bell size={16} />
                  Enable notifications
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <button
          type="button"
          className="settings-logout-btn tap-spring"
          onClick={() => {
            tapHaptic();
            onLogout();
          }}
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  muted = false,
  mono = false,
  icon
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`settings-row-value ${muted ? "settings-row-value--muted" : ""} ${mono ? "settings-row-value--mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function formatIdentityKey(key: string) {
  if (key.length <= 20) return key;
  return `${key.slice(0, 10)}…${key.slice(-10)}`;
}