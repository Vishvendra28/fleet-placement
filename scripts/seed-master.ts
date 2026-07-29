import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLIENTS = [
  "AMZ", "FKT", "SDFAX", "XPB", "DHL",
  "Gatik", "Safe Flexi", "BDHAR", "DP World",
  "DTDC", "Meesho", "RIVIGO",
];

const ROUTES: { name: string; origin: string; destination: string }[] = [
  { name: "MDEA-BCTX", origin: "MDEA", destination: "BCTX" },
  { name: "MDEA-MRJA", origin: "MDEA", destination: "MRJA" },
  { name: "GGN-HYD-MAA", origin: "GGN", destination: "MAA" },
  { name: "GGN-BWD", origin: "GGN", destination: "BWD" },
  { name: "GGN-BLR", origin: "GGN", destination: "BLR" },
  { name: "BWD-CCU", origin: "BWD", destination: "CCU" },
  { name: "GGN-CCU", origin: "GGN", destination: "CCU" },
  { name: "GGN-NAG", origin: "GGN", destination: "NAG" },
  { name: "GGN-HYD", origin: "GGN", destination: "HYD" },
  { name: "BWD-PUN-NAG-BBI-CCU", origin: "BWD", destination: "CCU" },
  { name: "BLR-BBI-CCU", origin: "BLR", destination: "CCU" },
  { name: "BWD-KOP-BLR", origin: "BWD", destination: "BLR" },
  { name: "BWD-PUN-BLR", origin: "BWD", destination: "BLR" },
  { name: "GGN-JPR-AMD-BRD-BWD", origin: "GGN", destination: "BWD" },
  { name: "BWD-BBI", origin: "BWD", destination: "BBI" },
  { name: "BWD-SGU-GUA", origin: "BWD", destination: "GUA" },
  { name: "RJN11-HBU11-BLR11", origin: "RJN11", destination: "BLR11" },
  { name: "RJN11-HBU11-MAD11", origin: "RJN11", destination: "MAD11" },
  { name: "JPR-DUL-RJN11", origin: "JPR", destination: "RJN11" },
  { name: "SNP11-BLR11", origin: "SNP11", destination: "BLR11" },
  { name: "MDEA-NAGX", origin: "MDEA", destination: "NAGX" },
  { name: "DED3-BOM5", origin: "DED3", destination: "BOM5" },
  { name: "NAG-RPR-CCU", origin: "NAG", destination: "CCU" },
  { name: "VPI-BRD-IDR-CCU", origin: "VPI", destination: "CCU" },
  { name: "KDLI-HYD-BLR", origin: "KDLI", destination: "BLR" },
  { name: "GGN-MAA", origin: "GGN", destination: "MAA" },
  { name: "VPI-BWD", origin: "VPI", destination: "BWD" },
  { name: "VPI-GGN", origin: "VPI", destination: "GGN" },
  { name: "GGN-IND-PUN", origin: "GGN", destination: "PUN" },
  { name: "GGN-TAURU-JBP-NAG", origin: "GGN", destination: "NAG" },
  { name: "SRT-NAG-CCU", origin: "SRT", destination: "CCU" },
  { name: "GGN-PAT", origin: "GGN", destination: "PAT" },
  { name: "GGN-HSKT-CJB-COK", origin: "GGN", destination: "COK" },
  { name: "AGRS-AGFS-PGS1", origin: "AGRS", destination: "PGS1" },
  { name: "DGS8-KBS-LCS-L3LS", origin: "DGS8", destination: "L3LS" },
  { name: "DGS4-BWS", origin: "DGS4", destination: "BWS" },
  { name: "BWD-IDR", origin: "BWD", destination: "IDR" },
  { name: "NCRX-CCUY", origin: "NCRX", destination: "CCUY" },
  { name: "PTD-KNP-GUA", origin: "PTD", destination: "GUA" },
  { name: "DEL-SGU-GUA", origin: "DEL", destination: "GUA" },
  { name: "JPR-PAT-GUA", origin: "JPR", destination: "GUA" },
  { name: "GGN-SLM-CJB", origin: "GGN", destination: "CJB" },
];

const VENDORS = ["AS Motors", "Dynamic", "Shiv Shakti", "Om Cargo", "Mahadav", "DG Roadline"];

