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
    if (role === "KAM") return NextResponse.json({ issues: [], urgentPlacements: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categoryFilter: Record<string, any> = {};
    if (role === "DRIVER_MANAGEMENT") {
      categoryFilter.issueCategory = "DRIVER";
    } else if (role === "MAINTENANCE_TEAM") {
      categoryFilter.issueCategory = { in: ["MAINTENANCE", "EQUIPMENT"] };
    } else if (role === "STORE_AND_TYRE" || role === "E_LOCK_TEAM") {
      categoryFilter.issueCategory = "EQUIPMENT";
    }
    // PLANNING_TEAM and ADMIN: no filter = all categories

    const issues = await prisma.issueAlert.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, ...categoryFilter },
      include: {
        placement: { include: { client: true, route: true, vehicle: true } },
        raisedBy: { select: { name: true } },
      },
      orderBy: { raisedAt: "desc" },
      take: 50,
    });

    let urgentPlacements: unknown[] = [];
    if (role === "ADMIN") {
      const now = new Date();
      const raw = await prisma.placement.findMany({
        where: {
          cutoffTime: { lte: now },
          finalStatus: { not: "PLACED" },
          issueAlerts: { some: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
        },
        include: {
          client: true,
          route: true,
          vehicle: true,
          issueAlerts: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
        },
        orderBy: { cutoffTime: "asc" },
        take: 10,
      });
      urgentPlacements = JSON.parse(JSON.stringify(raw));
    }

    return NextResponse.json({
      issues: JSON.parse(JSON.stringify(issues)),
      urgentPlacements,
    });
  } catch (err) {
    return apiError(err);
  }
}
