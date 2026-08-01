"use client";
import { useState, useEffect, useCallback, Fragment } from "react";

type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

type Issue = {
  id: string;
  issueValue: string;
  issueCategory: string;
  status: IssueStatus;
  raisedAt: string;
  resolutionNote: string | null;
  placement: {
    date: string;
    cohort: string;
    laneType: string;
    placementTime: string;
    driverNumber1: string | null;
    client: { name: string };
    route: { name: string };
    vehicle: { vehicleNumber: string } | null;
  };
};

type ProgressForm = { type: "progress"; etaDate: string; etaTime: string; comment: string };
type ResolveForm  = { type: "resolve"; comment: string };
type ActiveForm   = ProgressForm | ResolveForm;

type Section = { label: string; issueValue: string };

const ROLE_SECTIONS: Record<string, Section[]> = {
  DRIVER_MANAGEMENT: [
    { label: "Single Driver",        issueValue: "SINGLE_DRIVER" },
    { label: "Denying for Load",     issueValue: "DENYING_FOR_LOAD" },
    { label: "Driver Not Available", issueValue: "DRIVER_NOT_AVAILABLE" },
  ],
  MAINTENANCE_TEAM: [
    { label: "Kamani Work",              issueValue: "KAMANI_WORK" },
    { label: "Battery Work",             issueValue: "BATTERY_WORK" },
    { label: "Tyre & Alignment",         issueValue: "TYRE_AND_ALIGNMENT" },
    { label: "Electrical & Mechanical",  issueValue: "ELECTRICAL_AND_MECHANICAL" },
    { label: "Mileage Issue",            issueValue: "MILEAGE_ISSUE" },
    { label: "Various Issues",           issueValue: "VARIOUS_ISSUES" },
  ],
  STORE_AND_TYRE: [
    { label: "Cargo Net Missing",   issueValue: "CARGO_NET" },
    { label: "Tirpal Missing",      issueValue: "TIRPAL" },
    { label: "Stepney Missing",     issueValue: "STEPNEY" },
    { label: "IDFY Not Available",  issueValue: "IDFY_NOT_AVAILABLE" },
  ],
  E_LOCK_TEAM: [
    { label: "E-Lock Unhealthy", issueValue: "UNHEALTHY" },
    { label: "E-Lock Damaged",   issueValue: "LOCK_DAMAGE" },
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

const inputCls = "text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

export default function IssueDashboard({ userRole }: { userRole: string }) {
  const [date, setDate] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [activeForms, setActiveForms] = useState<Record<string, ActiveForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const sections = ROLE_SECTIONS[userRole] ?? [];

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    const url = date ? `/api/issues?date=${date}` : "/api/issues";
    const res = await fetch(url);
    if (res.ok) setIssues(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openProgressForm(id: string) {
    const today = new Date().toISOString().split("T")[0];
    setActiveForms(p => ({ ...p, [id]: { type: "progress", etaDate: today, etaTime: "", comment: "" } }));
    setFormErrors(p => { const n = { ...p }; delete n[id]; return n; });
  }
  function openResolveForm(id: string) {
    setActiveForms(p => ({ ...p, [id]: { type: "resolve", comment: "" } }));
    setFormErrors(p => { const n = { ...p }; delete n[id]; return n; });
  }
  function cancelForm(id: string) {
    setActiveForms(p => { const n = { ...p }; delete n[id]; return n; });
    setFormErrors(p => { const n = { ...p }; delete n[id]; return n; });
  }
  function patchForm(id: string, updates: Partial<ProgressForm> | Partial<ResolveForm>) {
    setActiveForms(p => ({ ...p, [id]: { ...p[id], ...updates } as ActiveForm }));
  }

  // ── Submit handlers ───────────────────────────────────────────────────────
  async function submitProgress(id: string) {
    const form = activeForms[id] as ProgressForm;
    if (!form.comment.trim()) {
      setFormErrors(p => ({ ...p, [id]: "Comment is required." }));
      return;
    }
    const etaIso = form.etaDate
      ? new Date(`${form.etaDate}T${form.etaTime || "00:00"}`).toISOString()
      : null;

    setSaving(p => ({ ...p, [id]: true }));
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: "IN_PROGRESS" as IssueStatus } : i));
    cancelForm(id);

    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS", resolutionNote: form.comment.trim(), eta: etaIso }),
    });
    setSaving(p => ({ ...p, [id]: false }));
  }

  async function submitResolve(id: string) {
    const form = activeForms[id] as ResolveForm;
    if (!form.comment.trim()) {
      setFormErrors(p => ({ ...p, [id]: "Comment is required." }));
      return;
    }
    setSaving(p => ({ ...p, [id]: true }));
    setIssues(prev => prev.map(i =>
      i.id === id ? { ...i, status: "RESOLVED" as IssueStatus, resolutionNote: form.comment.trim() } : i
    ));
    cancelForm(id);

    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED", resolutionNote: form.comment.trim() }),
    });
    setSaving(p => ({ ...p, [id]: false }));
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const sortedIssues = [...issues].sort(
    (a, b) => new Date(a.placement.date).getTime() - new Date(b.placement.date).getTime()
  );

  const allVehicles = [...new Set(
    issues.map(i => i.placement.vehicle?.vehicleNumber).filter(Boolean) as string[]
  )].sort();
  const allRoutes = [...new Set(issues.map(i => i.placement.route.name))].sort();

  const displayed = sortedIssues.filter(i => {
    if (vehicleFilter && i.placement.vehicle?.vehicleNumber !== vehicleFilter) return false;
    if (routeFilter && i.placement.route.name !== routeFilter) return false;
    return true;
  });

  const openCount       = displayed.filter(i => i.status === "OPEN").length;
  const inProgressCount = displayed.filter(i => i.status === "IN_PROGRESS").length;
  const resolvedCount   = displayed.filter(i => i.status === "RESOLVED").length;

  const hasAnyFiltered = (iv: string) =>
    displayed.some(i => i.issueValue === iv && (
      statusFilter ? i.status === statusFilter : (i.status === "OPEN" || i.status === "IN_PROGRESS")
    ));

  const STAT_CARDS = [
    { value: "OPEN" as IssueStatus,        label: "Open",        count: openCount,        base: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700",   ring: "ring-2 ring-amber-400 ring-offset-1",   Icon: AlertIcon },
    { value: "IN_PROGRESS" as IssueStatus, label: "In Progress", count: inProgressCount,  base: "border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-700",      ring: "ring-2 ring-blue-400 ring-offset-1",    Icon: ClockIcon },
    { value: "RESOLVED" as IssueStatus,    label: "Resolved",    count: resolvedCount,     base: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700", ring: "ring-2 ring-emerald-400 ring-offset-1", Icon: CheckIcon },
  ];

  const anyFilterActive = !!(date || vehicleFilter || routeFilter || statusFilter);

  return (
    <div>
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Date — optional */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
          <input
            type="date" value={date}
            onChange={(e) => { setDate(e.target.value); setStatusFilter(null); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
          />
          {date && (
            <button onClick={() => setDate("")} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Vehicle filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehicle</label>
          <select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[140px]"
          >
            <option value="">All vehicles</option>
            {allVehicles.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Route filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Route</label>
          <select
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[140px]"
          >
            <option value="">All routes</option>
            {allRoutes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {anyFilterActive && (
          <button
            onClick={() => { setDate(""); setVehicleFilter(""); setRouteFilter(""); setStatusFilter(null); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {STAT_CARDS.map((card) => (
          <button
            key={card.value}
            onClick={() => setStatusFilter(f => f === card.value ? null : card.value)}
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading issues…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...sections].sort((a, b) => {
            const priority = (iv: string) => {
              if (displayed.some(i => i.issueValue === iv && i.status === "OPEN")) return 0;
              if (displayed.some(i => i.issueValue === iv && i.status === "IN_PROGRESS")) return 1;
              return 2;
            };
            return priority(a.issueValue) - priority(b.issueValue);
          }).map((section) => {
            const sectionIssues = displayed.filter(
              i => i.issueValue === section.issueValue && (!statusFilter || i.status === statusFilter)
            );
            if (!hasAnyFiltered(section.issueValue) && !statusFilter) return null;

            return (
              <div key={section.issueValue} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900">{section.label}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {sectionIssues.length} trip{sectionIssues.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {sectionIssues.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400 text-center">No issues match the current filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                          <th className="px-3 py-3 text-left">#</th>
                          <th className="px-3 py-3 text-left">Date</th>
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
                          const form = activeForms[issue.id];
                          const formErr = formErrors[issue.id];

                          return (
                            <Fragment key={issue.id}>
                              {/* ── Data row ── */}
                              <tr className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                                <td className="px-3 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                  {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </td>
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
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {issue.status === "OPEN" && !form && (
                                    <button
                                      disabled={isSaving}
                                      onClick={() => openProgressForm(issue.id)}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors disabled:opacity-50"
                                    >
                                      Mark In Progress
                                    </button>
                                  )}
                                  {issue.status === "OPEN" && form && (
                                    <span className="text-xs text-amber-600 font-medium">Filling details…</span>
                                  )}
                                  {issue.status === "IN_PROGRESS" && !form && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">In Progress</span>
                                      <button
                                        disabled={isSaving}
                                        onClick={() => openResolveForm(issue.id)}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  )}
                                  {issue.status === "IN_PROGRESS" && form && (
                                    <span className="text-xs text-emerald-600 font-medium">Filling details…</span>
                                  )}
                                  {issue.status === "RESOLVED" && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Resolved</span>
                                      {issue.resolutionNote && (
                                        <span className="text-xs text-slate-400 truncate max-w-[140px]" title={issue.resolutionNote}>
                                          {issue.resolutionNote}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>

                              {/* ── Inline form row ── */}
                              {form && (
                                <tr className="border-b border-blue-100 bg-blue-50/40">
                                  <td colSpan={10} className="px-4 py-3">
                                    {form.type === "progress" && (
                                      <div className="flex flex-wrap items-end gap-3">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">ETA Date</label>
                                          <input
                                            type="date"
                                            value={form.etaDate}
                                            onChange={e => patchForm(issue.id, { etaDate: e.target.value })}
                                            className={inputCls}
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">ETA Time</label>
                                          <input
                                            type="time"
                                            value={form.etaTime}
                                            onChange={e => patchForm(issue.id, { etaTime: e.target.value })}
                                            className={inputCls}
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                            Comment <span className="text-red-500">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Required — describe the situation"
                                            value={form.comment}
                                            onChange={e => { patchForm(issue.id, { comment: e.target.value }); setFormErrors(p => { const n = { ...p }; delete n[issue.id]; return n; }); }}
                                            className={`${inputCls} w-full ${formErr ? "border-red-400 ring-1 ring-red-300" : ""}`}
                                          />
                                          {formErr && <p className="text-[10px] text-red-500">{formErr}</p>}
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            disabled={isSaving}
                                            onClick={() => submitProgress(issue.id)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                                          >
                                            Confirm In Progress
                                          </button>
                                          <button
                                            onClick={() => cancelForm(issue.id)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {form.type === "resolve" && (
                                      <div className="flex flex-wrap items-end gap-3">
                                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                            Comment <span className="text-red-500">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Required — describe how it was resolved"
                                            value={form.comment}
                                            onChange={e => { patchForm(issue.id, { comment: e.target.value }); setFormErrors(p => { const n = { ...p }; delete n[issue.id]; return n; }); }}
                                            className={`${inputCls} w-full ${formErr ? "border-red-400 ring-1 ring-red-300" : ""}`}
                                          />
                                          {formErr && <p className="text-[10px] text-red-500">{formErr}</p>}
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            disabled={isSaving}
                                            onClick={() => submitResolve(issue.id)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                          >
                                            Confirm Resolve
                                          </button>
                                          <button
                                            onClick={() => cancelForm(issue.id)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {sections.every(s => !hasAnyFiltered(s.issueValue)) && (
            <div className="text-center py-24 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
                </svg>
              </div>
              <p className="text-base font-semibold text-slate-600">
                {issues.length === 0 ? "No issues found" : "No issues match the current filters"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
