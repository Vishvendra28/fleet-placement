import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const existing = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const vendor = await prisma.vendor.update({ where: { id: params.id }, data: { name: name.trim() } });
    await logAudit({
      userId: session.user.id,
      action: "UPDATED",
      entity: "VENDOR",
      entityId: params.id,
      description: `${session.user.name} renamed vendor: ${existing.name} → ${vendor.name}`,
      oldValue: { name: existing.name },
      newValue: { name: vendor.name },
    });
    return NextResponse.json(vendor);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.vendor.delete({ where: { id: params.id } });
    await logAudit({
      userId: session.user.id,
      action: "DELETED",
      entity: "VENDOR",
      entityId: params.id,
      description: `${session.user.name} deleted vendor: ${existing.name}`,
      oldValue: { name: existing.name },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}
