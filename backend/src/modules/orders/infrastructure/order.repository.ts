import { Injectable } from '@nestjs/common';
import { Prisma, EstadoOrden, TipoMovimientoSaldo } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { readQuantityBounds } from '../../catalog/infrastructure/quantity-bounds';
import { normalizeBulkFollowsCapability } from '../../catalog/infrastructure/capability-normalizer';

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
  providerOrigin: string;
  offeringId: string | null;
  providerServiceId: string | null;
  capabilityKey: 'STANDARD';
  contractVersion: string | null;
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
export interface OrderRefreshLookup {
  order: OrderView;
  providerOrderId: string | null;
  providerOrigin?: string | null;
}
export interface RefreshResult {
  providerStatus: string;
  localStatus: EstadoOrden;
  startCount: number;
  remains: number;
}
export interface RefundResult {
  order: OrderView;
  refunded: boolean;
}

// Monotonic progression: enviando/enviadaProveedor -> enProgreso -> terminal.
const REFRESH_STATE_RANK: Record<EstadoOrden, number> = {
  [EstadoOrden.pendiente]: 0,
  [EstadoOrden.enviando]: 0,
  [EstadoOrden.enviadaProveedor]: 1,
  [EstadoOrden.enProgreso]: 2,
  [EstadoOrden.completada]: 3,
  [EstadoOrden.parcial]: 3,
  [EstadoOrden.cancelada]: 3,
  [EstadoOrden.fallida]: 3,
  [EstadoOrden.reembolsada]: 3,
};

export class InvalidProviderContractError extends Error {}
export class InvalidRefundBasisError extends Error {}

