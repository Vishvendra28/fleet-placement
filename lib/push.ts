import webpush from "web-push";
import { prisma } from "./prisma";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@fleet.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        })
    )
  );
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  await sendToSubscriptions(subs, payload);
}

export async function sendPushToRoles(roles: string[], payload: PushPayload) {
  if (!roles.length) return;
  const users = await prisma.user.findMany({
    where: { role: { in: roles as never[] } },
    select: { id: true },
  });
  await sendPushToUsers(users.map((u) => u.id), payload);
}

export async function sendPushToEmails(emails: string[], payload: PushPayload) {
  if (!emails.length) return;
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  await sendPushToUsers(users.map((u) => u.id), payload);
}

export async function sendPushToRolesAndEmails(
  roles: string[],
  emails: string[],
  payload: PushPayload
) {
  const [roleUsers, emailUsers] = await Promise.all([
    roles.length
      ? prisma.user.findMany({ where: { role: { in: roles as never[] } }, select: { id: true } })
      : [],
    emails.length
      ? prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
      : [],
  ]);
  const ids = [...new Set([...roleUsers, ...emailUsers].map((u) => u.id))];
  await sendPushToUsers(ids, payload);
}
