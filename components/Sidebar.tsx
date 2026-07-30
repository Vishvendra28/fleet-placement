"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Role } from "@prisma/client";

type User = { id: string; name: string; email: string; role: Role };

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin", PLANNING_TEAM: "Planning Team", PLACEMENT_TEAM: "Placement Team",
  DRIVER_MANAGEMENT: "Driver Mgmt", MAINTENANCE_TEAM: "Maintenance", STORE_AND_TYRE: "Store & Tyre", KAM: "KAM",
};
const ROLE_COLOR: Record<Role, string> = {
  ADMIN: "bg-violet-500/25 text-violet-300",
  PLANNING_TEAM: "bg-blue-500/25 text-blue-300",
  PLACEMENT_TEAM: "bg-emerald-500/25 text-emerald-300",
  DRIVER_MANAGEMENT: "bg-orange-500/25 text-orange-300",
  MAINTENANCE_TEAM: "bg-pink-500/25 text-pink-300",
  STORE_AND_TYRE: "bg-yellow-500/25 text-yellow-300",
  KAM: "bg-red-500/25 text-red-300",
};

function SvgIcon({ d, cls }: { d: string; cls?: string }) {
  return (
    <svg className={cls ?? "w-4 h-4 flex-shrink-0"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

const IC = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  truck: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
  list: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M6 18L18 6M6 6l12 12",
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};

type NavItem = { label: string; href: string; icon: keyof typeof IC; roles?: Role[] };

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        active ? "bg-blue-500/15 text-blue-200" : "text-slate-400 hover:bg-white/6 hover:text-slate-200"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-blue-400" />
      )}
      <SvgIcon d={IC[item.icon]} cls={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-300" : ""}`} />
      <span>{item.label}</span>
    </Link>
  );
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  {
    label: "Issues", href: "/issues", icon: "alert",
    roles: ["ADMIN", "PLANNING_TEAM", "PLACEMENT_TEAM", "DRIVER_MANAGEMENT", "MAINTENANCE_TEAM", "STORE_AND_TYRE"],
  },
  {
    label: "D-1 Pending", href: "/d1-pending", icon: "clock",
    roles: ["ADMIN", "PLANNING_TEAM", "PLACEMENT_TEAM"],
  },
  {
    label: "Same Day Pending", href: "/sameday-pending", icon: "clock",
    roles: ["ADMIN", "PLANNING_TEAM", "PLACEMENT_TEAM"],
  },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Master", href: "/master", icon: "list" },
  { label: "Analytics", href: "/admin/analytics", icon: "chart" },
  { label: "Vehicle Health", href: "/admin/vehicles", icon: "truck" },
  { label: "All Issues", href: "/admin/issues", icon: "list" },
  { label: "Activity History", href: "/admin/history", icon: "clock" },
];

const IC_USER = "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z";

export default function Sidebar({ user }: { user: User }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const visibleMain = MAIN_NAV.filter((i) => !i.roles || i.roles.includes(user.role));
  const closeMobile = () => setMobileOpen(false);
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const inner = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/40">
            <SvgIcon d={IC.truck} cls="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-tight">Fleet</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest">Placement System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleMain.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClose={closeMobile} />)}

        {user.role === "ADMIN" && (
          <>
            <div className="px-3 pt-5 pb-1.5 flex items-center gap-2">
              <div className="flex-1 h-px bg-white/8" />
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Admin</p>
              <div className="flex-1 h-px bg-white/8" />
            </div>
            {ADMIN_NAV.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClose={closeMobile} />)}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 pt-2 border-t border-white/8 space-y-1">
        {/* Profile link */}
        <Link
          href="/profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
            pathname === "/profile"
              ? "bg-blue-500/15 text-blue-200"
              : "text-slate-400 hover:bg-white/6 hover:text-slate-200"
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate leading-tight">{user.name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block ${ROLE_COLOR[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>
          <SvgIcon d={IC_USER} cls="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
        </Link>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition-all text-sm font-medium"
        >
          <SvgIcon d={IC.logout} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-60 bg-gradient-to-b from-slate-900 to-slate-950 z-30 shadow-xl">
        {inner}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 bg-slate-900 text-white rounded-xl shadow-lg"
        aria-label="Open menu"
      >
        <SvgIcon d={IC.menu} cls="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 to-slate-950 z-50 flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <SvgIcon d={IC.x} cls="w-5 h-5" />
            </button>
            {inner}
          </aside>
        </>
      )}
    </>
  );
}
