import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: session.user.id },
    });

    if (!subs.length) {
      return NextResponse.json({ error: "No push subscription found for your account. Try refreshing the page first." }, { status: 404 });
    }

    await sendPushToUsers([session.user.id], {
      title: "✅ Fleet Notifications Working",
      body: "Push notifications are set up correctly on this device.",
      url: "/dashboard",
      tag: "test-push",
    });

    return NextResponse.json({ ok: true, subscriptions: subs.length });
  } catch (err) {
    return apiError(err);
  }
}
