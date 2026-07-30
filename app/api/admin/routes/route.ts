import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const routes = await prisma.route.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(routes);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PLANNING_TEAM")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, origin, destination } = await req.json();
    if (!name?.trim() || !origin?.trim() || !destination?.trim()) {
      return NextResponse.json({ error: "Name, origin and destination are required." }, { status: 400 });
    }

    const existing = await prisma.route.findUnique({ where: { name: name.trim() } });
    if (existing) return NextResponse.json({ error: "Route with this name already exists." }, { status: 409 });

    const route = await prisma.route.create({ data: { name: name.trim(), origin: origin.trim(), destination: destination.trim() } });
    return NextResponse.json(route, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
