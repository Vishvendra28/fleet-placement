import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCHEDULE_TIMES } from "@/lib/schedule";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

type TripInput = {
  clientId: string;
  routeId: string;
  cohort: string;
  laneType: "FW" | "RET";
  vehicleId: string;
  driverName1?: string;
  driverNumber1?: string;
  driverName2?: string;
  driverNumber2?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PLANNING_TEAM")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { date, trips } = await req.json() as { date: string; trips: TripInput[] };

    if (!date || !Array.isArray(trips) || trips.length === 0) {
      return NextResponse.json({ error: "date and at least one trip are required." }, { status: 400 });
    }

    for (let i = 0; i < trips.length; i++) {
      if (!trips[i].vehicleId) {
        return NextResponse.json({ error: `Trip ${i + 1}: Vehicle is required.` }, { status: 400 });
      }
    }

    const dateObj = new Date(date);
    const nextDay = new Date(dateObj.getTime() + 86400000);

    try {
      const placements = await prisma.$transaction(async (tx) => {
        const results = [];

        for (let i = 0; i < trips.length; i++) {
          const trip = trips[i];
          const tripNum = i + 1;

          const existingVehicle = await tx.placement.findFirst({
            where: { vehicleId: trip.vehicleId, date: { gte: dateObj, lt: nextDay } },
            select: { client: { select: { name: true } }, route: { select: { name: true } } },
          });
          if (existingVehicle) {
            throw Object.assign(
              new Error(`Trip ${tripNum}: Vehicle already assigned to ${existingVehicle.client.name} — ${existingVehicle.route.name} on this date.`),
              { status: 409 }
            );
          }

          const dupeTrip = await tx.placement.findFirst({
            where: { clientId: trip.clientId, routeId: trip.routeId, laneType: trip.laneType, date: { gte: dateObj, lt: nextDay } },
            include: { vehicle: { select: { vehicleNumber: true } } },
          });
          if (dupeTrip) {
            throw Object.assign(
              new Error(`Trip ${tripNum}: A ${trip.laneType} trip already exists for this client/route on this date (vehicle: ${dupeTrip.vehicle?.vehicleNumber ?? "unassigned"}).`),
              { status: 409 }
            );
          }

          const masterRoute = await tx.masterRoute.findFirst({
            where: { clientId: trip.clientId, routeId: trip.routeId, isActive: true },
            select: { compliance: true, placementTime: true },
          });

          let utcHours: number, utcMinutes: number;
          if (masterRoute?.placementTime) {
            // MasterRoute.placementTime is in IST (e.g. "22:00" = 10 PM IST) — convert to UTC
            const [h, m] = masterRoute.placementTime.split(":").map(Number);
            const totalUTC = ((h * 60 + m - 330) % 1440 + 1440) % 1440;
            utcHours = Math.floor(totalUTC / 60);
            utcMinutes = totalUTC % 60;
          } else {
            // SCHEDULE_TIMES are already in UTC
            const timeStr = SCHEDULE_TIMES[trip.cohort] ?? "09:00";
            [utcHours, utcMinutes] = timeStr.split(":").map(Number);
          }
          const placementTime = new Date(`${date}T00:00:00Z`);
          placementTime.setUTCHours(utcHours, utcMinutes, 0, 0);
          const cutoffTime = new Date(placementTime.getTime() - 3 * 60 * 60 * 1000);

          const placement = await tx.placement.create({
            data: {
              date: dateObj,
              clientId: trip.clientId,
              routeId: trip.routeId,
              cohort: trip.cohort,
              laneType: trip.laneType,
              vehicleId: trip.vehicleId,
              placementTime,
              cutoffTime,
              compliance: masterRoute?.compliance ?? null,
              driverName1: trip.driverName1?.trim() || null,
              driverNumber1: trip.driverNumber1?.trim() || null,
              driverName2: trip.driverName2?.trim() || null,
              driverNumber2: trip.driverNumber2?.trim() || null,
              createdById: session.user.id,
            },
            select: {
              id: true,
              client: { select: { name: true } },
              route: { select: { name: true } },
              vehicle: { select: { vehicleNumber: true } },
            },
          });

          results.push(placement);
        }

        return results;
      }, { isolationLevel: "Serializable" });

      for (const p of placements) {
        await logAudit({
          userId: session.user.id,
          action: "CREATED",
          entity: "PLACEMENT",
          entityId: p.id,
          description: `${session.user.name} created placement: ${p.client.name} — ${p.route.name} (${p.vehicle?.vehicleNumber ?? "no vehicle"})`,
          placementId: p.id,
        });
      }

      return NextResponse.json(placements, { status: 201 });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: string };
      if (e.status) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e.code === "P2034") return NextResponse.json({ error: "Conflict: another request modified the data. Please retry." }, { status: 409 });
      throw err;
    }
  } catch (err) {
    return apiError(err);
  }
}
