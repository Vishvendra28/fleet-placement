"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const VAPID_KEY_STORAGE = "fleet-vapid-key";

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

        // 2. Skip if blocked
        if (Notification.permission === "denied") return;

        // 3. Ask permission first (before SW wait so prompt appears immediately)
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        // 4. Register SW and wait with timeout
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

        // 5. If VAPID key changed since last subscription, unsubscribe the old
        //    one so the browser creates a fresh subscription with the new key.
        //    We detect this by storing the key used last time in localStorage.
        const storedKey = localStorage.getItem(VAPID_KEY_STORAGE);
        const existing = await registration.pushManager.getSubscription();

        if (existing && storedKey !== vapidPublicKey) {
          // Key rotated — force fresh subscription
          await existing.unsubscribe();
        } else if (existing) {
          // Same key — just re-save to keep server in sync and exit
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          });
          return;
        }

        // 6. Create new subscription with current VAPID key
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        localStorage.setItem(VAPID_KEY_STORAGE, vapidPublicKey);
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
