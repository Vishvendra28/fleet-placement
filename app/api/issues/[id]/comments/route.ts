import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const comments = await prisma.issueComment.findMany({
      where: { issueId: params.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { comment } = await req.json();
    if (!comment?.trim()) return NextResponse.json({ error: "Comment is required." }, { status: 400 });

    const issue = await prisma.issueAlert.findUnique({
      where: { id: params.id },
      include: { placement: { include: { client: true } } },
    });
    if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });

    const created = await prisma.issueComment.create({
      data: { issueId: params.id, userId: session.user.id, comment: comment.trim() },
      include: { user: { select: { name: true, role: true } } },
    });

    await logAudit({
      userId: session.user.id,
      action: "COMMENT_ADDED",
      entity: "ISSUE",
      entityId: params.id,
      description: `${session.user.name} commented on issue for ${issue.placement.client.name}`,
      placementId: issue.placementId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
