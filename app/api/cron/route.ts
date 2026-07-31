import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const cronSecret = (process.env.CRON_SECRET ?? "").trim();
    const urlSecret = new URL(req.url).searchParams.get("secret")?.trim() ?? "";
    const headerSecret = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
    const secret = headerSecret || urlSecret;
    if (!cronSecret || secret !== cronSecret) {
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

      // Only notify for placements that haven't already received a CUTOFF_ALERT from this team.
      const alreadyNotified = await prisma.notification.findMany({
        where: {
          type: "CUTOFF_ALERT",
          placementId: { in: violations.map((p) => p.id) },
          userId: { in: teamMembers.map((u) => u.id) },
        },
        select: { placementId: true },
      });
      const notifiedIds = new Set(alreadyNotified.map((n) => n.placementId));
      const newViolations = violations.filter((p) => !notifiedIds.has(p.id));

      if (!newViolations.length) continue;

      await prisma.notification.createMany({
        data: newViolations.flatMap((p) =>
          teamMembers.map((u) => ({
            userId: u.id,
            placementId: p.id,
            type: "CUTOFF_ALERT" as const,
            message: `CUTOFF PASSED: ${p.client.name} | ${p.route.name} | ${p.vehicle?.vehicleNumber ?? "No vehicle"} — unresolved ${categories[0].toLowerCase()} issue, placement still PENDING.`,
          }))
        ),
        skipDuplicates: true,
      });
      cutoffCount += newViolations.length;
    }

    // ── 3. ETA_OVERDUE: IN_PROGRESS issues whose committed ETA has passed ──
    const overdueIssues = await prisma.issueAlert.findMany({
      where: { status: "IN_PROGRESS", eta: { lte: now } },
      include: { placement: { include: { client: true, route: true } } },
    });

    const ELOCK_VALUES = ["UNHEALTHY", "LOCK_DAMAGE"];

    for (const issue of overdueIssues) {
      let roles: string[];
      let emails: string[] = [];

      if (issue.issueCategory === "DRIVER") {
        roles = ["DRIVER_MANAGEMENT", "PLANNING_TEAM", "ADMIN"];
      } else if (issue.issueCategory === "MAINTENANCE") {
        roles = ["MAINTENANCE_TEAM", "PLANNING_TEAM", "ADMIN"];
      } else if (ELOCK_VALUES.includes(issue.issueValue)) {
        // E-Lock: same routing as the initial raise alert
        roles = ["E_LOCK_TEAM", "ADMIN"];
        emails = ["mohit@fleet.com"];
      } else {
        // Cargo Net, Tirpal, Stepney, Tyre & Alignment
        roles = ["STORE_AND_TYRE", "PLANNING_TEAM", "ADMIN"];
      }

      const [roleUsers, emailUsers] = await Promise.all([
        prisma.user.findMany({ where: { role: { in: roles as never[] } }, select: { id: true } }),
        emails.length
          ? prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
          : Promise.resolve([]),
      ]);

      const seen = new Set<string>();
      const recipients = [...roleUsers, ...emailUsers].filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
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
  } catch (err) {
    return apiError(err);
  }
}
