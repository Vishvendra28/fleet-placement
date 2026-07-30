"use client";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Role } from "@prisma/client";

type User = { id: string; name: string; email: string; role: Role };
type Notif = { id: string; message: string; read: boolean; createdAt: string; placementId: string | null };

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin", PLANNING_TEAM: "Planning", PLACEMENT_TEAM: "Placement",
  DRIVER_MANAGEMENT: "Driver Mgmt", MAINTENANCE_TEAM: "Maintenance", STORE_AND_TYRE: "Store & Tyre", KAM: "KAM",
};
const ROLE_COLOR: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700", PLANNING_TEAM: "bg-blue-100 text-blue-700",
  PLACEMENT_TEAM: "bg-green-100 text-green-700", DRIVER_MANAGEMENT: "bg-orange-100 text-orange-700",
  MAINTENANCE_TEAM: "bg-pink-100 text-pink-700", STORE_AND_TYRE: "bg-yellow-100 text-yellow-700", KAM: "bg-red-100 text-red-700",
};

export default function Navbar({ user }: { user: User }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchNotifs() {
    const res = await fetch("/api/notifications");
    if (res.ok) setNotifs(await res.json());
  }

  async function markRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifs((p) => p.map((n) => ({ ...n, read: true })));
  }

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="font-semibold text-gray-900 hidden sm:block">Fleet Placement</span>
      </div>

      <nav className="flex items-center gap-1 text-sm font-medium">
        <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Dashboard</Link>
        {(user.role === "DRIVER_MANAGEMENT" || user.role === "MAINTENANCE_TEAM" || user.role === "STORE_AND_TYRE" || user.role === "PLANNING_TEAM" || user.role === "PLACEMENT_TEAM") && (
          <Link href="/issues" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Issues</Link>
        )}
        {user.role === "ADMIN" && (
          <>
            <Link href="/admin" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Admin</Link>
            <Link href="/issues" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Issues</Link>
            <Link href="/admin/analytics" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Analytics</Link>
            <Link href="/admin/vehicles" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">Vehicles</Link>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => { setOpen(!open); if (!open && unread > 0) markRead(); }}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
                {notifs.length > 0 && <button onClick={markRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifs.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
                  : notifs.map((n) => (
                    <Link
                      key={n.id}
                      href="/issues"
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? "bg-blue-50 hover:bg-blue-100" : ""}`}
                    >
                      <p className={`text-sm ${!n.read ? "font-semibold text-gray-900" : "text-gray-600"}`}>{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString("en-IN")}</p>
                    </Link>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        <span className={`hidden sm:block text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLOR[user.role]}`}>
          {ROLE_LABEL[user.role]}
        </span>
        <span className="hidden sm:block text-sm font-medium text-gray-700">{user.name}</span>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
          Sign out
        </button>
      </div>
    </header>
  );
}
