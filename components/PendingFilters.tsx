"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Props = {
  clients: { id: string; name: string }[];
  routes: { id: string; name: string }[];
};

const ISSUE_OPTIONS = [
  { value: "", label: "All Issues" },
  { value: "driver", label: "Driver Issue" },
  { value: "maintenance", label: "Maintenance Issue" },
  { value: "placement", label: "Placement Check Issue" },
];

export default function PendingFilters({ clients, routes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const inputCls =
    "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Date */}
      <input
        type="date"
        defaultValue={searchParams.get("date") ?? ""}
        onChange={(e) => set("date", e.target.value)}
        className={inputCls}
      />

      {/* Client */}
      <select
        defaultValue={searchParams.get("client") ?? ""}
        onChange={(e) => set("client", e.target.value)}
        className={inputCls}
      >
        <option value="">All Clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Route */}
      <select
        defaultValue={searchParams.get("route") ?? ""}
        onChange={(e) => set("route", e.target.value)}
        className={inputCls}
      >
        <option value="">All Routes</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {/* Issue type */}
      <select
        defaultValue={searchParams.get("issue") ?? ""}
        onChange={(e) => set("issue", e.target.value)}
        className={inputCls}
      >
        {ISSUE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear */}
      {(searchParams.get("date") || searchParams.get("client") || searchParams.get("route") || searchParams.get("issue")) && (
        <button
          onClick={() => router.replace(pathname)}
          className="h-9 px-3 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
