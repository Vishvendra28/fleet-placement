import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlacementTable from "@/components/PlacementTable";
import DashboardAlerts from "@/components/DashboardAlerts";
import BackButton from "@/components/BackButton";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", PLANNING_TEAM: "Planning Team", PLACEMENT_TEAM: "Placement Team",
  DRIVER_MANAGEMENT: "Driver Management", MAINTENANCE_TEAM: "Maintenance Team",
  STORE_AND_TYRE: "Store & Tyre", E_LOCK_TEAM: "E-Lock Team", KAM: "KAM",
};

export default async function DashboardPage({ searchParams }: { searchParams: { date?: string } }) {
  const session = await getServerSession(authOptions);
  const today = new Date().toISOString().split("T")[0];
  const exportDate = searchParams.date ?? today;

  const weekAgo = new Date(Date.now() - 6 * 86400000);
  weekAgo.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date();
  rangeEnd.setUTCHours(0, 0, 0, 0);
  rangeEnd.setDate(rangeEnd.getDate() + 2); // include tomorrow's planned trips

  const placementSelect = {
    id: true, date: true, cohort: true, laneType: true, placementTime: true,
    finalStatus: true, compliance: true, driverNumber1: true, driverNumber2: true,
    client: { select: { name: true } },
    route: { select: { name: true } },
    vehicle: { select: { id: true, vehicleNumber: true } },
    d1Remark: { select: { driverIssue: true, maintenanceIssue: true } },
    sameDayRemark: { select: { driverIssue: true, maintenanceIssue: true } },
    placementTeamRemark: { select: { elockStatus: true, idfyDrivers: true, cargoNet: true, tirpal: true, stepney: true } },
    issueAlerts: { select: { status: true } },
  };

  if (session?.user.role !== "ADMIN") {
    const nonAdminWhere: Record<string, unknown> = { date: { gte: weekAgo, lt: rangeEnd } };
    if (session!.user.role === "KAM") nonAdminWhere.client = { kamId: session!.user.id };

    const rawPlacements = await prisma.placement.findMany({
      where: nonAdminWhere,
      select: placementSelect,
      orderBy: [{ date: "asc" }, { placementTime: "asc" }],
    });
    const placements = JSON.parse(JSON.stringify(rawPlacements)) as unknown[];

    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Daily Placements</h1>
              <p className="text-sm text-slate-500 mt-0.5">{ROLE_LABELS[session?.user.role ?? ""] ?? session?.user.role}</p>
            </div>
          </div>
          {session?.user.role === "PLANNING_TEAM" && (
            <Link
              href="/placements/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Trip
            </Link>
          )}
        </div>
        <DashboardAlerts userRole={session!.user.role} />
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <PlacementTable userRole={session!.user.role} initialPlacements={placements} />
        </div>
      </div>
    );
  }

  const [activeIssuesCount, rawPlacements] = await Promise.all([
    prisma.issueAlert.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.placement.findMany({
      where: { date: { gte: weekAgo, lt: rangeEnd } },
      select: placementSelect,
      orderBy: [{ date: "asc" }, { placementTime: "asc" }],
    }),
  ]);

  const placements = JSON.parse(JSON.stringify(rawPlacements)) as unknown[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Admin Dashboard</p>
            <h1 className="text-2xl font-bold text-slate-900">Fleet Overview</h1>
          </div>
        </div>
        <Link
          href="/placements/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Trip
        </Link>
      </div>

      {/* Role-based alerts */}
      <DashboardAlerts userRole="ADMIN" />

      {/* Placements */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Placements</h2>
          <div className="flex items-center gap-4">
            <a
              href={`/api/placements/export?date=${exportDate}`}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </a>
            <Link href="/admin/placements/new" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              + New Trip
            </Link>
          </div>
        </div>
        <div className="p-5">
          <PlacementTable
            userRole="ADMIN"
            activeIssuesCount={activeIssuesCount}
            initialPlacements={placements}
          />
        </div>
      </div>
    </div>
  );
}
