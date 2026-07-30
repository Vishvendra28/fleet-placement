import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import PendingFilters from "@/components/PendingFilters";
import BackButton from "@/components/BackButton";
import { DRIVER_ISSUE_LABELS, MAINTENANCE_ISSUE_LABELS, ELOCK_STATUS_LABELS, IDFY_STATUS_LABELS, EQUIPMENT_STATUS_LABELS } from "@/lib/constants";

const STATUS_COLOR: Record<string, string> = {
  PLACED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  NOT_PLACED: "bg-red-100 text-red-700",
};

type SearchParams = { date?: string; client?: string; route?: string; issue?: string };

export default async function SameDayPendingPage({ searchParams }: { searchParams: SearchParams }) {
  const { date, client, route, issue } = searchParams;

  const where: Record<string, unknown> = {
    sameDayRemark: {
      is:
        issue === "driver"
          ? { driverIssue: { in: ["SINGLE_DRIVER", "DENYING_FOR_LOAD", "DRIVER_NOT_AVAILABLE"] } }
          : issue === "maintenance"
          ? { maintenanceIssue: { in: ["KAMANI_WORK", "BATTERY_WORK", "TYRE_AND_ALIGNMENT", "ELECTRICAL_AND_MECHANICAL", "MILEAGE_ISSUE", "VARIOUS_ISSUES"] } }
          : {
              OR: [
                { driverIssue: { in: ["SINGLE_DRIVER", "DENYING_FOR_LOAD", "DRIVER_NOT_AVAILABLE"] } },
                { maintenanceIssue: { in: ["KAMANI_WORK", "BATTERY_WORK", "TYRE_AND_ALIGNMENT", "ELECTRICAL_AND_MECHANICAL", "MILEAGE_ISSUE", "VARIOUS_ISSUES"] } },
              ],
            },
    },
  };

  if (date) {
    const d = new Date(date);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    where.date = { gte: d, lt: next };
  } else {
    const past = new Date(); past.setDate(past.getDate() - 3); past.setUTCHours(0, 0, 0, 0);
    const future = new Date(); future.setDate(future.getDate() + 7); future.setUTCHours(23, 59, 59, 999);
    where.date = { gte: past, lte: future };
  }
  if (client) where.clientId = client;
  if (route) where.routeId = route;

  const [placements, clients, routes] = await Promise.all([
    prisma.placement.findMany({
      where,
      select: {
        id: true,
        date: true,
        placementTime: true,
        finalStatus: true,
        client: { select: { name: true } },
        route: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
        sameDayRemark: {
          select: {
            driverIssue: true,
            maintenanceIssue: true,
            filledAt: true,
            filledBy: { select: { name: true } },
          },
        },
        placementTeamRemark: {
          select: {
            elockStatus: true,
            idfyDrivers: true,
            cargoNet: true,
            tirpal: true,
            stepney: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { placementTime: "asc" }],
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.route.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const filtered = issue === "placement"
    ? placements.filter((p) => {
        const ptr = p.placementTeamRemark;
        return ptr && (
          ptr.elockStatus === "UNHEALTHY" || ptr.elockStatus === "LOCK_DAMAGE" ||
          ptr.idfyDrivers === "REQUIRED_NOT_AVAILABLE" ||
          ptr.cargoNet === "NOT_AVAILABLE" || ptr.tirpal === "NOT_AVAILABLE" || ptr.stepney === "NOT_AVAILABLE"
        );
      })
    : placements;

  const driverCount = filtered.filter((p) => p.sameDayRemark?.driverIssue && p.sameDayRemark.driverIssue !== "NO_ISSUE").length;
  const maintCount = filtered.filter((p) => p.sameDayRemark?.maintenanceIssue && p.sameDayRemark.maintenanceIssue !== "NO_ISSUE").length;
  const unplacedCount = filtered.filter((p) => p.finalStatus !== "PLACED").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Same Day Pending Issues</h1>
            <p className="text-sm text-gray-500 mt-0.5">Issues flagged on the day of placement · {filtered.length} trip{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-semibold">{driverCount} Driver</span>
          <span className="px-3 py-1.5 bg-pink-50 text-pink-700 border border-pink-200 rounded-lg font-semibold">{maintCount} Maintenance</span>
          <span className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold">{unplacedCount} Unplaced</span>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <PendingFilters clients={clients} routes={routes} />
      </Suspense>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 font-semibold">No same day issues found</p>
          <p className="text-sm text-gray-400 mt-1">Try clearing your filters or check back when the planning team logs issues</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Client</th>
                  <th className="px-3 py-2.5 text-left">Route</th>
                  <th className="px-3 py-2.5 text-left">Vehicle</th>
                  <th className="px-3 py-2.5 text-left">Time</th>
                  <th className="px-3 py-2.5 text-left">Issues</th>
                  <th className="px-3 py-2.5 text-left text-emerald-700">Placement Check</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-left">By</th>
                  <th className="px-3 py-2.5 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => {
                  const ptr = p.placementTeamRemark;
                  const hasCheckIssue =
                    ptr?.elockStatus === "UNHEALTHY" || ptr?.elockStatus === "LOCK_DAMAGE" ||
                    ptr?.idfyDrivers === "REQUIRED_NOT_AVAILABLE" ||
                    ptr?.cargoNet === "NOT_AVAILABLE" || ptr?.tirpal === "NOT_AVAILABLE" || ptr?.stepney === "NOT_AVAILABLE";

                  const checkBadges = ptr ? [
                    ptr.elockStatus && { label: `E-Lock: ${ELOCK_STATUS_LABELS[ptr.elockStatus]}`, bad: ptr.elockStatus !== "HEALTHY" },
                    ptr.idfyDrivers && ptr.idfyDrivers !== "NOT_REQUIRED" && { label: `IDFY: ${IDFY_STATUS_LABELS[ptr.idfyDrivers]}`, bad: ptr.idfyDrivers === "REQUIRED_NOT_AVAILABLE" },
                    ptr.cargoNet && { label: `Net: ${EQUIPMENT_STATUS_LABELS[ptr.cargoNet]}`, bad: ptr.cargoNet === "NOT_AVAILABLE" },
                    ptr.tirpal && { label: `Tirpal: ${EQUIPMENT_STATUS_LABELS[ptr.tirpal]}`, bad: ptr.tirpal === "NOT_AVAILABLE" },
                    ptr.stepney && { label: `Stepney: ${EQUIPMENT_STATUS_LABELS[ptr.stepney]}`, bad: ptr.stepney === "NOT_AVAILABLE" },
                  ].filter(Boolean) as { label: string; bad: boolean }[] : [];

                  return (
                    <tr key={p.id} className="hover:bg-yellow-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap text-xs">
                        {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.client.name}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.route.name}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700 text-xs whitespace-nowrap">{p.vehicle?.vehicleNumber ?? "—"}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                        {new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {p.sameDayRemark?.driverIssue && p.sameDayRemark.driverIssue !== "NO_ISSUE" && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">
                              {DRIVER_ISSUE_LABELS[p.sameDayRemark.driverIssue]}
                            </span>
                          )}
                          {p.sameDayRemark?.maintenanceIssue && p.sameDayRemark.maintenanceIssue !== "NO_ISSUE" && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 whitespace-nowrap">
                              {MAINTENANCE_ISSUE_LABELS[p.sameDayRemark.maintenanceIssue]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {!ptr ? (
                          <span className="text-xs text-gray-400 italic">—</span>
                        ) : checkBadges.length === 0 ? (
                          <span className="text-xs text-emerald-600 font-semibold">All OK</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {checkBadges.map((b) => (
                              <span key={b.label} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${b.bad ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {b.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[p.finalStatus]}`}>
                          {p.finalStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        <p>{p.sameDayRemark?.filledBy?.name ?? "—"}</p>
                        {p.sameDayRemark?.filledAt && (
                          <p className="text-gray-400">{new Date(p.sameDayRemark.filledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {(hasCheckIssue || p.finalStatus !== "PLACED") && p.vehicle && (
                          <Link
                            href={`/issues?vehicle=${encodeURIComponent(p.vehicle.vehicleNumber)}`}
                            className="text-xs font-semibold px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                          >
                            Resolve →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
