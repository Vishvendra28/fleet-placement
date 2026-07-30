"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ISSUE_CATEGORY_LABELS, ISSUE_VALUE_LABELS } from "@/lib/constants";
import { Role } from "@prisma/client";

type AlertIssue = {
  id: string;
  issueCategory: string;
  issueValue: string;
  status: string;
  eta: string | null;
  raisedAt: string;
  placement: {
    client: { name: string };
    route: { name: string };
    vehicle: { vehicleNumber: string } | null;
  };
  raisedBy: { name: string };
};

type UrgentPlacement = {
  id: string;
  cutoffTime: string;
  client: { name: string };
  route: { name: string };
  vehicle: { vehicleNumber: string } | null;
  issueAlerts: { id: string; issueCategory: string; issueValue: string }[];
};

const ROLE_TITLE: Partial<Record<Role, string>> = {
  DRIVER_MANAGEMENT: "Driver Issues Needing Attention",
  MAINTENANCE_TEAM: "Maintenance & Equipment Issues",
  STORE_AND_TYRE: "Store & Tyre Issues Needing Attention",
  PLACEMENT_TEAM: "Equipment Issues Needing Attention",
  PLANNING_TEAM: "Open Issues",
  ADMIN: "Active Issues",
};

const CAT_COLOR: Record<string, string> = {
  DRIVER: "bg-orange-100 text-orange-700 border-orange-200",
  MAINTENANCE: "bg-pink-100 text-pink-700 border-pink-200",
  EQUIPMENT: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function DashboardAlerts({ userRole }: { userRole: Role }) {
  const [issues, setIssues] = useState<AlertIssue[]>([]);
  const [urgentPlacements, setUrgentPlacements] = useState<UrgentPlacement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const res = await fetch("/api/dashboard/alerts");
    if (res.ok) {
      const data = await res.json();
      setIssues(data.issues ?? []);
      setUrgentPlacements(data.urgentPlacements ?? []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 30000);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  if (!loaded || userRole === "KAM") return null;
  if (issues.length === 0 && urgentPlacements.length === 0) return null;

  const title = ROLE_TITLE[userRole] ?? "Open Issues";

  return (
    <div className="space-y-3">
      {/* URGENT: cutoff passed + unresolved — Admin only */}
      {urgentPlacements.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
              URGENT — Cutoff Passed, Issues Unresolved
            </h3>
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {urgentPlacements.length}
            </span>
          </div>
          <div className="space-y-2">
            {urgentPlacements.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-red-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{p.client.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.route.name} · {p.vehicle?.vehicleNumber ?? "No vehicle"}
                    {" · Cutoff: "}{new Date(p.cutoffTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {p.issueAlerts.slice(0, 3).map((iss) => (
                    <span key={iss.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CAT_COLOR[iss.issueCategory] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {ISSUE_VALUE_LABELS[iss.issueValue] ?? iss.issueValue}
                    </span>
                  ))}
                  {p.issueAlerts.length > 3 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      +{p.issueAlerts.length - 3} more
                    </span>
                  )}
                </div>
                <Link href="/issues" className="text-xs font-bold text-red-600 hover:text-red-800 underline whitespace-nowrap">
                  Resolve →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular open issues — count badge + expandable list */}
      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-amber-100/50 transition-colors"
          >
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-sm font-bold text-amber-800">{title}</h3>
            <span className="bg-amber-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {issues.length}
            </span>
            <span className="ml-auto text-amber-500 text-xs font-semibold">
              {expanded ? "Hide ▲" : "Show ▼"}
            </span>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-1.5 max-h-64 overflow-y-auto">
              {issues.map((issue) => (
                <div key={issue.id} className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${CAT_COLOR[issue.issueCategory] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {ISSUE_CATEGORY_LABELS[issue.issueCategory]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {ISSUE_VALUE_LABELS[issue.issueValue] ?? issue.issueValue}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {issue.placement.client.name} · {issue.placement.route.name}
                      {issue.placement.vehicle && ` · ${issue.placement.vehicle.vehicleNumber}`}
                    </p>
                  </div>
                  {issue.eta && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      ETA {new Date(issue.eta).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <p className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                    {new Date(issue.raisedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </p>
                  <Link href="/issues" className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline whitespace-nowrap flex-shrink-0">
                    View →
                  </Link>
                </div>
              ))}
              <div className="pt-1 text-center">
                <Link href="/issues" className="text-xs font-semibold text-amber-700 hover:underline">
                  View all issues →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
