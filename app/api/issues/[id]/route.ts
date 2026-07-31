import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { sendPushToRoles } from "@/lib/push";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { status, resolutionNote, eta } = await req.json();
    const issue = await prisma.issueAlert.findUnique({
      where: { id: params.id },
      include: { placement: { include: { client: true, route: true } } },
    });
    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const role = session.user.role;
    if (role !== "ADMIN") {
      if (issue.issueCategory === "DRIVER" && role !== "DRIVER_MANAGEMENT")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if ((issue.issueCategory === "MAINTENANCE" || issue.issueCategory === "EQUIPMENT") && role !== "MAINTENANCE_TEAM" && role !== "STORE_AND_TYRE" && role !== "E_LOCK_TEAM")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const etaDate = status === "IN_PROGRESS" && eta ? new Date(eta) : null;

    const updated = await prisma.issueAlert.update({
      where: { id: params.id },
      data: {
        status,
        resolutionNote: resolutionNote || null,
        eta: etaDate,
        resolvedById: status === "RESOLVED" ? session.user.id : null,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
    });

    // Notify Planning Team + Placement Team + Admin on resolve (DB + push)
    if (status === "RESOLVED") {
      const resolveRoles = ["PLANNING_TEAM", "PLACEMENT_TEAM", "ADMIN"];
      const notifyUsers = await prisma.user.findMany({
        where: { role: { in: resolveRoles as never[] } },
        select: { id: true },
      });
      const label = ISSUE_VALUE_LABELS[issue.issueValue] ?? issue.issueValue;
      await prisma.notification.createMany({
        data: notifyUsers.map((u) => ({
          userId: u.id,
          placementId: issue.placementId,
          type: "ISSUE_RESOLVED" as const,
          message: `RESOLVED: ${issue.placement.client.name} | ${issue.placement.route.name} — ${label} has been resolved by ${session.user.name}.`,
        })),
        skipDuplicates: true,
      });
      await sendPushToRoles(resolveRoles, {
        title: "✅ Issue Resolved",
        body: `${issue.placement.client.name} | ${issue.placement.route.name} — ${label} resolved by ${session.user.name}`,
        url: "/dashboard/issues",
        tag: `resolved-${params.id}`,
      });
    }

    const etaStr = etaDate ? ` ETA: ${etaDate.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "";
    await logAudit({
      userId: session.user.id,
      action: "STATUS_CHANGED",
      entity: "ISSUE",
      entityId: params.id,
      description: `${session.user.name} changed issue status to ${status} for ${issue.placement.client.name}${etaStr}`,
      oldValue: { status: issue.status },
      newValue: { status, resolutionNote, eta: eta ?? null },
      placementId: issue.placementId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err);
  }
}
