import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const placement = await prisma.placement.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { name: true } },
        route: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    if (!placement) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (placement.finalStatus === "PLACED") {
      return NextResponse.json(
        { error: "Cannot delete a PLACED trip — it is part of completed records." },
        { status: 409 }
      );
    }

    // Audit log BEFORE delete so the placementId FK is still valid.
    // onDelete: SetNull on AuditLog means the log is kept but placementId → null after cascade.
    await logAudit({
      userId: session.user.id,
      action: "DELETED",
      entity: "PLACEMENT",
      entityId: params.id,
      description: `${session.user.name} deleted trip: ${placement.client.name} — ${placement.route.name} (${placement.vehicle?.vehicleNumber ?? "no vehicle"}) on ${placement.date.toISOString().split("T")[0]}`,
      placementId: params.id,
    });

    await prisma.placement.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
