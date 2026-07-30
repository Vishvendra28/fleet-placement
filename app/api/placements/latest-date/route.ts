import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const latest = await prisma.placement.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latest) return NextResponse.json({ date: null });
    return NextResponse.json({ date: latest.date.toISOString().split("T")[0] });
  } catch (err) {
    return apiError(err);
  }
}
