import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, resolutionNote, eta } = await req.json();
  const issue = await prisma.issueAlert.findUnique({
    where: { id: params.id },
    include: { placement: { include: { client: true } } },
  });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = session.user.role;
  if (role !== "ADMIN") {
    if (issue.issueCategory === "DRIVER" && role !== "DRIVER_MANAGEMENT")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if ((issue.issueCategory === "MAINTENANCE" || issue.issueCategory === "EQUIPMENT") && role !== "MAINTENANCE_TEAM")
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
}
