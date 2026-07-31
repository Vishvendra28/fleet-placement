import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";

function excelSerialToString(val: unknown): string | null {
  if (typeof val === "string" && val.trim()) return val.trim();
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

    // First pass: read only sheet names (fast, no data parsed)
    const wbMeta = xlsx.read(buffer, { bookSheets: true });
    const allSheetNames: string[] = wbMeta.SheetNames;

    // Find which sheets match our 5 targets
    const targetSheetNames: string[] = [];
    for (const def of SHEET_DEFS) {
      const match = allSheetNames.find((n) => n.toLowerCase().includes(def.match));
      if (match) targetSheetNames.push(match);
    }

    if (targetSheetNames.length === 0) {
      return NextResponse.json({
        error: `No matching sheets found. Sheets in file: ${allSheetNames.join(", ")}`,
      }, { status: 400 });
    }

    // Second pass: parse ONLY the 5 target sheets (skips the 65k-row summary sheet)
    const wb = xlsx.read(buffer, { sheets: targetSheetNames });

    const allParsed: ParsedRow[] = [];

    for (const def of SHEET_DEFS) {
      const sheetName = allSheetNames.find((n) => n.toLowerCase().includes(def.match));
      if (!sheetName || !wb.Sheets[sheetName]) continue;

      const rows: unknown[][] = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
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

    // Deduplicate — inactive sheet always beats active for the same vehicle
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
        unmatched.push({
          vehicleNumber: row.vehicleNumber,
          sheet: row.sheetLabel,
          location: row.location,
          remarks: row.remarks,
        });
        continue;
      }

      processedIds.add(dbV.id);
      if (row.inactive) markedInactive++;

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

      updates.push(
        prisma.vehicle.update({
          where: { id: dbV.id },
          data: {
            excelStatus: excelStatus as object,
            ...(row.inactive
              ? {
                  isActive: false,
                  inactiveReason: INACTIVE_REASON_MAP[row.sheetKey] || null,
                  inactiveComment: row.remarks || null,
                }
              : {}),
          },
        })
      );
    }

    // Auto-reactivate vehicles that were Excel-managed but no longer appear in any sheet
    for (const v of allVehicles) {
      if (processedIds.has(v.id)) continue;
      if (!v.excelStatus) continue;
      const wasInactiveByExcel =
        !v.isActive && v.inactiveReason && EXCEL_MANAGED_REASONS.includes(v.inactiveReason);
      updates.push(
        prisma.vehicle.update({
          where: { id: v.id },
          data: {
            excelStatus: null as unknown as object,
            ...(wasInactiveByExcel
              ? { isActive: true, inactiveReason: null, inactiveComment: null }
              : {}),
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
      sheetsFound: targetSheetNames,
      totalParsed: allParsed.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-excel]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
