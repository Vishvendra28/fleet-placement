"use client";
import { useEffect, useState, useCallback } from "react";
import BackButton from "@/components/BackButton";

type Log = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string; role: string };
};

const ENTITY_COLOR: Record<string, string> = {
  PLACEMENT: "bg-blue-100 text-blue-700",
  ISSUE: "bg-rose-100 text-rose-700",
  USER: "bg-purple-100 text-purple-700",
  CLIENT: "bg-emerald-100 text-emerald-700",
  VEHICLE: "bg-orange-100 text-orange-700",
  ROUTE: "bg-indigo-100 text-indigo-700",
};

const ACTION_COLOR: Record<string, string> = {
  CREATED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATED: "bg-amber-50 text-amber-700 border-amber-200",
  DELETED: "bg-red-50 text-red-700 border-red-200",
  STATUS_CHANGED: "bg-blue-50 text-blue-700 border-blue-200",
  REMARK_UPDATED: "bg-slate-50 text-slate-600 border-slate-200",
  ISSUE_RAISED: "bg-rose-50 text-rose-700 border-rose-200",
  COMMENT_ADDED: "bg-violet-50 text-violet-700 border-violet-200",
};

const ENTITIES = ["ALL", "PLACEMENT", "ISSUE", "USER", "CLIENT", "VEHICLE", "ROUTE"];

function formatValue(raw: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(" · ");
  } catch {
    return raw;
  }
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entity, setEntity] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/history?entity=${entity}&page=${page}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    }
    setLoading(false);
  }, [entity, page]);

  useEffect(() => { load(); }, [load]);

  function handleEntity(e: string) { setEntity(e); setPage(1); }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">Activity History</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every change made in the system — who did what and when</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-slate-500">Filter by</span>
        <div className="flex gap-2 flex-wrap">
          {ENTITIES.map((e) => (
            <button
              key={e}
              onClick={() => handleEntity(e)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                entity === e
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {e === "ALL" ? "All Events" : e}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-slate-400 font-medium">{total} events</span>
      </div>

      {/* Log list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading history…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-base font-semibold text-slate-600">No events found</p>
            <p className="text-sm mt-1">Actions will appear here as users interact with the system.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className="w-2 h-2 rounded-full bg-slate-300 mt-2 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ENTITY_COLOR[log.entity] ?? "bg-slate-100 text-slate-600"}`}>
                        {log.entity}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${ACTION_COLOR[log.action] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{log.user.name}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 leading-snug">{log.description}</p>

                    {(log.oldValue || log.newValue) && (
                      <div className="mt-2 flex gap-3 flex-wrap text-xs">
                        {log.oldValue && (
                          <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 font-mono">
                            Before: {formatValue(log.oldValue)}
                          </span>
                        )}
                        {log.newValue && (
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                            After: {formatValue(log.newValue)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
