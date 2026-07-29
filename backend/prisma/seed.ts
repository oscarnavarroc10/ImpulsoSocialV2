import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('La variable de entorno DATABASE_URL no está configurada');
}

const adapter = new PrismaMariaDb(databaseUrl);

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  const tienda = await prisma.tienda.upsert({
    where: {
      slug: 'impulsosocial',
    },
    update: {
      nombre: 'ImpulsoSocial',
      moneda: 'MXN',
      activa: true,
    },
    create: {
      nombre: 'ImpulsoSocial',
      slug: 'impulsosocial',
      moneda: 'MXN',
      activa: true,
    },
  });

  console.log('Tienda inicial lista:', {
    id: tienda.id,
    nombre: tienda.nombre,
    slug: tienda.slug,
    moneda: tienda.moneda,
    activa: tienda.activa,
  });
}

main()
  .catch((error: unknown) => {
    console.error('Error ejecutando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
