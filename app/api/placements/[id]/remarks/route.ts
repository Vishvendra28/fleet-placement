import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FinalStatus, IssueCategory } from "@prisma/client";
import { ISSUE_VALUE_LABELS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

async function raiseIssue(
  placementId: string,
  category: IssueCategory,
  issueValue: string,
  raisedById: string,
  notifyRoles: string[]
) {
  const existing = await prisma.issueAlert.findFirst({
    where: { placementId, issueCategory: category, issueValue, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (existing) return;

  const issue = await prisma.issueAlert.create({
    data: { placementId, issueCategory: category, issueValue, raisedById, status: "OPEN" },
  });

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    include: { client: true, route: true },
  });
  if (!placement) return;

  const recipients = await prisma.user.findMany({
    where: { role: { in: notifyRoles as never[] } },
    select: { id: true },
  });
  if (recipients.length) {
    const label = ISSUE_VALUE_LABELS[issueValue] || issueValue;
    await prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        placementId,
        type: "ISSUE_ALERT" as const,
        message: `ISSUE ALERT: ${placement.client.name} | ${placement.route.name} — ${label} needs attention`,
      })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    userId: raisedById,
    action: "ISSUE_RAISED",
    entity: "ISSUE",
    entityId: issue.id,
    description: `Issue raised for ${placement.client.name} — ${ISSUE_VALUE_LABELS[issueValue] || issueValue} (${category})`,
    placementId,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    const remarkData = {
      driverIssue: (driverIssue as string | undefined) ?? null,
      maintenanceIssue: (maintenanceIssue as string | undefined) ?? null,
    };
    const result = section === "d1"
      ? await prisma.d1PlanningRemark.upsert({
          where: { placementId: id },
          create: { placementId: id, ...remarkData, filledById: session.user.id, filledAt: now },
          update: { ...remarkData, filledById: session.user.id, filledAt: now },
        })
      : await prisma.sameDayPlanningRemark.upsert({
          where: { placementId: id },
          create: { placementId: id, ...remarkData, filledById: session.user.id, filledAt: now },
          update: { ...remarkData, filledById: session.user.id, filledAt: now },
        });

    if (driverIssue && driverIssue !== "NO_ISSUE") {
      await raiseIssue(id, "DRIVER", driverIssue as string, session.user.id, ["DRIVER_MANAGEMENT"]);
    }
    if (maintenanceIssue && maintenanceIssue !== "NO_ISSUE") {
      await raiseIssue(id, "MAINTENANCE", maintenanceIssue as string, session.user.id, ["MAINTENANCE_TEAM"]);
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

    return NextResponse.json(result);
  }

  if (section === "placementTeam") {
    if (role !== "PLACEMENT_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const placement = await prisma.placement.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });
    if (!placement) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { elockStatus, idfyDrivers, cargoNet, tirpal, stepney } = data;
    const ptData = {
      elockStatus: (elockStatus as string | undefined) ?? null,
      idfyDrivers: (idfyDrivers as string | undefined) ?? null,
      cargoNet: (cargoNet as string | undefined) ?? null,
      tirpal: (tirpal as string | undefined) ?? null,
      stepney: (stepney as string | undefined) ?? null,
    };
    const result = await prisma.placementTeamRemark.upsert({
      where: { placementId: id },
      create: { placementId: id, ...ptData, filledById: session.user.id, filledAt: now },
      update: { ...ptData, filledById: session.user.id, filledAt: now },
    });

    if (elockStatus === "UNHEALTHY" || elockStatus === "LOCK_DAMAGE") {
      await raiseIssue(id, "EQUIPMENT", elockStatus as string, session.user.id, ["MAINTENANCE_TEAM"]);
    }
    if (cargoNet === "NOT_AVAILABLE") await raiseIssue(id, "EQUIPMENT", "CARGO_NET", session.user.id, ["MAINTENANCE_TEAM"]);
    if (tirpal === "NOT_AVAILABLE") await raiseIssue(id, "EQUIPMENT", "TIRPAL", session.user.id, ["MAINTENANCE_TEAM"]);
    if (stepney === "NOT_AVAILABLE") await raiseIssue(id, "EQUIPMENT", "STEPNEY", session.user.id, ["MAINTENANCE_TEAM"]);
    if (idfyDrivers === "REQUIRED_NOT_AVAILABLE") {
      await raiseIssue(id, "DRIVER", "IDFY_NOT_AVAILABLE", session.user.id, ["DRIVER_MANAGEMENT"]);
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

    return NextResponse.json(result);
  }

  if (section === "finalStatus") {
    if (role !== "PLACEMENT_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const current = await prisma.placement.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
}
