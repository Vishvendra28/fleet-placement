"use client";
import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Client = { id: string; name: string; kam: { id: string; name: string } | null };
type Route = { id: string; name: string; origin: string; destination: string };
type Vendor = { id: string; name: string };
type KAM = { id: string; name: string; clients: { id: string; name: string }[] };
type User = { id: string; name: string; email: string; role: string; createdAt: string };
type Vehicle = { id: string; vehicleNumber: string; type: string | null; isActive: boolean; inactiveReason: string | null; inactiveComment: string | null };
type MasterRoute = {
  id: string; cohort: string; placementTime: string; compliance: string;
  vendorId: string | null; isActive: boolean;
  client: { id: string; name: string };
  route: { id: string; name: string; origin: string; destination: string };
  vendor: { id: string; name: string } | null;
};

// ── Constants ──────────────────────────────────────────────────────────────
const COHORTS = ["SCH 02 Way", "SCH 1 Way", "Adhoc"];
const COMPLIANCE_OPTIONS = [
  { value: "E_LOCK", label: "E-Lock" },
  { value: "E_LOCK_IDFY", label: "E-Lock + IDFY" },
];
const COMPLIANCE_LABELS: Record<string, string> = { E_LOCK: "E-Lock", E_LOCK_IDFY: "E-Lock + IDFY" };
const COHORT_COLOR: Record<string, string> = {
  "SCH 02 Way": "bg-blue-100 text-blue-700",
  "SCH 1 Way": "bg-purple-100 text-purple-700",
  "Adhoc": "bg-slate-100 text-slate-600",
};
const COMPLIANCE_COLOR: Record<string, string> = {
  E_LOCK: "bg-amber-100 text-amber-700",
  E_LOCK_IDFY: "bg-orange-100 text-orange-700",
};
const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "PLANNING_TEAM", label: "Planning Team" },
  { value: "PLACEMENT_TEAM", label: "Placement Team" },
  { value: "DRIVER_MANAGEMENT", label: "Driver Management" },
  { value: "MAINTENANCE_TEAM", label: "Maintenance Team" },
  { value: "KAM", label: "KAM" },
];
const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));
const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  PLANNING_TEAM: "bg-blue-100 text-blue-700",
  PLACEMENT_TEAM: "bg-emerald-100 text-emerald-700",
  DRIVER_MANAGEMENT: "bg-orange-100 text-orange-700",
  MAINTENANCE_TEAM: "bg-pink-100 text-pink-700",
  KAM: "bg-violet-100 text-violet-700",
};

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelCls = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block";

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({
  title, subtitle, count, expanded, onToggle, onAdd,
}: {
  title: string; subtitle: string; count: number;
  expanded: boolean; onToggle: () => void; onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
      <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
        <span className="text-base font-bold text-slate-900">{title}</span>
        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{count}</span>
        <span className="ml-1 text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      <p className="text-sm text-slate-400 hidden md:block">{subtitle}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  );
}

// ── Master Route modal ─────────────────────────────────────────────────────
function MasterRouteModal({
  title, clients, routes, vendors, initial, onSave, onClose,
}: {
  title: string; clients: Client[]; routes: Route[]; vendors: Vendor[];
  initial?: Partial<MasterRoute>;
  onSave: (data: Record<string, string | null>) => Promise<void>;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(initial?.client?.id ?? "");
  const [routeId, setRouteId] = useState(initial?.route?.id ?? "");
  const [cohort, setCohort] = useState(initial?.cohort ?? "SCH 02 Way");
  const [placementTime, setPlacementTime] = useState(initial?.placementTime ?? "");
  const [compliance, setCompliance] = useState(initial?.compliance ?? "E_LOCK");
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!clientId) return setErr("Client is required");
    if (!routeId) return setErr("Route is required");
    if (!placementTime) return setErr("Placement time is required");
    setSaving(true);
    try {
      await onSave({ clientId, routeId, cohort, placementTime, compliance, vendorId: vendorId || null });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 mb-5">{title}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Route *</label>
              <select value={routeId} onChange={e => setRouteId(e.target.value)} className={inputCls}>
                <option value="">Select route</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cohort</label>
              <select value={cohort} onChange={e => setCohort(e.target.value)} className={inputCls}>
                {COHORTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Placement Time *</label>
              <input type="time" value={placementTime} onChange={e => setPlacementTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Compliance</label>
              <select value={compliance} onChange={e => setCompliance(e.target.value)} className={inputCls}>
                {COMPLIANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vendor (blank = Fleet)</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputCls}>
                <option value="">Fleet (own vehicle)</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete ─────────────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete this entry?</h3>
        <p className="text-sm text-slate-500 mb-5">{label}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Master Route table ─────────────────────────────────────────────────────
function MRRow({ mr, onEdit, onDelete }: { mr: MasterRoute; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-sm font-semibold text-slate-900">{mr.client.name}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-slate-700">{mr.route.name}</td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COHORT_COLOR[mr.cohort] ?? "bg-slate-100 text-slate-600"}`}>
          {mr.cohort}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-slate-700">{mr.placementTime}</td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COMPLIANCE_COLOR[mr.compliance] ?? "bg-slate-100 text-slate-600"}`}>
          {COMPLIANCE_LABELS[mr.compliance] ?? mr.compliance}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-500">{mr.vendor?.name ?? <span className="text-emerald-600 font-medium">Fleet</span>}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:underline font-medium">Delete</button>
        </div>
      </td>
    </tr>
  );
}

function MRTable({ rows, onEdit, onDelete }: { rows: MasterRoute[]; onEdit: (mr: MasterRoute) => void; onDelete: (mr: MasterRoute) => void }) {
  if (rows.length === 0) return <p className="px-6 py-8 text-sm text-slate-400 text-center">No entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {["Client", "Route", "Cohort", "Time", "Compliance", "Vendor", ""].map(h => (
              <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(mr => <MRRow key={mr.id} mr={mr} onEdit={() => onEdit(mr)} onDelete={() => onDelete(mr)} />)}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MasterPage() {
  const [data, setData] = useState<{
    masterRoutes: MasterRoute[]; clients: Client[]; vendors: Vendor[];
    kams: KAM[]; routes: Route[]; users: User[]; vehicles: Vehicle[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    fleet: true, clients: true, kam: true, vendors: true, routes: false, users: false, vehicles: false,
  });

  // Master route modal
  const [routeModal, setRouteModal] = useState<{ mode: "add" } | { mode: "edit"; initial: MasterRoute } | null>(null);

  // Base route modal
  const [brModal, setBrModal] = useState<{ mode: "add" } | { mode: "edit"; route: Route } | null>(null);
  const [brName, setBrName] = useState("");
  const [brOrigin, setBrOrigin] = useState("");
  const [brDestination, setBrDestination] = useState("");

  // User modal
  const [userModal, setUserModal] = useState<{ mode: "add" } | { mode: "edit"; user: User } | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("PLANNING_TEAM");

  // Vehicle modal
  const [vModal, setVModal] = useState<{ mode: "add" } | { mode: "edit"; vehicle: Vehicle } | null>(null);
  const [vNum, setVNum] = useState("");
  const [vType, setVType] = useState("");
  const [vSearch, setVSearch] = useState("");
  const [vFilter, setVFilter] = useState<"all" | "active" | "inactive">("all");

  // Vendor modal
  const [vendorModal, setVendorModal] = useState<{ mode: "add" } | { mode: "edit"; vendor: Vendor } | null>(null);
  const [vendorName, setVendorName] = useState("");

  // Client modal
  const [clientModal, setClientModal] = useState<{ mode: "add" } | { mode: "edit"; client: Client } | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientKamId, setClientKamId] = useState("");

  // KAM client assignment
  const [kamClientIds, setKamClientIds] = useState<string[]>([]);

  // Shared form state
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "masterRoute" | "vendor" | "client" | "user" | "baseRoute" | "vehicle";
    id: string; label: string;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/master");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSection(key: string) {
    setOpenSections(p => ({ ...p, [key]: !p[key] }));
  }

  // ── Master Route CRUD ────────────────────────────────────────────────────
  async function saveMasterRoute(formData: Record<string, string | null>) {
    if (routeModal?.mode === "edit") {
      const res = await fetch(`/api/master/routes/${(routeModal as { mode: "edit"; initial: MasterRoute }).initial.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    } else {
      const res = await fetch("/api/master/routes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    }
    await load();
  }

  // ── Base Route CRUD ──────────────────────────────────────────────────────
  async function saveBaseRoute() {
    if (!brName.trim() || !brOrigin.trim() || !brDestination.trim()) return setFormErr("All fields are required");
    setSaving(true); setFormErr("");
    try {
      if (brModal?.mode === "edit") {
        const res = await fetch(`/api/admin/routes/${(brModal as { mode: "edit"; route: Route }).route.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: brName, origin: brOrigin, destination: brDestination }),
        });
        if (!res.ok) { setFormErr((await res.json()).error); return; }
      } else {
        const res = await fetch("/api/admin/routes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: brName, origin: brOrigin, destination: brDestination }),
        });
        if (!res.ok) { setFormErr((await res.json()).error); return; }
      }
      setBrModal(null); setBrName(""); setBrOrigin(""); setBrDestination("");
      await load();
    } catch { setFormErr("Failed to save"); }
    finally { setSaving(false); }
  }

  // ── User CRUD ────────────────────────────────────────────────────────────
  async function saveUser() {
    if (!userName.trim()) return setFormErr("Name is required");
    if (userModal?.mode === "add" && !userEmail.trim()) return setFormErr("Email is required");
    if (userModal?.mode === "add" && userPassword.length < 6) return setFormErr("Password must be at least 6 characters");
    setSaving(true); setFormErr("");
    try {
      if (userModal?.mode === "edit") {
        const editedUser = (userModal as { mode: "edit"; user: User }).user;
        const res = await fetch(`/api/admin/users/${editedUser.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: userName, role: userRole }),
        });
        if (!res.ok) { setFormErr((await res.json()).error); return; }

        // If editing a KAM, also sync client assignments
        if (userRole === "KAM") {
          const currentKam = kams.find(k => k.id === editedUser.id);
          const currentIds = currentKam?.clients.map(c => c.id) ?? [];
          const toUnassign = currentIds.filter(id => !kamClientIds.includes(id));
          const toAssign = kamClientIds.filter(id => !currentIds.includes(id));
          await Promise.all([
            ...toUnassign.map(id => {
              const c = clients.find(cl => cl.id === id);
              return fetch(`/api/admin/clients/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: c?.name ?? "", kamId: null }),
              });
            }),
            ...toAssign.map(id => {
              const c = clients.find(cl => cl.id === id);
              return fetch(`/api/admin/clients/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: c?.name ?? "", kamId: editedUser.id }),
              });
            }),
          ]);
        }
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: userName, email: userEmail, password: userPassword, role: userRole }),
        });
        if (!res.ok) { setFormErr((await res.json()).error); return; }
      }
      setUserModal(null); setUserName(""); setUserEmail(""); setUserPassword(""); setUserRole("PLANNING_TEAM"); setKamClientIds([]);
      await load();
    } catch { setFormErr("Failed to save"); }
    finally { setSaving(false); }
  }

  // ── Vehicle CRUD ─────────────────────────────────────────────────────────
  async function saveVehicle() {
    if (!vNum.trim()) return setFormErr("Vehicle number is required");
    setSaving(true); setFormErr("");
    try {
      if (vModal?.mode === "edit") {
        const res = await fetch(`/api/admin/vehicles/${(vModal as { mode: "edit"; vehicle: Vehicle }).vehicle.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleNumber: vNum.trim().toUpperCase(), type: vType.trim() || null }),
        });
        if (!res.ok) { setFormErr((await res.json()).error ?? "Failed to save"); return; }
      } else {
        const res = await fetch("/api/admin/vehicles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleNumber: vNum.trim().toUpperCase(), type: vType.trim() || null }),
        });
        if (!res.ok) { setFormErr((await res.json()).error ?? "Failed to save"); return; }
      }
      setVModal(null); setVNum(""); setVType("");
      await load();
    } catch { setFormErr("Failed to save"); }
    finally { setSaving(false); }
  }

  async function toggleVehicleActive(vehicle: Vehicle) {
    await fetch(`/api/admin/vehicles/${vehicle.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleActive: true }),
    });
    await load();
  }

  // ── Vendor CRUD ──────────────────────────────────────────────────────────
  async function saveVendor() {
    if (!vendorName.trim()) return setFormErr("Vendor name required");
    setSaving(true); setFormErr("");
    try {
      if (vendorModal?.mode === "edit") {
        await fetch(`/api/master/vendors/${(vendorModal as { mode: "edit"; vendor: Vendor }).vendor.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: vendorName }),
        });
      } else {
        await fetch("/api/master/vendors", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: vendorName }),
        });
      }
      setVendorModal(null); setVendorName("");
      await load();
    } catch { setFormErr("Failed to save"); }
    finally { setSaving(false); }
  }

  // ── Client CRUD ──────────────────────────────────────────────────────────
  async function saveClient() {
    if (!clientName.trim()) return setFormErr("Client name required");
    setSaving(true); setFormErr("");
    try {
      if (clientModal?.mode === "edit") {
        await fetch(`/api/admin/clients/${(clientModal as { mode: "edit"; client: Client }).client.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: clientName, kamId: clientKamId || null }),
        });
      } else {
        await fetch("/api/admin/clients", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: clientName, kamId: clientKamId || null }),
        });
      }
      setClientModal(null); setClientName(""); setClientKamId("");
      await load();
    } catch { setFormErr("Failed to save"); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === "masterRoute") await fetch(`/api/master/routes/${id}`, { method: "DELETE" });
    else if (type === "vendor") await fetch(`/api/master/vendors/${id}`, { method: "DELETE" });
    else if (type === "client") await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    else if (type === "user") await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    else if (type === "baseRoute") await fetch(`/api/admin/routes/${id}`, { method: "DELETE" });
    else if (type === "vehicle") await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await load();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Loading master data…</p>
    </div>
  );

  if (!data) return <p className="text-center py-24 text-slate-400">Failed to load.</p>;

  const { masterRoutes, clients, vendors, kams, routes, users, vehicles } = data;
  const fleetRoutes = masterRoutes.filter(mr => !mr.vendorId);
  const vendorRoutes = masterRoutes.filter(mr => !!mr.vendorId);

  return (
    <>
      {/* Master Route modal */}
      {routeModal && (
        <MasterRouteModal
          title={routeModal.mode === "add" ? "Add Master Route" : "Edit Master Route"}
          clients={clients} routes={routes} vendors={vendors}
          initial={routeModal.mode === "edit" ? (routeModal as { mode: "edit"; initial: MasterRoute }).initial : undefined}
          onSave={saveMasterRoute}
          onClose={() => setRouteModal(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete label={deleteTarget.label} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* Vendor modal */}
      {vendorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {vendorModal.mode === "add" ? "Add Vendor" : "Edit Vendor"}
            </h3>
            <label className={labelCls}>Vendor Name</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g. Dynamic" className={inputCls} />
            {formErr && <p className="text-sm text-red-600 mt-2">{formErr}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setVendorModal(null); setVendorName(""); setFormErr(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveVendor} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client modal */}
      {clientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {clientModal.mode === "add" ? "Add Client" : "Edit Client"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Client Name *</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. AMZ" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Assign KAM</label>
                <select value={clientKamId} onChange={e => setClientKamId(e.target.value)} className={inputCls}>
                  <option value="">No KAM assigned</option>
                  {kams.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
            </div>
            {formErr && <p className="text-sm text-red-600 mt-2">{formErr}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setClientModal(null); setClientName(""); setClientKamId(""); setFormErr(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveClient} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Base Route modal */}
      {brModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {brModal.mode === "add" ? "Add Route" : "Edit Route"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Route Name *</label>
                <input value={brName} onChange={e => setBrName(e.target.value)} placeholder="e.g. BGLR-GGN" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Origin *</label>
                  <input value={brOrigin} onChange={e => setBrOrigin(e.target.value)} placeholder="e.g. Bangalore" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Destination *</label>
                  <input value={brDestination} onChange={e => setBrDestination(e.target.value)} placeholder="e.g. Gurgaon" className={inputCls} />
                </div>
              </div>
            </div>
            {formErr && <p className="text-sm text-red-600 mt-2">{formErr}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setBrModal(null); setBrName(""); setBrOrigin(""); setBrDestination(""); setFormErr(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveBaseRoute} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User modal */}
      {userModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {userModal.mode === "add" ? "Add User" : "Edit User"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. Rahul Sharma" className={inputCls} />
              </div>
              {userModal.mode === "add" && (
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="e.g. rahul@company.com" className={inputCls} />
                </div>
              )}
              {userModal.mode === "add" && (
                <div>
                  <label className={labelCls}>Password * (min 6 chars)</label>
                  <input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} placeholder="••••••" className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Role *</label>
                <select value={userRole} onChange={e => setUserRole(e.target.value)} className={inputCls}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {userRole === "KAM" && userModal.mode === "edit" && (
                <div>
                  <label className={labelCls}>Assigned Clients</label>
                  <div className="border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2 bg-slate-50">
                    {clients.length === 0 && <p className="text-xs text-slate-400">No clients in the system yet.</p>}
                    {clients.map(c => (
                      <label key={c.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-white rounded-lg px-1 py-0.5 transition-colors">
                        <input
                          type="checkbox"
                          checked={kamClientIds.includes(c.id)}
                          onChange={e => setKamClientIds(prev =>
                            e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                          )}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-800 font-medium">{c.name}</span>
                        {c.kam && c.kam.id !== (userModal as { mode: "edit"; user: User }).user.id && (
                          <span className="text-[10px] text-amber-600 font-medium ml-auto">currently: {c.kam.name}</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{kamClientIds.length} selected</p>
                </div>
              )}
            </div>
            {formErr && <p className="text-sm text-red-600 mt-2">{formErr}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setUserModal(null); setUserName(""); setUserEmail(""); setUserPassword(""); setUserRole("PLANNING_TEAM"); setKamClientIds([]); setFormErr(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveUser} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle modal */}
      {vModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {vModal.mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Vehicle Number *</label>
                <input value={vNum} onChange={e => setVNum(e.target.value.toUpperCase())} placeholder="e.g. HR38AB6364" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <input value={vType} onChange={e => setVType(e.target.value)} placeholder="e.g. Sedan, SUV" className={inputCls} />
              </div>
            </div>
            {formErr && <p className="text-sm text-red-600 mt-2">{formErr}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setVModal(null); setVNum(""); setVType(""); setFormErr(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveVehicle} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page */}
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Configuration</p>
          <h1 className="text-2xl font-bold text-slate-900">Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fixed rules governing all placements — {masterRoutes.length} routes across {clients.length} clients</p>
        </div>

        {/* ── SECTION 1: Fleet ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="Fleet" subtitle="Routes operated by own vehicles"
            count={fleetRoutes.length} expanded={openSections.fleet}
            onToggle={() => toggleSection("fleet")}
            onAdd={() => setRouteModal({ mode: "add" })}
          />
          {openSections.fleet && (
            <>
              {(["SCH 02 Way", "SCH 1 Way", "Adhoc"] as string[]).map(cohort => {
                const rows = fleetRoutes.filter(mr => mr.cohort === cohort);
                if (rows.length === 0) return null;
                return (
                  <div key={cohort}>
                    <div className="px-6 py-2 bg-slate-50 border-y border-slate-100">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${COHORT_COLOR[cohort] ?? "bg-slate-100 text-slate-600"}`}>{cohort}</span>
                      <span className="text-xs text-slate-400 ml-2">{rows.length} routes</span>
                    </div>
                    <MRTable rows={rows}
                      onEdit={mr => setRouteModal({ mode: "edit", initial: mr })}
                      onDelete={mr => setDeleteTarget({ type: "masterRoute", id: mr.id, label: `${mr.client.name} — ${mr.route.name} (${mr.cohort})` })}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── SECTION 2: Clients ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="Clients" subtitle="All clients and their route configurations"
            count={clients.length} expanded={openSections.clients}
            onToggle={() => toggleSection("clients")}
            onAdd={() => { setClientModal({ mode: "add" }); setClientName(""); setClientKamId(""); setFormErr(""); }}
          />
          {openSections.clients && (
            <div className="divide-y divide-slate-100">
              {clients.map(client => {
                const cRoutes = masterRoutes.filter(mr => mr.client.id === client.id);
                return (
                  <div key={client.id}>
                    <div className="px-6 py-3 bg-slate-50 flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">{client.name}</span>
                      {client.kam && (
                        <span className="text-xs text-slate-500">KAM: <span className="font-medium text-slate-700">{client.kam.name}</span></span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">{cRoutes.length} routes</span>
                      <button onClick={() => { setClientModal({ mode: "edit", client }); setClientName(client.name); setClientKamId(client.kam?.id ?? ""); setFormErr(""); }}
                        className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => setDeleteTarget({ type: "client", id: client.id, label: `Client "${client.name}" and all its master routes` })}
                        className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                    </div>
                    {cRoutes.length > 0 && (
                      <MRTable rows={cRoutes}
                        onEdit={mr => setRouteModal({ mode: "edit", initial: mr })}
                        onDelete={mr => setDeleteTarget({ type: "masterRoute", id: mr.id, label: `${mr.client.name} — ${mr.route.name}` })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 3: KAM ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="KAM" subtitle="Key Account Managers and their clients"
            count={kams.length} expanded={openSections.kam}
            onToggle={() => toggleSection("kam")}
            onAdd={() => { setUserModal({ mode: "add" }); setUserName(""); setUserEmail(""); setUserPassword(""); setUserRole("KAM"); setFormErr(""); }}
          />
          {openSections.kam && (
            <div className="divide-y divide-slate-100">
              {kams.length === 0 && <p className="px-6 py-8 text-sm text-slate-400 text-center">No KAMs yet. Click Add to create one.</p>}
              {kams.map(kam => (
                <div key={kam.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {kam.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{kam.name}</p>
                    {kam.clients.length === 0 ? (
                      <p className="text-xs text-slate-400 mt-1">No clients assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {kam.clients.map((c: { id: string; name: string }) => (
                          <span key={c.id} className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{c.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 mt-1">{kam.clients.length} client{kam.clients.length !== 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button onClick={() => {
                      setUserModal({ mode: "edit", user: kam as unknown as User });
                      setUserName(kam.name); setUserRole("KAM"); setFormErr("");
                      setKamClientIds(kam.clients.map((c: { id: string }) => c.id));
                    }} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                    <button onClick={() => setDeleteTarget({ type: "user", id: kam.id, label: `KAM "${kam.name}"` })}
                      className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 4: Vendors ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="Vendors" subtitle="Third-party operators and their routes"
            count={vendors.length} expanded={openSections.vendors}
            onToggle={() => toggleSection("vendors")}
            onAdd={() => { setVendorModal({ mode: "add" }); setVendorName(""); setFormErr(""); }}
          />
          {openSections.vendors && (
            <div className="divide-y divide-slate-100">
              {vendors.length === 0 && <p className="px-6 py-8 text-sm text-slate-400 text-center">No vendors yet.</p>}
              {vendors.map(vendor => {
                const vRoutes = vendorRoutes.filter(mr => mr.vendor?.id === vendor.id);
                return (
                  <div key={vendor.id}>
                    <div className="px-6 py-3 bg-slate-50 flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">{vendor.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{vRoutes.length} route{vRoutes.length !== 1 ? "s" : ""}</span>
                      <button onClick={() => { setVendorModal({ mode: "edit", vendor }); setVendorName(vendor.name); setFormErr(""); }}
                        className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => setDeleteTarget({ type: "vendor", id: vendor.id, label: `Vendor "${vendor.name}"` })}
                        className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                    </div>
                    {vRoutes.length > 0 && (
                      <MRTable rows={vRoutes}
                        onEdit={mr => setRouteModal({ mode: "edit", initial: mr })}
                        onDelete={mr => setDeleteTarget({ type: "masterRoute", id: mr.id, label: `${mr.client.name} — ${mr.route.name}` })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 5: Routes ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="Routes" subtitle="All route definitions (origin → destination)"
            count={routes.length} expanded={openSections.routes}
            onToggle={() => toggleSection("routes")}
            onAdd={() => { setBrModal({ mode: "add" }); setBrName(""); setBrOrigin(""); setBrDestination(""); setFormErr(""); }}
          />
          {openSections.routes && (
            routes.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No routes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Name", "Origin", "Destination", "Master Routes", ""].map(h => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {routes.map(route => {
                      const usedIn = masterRoutes.filter(mr => mr.route.id === route.id).length;
                      return (
                        <tr key={route.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-mono font-semibold text-slate-900">{route.name}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-700">{route.origin}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-700">{route.destination}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{usedIn}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => {
                                setBrModal({ mode: "edit", route });
                                setBrName(route.name); setBrOrigin(route.origin); setBrDestination(route.destination);
                                setFormErr("");
                              }} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                              <button onClick={() => setDeleteTarget({ type: "baseRoute", id: route.id, label: `Route "${route.name}" (${route.origin} → ${route.destination})` })}
                                className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* ── SECTION 6: Users ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            title="Users" subtitle="All system users and their roles"
            count={users.length} expanded={openSections.users}
            onToggle={() => toggleSection("users")}
            onAdd={() => { setUserModal({ mode: "add" }); setUserName(""); setUserEmail(""); setUserPassword(""); setUserRole("PLANNING_TEAM"); setFormErr(""); }}
          />
          {openSections.users && (
            users.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Name", "Email", "Role", ""].map(h => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{user.email}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => {
                              setUserModal({ mode: "edit", user });
                              setUserName(user.name); setUserRole(user.role); setFormErr("");
                            }} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                            <button onClick={() => setDeleteTarget({ type: "user", id: user.id, label: `User "${user.name}" (${ROLE_LABELS[user.role] ?? user.role})` })}
                              className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
        {/* ── SECTION 7: Vehicles ─────────────────────────────────────── */}
        {(() => {
          const filtered = vehicles.filter(v => {
            const matchSearch = v.vehicleNumber.toLowerCase().includes(vSearch.toLowerCase()) ||
              (v.type ?? "").toLowerCase().includes(vSearch.toLowerCase());
            const matchFilter = vFilter === "all" || (vFilter === "active" ? v.isActive : !v.isActive);
            return matchSearch && matchFilter;
          });
          const activeCount = vehicles.filter(v => v.isActive).length;
          const inactiveCount = vehicles.filter(v => !v.isActive).length;
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <SectionHeader
                title="Vehicles" subtitle="All registered vehicles in the fleet"
                count={vehicles.length} expanded={openSections.vehicles}
                onToggle={() => toggleSection("vehicles")}
                onAdd={() => { setVModal({ mode: "add" }); setVNum(""); setVType(""); setFormErr(""); }}
              />
              {openSections.vehicles && (
                <>
                  <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
                    <input
                      value={vSearch} onChange={e => setVSearch(e.target.value)}
                      placeholder="Search vehicle number or type…"
                      className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1">
                      {(["all", "active", "inactive"] as const).map(f => (
                        <button key={f} onClick={() => setVFilter(f)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${vFilter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          {f} {f === "all" ? `(${vehicles.length})` : f === "active" ? `(${activeCount})` : `(${inactiveCount})`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filtered.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-slate-400 text-center">No vehicles match your search.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {["Vehicle Number", "Type", "Status", ""].map(h => (
                              <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filtered.map(vehicle => (
                            <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 text-sm font-mono font-semibold text-slate-900">{vehicle.vehicleNumber}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-500">{vehicle.type ?? <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => toggleVehicleActive(vehicle)}
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${vehicle.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}>
                                  {vehicle.isActive ? "Active" : "Inactive"}
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => {
                                    setVModal({ mode: "edit", vehicle });
                                    setVNum(vehicle.vehicleNumber); setVType(vehicle.type ?? ""); setFormErr("");
                                  }} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                                  <button onClick={() => setDeleteTarget({ type: "vehicle", id: vehicle.id, label: `Vehicle "${vehicle.vehicleNumber}"` })}
                                    className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="px-6 py-2 text-xs text-slate-400 border-t border-slate-100">Showing {filtered.length} of {vehicles.length} vehicles</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
}
