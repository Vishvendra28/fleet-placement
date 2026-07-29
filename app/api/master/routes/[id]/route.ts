import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { cohort, placementTime, compliance, vendorId } = body;

  const existing = await prisma.masterRoute.findUnique({
    where: { id: params.id },
    include: { client: { select: { name: true } }, route: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.masterRoute.update({
    where: { id: params.id },
    data: {
      ...(cohort !== undefined && { cohort }),
      ...(placementTime !== undefined && { placementTime }),
      ...(compliance !== undefined && { compliance }),
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "UPDATED",
    entity: "MASTER_ROUTE",
    entityId: params.id,
    description: `${session.user.name} updated master route: ${existing.client.name} — ${existing.route.name}`,
    oldValue: { cohort: existing.cohort, placementTime: existing.placementTime, compliance: existing.compliance },
    newValue: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.masterRoute.findUnique({
    where: { id: params.id },
    include: { client: { select: { name: true } }, route: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.masterRoute.delete({ where: { id: params.id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETED",
    entity: "MASTER_ROUTE",
    entityId: params.id,
    description: `${session.user.name} deleted master route: ${existing.client.name} — ${existing.route.name}`,
    oldValue: { cohort: existing.cohort, placementTime: existing.placementTime },
  });

  return NextResponse.json({ success: true });
}
