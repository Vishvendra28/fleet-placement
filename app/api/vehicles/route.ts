import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PLANNING_TEAM" && session.user.role !== "PLACEMENT_TEAM")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { vehicleNumber } = await req.json();
    if (!vehicleNumber?.trim()) return NextResponse.json({ error: "Vehicle number is required." }, { status: 400 });
    const vehicle = await prisma.vehicle.create({
      data: { vehicleNumber: vehicleNumber.trim().toUpperCase() },
      select: { id: true, vehicleNumber: true, type: true },
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") return NextResponse.json({ error: "Vehicle already exists." }, { status: 409 });
    return apiError(err);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      select: { id: true, vehicleNumber: true, type: true },
      orderBy: { vehicleNumber: "asc" },
    });

    return NextResponse.json(vehicles);
  } catch (err) {
    return apiError(err);
  }
}
