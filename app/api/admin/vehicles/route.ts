import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "VEHICLE_HEALTH_TEAM")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // Monthly DRIVER + MAINTENANCE issue counts per vehicle
    const vehicleIds = vehicles.map((v) => v.id);
    const monthlyIssues = await prisma.issueAlert.findMany({
      where: {
        raisedAt: { gte: monthStart, lt: monthEnd },
        issueCategory: { in: ["DRIVER", "MAINTENANCE"] },
        placement: { vehicleId: { in: vehicleIds } },
      },
      select: { issueCategory: true, placement: { select: { vehicleId: true } } },
    });
    const monthlyCountMap: Record<string, { driver: number; maintenance: number }> = {};
    for (const issue of monthlyIssues) {
      const vId = issue.placement.vehicleId!;
      if (!monthlyCountMap[vId]) monthlyCountMap[vId] = { driver: 0, maintenance: 0 };
      if (issue.issueCategory === "DRIVER") monthlyCountMap[vId].driver++;
      else monthlyCountMap[vId].maintenance++;
    }

    return NextResponse.json(vehicles.map((v) => ({
      ...v,
      utilization: { placedDays: v._count.placements, totalDays: daysInMonth },
      monthlyIssueCounts: monthlyCountMap[v.id] ?? { driver: 0, maintenance: 0 },
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
