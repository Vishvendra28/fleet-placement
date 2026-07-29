import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json([]);

  const masterRoutes = await prisma.masterRoute.findMany({
    where: { clientId, isActive: true },
    include: { route: { select: { id: true, name: true, origin: true, destination: true } } },
    orderBy: { route: { name: "asc" } },
  });

  const routes = masterRoutes.map((mr) => mr.route);
  return NextResponse.json(routes);
}
