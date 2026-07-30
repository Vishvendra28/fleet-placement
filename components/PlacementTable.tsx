"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Role } from "@prisma/client";
import {
  DRIVER_ISSUE_LABELS, MAINTENANCE_ISSUE_LABELS, ELOCK_STATUS_LABELS,
  IDFY_STATUS_LABELS, EQUIPMENT_STATUS_LABELS, FINAL_STATUS_LABELS, LANE_TYPE_LABELS,
} from "@/lib/constants";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function CountdownBadge({ placementTime }: { placementTime: string }) {
  const now = useNow(60000);
  const target = new Date(placementTime).getTime();
  const diffMs = target - now;
  const diffMin = Math.round(diffMs / 60000);

  if (diffMs < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse whitespace-nowrap">
        OVERDUE
      </span>
    );
  }
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  if (diffMin <= 120) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse whitespace-nowrap">
        {label}
      </span>
    );
  }
  if (diffMin <= 240) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
        {label}
      </span>
    );
  }
  return null;
}

type Placement = {
  id: string; date: string; cohort: string; laneType: string; placementTime: string; finalStatus: string;
  compliance: string | null;
  driverNumber1: string | null; driverNumber2: string | null;
  client: { name: string }; route: { name: string }; vehicle: { id: string; vehicleNumber: string } | null;
  d1Remark: { driverIssue?: string; maintenanceIssue?: string } | null;
  sameDayRemark: { driverIssue?: string; maintenanceIssue?: string } | null;
  placementTeamRemark: { elockStatus?: string; idfyDrivers?: string; cargoNet?: string; tirpal?: string; stepney?: string } | null;
  issueAlerts: { status: string }[];
};

type VehicleOption = { id: string; vehicleNumber: string; type: string | null };

type ViewMode = "week" | "month";

const canPlan = (r: Role) => r === "PLANNING_TEAM" || r === "ADMIN";
const canPlace = (r: Role) => r === "PLACEMENT_TEAM" || r === "ADMIN";

const STATUS_COLOR: Record<string, string> = {
  PLACED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  NOT_PLACED: "bg-red-100 text-red-800 border-red-200",
};

const ROW_BG: Record<string, string> = {
  PLACED: "bg-emerald-50/60 hover:bg-emerald-50",
  PENDING: "bg-amber-50/40 hover:bg-amber-50/80",
  NOT_PLACED: "bg-red-50/60 hover:bg-red-50",
};

function Dropdown({ value, options, onChange, disabled }: {
  value?: string | null; options: Record<string, string>;
  onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 min-w-[130px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
    >
      <option value="">— select —</option>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

function CheckIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" /></svg>;
}
function ClockIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0" /></svg>;
}
function AlertIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}
function XIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0" /></svg>;
}

