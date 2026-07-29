import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, kamId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const existing = await prisma.client.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { name: name.trim(), kamId: kamId || null },
    include: { kam: { select: { id: true, name: true } } },
  });

  await logAudit({
    userId: session.user.id,
    action: "UPDATED",
    entity: "CLIENT",
    entityId: params.id,
    description: `${session.user.name} updated client ${existing.name}→${name.trim()}`,
    oldValue: { name: existing.name, kamId: existing.kamId },
    newValue: { name: name.trim(), kamId: kamId || null },
  });

  return NextResponse.json(client);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.client.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.client.delete({ where: { id: params.id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETED",
    entity: "CLIENT",
    entityId: params.id,
    description: `${session.user.name} deleted client ${existing.name}`,
    oldValue: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
