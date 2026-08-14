"use client";
import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: string };

const ROLES = ["ADMIN", "PLANNING_TEAM", "PLACEMENT_TEAM", "DRIVER_MANAGEMENT", "MAINTENANCE_TEAM", "STORE_AND_TYRE", "E_LOCK_TEAM", "KAM", "VEHICLE_HEALTH_TEAM"];
const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  PLANNING_TEAM: "bg-blue-100 text-blue-700",
  PLACEMENT_TEAM: "bg-green-100 text-green-700",
  DRIVER_MANAGEMENT: "bg-orange-100 text-orange-700",
  MAINTENANCE_TEAM: "bg-pink-100 text-pink-700",
  STORE_AND_TYRE: "bg-yellow-100 text-yellow-700",
  E_LOCK_TEAM: "bg-cyan-100 text-cyan-700",
  KAM: "bg-red-100 text-red-700",
  VEHICLE_HEALTH_TEAM: "bg-teal-100 text-teal-700",
};
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", PLANNING_TEAM: "Planning Team", PLACEMENT_TEAM: "Placement Team",
  DRIVER_MANAGEMENT: "Driver Mgmt", MAINTENANCE_TEAM: "Maintenance", STORE_AND_TYRE: "Store & Tyre",
  E_LOCK_TEAM: "E-Lock Team", KAM: "KAM", VEHICLE_HEALTH_TEAM: "Vehicle Team",
};

export default function UsersTable({ initialUsers }: { initialUsers?: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(!initialUsers);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only fetch on mount if no server-provided initial data
  useEffect(() => {
    if (!initialUsers) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  // Silent refresh after mutations — no loading flash
  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  function startEdit(u: User) { setEditId(u.id); setEditName(u.name); setEditRole(u.role); setError(""); }

  async function saveEdit(id: string) {
    if (!editName.trim()) return setError("Name is required.");
    setSaving(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, role: editRole }),
    });
    if (res.ok) { setEditId(null); await refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Failed to save."); }
    setSaving(false);
  }

  async function deleteUser(id: string, name: string) {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    // Optimistic remove
    setUsers(prev => prev.filter(u => u.id !== id));
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Failed to delete.");
      await refresh(); // revert on failure
    }
  }

  const inputCls = "border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

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
              <th className="px-4 py-2.5 text-left border-b border-slate-200">Name</th>
              <th className="px-4 py-2.5 text-left border-b border-slate-200">Email</th>
              <th className="px-4 py-2.5 text-left border-b border-slate-200">Role</th>
              <th className="px-4 py-2.5 text-right border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-2.5">
                  {editId === u.id
                    ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                    : <span className="font-medium text-slate-900">{u.name}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{u.email}</td>
                <td className="px-4 py-2.5">
                  {editId === u.id
                    ? <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={inputCls}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    : <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {editId === u.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(u.id)} disabled={saving}
                        className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {saving ? "…" : "Save"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => startEdit(u)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">Edit</button>
                      <button onClick={() => deleteUser(u.id, u.name)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
