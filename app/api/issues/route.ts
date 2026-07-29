import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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
  } else if (role !== "ADMIN" && role !== "PLANNING_TEAM" && role !== "PLACEMENT_TEAM") {
    return NextResponse.json([]);
  }

  const issues = await prisma.issueAlert.findMany({
    where,
    include: {
      placement: {
        select: {
          id: true,
          date: true,
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
}
