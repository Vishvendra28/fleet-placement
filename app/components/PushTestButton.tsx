"use client";

import { useState } from "react";

export default function PushTestButton() {
  const [status, setStatus] = useState<"idle" | "registering" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleTest() {
    setStatus("registering");
    setMsg("");
    try {
      // Step 1: ensure SW is registered and push subscription is saved
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("error");
        setMsg("This browser does not support push notifications.");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("error");
        setMsg("Notifications are blocked. Reset permissions in browser settings and reload.");
        return;
      }

      const configRes = await fetch("/api/push/config");
      const { vapidPublicKey } = await configRes.json();
      if (!vapidPublicKey) {
        setStatus("error");
        setMsg("VAPID key not found on server. Check Render env vars (VAPID_PUBLIC_KEY).");
        return;
      }

      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus("error");
          setMsg("Permission not granted.");
          return;
        }
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("SW timeout")), 10000)),
      ]);

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const key = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
        sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!saveRes.ok) {
        setStatus("error");
        setMsg("Failed to save subscription to server.");
        return;
      }

      // Step 2: send a test push
      setStatus("sending");
      const testRes = await fetch("/api/push/test", { method: "POST" });
      const data = await testRes.json();
      if (!testRes.ok) {
        setStatus("error");
        setMsg(data.error || "Failed to send test notification.");
        return;
      }

      setStatus("ok");
      setMsg("Test notification sent! You should see it in a few seconds.");
    } catch (err) {
      setStatus("error");
      const name = err instanceof DOMException ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      setMsg(name ? `[${name}] ${message}` : message);
      console.error("[PushTest]", err);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleTest}
        disabled={status === "registering" || status === "sending"}
        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "registering" && "Registering…"}
        {status === "sending" && "Sending…"}
        {(status === "idle" || status === "ok" || status === "error") && "Send Test Notification"}
      </button>
      {msg && (
        <p className={`text-sm ${status === "ok" ? "text-green-600" : "text-red-600"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
