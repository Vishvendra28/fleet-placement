import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await prisma.client.findMany({
    include: { kam: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, kamId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const existing = await prisma.client.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "Client with this name already exists." }, { status: 409 });

  const client = await prisma.client.create({
    data: { name: name.trim(), kamId: kamId || null },
    include: { kam: { select: { id: true, name: true } } },
  });
  return NextResponse.json(client, { status: 201 });
}
