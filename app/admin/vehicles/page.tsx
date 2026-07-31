"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import BackButton from "@/components/BackButton";
import { ISSUE_VALUE_LABELS, ISSUE_STATUS_LABELS } from "@/lib/constants";

type IssueAlert = {
  id: string; issueCategory: string; issueValue: string; status: string;
  raisedAt: string; raisedBy: { name: string }; resolvedBy: { name: string } | null;
  resolutionNote: string | null; clientName: string; placementDate: string;
};

type ExcelStatus = {
  sheet: string;
  sheetLabel: string;
  location: string;
  remarks: string;
  eta: string | null;
  inactiveDays: number;
  client: string;
  route: string;
  amc: string;
  syncedAt: string;
};

type Vehicle = {
  id: string; vehicleNumber: string; type: string | null; isActive: boolean;
  inactiveReason: string | null; inactiveComment: string | null;
  excelStatus: ExcelStatus | null;
  utilization: { placedDays: number; totalDays: number };
  monthlyIssueCounts: { driver: number; maintenance: number };
  placements: {
    date: string; client: { name: string };
    issueAlerts: (Omit<IssueAlert, "clientName" | "placementDate"> & {
      raisedBy: { name: string }; resolvedBy: { name: string } | null;
    })[];
  }[];
};

type VehicleRow = { vehicle: Vehicle; issues: IssueAlert[]; openCount: number };

type SyncResult = {
  syncedAt: string;
  matched: number;
  markedInactive: number;
  unmatched: { vehicleNumber: string; sheet: string; location: string; remarks: string }[];
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};

const EXCEL_SHEET_STYLE: Record<string, string> = {
  MINOR_MAINTENANCE: "bg-amber-50 border-amber-200 text-amber-800",
  WITHOUT_DRIVER:    "bg-blue-50 border-blue-200 text-blue-800",
  MAJOR_MAINTENANCE: "bg-red-50 border-red-200 text-red-800",
  ACCIDENT:          "bg-red-50 border-red-200 text-red-800",
  DOCUMENTS:         "bg-purple-50 border-purple-200 text-purple-800",
};

const STAT_CARDS = [
  { label: "Active", value: "active", base: "border-green-200 bg-green-50 text-green-700", ring: "ring-2 ring-green-500 ring-offset-1" },
  { label: "Inactive", value: "inactive", base: "border-gray-200 bg-gray-50 text-gray-600", ring: "ring-2 ring-gray-400 ring-offset-1" },
  { label: "Have Issues", value: "issues", base: "border-red-200 bg-red-50 text-red-700", ring: "ring-2 ring-red-500 ring-offset-1" },
  { label: "Excel Alerts", value: "excel", base: "border-amber-200 bg-amber-50 text-amber-700", ring: "ring-2 ring-amber-500 ring-offset-1" },
];

const INACTIVE_REASONS = [
  { value: "MAJOR_MAINTENANCE", label: "Major Maintenance" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "WITHOUT_DRIVER", label: "Without Driver" },
  { value: "DOCUMENT_ISSUES", label: "Document Issues" },
  { value: "IMPOUND", label: "Impound" },
  { value: "OTHERS", label: "Others" },
];

const INACTIVE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  INACTIVE_REASONS.map((r) => [r.value, r.label])
);

