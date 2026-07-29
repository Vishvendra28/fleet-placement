import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, origin, destination } = await req.json();
  if (!name?.trim() || !origin?.trim() || !destination?.trim())
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });

  const existing = await prisma.route.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const route = await prisma.route.update({
    where: { id: params.id },
    data: { name: name.trim(), origin: origin.trim(), destination: destination.trim() },
  });

  await logAudit({
    userId: session.user.id,
    action: "UPDATED",
    entity: "ROUTE",
    entityId: params.id,
    description: `${session.user.name} updated route ${existing.name}→${name.trim()} (${origin}→${destination})`,
    oldValue: { name: existing.name, origin: existing.origin, destination: existing.destination },
    newValue: { name: name.trim(), origin: origin.trim(), destination: destination.trim() },
  });

  return NextResponse.json(route);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.route.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.route.delete({ where: { id: params.id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETED",
    entity: "ROUTE",
    entityId: params.id,
    description: `${session.user.name} deleted route ${existing.name} (${existing.origin}→${existing.destination})`,
    oldValue: { name: existing.name, origin: existing.origin, destination: existing.destination },
  });

  return NextResponse.json({ ok: true });
}
