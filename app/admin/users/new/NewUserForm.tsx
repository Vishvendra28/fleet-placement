"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "PLANNING_TEAM", label: "Planning Team" },
  { value: "PLACEMENT_TEAM", label: "Placement Team" },
  { value: "DRIVER_MANAGEMENT", label: "Driver Management" },
  { value: "MAINTENANCE_TEAM", label: "Maintenance Team" },
  { value: "STORE_AND_TYRE", label: "Store & Tyre" },
  { value: "KAM", label: "KAM" },
  { value: "ADMIN", label: "Admin" },
];

export default function NewUserForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "PLANNING_TEAM" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("All fields are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Ravi Kumar"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="user@company.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder="Minimum 6 characters"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
        <select
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating…" : "Create User"}
        </button>
        <a href="/admin" className="text-sm text-gray-500 hover:underline">Cancel</a>
      </div>
    </form>
  );
}
