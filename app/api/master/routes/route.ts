import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { clientId, routeId, cohort, placementTime, compliance, vendorId } = body;
    if (!clientId || !routeId || !cohort || !placementTime || !compliance)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const mr = await prisma.masterRoute.create({
      data: { clientId, routeId, cohort, placementTime, compliance, vendorId: vendorId || null },
      include: {
        client: { select: { name: true } },
        route: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATED",
      entity: "MASTER_ROUTE",
      entityId: mr.id,
      description: `${session.user.name} added master route: ${mr.client.name} — ${mr.route.name} (${cohort}, ${placementTime})`,
      newValue: { clientId, routeId, cohort, placementTime, compliance, vendorId },
    });

    return NextResponse.json(mr, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
