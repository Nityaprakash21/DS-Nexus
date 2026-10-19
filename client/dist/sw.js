// Service Worker for DS-Nexus PWA
const CACHE_NAME = "ds-nexus-cache-v1";

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event - claim control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cache) => cache !== CACHE_NAME)
          .map((cache) => caches.delete(cache))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network-first strategy with API bypass
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // CRITICAL SAFEGUARD: Never cache API calls, non-GET requests, or authentication endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/auth/")
  ) {
    return; // Passes through directly to network
  }

  // Network-first strategy for UI navigation and static assets
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache valid static responses
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is offline
        return caches.match(request);
      })
  );
});

// Native Push & In-App Forced Notification Trigger (Android & Desktop PWA)
// All reminders forced continuous notification until opened & read, despite importance tag
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    const defaultOptions = {
      icon: "/pwa-192x192.png",
      badge: "/favicon.png",
      vibrate: [300, 100, 300, 100, 300], // Forced vibration for all reminder notifications
      tag: options?.tag || "ds-nexus-reminder",
      renotify: true, // Forces re-alert on periodic refresh until marked read
      requireInteraction: true, // Forces continuous pinning in Android notification drawer & desktop tray
      data: {
        url: options?.url || "/dashboard",
        reminderId: options?.reminderId || null,
      },
      ...options,
      // Guarantee requireInteraction & renotify remain true despite any override
      requireInteraction: true,
      renotify: true,
    };
    self.registration.showNotification(title, defaultOptions);
  } else if (event.data.type === "CLOSE_NOTIFICATION") {
    const tag = event.data.tag;
    if (tag) {
      self.registration.getNotifications({ tag }).then((notifications) => {
        notifications.forEach((n) => n.close());
      });
    }
  } else if (event.data.type === "CLOSE_ALL_NOTIFICATIONS") {
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});

// Background Push Notification Event - Forced continuous alert
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Task Reminder - DS Nexus", body: event.data.text() };
    }
  }

  const title = data.title || "Task Reminder - DS Nexus";
  const options = {
    body: data.body || "You have an active operational reminder.",
    icon: "/pwa-192x192.png",
    badge: "/favicon.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: data.id ? `task-${data.id}` : "admin-task-reminder",
    renotify: true,
    requireInteraction: true, // Continuous until read
    data: {
      url: data.url || "/dashboard",
      reminderId: data.id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Native Android / Desktop notification click handler
// When admin taps notification, opens/focuses app and marks task as read
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const reminderId = event.notification.data?.reminderId;
  const targetUrl = reminderId
    ? `/dashboard?openReminder=${encodeURIComponent(reminderId)}`
    : (event.notification.data?.url || "/dashboard");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (reminderId) {
            client.postMessage({
              type: "REMINDER_OPENED",
              reminderId,
            });
          }
          if (client.url && client.url.includes("/dashboard")) {
            return client.focus();
          }
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
