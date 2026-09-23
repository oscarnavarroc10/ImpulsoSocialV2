import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  Injectable,
  InternalServerErrorException,
  Inject,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EstadoOrden } from '@prisma/client';
import {
  CreateOrderDto,
  OrderListQueryDto,
  OrderListResponseDto,
  OrderResponseDto,
} from './dto/order.dto';
import { OrderPrincipal } from '../security/order-authentication.guard';
import {
  InvalidRefundBasisError,
  InvalidProviderContractError,
  OrderRepository,
  OrderReplay,
  PurchaseCandidate,
  PurchaseInput,
} from '../infrastructure/order.repository';
import { BulkFollowsOrderClient } from '../infrastructure/bulkfollows-order.client';
import { PROVIDER_ORDER_ADAPTER } from './provider-order-adapter';
import type {
  ProviderOrderAdapter,
  ProviderOrderAdapterResolver,
} from './provider-order-adapter';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const TERMINAL_STATES = new Set<string>([
  EstadoOrden.completada,
  EstadoOrden.parcial,
  EstadoOrden.cancelada,
  EstadoOrden.fallida,
  EstadoOrden.reembolsada,
]);
const PROVIDER_STATUS_MAP: Record<string, EstadoOrden> = {
  pending: EstadoOrden.enviadaProveedor,
  processing: EstadoOrden.enProgreso,
  'in progress': EstadoOrden.enProgreso,
  completed: EstadoOrden.completada,
  partial: EstadoOrden.parcial,
  canceled: EstadoOrden.cancelada,
  cancelled: EstadoOrden.cancelada,
};

