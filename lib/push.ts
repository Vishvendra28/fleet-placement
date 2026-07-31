import { prisma } from "./prisma";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Variable-based require prevents webpack static analysis —
// webpack only bundles require("literal"), not require(variable)
function getWebPush() {
  const pkg = "web-push";
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  return require(pkg) as any;
}

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    getWebPush().setVapidDetails("mailto:admin@fleet.com", pub, priv);
    vapidConfigured = true;
  }
}

async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  ensureVapid();
  const webpush = getWebPush();

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err: { statusCode?: number }) => {
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
