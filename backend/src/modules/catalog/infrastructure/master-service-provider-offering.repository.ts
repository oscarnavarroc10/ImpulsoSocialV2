import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ProviderCapabilityContract,
  ProviderCapabilityKey,
} from '../domain/provider-capability';
import type { NormalizedProviderCapability } from './capability-normalizer';

export interface CreateOfferingInput {
  masterServiceId: string;
  providerServiceId: string;
  capabilityKey: ProviderCapabilityKey;
  contractVersion: string;
  contract: ProviderCapabilityContract;
  isEnabled?: boolean;
  isAvailable?: boolean;
  isSelected?: boolean;
}

@Injectable()
export class MasterServiceProviderOfferingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForMasterService(masterServiceId: string) {
    return this.prisma.masterServiceProviderOffering.findMany({
      where: { masterServiceId },
      orderBy: [{ isSelected: 'desc' }, { id: 'asc' }],
    });
  }

  async findSelectedAvailable(masterServiceId: string) {
    return this.prisma.masterServiceProviderOffering.findFirst({
      where: {
        masterServiceId,
        isEnabled: true,
        isAvailable: true,
        isSelected: true,
      },
      include: { providerService: true },
    });
  }

  async create(input: CreateOfferingInput) {
    return this.prisma.masterServiceProviderOffering.create({
      data: {
        ...input,
        contract: input.contract as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async createNormalized(
    masterServiceId: string,
    providerServiceId: string,
    normalized: NormalizedProviderCapability,
  ) {
    return this.prisma.masterServiceProviderOffering.upsert({
      where: {
        masterServiceId_providerServiceId: { masterServiceId, providerServiceId },
      },
      create: {
        masterServiceId,
        providerServiceId,
        capabilityKey: normalized.capabilityKey,
        contractVersion: normalized.contractVersion,
        contract: normalized.contract as unknown as Prisma.InputJsonValue,
      },
      update: {
        capabilityKey: normalized.capabilityKey,
        contractVersion: normalized.contractVersion,
        contract: normalized.contract as unknown as Prisma.InputJsonValue,
        isAvailable: true,
      },
    });
  }

  async select(masterServiceId: string, offeringId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const offering = await tx.masterServiceProviderOffering.findFirst({
          where: { id: offeringId, masterServiceId },
          select: { id: true },
        });
        if (!offering) return null;

        await tx.masterServiceProviderOffering.updateMany({
          where: { masterServiceId, isSelected: true },
          data: { isSelected: false },
        });

        return tx.masterServiceProviderOffering.update({
          where: { id: offeringId },
          data: { isSelected: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async disableUnavailableProviderServices(
    providerServiceIds: string[],
    providerOrigin = 'bulkfollows',
  ) {
    return this.prisma.masterServiceProviderOffering.updateMany({
      where: {
        ...(providerServiceIds.length > 0
          ? { providerServiceId: { notIn: providerServiceIds } }
          : {}),
        providerService: {
          providerOrigin,
        },
        isAvailable: true,
      },
      data: { isAvailable: false },
    });
  }
}