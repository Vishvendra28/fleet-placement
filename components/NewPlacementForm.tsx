"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SCHEDULE_OPTIONS } from "@/lib/schedule";

type Client = { id: string; name: string };
type Route = { id: string; name: string; origin: string; destination: string };
type Vehicle = { id: string; vehicleNumber: string };

type Row = {
  clientId: string;
  routeId: string;
  newRouteName: string;
  newRouteOrigin: string;
  newRouteDestination: string;
  cohort: string;
  laneType: "FW" | "RET";
  vehicleId: string;
  driverName1: string;
  driverNumber1: string;
  driverName2: string;
  driverNumber2: string;
  placementTimeOverride: string;
  vendorName: string;
  referenceId: string;
};

const emptyRow = (): Row => ({
  clientId: "", routeId: "", newRouteName: "", newRouteOrigin: "", newRouteDestination: "",
  cohort: "", laneType: "FW", vehicleId: "",
  driverName1: "", driverNumber1: "", driverName2: "", driverNumber2: "",
  placementTimeOverride: "", vendorName: "", referenceId: "",
});

export default function NewPlacementForm({
  clients, vehicles: initialVehicles,
}: {
  clients: Client[]; vehicles: Vehicle[];
}) {
  const router = useRouter();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [date, setDate] = useState(tomorrow);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [clientRoutes, setClientRoutes] = useState<Record<number, Route[]>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vehicleSearches, setVehicleSearches] = useState<string[]>([""]);

  function setVehicleSearch(i: number, val: string) {
    setVehicleSearches(prev => { const n = [...prev]; n[i] = val; return n; });
  }

  function setField<K extends keyof Row>(i: number, field: K, value: Row[K]) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  const fetchClientRoutes = useCallback(async (i: number, clientId: string) => {
    if (!clientId) {
      setClientRoutes((prev) => ({ ...prev, [i]: [] }));
      return;
    }
    const res = await fetch(`/api/master/client-routes?clientId=${clientId}`);
    if (res.ok) {
      const routes: Route[] = await res.json();
      setClientRoutes((prev) => ({ ...prev, [i]: routes }));
    }
  }, []);

  async function addNewVehicle(i: number, vehicleNumber: string) {
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleNumber }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to add vehicle.");
      return;
    }
    const newV: Vehicle = await res.json();
    setVehicles(prev => [...prev, newV].sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)));
    setField(i, "vehicleId", newV.id);
    setVehicleSearch(i, "");
  }

  function swapRoute(i: number, currentRouteId: string, targetLane: "FW" | "RET", routes: Route[]) {
    const current = routes.find(r => r.id === currentRouteId);
    if (!current) return;
    const parts = current.name.split("-");
    if (parts.length < 2) return;
    const reversed = [...parts].reverse().join("-");
    const swapped = routes.find(r => r.name === reversed);
    if (swapped) setField(i, "routeId", swapped.id);
  }

  const lookupMaster = useCallback(async (i: number, clientId: string, routeId: string) => {
    if (!clientId || !routeId || routeId === "__new__") return;
    const res = await fetch(`/api/master/lookup?clientId=${clientId}&routeId=${routeId}`);
    if (!res.ok) return;
    const mr = await res.json();
    if (!mr) return;
    setRows((prev) => prev.map((r, idx) => idx === i
      ? { ...r, cohort: mr.cohort || r.cohort, placementTimeOverride: mr.placementTime || r.placementTimeOverride, vendorName: mr.vendor?.name || "ZAST" }
      : r
    ));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.clientId) return setError(`Trip ${i + 1}: Client is required.`);
      if (!row.routeId) return setError(`Trip ${i + 1}: Route is required.`);
      if (row.routeId === "__new__") {
        if (!row.newRouteName.trim()) return setError(`Trip ${i + 1}: New route name is required.`);
        if (!row.newRouteOrigin.trim()) return setError(`Trip ${i + 1}: New route origin is required.`);
        if (!row.newRouteDestination.trim()) return setError(`Trip ${i + 1}: New route destination is required.`);
      }
      if (!row.cohort) return setError(`Trip ${i + 1}: Schedule is required.`);
      if (!row.vehicleId) return setError(`Trip ${i + 1}: Vehicle is required.`);
    }

    setLoading(true);
    try {
      const resolvedRows = await Promise.all(rows.map(async (row, i) => {
        if (row.routeId !== "__new__") return { ...row };
        const rRes = await fetch("/api/admin/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.newRouteName.trim(),
            origin: row.newRouteOrigin.trim(),
            destination: row.newRouteDestination.trim(),
          }),
        });
        if (!rRes.ok) {
          const d = await rRes.json().catch(() => ({}));
          throw new Error(d.error || `Trip ${i + 1}: Failed to create new route.`);
        }
        const newRoute = await rRes.json();
        return { ...row, routeId: newRoute.id };
      }));

      const res = await fetch("/api/placements/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          trips: resolvedRows.map((row) => ({
            clientId: row.clientId,
            routeId: row.routeId,
            cohort: row.cohort,
            laneType: row.laneType,
            vehicleId: row.vehicleId,
            driverName1: row.driverName1,
            driverNumber1: row.driverNumber1,
            driverName2: row.driverName2,
            driverNumber2: row.driverNumber2,
            referenceId: row.referenceId || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create placements.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-700 w-28">Placement Date</label>
        <input
          type="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-4">
        {rows.map((row, i) => {
          const availableRoutes = clientRoutes[i] ?? [];
          const isAdhoc = row.cohort === "Adhoc";
          const isNewRoute = row.routeId === "__new__";

          return (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip {i + 1}</span>
                {rows.length > 1 && (
                  <button type="button" onClick={() => { setRows((p) => p.filter((_, idx) => idx !== i)); setVehicleSearches(p => p.filter((_, idx) => idx !== i)); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Client *</label>
                  <select value={row.clientId} onChange={(e) => {
                    setField(i, "clientId", e.target.value);
                    setField(i, "routeId", "");
                    setField(i, "placementTimeOverride", "");
                    fetchClientRoutes(i, e.target.value);
                  }} className={inputCls} required>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Route *</label>
                  <select value={row.routeId} onChange={(e) => {
                    setField(i, "routeId", e.target.value);
                    lookupMaster(i, row.clientId, e.target.value);
                  }} className={inputCls} required disabled={!row.clientId}>
                    <option value="">
                      {row.clientId ? "Select route" : "Select client first"}
                    </option>
                    {isAdhoc && (
                      <option value="__new__">+ New Route (Adhoc)</option>
                    )}
                    {availableRoutes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    {availableRoutes.length === 0 && row.clientId && !isAdhoc && (
                      <option value="" disabled>No master routes for this client</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Schedule *</label>
                  <select value={row.cohort} onChange={(e) => {
                    setField(i, "cohort", e.target.value);
                    if (e.target.value === "Adhoc" || row.cohort === "Adhoc") {
                      setField(i, "routeId", "");
                    }
                  }} className={inputCls} required>
                    <option value="">Select schedule</option>
                    {SCHEDULE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {row.placementTimeOverride && !isNewRoute && (
                  <div className="flex flex-col gap-0.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0" />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-700">Placement Time: {row.placementTimeOverride}</span>
                    </div>
                    {row.vendorName && (
                      <span className="text-xs text-emerald-600 pl-5">Vendor: {row.vendorName}</span>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Lane Type *</label>
                  <select value={row.laneType} onChange={(e) => {
                    const newLane = e.target.value as "FW" | "RET";
                    setField(i, "laneType", newLane);
                    if (row.routeId && row.routeId !== "__new__") {
                      swapRoute(i, row.routeId, newLane, clientRoutes[i] ?? []);
                    }
                  }} className={inputCls}>
                    <option value="FW">Forward (FW)</option>
                    <option value="RET">Return (RET)</option>
                  </select>
                </div>
              </div>

              {isAdhoc && isNewRoute && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="md:col-span-3 flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Create New Route</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Route Name *</label>
                    <input type="text" value={row.newRouteName} onChange={(e) => setField(i, "newRouteName", e.target.value)} placeholder="e.g. Mumbai–Pune Adhoc" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Origin *</label>
                    <input type="text" value={row.newRouteOrigin} onChange={(e) => setField(i, "newRouteOrigin", e.target.value)} placeholder="e.g. Mumbai" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Destination *</label>
                    <input type="text" value={row.newRouteDestination} onChange={(e) => setField(i, "newRouteDestination", e.target.value)} placeholder="e.g. Pune" className={inputCls} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Vehicle *</label>
                  <input
                    type="text"
                    value={vehicleSearches[i] ?? ""}
                    onChange={e => setVehicleSearch(i, e.target.value)}
                    placeholder="Search vehicle number…"
                    className={inputCls}
                  />
                  {(() => {
                    const search = (vehicleSearches[i] ?? "").toUpperCase();
                    const filtered = vehicles.filter(v => v.vehicleNumber.toUpperCase().includes(search));
                    const exactMatch = vehicles.some(v => v.vehicleNumber.toUpperCase() === search);
                    return (
                      <>
                        <select
                          value={row.vehicleId}
                          onChange={(e) => { setField(i, "vehicleId", e.target.value); setVehicleSearch(i, ""); }}
                          className={`${inputCls} mt-1`}
                          required
                          size={search ? Math.min(6, filtered.length + 1) : 1}
                        >
                          <option value="">Select vehicle</option>
                          {filtered.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
                        </select>
                        {search && !exactMatch && (
                          <button
                            type="button"
                            onClick={() => addNewVehicle(i, search)}
                            className="mt-1 w-full text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-colors font-medium text-left"
                          >
                            + Add &quot;{search}&quot; to fleet
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Driver 1</p>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                    <input type="text" value={row.driverName1} onChange={(e) => setField(i, "driverName1", e.target.value)} placeholder="e.g. Ram Kumar" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Phone Number</label>
                    <input type="tel" value={row.driverNumber1} onChange={(e) => setField(i, "driverNumber1", e.target.value)} placeholder="e.g. 9876543210" className={inputCls} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Driver 2</p>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                    <input type="text" value={row.driverName2} onChange={(e) => setField(i, "driverName2", e.target.value)} placeholder="e.g. Shyam Singh" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Phone Number</label>
                    <input type="tel" value={row.driverNumber2} onChange={(e) => setField(i, "driverNumber2", e.target.value)} placeholder="e.g. 9876543210" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* VRID — only for AMZ */}
              {clients.find(c => c.id === row.clientId)?.name?.toUpperCase().includes("AMZ") && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 block">Reference ID (VRID)</label>
                  <input
                    type="text"
                    value={row.referenceId}
                    onChange={(e) => setField(i, "referenceId", e.target.value)}
                    placeholder="e.g. VRID-12345"
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => { setRows((p) => [...p, emptyRow()]); setVehicleSearches(p => [...p, ""]); }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add another trip
        </button>
        <div className="flex gap-3">
          <a href="/dashboard" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </a>
          <button type="submit" disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Saving…" : `Save ${rows.length} Trip${rows.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </form>
  );
}
