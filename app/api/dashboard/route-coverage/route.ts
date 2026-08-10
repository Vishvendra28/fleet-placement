import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Valid date (YYYY-MM-DD) required" }, { status: 400 });
  }

  const d = new Date(dateParam + "T00:00:00.000Z");
  const nextDay = new Date(d);
  nextDay.setDate(nextDay.getDate() + 1);

  const [allRoutes, placements] = await Promise.all([
    prisma.route.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.placement.findMany({
      where: { date: { gte: d, lt: nextDay } },
      select: {
        id: true,
        routeId: true,
        laneType: true,
        cohort: true,
        vehicleId: true,
        driverNumber1: true,
        client: { select: { name: true } },
        route: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    }),
  ]);

  // Group by routeId, collect unique vehicle numbers per route
  const routeVehicles = new Map<string, Set<string>>();
  for (const p of placements) {
    if (!routeVehicles.has(p.routeId)) routeVehicles.set(p.routeId, new Set());
    if (p.vehicle?.vehicleNumber) routeVehicles.get(p.routeId)!.add(p.vehicle.vehicleNumber);
  }

  const plannedRoutes: { id: string; name: string; vehicles: string[] }[] = [];
  const notPlannedRoutes: { id: string; name: string }[] = [];

  for (const route of allRoutes) {
    if (routeVehicles.has(route.id)) {
      plannedRoutes.push({ id: route.id, name: route.name, vehicles: Array.from(routeVehicles.get(route.id)!) });
    } else {
      notPlannedRoutes.push({ id: route.id, name: route.name });
    }
  }

  // Trip-level assignment stats
  const totalPlanned = placements.length;
  const assignedTrips = placements.filter(p => p.vehicleId && p.driverNumber1).length;

  const unassignedTrips = placements
    .filter(p => !p.vehicleId || !p.driverNumber1)
    .map(p => ({
      id: p.id,
      clientName: p.client.name,
      routeName: p.route.name,
      laneType: p.laneType,
      cohort: p.cohort,
      missingVehicle: !p.vehicleId,
      missingDriver: !p.driverNumber1,
    }));

  return NextResponse.json({
    date: dateParam,
    total: allRoutes.length,
    planned: plannedRoutes.length,
    notPlanned: notPlannedRoutes.length,
    plannedRoutes,
    notPlannedRoutes,
    totalPlanned,
    assignedTrips,
    unassignedTrips,
  });
}
