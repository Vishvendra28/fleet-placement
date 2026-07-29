const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.vehicle.count();
  console.log('Vehicles before cleanup:', before);

  const used = await prisma.vehicle.findMany({
    where: { placements: { some: {} } },
    select: { id: true, vehicleNumber: true },
  });
  console.log('Vehicles with placements (keeping):', used.length);
  used.forEach(v => console.log(' -', v.vehicleNumber));

  const deleted = await prisma.vehicle.deleteMany({
    where: { placements: { none: {} } },
  });
  console.log('Deleted (no placements):', deleted.count);

  const after = await prisma.vehicle.count();
  console.log('Vehicles after cleanup:', after);
}

main().catch(console.error).finally(() => prisma.$disconnect());
