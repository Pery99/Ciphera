self.addEventListener("push", (event) => {
  let payload = {
    title: "Ciphera",
    body: "You have a new message",
    data: {}
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Keep generic fallback payload.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Ciphera", {
      body: payload.body || "You have a new message",
      tag: "ciphera-message",
      data: payload.data || {},
      renotify: true
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId ? `/?conversation=${encodeURIComponent(conversationId)}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage({ type: "ciphera:notification-open", conversationId: conversationId ?? null });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});