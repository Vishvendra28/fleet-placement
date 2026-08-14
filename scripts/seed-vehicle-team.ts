import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync("fleet123", 10);

  const user = await prisma.user.upsert({
    where: { email: "vehicle.team@fleet.com" },
    update: {},
    create: {
      name: "Vehicle Team",
      email: "vehicle.team@fleet.com",
      passwordHash,
      role: "VEHICLE_HEALTH_TEAM",
    },
  });

  console.log("Created/found Vehicle Team user:", user.email, "role:", user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
