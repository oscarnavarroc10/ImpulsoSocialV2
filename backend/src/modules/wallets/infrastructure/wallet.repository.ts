import { Injectable } from '@nestjs/common';
import { Prisma, TipoMovimientoSaldo } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface WalletScope {
  tenantId: string;
  userId: string;
  currency: string;
}

export interface WalletRecord {
  balance: number;
  currency: string;
}

export interface WalletMovementRecord {
  id: string;
  tipo: TipoMovimientoSaldo;
  monto: number;
  moneda: string;
  saldoPosterior: number;
  descripcion: string | null;
  creadoEn: Date;
}

export interface ManualCreditRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  createdAt: Date;
  reference: string | null;
}

export interface CreditInput {
  movementId: string;
  tenantId: string;
  userId: string;
  targetUserId: string;
  amount: number;
  currency: string;
  fingerprint: string;
  createdById: string;
}

export class WalletNotFoundError extends Error {}
export class WalletCreditRaceError extends Error {}
export class WalletBalanceOverflowError extends Error {}

const movementSelect = {
  id: true,
  tipo: true,
  monto: true,
  saldoPosterior: true,
  descripcion: true,
  creadoEn: true,
  billetera: { select: { moneda: true } },
} satisfies Prisma.MovimientoSaldoSelect;

const creditSelect = {
  id: true,
  monto: true,
  saldoPosterior: true,
  creadoEn: true,
  referencia: true,
  billetera: {
    select: { usuarioId: true, moneda: true, tiendaId: true },
  },
} satisfies Prisma.MovimientoSaldoSelect;

type MovementRow = Prisma.MovimientoSaldoGetPayload<{
  select: typeof movementSelect;
}>;
type CreditRow = Prisma.MovimientoSaldoGetPayload<{
  select: typeof creditSelect;
}>;

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTenantCurrency(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tienda.findFirst({
      where: { id: tenantId, activa: true },
      select: { moneda: true },
    });
    return tenant?.moneda ?? null;
  }

  async findWallet(scope: WalletScope): Promise<WalletRecord | null> {
    const wallet = await this.prisma.billetera.findFirst({
      where: {
        tiendaId: scope.tenantId,
        usuarioId: scope.userId,
        moneda: scope.currency,
      },
      select: { saldoDisponible: true, moneda: true },
    });
    return wallet
      ? { balance: wallet.saldoDisponible, currency: wallet.moneda }
      : null;
  }

  async countMovements(
    scope: WalletScope,
    type?: TipoMovimientoSaldo,
  ): Promise<number> {
    const wallet = await this.findWalletId(scope);
    if (!wallet) return 0;
    return this.prisma.movimientoSaldo.count({
      where: { billeteraId: wallet, ...(type ? { tipo: type } : {}) },
    });
  }

  async findMovements(
    scope: WalletScope,
    type: TipoMovimientoSaldo | undefined,
    skip: number,
    take: number,
  ): Promise<WalletMovementRecord[]> {
    const wallet = await this.findWalletId(scope);
    if (!wallet) return [];
    const rows = await this.prisma.movimientoSaldo.findMany({
      where: { billeteraId: wallet, ...(type ? { tipo: type } : {}) },
      select: movementSelect,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map((row) => this.toMovement(row));
  }

  async findManualCredit(
    movementId: string,
    tenantId: string,
  ): Promise<ManualCreditRecord | null> {
    const row = await this.prisma.movimientoSaldo.findFirst({
      where: {
        id: movementId,
        tipo: TipoMovimientoSaldo.ajusteCredito,
        billetera: { tiendaId: tenantId },
      },
      select: creditSelect,
    });
    return row ? this.toCredit(row) : null;
  }

  async targetExists(
    tenantId: string,
    userId: string,
    currency: string,
  ): Promise<boolean> {
    const target = await this.prisma.usuario.findFirst({
      where: { id: userId, tiendaId: tenantId, estado: 'activo' },
      select: {
        billeteras: {
          where: { tiendaId: tenantId, moneda: currency },
          select: { id: true },
          take: 1,
        },
      },
    });
    return (target?.billeteras.length ?? 0) === 1;
  }

  async createCredit(input: CreditInput): Promise<ManualCreditRecord> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tienda.findFirst({
        where: { id: input.tenantId, activa: true, moneda: input.currency },
        select: { id: true },
      });
      const target = await tx.usuario.findFirst({
        where: {
          id: input.targetUserId,
          tiendaId: input.tenantId,
          estado: 'activo',
        },
        select: { id: true },
      });
      if (!tenant || !target) throw new WalletNotFoundError();
      const wallet = await tx.billetera.findFirst({
        where: {
          tiendaId: input.tenantId,
          usuarioId: input.targetUserId,
          moneda: input.currency,
        },
        select: { id: true, saldoDisponible: true },
      });
      if (!wallet) throw new WalletNotFoundError();
      const nextBalance = BigInt(wallet.saldoDisponible) + BigInt(input.amount);
      if (nextBalance > 2147483647n) throw new WalletBalanceOverflowError();
      const movement = await tx.movimientoSaldo.create({
        data: {
          id: input.movementId,
          billeteraId: wallet.id,
          tipo: TipoMovimientoSaldo.ajusteCredito,
          monto: input.amount,
          saldoAnterior: wallet.saldoDisponible,
          saldoPosterior: Number(nextBalance),
          referencia: `manual-credit:${input.fingerprint}`,
          descripcion: 'Crédito manual',
          creadoPorId: input.createdById,
        },
        select: creditSelect,
      });
      const changed = await tx.billetera.updateMany({
        where: {
          id: wallet.id,
          tiendaId: input.tenantId,
          usuarioId: input.targetUserId,
          moneda: input.currency,
          saldoDisponible: wallet.saldoDisponible,
        },
        data: { saldoDisponible: { increment: input.amount } },
      });
      if (changed.count !== 1) throw new WalletCreditRaceError();
      return this.toCredit(movement);
    });
  }

  private async findWalletId(scope: WalletScope): Promise<string | null> {
    const wallet = await this.prisma.billetera.findFirst({
      where: {
        tiendaId: scope.tenantId,
        usuarioId: scope.userId,
        moneda: scope.currency,
      },
      select: { id: true },
    });
    return wallet?.id ?? null;
  }

  private toMovement(row: MovementRow): WalletMovementRecord {
    return {
      id: row.id,
      tipo: row.tipo,
      monto: row.monto,
      moneda: row.billetera.moneda,
      saldoPosterior: row.saldoPosterior,
      descripcion: row.descripcion,
      creadoEn: row.creadoEn,
    };
  }

  private toCredit(row: CreditRow): ManualCreditRecord {
    return {
      id: row.id,
      userId: row.billetera.usuarioId,
      amount: row.monto,
      currency: row.billetera.moneda,
      balanceAfter: row.saldoPosterior,
      createdAt: row.creadoEn,
      reference: row.referencia,
    };
  }
}