function isStandardContract(value: unknown): value is { min: number; max: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const contract = value as Record<string, unknown>;
  return (
    contract.validationStatus === 'supported' &&
    contract.quantityMode === 'required' &&
    Number.isSafeInteger(contract.min) &&
    Number.isSafeInteger(contract.max) &&
    (contract.min as number) > 0 &&
    (contract.max as number) >= (contract.min as number)
  );
}

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
    if (!row) return null;

    const offeringDelegate = (
      this.prisma as PrismaService & {
        masterServiceProviderOffering?: {
          findFirst: (args: unknown) => Promise<any>;
          count: (args: unknown) => Promise<number>;
        };
      }
    ).masterServiceProviderOffering;
    const provider = await this.prisma.providerService.findUnique({
      where: { id: row.provenanceRef ?? '' },
      select: { id: true, providerOrigin: true, externalId: true, rawPayload: true },
    });
    const selectedOffering = offeringDelegate
      ? await offeringDelegate.findFirst({
          where: {
            masterServiceId: serviceId,
            isEnabled: true,
            isAvailable: true,
            isSelected: true,
          },
          include: { providerService: true },
        })
      : null;
    if (offeringDelegate && !selectedOffering) {
      const offeringCount = await offeringDelegate.count({
        where: { masterServiceId: serviceId },
      });
      if (offeringCount > 0) return null;
    }

    const selectedProvider = selectedOffering?.providerService ?? provider;
    if (!selectedProvider || selectedProvider.providerOrigin !== 'bulkfollows')
      return null;
    const normalized = selectedOffering
      ? selectedOffering.capabilityKey === 'STANDARD' &&
        isStandardContract(selectedOffering.contract)
        ? {
            bounds: {
              min: selectedOffering.contract.min,
              max: selectedOffering.contract.max,
            },
            contractVersion: selectedOffering.contractVersion,
          }
        : null
      : normalizeBulkFollowsCapability(
          selectedProvider.rawPayload,
          selectedProvider.externalId,
        );
    const bounds = normalized
      ? 'bounds' in normalized
        ? normalized.bounds
        : normalized.contract.min !== undefined && normalized.contract.max !== undefined
          ? { min: normalized.contract.min, max: normalized.contract.max }
          : null
      : readQuantityBounds(selectedProvider.rawPayload, selectedProvider.externalId);
    if (!bounds)
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
      externalId: selectedProvider.externalId,
      providerOrigin: selectedProvider.providerOrigin,
      offeringId: selectedOffering?.id ?? null,
      providerServiceId: selectedOffering?.providerServiceId ?? selectedProvider.id,
      capabilityKey: 'STANDARD',
      contractVersion: normalized?.contractVersion ?? null,
      min: bounds.min,
      max: bounds.max,
      providerCost: row.providerCostAmount,
      providerCurrency: row.providerCostCurrency,
      sellingPrice,
      currency,
    };
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

  async findForRefresh(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<OrderRefreshLookup | null> {
    const row = await this.prisma.orden.findFirst({
      where: { id, tiendaId: tenantId, usuarioId: userId },
      select: {
        ...this.viewSelect,
        ordenProveedor: {
          select: {
            idExterno: true,
            proveedor: true,
            providerService: { select: { providerOrigin: true } },
          },
        },
      },
    });
    if (!row) return null;
    const { ordenProveedor, ...orderFields } = row;
    return {
      order: this.toView(orderFields),
      providerOrderId: ordenProveedor?.idExterno ?? null,
      providerOrigin: ordenProveedor?.providerService?.providerOrigin ?? ordenProveedor?.proveedor ?? null,
    };
  }

  async applyRefresh(
    tenantId: string,
    userId: string,
    id: string,
    result: RefreshResult,
  ): Promise<OrderView | null> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.orden.findFirst({
        where: { id, tiendaId: tenantId, usuarioId: userId },
        select: { ...this.viewSelect, completadaEn: true, canceladaEn: true },
      });
      if (!current) return null;
      const currentRank = REFRESH_STATE_RANK[current.estado];
      const nextRank = REFRESH_STATE_RANK[result.localStatus];
      if (currentRank === 3 || nextRank < currentRank)
        return this.toView(current);
      const sameState = result.localStatus === current.estado;
      const now = new Date();
      const completingNow =
        result.localStatus === EstadoOrden.completada && !current.completadaEn;
      const cancelingNow =
        result.localStatus === EstadoOrden.cancelada && !current.canceladaEn;
      const changed = await tx.orden.updateMany({
        where: {
          id,
          tiendaId: tenantId,
          usuarioId: userId,
          estado: current.estado,
        },
        data: {
          estado: result.localStatus,
          conteoInicial: result.startCount,
          restante: result.remains,
          ...(completingNow ? { completadaEn: now } : {}),
          ...(cancelingNow ? { canceladaEn: now } : {}),
        },
      });
      if (changed.count === 1) {
        await tx.ordenProveedor.updateMany({
          where: { ordenId: id },
          data: { estadoExterno: result.providerStatus, ultimaConsultaEn: now },
        });
        if (!sameState)
          await tx.historialOrden.create({
            data: {
              ordenId: id,
              estadoAnterior: current.estado,
              estadoNuevo: result.localStatus,
              origen: 'bulkfollows-status',
            },
          });
      }
      const row = await tx.orden.findUniqueOrThrow({
        where: { id },
        select: this.viewSelect,
      });
      return this.toView(row);
    });
  }

  async refund(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<RefundResult | null> {
    const current = await this.prisma.orden.findFirst({
      where: { id, tiendaId: tenantId, usuarioId: userId },
      select: {
        ...this.viewSelect,
        restante: true,
      },
    });
    if (!current) return null;
    if (
      current.estado !== EstadoOrden.parcial &&
      current.estado !== EstadoOrden.cancelada
    )
      return { order: this.toView(current), refunded: false };

    const amount = this.refundAmount(current);
    if (amount === 0) return { order: this.toView(current), refunded: false };

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.orden.updateMany({
        where: {
          id,
          tiendaId: tenantId,
          usuarioId: userId,
          estado: current.estado,
        },
        data: { estado: EstadoOrden.reembolsada },
      });
      if (claimed.count !== 1) return null;

      const wallet = await tx.billetera.updateMany({
        where: {
          tiendaId: tenantId,
          usuarioId: userId,
          moneda: current.monedaVenta,
        },
        data: { saldoDisponible: { increment: amount } },
      });
      if (wallet.count !== 1) throw new Error('REFUND_WALLET_NOT_FOUND');
      const balance = await tx.billetera.findFirstOrThrow({
        where: {
          tiendaId: tenantId,
          usuarioId: userId,
          moneda: current.monedaVenta,
        },
        select: { id: true, saldoDisponible: true },
      });
      await tx.movimientoSaldo.create({
        data: {
          billeteraId: balance.id,
          tipo: TipoMovimientoSaldo.reembolso,
          monto: amount,
          saldoAnterior: balance.saldoDisponible - amount,
          saldoPosterior: balance.saldoDisponible,
          referencia: id,
        },
      });
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          estadoAnterior: current.estado,
          estadoNuevo: EstadoOrden.reembolsada,
          origen: 'orders-refund',
        },
      });
      const row = await tx.orden.findUniqueOrThrow({
        where: { id },
        select: this.viewSelect,
      });
      return { order: this.toView(row), refunded: true };
    });
    if (result) return result;
    const winner = await this.prisma.orden.findFirst({
      where: { id, tiendaId: tenantId, usuarioId: userId },
      select: this.viewSelect,
    });
    return winner
      ? { order: this.toView(winner), refunded: false }
      : null;
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
          ...(candidate.offeringId
            ? {
                datosEntradaPrivada: {
                  version: 1,
                  capability: candidate.capabilityKey,
                  target: input.target,
                  quantity: input.quantity,
                  effectiveQuantity: input.quantity,
                },
              }
            : {}),
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
    candidate?: PurchaseCandidate,
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
          ...(candidate?.offeringId
            ? {
                offeringId: candidate.offeringId,
                providerServiceId: candidate.providerServiceId,
                capabilityKeySnapshot: candidate.capabilityKey,
                capabilityContractVersionSnapshot: candidate.contractVersion,
                offeringSnapshot: {
                  providerOrigin: candidate.providerOrigin,
                  providerServiceId: candidate.providerServiceId,
                  capability: candidate.capabilityKey,
                  contractVersion: candidate.contractVersion,
                },
              }
            : {}),
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
  private refundAmount(order: {
    estado: EstadoOrden;
    cantidad: number;
    precioTotal: number;
    restante: number | null;
  }): number {
    if (
      !Number.isSafeInteger(order.cantidad) ||
      order.cantidad <= 0 ||
      !Number.isSafeInteger(order.precioTotal) ||
      order.precioTotal < 0
    )
      throw new InvalidRefundBasisError();
    if (order.estado === EstadoOrden.cancelada) return order.precioTotal;
    if (
      order.restante === null ||
      !Number.isSafeInteger(order.restante) ||
      order.restante < 0 ||
      order.restante > order.cantidad
    )
      throw new InvalidRefundBasisError();
    const amount =
      (BigInt(order.precioTotal) * BigInt(order.restante)) /
      BigInt(order.cantidad);
    return Number(amount);
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
