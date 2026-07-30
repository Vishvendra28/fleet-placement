import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const routeId = searchParams.get("routeId");

    if (!clientId || !routeId) return NextResponse.json(null);

    const mr = await prisma.masterRoute.findFirst({
      where: { clientId, routeId, isActive: true },
      include: { vendor: { select: { id: true, name: true } } },
    });

    return NextResponse.json(mr);
  } catch (err) {
    return apiError(err);
  }
}
