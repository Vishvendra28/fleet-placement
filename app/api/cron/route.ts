import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // ── 1. PENDING_ALERT: placement within 1 hour and still PENDING ──
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

  // ── 2. CUTOFF_ALERT: cutoff passed, issues still open → notify the responsible team ──
  // Bug 1 fix: DRIVER issues now included. Bug 3 fix: teams notified (not admin) to prevent spam.
  // Admin sees live cutoff violations on the Dashboard already.
  const CUTOFF_ROUTING = [
    { roles: ["DRIVER_MANAGEMENT"],  categories: ["DRIVER"] },
    { roles: ["MAINTENANCE_TEAM"],   categories: ["MAINTENANCE"] },
    { roles: ["STORE_AND_TYRE"],     categories: ["EQUIPMENT"] },
  ] as const;

  let cutoffCount = 0;
  for (const { roles, categories } of CUTOFF_ROUTING) {
    const violations = await prisma.placement.findMany({
      where: {
        cutoffTime: { lte: now },
        finalStatus: "PENDING",
        issueAlerts: {
          some: { issueCategory: { in: categories as unknown as string[] }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        },
      },
      include: { client: true, route: true, vehicle: true },
    });

    if (!violations.length) continue;

    const teamMembers = await prisma.user.findMany({
      where: { role: { in: roles as unknown as string[] } },
      select: { id: true },
    });
    if (!teamMembers.length) continue;

    await prisma.notification.createMany({
      data: violations.flatMap((p) =>
        teamMembers.map((u) => ({
          userId: u.id,
          placementId: p.id,
          type: "CUTOFF_ALERT" as const,
          message: `CUTOFF PASSED: ${p.client.name} | ${p.route.name} | ${p.vehicle?.vehicleNumber ?? "No vehicle"} — unresolved ${categories[0].toLowerCase()} issue, placement still PENDING.`,
        }))
      ),
      skipDuplicates: true,
    });
    cutoffCount += violations.length;
  }

  // ── 3. ETA_OVERDUE: IN_PROGRESS issues whose committed ETA has passed ──
  // Bug 6 fix: escalate when team committed to an ETA but hasn't resolved it.
  const overdueIssues = await prisma.issueAlert.findMany({
    where: { status: "IN_PROGRESS", eta: { lte: now } },
    include: { placement: { include: { client: true, route: true } } },
  });

  const ETA_ROUTING: Record<string, string[]> = {
    DRIVER:      ["DRIVER_MANAGEMENT", "PLANNING_TEAM"],
    MAINTENANCE: ["MAINTENANCE_TEAM",  "PLANNING_TEAM"],
    EQUIPMENT:   ["STORE_AND_TYRE",    "PLANNING_TEAM"],
  };

  for (const issue of overdueIssues) {
    const roles = ETA_ROUTING[issue.issueCategory] ?? ["PLANNING_TEAM"];
    const recipients = await prisma.user.findMany({
      where: { role: { in: roles as never[] } },
      select: { id: true },
    });
    if (!recipients.length) continue;

    const label = ISSUE_VALUE_LABELS[issue.issueValue] ?? issue.issueValue;
    await prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        placementId: issue.placementId,
        type: "ETA_OVERDUE" as const,
        message: `ETA OVERDUE: ${issue.placement.client.name} | ${issue.placement.route.name} — ${label} ETA has passed and the issue is still unresolved.`,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ alerted, cutoffAlerts: cutoffCount, etaOverdue: overdueIssues.length });
}
