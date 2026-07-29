import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ProviderServiceBatchItem {
  providerOrigin: string;
  externalId: string;
  rawPayload: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class ProviderServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.providerService.findUnique({
      where: { id },
    });
  }

  async findByOriginAndExternalId(providerOrigin: string, externalId: string) {
    return this.prisma.providerService.findUnique({
      where: {
        providerOrigin_externalId: {
          providerOrigin,
          externalId,
        },
      },
    });
  }

  async findManyByOriginAndExternalIds(
    providerOrigin: string,
    externalIds: string[],
  ) {
    if (externalIds.length === 0) {
      return [];
    }

    return this.prisma.providerService.findMany({
      where: {
        providerOrigin,
        externalId: {
          in: externalIds,
        },
      },
      select: {
        id: true,
        externalId: true,
        importTimestamp: true,
      },
    });
  }

  async createMany(items: ProviderServiceBatchItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const importTimestamp = new Date();

    const result = await this.prisma.providerService.createMany({
      data: items.map((item) => ({
        providerOrigin: item.providerOrigin,
        externalId: item.externalId,
        rawPayload: item.rawPayload,
        importTimestamp,
        metadata: item.metadata ?? undefined,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async updateMany(
    items: ProviderServiceBatchItem[],
    batchSize = 500,
  ): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    let updated = 0;

    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const importTimestamp = new Date();

      await this.prisma.$transaction(
        batch.map((item) =>
          this.prisma.providerService.update({
            where: {
              providerOrigin_externalId: {
                providerOrigin: item.providerOrigin,
                externalId: item.externalId,
              },
            },
            data: {
              rawPayload: item.rawPayload,
              importTimestamp,
              metadata: item.metadata ?? undefined,
            },
          }),
        ),
      );

      updated += batch.length;
    }

    return updated;
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.providerService.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        externalId: true,
        importTimestamp: true,
      },
    });
  }
}