type MasterEntry = {
  client: string;
  route: string;
  cohort: string;
  time: string;
  compliance: string;
  vendor: string | null;
};

const MASTER_ROUTES: MasterEntry[] = [
  // Fleet own — SCH 02 Way
  { client: "AMZ", route: "MDEA-BCTX", cohort: "SCH 02 Way", time: "01:00", compliance: "E_LOCK_IDFY", vendor: null },
  { client: "AMZ", route: "MDEA-MRJA", cohort: "SCH 02 Way", time: "02:00", compliance: "E_LOCK_IDFY", vendor: null },
  { client: "FKT", route: "GGN-HYD-MAA", cohort: "SCH 02 Way", time: "18:00", compliance: "E_LOCK", vendor: null },
  { client: "FKT", route: "GGN-BWD", cohort: "SCH 02 Way", time: "18:00", compliance: "E_LOCK", vendor: null },
  { client: "FKT", route: "GGN-BLR", cohort: "SCH 02 Way", time: "18:00", compliance: "E_LOCK", vendor: null },
  { client: "FKT", route: "BWD-CCU", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "SDFAX", route: "GGN-CCU", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "SDFAX", route: "GGN-NAG", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "SDFAX", route: "GGN-HYD", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "XPB", route: "BWD-PUN-NAG-BBI-CCU", cohort: "SCH 02 Way", time: "20:00", compliance: "E_LOCK", vendor: null },
  { client: "XPB", route: "BLR-BBI-CCU", cohort: "SCH 02 Way", time: "20:00", compliance: "E_LOCK", vendor: null },
  { client: "XPB", route: "BWD-KOP-BLR", cohort: "SCH 02 Way", time: "21:00", compliance: "E_LOCK", vendor: null },
  { client: "DHL", route: "BWD-PUN-BLR", cohort: "SCH 02 Way", time: "18:00", compliance: "E_LOCK", vendor: null },
  { client: "DHL", route: "GGN-JPR-AMD-BRD-BWD", cohort: "SCH 02 Way", time: "20:00", compliance: "E_LOCK", vendor: null },
  { client: "Gatik", route: "BWD-BBI", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "Gatik", route: "BWD-SGU-GUA", cohort: "SCH 02 Way", time: "12:30", compliance: "E_LOCK", vendor: null },
  { client: "Safe Flexi", route: "RJN11-HBU11-BLR11", cohort: "SCH 02 Way", time: "10:00", compliance: "E_LOCK", vendor: null },
  { client: "Safe Flexi", route: "RJN11-HBU11-MAD11", cohort: "SCH 02 Way", time: "09:00", compliance: "E_LOCK", vendor: null },
  { client: "Safe Flexi", route: "JPR-DUL-RJN11", cohort: "SCH 02 Way", time: "12:30", compliance: "E_LOCK", vendor: null },
  { client: "Safe Flexi", route: "SNP11-BLR11", cohort: "SCH 02 Way", time: "20:00", compliance: "E_LOCK", vendor: null },
  // Fleet own — SCH 1 Way
  { client: "AMZ", route: "MDEA-NAGX", cohort: "SCH 1 Way", time: "02:00", compliance: "E_LOCK_IDFY", vendor: null },
  { client: "AMZ", route: "DED3-BOM5", cohort: "SCH 1 Way", time: "16:00", compliance: "E_LOCK_IDFY", vendor: null },
  { client: "BDHAR", route: "NAG-RPR-CCU", cohort: "SCH 1 Way", time: "23:00", compliance: "E_LOCK", vendor: null },
  { client: "BDHAR", route: "VPI-BRD-IDR-CCU", cohort: "SCH 1 Way", time: "23:00", compliance: "E_LOCK", vendor: null },
  { client: "BDHAR", route: "KDLI-HYD-BLR", cohort: "SCH 1 Way", time: "21:00", compliance: "E_LOCK", vendor: null },
  { client: "SDFAX", route: "GGN-MAA", cohort: "SCH 1 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  { client: "DP World", route: "VPI-BWD", cohort: "SCH 1 Way", time: "09:00", compliance: "E_LOCK", vendor: null },
  { client: "DP World", route: "VPI-GGN", cohort: "SCH 1 Way", time: "21:00", compliance: "E_LOCK", vendor: null },
  { client: "DTDC", route: "GGN-IND-PUN", cohort: "SCH 1 Way", time: "22:00", compliance: "E_LOCK", vendor: null },
  // Third-party vendors — SCH 02 Way
  { client: "SDFAX", route: "GGN-TAURU-JBP-NAG", cohort: "SCH 02 Way", time: "20:00", compliance: "E_LOCK", vendor: "AS Motors" },
  { client: "SDFAX", route: "SRT-NAG-CCU", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: "Dynamic" },
  { client: "SDFAX", route: "GGN-PAT", cohort: "SCH 02 Way", time: "21:00", compliance: "E_LOCK", vendor: "Dynamic" },
  { client: "XPB", route: "GGN-HSKT-CJB-COK", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: "Shiv Shakti" },
  { client: "Meesho", route: "AGRS-AGFS-PGS1", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: "Dynamic" },
  { client: "Meesho", route: "DGS8-KBS-LCS-L3LS", cohort: "SCH 02 Way", time: "23:00", compliance: "E_LOCK", vendor: "Dynamic" },
  { client: "Meesho", route: "DGS4-BWS", cohort: "SCH 02 Way", time: "18:00", compliance: "E_LOCK", vendor: "Dynamic" },
  { client: "DHL", route: "BWD-IDR", cohort: "SCH 02 Way", time: "22:00", compliance: "E_LOCK", vendor: "Om Cargo" },
  // Third-party vendors — SCH 02 Way / SCH 1 Way
  { client: "AMZ", route: "NCRX-CCUY", cohort: "SCH 02 Way", time: "00:45", compliance: "E_LOCK_IDFY", vendor: "Mahadav" },
  { client: "BDHAR", route: "PTD-KNP-GUA", cohort: "SCH 1 Way", time: "11:00", compliance: "E_LOCK", vendor: "Mahadav" },
  { client: "DTDC", route: "DEL-SGU-GUA", cohort: "SCH 1 Way", time: "09:00", compliance: "E_LOCK", vendor: "Mahadav" },
  { client: "RIVIGO", route: "JPR-PAT-GUA", cohort: "SCH 1 Way", time: "22:00", compliance: "E_LOCK", vendor: "Mahadav" },
  { client: "RIVIGO", route: "GGN-SLM-CJB", cohort: "SCH 1 Way", time: "10:00", compliance: "E_LOCK", vendor: "DG Roadline" },
];

async function main() {
  console.log("Seeding master data...");

  // Upsert clients
  const clientMap: Record<string, string> = {};
  for (const name of CLIENTS) {
    const c = await prisma.client.upsert({ where: { name }, update: {}, create: { name } });
    clientMap[name] = c.id;
  }
  console.log(`✓ ${CLIENTS.length} clients`);

  // Upsert routes
  const routeMap: Record<string, string> = {};
  for (const r of ROUTES) {
    const route = await prisma.route.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, origin: r.origin, destination: r.destination },
    });
    routeMap[r.name] = route.id;
  }
  console.log(`✓ ${ROUTES.length} routes`);

  // Upsert vendors
  const vendorMap: Record<string, string> = {};
  for (const name of VENDORS) {
    const v = await prisma.vendor.upsert({ where: { name }, update: {}, create: { name } });
    vendorMap[name] = v.id;
  }
  console.log(`✓ ${VENDORS.length} vendors`);

  // Create master routes (skip duplicates)
  let created = 0;
  for (const entry of MASTER_ROUTES) {
    const clientId = clientMap[entry.client];
    const routeId = routeMap[entry.route];
    const vendorId = entry.vendor ? vendorMap[entry.vendor] : null;

    if (!clientId) { console.warn(`Unknown client: ${entry.client}`); continue; }
    if (!routeId) { console.warn(`Unknown route: ${entry.route}`); continue; }

    const exists = await prisma.masterRoute.findFirst({
      where: { clientId, routeId, cohort: entry.cohort },
    });
    if (!exists) {
      await prisma.masterRoute.create({
        data: { clientId, routeId, cohort: entry.cohort, placementTime: entry.time, compliance: entry.compliance, vendorId },
      });
      created++;
    }
  }
  console.log(`✓ ${created} master routes created`);
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
