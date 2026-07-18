import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProviderServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsertByOriginAndExternalId(data: {
    providerOrigin: string;
    externalId: string;
    rawPayload: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }) {
    const { providerOrigin, externalId, rawPayload, metadata } = data;

    return this.prisma.providerService.upsert({
      where: {
        providerOrigin_externalId: {
          providerOrigin,
          externalId,
        },
      },
      update: {
        rawPayload,
        importTimestamp: new Date(),
        metadata: metadata ?? undefined,
      },
      create: {
        providerOrigin,
        externalId,
        rawPayload,
        importTimestamp: new Date(),
        metadata: metadata ?? undefined,
      },
    });
  }
}
