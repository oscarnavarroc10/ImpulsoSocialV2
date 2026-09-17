import { Injectable } from '@nestjs/common';
import {
  EstadoDeposito,
  MetodoDeposito,
  Prisma,
  TipoMovimientoSaldo,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DepositMethod } from '../application/dto/deposit.dto';

export interface DepositScope {
  tenantId: string;
  userId: string;
  currency: string;
}

export interface DepositFilters {
  status?: EstadoDeposito;
  method?: DepositMethod;
}

export interface AdminDepositFilters extends DepositFilters {
  userId?: string;
}

export interface DepositRecord {
  id: string;
  tenantId: string;
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  method: MetodoDeposito;
  status: EstadoDeposito;
  provider: string | null;
  reference: string | null;
  receiptUrl: string | null;
  providerData: Prisma.JsonValue | null;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; name: string; email: string };
}

export interface CreationInput {
  id: string;
  tenantId: string;
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  method: MetodoDeposito;
  provider: string;
  reference: string;
  receiptUrl: string | null;
  fingerprint: string;
}

export interface ApprovalInput {
  tenantId: string;
  depositId: string;
  adminId: string;
  currency: string;
}

export interface ApprovalInvariant {
  deposit: {
    id: string;
    walletId: string;
    amount: number;
    status: EstadoDeposito;
    tenantId: string;
  };
  movement: {
    id: string;
    walletId: string;
    type: TipoMovimientoSaldo;
    amount: number;
    reference: string | null;
    balanceAfter: number;
  } | null;
}

export class DepositNotFoundError extends Error {}
export class DepositDecisionRaceError extends Error {}
export class DepositWalletRaceError extends Error {}
export class DepositBalanceOverflowError extends Error {}

const manualDepositWhere = {
  OR: [
    {
      metodo: MetodoDeposito.transferencia,
      proveedorPago: 'manual-transfer',
    },
    {
      metodo: MetodoDeposito.criptomoneda,
      proveedorPago: 'manual-crypto',
    },
  ],
} satisfies Prisma.DepositoWhereInput;

