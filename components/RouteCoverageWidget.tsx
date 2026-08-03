"use client";
import { useState, useEffect, useCallback } from "react";

type CoverageData = {
  date: string;
  total: number;
  planned: number;
  notPlanned: number;
  plannedRoutes: { id: string; name: string; vehicles: string[] }[];
  notPlannedRoutes: { id: string; name: string }[];
};

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function RouteCoverageWidget() {
  const [date, setDate] = useState(getTomorrow);
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/route-coverage?date=${date}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [date]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pct = data && data.total > 0 ? Math.round((data.planned / data.total) * 100) : 0;
  const barColor = pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500";

  return (
    <>
      {/* Widget card */}
      <div
        onClick={() => data && setModalOpen(true)}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Route Coverage</h3>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => { e.stopPropagation(); setDate(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse bg-slate-100 rounded-lg" />
            <div className="h-2 w-full animate-pulse bg-slate-100 rounded-full" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-3xl font-bold text-slate-900">{data.planned}</span>
              <span className="text-xl text-slate-400 mb-0.5">/ {data.total}</span>
              <span className="text-sm text-slate-500 mb-1 ml-0.5">routes planned</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={data.notPlanned === 0 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                {data.notPlanned === 0
                  ? "All routes planned!"
                  : `${data.notPlanned} route${data.notPlanned !== 1 ? "s" : ""} not yet planned`}
              </span>
              <span className="text-blue-500 font-medium">View details →</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Failed to load</p>
        )}
      </div>

      {/* Detail modal */}
      {modalOpen && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Route Coverage</h2>
                <p className="text-sm text-slate-500 mt-0.5">{formatDate(data.date)}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {data.planned} Planned
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    {data.notPlanned} Pending
                  </span>
                  <span className="text-xs text-slate-400">{pct}% covered</span>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Two-column body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Planned */}
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">
                  Planned ({data.planned})
                </p>
                <div className="space-y-2">
                  {data.plannedRoutes.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No routes planned yet</p>
                  ) : (
                    data.plannedRoutes.map((r) => (
                      <div key={r.id} className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                        {r.vehicles.length > 0 && (
                          <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                            {r.vehicles.join(" · ")}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Not planned */}
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">
                  Not Planned ({data.notPlanned})
                </p>
                <div className="space-y-2">
                  {data.notPlannedRoutes.length === 0 ? (
                    <p className="text-sm text-slate-600 font-medium">All routes covered ✓</p>
                  ) : (
                    data.notPlannedRoutes.map((r) => (
                      <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
