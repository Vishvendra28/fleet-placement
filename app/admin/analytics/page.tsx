import { prisma } from "@/lib/prisma";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";
import Link from "next/link";
import BackButton from "@/components/BackButton";

export default async function AnalyticsPage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [placements, issueAlerts, openIssuesCount] = await Promise.all([
    prisma.placement.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: {
        date: true, finalStatus: true, clientId: true,
        client: { select: { name: true } },
      },
    }),
    prisma.issueAlert.findMany({
      where: { raisedAt: { gte: thirtyDaysAgo } },
      select: { issueCategory: true, issueValue: true, status: true },
    }),
    prisma.issueAlert.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  // Daily counts (last 14 days)
  const dailyMap = new Map<string, { PLACED: number; PENDING: number; NOT_PLACED: number }>();
  for (const p of placements) {
    const d = new Date(p.date).toISOString().split("T")[0];
    if (!dailyMap.has(d)) dailyMap.set(d, { PLACED: 0, PENDING: 0, NOT_PLACED: 0 });
    dailyMap.get(d)![p.finalStatus as "PLACED" | "PENDING" | "NOT_PLACED"]++;
  }
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, c]) => ({ date, ...c, total: c.PLACED + c.PENDING + c.NOT_PLACED }));

  const maxTotal = Math.max(...dailyData.map((d) => d.total), 1);

  // Summary
  const total = placements.length;
  const placed = placements.filter((p) => p.finalStatus === "PLACED").length;
  const notPlaced = placements.filter((p) => p.finalStatus === "NOT_PLACED").length;
  const rate = total > 0 ? Math.round((placed / total) * 100) : 0;

  // Top issues
  const issueCount = new Map<string, number>();
  for (const a of issueAlerts) {
    issueCount.set(a.issueValue, (issueCount.get(a.issueValue) || 0) + 1);
  }
  const topIssues = Array.from(issueCount.entries()).sort(([, a], [, b]) => b - a).slice(0, 8);
  const maxIssue = topIssues[0]?.[1] || 1;

  // Client performance
  const clientMap = new Map<string, { name: string; total: number; notPlaced: number; placed: number }>();
  for (const p of placements) {
    if (!clientMap.has(p.clientId)) clientMap.set(p.clientId, { name: p.client.name, total: 0, notPlaced: 0, placed: 0 });
    const c = clientMap.get(p.clientId)!;
    c.total++;
    if (p.finalStatus === "NOT_PLACED") c.notPlaced++;
    if (p.finalStatus === "PLACED") c.placed++;
  }
  const clientPerf = Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days — operational performance</p>
        </div>
        <BackButton />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Placements", value: total, color: "border-blue-200 bg-blue-50 text-blue-700" },
          { label: "Placement Rate", value: `${rate}%`, color: "border-green-200 bg-green-50 text-green-700" },
          { label: "Not Placed", value: notPlaced, color: "border-red-200 bg-red-50 text-red-700" },
          { label: "Open Issues", value: openIssuesCount, color: "border-orange-200 bg-orange-50 text-orange-700" },
        ].map((t) => (
          <div key={t.label} className={`border-2 rounded-xl p-5 ${t.color}`}>
            <p className="text-3xl font-bold">{t.value}</p>
            <p className="text-sm font-semibold mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Daily Trend — Last 14 Days</h2>
        {dailyData.length === 0 ? (
          <p className="text-sm text-gray-400">No placement data yet</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-2 min-w-[560px]" style={{ height: "180px" }}>
                {dailyData.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col-reverse gap-px" style={{ height: "150px" }}>
                      <div
                        style={{ height: `${(d.PLACED / maxTotal) * 150}px` }}
                        className="bg-green-400 rounded-t-sm min-h-0"
                        title={`Placed: ${d.PLACED}`}
                      />
                      <div
                        style={{ height: `${(d.PENDING / maxTotal) * 150}px` }}
                        className="bg-yellow-400 min-h-0"
                        title={`Pending: ${d.PENDING}`}
                      />
                      <div
                        style={{ height: `${(d.NOT_PLACED / maxTotal) * 150}px` }}
                        className="bg-red-400 rounded-t-sm min-h-0"
                        title={`Not Placed: ${d.NOT_PLACED}`}
                      />
                    </div>
                    <span className="text-xs text-gray-400 mt-2 rotate-45 origin-left">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-5 mt-6 text-xs text-gray-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Placed</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />Pending</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Not Placed</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top issues */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top Issues (30 days)</h2>
          {topIssues.length === 0 ? (
            <p className="text-sm text-gray-400">No issues recorded yet</p>
          ) : (
            <div className="space-y-3">
              {topIssues.map(([key, count]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{ISSUE_VALUE_LABELS[key] || key}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-orange-400 rounded-full"
                      style={{ width: `${(count / maxIssue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Client Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500 bg-gray-50">
                  <th className="px-3 py-2 text-left border-b">Client</th>
                  <th className="px-3 py-2 text-center border-b">Total</th>
                  <th className="px-3 py-2 text-center border-b">Placed</th>
                  <th className="px-3 py-2 text-center border-b text-red-600">Missed</th>
                </tr>
              </thead>
              <tbody>
                {clientPerf.map((c) => (
                  <tr key={c.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{c.total}</td>
                    <td className="px-3 py-2 text-center text-green-700 font-medium">{c.placed}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={c.notPlaced > 0 ? "text-red-600 font-semibold" : "text-gray-400"}>
                        {c.notPlaced}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
