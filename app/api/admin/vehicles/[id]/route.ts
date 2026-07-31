import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "VEHICLE_HEALTH_TEAM")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const existing = await prisma.vehicle.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (body.toggleActive !== undefined) {
      const makingInactive = existing.isActive;
      const updateData: Record<string, unknown> = { isActive: !existing.isActive };
      if (makingInactive) {
        updateData.inactiveReason = body.inactiveReason || null;
        updateData.inactiveComment = body.inactiveComment || null;
      } else {
        // Reactivating — clear reason
        updateData.inactiveReason = null;
        updateData.inactiveComment = null;
      }
      const vehicle = await prisma.vehicle.update({ where: { id: params.id }, data: updateData });
      const reasonStr = body.inactiveReason ? ` (Reason: ${body.inactiveReason}${body.inactiveComment ? " — " + body.inactiveComment : ""})` : "";
      await logAudit({
        userId: session.user.id,
        action: "UPDATED",
        entity: "VEHICLE",
        entityId: params.id,
        description: `${session.user.name} set ${existing.vehicleNumber} to ${vehicle.isActive ? "Active" : "Inactive"}${reasonStr}`,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: vehicle.isActive, inactiveReason: body.inactiveReason ?? null },
      });
      return NextResponse.json(vehicle);
    }

    const { vehicleNumber, type } = body;
    if (!vehicleNumber?.trim()) return NextResponse.json({ error: "Vehicle number is required." }, { status: 400 });

    const vehicle = await prisma.vehicle.update({
      where: { id: params.id },
      data: { vehicleNumber: vehicleNumber.trim().toUpperCase(), type: type?.trim() || null },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATED",
      entity: "VEHICLE",
      entityId: params.id,
      description: `${session.user.name} updated vehicle ${existing.vehicleNumber}→${vehicleNumber.trim().toUpperCase()}`,
      oldValue: { vehicleNumber: existing.vehicleNumber, type: existing.type },
      newValue: { vehicleNumber: vehicleNumber.trim().toUpperCase(), type: type?.trim() || null },
    });

    return NextResponse.json(vehicle);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.vehicle.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await prisma.vehicle.delete({ where: { id: params.id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETED",
      entity: "VEHICLE",
      entityId: params.id,
      description: `${session.user.name} deleted vehicle ${existing.vehicleNumber}`,
      oldValue: { vehicleNumber: existing.vehicleNumber, type: existing.type },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
