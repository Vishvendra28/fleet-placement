"use client";
import { useEffect, useState } from "react";

type Route = { id: string; name: string; origin: string; destination: string };

export default function RoutesTable({ initialRoutes }: { initialRoutes?: Route[] }) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes ?? []);
  const [loading, setLoading] = useState(!initialRoutes);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", origin: "", destination: "" });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ name: "", origin: "", destination: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialRoutes) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/routes");
    if (res.ok) setRoutes(await res.json());
    setLoading(false);
  }

  async function refresh() {
    const res = await fetch("/api/admin/routes");
    if (res.ok) setRoutes(await res.json());
  }

  async function addRoute() {
    if (!newRow.name.trim() || !newRow.origin.trim() || !newRow.destination.trim())
      return setError("All fields are required.");
    setSaving(true);
    const res = await fetch("/api/admin/routes", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRow),
    });
    if (res.ok) { setAdding(false); setNewRow({ name: "", origin: "", destination: "" }); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed to add."); }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!edit.name.trim() || !edit.origin.trim() || !edit.destination.trim())
      return setError("All fields are required.");
    setSaving(true);
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit),
    });
    if (res.ok) { setEditId(null); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed."); }
    setSaving(false);
  }

  async function deleteRoute(id: string, name: string) {
    if (!window.confirm(`Delete route "${name}"?`)) return;
    setRoutes(prev => prev.filter(r => r.id !== id));
    const res = await fetch(`/api/admin/routes/${id}`, { method: "DELETE" });
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
              <th className="px-3 py-2.5 text-left border-b border-slate-200">Route Name</th>
              <th className="px-3 py-2.5 text-left border-b border-slate-200">From → To</th>
              <th className="px-3 py-2.5 text-right border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5">
                  {editId === r.id
                    ? <input value={edit.name} onChange={(e) => setEdit(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                    : <span className="font-semibold text-slate-900">{r.name}</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {editId === r.id ? (
                    <div className="flex gap-1 items-center">
                      <input value={edit.origin} onChange={(e) => setEdit(p => ({ ...p, origin: e.target.value }))} placeholder="From" className={inputCls} />
                      <span className="text-slate-400 text-xs flex-shrink-0">→</span>
                      <input value={edit.destination} onChange={(e) => setEdit(p => ({ ...p, destination: e.target.value }))} placeholder="To" className={inputCls} />
                    </div>
                  ) : `${r.origin} → ${r.destination}`}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editId === r.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(r.id)} disabled={saving}
                        className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {saving ? "…" : "Save"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditId(r.id); setEdit({ name: r.name, origin: r.origin, destination: r.destination }); setError(""); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">Edit</button>
                      <button onClick={() => deleteRoute(r.id, r.name)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="border-b border-blue-100 bg-blue-50/20">
                <td className="px-3 py-2">
                  <input value={newRow.name} onChange={(e) => setNewRow(p => ({ ...p, name: e.target.value }))} placeholder="Route name" autoFocus className={inputCls} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <input value={newRow.origin} onChange={(e) => setNewRow(p => ({ ...p, origin: e.target.value }))} placeholder="From" className={inputCls} />
                    <span className="text-slate-400 text-xs flex-shrink-0">→</span>
                    <input value={newRow.destination} onChange={(e) => setNewRow(p => ({ ...p, destination: e.target.value }))} placeholder="To" className={inputCls} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={addRoute} disabled={saving}
                      className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {saving ? "…" : "Add"}
                    </button>
                    <button onClick={() => { setAdding(false); setNewRow({ name: "", origin: "", destination: "" }); setError(""); }}
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
          + Add route
        </button>
      )}
    </div>
  );
}
