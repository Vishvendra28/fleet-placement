"use client";
import { useEffect, useState } from "react";

type Vehicle = { id: string; vehicleNumber: string; type: string | null; isActive: boolean };

export default function VehiclesTable({ initialVehicles }: { initialVehicles?: Vehicle[] }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles ?? []);
  const [loading, setLoading] = useState(!initialVehicles);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ vehicleNumber: "", type: "" });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ vehicleNumber: "", type: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialVehicles) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/vehicles");
    if (res.ok) setVehicles(await res.json());
    setLoading(false);
  }

  async function refresh() {
    const res = await fetch("/api/admin/vehicles");
    if (res.ok) setVehicles(await res.json());
  }

  async function addVehicle() {
    if (!newRow.vehicleNumber.trim()) return setError("Vehicle number is required.");
    setSaving(true);
    const res = await fetch("/api/admin/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRow),
    });
    if (res.ok) { setAdding(false); setNewRow({ vehicleNumber: "", type: "" }); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed to add."); }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!edit.vehicleNumber.trim()) return setError("Vehicle number is required.");
    setSaving(true);
    const res = await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit),
    });
    if (res.ok) { setEditId(null); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed."); }
    setSaving(false);
  }

  async function toggleActive(id: string) {
    // Optimistic toggle
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, isActive: !v.isActive } : v));
    const res = await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleActive: true }),
    });
    if (!res.ok) await refresh(); // revert on failure
  }

  async function deleteVehicle(id: string, num: string) {
    if (!window.confirm(`Delete vehicle "${num}"?`)) return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    const res = await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("Failed to delete."); await refresh(); }
  }

  const inputCls = "border border-slate-200 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

  if (loading) return (
    <div className="flex items-center gap-2 py-6 justify-center">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-slate-400">Loading…</span>
    </div>
  );

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 text-left border-b border-slate-200">Vehicle No.</th>
              <th className="px-3 py-2.5 text-left border-b border-slate-200">Type</th>
              <th className="px-3 py-2.5 text-left border-b border-slate-200">Status</th>
              <th className="px-3 py-2.5 text-right border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5">
                  {editId === v.id
                    ? <input value={edit.vehicleNumber} onChange={(e) => setEdit(p => ({ ...p, vehicleNumber: e.target.value }))} className={inputCls} />
                    : <span className="font-mono font-semibold text-slate-900">{v.vehicleNumber}</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {editId === v.id
                    ? <input value={edit.type} onChange={(e) => setEdit(p => ({ ...p, type: e.target.value }))} placeholder="Optional" className={inputCls} />
                    : (v.type || "—")}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => toggleActive(v.id)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${v.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"}`}
                  >
                    {v.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editId === v.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(v.id)} disabled={saving}
                        className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {saving ? "…" : "Save"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditId(v.id); setEdit({ vehicleNumber: v.vehicleNumber, type: v.type || "" }); setError(""); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">Edit</button>
                      <button onClick={() => deleteVehicle(v.id, v.vehicleNumber)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="border-b border-blue-100 bg-blue-50/20">
                <td className="px-3 py-2">
                  <input value={newRow.vehicleNumber} onChange={(e) => setNewRow(p => ({ ...p, vehicleNumber: e.target.value }))}
                    placeholder="e.g. MH12AB1234" autoFocus className={inputCls} />
                </td>
                <td className="px-3 py-2">
                  <input value={newRow.type} onChange={(e) => setNewRow(p => ({ ...p, type: e.target.value }))} placeholder="Optional" className={inputCls} />
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-slate-400">Active (default)</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={addVehicle} disabled={saving}
                      className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {saving ? "…" : "Add"}
                    </button>
                    <button onClick={() => { setAdding(false); setNewRow({ vehicleNumber: "", type: "" }); setError(""); }}
                      className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <button onClick={() => { setAdding(true); setError(""); }}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">
          + Add vehicle
        </button>
      )}
    </div>
  );
}
