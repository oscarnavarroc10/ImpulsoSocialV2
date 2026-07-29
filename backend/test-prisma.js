const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

  const prisma = new PrismaClient({
    adapter,
  });

  await prisma.$connect();

  console.log("✅ Prisma connected");

  await prisma.$disconnect();
}

require("dotenv").config();

main().catch(console.error);