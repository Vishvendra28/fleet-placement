import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FinalStatus, IssueCategory, IssueSource } from "@prisma/client";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { sendPushToRolesAndEmails } from "@/lib/push";

async function raiseIssue(
  placementId: string,
  category: IssueCategory,
  issueValue: string,
  raisedById: string,
  notifyRoles: string[],
  notifyEmails: string[] = [],
  source?: IssueSource
) {
  // Serializable transaction + @@unique([placementId, issueCategory, issueValue])
  // eliminates the TOCTOU race: concurrent calls either hit the unique constraint
  // (P2002) or the serialization conflict (P2034) — both are safe to ignore.
  let issue: { id: string } | null = null;
  try {
    issue = await prisma.$transaction(async (tx) => {
      const existing = await tx.issueAlert.findUnique({
        where: { placementId_issueCategory_issueValue: { placementId, issueCategory: category, issueValue } },
      });
      if (existing) {
        if (existing.status !== "RESOLVED") return null; // already active, skip
        // Re-raise: reset a resolved issue back to OPEN, update source
        return tx.issueAlert.update({
          where: { id: existing.id },
          data: { status: "OPEN", raisedById, raisedAt: new Date(), resolvedById: null, resolvedAt: null, resolutionNote: null, eta: null, ...(source ? { source } : {}) },
        });
      }
      return tx.issueAlert.create({
        data: { placementId, issueCategory: category, issueValue, raisedById, status: "OPEN", ...(source ? { source } : {}) },
      });
    }, { isolationLevel: "Serializable" });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002" || e.code === "P2034") return; // race handled — already exists
    throw err;
  }

  if (!issue) return; // was already OPEN/IN_PROGRESS

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    include: { client: true, route: true },
  });
  if (!placement) return;

  const roleRecipients = notifyRoles.length > 0
    ? await prisma.user.findMany({ where: { role: { in: notifyRoles as never[] } }, select: { id: true } })
    : [];
  const emailRecipients = notifyEmails.length > 0
    ? await prisma.user.findMany({ where: { email: { in: notifyEmails } }, select: { id: true } })
    : [];

  const seen = new Set<string>();
  const allRecipients = [...roleRecipients, ...emailRecipients].filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  const label = ISSUE_VALUE_LABELS[issueValue] || issueValue;
  if (allRecipients.length) {
    await prisma.notification.createMany({
      data: allRecipients.map((u) => ({
        userId: u.id,
        placementId,
        type: "ISSUE_ALERT" as const,
        message: `ISSUE ALERT: ${placement.client.name} | ${placement.route.name} — ${label} needs attention`,
      })),
      skipDuplicates: true,
    });
  }

  // Send push notification to all recipients
  await sendPushToRolesAndEmails(notifyRoles, notifyEmails, {
    title: "⚠️ Fleet Issue Alert",
    body: `${placement.client.name} | ${placement.route.name} — ${label} needs attention`,
    url: "/dashboard/issues",
    tag: `issue-${issue.id}`,
  });

  await logAudit({
    userId: raisedById,
    action: "ISSUE_RAISED",
    entity: "ISSUE",
    entityId: issue.id,
    description: `Issue raised for ${placement.client.name} — ${ISSUE_VALUE_LABELS[issueValue] || issueValue} (${category})`,
    placementId,
  });
}

