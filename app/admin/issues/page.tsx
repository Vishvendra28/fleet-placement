import { prisma } from "@/lib/prisma";
import { ISSUE_CATEGORY_LABELS, ISSUE_STATUS_LABELS, ISSUE_VALUE_LABELS } from "@/lib/constants";
import Link from "next/link";
import BackButton from "@/components/BackButton";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};
const CAT_COLOR: Record<string, string> = {
  DRIVER: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-pink-100 text-pink-700",
  EQUIPMENT: "bg-blue-100 text-blue-700",
};

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: { status?: string; category?: string };
}) {
  const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"];
  const VALID_CATEGORIES = ["DRIVER", "MAINTENANCE", "EQUIPMENT"];
  const where: Record<string, unknown> = {};
  if (searchParams.status && VALID_STATUSES.includes(searchParams.status)) where.status = searchParams.status;
  if (searchParams.category && VALID_CATEGORIES.includes(searchParams.category)) where.issueCategory = searchParams.category;

  const issues = await prisma.issueAlert.findMany({
    where,
    include: {
      placement: { include: { client: true, route: true, vehicle: true } },
      raisedBy: { select: { name: true, role: true } },
      resolvedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { raisedAt: "desc" }],
    take: 500,
  });

  const openCount = issues.filter((i) => i.status === "OPEN").length;
  const inProgressCount = issues.filter((i) => i.status === "IN_PROGRESS").length;
  const resolvedCount = issues.filter((i) => i.status === "RESOLVED").length;

  const activeStatus = searchParams.status || "ALL";
  const activeCategory = searchParams.category || "ALL";

  function filterLink(params: Record<string, string>) {
    const p = new URLSearchParams({ status: activeStatus, category: activeCategory, ...params });
    return `/admin/issues?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Issues</h1>
          <p className="text-sm text-gray-500 mt-0.5">Driver, maintenance and equipment issues across all placements</p>
        </div>
        <BackButton />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open", count: openCount, color: "border-red-200 bg-red-50 text-red-700" },
          { label: "In Progress", count: inProgressCount, color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
          { label: "Resolved", count: resolvedCount, color: "border-green-200 bg-green-50 text-green-700" },
        ].map((t) => (
          <div key={t.label} className={`border-2 rounded-xl p-4 ${t.color}`}>
            <p className="text-2xl font-bold">{t.count}</p>
            <p className="text-sm font-semibold">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1">
          {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <Link
              key={s}
              href={filterLink({ status: s })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "ALL" ? "All Status" : ISSUE_STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {["ALL", "DRIVER", "MAINTENANCE", "EQUIPMENT"].map((c) => (
            <Link
              key={c}
              href={filterLink({ category: c })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c === "ALL" ? "All Types" : ISSUE_CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>
      </div>

      {/* Issue list */}
      {issues.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No issues found with these filters.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b">
                <th className="px-4 py-3 text-left">Issue</th>
                <th className="px-4 py-3 text-left">Client / Route</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Raised By</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Resolved By</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${CAT_COLOR[issue.issueCategory]}`}>
                      {ISSUE_CATEGORY_LABELS[issue.issueCategory]}
                    </span>
                    <span className="font-medium text-gray-900">{ISSUE_VALUE_LABELS[issue.issueValue] || issue.issueValue}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <p className="font-medium">{issue.placement.client.name}</p>
                    <p className="text-xs text-gray-400">{issue.placement.route.name}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{issue.placement.vehicle?.vehicleNumber || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(issue.placement.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <p>{issue.raisedBy.name}</p>
                    <p className="text-xs text-gray-400">{new Date(issue.raisedAt).toLocaleString("en-IN")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[issue.status]}`}>
                      {ISSUE_STATUS_LABELS[issue.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {issue.resolvedBy ? (
                      <div>
                        <p>{issue.resolvedBy.name}</p>
                        {issue.resolutionNote && <p className="text-xs text-gray-400 max-w-[160px] truncate">{issue.resolutionNote}</p>}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
