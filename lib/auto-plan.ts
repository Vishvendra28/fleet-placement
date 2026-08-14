import { prisma } from "@/lib/prisma";
import { is2WaySchedule } from "@/lib/schedule";

// Core: plan all active MasterRoutes for any given date (idempotent)
export async function planForDate(dateStr: string): Promise<{ created: number }> {
  const dateStart = new Date(dateStr + "T00:00:00Z");
  const dateEnd = new Date(dateStart.getTime() + 86400000);

  const [masterRoutes, adminUser] = await Promise.all([
    prisma.masterRoute.findMany({
      where: { isActive: true },
      include: { route: { select: { id: true, origin: true, destination: true } } },
    }),
    prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }),
  ]);

  if (!masterRoutes.length || !adminUser) return { created: 0 };

  let created = 0;

  for (const mr of masterRoutes) {
    const [h, m] = mr.placementTime.split(":").map(Number);
    const totalUTC = ((h * 60 + m - 330) % 1440 + 1440) % 1440;
    const placementTime = new Date(dateStr + "T00:00:00Z");
    placementTime.setUTCHours(Math.floor(totalUTC / 60), totalUTC % 60, 0, 0);
    const cutoffTime = new Date(placementTime.getTime() - 3 * 60 * 60 * 1000);

    const fwExists = await prisma.placement.findFirst({
      where: { clientId: mr.clientId, routeId: mr.routeId, laneType: "FW", placementTime, date: { gte: dateStart, lt: dateEnd } },
    });
    if (!fwExists) {
      await prisma.placement.create({
        data: { date: dateStart, clientId: mr.clientId, routeId: mr.routeId, cohort: mr.cohort, laneType: "FW", placementTime, cutoffTime, compliance: mr.compliance, createdById: adminUser.id },
      });
      created++;
    }

    if (is2WaySchedule(mr.cohort)) {
      const retExists = await prisma.placement.findFirst({
        where: { clientId: mr.clientId, routeId: mr.routeId, laneType: "RET", placementTime, date: { gte: dateStart, lt: dateEnd } },
      });
      if (!retExists) {
        await prisma.placement.create({
          data: { date: dateStart, clientId: mr.clientId, routeId: mr.routeId, cohort: mr.cohort, laneType: "RET", placementTime, cutoffTime, compliance: mr.compliance, createdById: adminUser.id },
        });
        created++;
      }
    }
  }

  return { created };
}

// Daily auto-plan: runs on admin dashboard load for tomorrow + 7-day backfill
export async function autoPlannTomorrow(): Promise<{ created: number }> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { created } = await planForDate(tomorrowStr);

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!adminUser) return { created };

  const tomorrowStart = new Date(tomorrowStr + "T00:00:00Z");
  const weekAhead = new Date(tomorrowStart.getTime() + 7 * 86400000);
  const fwTrips = await prisma.placement.findMany({
    where: { laneType: "FW", date: { gte: tomorrowStart, lt: weekAhead } },
    select: { clientId: true, routeId: true, cohort: true, placementTime: true, cutoffTime: true, compliance: true, date: true },
  });

  let backfilled = 0;
  for (const fw of fwTrips) {
    if (!is2WaySchedule(fw.cohort)) continue;
    const dayStart = new Date(fw.date);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const retExists = await prisma.placement.findFirst({
      where: { clientId: fw.clientId, routeId: fw.routeId, laneType: "RET", date: { gte: dayStart, lt: dayEnd } },
    });
    if (!retExists) {
      await prisma.placement.create({
        data: { date: dayStart, clientId: fw.clientId, routeId: fw.routeId, cohort: fw.cohort, laneType: "RET", placementTime: fw.placementTime, cutoffTime: fw.cutoffTime, compliance: fw.compliance, createdById: adminUser.id },
      });
      backfilled++;
    }
  }

  return { created: created + backfilled };
}
