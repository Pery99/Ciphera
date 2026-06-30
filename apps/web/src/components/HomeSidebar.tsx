import { Bell, CircleUserRound, Loader2, Plus, UserPlus } from "lucide-react";
import type { Conversation, Message, UserProfile } from "@ciphera/types";
import { BitmojiAvatar } from "./BitmojiAvatar.tsx";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { ConversationPreview } from "./ConversationPreview.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { UserSearch } from "./UserSearch.tsx";
import { formatUnreadCount } from "../conversationList.ts";
import { tapHaptic } from "../haptics.ts";

type HomeSidebarProps = {
  mobileHidden: boolean;
  showSettings: boolean;
  user: UserProfile;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeId: string;
  identityKey: string;
  isLoadingConversations: boolean;
  pushActive: boolean;
  encryptionReady: boolean;
  onShowSettings: () => void;
  onHideSettings: () => void;
  onLogout: () => void;
  onEnableNotifications: () => void;
  onCreateInviteLink: () => void;
  onStartConversation: (user: UserProfile) => void;
  onOpenConversation: (conversationId: string) => void;
};

export function HomeSidebar({
  mobileHidden,
  showSettings,
  user,
  conversations,
  messages,
  activeId,
  identityKey,
  isLoadingConversations,
  pushActive,
  encryptionReady,
  onShowSettings,
  onHideSettings,
  onLogout,
  onEnableNotifications,
  onCreateInviteLink,
  onStartConversation,
  onOpenConversation
}: HomeSidebarProps) {
  return (
    <aside className={`home-panel ${mobileHidden ? "mobile-hidden" : ""} ${showSettings ? "home-panel--settings" : ""}`}>
      {showSettings ? (
        <SettingsPage
          user={user}
          pushActive={pushActive}
          encryptionReady={encryptionReady}
          onBack={() => {
            tapHaptic();
            onHideSettings();
          }}
          onLogout={onLogout}
          onEnableNotifications={onEnableNotifications}
        />
      ) : (
        <>
          <header className="home-header">
            <div className="home-header-brand">
              <CipheraMascot size={36} />
              <div>
                <h1>Chats</h1>
                <span>@{user.username}</span>
              </div>
            </div>
            <div className="home-header-actions">
              <button
                className="home-action-btn home-action-btn--muted tap-spring"
                type="button"
                title="Profile"
                onClick={() => {
                  tapHaptic();
                  onShowSettings();
                }}
              >
                <CircleUserRound size={18} />
              </button>
              {!pushActive ? (
                <button
                  className="home-action-btn home-action-btn--notify-alert tap-spring"
                  type="button"
                  title="Notifications not enabled"
                  onClick={() => {
                    tapHaptic();
                    onEnableNotifications();
                  }}
                >
                  <Bell size={18} />
                  <span className="home-notify-alert" aria-hidden="true">
                    !
                  </span>
                </button>
              ) : null}
              <button className="home-action-btn tap-spring" type="button" title="Create invite link" onClick={onCreateInviteLink}>
                <Plus size={18} />
              </button>
            </div>
          </header>

          <UserSearch onSelect={onStartConversation} />

          <section className="conversation-list">
            {isLoadingConversations ? (
              <div className="list-state">
                <Loader2 size={18} className="spin" /> Loading chats
              </div>
            ) : conversations.length === 0 ? (
              <div className="home-empty">
                <CipheraMascot size={88} animated />
                <h3>No chats yet</h3>
                <p>Tap + to share an invite link or search a username to start.</p>
                <button className="home-empty-btn tap-spring" type="button" onClick={onCreateInviteLink}>
                  <UserPlus size={18} />
                  Create invite link
                </button>
              </div>
            ) : (
              conversations.map((conversation) => {
                const hasUnread = conversation.unreadCount > 0;
                return (
                  <button
                    className={`conversation-item tap-spring ${conversation.id === activeId ? "active" : ""} ${hasUnread ? "conversation-item--unread" : ""}`}
                    key={conversation.id}
                    onClick={() => onOpenConversation(conversation.id)}
                  >
                    <BitmojiAvatar user={conversation.peer} />
                    <span className="conversation-copy">
                      <strong>{conversation.peer.name}</strong>
                      <ConversationPreview
                        conversation={conversation}
                        messages={messages}
                        identityKey={identityKey}
                        unread={hasUnread}
                      />
                    </span>
                    <span className="conversation-meta">
                      {conversation.lastMessage ? (
                        <small>{new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                      ) : null}
                      {hasUnread ? <span className="unread">{formatUnreadCount(conversation.unreadCount)}</span> : null}
                    </span>
                  </button>
                );
              })
            )}
          </section>
        </>
      )}
    </aside>
  );
}
