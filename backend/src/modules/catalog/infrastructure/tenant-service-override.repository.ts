import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface TenantServiceOverrideWriteModel {
  tenantId: string;
  masterServiceId: string;
  isEnabled: boolean;
  sellingPriceAmount: number | null;
  sellingPriceCurrency: string | null;
}

@Injectable()
export class TenantServiceOverrideRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantAndMasterService(tenantId: string, masterServiceId: string) {
    return this.prisma.tenantServiceOverride.findUnique({
      where: {
        tenantId_masterServiceId: {
          tenantId,
          masterServiceId,
        },
      },
    });
  }

  async findByTenantId(tenantId: string) {
    return this.prisma.tenantServiceOverride.findMany({
      where: { tenantId },
      orderBy: { masterServiceId: 'asc' },
    });
  }

  async create(data: TenantServiceOverrideWriteModel) {
    return this.prisma.tenantServiceOverride.create({ data });
  }

  async update(
    tenantId: string,
    masterServiceId: string,
    data: Omit<TenantServiceOverrideWriteModel, 'tenantId' | 'masterServiceId'>,
  ) {
    return this.prisma.tenantServiceOverride.update({
      where: {
        tenantId_masterServiceId: {
          tenantId,
          masterServiceId,
        },
      },
      data,
    });
  }

  async delete(tenantId: string, masterServiceId: string) {
    return this.prisma.tenantServiceOverride.delete({
      where: {
        tenantId_masterServiceId: {
          tenantId,
          masterServiceId,
        },
      },
    });
  }
}