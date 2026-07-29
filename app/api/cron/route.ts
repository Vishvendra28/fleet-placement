import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // Alert planning/placement teams when placement is within 1 hour and still PENDING
  const pending = await prisma.placement.findMany({
    where: { finalStatus: "PENDING", alertSent: false, placementTime: { gte: now, lte: oneHourLater } },
    include: { client: true, route: true },
  });

  let alerted = 0;
  if (pending.length) {
    const recipients = await prisma.user.findMany({
      where: { role: { in: ["PLANNING_TEAM", "PLACEMENT_TEAM"] } },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: pending.flatMap((p) =>
        recipients.map((u) => ({
          userId: u.id,
          placementId: p.id,
          type: "PENDING_ALERT" as const,
          message: `ALERT: ${p.client.name} | ${p.route.name} is still PENDING — due at ${new Date(p.placementTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
        }))
      ),
      skipDuplicates: true,
    });

    await prisma.placement.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { alertSent: true } });
    alerted = pending.length;
  }

  // Alert admins when cutoff has passed and placement has unresolved vehicle issues
  const cutoffViolations = await prisma.placement.findMany({
    where: {
      cutoffTime: { lte: now },
      finalStatus: "PENDING",
      issueAlerts: {
        some: {
          issueCategory: { in: ["MAINTENANCE", "EQUIPMENT"] },
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      },
    },
    include: { client: true, route: true, vehicle: true },
  });

  if (cutoffViolations.length) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

    await prisma.notification.createMany({
      data: cutoffViolations.flatMap((p) =>
        admins.map((u) => ({
          userId: u.id,
          placementId: p.id,
          type: "CUTOFF_ALERT" as const,
          message: `CUTOFF PASSED: ${p.client.name} | ${p.route.name} | ${p.vehicle?.vehicleNumber ?? "No vehicle"} has unresolved vehicle issues and is still PENDING.`,
        }))
      ),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ alerted, cutoffViolations: cutoffViolations.length });
}
