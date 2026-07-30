import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const activeOnly = req.nextUrl.searchParams.get("active") === "true";
    const withIssues = req.nextUrl.searchParams.get("withIssues") === "true";

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysInMonth = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86400000);

    const vehicles = await prisma.vehicle.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        ...(withIssues
          ? {
              placements: {
                include: {
                  issueAlerts: {
                    include: {
                      raisedBy: { select: { name: true } },
                      resolvedBy: { select: { name: true } },
                    },
                    orderBy: { raisedAt: "desc" },
                  },
                  client: { select: { name: true } },
                },
                where: { issueAlerts: { some: { issueCategory: { in: ["MAINTENANCE", "EQUIPMENT"] } } } },
                orderBy: { date: "desc" },
              },
            }
          : {}),
        _count: {
          select: {
            placements: {
              where: {
                date: { gte: monthStart, lt: monthEnd },
                finalStatus: "PLACED",
              },
            },
          },
        },
      },
      orderBy: { vehicleNumber: "asc" },
    });

    return NextResponse.json(vehicles.map((v) => ({
      ...v,
      utilization: { placedDays: v._count.placements, totalDays: daysInMonth },
    })));
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { vehicleNumber, type } = await req.json();
    if (!vehicleNumber?.trim()) return NextResponse.json({ error: "Vehicle number is required." }, { status: 400 });

    const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber: vehicleNumber.trim().toUpperCase() } });
    if (existing) return NextResponse.json({ error: "Vehicle with this number already exists." }, { status: 409 });

    const vehicle = await prisma.vehicle.create({
      data: { vehicleNumber: vehicleNumber.trim().toUpperCase(), type: type?.trim() || null },
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
