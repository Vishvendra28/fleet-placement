import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

function excelSerialToString(val: unknown): string | null {
  if (typeof val !== "number" || val < 1) return null;
  const d = new Date(Math.round((val - 25569) * 86400 * 1000));
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeVN(val: unknown): string {
  return String(val || "").replace(/\s+/g, "").toUpperCase().trim();
}

type SheetKey = "MINOR_MAINTENANCE" | "MAJOR_MAINTENANCE" | "WITHOUT_DRIVER" | "ACCIDENT" | "DOCUMENTS";

type ParsedRow = {
  vehicleNumber: string;
  sheetKey: SheetKey;
  sheetLabel: string;
  inactive: boolean;
  location: string;
  remarks: string;
  eta: string | null;
  inactiveDays: number;
  client: string;
  route: string;
  amc: string;
};

const SHEET_DEFS: { key: SheetKey; label: string; match: string; inactive: boolean }[] = [
  { key: "MINOR_MAINTENANCE", label: "Minor Maintenance", match: "minor",    inactive: false },
  { key: "WITHOUT_DRIVER",    label: "Without Driver",   match: "driver",   inactive: false },
  { key: "MAJOR_MAINTENANCE", label: "Major Maintenance", match: "major",   inactive: true },
  { key: "ACCIDENT",          label: "Accident",         match: "accident", inactive: true },
  { key: "DOCUMENTS",         label: "Document Issue",   match: "doc",      inactive: true },
];

const INACTIVE_REASON_MAP: Record<string, string> = {
  MAJOR_MAINTENANCE: "MAJOR_MAINTENANCE",
  ACCIDENT: "ACCIDENT",
  DOCUMENTS: "DOCUMENT_ISSUES",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const xlsx = require("xlsx");
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheetNames: string[] = wb.SheetNames;

    const allParsed: ParsedRow[] = [];

    for (const def of SHEET_DEFS) {
      const sheetName = sheetNames.find((n: string) => n.toLowerCase().includes(def.match));
      if (!sheetName) continue;
      const rows: unknown[][] = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const vn = normalizeVN(row[2]);
        if (!vn || vn.length < 4) continue;
        allParsed.push({
          vehicleNumber: vn,
          sheetKey: def.key,
          sheetLabel: def.label,
          inactive: def.inactive,
          location: String(row[6] || "").trim(),
          remarks: String(row[7] || "").trim(),
          eta: excelSerialToString(row[9]),
          inactiveDays: typeof row[8] === "number" ? Math.round(row[8]) : 0,
          client: String(row[4] || "").trim(),
          route: String(row[5] || "").trim(),
          amc: String(row[3] || "").trim(),
        });
      }
    }

    // Deduplicate by vehicle number — inactive sheet wins over active; otherwise last sheet in SHEET_DEFS order wins
    const vehicleExcelMap = new Map<string, ParsedRow>();
    for (const row of allParsed) {
      const existing = vehicleExcelMap.get(row.vehicleNumber);
      if (!existing || (!existing.inactive && row.inactive)) {
        vehicleExcelMap.set(row.vehicleNumber, row);
      }
    }

    const allVehicles = await prisma.vehicle.findMany({
      select: { id: true, vehicleNumber: true, isActive: true, inactiveReason: true, excelStatus: true },
    });
    const dbMap = new Map<string, typeof allVehicles[0]>();
    for (const v of allVehicles) {
      dbMap.set(normalizeVN(v.vehicleNumber), v);
    }

    const syncedAt = new Date().toISOString();
    const EXCEL_MANAGED_REASONS = ["MAJOR_MAINTENANCE", "ACCIDENT", "DOCUMENT_ISSUES"];
    const processedIds = new Set<string>();
    const unmatched: { vehicleNumber: string; sheet: string; location: string; remarks: string }[] = [];
    let markedInactive = 0;
    const updates: Promise<unknown>[] = [];

    for (const [, row] of vehicleExcelMap) {
      const dbV = dbMap.get(row.vehicleNumber);
      if (!dbV) {
        unmatched.push({ vehicleNumber: row.vehicleNumber, sheet: row.sheetLabel, location: row.location, remarks: row.remarks });
        continue;
      }
      processedIds.add(dbV.id);
      const excelStatus = {
        sheet: row.sheetKey,
        sheetLabel: row.sheetLabel,
        location: row.location,
        remarks: row.remarks,
        eta: row.eta,
        inactiveDays: row.inactiveDays,
        client: row.client,
        route: row.route,
        amc: row.amc,
        syncedAt,
      };
      if (row.inactive) markedInactive++;
      updates.push(
        prisma.vehicle.update({
          where: { id: dbV.id },
          data: {
            excelStatus,
            ...(row.inactive
              ? { isActive: false, inactiveReason: INACTIVE_REASON_MAP[row.sheetKey] || null, inactiveComment: row.remarks || null }
              : {}),
          },
        })
      );
    }

    // Auto-reactivate vehicles previously managed by Excel that are no longer in any sheet
    for (const v of allVehicles) {
      if (processedIds.has(v.id)) continue;
      if (!v.excelStatus) continue;
      const wasInactiveByExcel = !v.isActive && v.inactiveReason && EXCEL_MANAGED_REASONS.includes(v.inactiveReason);
      updates.push(
        prisma.vehicle.update({
          where: { id: v.id },
          data: {
            excelStatus: null,
            ...(wasInactiveByExcel ? { isActive: true, inactiveReason: null, inactiveComment: null } : {}),
          },
        })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({
      ok: true,
      syncedAt,
      matched: processedIds.size,
      markedInactive,
      unmatched,
    });
  } catch (err) {
    return apiError(err);
  }
}
