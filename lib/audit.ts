import { prisma } from "./prisma";

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  description,
  oldValue,
  newValue,
  placementId,
}: {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue?: Record<string, unknown> | string | null;
  newValue?: Record<string, unknown> | string | null;
  placementId?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        description,
        oldValue: oldValue != null ? JSON.stringify(oldValue) : null,
        newValue: newValue != null ? JSON.stringify(newValue) : null,
        placementId: placementId ?? null,
      },
    });
  } catch {
    // Never let audit logging break the main operation
  }
}
