import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCHEDULE_TIMES } from "@/lib/schedule";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const dateStr = sp.get("date");

    let dateFilter: { date: { gte: Date; lt: Date } };
    if (fromStr && toStr) {
      const from = new Date(fromStr);
      const to = new Date(toStr);
      to.setDate(to.getDate() + 1); // inclusive end
      dateFilter = { date: { gte: from, lt: to } };
    } else {
      const date = new Date(dateStr ?? new Date().toISOString().split("T")[0]);
      const nextDay = new Date(date.getTime() + 86400000);
      dateFilter = { date: { gte: date, lt: nextDay } };
    }

    const where: Record<string, unknown> = { ...dateFilter };

    if (session.user.role === "KAM") {
      where.client = { kamId: session.user.id };
    }

    const placements = await prisma.placement.findMany({
      where,
      select: {
        id: true, date: true, cohort: true, laneType: true,
        placementTime: true, finalStatus: true, compliance: true,
        driverName1: true, driverNumber1: true, driverName2: true, driverNumber2: true,
        eta: true, statusComment: true, elockComment: true, referenceId: true,
        client: { select: { name: true } },
        route:  { select: { name: true } },
        vehicle: { select: { id: true, vehicleNumber: true } },
        d1Remark: { select: { driverIssue: true, maintenanceIssue: true } },
        sameDayRemark: { select: { driverIssue: true, maintenanceIssue: true } },
        placementTeamRemark: { select: { elockStatus: true, idfyDrivers: true, cargoNet: true, tirpal: true, stepney: true } },
        issueAlerts: { select: { id: true, status: true, issueCategory: true, issueValue: true, source: true } },
      },
      orderBy: [{ date: "asc" }, { placementTime: "asc" }],
    });

    return NextResponse.json(placements);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { date, clientId, routeId, cohort, laneType, vehicleId, driverNumber1, driverNumber2 } = await req.json();

    if (!vehicleId) return NextResponse.json({ error: "Vehicle is required." }, { status: 400 });

    const dateObj = new Date(date);
    const nextDay = new Date(dateObj.getTime() + 86400000);

    try {
      const placement = await prisma.$transaction(async (tx) => {
        const existing = await tx.placement.findFirst({
          where: { vehicleId, date: { gte: dateObj, lt: nextDay } },
          select: { client: { select: { name: true } }, route: { select: { name: true } } },
        });
        if (existing) {
          throw Object.assign(
            new Error(`Vehicle already assigned to ${existing.client.name} — ${existing.route.name} on this date.`),
            { status: 409 }
          );
        }

        const dupeTrip = await tx.placement.findFirst({
          where: { clientId, routeId, laneType, date: { gte: dateObj, lt: nextDay } },
          include: { vehicle: { select: { vehicleNumber: true } } },
        });
        if (dupeTrip) {
          throw Object.assign(
            new Error(`A ${laneType} lane trip already exists for this client on this route on this date (vehicle: ${dupeTrip.vehicle?.vehicleNumber ?? "unassigned"}).`),
            { status: 409 }
          );
        }

        const masterRoute = await tx.masterRoute.findFirst({
          where: { clientId, routeId, isActive: true },
          select: { compliance: true, placementTime: true },
        });
        const compliance = masterRoute?.compliance ?? null;

        let utcHours: number, utcMinutes: number;
        if (masterRoute?.placementTime) {
          // MasterRoute.placementTime is in IST (e.g. "22:00" = 10 PM IST) — convert to UTC
          const [h, m] = masterRoute.placementTime.split(":").map(Number);
          const totalUTC = ((h * 60 + m - 330) % 1440 + 1440) % 1440;
          utcHours = Math.floor(totalUTC / 60);
          utcMinutes = totalUTC % 60;
        } else {
          // SCHEDULE_TIMES are already in UTC
          const timeStr = SCHEDULE_TIMES[cohort] ?? "09:00";
          [utcHours, utcMinutes] = timeStr.split(":").map(Number);
        }
        const placementTime = new Date(`${date}T00:00:00Z`);
        placementTime.setUTCHours(utcHours, utcMinutes, 0, 0);
        const cutoffTime = new Date(placementTime.getTime() - 3 * 60 * 60 * 1000);

        return tx.placement.create({
          data: {
            date: dateObj,
            clientId, routeId, cohort, laneType, vehicleId,
            placementTime, cutoffTime, compliance,
            driverNumber1: driverNumber1?.trim() || null,
            driverNumber2: driverNumber2?.trim() || null,
            createdById: session.user.id,
          },
          select: {
            id: true,
            client: { select: { name: true } },
            route: { select: { name: true } },
            vehicle: { select: { vehicleNumber: true } },
          },
        });
      }, { isolationLevel: "Serializable" });

      await logAudit({
        userId: session.user.id,
        action: "CREATED",
        entity: "PLACEMENT",
        entityId: placement.id,
        description: `${session.user.name} created placement: ${placement.client.name} — ${placement.route.name} (${placement.vehicle?.vehicleNumber ?? "no vehicle"})`,
        placementId: placement.id,
      });

      return NextResponse.json(placement, { status: 201 });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: string };
      if (e.status) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e.code === "P2034") return NextResponse.json({ error: "Conflict: please retry." }, { status: 409 });
      throw err;
    }
  } catch (err) {
    return apiError(err);
  }
}
