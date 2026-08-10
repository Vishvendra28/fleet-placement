import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam))
    return NextResponse.json({ error: "Valid date (YYYY-MM-DD) required" }, { status: 400 });

  const dateStart = new Date(dateParam + "T00:00:00Z");
  const dateEnd = new Date(dateStart.getTime() + 86400000);

  const { count } = await prisma.placement.deleteMany({
    where: { date: { gte: dateStart, lt: dateEnd } },
  });

  return NextResponse.json({ deleted: count });
}