export default function VehiclesAdminPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Inactive reason modal state
  const [inactiveModal, setInactiveModal] = useState<string | null>(null);
  const [inactiveReason, setInactiveReason] = useState("");
  const [inactiveComment, setInactiveComment] = useState("");

  // Excel sync state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/vehicles?withIssues=true");
    if (res.ok) {
      const vehicles: Vehicle[] = await res.json();
      const data: VehicleRow[] = vehicles.map((v) => {
        const issues: IssueAlert[] = v.placements.flatMap((p) =>
          p.issueAlerts.map((a) => ({
            ...a,
            clientName: p.client.name,
            placementDate: p.date,
          }))
        );
        const openCount = issues.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length;
        return { vehicle: v, issues, openCount };
      });
      setRows(data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openInactiveModal(id: string) {
    setInactiveReason("");
    setInactiveComment("");
    setInactiveModal(id);
  }

  async function confirmInactive() {
    if (!inactiveModal) return;
    setToggling(inactiveModal);
    setInactiveModal(null);
    await fetch(`/api/admin/vehicles/${inactiveModal}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toggleActive: true,
        inactiveReason,
        inactiveComment: inactiveReason === "OTHERS" ? inactiveComment : null,
      }),
    });
    setInactiveReason("");
    setInactiveComment("");
    await load();
    setToggling(null);
  }

  async function reactivate(id: string) {
    setToggling(id);
    await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleActive: true }),
    });
    await load();
    setToggling(null);
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/vehicles/sync-excel", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSyncError(d.error || "Sync failed. Please try again.");
      } else {
        const result = await res.json();
        setSyncResult(result);
        await load();
      }
    } catch {
      setSyncError("Network error. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  const activeCount = rows.filter(r => r.vehicle.isActive).length;
  const inactiveCount = rows.filter(r => !r.vehicle.isActive).length;
  const issueCount = rows.filter(r => r.openCount > 0).length;
  const excelAlertCount = rows.filter(r => r.vehicle.excelStatus != null).length;
  const counts: Record<string, number> = { active: activeCount, inactive: inactiveCount, issues: issueCount, excel: excelAlertCount };

  const lastSyncAt = rows.reduce<string | null>((acc, r) => {
    const s = r.vehicle.excelStatus?.syncedAt;
    if (!s) return acc;
    if (!acc || s > acc) return s;
    return acc;
  }, null);

  const filtered = useMemo(() => {
    let result = rows;
    if (cardFilter === "active") result = result.filter(r => r.vehicle.isActive);
    else if (cardFilter === "inactive") result = result.filter(r => !r.vehicle.isActive);
    else if (cardFilter === "issues") result = result.filter(r => r.openCount > 0);
    else if (cardFilter === "excel") result = result.filter(r => r.vehicle.excelStatus != null);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        r.vehicle.vehicleNumber.toLowerCase().includes(q) ||
        (r.vehicle.type ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, cardFilter, search]);

  const canConfirmInactive = inactiveReason && (inactiveReason !== "OTHERS" || inactiveComment.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicle Health</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage vehicles, toggle active status, view issue history
              {lastSyncAt && (
                <span className="ml-2 text-amber-600">
                  · Excel synced {new Date(lastSyncAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border-2 border-amber-300 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <>
                <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Sync from Excel
              </>
            )}
          </button>
          {syncError && (
            <p className="text-xs text-red-600 mt-1 text-right">{syncError}</p>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => (
            <button
              key={card.value}
              onClick={() => setCardFilter(f => f === card.value ? null : card.value)}
              className={`border-2 rounded-xl p-4 text-left transition-all hover:opacity-90 ${card.base} ${cardFilter === card.value ? card.ring : ""}`}
            >
              <p className="text-2xl font-bold">{counts[card.value]}</p>
              <p className="text-sm font-semibold">{card.label}</p>
              {cardFilter === card.value && <p className="text-xs opacity-70 mt-0.5">Click to clear</p>}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by vehicle number or type…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {(search || cardFilter) && (
          <button onClick={() => { setSearch(""); setCardFilter(null); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline">
            Clear all filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ vehicle, issues, openCount }) => (
            <div
              key={vehicle.id}
              className={`bg-white rounded-xl border-2 p-5 ${openCount > 0 ? "border-red-200" : vehicle.isActive ? "border-gray-200" : "border-gray-100 opacity-80"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono font-bold text-gray-900 text-lg">{vehicle.vehicleNumber}</span>
                  {vehicle.type && <span className="text-sm text-gray-500">{vehicle.type}</span>}
                  {openCount > 0 ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                      {openCount} open issue{openCount > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">All clear</span>
                  )}
                  {!vehicle.isActive && vehicle.inactiveReason && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {INACTIVE_REASON_LABELS[vehicle.inactiveReason] ?? vehicle.inactiveReason}
                      {vehicle.inactiveComment && ` — ${vehicle.inactiveComment}`}
                    </span>
                  )}
                  {/* Monthly issue counts */}
                  {(vehicle.monthlyIssueCounts.driver > 0 || vehicle.monthlyIssueCounts.maintenance > 0) && (
                    <div className="flex items-center gap-1.5">
                      {vehicle.monthlyIssueCounts.driver > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                          Driver {vehicle.monthlyIssueCounts.driver}/mo
                        </span>
                      )}
                      {vehicle.monthlyIssueCounts.maintenance > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                          Maint. {vehicle.monthlyIssueCounts.maintenance}/mo
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {vehicle.utilization && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="font-semibold text-gray-700">{vehicle.utilization.placedDays}</span>
                      <span>/ {vehicle.utilization.totalDays} days placed</span>
                    </div>
                  )}
                  <button
                    onClick={() => vehicle.isActive ? openInactiveModal(vehicle.id) : reactivate(vehicle.id)}
                    disabled={toggling === vehicle.id}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      vehicle.isActive
                        ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {toggling === vehicle.id ? "…" : vehicle.isActive ? "Active" : "Inactive"}
                  </button>
                  <span className="text-xs text-gray-400">{issues.length} issue{issues.length !== 1 ? "s" : ""} total</span>
                </div>
              </div>

              {/* Excel status panel */}
              {vehicle.excelStatus && (
                <div className={`mb-3 rounded-lg border px-3 py-2.5 ${EXCEL_SHEET_STYLE[vehicle.excelStatus.sheet] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold mb-1">
                    <span className="uppercase tracking-wide opacity-70">Excel</span>
                    <span>{vehicle.excelStatus.sheetLabel}</span>
                    {vehicle.excelStatus.inactiveDays > 0 && (
                      <span className="opacity-80">{vehicle.excelStatus.inactiveDays} inactive days</span>
                    )}
                    {vehicle.excelStatus.eta && (
                      <span className="opacity-80">ETA: {vehicle.excelStatus.eta}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-80">
                    {vehicle.excelStatus.location && (
                      <span>📍 {vehicle.excelStatus.location}</span>
                    )}
                    {vehicle.excelStatus.remarks && (
                      <span>💬 {vehicle.excelStatus.remarks}</span>
                    )}
                    {vehicle.excelStatus.client && (
                      <span>Client: {vehicle.excelStatus.client}</span>
                    )}
                    {vehicle.excelStatus.route && (
                      <span>Route: {vehicle.excelStatus.route}</span>
                    )}
                  </div>
                </div>
              )}

              {issues.length === 0 ? (
                <p className="text-sm text-gray-400">No maintenance issues recorded</p>
              ) : (
                <div className="space-y-2">
                  {issues.slice(0, 5).map((issue) => (
                    <div key={issue.id} className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[issue.status]}`}>
                        {ISSUE_STATUS_LABELS[issue.status]}
                      </span>
                      <span className="font-medium text-gray-800">{ISSUE_VALUE_LABELS[issue.issueValue] || issue.issueValue}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{issue.clientName}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-400 text-xs">{new Date(issue.placementDate).toLocaleDateString("en-IN")}</span>
                      {issue.resolvedBy && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span className="text-green-600 text-xs">Fixed by {issue.resolvedBy.name}</span>
                        </>
                      )}
                      {issue.resolutionNote && (
                        <span className="text-xs text-gray-400 italic">&quot;{issue.resolutionNote}&quot;</span>
                      )}
                    </div>
                  ))}
                  {issues.length > 5 && (
                    <p className="text-xs text-gray-400 pl-3">+{issues.length - 5} more issues…</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No vehicles match your filters</p>
              <p className="text-sm mt-1">Try clearing the search or filter</p>
            </div>
          )}
        </div>
      )}

      {/* Inactive reason modal */}
      {inactiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mark Vehicle Inactive</h3>
            <p className="text-sm text-gray-500 mb-5">Select a reason before marking this vehicle as inactive.</p>

            <div className="space-y-2 mb-4">
              {INACTIVE_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    inactiveReason === r.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                    inactiveReason === r.value ? "border-blue-500 bg-blue-500" : "border-gray-300"
                  }`}>
                    {inactiveReason === r.value && (
                      <div className="w-full h-full rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <input
                    type="radio"
                    name="inactiveReason"
                    value={r.value}
                    checked={inactiveReason === r.value}
                    onChange={() => { setInactiveReason(r.value); setInactiveComment(""); }}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-800">{r.label}</span>
                </label>
              ))}
            </div>

            {inactiveReason === "OTHERS" && (
              <textarea
                value={inactiveComment}
                onChange={(e) => setInactiveComment(e.target.value)}
                placeholder="Describe the reason…"
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setInactiveModal(null); setInactiveReason(""); setInactiveComment(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmInactive}
                disabled={!canConfirmInactive}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Mark Inactive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync result modal */}
      {syncResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Excel Sync Complete</h3>
                <p className="text-xs text-gray-500">
                  {new Date(syncResult.syncedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{syncResult.matched}</p>
                <p className="text-xs font-semibold text-blue-600">Vehicles Updated</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{syncResult.markedInactive}</p>
                <p className="text-xs font-semibold text-red-600">Marked Inactive</p>
              </div>
            </div>

            {syncResult.unmatched.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  {syncResult.unmatched.length} Unmatched in Excel (not in app)
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {syncResult.unmatched.map((u, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-gray-800">{u.vehicleNumber}</span>
                      <span className="text-gray-400 mx-1.5">·</span>
                      <span className="text-gray-600">{u.sheet}</span>
                      {u.location && <span className="text-gray-400 ml-1.5">📍 {u.location}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSyncResult(null)}
              className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