async function getUpdatedPlacement(id: string) {
  return prisma.placement.findUnique({
    where: { id },
    select: {
      id: true, date: true, cohort: true, laneType: true, placementTime: true, finalStatus: true,
      compliance: true, driverNumber1: true, driverNumber2: true,
      client: { select: { name: true } },
      route: { select: { name: true } },
      vehicle: { select: { id: true, vehicleNumber: true } },
      d1Remark: { select: { driverIssue: true, maintenanceIssue: true } },
      sameDayRemark: { select: { driverIssue: true, maintenanceIssue: true } },
      placementTeamRemark: { select: { elockStatus: true, idfyDrivers: true, cargoNet: true, tirpal: true, stepney: true } },
      issueAlerts: { select: { id: true, status: true, issueCategory: true, issueValue: true, source: true } },
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const { section, data } = await req.json() as { section: string; data: Record<string, unknown> };
    const role = session.user.role;
    const now = new Date();

    if (section === "d1" || section === "sameDay") {
      if (role !== "PLANNING_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const placement = await prisma.placement.findUnique({
        where: { id },
        include: { client: true, route: true, vehicle: true },
      });
      if (!placement) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { driverIssue, maintenanceIssue } = data;
      const hasDI = "driverIssue" in data;
      const hasMI = "maintenanceIssue" in data;
      // Only include fields that were actually sent — prevents one field clearing the other
      const remarkUpdate = {
        filledById: session.user.id, filledAt: now,
        ...(hasDI ? { driverIssue: (driverIssue as string | undefined) ?? null } : {}),
        ...(hasMI ? { maintenanceIssue: (maintenanceIssue as string | undefined) ?? null } : {}),
      };
      const remarkCreate = {
        placementId: id,
        driverIssue: hasDI ? ((driverIssue as string | undefined) ?? null) : null,
        maintenanceIssue: hasMI ? ((maintenanceIssue as string | undefined) ?? null) : null,
        filledById: session.user.id, filledAt: now,
      };

      if (section === "d1") {
        await prisma.d1PlanningRemark.upsert({ where: { placementId: id }, create: remarkCreate, update: remarkUpdate });
      } else {
        await prisma.sameDayPlanningRemark.upsert({ where: { placementId: id }, create: remarkCreate, update: remarkUpdate });
      }

      const issueSource: IssueSource = section === "d1" ? "D1" : "SAME_DAY";

      if (hasDI) {
        if (!driverIssue || driverIssue === "NO_ISSUE") {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueCategory: "DRIVER", source: issueSource, status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — No Issue selected" },
          });
        } else {
          await raiseIssue(id, "DRIVER", driverIssue as string, session.user.id, ["DRIVER_MANAGEMENT"], [], issueSource);
        }
      }

      if (hasMI) {
        if (!maintenanceIssue || maintenanceIssue === "NO_ISSUE") {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueCategory: { in: ["MAINTENANCE", "EQUIPMENT"] }, source: issueSource, status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — No Issue selected" },
          });
        } else if (maintenanceIssue === "TYRE_AND_ALIGNMENT") {
          await raiseIssue(id, "EQUIPMENT", maintenanceIssue as string, session.user.id, ["STORE_AND_TYRE"], [], issueSource);
        } else {
          await raiseIssue(id, "MAINTENANCE", maintenanceIssue as string, session.user.id, ["MAINTENANCE_TEAM"], [], issueSource);
        }
      }

      const remarkLabel = section === "d1" ? "D-1 Remark" : "Same Day Remark";
      await logAudit({
        userId: session.user.id,
        action: "REMARK_UPDATED",
        entity: "PLACEMENT",
        entityId: id,
        description: `${session.user.name} updated ${remarkLabel} for ${placement.client.name} — ${placement.vehicle?.vehicleNumber ?? ""}`,
        newValue: data,
        placementId: id,
      });

      return NextResponse.json(await getUpdatedPlacement(id));
    }

    if (section === "placementTeam") {
      if (role !== "PLACEMENT_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const placement = await prisma.placement.findUnique({
        where: { id },
        include: { client: true, vehicle: true },
      });
      if (!placement) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { elockStatus, idfyDrivers, cargoNet, tirpal, stepney } = data;
      const hasElock = "elockStatus" in data;
      const hasIdfy = "idfyDrivers" in data;
      const hasCargo = "cargoNet" in data;
      const hasTirpal = "tirpal" in data;
      const hasStepney = "stepney" in data;

      const ptUpdate = {
        filledById: session.user.id, filledAt: now,
        ...(hasElock ? { elockStatus: (elockStatus as string | undefined) ?? null } : {}),
        ...(hasIdfy ? { idfyDrivers: (idfyDrivers as string | undefined) ?? null } : {}),
        ...(hasCargo ? { cargoNet: (cargoNet as string | undefined) ?? null } : {}),
        ...(hasTirpal ? { tirpal: (tirpal as string | undefined) ?? null } : {}),
        ...(hasStepney ? { stepney: (stepney as string | undefined) ?? null } : {}),
      };
      const ptCreate = {
        placementId: id,
        elockStatus: hasElock ? ((elockStatus as string | undefined) ?? null) : null,
        idfyDrivers: hasIdfy ? ((idfyDrivers as string | undefined) ?? null) : null,
        cargoNet: hasCargo ? ((cargoNet as string | undefined) ?? null) : null,
        tirpal: hasTirpal ? ((tirpal as string | undefined) ?? null) : null,
        stepney: hasStepney ? ((stepney as string | undefined) ?? null) : null,
        filledById: session.user.id, filledAt: now,
      };

      await prisma.placementTeamRemark.upsert({ where: { placementId: id }, create: ptCreate, update: ptUpdate });

      if (hasElock) {
        if (elockStatus === "UNHEALTHY" || elockStatus === "LOCK_DAMAGE") {
          await raiseIssue(id, "EQUIPMENT", elockStatus as string, session.user.id, ["E_LOCK_TEAM"], ["mohit@fleet.com"], "PLACEMENT_TEAM");
        } else {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueValue: { in: ["UNHEALTHY", "LOCK_DAMAGE"] }, source: "PLACEMENT_TEAM", status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — field reset" },
          });
        }
      }
      if (hasCargo) {
        if (cargoNet === "NOT_AVAILABLE") {
          await raiseIssue(id, "EQUIPMENT", "CARGO_NET", session.user.id, ["STORE_AND_TYRE"], ["mohit@fleet.com", "shahid@fleet.com"], "PLACEMENT_TEAM");
        } else {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueValue: "CARGO_NET", source: "PLACEMENT_TEAM", status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — field reset" },
          });
        }
      }
      if (hasTirpal) {
        if (tirpal === "NOT_AVAILABLE") {
          await raiseIssue(id, "EQUIPMENT", "TIRPAL", session.user.id, ["STORE_AND_TYRE"], ["mohit@fleet.com", "shahid@fleet.com"], "PLACEMENT_TEAM");
        } else {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueValue: "TIRPAL", source: "PLACEMENT_TEAM", status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — field reset" },
          });
        }
      }
      if (hasStepney) {
        if (stepney === "NOT_AVAILABLE") {
          await raiseIssue(id, "EQUIPMENT", "STEPNEY", session.user.id, ["STORE_AND_TYRE"], [], "PLACEMENT_TEAM");
        } else {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueValue: "STEPNEY", source: "PLACEMENT_TEAM", status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — field reset" },
          });
        }
      }
      if (hasIdfy) {
        if (idfyDrivers === "REQUIRED_NOT_AVAILABLE") {
          await raiseIssue(id, "DRIVER", "IDFY_NOT_AVAILABLE", session.user.id, ["DRIVER_MANAGEMENT"], [], "PLACEMENT_TEAM");
        } else {
          await prisma.issueAlert.updateMany({
            where: { placementId: id, issueValue: "IDFY_NOT_AVAILABLE", source: "PLACEMENT_TEAM", status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { status: "RESOLVED", resolvedById: session.user.id, resolvedAt: now, resolutionNote: "Cleared — field reset" },
          });
        }
      }

      await logAudit({
        userId: session.user.id,
        action: "REMARK_UPDATED",
        entity: "PLACEMENT",
        entityId: id,
        description: `${session.user.name} updated Placement Check for ${placement.client.name} — ${placement.vehicle?.vehicleNumber ?? ""}`,
        newValue: data,
        placementId: id,
      });

      return NextResponse.json(await getUpdatedPlacement(id));
    }

    if (section === "finalStatus") {
      if (role !== "PLACEMENT_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const current = await prisma.placement.findUnique({
        where: { id },
        include: { client: true, vehicle: true },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const VALID_STATUSES: FinalStatus[] = ["PLACED", "PENDING", "NOT_PLACED"];
      if (!VALID_STATUSES.includes(data.finalStatus as FinalStatus)) {
        return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
      }

      if (data.finalStatus === "PLACED") {
        const openCount = await prisma.issueAlert.count({
          where: { placementId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
        });
        if (openCount > 0) {
          return NextResponse.json(
            { error: `Cannot mark as Placed — this trip has ${openCount} open issue${openCount > 1 ? "s" : ""} that must be resolved first.` },
            { status: 409 }
          );
        }
      }

      const result = await prisma.placement.update({ where: { id }, data: { finalStatus: data.finalStatus as FinalStatus } });

      await logAudit({
        userId: session.user.id,
        action: "STATUS_CHANGED",
        entity: "PLACEMENT",
        entityId: id,
        description: `${session.user.name} changed status of ${current.client.name} (${current.vehicle?.vehicleNumber ?? ""}) ${current.finalStatus}→${data.finalStatus}`,
        oldValue: { finalStatus: current.finalStatus },
        newValue: { finalStatus: data.finalStatus },
        placementId: id,
      });

      return NextResponse.json(result);
    }

    if (section === "vehicleSwap") {
      if (role !== "PLACEMENT_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { vehicleId } = data;
      const current = await prisma.placement.findUnique({
        where: { id },
        include: { client: true, route: true, vehicle: true },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      let newVehicle = null;
      if (vehicleId) {
        newVehicle = await prisma.vehicle.findUnique({
          where: { id: vehicleId as string },
          select: { id: true, vehicleNumber: true, isActive: true },
        });
        if (!newVehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
        if (!newVehicle.isActive) return NextResponse.json({ error: "Vehicle is inactive and cannot be assigned." }, { status: 409 });

        const dateStart = new Date(current.date);
        dateStart.setUTCHours(0, 0, 0, 0);
        const dateEnd = new Date(dateStart.getTime() + 86400000);
        const conflict = await prisma.placement.findFirst({
          where: { vehicleId: vehicleId as string, date: { gte: dateStart, lt: dateEnd }, id: { not: id } },
          select: { client: { select: { name: true } }, route: { select: { name: true } } },
        });
        if (conflict) {
          return NextResponse.json(
            { error: `Vehicle already assigned to ${conflict.client.name} — ${conflict.route.name} on this date.` },
            { status: 409 }
          );
        }
      }

      const result = await prisma.placement.update({
        where: { id },
        data: { vehicleId: (vehicleId as string) || null },
      });

      // Bug 8 fix: vehicle-specific issues are no longer relevant after a swap.
      // Auto-resolve open MAINTENANCE and EQUIPMENT issues so teams aren't chasing problems on a vehicle that's gone.
      if (current.vehicleId !== (vehicleId || null)) {
        await prisma.issueAlert.updateMany({
          where: {
            placementId: id,
            issueCategory: { in: ["MAINTENANCE", "EQUIPMENT"] },
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          data: {
            status: "RESOLVED",
            resolvedById: session.user.id,
            resolvedAt: now,
            resolutionNote: `Auto-resolved: vehicle swapped from ${current.vehicle?.vehicleNumber ?? "none"} to ${newVehicle?.vehicleNumber ?? "none"}`,
          },
        });
      }

      await logAudit({
        userId: session.user.id,
        action: "UPDATED",
        entity: "PLACEMENT",
        entityId: id,
        description: `${session.user.name} swapped vehicle: ${current.vehicle?.vehicleNumber ?? "none"} → ${newVehicle?.vehicleNumber ?? "none"} for ${current.client.name} — ${current.route.name}`,
        oldValue: { vehicleNumber: current.vehicle?.vehicleNumber ?? null },
        newValue: { vehicleNumber: newVehicle?.vehicleNumber ?? null },
        placementId: id,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (err) {
    return apiError(err);
  }
}
