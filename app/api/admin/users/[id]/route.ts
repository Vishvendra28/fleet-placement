import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    // Password reset flow
    if (body.password !== undefined) {
      if (!body.password || body.password.length < 6)
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      const existing = await prisma.user.findUnique({ where: { id: params.id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const passwordHash = await hash(body.password, 10);
      await prisma.user.update({ where: { id: params.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      await logAudit({
        userId: session.user.id,
        action: "UPDATED",
        entity: "USER",
        entityId: params.id,
        description: `${session.user.name} reset password for ${existing.name}`,
      });
      return NextResponse.json({ ok: true });
    }

    const { name, role, email } = body;
    if (!name?.trim() || !role || !email?.trim()) return NextResponse.json({ error: "Name, email and role are required." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (taken) return NextResponse.json({ error: "This email is already in use by another account." }, { status: 409 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        role,
        email: normalizedEmail,
        // Bump tokenVersion so any existing JWT is invalidated within 5 minutes
        ...(role !== existing.role ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATED",
      entity: "USER",
      entityId: params.id,
      description: `${session.user.name} updated user ${existing.name}`,
      oldValue: { name: existing.name, email: existing.email, role: existing.role },
      newValue: { name: name.trim(), email: normalizedEmail, role },
    });

    return NextResponse.json(user);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (params.id === session.user.id) return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    try {
      await prisma.user.delete({ where: { id: params.id } });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete this user — they have linked records (issues, remarks, or audit logs). Consider changing their role to restrict access instead." },
          { status: 409 }
        );
      }
      throw err;
    }

    await logAudit({
      userId: session.user.id,
      action: "DELETED",
      entity: "USER",
      entityId: params.id,
      description: `${session.user.name} deleted user ${existing.name} (${existing.role})`,
      oldValue: { name: existing.name, email: existing.email, role: existing.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