const PLACED_CARD = { label: "Placed", value: "PLACED", base: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700", ring: "ring-2 ring-emerald-400 ring-offset-1", Icon: CheckIcon };
const PENDING_CARD = { label: "Pending", value: "PENDING", base: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700", ring: "ring-2 ring-amber-400 ring-offset-1", Icon: ClockIcon };
const NOT_PLACED_CARD = { label: "Not Placed", value: "NOT_PLACED", base: "border-red-200 bg-gradient-to-br from-red-50 to-white text-red-700", ring: "ring-2 ring-red-400 ring-offset-1", Icon: XIcon };

function formatLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  return new Date(Date.now() + 86400000).toISOString().split("T")[0];
}

function rangeFrom(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
}

export default function PlacementTable({
  userRole,
  activeIssuesCount,
  initialPlacements,
}: {
  userRole: Role;
  activeIssuesCount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialPlacements?: any[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [placements, setPlacements] = useState<Placement[]>(initialPlacements ?? []);
  const [loading, setLoading] = useState(!(initialPlacements?.length));
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapVehicles, setSwapVehicles] = useState<VehicleOption[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlacements = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const days = viewMode === "week" ? 6 : 29;
    const url = `/api/placements?from=${rangeFrom(days)}&to=${tomorrowStr()}`;

    const res = await fetch(url);
    if (!res.ok) { setLoading(false); return; }
    const data: Placement[] = await res.json();

    if (data.length === 0) {
      if (!silent) {
        const latestRes = await fetch("/api/placements/latest-date");
        if (latestRes.ok) {
          const { date } = await latestRes.json();
          if (date) {
            const fallbackRes = await fetch(`/api/placements?date=${date}`);
            if (fallbackRes.ok) {
              const fallbackData: Placement[] = await fallbackRes.json();
              if (fallbackData.length > 0) {
                setPlacements(fallbackData);
                setFallbackNotice(date);
                setLoading(false);
                return;
              }
            }
          }
        }
        setFallbackNotice(null);
        setPlacements([]);
      }
      // silent + empty: keep existing placements, don't wipe what's showing
    } else {
      setFallbackNotice(null);
      setPlacements(data);
    }
    setLoading(false);
  }, [viewMode]);

  useEffect(() => {
    // Always fetch on mount and viewMode change.
    // Silent if we already have data (no spinner flash); non-silent (shows spinner) if starting empty.
    fetchPlacements(placements.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlacements]);

  useEffect(() => {
    const t = setInterval(() => fetchPlacements(true), 30000);
    return () => clearInterval(t);
  }, [fetchPlacements]);

  async function update(id: string, section: string, field: string, value: string) {
    const prevPlacement = placements.find((p) => p.id === id);
    setPlacements((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      if (section === "d1") return { ...p, d1Remark: { ...p.d1Remark, [field]: value || null } };
      if (section === "sameDay") return { ...p, sameDayRemark: { ...p.sameDayRemark, [field]: value || null } };
      if (section === "placementTeam") return { ...p, placementTeamRemark: { ...p.placementTeamRemark, [field]: value || null } };
      if (section === "finalStatus") return { ...p, finalStatus: value };
      return p;
    }));
    const res = await fetch(`/api/placements/${id}/remarks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, data: { [field]: value || null } }),
    });
    if (!res.ok && prevPlacement) {
      setPlacements((cur) => cur.map((p) => (p.id === id ? prevPlacement : p)));
    }
  }

  async function setStatus(id: string, value: string) {
    const placement = placements.find((p) => p.id === id);
    if (!placement) return;
    const hasOpen = placement.issueAlerts.some((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");
    if (value === "PLACED" && hasOpen) {
      setStatusError(id);
      setTimeout(() => setStatusError((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, finalStatus: value } : p)));
    const res = await fetch(`/api/placements/${id}/remarks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "finalStatus", data: { finalStatus: value } }),
    });
    if (!res.ok) {
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, finalStatus: placement.finalStatus } : p)));
      setStatusError(id);
      setTimeout(() => setStatusError((cur) => (cur === id ? null : cur)), 3000);
    }
  }

  async function startVehicleSwap(p: Placement) {
    const res = await fetch("/api/vehicles");
    if (!res.ok) return;
    const all: VehicleOption[] = await res.json();
    setSwapVehicles(all.filter((v) => v.id !== p.vehicle?.id));
    setSwappingId(p.id);
  }

  async function deleteTrip(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/placements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlacements((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleting(false);
    setDeleteConfirmId(null);
  }

  async function doVehicleSwap(placementId: string, vehicleId: string) {
    if (!vehicleId) return;
    setSwappingId(null);
    setPlacements((prev) => prev.map((p) => {
      if (p.id !== placementId) return p;
      const found = swapVehicles.find((v) => v.id === vehicleId);
      return { ...p, vehicle: found ? { id: found.id, vehicleNumber: found.vehicleNumber } : p.vehicle };
    }));
    await fetch(`/api/placements/${placementId}/remarks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "vehicleSwap", data: { vehicleId } }),
    });
  }

  const editPlan = canPlan(userRole);
  const editPlace = canPlace(userRole);
  const isAdmin = userRole === "ADMIN";

  const uniqueRoutes = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of placements) {
      if (!seen.has(p.route.name)) { seen.add(p.route.name); result.push(p.route.name); }
    }
    return result.sort();
  }, [placements]);

  const displayed = placements
    .filter((p) => !statusFilter || p.finalStatus === statusFilter)
    .filter((p) => !vehicleSearch || (p.vehicle?.vehicleNumber ?? "").toLowerCase().includes(vehicleSearch.toLowerCase()))
    .filter((p) => !routeFilter || p.route.name === routeFilter)
    .filter((p) => !dateFilter || p.date.split("T")[0] === dateFilter);

  const groups = useMemo(() => {
    const byDate: Record<string, Placement[]> = {};
    for (const p of displayed) {
      const d = p.date.split("T")[0];
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(p);
    }
    return Object.keys(byDate).sort().reverse().map((d) => ({ date: d, items: byDate[d] }));
  }, [displayed]);

  const placed = placements.filter((p) => p.finalStatus === "PLACED").length;
  const pending = placements.filter((p) => p.finalStatus === "PENDING").length;
  const notPlaced = placements.filter((p) => p.finalStatus === "NOT_PLACED").length;
  const counts: Record<string, number> = { PLACED: placed, PENDING: pending, NOT_PLACED: notPlaced };

  function toggleFilter(val: string) {
    setStatusFilter((f) => (f === val ? null : val));
  }

  function changeMode(m: ViewMode) {
    setViewMode(m);
    setStatusFilter(null);
    setDateFilter("");
    setFallbackNotice(null);
  }

  const tableCards = isAdmin ? [PLACED_CARD, PENDING_CARD] : [PLACED_CARD, PENDING_CARD, NOT_PLACED_CARD];
  const hasActiveFilters = !!(statusFilter || vehicleSearch || routeFilter || dateFilter);

  return (
    <div>
      {/* View mode + filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {([
            { mode: "week" as ViewMode, label: "Week" },
            { mode: "month" as ViewMode, label: "Month" },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => changeMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === mode ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            placeholder="Vehicle no…"
            className="border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-36"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
        </div>

        {uniqueRoutes.length > 1 && (
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="">All Routes</option>
            {uniqueRoutes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        <div className="relative">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter(null); setVehicleSearch(""); setRouteFilter(""); setDateFilter(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {fallbackNotice && (
        <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No placements in selected range — showing most recent data from{" "}
          <span className="font-semibold">{formatLocalDate(fallbackNotice)}</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {tableCards.map((card) => (
          <button
            key={card.value}
            onClick={() => toggleFilter(card.value)}
            className={`border-2 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${card.base} ${statusFilter === card.value ? card.ring : "shadow-sm"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <card.Icon />
              {statusFilter === card.value && <span className="text-[10px] font-semibold opacity-60 uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-3xl font-bold tabular-nums">{loading ? "—" : counts[card.value]}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-75">{card.label}</p>
          </button>
        ))}
        {isAdmin && (
          <a
            href="/issues"
            className="border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-700 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm block"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertIcon />
              <span className="text-[10px] font-semibold opacity-50 uppercase tracking-wide">View →</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{activeIssuesCount ?? 0}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-75">Active Issues</p>
          </a>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading placements…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-600">
            {placements.length === 0 ? "No placements found" : "No placements match the filters"}
          </p>
          {placements.length === 0 && <p className="text-sm mt-1">Ask an admin to add trips.</p>}
        </div>
      ) : (
        <>
          {/* ── Mobile card view ── */}
          <div className="md:hidden space-y-3">
            {groups.map((group) => (
              <React.Fragment key={group.date}>
                <div className="px-1 pb-2 pt-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-800">{formatLocalDate(group.date)}</span>
                  <span className="text-xs font-normal text-slate-400">{group.items.length} trip{group.items.length !== 1 ? "s" : ""}</span>
                </div>
                {group.items.map((p, i) => {
                  const hasOpen = p.issueAlerts.some((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");
                  return (
                    <div key={p.id} className={`rounded-2xl border-2 shadow-sm overflow-hidden ${
                      p.finalStatus === "PLACED" ? "border-emerald-200 bg-emerald-50/30" :
                      p.finalStatus === "NOT_PLACED" ? "border-red-200 bg-red-50/30" :
                      "border-amber-200 bg-amber-50/30"
                    }`}>
                      {/* Header */}
                      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-slate-400 tabular-nums">#{i + 1}</span>
                            <span className="font-bold text-slate-900">{p.client.name}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${p.laneType === "FW" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                              {LANE_TYPE_LABELS[p.laneType] ?? p.laneType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{p.route.name} · {p.cohort}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {editPlace ? (
                            <select
                              value={p.finalStatus}
                              onChange={(e) => setStatus(p.id, e.target.value)}
                              className={`text-xs font-semibold border rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_COLOR[p.finalStatus]}`}
                            >
                              {Object.entries(FINAL_STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k} disabled={k === "PLACED" && hasOpen}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[p.finalStatus]}`}>
                              {FINAL_STATUS_LABELS[p.finalStatus]}
                            </span>
                          )}
                          {p.finalStatus === "PENDING" && <CountdownBadge placementTime={p.placementTime} />}
                          {isAdmin && p.finalStatus !== "PLACED" && (
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              title="Delete trip"
                              className="text-slate-300 hover:text-red-500 transition-colors mt-0.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Vehicle + time + drivers */}
                      <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs border-b border-black/5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Vehicle</span>
                          {swappingId === p.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                defaultValue=""
                                autoFocus
                                onChange={(e) => { if (e.target.value) doVehicleSwap(p.id, e.target.value); }}
                                className="text-xs border border-blue-300 rounded-lg px-1.5 py-1 bg-white focus:outline-none max-w-[110px]"
                              >
                                <option value="" disabled>Pick…</option>
                                {swapVehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
                              </select>
                              <button onClick={() => setSwappingId(null)} className="text-slate-400 hover:text-slate-600 px-1">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-semibold text-slate-700">{p.vehicle?.vehicleNumber ?? "—"}</span>
                              {editPlace && (
                                <button onClick={() => startVehicleSwap(p)} title="Swap" className="text-slate-300 hover:text-blue-500 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="text-slate-400">Time</span>
                          <span className="font-medium text-slate-700">{new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {(p.driverNumber1 || p.driverNumber2) && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <span className="text-slate-400">Driver</span>
                            <span className="font-mono text-slate-700">{[p.driverNumber1, p.driverNumber2].filter(Boolean).join(" · ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Remarks */}
                      <div className="px-4 py-3 space-y-2 bg-white/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide w-14 flex-shrink-0">D-1</span>
                          <Dropdown value={p.d1Remark?.driverIssue} options={DRIVER_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "d1", "driverIssue", v)} />
                          <Dropdown value={p.d1Remark?.maintenanceIssue} options={MAINTENANCE_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "d1", "maintenanceIssue", v)} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide w-14 flex-shrink-0">Same Day</span>
                          <Dropdown value={p.sameDayRemark?.driverIssue} options={DRIVER_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "sameDay", "driverIssue", v)} />
                          <Dropdown value={p.sameDayRemark?.maintenanceIssue} options={MAINTENANCE_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "sameDay", "maintenanceIssue", v)} />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide block mb-1.5">Placement Check</span>
                          <div className="flex flex-wrap gap-1.5">
                            <Dropdown value={p.placementTeamRemark?.elockStatus} options={ELOCK_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "elockStatus", v)} />
                            {p.compliance === "E_LOCK_IDFY" && (
                              <Dropdown value={p.placementTeamRemark?.idfyDrivers} options={IDFY_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "idfyDrivers", v)} />
                            )}
                            <Dropdown value={p.placementTeamRemark?.cargoNet} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "cargoNet", v)} />
                            <Dropdown value={p.placementTeamRemark?.tirpal} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "tirpal", v)} />
                            <Dropdown value={p.placementTeamRemark?.stepney} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "stepney", v)} />
                          </div>
                        </div>
                      </div>

                      {/* Issue alerts + status error */}
                      {(hasOpen || statusError === p.id) && (
                        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                          {hasOpen && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              ● {p.issueAlerts.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length} open issue{p.issueAlerts.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length > 1 ? "s" : ""}
                            </span>
                          )}
                          {statusError === p.id && (
                            <span className="text-[10px] text-red-600 font-medium">Resolve open issues first</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* ── Desktop table view ── */}
          <div className="hidden md:block space-y-5">
            {groups.map((group) => (
              <div key={group.date}>
                <div className="mb-2.5 px-1 flex items-baseline gap-2">
                  <h3 className="text-base font-semibold text-slate-800">{formatLocalDate(group.date)}</h3>
                  <span className="text-sm text-slate-400">{group.items.length} trip{group.items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 text-left border-b border-slate-200">#</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Client</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Route</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Schedule</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Lane</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Vehicle</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Driver</th>
                      <th className="px-3 py-3 text-left border-b border-slate-200">Time</th>
                      <th colSpan={2} className="px-3 py-2 text-center border-b border-l border-slate-200 bg-blue-50/60 text-blue-600">D-1 Planning</th>
                      <th colSpan={2} className="px-3 py-2 text-center border-b border-l border-slate-200 bg-indigo-50/60 text-indigo-600">Same Day</th>
                      <th colSpan={5} className="px-3 py-2 text-center border-b border-l border-slate-200 bg-emerald-50/60 text-emerald-600">Placement Check</th>
                      <th className="px-3 py-3 text-center border-b border-l border-slate-200">Status</th>
                    </tr>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th colSpan={8} className="border-b border-slate-200" />
                      <th className="px-2 py-2 border-b border-l border-slate-200 font-medium bg-blue-50/40">Driver</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-blue-50/40">Maint.</th>
                      <th className="px-2 py-2 border-b border-l border-slate-200 font-medium bg-indigo-50/40">Driver</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-indigo-50/40">Maint.</th>
                      <th className="px-2 py-2 border-b border-l border-slate-200 font-medium bg-emerald-50/40">E-Lock</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-emerald-50/40">IDFY</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-emerald-50/40">Cargo Net</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-emerald-50/40">Tirpal</th>
                      <th className="px-2 py-2 border-b border-slate-200 font-medium bg-emerald-50/40">Stepney</th>
                      <th className="border-b border-l border-slate-200" />
                    </tr>
                  </thead>
                  <tbody>
                  {group.items.map((p, i) => (
                    <tr key={p.id} className={`border-b transition-colors ${ROW_BG[p.finalStatus] ?? "hover:bg-slate-50/70"}`}>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{p.client.name}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{p.route.name}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-xs">{p.cohort}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.laneType === "FW" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                          {LANE_TYPE_LABELS[p.laneType] ?? p.laneType}
                        </span>
                      </td>
                      {/* Vehicle column with swap */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {swappingId === p.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              defaultValue=""
                              autoFocus
                              onChange={(e) => { if (e.target.value) doVehicleSwap(p.id, e.target.value); }}
                              className="text-xs border border-blue-300 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[120px]"
                            >
                              <option value="" disabled>Select…</option>
                              {swapVehicles.map((v) => (
                                <option key={v.id} value={v.id}>{v.vehicleNumber}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setSwappingId(null)}
                              className="text-slate-400 hover:text-slate-600 text-xs px-1"
                              title="Cancel"
                            >✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-500">{p.vehicle?.vehicleNumber ?? "—"}</span>
                            {editPlace && (
                              <button
                                onClick={() => startVehicleSwap(p)}
                                title="Change vehicle"
                                className="text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Driver numbers column */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {p.driverNumber1 || p.driverNumber2 ? (
                          <div className="space-y-0.5">
                            {p.driverNumber1 && <p className="text-xs text-slate-600 font-mono">{p.driverNumber1}</p>}
                            {p.driverNumber2 && <p className="text-xs text-slate-400 font-mono">{p.driverNumber2}</p>}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          {p.finalStatus === "PENDING" && <CountdownBadge placementTime={p.placementTime} />}
                        </div>
                      </td>
                      <td className="px-2 py-2 border-l border-slate-200 bg-blue-50/10">
                        <Dropdown value={p.d1Remark?.driverIssue} options={DRIVER_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "d1", "driverIssue", v)} />
                      </td>
                      <td className="px-2 py-2 bg-blue-50/10">
                        <Dropdown value={p.d1Remark?.maintenanceIssue} options={MAINTENANCE_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "d1", "maintenanceIssue", v)} />
                      </td>
                      <td className="px-2 py-2 border-l border-slate-200 bg-indigo-50/10">
                        <Dropdown value={p.sameDayRemark?.driverIssue} options={DRIVER_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "sameDay", "driverIssue", v)} />
                      </td>
                      <td className="px-2 py-2 bg-indigo-50/10">
                        <Dropdown value={p.sameDayRemark?.maintenanceIssue} options={MAINTENANCE_ISSUE_LABELS} disabled={!editPlan} onChange={(v) => update(p.id, "sameDay", "maintenanceIssue", v)} />
                      </td>
                      <td className="px-2 py-2 border-l border-slate-200 bg-emerald-50/10">
                        <Dropdown value={p.placementTeamRemark?.elockStatus} options={ELOCK_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "elockStatus", v)} />
                      </td>
                      <td className="px-2 py-2 bg-emerald-50/10">
                        {p.compliance === "E_LOCK_IDFY" ? (
                          <Dropdown value={p.placementTeamRemark?.idfyDrivers} options={IDFY_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "idfyDrivers", v)} />
                        ) : (
                          <span className="text-xs text-slate-300 px-1">N/A</span>
                        )}
                      </td>
                      <td className="px-2 py-2 bg-emerald-50/10">
                        <Dropdown value={p.placementTeamRemark?.cargoNet} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "cargoNet", v)} />
                      </td>
                      <td className="px-2 py-2 bg-emerald-50/10">
                        <Dropdown value={p.placementTeamRemark?.tirpal} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "tirpal", v)} />
                      </td>
                      <td className="px-2 py-2 bg-emerald-50/10">
                        <Dropdown value={p.placementTeamRemark?.stepney} options={EQUIPMENT_STATUS_LABELS} disabled={!editPlace} onChange={(v) => update(p.id, "placementTeam", "stepney", v)} />
                      </td>
                      <td className="px-2 py-2 border-l border-slate-200">
                        {(() => {
                          const hasOpen = p.issueAlerts.some((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");
                          const allResolved = p.issueAlerts.length > 0 && !hasOpen;
                          return (
                            <div className="flex flex-col items-start gap-1 min-w-[90px]">
                              {hasOpen && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                  ● {p.issueAlerts.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length} open issue{p.issueAlerts.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length > 1 ? "s" : ""}
                                </span>
                              )}
                              {allResolved && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                  ✓ Ready to Place
                                </span>
                              )}
                              {editPlace ? (
                                <select
                                  value={p.finalStatus}
                                  onChange={(e) => setStatus(p.id, e.target.value)}
                                  className={`text-xs font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_COLOR[p.finalStatus]}`}
                                >
                                  {Object.entries(FINAL_STATUS_LABELS).map(([k, v]) => (
                                    <option key={k} value={k} disabled={k === "PLACED" && hasOpen}>{v}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[p.finalStatus]}`}>
                                  {FINAL_STATUS_LABELS[p.finalStatus]}
                                </span>
                              )}
                              {statusError === p.id && (
                                <span className="text-[10px] text-red-600 font-medium leading-tight">Resolve open issues first</span>
                              )}
                              {isAdmin && p.finalStatus !== "PLACED" && (
                                <button
                                  onClick={() => setDeleteConfirmId(p.id)}
                                  title="Delete trip"
                                  className="text-slate-300 hover:text-red-500 transition-colors mt-0.5"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (() => {
        const trip = placements.find((p) => p.id === deleteConfirmId);
        if (!trip) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Delete Trip?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 mb-5 space-y-1">
                <p className="text-sm font-semibold text-slate-800">{trip.client.name}</p>
                <p className="text-xs text-slate-500">{trip.route.name}</p>
                <p className="text-xs text-slate-400">{trip.vehicle?.vehicleNumber ?? "No vehicle"} · {new Date(trip.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={() => deleteTrip(deleteConfirmId)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting…
                    </>
                  ) : "Delete Trip"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
