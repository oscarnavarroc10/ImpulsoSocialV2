import { Injectable } from '@nestjs/common';
import { Prisma, EstadoOrden, TipoMovimientoSaldo } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PurchaseInput {
  tenantId: string;
  userId: string;
  serviceId: string;
  target: string;
  quantity: number;
  key: string;
  fingerprint: string;
}
export interface PurchaseCandidate {
  serviceId: string;
  externalId: string;
  min: number;
  max: number;
  providerCost: number;
  providerCurrency: string;
  sellingPrice: number;
  currency: string;
}
export interface OrderView {
  id: string;
  serviceId: string;
  target: string;
  quantity: number;
  totalPrice: { amount: number; currency: string };
  status: string;
  createdAt: Date;
}
export interface OrderReplay extends OrderView {
  requestFingerprint: string | null;
}
export interface OrderListFilters {
  status?: EstadoOrden;
}

export class InvalidProviderContractError extends Error {}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidate(
    tenantId: string,
    serviceId: string,
  ): Promise<PurchaseCandidate | null> {
    const row = await this.prisma.masterService.findFirst({
      where: {
        id: serviceId,
        status: 'active',
        isVisible: true,
        NOT: {
          configuracionesTienda: { some: { tenantId, isEnabled: false } },
        },
      },
      select: {
        id: true,
        providerCostAmount: true,
        providerCostCurrency: true,
        defaultSellingPriceAmount: true,
        defaultSellingPriceCurrency: true,
        provenanceRef: true,
        configuracionesTienda: {
          where: { tenantId },
          select: { sellingPriceAmount: true, sellingPriceCurrency: true },
          take: 1,
        },
      },
    });
    if (!row?.provenanceRef) return null;
    const provider = await this.prisma.providerService.findUnique({
      where: { id: row.provenanceRef },
      select: { providerOrigin: true, externalId: true, rawPayload: true },
    });
    if (!provider || provider.providerOrigin !== 'bulkfollows') return null;
    const raw = provider.rawPayload;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new InvalidProviderContractError();
    const record = raw as Record<string, unknown>;
    const type =
      typeof record.type === 'string' ? record.type.trim().toLowerCase() : '';
    const min = this.strictInteger(record.min);
    const max = this.strictInteger(record.max);
    if (
      type !== 'default' ||
      !/^\d+$/.test(provider.externalId) ||
      !this.rawServiceMatches(record.service, provider.externalId) ||
      min === null ||
      max === null ||
      min < 1 ||
      max < min
    )
      throw new InvalidProviderContractError();
    const override = row.configuracionesTienda[0];
    const complete =
      override?.sellingPriceAmount != null &&
      override.sellingPriceCurrency != null;
    const sellingPrice = complete
      ? (override?.sellingPriceAmount ?? row.defaultSellingPriceAmount)
      : row.defaultSellingPriceAmount;
    const currency = complete
      ? (override?.sellingPriceCurrency ?? row.defaultSellingPriceCurrency)
      : row.defaultSellingPriceCurrency;
    return {
      serviceId: row.id,
      externalId: provider.externalId,
      min,
      max,
      providerCost: row.providerCostAmount,
      providerCurrency: row.providerCostCurrency,
      sellingPrice,
      currency,
    };
  }

  private strictInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const n = Number(value);
      return Number.isSafeInteger(n) ? n : null;
    }
    return null;
  }

  private rawServiceMatches(value: unknown, externalId: string): boolean {
    if (value === undefined) return true;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      return String(value) === externalId;
    return (
      typeof value === 'string' &&
      /^\d+$/.test(value.trim()) &&
      value.trim() === externalId
    );
  }

  async findByKey(input: PurchaseInput): Promise<OrderReplay | null> {
    const order = await this.prisma.orden.findFirst({
      where: {
        tiendaId: input.tenantId,
        usuarioId: input.userId,
        idempotencyKey: input.key,
      },
      select: { ...this.viewSelect, requestFingerprint: true },
    });
    return order
      ? {
          ...this.toView(order),
          requestFingerprint: order.requestFingerprint,
        }
      : null;
  }

  async count(
    tenantId: string,
    userId: string,
    filters: OrderListFilters,
  ): Promise<number> {
    return this.prisma.orden.count({
      where: this.scopedWhere(tenantId, userId, filters),
    });
  }

  async findMany(
    tenantId: string,
    userId: string,
    filters: OrderListFilters,
    skip: number,
    take: number,
  ): Promise<OrderView[]> {
    const rows = await this.prisma.orden.findMany({
      where: this.scopedWhere(tenantId, userId, filters),
      select: this.viewSelect,
      orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map((row) => this.toView(row));
  }

  async findById(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<OrderView | null> {
    const row = await this.prisma.orden.findFirst({
      where: { id, tiendaId: tenantId, usuarioId: userId },
      select: this.viewSelect,
    });
    return row ? this.toView(row) : null;
  }

  async createPurchase(
    input: PurchaseInput,
    candidate: PurchaseCandidate,
    total: number,
  ): Promise<OrderView> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orden.create({
        data: {
          tiendaId: input.tenantId,
          usuarioId: input.userId,
          servicioId: input.serviceId,
          enlace: input.target,
          cantidad: input.quantity,
          precioTotal: total,
          monedaVenta: candidate.currency,
          costoProveedor: this.calculate(
            candidate.providerCost,
            input.quantity,
          ),
          monedaProveedor: candidate.providerCurrency,
          idempotencyKey: input.key,
          requestFingerprint: input.fingerprint,
        },
        select: this.viewSelect,
      });
      const wallet = await tx.billetera.updateMany({
        where: {
          tiendaId: input.tenantId,
          usuarioId: input.userId,
          moneda: candidate.currency,
          saldoDisponible: { gte: total },
        },
        data: { saldoDisponible: { decrement: total } },
      });
      if (wallet.count !== 1) throw new Error('INSUFFICIENT_BALANCE');
      const current = await tx.billetera.findFirstOrThrow({
        where: {
          tiendaId: input.tenantId,
          usuarioId: input.userId,
          moneda: candidate.currency,
        },
        select: { id: true, saldoDisponible: true },
      });
      await tx.movimientoSaldo.create({
        data: {
          billeteraId: current.id,
          tipo: TipoMovimientoSaldo.compra,
          monto: total,
          saldoAnterior: current.saldoDisponible + total,
          saldoPosterior: current.saldoDisponible,
          referencia: order.id,
        },
      });
      await tx.historialOrden.create({
        data: {
          ordenId: order.id,
          estadoNuevo: EstadoOrden.pendiente,
          origen: 'orders',
        },
      });
      return this.toView(order);
    });
  }

  async claim(
    orderId: string,
    input: PurchaseInput,
    service: string,
    target: string,
    quantity: number,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.orden.updateMany({
        where: {
          id: orderId,
          tiendaId: input.tenantId,
          usuarioId: input.userId,
          estado: EstadoOrden.pendiente,
        },
        data: { estado: EstadoOrden.enviando },
      });
      if (claimed.count !== 1) return false;
      await tx.ordenProveedor.create({
        data: {
          ordenId: orderId,
          proveedor: 'bulkfollows',
          estadoExterno: 'sending',
          solicitudOriginal: { action: 'add', service, link: target, quantity },
        },
      });
      await tx.historialOrden.create({
        data: {
          ordenId: orderId,
          estadoAnterior: EstadoOrden.pendiente,
          estadoNuevo: EstadoOrden.enviando,
          origen: 'orders',
        },
      });
      return true;
    });
  }

  async finalize(
    orderId: string,
    input: PurchaseInput,
    outcome: { kind: 'accepted'; providerId: string } | { kind: 'rejected' },
  ): Promise<OrderView | null> {
    return this.prisma.$transaction(async (tx) => {
      if (outcome.kind === 'accepted') {
        const changed = await tx.orden.updateMany({
          where: {
            id: orderId,
            tiendaId: input.tenantId,
            usuarioId: input.userId,
            estado: EstadoOrden.enviando,
          },
          data: {
            estado: EstadoOrden.enviadaProveedor,
            enviadaProveedorEn: new Date(),
          },
        });
        if (changed.count !== 1) return null;
        await tx.ordenProveedor.update({
          where: { ordenId: orderId },
          data: { idExterno: outcome.providerId, estadoExterno: 'accepted' },
        });
        await tx.historialOrden.create({
          data: {
            ordenId: orderId,
            estadoAnterior: EstadoOrden.enviando,
            estadoNuevo: EstadoOrden.enviadaProveedor,
            origen: 'orders',
          },
        });
      } else {
        const current = await tx.orden.findFirst({
          where: {
            id: orderId,
            tiendaId: input.tenantId,
            usuarioId: input.userId,
            estado: EstadoOrden.enviando,
          },
          select: { precioTotal: true, monedaVenta: true },
        });
        if (!current) return null;
        const changed = await tx.orden.updateMany({
          where: {
            id: orderId,
            tiendaId: input.tenantId,
            usuarioId: input.userId,
            estado: EstadoOrden.enviando,
          },
          data: {
            estado: EstadoOrden.reembolsada,
            mensajeError: 'provider_rejected',
          },
        });
        if (changed.count !== 1) return null;
        const wallet = await tx.billetera.updateMany({
          where: {
            tiendaId: input.tenantId,
            usuarioId: input.userId,
            moneda: current.monedaVenta,
          },
          data: { saldoDisponible: { increment: current.precioTotal } },
        });
        if (wallet.count !== 1) throw new Error('REFUND_WALLET_NOT_FOUND');
        const balance = await tx.billetera.findFirstOrThrow({
          where: {
            tiendaId: input.tenantId,
            usuarioId: input.userId,
            moneda: current.monedaVenta,
          },
          select: { id: true, saldoDisponible: true },
        });
        await tx.movimientoSaldo.create({
          data: {
            billeteraId: balance.id,
            tipo: TipoMovimientoSaldo.reembolso,
            monto: current.precioTotal,
            saldoAnterior: balance.saldoDisponible - current.precioTotal,
            saldoPosterior: balance.saldoDisponible,
            referencia: orderId,
          },
        });
        await tx.ordenProveedor.update({
          where: { ordenId: orderId },
          data: { estadoExterno: 'rejected' },
        });
        await tx.historialOrden.create({
          data: {
            ordenId: orderId,
            estadoAnterior: EstadoOrden.enviando,
            estadoNuevo: EstadoOrden.reembolsada,
            origen: 'orders',
          },
        });
      }
      const result = await tx.orden.findUniqueOrThrow({
        where: { id: orderId },
        select: this.viewSelect,
      });
      return this.toView(result);
    });
  }

  private scopedWhere(
    tenantId: string,
    userId: string,
    filters: OrderListFilters,
  ): Prisma.OrdenWhereInput {
    return {
      tiendaId: tenantId,
      usuarioId: userId,
      ...(filters.status ? { estado: filters.status } : {}),
    };
  }

  private calculate(rate: number, quantity: number): number {
    const result = (BigInt(rate) * BigInt(quantity) + 999n) / 1000n;
    if (result < 1n || result > 2147483647n)
      throw new Error('UNREPRESENTABLE_TOTAL');
    return Number(result);
  }
  total(rate: number, quantity: number): number {
    return this.calculate(rate, quantity);
  }
  private readonly viewSelect = {
    id: true,
    servicioId: true,
    enlace: true,
    cantidad: true,
    precioTotal: true,
    monedaVenta: true,
    estado: true,
    creadaEn: true,
  } satisfies Prisma.OrdenSelect;
  private toView(order: {
    id: string;
    servicioId: string;
    enlace: string;
    cantidad: number;
    precioTotal: number;
    monedaVenta: string;
    estado: EstadoOrden;
    creadaEn: Date;
  }): OrderView {
    return {
      id: order.id,
      serviceId: order.servicioId,
      target: order.enlace,
      quantity: order.cantidad,
      totalPrice: { amount: order.precioTotal, currency: order.monedaVenta },
      status: order.estado,
      createdAt: order.creadaEn,
    };
  }
}
