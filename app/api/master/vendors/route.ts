import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Vendor name required" }, { status: 400 });

  const vendor = await prisma.vendor.create({ data: { name: name.trim() } });
  await logAudit({
    userId: session.user.id,
    action: "CREATED",
    entity: "VENDOR",
    entityId: vendor.id,
    description: `${session.user.name} added vendor: ${vendor.name}`,
    newValue: { name: vendor.name },
  });
  return NextResponse.json(vendor, { status: 201 });
}
