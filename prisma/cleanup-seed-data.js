const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oldClients = ['Flipkart', 'Safex Flexi', 'DTDc', 'Bluedart', 'Delhivery', 'Rivigo', 'Amazon'];
  const oldRoutes  = ['GGN-BGLR', 'BGLR-GGN', 'GGN-MUM', 'MUM-GGN', 'DEL-HYD'];
  const oldVehicles = ['HR26DK5678', 'DL1CB9900'];

  const clientRecords = await prisma.client.findMany({ where: { name: { in: oldClients } }, select: { id: true } });
  const clientIds = clientRecords.map(c => c.id);
  const p = await prisma.placement.deleteMany({ where: { clientId: { in: clientIds } } });
  console.log('Placements deleted (linked to old clients):', p.count);

  const c = await prisma.client.deleteMany({ where: { name: { in: oldClients } } });
  console.log('Clients deleted:', c.count);

  const r = await prisma.route.deleteMany({ where: { name: { in: oldRoutes } } });
  console.log('Routes deleted:', r.count);

  const v = await prisma.vehicle.deleteMany({ where: { vehicleNumber: { in: oldVehicles } } });
  console.log('Vehicles deleted:', v.count);

  console.log('\nDone. Remaining:');
  console.log('Clients:', await prisma.client.count());
  console.log('Routes:', await prisma.route.count());
  console.log('Vehicles:', await prisma.vehicle.count());
}

main().catch(console.error).finally(() => prisma.$disconnect());
