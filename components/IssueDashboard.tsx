"use client";
import { useState, useEffect, useCallback } from "react";

type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

type Issue = {
  id: string;
  issueValue: string;
  issueCategory: string;
  status: IssueStatus;
  raisedAt: string;
  resolutionNote: string | null;
  placement: {
    cohort: string;
    laneType: string;
    placementTime: string;
    driverNumber1: string | null;
    client: { name: string };
    route: { name: string };
    vehicle: { vehicleNumber: string } | null;
  };
};

type Section = { label: string; issueValue: string };

const ROLE_SECTIONS: Record<string, Section[]> = {
  DRIVER_MANAGEMENT: [
    { label: "Single Driver", issueValue: "SINGLE_DRIVER" },
    { label: "Denying for Load", issueValue: "DENYING_FOR_LOAD" },
    { label: "Driver Not Available", issueValue: "DRIVER_NOT_AVAILABLE" },
  ],
  MAINTENANCE_TEAM: [
    { label: "Kamani Work", issueValue: "KAMANI_WORK" },
    { label: "Battery Work", issueValue: "BATTERY_WORK" },
    { label: "Tyre & Alignment", issueValue: "TYRE_AND_ALIGNMENT" },
    { label: "Electrical & Mechanical", issueValue: "ELECTRICAL_AND_MECHANICAL" },
    { label: "Mileage Issue", issueValue: "MILEAGE_ISSUE" },
    { label: "Various Issues", issueValue: "VARIOUS_ISSUES" },
  ],
  STORE_AND_TYRE: [
    { label: "Cargo Net Missing", issueValue: "CARGO_NET" },
    { label: "Tirpal Missing", issueValue: "TIRPAL" },
    { label: "Stepney Missing", issueValue: "STEPNEY" },
    { label: "IDFY Not Available", issueValue: "IDFY_NOT_AVAILABLE" },
  ],
  E_LOCK_TEAM: [
    { label: "E-Lock Unhealthy", issueValue: "UNHEALTHY" },
    { label: "E-Lock Damaged", issueValue: "LOCK_DAMAGE" },
  ],
};

function CheckIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" /></svg>;
}
function ClockIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0" /></svg>;
}
function AlertIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}

export default function IssueDashboard({ userRole, initialDate }: { userRole: string; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const sections = ROLE_SECTIONS[userRole] ?? [];

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/issues?date=${date}`);
    if (res.ok) setIssues(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  async function updateStatus(id: string, status: IssueStatus) {
    setSaving((p) => ({ ...p, [id]: true }));
    const note = notes[id] ?? "";

    // Optimistic update
    setIssues((prev) =>
      prev.map((iss) =>
        iss.id === id ? { ...iss, status, resolutionNote: note || null } : iss
      )
    );

    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note || null }),
    });

    setSaving((p) => ({ ...p, [id]: false }));
    if (status === "RESOLVED") setNotes((p) => { const n = { ...p }; delete n[id]; return n; });
  }

  const openCount = issues.filter((i) => i.status === "OPEN").length;
  const inProgressCount = issues.filter((i) => i.status === "IN_PROGRESS").length;
  const resolvedCount = issues.filter((i) => i.status === "RESOLVED").length;

  function toggleFilter(val: IssueStatus) {
    setStatusFilter((f) => (f === val ? null : val));
  }

  const STAT_CARDS = [
    {
      value: "OPEN" as IssueStatus,
      label: "Open",
      count: openCount,
      base: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700",
      ring: "ring-2 ring-amber-400 ring-offset-1",
      Icon: AlertIcon,
    },
    {
      value: "IN_PROGRESS" as IssueStatus,
      label: "In Progress",
      count: inProgressCount,
      base: "border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-700",
      ring: "ring-2 ring-blue-400 ring-offset-1",
      Icon: ClockIcon,
    },
    {
      value: "RESOLVED" as IssueStatus,
      label: "Resolved",
      count: resolvedCount,
      base: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700",
      ring: "ring-2 ring-emerald-400 ring-offset-1",
      Icon: CheckIcon,
    },
  ];

  return (
    <div>
      {/* Date picker */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-600">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setStatusFilter(null); }}
          className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
        />
        {statusFilter && (
          <button onClick={() => setStatusFilter(null)} className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">
            Clear filter
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {STAT_CARDS.map((card) => (
          <button
            key={card.value}
            onClick={() => toggleFilter(card.value)}
            className={`border-2 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${card.base} ${statusFilter === card.value ? card.ring : "shadow-sm"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <card.Icon />
              {statusFilter === card.value && <span className="text-[10px] font-semibold opacity-60 uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-3xl font-bold tabular-nums">{loading ? "—" : card.count}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-75">{card.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading issues…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionIssues = issues.filter(
              (i) => i.issueValue === section.issueValue && (!statusFilter || i.status === statusFilter)
            );

            if (sectionIssues.length === 0 && !statusFilter) return null;

            return (
              <div key={section.issueValue} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900">{section.label}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {sectionIssues.length} trip{sectionIssues.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {sectionIssues.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400 text-center">No issues {statusFilter ? `with "${statusFilter.toLowerCase().replace("_", " ")}" status` : ""} for this date.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                          <th className="px-3 py-3 text-left">#</th>
                          <th className="px-3 py-3 text-left">Client</th>
                          <th className="px-3 py-3 text-left">Route</th>
                          <th className="px-3 py-3 text-left">Schedule</th>
                          <th className="px-3 py-3 text-left">Lane</th>
                          <th className="px-3 py-3 text-left">Vehicle</th>
                          <th className="px-3 py-3 text-left">Driver</th>
                          <th className="px-3 py-3 text-left">Time</th>
                          <th className="px-3 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionIssues.map((issue, idx) => {
                          const p = issue.placement;
                          const isSaving = saving[issue.id];

                          return (
                            <tr key={issue.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                              <td className="px-3 py-3 text-slate-400 text-xs">{idx + 1}</td>
                              <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">{p.client.name}</td>
                              <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.route.name}</td>
                              <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{p.cohort}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.laneType === "FW" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                                  {p.laneType}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                                {p.vehicle?.vehicleNumber ?? <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                {p.driverNumber1 ?? <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                {new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-3 py-3">
                                {issue.status === "OPEN" && (
                                  <button
                                    disabled={isSaving}
                                    onClick={() => updateStatus(issue.id, "IN_PROGRESS")}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                                  >
                                    Mark In Progress
                                  </button>
                                )}

                                {issue.status === "IN_PROGRESS" && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      type="text"
                                      placeholder="Resolution note…"
                                      value={notes[issue.id] ?? ""}
                                      onChange={(e) => setNotes((p) => ({ ...p, [issue.id]: e.target.value }))}
                                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                    />
                                    <button
                                      disabled={isSaving}
                                      onClick={() => updateStatus(issue.id, "RESOLVED")}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                                    >
                                      Resolve
                                    </button>
                                  </div>
                                )}

                                {issue.status === "RESOLVED" && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                      Resolved
                                    </span>
                                    {issue.resolutionNote && (
                                      <span className="text-xs text-slate-400 truncate max-w-[120px]" title={issue.resolutionNote}>
                                        {issue.resolutionNote}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {sections.every((s) => issues.filter((i) => i.issueValue === s.issueValue && (!statusFilter || i.status === statusFilter)).length === 0) && (
            <div className="text-center py-24 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
                </svg>
              </div>
              <p className="text-base font-semibold text-slate-600">
                {issues.length === 0 ? "No issues for this date" : "No issues match this filter"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
