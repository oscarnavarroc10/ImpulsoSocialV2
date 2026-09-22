import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const SUPPORTED_NETWORKS = ['Instagram', 'TikTok', 'YouTube', 'Facebook'];
const apply = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
  });
  try {
    const candidates = await prisma.masterService.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        title: true,
        socialNetwork: true,
        categoryId: true,
      },
    });

    const categoryIds = [...new Set(candidates.map((item) => item.categoryId))];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryById = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const invalid = candidates.filter((item) => {
      const categoryName = categoryById
        .get(item.categoryId)
        ?.toLocaleLowerCase();
      return (
        !SUPPORTED_NETWORKS.includes(item.socialNetwork) ||
        categoryName === 'instagram' ||
        categoryName === 'tiktok' ||
        categoryName === 'youtube' ||
        categoryName === 'facebook'
      );
    });

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          count: invalid.length,
          items: invalid,
        },
        null,
        2,
      ),
    );
    if (apply) {
      for (const item of invalid) {
        await prisma.masterService.update({
          where: { id: item.id },
          data: { status: 'deprecated', isVisible: false },
        });
      }
      console.log(
        `Deprecated ${invalid.length} invalid active master services.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
