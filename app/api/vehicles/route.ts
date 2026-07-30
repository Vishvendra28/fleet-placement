import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

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
