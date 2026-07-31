"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscriber() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    async function subscribe() {
      try {
        // 1. Fetch VAPID key from server at runtime
        const configRes = await fetch("/api/push/config");
        if (!configRes.ok) return;
        const { vapidPublicKey } = await configRes.json();
        if (!vapidPublicKey) return;

        // 2. Skip immediately if user already blocked notifications
        if (Notification.permission === "denied") return;

        // 3. Ask for permission FIRST — before waiting for SW so prompt
        //    appears right away and doesn't hang on SW activation
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        // 4. Register SW explicitly and wait with a timeout
        await navigator.serviceWorker.register("/sw.js");
        let registration: ServiceWorkerRegistration;
        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("SW timeout")), 10000)
            ),
          ]);
        } catch (err) {
          console.error("[PushSubscriber] SW not ready:", err);
          return;
        }

        // 5. Re-send existing subscription to keep server in sync
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          });
          return;
        }

        // 6. Create new subscription
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch (err) {
        console.error("[PushSubscriber]", err);
      }
    }

    subscribe();
  }, [session]);

  return null;
}
