const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "sanjeev@fleet.com" } });
  if (existing) {
    console.log("User sanjeev@fleet.com already exists, skipping.");
    return;
  }
  const passwordHash = await bcrypt.hash("Sanjeev@123", 10);
  const user = await prisma.user.create({
    data: {
      name: "Sanjeev",
      email: "sanjeev@fleet.com",
      passwordHash,
      role: "VEHICLE_HEALTH_TEAM",
    },
  });
  console.log("Created user:", user.name, user.email, user.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
