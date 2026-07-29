"use client";
import { useEffect, useState } from "react";

type Client = { id: string; name: string; kam: { id: string; name: string } | null };
type KamUser = { id: string; name: string };

export default function ClientsTable({
  initialClients,
  initialKams,
}: {
  initialClients?: Client[];
  initialKams?: KamUser[];
}) {
  const [clients, setClients] = useState<Client[]>(initialClients ?? []);
  const [kams, setKams] = useState<KamUser[]>(initialKams ?? []);
  const [loading, setLoading] = useState(!initialClients);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKamId, setEditKamId] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKamId, setNewKamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialClients) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [cRes, uRes] = await Promise.all([fetch("/api/admin/clients"), fetch("/api/admin/users")]);
    if (cRes.ok) setClients(await cRes.json());
    if (uRes.ok) {
      const users = await uRes.json();
      setKams(users.filter((u: { role: string; id: string; name: string }) => u.role === "KAM"));
    }
    setLoading(false);
  }

  async function refresh() {
    const res = await fetch("/api/admin/clients");
    if (res.ok) setClients(await res.json());
  }

  async function addClient() {
    if (!newName.trim()) return setError("Client name is required.");
    setSaving(true);
    const res = await fetch("/api/admin/clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, kamId: newKamId || null }),
    });
    if (res.ok) { setAdding(false); setNewName(""); setNewKamId(""); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed to add."); }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return setError("Name is required.");
    setSaving(true);
    const res = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, kamId: editKamId || null }),
    });
    if (res.ok) { setEditId(null); setError(""); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed."); }
    setSaving(false);
  }

  async function deleteClient(id: string, name: string) {
    if (!window.confirm(`Delete client "${name}"?`)) return;
    setClients(prev => prev.filter(c => c.id !== id));
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
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
              <th className="px-3 py-2.5 text-left border-b border-slate-200">Client</th>
              <th className="px-3 py-2.5 text-left border-b border-slate-200">KAM</th>
              <th className="px-3 py-2.5 text-right border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5">
                  {editId === c.id
                    ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                    : <span className="font-medium text-slate-900">{c.name}</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {editId === c.id
                    ? <select value={editKamId} onChange={(e) => setEditKamId(e.target.value)} className={inputCls}>
                        <option value="">No KAM</option>
                        {kams.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    : (c.kam?.name ?? "—")}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editId === c.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(c.id)} disabled={saving}
                        className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {saving ? "…" : "Save"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditKamId(c.kam?.id ?? ""); setError(""); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">Edit</button>
                      <button onClick={() => deleteClient(c.id, c.name)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="border-b border-blue-100 bg-blue-50/20">
                <td className="px-3 py-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client name" autoFocus className={inputCls} />
                </td>
                <td className="px-3 py-2">
                  <select value={newKamId} onChange={(e) => setNewKamId(e.target.value)} className={inputCls}>
                    <option value="">No KAM</option>
                    {kams.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={addClient} disabled={saving}
                      className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {saving ? "…" : "Add"}
                    </button>
                    <button onClick={() => { setAdding(false); setNewName(""); setError(""); }}
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
          + Add client
        </button>
      )}
    </div>
  );
}
