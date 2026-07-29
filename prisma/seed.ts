import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hashSync(pw, 10);

async function main() {
  console.log("Seeding database...");

  // KAMs
  const harish = await prisma.user.upsert({ where: { email: "harish@fleet.com" }, update: {}, create: { name: "Harish", email: "harish@fleet.com", passwordHash: hash("fleet123"), role: "KAM" } });
  const aman   = await prisma.user.upsert({ where: { email: "aman@fleet.com" }, update: {}, create: { name: "Aman", email: "aman@fleet.com", passwordHash: hash("fleet123"), role: "KAM" } });
  const asif   = await prisma.user.upsert({ where: { email: "asif@fleet.com" }, update: {}, create: { name: "Asif", email: "asif@fleet.com", passwordHash: hash("fleet123"), role: "KAM" } });
  const ashish = await prisma.user.upsert({ where: { email: "ashish@fleet.com" }, update: {}, create: { name: "Ashish", email: "ashish@fleet.com", passwordHash: hash("fleet123"), role: "KAM" } });

  // Admin
  await prisma.user.upsert({ where: { email: "admin@fleet.com" }, update: {}, create: { name: "Admin", email: "admin@fleet.com", passwordHash: hash("admin123"), role: "ADMIN" } });

  // Planning Team
  for (const [name, email] of [["Jay","jay"],["Vijay","vijay"],["Monu","monu"],["Vatan","vatan"]]) {
    await prisma.user.upsert({ where: { email: `${email}@fleet.com` }, update: {}, create: { name, email: `${email}@fleet.com`, passwordHash: hash("fleet123"), role: "PLANNING_TEAM" } });
  }

  // Placement Team
  for (const [name, email] of [["Alok","alok"],["Atul","atul"],["Guddu","guddu"]]) {
    await prisma.user.upsert({ where: { email: `${email}@fleet.com` }, update: {}, create: { name, email: `${email}@fleet.com`, passwordHash: hash("fleet123"), role: "PLACEMENT_TEAM" } });
  }

  // Driver & Maintenance
  await prisma.user.upsert({ where: { email: "maninder@fleet.com" }, update: {}, create: { name: "Maninder", email: "maninder@fleet.com", passwordHash: hash("fleet123"), role: "DRIVER_MANAGEMENT" } });
  await prisma.user.upsert({ where: { email: "deepak@fleet.com" }, update: {}, create: { name: "Deepak", email: "deepak@fleet.com", passwordHash: hash("fleet123"), role: "MAINTENANCE_TEAM" } });

  // Clients
  const clients = [
    { name: "Flipkart", kam: harish }, { name: "Gatik", kam: harish },
    { name: "Safex Flexi", kam: harish }, { name: "DTDc", kam: harish },
    { name: "Bluedart", kam: aman }, { name: "Delhivery", kam: aman },
    { name: "SDFAX", kam: asif }, { name: "Rivigo", kam: asif }, { name: "Meesho", kam: asif },
    { name: "Amazon", kam: ashish }, { name: "DHL", kam: ashish },
  ];
  for (const c of clients) {
    await prisma.client.upsert({ where: { name: c.name }, update: {}, create: { name: c.name, kamId: c.kam.id } });
  }

  // Routes
  const routes = [
    { name: "GGN-BGLR", origin: "Gurgaon", destination: "Bengaluru" },
    { name: "BGLR-GGN", origin: "Bengaluru", destination: "Gurgaon" },
    { name: "GGN-MUM",  origin: "Gurgaon",  destination: "Mumbai"   },
    { name: "MUM-GGN",  origin: "Mumbai",    destination: "Gurgaon"  },
    { name: "DEL-HYD",  origin: "Delhi",     destination: "Hyderabad"},
  ];
  for (const r of routes) {
    await prisma.route.upsert({ where: { name: r.name }, update: {}, create: r });
  }

  // Vehicles
  for (const [vehicleNumber, type] of [["HR26DK1234","32ft HCV"],["HR26DK5678","32ft HCV"],["DL1CB9900","20ft MCV"]]) {
    await prisma.vehicle.upsert({ where: { vehicleNumber }, update: {}, create: { vehicleNumber, type } });
  }

  console.log("\n✅ Seed complete! Default logins:");
  console.log("   Admin:          admin@fleet.com  / admin123");
  console.log("   Planning Team:  jay@fleet.com    / fleet123");
  console.log("   Placement Team: alok@fleet.com   / fleet123");
  console.log("   KAM (Harish):   harish@fleet.com / fleet123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
