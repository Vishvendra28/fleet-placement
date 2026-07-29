const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      name: true,
      createdAt: true,
      masterRoutes: { select: { id: true } },
    },
  });

  console.log('\n=== ALL CLIENTS (with master route count) ===');
  clients.forEach(c => {
    console.log(`${c.createdAt.toISOString().slice(0,10)}  routes:${c.masterRoutes.length}  ${c.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
