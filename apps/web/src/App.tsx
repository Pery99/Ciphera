import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { AuthSubmitPayload } from "./components/AuthFlow.tsx";
import type { DecryptedMessage } from "./components/MessageBubble.tsx";
import type { PendingAttachment } from "./components/PendingAttachmentStrip.tsx";
import { MediaLightbox } from "./components/MediaLightbox.tsx";
import { NotificationGate } from "./components/NotificationGate.tsx";
import { HomeSidebar } from "./components/HomeSidebar.tsx";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { AppGate } from "./components/AppGate.tsx";
import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
import { ToastHost, useToasts } from "./components/ToastHost.tsx";
import { copyToClipboard, shareText } from "./clipboard.ts";
import { getMessagePreview } from "./messagePreview.ts";
import { successHaptic, tapHaptic } from "./haptics.ts";
import type { Conversation, Message, UserProfile } from "@ciphera/types";
import type { ClientToServerEvents, ServerToClientEvents } from "@ciphera/contracts";
import { deriveConversationKey, encryptText, generateClientIdentityKey } from "@ciphera/crypto";
import { api } from "./api.ts";
import { applyIncomingMessage, clearConversationUnread, mergeMessages } from "./conversationList.ts";
import { uploadAttachment } from "./mediaUpload.ts";
import { clearOutboundQueue, enqueueOutboundMessage, getOutboundAttachmentBlob, isNetworkAvailable, listOutboundMessages, markOutboundMessageDispatched, outboundEntryToMessage, removeOutboundMessage, type OutboundQueueEntry } from "./outboundQueue.ts";
import { formatAuthError, formatUserError } from "./apiErrors.ts";
import { ensurePushSubscription, getPushPermissionState, registerServiceWorker, unsubscribePush } from "./push.ts";
import { clearPushEnabled, isPushSkipped, markPushEnabled, markPushSkipped } from "./pushPreferences.ts";
import { clearLegacySessionStorage } from "./session.ts";
import { deviceId, emptyMessages, getInitialAuthMode, getInviteTokenFromLocation, getNotificationConversationFromLocation, resolveSocketUrl, type PushAccess, type SocketStatus } from "./appConfig.ts";
import { kindFromFile } from "./attachmentKinds.ts";
import { useDecryptedMessages } from "./useDecryptedMessages.ts";
type OutboundSocketMessage = Parameters<ClientToServerEvents["message:send"]>[0];
export function App() {
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [browserKey, setBrowserKey] = useState<string>("");
  const [mode, setMode] = useState<"login" | "signup">(getInitialAuthMode);
  const [mobileView, setMobileView] = useState<"home" | "chat">("home");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [localAttachmentPreviews, setLocalAttachmentPreviews] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [splashMinDone, setSplashMinDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [pushAccess, setPushAccess] = useState<PushAccess>("checking");
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [pendingInviteToken, setPendingInviteToken] = useState(() => getInviteTokenFromLocation());
  const [inviteContext, setInviteContext] = useState<{ inviterName: string; username: string } | null>(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(() => Boolean(getInviteTokenFromLocation()));
  const [invitePreviewError, setInvitePreviewError] = useState("");
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { toasts, showToast, dismissToast } = useToasts();
  const [mediaViewer, setMediaViewer] = useState<{ url: string; kind: "image" | "video" } | null>(null);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DecryptedMessage | null>(null);
  const messagePaneRef = useRef<HTMLElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const composerStackRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActiveRef = useRef(false);
  const typingConversationRef = useRef("");
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);
  const activeIdRef = useRef(activeId);
  const mobileViewRef = useRef(mobileView);
  const sessionUserRef = useRef(sessionUser);
  const flushingOutboundRef = useRef(false);
  const conversationsRef = useRef(conversations);
  const pendingOpenConversationRef = useRef<string | null>(getNotificationConversationFromLocation());
  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const conversationIdsKey = useMemo(
    () => conversations.map((conversation) => conversation.id).sort().join(","),
    [conversations]
  );
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    mobileViewRef.current = mobileView;
  }, [mobileView]);
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  function markConversationRead(conversationId: string) {
    setConversations((value) => clearConversationUnread(value, conversationId));
    void api.markConversationRead(conversationId).catch(() => {});
  }
  const joinAllConversations = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const conversation of conversationsRef.current) {
      socket.emit("conversation:join", conversation.id);
    }
  }, []);
  const dispatchOutboundEntry = useCallback(async (entry: OutboundQueueEntry) => {
    const socket = socketRef.current;
    if (!socket?.connected) throw new Error("Socket offline");
    const conversationKey = await deriveConversationKey(entry.conversationId);
    const attachments = await Promise.all(
      entry.pendingAttachments.map(async (attachment) => {
        const blob = await getOutboundAttachmentBlob(entry.clientMessageId, attachment.id);
        if (!blob) throw new Error("Missing queued attachment.");
        const file = new File([blob], attachment.name, { type: attachment.mimeType });
        return uploadAttachment(
          {
            id: attachment.id,
            file,
            kind: attachment.kind,
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            durationMs: attachment.durationMs
          },
          conversationKey
        );
      })
    );

    const payload: OutboundSocketMessage = {
      conversationId: entry.conversationId,
      encryptedPayload: entry.encryptedPayload,
      attachments,
      ...(entry.replyToId ? { replyToId: entry.replyToId } : {})
    };

    socket.emit("message:send", payload);
    await markOutboundMessageDispatched(entry.clientMessageId);
  }, []);

  const flushOutboundQueue = useCallback(async () => {
    if (flushingOutboundRef.current) return;
    if (!socketRef.current?.connected || !sessionUserRef.current || !isNetworkAvailable()) return;

    flushingOutboundRef.current = true;
    try {
      const entries = await listOutboundMessages();
      for (const entry of entries) {
        if (entry.dispatchState === "dispatched") continue;
        try {
          await dispatchOutboundEntry(entry);
        } catch {
          break;
        }
      }
    } finally {
      flushingOutboundRef.current = false;
    }
  }, [dispatchOutboundEntry]);

  const hydrateOutboundQueue = useCallback(
    async (userId: string) => {
      const entries = await listOutboundMessages();
      if (entries.length === 0) return;

      setMessages((value) => {
        const next = { ...value };
        for (const entry of entries) {
          const queuedMessage = outboundEntryToMessage(entry, userId);
          const existing = next[entry.conversationId] ?? [];
          if (
            existing.some(
              (item) =>
                item.id === entry.clientMessageId || item.encryptedPayload.aad === entry.clientMessageId
            )
          ) {
            continue;
          }
          next[entry.conversationId] = [...existing, queuedMessage];
        }
        return next;
      });

      setConversations((value) => {
        let next = value;
        for (const entry of entries) {
          next = applyIncomingMessage(next, outboundEntryToMessage(entry, userId), {
            selfId: userId,
            activeConversationId: activeIdRef.current,
            mobileView: mobileViewRef.current
          });
        }
        return next;
      });

      await flushOutboundQueue();
    },
    [flushOutboundQueue]
  );

  const activeMessages = messages[activeId] ?? emptyMessages;

  useEffect(() => {
    api.setAccessTokenListener((token) => setAccessToken(token));
    return () => api.setAccessTokenListener(undefined);
  }, []);

  useEffect(() => {
    generateClientIdentityKey()
      .then(setBrowserKey)
      .catch(() => showToast("Unable to initialize browser key storage.", "error"));
    void registerServiceWorker();
  }, [showToast]);

  useEffect(() => {
    if (!sessionUser) {
      setPushAccess("checking");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await registerServiceWorker();
        const permission = getPushPermissionState();
        if (permission === "granted") {
          const result = await ensurePushSubscription();
          if (cancelled) return;
          if (result.ok) {
            markPushEnabled();
            setPushActive(true);
            setShowPushPrompt(false);
          } else if (!isPushSkipped()) {
            setShowPushPrompt(true);
          }
        } else if (!isPushSkipped()) {
          if (!cancelled) setShowPushPrompt(true);
        }
      } catch {
        if (!cancelled && !isPushSkipped()) setShowPushPrompt(true);
      } finally {
        if (!cancelled) setPushAccess("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashMinDone(true), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!splashMinDone || isRestoringSession) return;
    const timer = window.setTimeout(() => setShowSplash(false), 280);
    return () => window.clearTimeout(timer);
  }, [splashMinDone, isRestoringSession]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      clearLegacySessionStorage();

      try {
        const session = await api.refresh();
        if (cancelled) return;
        await finishSessionRestore(session.accessToken, session.user);
      } catch {
        if (!cancelled) {
          api.setToken(undefined);
          clearLegacySessionStorage();
        }
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    }

    async function finishSessionRestore(accessToken: string, user: UserProfile) {
      api.setToken(accessToken);
      setAccessToken(accessToken);
      setSessionUser(user);
      setIsLoadingConversations(true);
      try {
        const loadedConversations = await api.conversations().catch(() => []);
        setConversations(loadedConversations);

        const pendingConversationId = pendingOpenConversationRef.current;
        const notificationConversationId =
          pendingConversationId && loadedConversations.some((conversation) => conversation.id === pendingConversationId)
            ? pendingConversationId
            : null;

        if (notificationConversationId) {
          pendingOpenConversationRef.current = null;
          window.history.replaceState({}, "", window.location.pathname);
        }

        const restoredActiveId = notificationConversationId ?? loadedConversations[0]?.id ?? "";
        setActiveId(restoredActiveId);
        setMobileView(notificationConversationId ? "chat" : "home");
        await hydrateOutboundQueue(user.id);
      } finally {
        setIsLoadingConversations(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingInviteToken) {
      setInviteContext(null);
      setInvitePreviewLoading(false);
      setInvitePreviewError("");
      return;
    }

    let cancelled = false;
    setInvitePreviewLoading(true);
    setInvitePreviewError("");

    api
      .previewInvite(pendingInviteToken)
      .then((invite) => {
        if (cancelled) return;
        setInviteContext({ inviterName: invite.inviter.name, username: invite.inviter.username });
        if (!sessionUser) setMode("signup");
      })
      .catch((caught) => {
        if (cancelled) return;
        setInviteContext(null);
        setInvitePreviewError(formatUserError(caught, "This invite link is invalid or expired."));
      })
      .finally(() => {
        if (!cancelled) setInvitePreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pendingInviteToken, sessionUser]);

  const decryptedMessages = useDecryptedMessages(activeMessages, browserKey);
  const messageById = useMemo(() => {
    const map = new Map<string, DecryptedMessage>();
    decryptedMessages.forEach((message) => map.set(message.id, message));
    return map;
  }, [decryptedMessages]);

  useEffect(() => {
    setReplyingTo(null);
  }, [activeId]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const run = () => {
      const pane = messagePaneRef.current;
      if (!pane) return;
      pane.scrollTo({ top: pane.scrollHeight, behavior });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  const refreshConversationMessages = useCallback(
    async (conversationId: string) => {
      try {
        const loadedMessages = await api.messages(conversationId);
        setMessages((value) => ({
          ...value,
          [conversationId]: mergeMessages(value[conversationId] ?? [], loadedMessages)
        }));
        if (conversationId === activeIdRef.current) {
          scrollToLatest("auto");
          window.setTimeout(() => scrollToLatest("auto"), 120);
        }
      } catch {
        // Keep cached messages when refresh fails.
      }
    },
    [scrollToLatest]
  );

  const openConversationFromNotification = useCallback(
    (conversationId: string) => {
      if (!sessionUserRef.current) {
        pendingOpenConversationRef.current = conversationId;
        return;
      }

      pendingOpenConversationRef.current = null;
      setActiveId(conversationId);
      setMobileView("chat");
      markConversationRead(conversationId);
      void refreshConversationMessages(conversationId);
    },
    [refreshConversationMessages]
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type !== "ciphera:notification-open" || !event.data.conversationId) return;
      openConversationFromNotification(event.data.conversationId);
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
  }, [openConversationFromNotification]);

  useEffect(() => {
    if (!sessionUser) return;

    async function handleForeground() {
      if (document.visibilityState && document.visibilityState !== "visible") return;

      const pendingConversationId = pendingOpenConversationRef.current;
      if (pendingConversationId) {
        openConversationFromNotification(pendingConversationId);
        pendingOpenConversationRef.current = null;
        return;
      }

      const conversationId = activeIdRef.current;
      if (!conversationId || mobileViewRef.current !== "chat") return;

      await refreshConversationMessages(conversationId);
      const loadedConversations = await api.conversations().catch(() => null);
      if (loadedConversations) setConversations(loadedConversations);
    }

    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("pageshow", handleForeground);
    return () => {
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("pageshow", handleForeground);
    };
  }, [sessionUser, openConversationFromNotification, refreshConversationMessages]);

  const lastMessageKey = activeMessages.at(-1)?.id ?? "none";

  useEffect(() => {
    if (!activeId || mobileView !== "chat" || decryptedMessages.length === 0) return;
    scrollToLatest("auto");
  }, [activeId, mobileView, lastMessageKey, decryptedMessages.length, scrollToLatest]);

  useEffect(() => {
    if (!accessToken || !sessionUser) return;

    setSocketStatus("connecting");

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(resolveSocketUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      joinAllConversations();
      void flushOutboundQueue();
    });

    socket.on("disconnect", () => {
      setSocketStatus("reconnecting");
    });

    socket.io.on("reconnect_attempt", () => {
      setSocketStatus("reconnecting");
    });

    socket.on("message:new", (message) => {
      const user = sessionUserRef.current;
      if (user && message.senderId !== user.id && message.conversationId === activeIdRef.current) {
        setIsPeerTyping(false);
      }

      setMessages((value) => {
        const existing = value[message.conversationId] ?? [];
        if (existing.some((item) => item.id === message.id)) return value;
        const clientMessageId = message.encryptedPayload.aad;
        if (clientMessageId) {
          const queuedIndex = existing.findIndex((item) => item.status === "queued" && item.encryptedPayload.aad === clientMessageId);
          if (queuedIndex >= 0) {
            const next = [...existing];
            const replaced = existing[queuedIndex];
            next[queuedIndex] = message;
            void removeOutboundMessage(clientMessageId);
            releaseLocalAttachmentPreviews(replaced.attachments.map((attachment) => attachment.id));
            return { ...value, [message.conversationId]: next };
          }
        }
        return { ...value, [message.conversationId]: [...existing, message] };
      });

      if (!user) return;

      setConversations((value) =>
        applyIncomingMessage(value, message, {
          selfId: user.id,
          activeConversationId: activeIdRef.current,
          mobileView: mobileViewRef.current
        })
      );

      if (message.conversationId === activeIdRef.current && mobileViewRef.current === "chat") {
        void api.markConversationRead(message.conversationId).catch(() => {});
      }
    });

    socket.on("message:status", (status) => {
      setMessages((value) => ({
        ...value,
        [status.conversationId]: (value[status.conversationId] ?? []).map((message) =>
          message.id === status.id ? { ...message, ...status } : message
        )
      }));
    });

    socket.on("typing:update", ({ conversationId, userId, isTyping }) => {
      const user = sessionUserRef.current;
      if (!user || userId === user.id) return;
      if (conversationId !== activeIdRef.current) return;
      setIsPeerTyping(isTyping);
    });

    socket.on("connect_error", () => {
      setSocketStatus("reconnecting");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("connecting");
    };
  }, [accessToken, sessionUser, joinAllConversations, flushOutboundQueue]);

  useEffect(() => {
    if (!sessionUser) return;

    function handleOnline() {
      void flushOutboundQueue();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sessionUser, flushOutboundQueue]);

  useEffect(() => {
    if (!sessionUser || !conversationIdsKey) return;
    joinAllConversations();
  }, [sessionUser, conversationIdsKey, joinAllConversations]);

  useEffect(() => {
    setIsPeerTyping(false);
    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      if (isTypingActiveRef.current && typingConversationRef.current) {
        socketRef.current?.emit("typing:stop", typingConversationRef.current);
        isTypingActiveRef.current = false;
        typingConversationRef.current = "";
      }
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeId || !sessionUser) return;
    socketRef.current?.emit("conversation:join", activeId);
    api
      .messages(activeId)
      .then((loadedMessages) => {
        setMessages((value) => ({
          ...value,
          [activeId]: mergeMessages(value[activeId] ?? [], loadedMessages)
        }));
        scrollToLatest("auto");
        window.setTimeout(() => scrollToLatest("auto"), 120);
      })
      .catch(() => setMessages((value) => ({ ...value, [activeId]: value[activeId] ?? [] })));
  }, [activeId, sessionUser, scrollToLatest]);

  useEffect(() => {
    if (!activeId || mobileView !== "chat") return;
    markConversationRead(activeId);
  }, [activeId, mobileView]);

  function emitTypingStop(conversationId: string) {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    if (!isTypingActiveRef.current) return;
    isTypingActiveRef.current = false;
    typingConversationRef.current = "";
    socketRef.current?.emit("typing:stop", conversationId);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!activeId) return;

    if (!value.trim()) {
      emitTypingStop(activeId);
      return;
    }

    if (!isTypingActiveRef.current) {
      isTypingActiveRef.current = true;
      typingConversationRef.current = activeId;
      socketRef.current?.emit("typing:start", activeId);
    }

    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    typingStopTimeoutRef.current = setTimeout(() => emitTypingStop(activeId), 2000);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() && pendingAttachments.length === 0) return;
    if (!activeId || !sessionUser) return;

    emitTypingStop(activeId);
    const attachmentsToSend = [...pendingAttachments];
    const replyTarget = replyingTo;
    const clientMessageId = `client-${crypto.randomUUID()}`;
    try {
      const plaintext = draft.trim();
      const conversationKey = await deriveConversationKey(activeId);
      const encryptedPayload = {
        ...(await encryptText(plaintext, conversationKey, deviceId)),
        aad: clientMessageId
      };
      const optimisticAttachments = attachmentsToSend.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        encryptedResourceRef: `pending://${attachment.id}`,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        durationMs: attachment.durationMs ?? null,
        width: null,
        height: null
      }));
      const optimisticMessage: Message = {
        id: clientMessageId,
        conversationId: activeId,
        senderId: sessionUser.id,
        replyToId: replyTarget?.id ?? null,
        encryptedPayload,
        attachments: optimisticAttachments,
        status: "queued",
        createdAt: new Date().toISOString()
      };

      const previewMap: Record<string, string> = {};
      attachmentsToSend.forEach((attachment) => {
        if (attachment.previewUrl) previewMap[attachment.id] = attachment.previewUrl;
      });
      setLocalAttachmentPreviews((value) => ({ ...value, ...previewMap }));

      setMessages((value) => ({ ...value, [activeId]: [...(value[activeId] ?? []), optimisticMessage] }));
      setConversations((value) =>
        applyIncomingMessage(value, optimisticMessage, {
          selfId: sessionUser.id,
          activeConversationId: activeId,
          mobileView
        })
      );
      scrollToLatest("smooth");

      setDraft("");
      setReplyingTo(null);
      setPendingAttachments([]);

      const queueEntry: OutboundQueueEntry = {
        clientMessageId,
        conversationId: activeId,
        replyToId: replyTarget?.id ?? null,
        encryptedPayload,
        createdAt: optimisticMessage.createdAt,
        pendingAttachments: attachmentsToSend.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          durationMs: attachment.durationMs
        })),
        dispatchState: "pending"
      };
      const attachmentFiles = new Map(attachmentsToSend.map((attachment) => [attachment.id, attachment.file]));
      await enqueueOutboundMessage(queueEntry, attachmentFiles);

      if (!socketRef.current?.connected || !isNetworkAvailable()) {
        setSocketStatus("reconnecting");
      }

      await flushOutboundQueue();
    } catch (caught) {
      showToast(formatUserError(caught, "Could not send message."), "error");
    }
  }

  async function completeAuth(payload: AuthSubmitPayload) {
    setError("");
    setIsAuthenticating(true);
    try {
      const identityKey = browserKey || (await generateClientIdentityKey());
      const session =
        payload.mode === "signup"
          ? await api.signUp({
              name: payload.name ?? "",
              username: payload.username,
              email: payload.email ?? "",
              password: payload.password,
              publicIdentityKey: identityKey,
              ...(pendingInviteToken ? { inviteToken: pendingInviteToken } : {})
            })
          : await api.login({ username: payload.username, password: payload.password });

      let redirectConversationId = session.redirectConversationId;
      if (pendingInviteToken && payload.mode === "login") {
        const accepted = await api.acceptInvite(pendingInviteToken);
        redirectConversationId = accepted.conversationId;
      }

      api.setToken(session.accessToken);
      setAccessToken(session.accessToken);
      setSessionUser(session.user);
      setIsLoadingConversations(true);
      const loadedConversations = await api.conversations().catch(() => []);
      setConversations(loadedConversations);
      const nextActiveId = redirectConversationId ?? loadedConversations[0]?.id ?? "";
      setActiveId(nextActiveId);
      setMobileView("home");
      setMessages({});
      if (pendingInviteToken || redirectConversationId) {
        setPendingInviteToken("");
        setInviteContext(null);
        window.history.replaceState({}, "", "/");
      }
      await hydrateOutboundQueue(session.user.id);
      successHaptic();
    } catch (caught) {
      setError(formatAuthError(caught, payload.mode));
    } finally {
      setIsAuthenticating(false);
      setIsLoadingConversations(false);
    }
  }

  async function handleLogout() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    await clearOutboundQueue().catch(() => {});
    await api.logout().catch(() => {});
    await unsubscribePush().catch(() => {});
    clearPushEnabled();
    clearLegacySessionStorage();
    api.setToken(undefined);
    setSessionUser(null);
    setAccessToken("");
    setConversations([]);
    setMessages({});
    setActiveId("");
    setDraft("");
    setReplyingTo(null);
    setPendingAttachments([]);
    setMobileView("home");
    setShowSettings(false);
    setShowPushPrompt(false);
    setPushActive(false);
    setPushAccess("checking");
    setSocketStatus("connecting");
    setError("");
  }

  function dismissPendingInvite() {
    setPendingInviteToken("");
    setInviteContext(null);
    setInvitePreviewError("");
    window.history.replaceState({}, "", "/");
  }

  async function acceptPendingInvite() {
    if (!pendingInviteToken) return;
    setIsAcceptingInvite(true);
    setInvitePreviewError("");
    try {
      const { conversationId } = await api.acceptInvite(pendingInviteToken);
      const loadedConversations = await api.conversations();
      setConversations(loadedConversations);
      setActiveId(conversationId);
      setMobileView("chat");
      setMessages((value) => ({ ...value, [conversationId]: value[conversationId] ?? [] }));
      dismissPendingInvite();
      successHaptic();
    } catch (caught) {
      setInvitePreviewError(formatUserError(caught, "Could not accept invite."));
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  function openConversation(conversationId: string) {
    tapHaptic();
    const isAlreadyActive = activeId === conversationId;
    setActiveId(conversationId);
    setMobileView("chat");
    markConversationRead(conversationId);
    if (isAlreadyActive) {
      void refreshConversationMessages(conversationId);
    }
  }

  function backToHome() {
    tapHaptic();
    setMobileView("home");
  }

  function startReply(message: DecryptedMessage) {
    setReplyingTo(message);
    window.requestAnimationFrame(() => {
      composerStackRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      composerInputRef.current?.focus({ preventScroll: true });
    });
  }

  async function startConversationWith(user: UserProfile) {
    try {
      const conversation = await api.createConversation(user.username);
      setConversations((value) =>
        value.some((item) => item.id === conversation.id) ? value : [conversation, ...value]
      );
      openConversation(conversation.id);
      setMessages((value) => ({ ...value, [conversation.id]: value[conversation.id] ?? [] }));
    } catch (caught) {
      showToast(formatUserError(caught, "Could not start conversation."), "error");
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((value) => {
      const target = value.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return value.filter((item) => item.id !== id);
    });
  }

  function releaseLocalAttachmentPreviews(attachmentIds: string[]) {
    if (attachmentIds.length === 0) return;
    setLocalAttachmentPreviews((value) => {
      const next = { ...value };
      for (const attachmentId of attachmentIds) {
        const previewUrl = next[attachmentId];
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        delete next[attachmentId];
      }
      return next;
    });
  }

  function revokePendingAttachments(attachments: PendingAttachment[]) {
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
  }

  async function createInviteLink() {
    try {
      const invite = await api.createInvite();
      const copied = await copyToClipboard(invite.inviteUrl);
      if (copied) {
        showToast("Invite link copied", "success");
        successHaptic();
        return;
      }

      const shared = await shareText(invite.inviteUrl);
      if (shared) {
        showToast("Invite link ready to share", "success");
        successHaptic();
        return;
      }

      showToast("Could not copy link. Try again.", "error");
    } catch (caught) {
      showToast(formatUserError(caught, "Could not create invite link."), "error");
    }
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const nextAttachments = files.flatMap((file) => {
      const kind = kindFromFile(file);
      if (!kind) return [];
      return [
        {
          id: crypto.randomUUID(),
          file,
          kind,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          previewUrl: URL.createObjectURL(file)
        }
      ];
    });
    if (nextAttachments.length === 0) return;
    setPendingAttachments((value) => [...value, ...nextAttachments]);
    event.target.value = "";
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationMs = Date.now() - recordingStartedAtRef.current;
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
        const previewUrl = URL.createObjectURL(file);
        setPendingAttachments((value) => [
          ...value,
          {
            id: crypto.randomUUID(),
            file,
            kind: "voice",
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            durationMs,
            previewUrl
          }
        ]);
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      showToast("Microphone access was blocked or unavailable.", "error");
      setIsRecording(false);
    }
  }

  const shouldShowGate = showSplash || isRestoringSession || !sessionUser || Boolean(pendingInviteToken) || pushAccess === "checking";
  if (shouldShowGate) {
    return (
    <AppGate
      showSplash={showSplash}
      splashExiting={splashMinDone && !isRestoringSession}
      restoringSession={isRestoringSession}
      hasSessionUser={Boolean(sessionUser)}
      mode={mode}
      pendingInviteToken={pendingInviteToken}
      inviteContext={inviteContext}
      invitePreviewLoading={invitePreviewLoading}
      invitePreviewError={invitePreviewError}
      isAuthenticating={isAuthenticating}
      isAcceptingInvite={isAcceptingInvite}
      error={error}
      pushChecking={pushAccess === "checking"}
      toasts={toasts}
      onDismissToast={dismissToast}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        setError("");
        if (!pendingInviteToken) {
          window.history.replaceState({}, "", nextMode === "signup" ? "/register" : "/");
        }
      }}
      onErrorClear={() => {
        setError("");
        setInvitePreviewError("");
      }}
      onSubmit={completeAuth}
      onAcceptInvite={() => void acceptPendingInvite()}
      onDismissInvite={dismissPendingInvite}
    />
    );
  }

  function handlePushEnabled() {
    markPushEnabled();
    setPushActive(true);
    setShowPushPrompt(false);
  }

  function handlePushSkipped() {
    markPushSkipped();
    setShowPushPrompt(false);
  }

  return (
    <main className={`app-shell ${mobileView === "chat" ? "app-shell--chat" : "app-shell--home"}`}>
      {showPushPrompt ? (
        <NotificationGate overlay onEnabled={handlePushEnabled} onSkip={handlePushSkipped} />
      ) : null}
      <ConnectionBanner status={socketStatus} />
      <HomeSidebar
        mobileHidden={mobileView === "chat"}
        showSettings={showSettings}
        user={sessionUser}
        conversations={conversations}
        messages={messages}
        activeId={activeId}
        identityKey={browserKey}
        isLoadingConversations={isLoadingConversations}
        pushActive={pushActive}
        encryptionReady={Boolean(browserKey)}
        onShowSettings={() => setShowSettings(true)}
        onHideSettings={() => setShowSettings(false)}
        onLogout={() => void handleLogout()}
        onEnableNotifications={() => setShowPushPrompt(true)}
        onCreateInviteLink={() => {
          tapHaptic();
          void createInviteLink();
        }}
        onStartConversation={startConversationWith}
        onOpenConversation={openConversation}
      />

      <ChatPanel
        mobileHidden={mobileView === "home"}
        activeConversation={activeConversation}
        activeMessages={activeMessages}
        decryptedMessages={decryptedMessages}
        sessionUser={sessionUser}
        isPeerTyping={isPeerTyping}
        messageById={messageById}
        localAttachmentPreviews={localAttachmentPreviews}
        pendingAttachments={pendingAttachments}
        replyingTo={replyingTo}
        draft={draft}
        isRecording={isRecording}
        messagePaneRef={messagePaneRef}
        composerStackRef={composerStackRef}
        imageInputRef={imageInputRef}
        composerInputRef={composerInputRef}
        onBack={backToHome}
        onOpenMedia={(url, kind) => setMediaViewer({ url, kind })}
        onReply={startReply}
        onCancelReply={() => setReplyingTo(null)}
        onRemovePendingAttachment={removePendingAttachment}
        onSubmit={sendMessage}
        onFilesSelected={handleFilesSelected}
        onDraftChange={handleDraftChange}
        onToggleRecording={toggleRecording}
      />

      {mediaViewer && <MediaLightbox url={mediaViewer.url} kind={mediaViewer.kind} onClose={() => setMediaViewer(null)} />}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}


