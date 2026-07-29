import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DRIVER_ISSUE_LABELS, MAINTENANCE_ISSUE_LABELS, ELOCK_STATUS_LABELS,
  IDFY_STATUS_LABELS, EQUIPMENT_STATUS_LABELS, FINAL_STATUS_LABELS, LANE_TYPE_LABELS,
} from "@/lib/constants";

function esc(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const date = new Date(dateStr);
  const nextDay = new Date(date.getTime() + 86400000);

  const placements = await prisma.placement.findMany({
    where: { date: { gte: date, lt: nextDay } },
    include: {
      client: true,
      route: true,
      vehicle: true,
      d1Remark: true,
      sameDayRemark: true,
      placementTeamRemark: true,
    },
    orderBy: { placementTime: "asc" },
  });

  const headers = [
    "Date", "Client", "Route", "Cohort", "Lane Type", "Vehicle",
    "Placement Time", "Cutoff Time", "Final Status",
    "D1 Driver Issue", "D1 Maintenance Issue",
    "SameDay Driver Issue", "SameDay Maintenance Issue",
    "E-Lock Status", "IDFY Status", "Cargo Net", "Tirpal", "Stepney",
  ];

  const rows = placements.map((p) => [
    dateStr,
    p.client.name,
    p.route.name,
    p.cohort,
    LANE_TYPE_LABELS[p.laneType] || p.laneType,
    p.vehicle?.vehicleNumber || "",
    new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    new Date(p.cutoffTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    FINAL_STATUS_LABELS[p.finalStatus] || p.finalStatus,
    DRIVER_ISSUE_LABELS[p.d1Remark?.driverIssue ?? ""] || "",
    MAINTENANCE_ISSUE_LABELS[p.d1Remark?.maintenanceIssue ?? ""] || "",
    DRIVER_ISSUE_LABELS[p.sameDayRemark?.driverIssue ?? ""] || "",
    MAINTENANCE_ISSUE_LABELS[p.sameDayRemark?.maintenanceIssue ?? ""] || "",
    ELOCK_STATUS_LABELS[p.placementTeamRemark?.elockStatus ?? ""] || "",
    IDFY_STATUS_LABELS[p.placementTeamRemark?.idfyDrivers ?? ""] || "",
    EQUIPMENT_STATUS_LABELS[p.placementTeamRemark?.cargoNet ?? ""] || "",
    EQUIPMENT_STATUS_LABELS[p.placementTeamRemark?.tirpal ?? ""] || "",
    EQUIPMENT_STATUS_LABELS[p.placementTeamRemark?.stepney ?? ""] || "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(esc).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="placements-${dateStr}.csv"`,
    },
  });
}
