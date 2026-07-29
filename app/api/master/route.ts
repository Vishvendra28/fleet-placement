import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [masterRoutes, clients, vendors, kams, routes, users, vehicles] = await Promise.all([
    prisma.masterRoute.findMany({
      include: {
        client: { select: { id: true, name: true } },
        route: { select: { id: true, name: true, origin: true, destination: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ client: { name: "asc" } }, { cohort: "asc" }, { placementTime: "asc" }],
    }),
    prisma.client.findMany({
      include: { kam: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "KAM" },
      include: { clients: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.route.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { role: "asc" },
    }),
    prisma.vehicle.findMany({
      select: { id: true, vehicleNumber: true, type: true, isActive: true, inactiveReason: true, inactiveComment: true },
      orderBy: { vehicleNumber: "asc" },
    }),
  ]);

  return NextResponse.json(
    JSON.parse(JSON.stringify({ masterRoutes, clients, vendors, kams, routes, users, vehicles }))
  );
}
