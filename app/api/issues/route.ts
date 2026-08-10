import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role;
    const statusFilter = req.nextUrl.searchParams.get("status");
    const categoryFilter = req.nextUrl.searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (statusFilter && statusFilter !== "ALL") where.status = statusFilter;
    if (categoryFilter && categoryFilter !== "ALL") where.issueCategory = categoryFilter;

    if (role === "DRIVER_MANAGEMENT") {
      where.issueCategory = "DRIVER";
    } else if (role === "MAINTENANCE_TEAM") {
      where.issueCategory = { in: ["MAINTENANCE", "EQUIPMENT"] };
    } else if (role === "STORE_AND_TYRE") {
      where.issueCategory = "EQUIPMENT";
    } else if (role === "E_LOCK_TEAM") {
      where.issueCategory = "EQUIPMENT";
      where.issueValue = { in: ["UNHEALTHY", "LOCK_DAMAGE"] };
    } else if (role === "PLANNING_TEAM") {
      where.issueCategory = { in: ["DRIVER", "MAINTENANCE"] };
    } else if (role === "PLACEMENT_TEAM") {
      where.issueCategory = "EQUIPMENT";
    } else if (role !== "ADMIN") {
      return NextResponse.json([]);
    }

    const dateParam = req.nextUrl.searchParams.get("date");
    if (dateParam) {
      const d = new Date(dateParam);
      const nextDay = new Date(d.getTime() + 86400000);
      where.placement = { date: { gte: d, lt: nextDay } };
    }

    const issues = await prisma.issueAlert.findMany({
      where,
      include: {
        placement: {
          select: {
            id: true,
            date: true,
            cohort: true,
            laneType: true,
            placementTime: true,
            finalStatus: true,
            driverNumber1: true,
            client: { select: { name: true } },
            route: { select: { name: true } },
            vehicle: { select: { vehicleNumber: true } },
          },
        },
        raisedBy: { select: { name: true, role: true } },
        resolvedBy: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { raisedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json(issues);
  } catch (err) {
    return apiError(err);
  }
}