const depositSelect = {
  id: true,
  tiendaId: true,
  billeteraId: true,
  monto: true,
  moneda: true,
  metodo: true,
  estado: true,
  proveedorPago: true,
  referenciaExterna: true,
  comprobanteUrl: true,
  datosProveedor: true,
  aprobadoPorId: true,
  aprobadoEn: true,
  rechazadoEn: true,
  motivoRechazo: true,
  creadoEn: true,
  actualizadoEn: true,
  billetera: {
    select: {
      usuarioId: true,
      tiendaId: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
} satisfies Prisma.DepositoSelect;

type DepositRow = Prisma.DepositoGetPayload<{ select: typeof depositSelect }>;

@Injectable()
export class DepositRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTenantCurrency(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tienda.findFirst({
      where: { id: tenantId, activa: true },
      select: { moneda: true },
    });
    return tenant?.moneda ?? null;
  }

  async findCanonicalWallet(
    tenantId: string,
    userId: string,
    currency: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.billetera.findFirst({
      where: {
        tiendaId: tenantId,
        usuarioId: userId,
        moneda: currency,
        usuario: { estado: 'activo', tiendaId: tenantId },
      },
      select: { id: true },
    });
  }

  async findCreationClaim(
    depositId: string,
    tenantId: string,
    userId: string,
  ): Promise<DepositRecord | null> {
    const row = await this.prisma.deposito.findFirst({
      where: {
        id: depositId,
        tiendaId: tenantId,
        billetera: { is: { tiendaId: tenantId, usuarioId: userId } },
      },
      select: depositSelect,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByEvidence(
    tenantId: string,
    provider: string,
    reference: string,
  ): Promise<DepositRecord | null> {
    const row = await this.prisma.deposito.findFirst({
      where: {
        tiendaId: tenantId,
        proveedorPago: provider,
        referenciaExterna: reference,
      },
      select: depositSelect,
    });
    return row ? this.toRecord(row) : null;
  }

  async createPending(input: CreationInput): Promise<DepositRecord> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tienda.findFirst({
        where: {
          id: input.tenantId,
          activa: true,
          moneda: input.currency,
        },
        select: { id: true },
      });
      const wallet = await tx.billetera.findFirst({
        where: {
          id: input.walletId,
          tiendaId: input.tenantId,
          usuarioId: input.userId,
          moneda: input.currency,
          usuario: { is: { tiendaId: input.tenantId, estado: 'activo' } },
        },
        select: { id: true },
      });
      if (!tenant || !wallet) throw new DepositNotFoundError();
      const row = await tx.deposito.create({
        data: {
          id: input.id,
          tiendaId: input.tenantId,
          billeteraId: wallet.id,
          monto: input.amount,
          moneda: input.currency,
          metodo: input.method,
          estado: EstadoDeposito.pendiente,
          proveedorPago: input.provider,
          referenciaExterna: input.reference,
          comprobanteUrl: input.receiptUrl,
          datosProveedor: {
            kind: 'manual-deposit-request',
            requestFingerprint: input.fingerprint,
          },
        },
        select: depositSelect,
      });
      return this.toRecord(row);
    });
  }

  async countOwn(
    scope: DepositScope,
    filters: DepositFilters,
  ): Promise<number> {
    return this.prisma.deposito.count({
      where: this.ownWhere(scope, filters),
    });
  }

  async listOwn(
    scope: DepositScope,
    filters: DepositFilters,
    skip: number,
    take: number,
  ): Promise<DepositRecord[]> {
    const rows = await this.prisma.deposito.findMany({
      where: this.ownWhere(scope, filters),
      select: depositSelect,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findOwnById(
    scope: DepositScope,
    depositId: string,
  ): Promise<DepositRecord | null> {
    const row = await this.prisma.deposito.findFirst({
      where: { id: depositId, ...this.ownWhere(scope, {}) },
      select: depositSelect,
    });
    return row ? this.toRecord(row) : null;
  }

  async cancelOwnPending(
    scope: DepositScope,
    depositId: string,
  ): Promise<number> {
    return this.prisma.deposito
      .updateMany({
        where: {
          id: depositId,
          ...this.ownWhere(scope, {}),
          estado: EstadoDeposito.pendiente,
        },
        data: { estado: EstadoDeposito.cancelado },
      })
      .then((result) => result.count);
  }

  async countAdmin(
    tenantId: string,
    currency: string,
    filters: AdminDepositFilters,
  ): Promise<number> {
    return this.prisma.deposito.count({
      where: this.adminWhere(tenantId, currency, filters),
    });
  }

  async listAdmin(
    tenantId: string,
    currency: string,
    filters: AdminDepositFilters,
    skip: number,
    take: number,
  ): Promise<DepositRecord[]> {
    const rows = await this.prisma.deposito.findMany({
      where: this.adminWhere(tenantId, currency, filters),
      select: depositSelect,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findAdminById(
    tenantId: string,
    currency: string,
    depositId: string,
  ): Promise<DepositRecord | null> {
    const row = await this.prisma.deposito.findFirst({
      where: {
        id: depositId,
        ...this.adminWhere(tenantId, currency, {}),
      },
      select: depositSelect,
    });
    return row ? this.toRecord(row) : null;
  }

  async reject(
    tenantId: string,
    currency: string,
    depositId: string,
    reason: string,
  ): Promise<number> {
    return this.prisma.deposito
      .updateMany({
        where: {
          id: depositId,
          ...this.adminWhere(tenantId, currency, {}),
          estado: EstadoDeposito.pendiente,
        },
        data: {
          estado: EstadoDeposito.rechazado,
          motivoRechazo: reason,
          rechazadoEn: new Date(),
        },
      })
      .then((result) => result.count);
  }

  async approve(input: ApprovalInput): Promise<DepositRecord> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tienda.findFirst({
        where: {
          id: input.tenantId,
          activa: true,
          moneda: input.currency,
        },
        select: { id: true, moneda: true },
      });
      if (!tenant) throw new DepositNotFoundError();

      const deposit = await tx.deposito.findFirst({
        where: {
          id: input.depositId,
          tiendaId: input.tenantId,
          moneda: input.currency,
          ...manualDepositWhere,
          billetera: {
            is: {
              tiendaId: input.tenantId,
              moneda: input.currency,
              usuario: {
                is: { tiendaId: input.tenantId, estado: 'activo' },
              },
            },
          },
        },
        select: {
          id: true,
          tiendaId: true,
          billeteraId: true,
          monto: true,
          estado: true,
          billetera: {
            select: { usuarioId: true, moneda: true, saldoDisponible: true },
          },
        },
      });
      if (!deposit) throw new DepositNotFoundError();
      if (deposit.estado !== EstadoDeposito.pendiente)
        throw new DepositDecisionRaceError();

      const wallet = await tx.billetera.findFirst({
        where: {
          id: deposit.billeteraId,
          tiendaId: input.tenantId,
          usuarioId: deposit.billetera.usuarioId,
          moneda: input.currency,
        },
        select: { id: true, saldoDisponible: true },
      });
      if (!wallet) throw new DepositNotFoundError();
      const nextBalance =
        BigInt(wallet.saldoDisponible) + BigInt(deposit.monto);
      if (nextBalance > 2147483647n) throw new DepositBalanceOverflowError();
      const now = new Date();
      const claimed = await tx.deposito.updateMany({
        where: {
          id: input.depositId,
          tiendaId: input.tenantId,
          billeteraId: deposit.billeteraId,
          estado: EstadoDeposito.pendiente,
        },
        data: {
          estado: EstadoDeposito.aprobado,
          aprobadoPorId: input.adminId,
          aprobadoEn: now,
          rechazadoEn: null,
          motivoRechazo: null,
        },
      });
      if (claimed.count !== 1) throw new DepositDecisionRaceError();
      const changed = await tx.billetera.updateMany({
        where: {
          id: wallet.id,
          tiendaId: input.tenantId,
          usuarioId: deposit.billetera.usuarioId,
          moneda: input.currency,
          saldoDisponible: wallet.saldoDisponible,
        },
        data: { saldoDisponible: { increment: deposit.monto } },
      });
      if (changed.count !== 1) throw new DepositWalletRaceError();
      await tx.movimientoSaldo.create({
        data: {
          id: `deposit-credit:${input.depositId}`,
          billeteraId: wallet.id,
          tipo: TipoMovimientoSaldo.deposito,
          monto: deposit.monto,
          saldoAnterior: wallet.saldoDisponible,
          saldoPosterior: Number(nextBalance),
          referencia: input.depositId,
          descripcion: 'Depósito aprobado',
          creadoPorId: input.adminId,
        },
      });
      const row = await tx.deposito.findUniqueOrThrow({
        where: { id: input.depositId },
        select: depositSelect,
      });
      return this.toRecord(row);
    });
  }

  async findApprovalInvariant(
    tenantId: string,
    depositId: string,
  ): Promise<ApprovalInvariant | null> {
    const deposit = await this.prisma.deposito.findFirst({
      where: { id: depositId, tiendaId: tenantId },
      select: {
        id: true,
        billeteraId: true,
        monto: true,
        estado: true,
        tiendaId: true,
      },
    });
    if (!deposit) return null;
    const movement = await this.prisma.movimientoSaldo.findUnique({
      where: { id: `deposit-credit:${depositId}` },
      select: {
        id: true,
        billeteraId: true,
        tipo: true,
        monto: true,
        referencia: true,
        saldoPosterior: true,
      },
    });
    return {
      deposit: {
        id: deposit.id,
        walletId: deposit.billeteraId,
        amount: deposit.monto,
        status: deposit.estado,
        tenantId: deposit.tiendaId,
      },
      movement: movement
        ? {
            id: movement.id,
            walletId: movement.billeteraId,
            type: movement.tipo,
            amount: movement.monto,
            reference: movement.referencia,
            balanceAfter: movement.saldoPosterior,
          }
        : null,
    };
  }

  private ownWhere(
    scope: DepositScope,
    filters: DepositFilters,
  ): Prisma.DepositoWhereInput {
    return {
      tiendaId: scope.tenantId,
      moneda: scope.currency,
      ...manualDepositWhere,
      ...(filters.status ? { estado: filters.status } : {}),
      ...(filters.method ? { metodo: filters.method } : {}),
      billetera: {
        is: {
          tiendaId: scope.tenantId,
          usuarioId: scope.userId,
          moneda: scope.currency,
        },
      },
    };
  }

  private adminWhere(
    tenantId: string,
    currency: string,
    filters: AdminDepositFilters,
  ): Prisma.DepositoWhereInput {
    return {
      tiendaId: tenantId,
      moneda: currency,
      ...manualDepositWhere,
      ...(filters.status ? { estado: filters.status } : {}),
      ...(filters.method ? { metodo: filters.method } : {}),
      billetera: {
        is: {
          tiendaId: tenantId,
          moneda: currency,
          ...(filters.userId ? { usuarioId: filters.userId } : {}),
          usuario: { is: { tiendaId: tenantId, estado: 'activo' } },
        },
      },
    };
  }

  private toRecord(row: DepositRow): DepositRecord {
    return {
      id: row.id,
      tenantId: row.tiendaId,
      walletId: row.billeteraId,
      userId: row.billetera.usuarioId,
      amount: row.monto,
      currency: row.moneda,
      method: row.metodo,
      status: row.estado,
      provider: row.proveedorPago,
      reference: row.referenciaExterna,
      receiptUrl: row.comprobanteUrl,
      providerData: row.datosProveedor,
      approvedById: row.aprobadoPorId,
      approvedAt: row.aprobadoEn,
      rejectedAt: row.rechazadoEn,
      rejectionReason: row.motivoRechazo,
      createdAt: row.creadoEn,
      updatedAt: row.actualizadoEn,
      customer: {
        id: row.billetera.usuario.id,
        name: row.billetera.usuario.nombre,
        email: row.billetera.usuario.email,
      },
    };
  }
}