@Injectable()
export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly provider: BulkFollowsOrderClient,
    @Optional()
    @Inject(PROVIDER_ORDER_ADAPTER)
    private readonly providerAdapter?:
      ProviderOrderAdapter | ProviderOrderAdapterResolver,
  ) {}

  async list(
    query: OrderListQueryDto,
    principal: OrderPrincipal,
  ): Promise<OrderListResponseDto> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters = { status: query.status };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.repository.findMany(
        principal.tenantId,
        principal.userId,
        filters,
        skip,
        limit,
      ),
      this.repository.count(principal.tenantId, principal.userId, filters),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(
    id: string,
    principal: OrderPrincipal,
  ): Promise<OrderResponseDto> {
    const order = await this.repository.findById(
      principal.tenantId,
      principal.userId,
      id,
    );
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async refreshStatus(
    id: string,
    principal: OrderPrincipal,
  ): Promise<OrderResponseDto> {
    const lookup = await this.repository.findForRefresh(
      principal.tenantId,
      principal.userId,
      id,
    );
    if (!lookup) throw new NotFoundException('Order not found');
    if (
      lookup.order.status === EstadoOrden.parcial ||
      lookup.order.status === EstadoOrden.cancelada
    )
      return this.refund(principal, id);
    if (TERMINAL_STATES.has(lookup.order.status)) return lookup.order;
    const providerOrderId = lookup.providerOrderId?.trim();
    if (!providerOrderId)
      throw new ConflictException('Order has no provider reference');
    const adapter = this.resolveAdapter(lookup.providerOrigin);
    if (!adapter)
      throw new ServiceUnavailableException('Provider is unavailable');
    if (adapter.isReady && !adapter.isReady())
      throw new ServiceUnavailableException('Provider is not configured');
    const result = await adapter.getStatus(providerOrderId);
    if (result.kind !== 'ok')
      throw new BadGatewayException('Provider status is unavailable');
    const mapped =
      PROVIDER_STATUS_MAP[result.externalStatus.trim().toLowerCase()];
    if (!mapped)
      throw new BadGatewayException('Provider status is unavailable');
    if (
      mapped === EstadoOrden.parcial &&
      (!Number.isSafeInteger(result.remains) ||
        result.remains < 0 ||
        result.remains > lookup.order.quantity)
    )
      throw new BadGatewayException('Provider status is unavailable');
    const updated = await this.repository.applyRefresh(
      principal.tenantId,
      principal.userId,
      id,
      {
        providerStatus: result.externalStatus.trim(),
        localStatus: mapped,
        startCount: result.startCount,
        remains: result.remains,
      },
    );
    if (!updated) throw new NotFoundException('Order not found');
    if (
      updated.status === EstadoOrden.parcial ||
      updated.status === EstadoOrden.cancelada
    )
      return this.refund(principal, id);
    return updated;
  }

  private async refund(
    principal: OrderPrincipal,
    id: string,
  ): Promise<OrderResponseDto> {
    try {
      const result = await this.repository.refund(
        principal.tenantId,
        principal.userId,
        id,
      );
      if (!result) throw new NotFoundException('Order not found');
      return result.order;
    } catch (error: unknown) {
      if (error instanceof InvalidRefundBasisError)
        throw new ConflictException('Order refund basis is invalid');
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Order refund failed');
    }
  }

  async create(
    dto: CreateOrderDto,
    principal: OrderPrincipal,
    key: string,
  ): Promise<{ order: OrderResponseDto; statusCode: 200 | 201 | 202 }> {
    const normalizedKey = key.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalizedKey))
      throw new Error('INVALID_IDEMPOTENCY_KEY');
    const normalizedServiceId = dto.serviceId.trim();
    const normalizedTarget = dto.target.trim();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([normalizedServiceId, normalizedTarget, dto.quantity]),
      )
      .digest('hex');
    const input: PurchaseInput = {
      tenantId: principal.tenantId,
      userId: principal.userId,
      serviceId: normalizedServiceId,
      target: normalizedTarget,
      quantity: dto.quantity,
      key: normalizedKey,
      fingerprint,
    };
    const existing = await this.repository.findByKey(input);
    if (existing) {
      if (fingerprint !== existing.requestFingerprint)
        throw new ConflictException('Idempotency key conflict');
      return this.replay(existing, input);
    }
    const candidate = await this.findCandidate(input);
    if (!candidate) throw new NotFoundException('Service not found');
    const adapter = this.resolveAdapter(candidate.providerOrigin);
    if (!adapter)
      throw new ServiceUnavailableException('Provider is unavailable');
    if (adapter.isReady && !adapter.isReady())
      throw new ServiceUnavailableException('Provider is not configured');
    if (dto.quantity < candidate.min || dto.quantity > candidate.max)
      throw new UnprocessableEntityException(
        'Quantity is outside provider bounds',
      );
    let total: number;
    try {
      total = this.repository.total(candidate.sellingPrice, dto.quantity);
      this.repository.total(candidate.providerCost, dto.quantity);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'UNREPRESENTABLE_TOTAL')
        throw new UnprocessableEntityException('Order total is invalid');
      throw error;
    }
    let order;
    try {
      order = await this.repository.createPurchase(input, candidate, total);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE')
        throw new ConflictException('Insufficient balance');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const winner = await this.repository.findByKey(input);
        if (winner) {
          if (fingerprint !== winner.requestFingerprint)
            throw new ConflictException('Idempotency key conflict');
          return this.replay(winner, input);
        }
      }
      throw error;
    }
    return this.claimAndSubmit(order, input, candidate, false);
  }

  private async replay(
    order: OrderReplay,
    input: PurchaseInput,
  ): Promise<{ order: OrderResponseDto; statusCode: 200 | 201 | 202 }> {
    if (order.status !== 'pendiente')
      return { order: this.publicOrder(order), statusCode: 200 };
    const candidate = await this.findCandidate(input);
    if (!candidate) return { order: this.publicOrder(order), statusCode: 200 };
    const adapter = this.resolveAdapter(candidate.providerOrigin);
    if (!adapter)
      throw new ServiceUnavailableException('Provider is unavailable');
    if (adapter.isReady && !adapter.isReady())
      throw new ServiceUnavailableException('Provider is not configured');
    return this.claimAndSubmit(order, input, candidate, true);
  }

  private async claimAndSubmit(
    order: OrderResponseDto,
    input: PurchaseInput,
    candidate: PurchaseCandidate,
    replay: boolean,
  ): Promise<{ order: OrderResponseDto; statusCode: 200 | 201 | 202 }> {
    const claimed = candidate.offeringId
      ? await this.repository.claim(
          order.id,
          input,
          candidate.externalId,
          input.target,
          input.quantity,
          candidate,
        )
      : await this.repository.claim(
          order.id,
          input,
          candidate.externalId,
          input.target,
          input.quantity,
        );
    if (!claimed) {
      const current = await this.repository.findByKey(input);
      if (!current) throw new InternalServerErrorException();
      return { order: this.publicOrder(current), statusCode: 200 };
    }
    const adapter = this.resolveAdapter(candidate.providerOrigin);
    if (!adapter)
      throw new ServiceUnavailableException('Provider is unavailable');
    if (adapter.isReady && !adapter.isReady())
      throw new ServiceUnavailableException('Provider is not configured');
    const result = await adapter.createOrder({
      offering: {
        offeringId: candidate.offeringId ?? '',
        providerServiceId: candidate.providerServiceId ?? '',
        providerOrigin: candidate.providerOrigin,
        providerServiceExternalId: candidate.externalId,
        capability: candidate.capabilityKey,
        contractVersion: candidate.contractVersion ?? '',
      },
      target: input.target,
      quantity: input.quantity,
      idempotencyContext: input.fingerprint,
    });
    if (result.kind === 'accepted') {
      const finalized = await this.repository.finalize(order.id, input, {
        kind: 'accepted',
        providerId: result.externalOrderId,
      });
      if (finalized)
        return { order: finalized, statusCode: replay ? 200 : 201 };
      return this.reloadAfterFinalization(input, replay);
    }
    if (result.kind === 'rejected') {
      const finalized = await this.repository.finalize(order.id, input, {
        kind: 'rejected',
      });
      if (finalized)
        return { order: finalized, statusCode: replay ? 200 : 201 };
      return this.reloadAfterFinalization(input, replay);
    }
    return { order: { ...order, status: 'enviando' }, statusCode: 202 };
  }

  private publicOrder(order: OrderReplay): OrderResponseDto {
    return {
      id: order.id,
      serviceId: order.serviceId,
      target: order.target,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
    };
  }

  private resolveAdapter(
    providerOrigin?: string | null,
  ): ProviderOrderAdapter | null {
    const origin = providerOrigin ?? 'bulkfollows';
    if (this.providerAdapter && 'resolve' in this.providerAdapter)
      return this.providerAdapter.resolve(origin);
    if (this.providerAdapter) return this.providerAdapter;
    if (origin !== 'bulkfollows') return null;
    return {
      isReady: () => this.provider.isReady(),
      createOrder: async (request) => {
        if (request.quantity === undefined)
          return {
            kind: 'rejected' as const,
            message: 'Unsupported provider capability',
          };
        const result = await this.provider.submit(
          request.offering.providerServiceExternalId,
          request.target,
          request.quantity,
        );
        if (result.kind === 'accepted')
          return { kind: 'accepted' as const, externalOrderId: result.orderId };
        if (result.kind === 'rejected')
          return {
            kind: 'rejected' as const,
            message: 'Provider rejected the order',
          };
        return {
          kind: 'uncertain' as const,
          message: 'Provider result is unknown',
        };
      },
      getStatus: (providerOrderId: string) =>
        this.provider.status(providerOrderId),
    };
  }

  private async findCandidate(
    input: PurchaseInput,
  ): Promise<PurchaseCandidate | null> {
    try {
      return await this.repository.findCandidate(
        input.tenantId,
        input.serviceId,
      );
    } catch (error: unknown) {
      if (error instanceof InvalidProviderContractError)
        throw new UnprocessableEntityException(
          'Provider service contract is invalid',
        );
      throw error;
    }
  }

  private async reloadAfterFinalization(
    input: PurchaseInput,
    replay: boolean,
  ): Promise<{ order: OrderResponseDto; statusCode: 200 | 201 | 202 }> {
    const current = await this.repository.findByKey(input);
    if (!current) throw new InternalServerErrorException();
    if (current.requestFingerprint !== input.fingerprint)
      throw new ConflictException('Idempotency key conflict');
    return {
      order: this.publicOrder(current),
      statusCode: current.status === 'enviando' ? 202 : replay ? 200 : 201,
    };
  }
}
