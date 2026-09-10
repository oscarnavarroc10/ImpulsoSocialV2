import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EstadoOrden } from '@prisma/client';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import {
  InvalidProviderContractError,
  OrderRepository,
} from '../../../src/modules/orders/infrastructure/order.repository';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import type { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';

const principal = { userId: 'user-1', tenantId: 'tenant-1', role: 'cliente' };
const candidate = {
  serviceId: 'service-1',
  externalId: '123',
  min: 1,
  max: 10_000,
  providerCost: 10,
  providerCurrency: 'MXN',
  sellingPrice: 15_000,
  currency: 'MXN',
};
const order = {
  id: 'order-1',
  serviceId: 'service-1',
  target: 'https://example.test',
  quantity: 1501,
  totalPrice: { amount: 22_515, currency: 'MXN' },
  status: 'pendiente',
  createdAt: new Date(),
};
const replayOrder = {
  ...order,
  requestFingerprint: createHash('sha256')
    .update(JSON.stringify(['service-1', 'https://example.test', 1501]))
    .digest('hex'),
};

function setup(
  result:
    | { kind: 'accepted'; orderId: string }
    | { kind: 'rejected' }
    | { kind: 'unknown' },
) {
  const findCandidate = jest.fn().mockResolvedValue(candidate);
  const findByKey = jest.fn().mockResolvedValue(null);
  const total = jest.fn((rate: number, quantity: number) =>
    Number((BigInt(rate) * BigInt(quantity) + 999n) / 1000n),
  );
  const createPurchase = jest.fn().mockResolvedValue(order);
  const claim = jest.fn().mockResolvedValue(true);
  const finalize = jest.fn().mockResolvedValue({
    ...order,
    status:
      result.kind === 'accepted'
        ? 'enviadaProveedor'
        : result.kind === 'rejected'
          ? 'reembolsada'
          : 'enviando',
  });
  const repository = {
    findCandidate,
    findByKey,
    total,
    createPurchase,
    claim,
    finalize,
  } as unknown as OrderRepository;
  const isReady = jest.fn().mockReturnValue(true);
  const submit = jest.fn().mockResolvedValue(result);
  const provider = {
    isReady,
    submit,
  } as unknown as BulkFollowsOrderClient;
  return {
    service: new OrderService(repository, provider),
    repository,
    provider,
    findByKey,
    findCandidate,
    createPurchase,
    submit,
    total,
    claim,
    finalize,
    isReady,
  };
}

describe('OrderService', () => {
  it('calculates ceiling per thousand with BigInt arithmetic', () => {
    const { total } = setup({ kind: 'unknown' });
    expect(total(15_000, 1501)).toBe(22_515);
  });

  it.each([
    [
      { kind: 'accepted', orderId: 'provider-1' } as const,
      'enviadaProveedor',
      201,
    ],
    [{ kind: 'rejected' } as const, 'reembolsada', 201],
    [{ kind: 'unknown' } as const, 'enviando', 202],
  ])('maps provider outcome %j', async (result, status, statusCode) => {
    const { service, submit } = setup(result);
    const response = await service.create(
      {
        serviceId: 'service-1',
        target: ' https://example.test ',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );
    expect(response.statusCode).toBe(statusCode);
    expect(response.order.status).toBe(status);
    expect(jest.mocked(submit)).toHaveBeenCalledTimes(1);
  });

  it('rejects a conflicting idempotency key', async () => {
    const { service, findByKey } = setup({ kind: 'unknown' });
    jest.mocked(findByKey).mockResolvedValue({
      ...replayOrder,
      requestFingerprint: '0'.repeat(64),
    });
    await expect(
      service.create(
        {
          serviceId: 'service-1',
          target: 'https://example.test',
          quantity: 1501,
        },
        principal,
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps an unavailable candidate and out-of-range quantity before writes', async () => {
    const { service, findCandidate, createPurchase } = setup({
      kind: 'unknown',
    });
    jest.mocked(findCandidate).mockResolvedValueOnce(null);
    await expect(
      service.create(
        { serviceId: 'missing', target: 'https://example.test', quantity: 1 },
        principal,
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    jest
      .mocked(findCandidate)
      .mockResolvedValueOnce({ ...candidate, min: 100 });
    await expect(
      service.create(
        { serviceId: 'service-1', target: 'https://example.test', quantity: 1 },
        principal,
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createPurchase).not.toHaveBeenCalled();
  });

  it('claims and submits a pending replay, but never submits a sending replay', async () => {
    const { service, findByKey, submit } = setup({
      kind: 'unknown',
    });
    jest
      .mocked(findByKey)
      .mockResolvedValue({ ...replayOrder, status: 'pendiente' });
    await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );
    expect(submit).toHaveBeenCalledTimes(1);

    jest
      .mocked(findByKey)
      .mockResolvedValue({ ...replayOrder, status: 'enviando' });
    await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('returns a finalized replay even when provider configuration is unavailable', async () => {
    const { service, findByKey, isReady, submit } = setup({ kind: 'unknown' });
    jest.mocked(isReady).mockReturnValue(false);
    jest.mocked(findByKey).mockResolvedValue({
      ...replayOrder,
      status: 'enviadaProveedor',
    });

    const response = await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );

    expect(response.statusCode).toBe(200);
    expect(submit).not.toHaveBeenCalled();
  });

  it('never exposes the fingerprint when a pending replay loses its candidate', async () => {
    const { service, findByKey, findCandidate } = setup({ kind: 'unknown' });
    jest
      .mocked(findByKey)
      .mockResolvedValue({ ...replayOrder, status: 'pendiente' });
    jest.mocked(findCandidate).mockResolvedValue(null);

    const response = await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );

    expect(response.statusCode).toBe(200);
    expect(response.order).not.toHaveProperty('requestFingerprint');
  });

  it('returns HTTP 200 when a pending replay reaches a definitive outcome', async () => {
    const { service, findByKey } = setup({
      kind: 'accepted',
      orderId: 'provider-1',
    });
    jest
      .mocked(findByKey)
      .mockResolvedValue({ ...replayOrder, status: 'pendiente' });

    const response = await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );

    expect(response.statusCode).toBe(200);
    expect(response.order.status).toBe('enviadaProveedor');
  });

  it('reloads the persisted state instead of inventing a failed finalization', async () => {
    const { service, findByKey, finalize } = setup({ kind: 'rejected' });
    jest
      .mocked(findByKey)
      .mockResolvedValueOnce({ ...replayOrder, status: 'pendiente' })
      .mockResolvedValueOnce({ ...replayOrder, status: 'enviando' });
    jest.mocked(finalize).mockResolvedValue(null);

    const response = await service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );

    expect(response.statusCode).toBe(202);
    expect(response.order.status).toBe('enviando');
    expect(response.order).not.toHaveProperty('requestFingerprint');
  });

  it('maps a malformed provider contract to HTTP 422 before purchase', async () => {
    const { service, findCandidate, createPurchase } = setup({
      kind: 'unknown',
    });
    jest
      .mocked(findCandidate)
      .mockRejectedValueOnce(new InvalidProviderContractError());

    await expect(
      service.create(
        {
          serviceId: 'service-1',
          target: 'https://example.test',
          quantity: 1501,
        },
        principal,
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createPurchase).not.toHaveBeenCalled();
  });

  it('recovers a pending P2002 winner through the same conditional claim', async () => {
    const setupResult = setup({ kind: 'unknown' });
    jest
      .mocked(setupResult.createPurchase)
      .mockRejectedValueOnce({ code: 'P2002' });
    jest
      .mocked(setupResult.findByKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...replayOrder, status: 'pendiente' });
    await setupResult.service.create(
      {
        serviceId: 'service-1',
        target: 'https://example.test',
        quantity: 1501,
      },
      principal,
      'key-1234',
    );
    expect(setupResult.submit).toHaveBeenCalledTimes(1);
  });

  it('maps an unrepresentable total to HTTP 422 before creating the purchase', async () => {
    const { service, total, createPurchase } = setup({ kind: 'unknown' });
    jest.mocked(total).mockImplementation(() => {
      throw new Error('UNREPRESENTABLE_TOTAL');
    });
    await expect(
      service.create(
        {
          serviceId: 'service-1',
          target: 'https://example.test',
          quantity: 1501,
        },
        principal,
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createPurchase).not.toHaveBeenCalled();
  });
});

describe('OrderService read flow', () => {
  function setupRead() {
    const findMany = jest.fn().mockResolvedValue([order]);
    const count = jest.fn().mockResolvedValue(1);
    const findById = jest.fn().mockResolvedValue(order);
    const repository = {
      findMany,
      count,
      findById,
    } as unknown as OrderRepository;
    const provider = {} as unknown as BulkFollowsOrderClient;
    return {
      service: new OrderService(repository, provider),
      findMany,
      count,
      findById,
    };
  }

  it('applies default pagination and forwards the principal scope', async () => {
    const { service, findMany, count } = setupRead();
    const response = await service.list({}, principal);
    expect(findMany).toHaveBeenCalledWith(
      principal.tenantId,
      principal.userId,
      { status: undefined },
      0,
      20,
    );
    expect(count).toHaveBeenCalledWith(principal.tenantId, principal.userId, {
      status: undefined,
    });
    expect(response.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('computes skip from an explicit page/limit and forwards the status filter', async () => {
    const { service, findMany, count } = setupRead();
    await service.list(
      { page: 3, limit: 10, status: 'enviadaProveedor' },
      principal,
    );
    expect(findMany).toHaveBeenCalledWith(
      principal.tenantId,
      principal.userId,
      { status: 'enviadaProveedor' },
      20,
      10,
    );
    expect(count).toHaveBeenCalledWith(principal.tenantId, principal.userId, {
      status: 'enviadaProveedor',
    });
  });

  it('returns the safe order shape for a scoped detail lookup', async () => {
    const { service, findById } = setupRead();
    const result = await service.getById('order-1', principal);
    expect(findById).toHaveBeenCalledWith(
      principal.tenantId,
      principal.userId,
      'order-1',
    );
    expect(result).toEqual(order);
  });

  it('returns a uniform 404 for a missing or foreign order', async () => {
    const { service, findById } = setupRead();
    jest.mocked(findById).mockResolvedValue(null);
    await expect(service.getById('missing', principal)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('OrderService refresh status flow', () => {
  const refreshOrder = { ...order, status: 'enviadaProveedor' };

  function setupRefresh() {
    const findForRefresh = jest.fn().mockResolvedValue({
      order: refreshOrder,
      providerOrderId: 'provider-1',
    });
    const applyRefresh = jest.fn().mockResolvedValue({
      ...refreshOrder,
      status: 'enProgreso',
    });
    const repository = {
      findForRefresh,
      applyRefresh,
    } as unknown as OrderRepository;
    const isReady = jest.fn().mockReturnValue(true);
    const status = jest.fn().mockResolvedValue({
      kind: 'ok',
      externalStatus: ' In progress ',
      startCount: 3572,
      remains: 157,
    });
    const provider = { isReady, status } as unknown as BulkFollowsOrderClient;
    return {
      service: new OrderService(repository, provider),
      findForRefresh,
      applyRefresh,
      isReady,
      status,
    };
  }

  it('scopes lookup, maps the provider status, and applies counters', async () => {
    const { service, findForRefresh, applyRefresh, status } = setupRefresh();
    await expect(
      service.refreshStatus('order-1', principal),
    ).resolves.toMatchObject({ status: 'enProgreso' });
    expect(findForRefresh).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'order-1',
    );
    expect(status).toHaveBeenCalledWith('provider-1');
    expect(applyRefresh).toHaveBeenCalledWith('tenant-1', 'user-1', 'order-1', {
      providerStatus: 'In progress',
      localStatus: EstadoOrden.enProgreso,
      startCount: 3572,
      remains: 157,
    });
  });

  it.each([
    ['Pending', EstadoOrden.enviadaProveedor],
    ['Processing', EstadoOrden.enProgreso],
    ['Completed', EstadoOrden.completada],
    ['Partial', EstadoOrden.parcial],
    ['Canceled', EstadoOrden.cancelada],
    ['Cancelled', EstadoOrden.cancelada],
  ])('maps %s to %s', async (externalStatus, localStatus) => {
    const { service, status, applyRefresh } = setupRefresh();
    jest.mocked(status).mockResolvedValue({
      kind: 'ok',
      externalStatus,
      startCount: 1,
      remains: 0,
    });
    await service.refreshStatus('order-1', principal);
    const applyCalls = applyRefresh.mock.calls as unknown[][];
    expect(applyCalls[0]?.[3]).toMatchObject({
      providerStatus: externalStatus,
      localStatus,
    });
  });

  it('returns 404 without contacting the provider for a missing or foreign order', async () => {
    const { service, findForRefresh, status } = setupRefresh();
    jest.mocked(findForRefresh).mockResolvedValue(null);
    await expect(
      service.refreshStatus('foreign', principal),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(status).not.toHaveBeenCalled();
  });

  it('short-circuits terminal orders and rejects missing provider IDs', async () => {
    const terminal = setupRefresh();
    jest.mocked(terminal.findForRefresh).mockResolvedValue({
      order: { ...refreshOrder, status: 'completada' },
      providerOrderId: 'provider-1',
    });
    await expect(
      terminal.service.refreshStatus('order-1', principal),
    ).resolves.toMatchObject({ status: 'completada' });
    expect(terminal.status).not.toHaveBeenCalled();

    const missingId = setupRefresh();
    jest
      .mocked(missingId.findForRefresh)
      .mockResolvedValue({ order: refreshOrder, providerOrderId: null });
    await expect(
      missingId.service.refreshStatus('order-1', principal),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(missingId.status).not.toHaveBeenCalled();

    const blankId = setupRefresh();
    jest
      .mocked(blankId.findForRefresh)
      .mockResolvedValue({ order: refreshOrder, providerOrderId: '   ' });
    await expect(
      blankId.service.refreshStatus('order-1', principal),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blankId.status).not.toHaveBeenCalled();
  });

  it('sanitizes unavailable configuration and provider responses', async () => {
    const unavailable = setupRefresh();
    jest.mocked(unavailable.isReady).mockReturnValue(false);
    await expect(
      unavailable.service.refreshStatus('order-1', principal),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(unavailable.status).not.toHaveBeenCalled();

    const malformed = setupRefresh();
    jest.mocked(malformed.status).mockResolvedValue({ kind: 'unavailable' });
    await expect(
      malformed.service.refreshStatus('order-1', principal),
    ).rejects.toBeInstanceOf(BadGatewayException);

    const unknown = setupRefresh();
    jest.mocked(unknown.status).mockResolvedValue({
      kind: 'ok',
      externalStatus: 'Unknown',
      startCount: 1,
      remains: 0,
    });
    await expect(
      unknown.service.refreshStatus('order-1', principal),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('OrderRepository transactions', () => {
  const dbOrder = {
    id: 'order-1',
    servicioId: 'service-1',
    enlace: 'https://example.test',
    cantidad: 1000,
    precioTotal: 15000,
    monedaVenta: 'MXN',
    estado: 'pendiente' as const,
    creadaEn: new Date(),
  };
  const input = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    serviceId: 'service-1',
    target: 'https://example.test',
    quantity: 1000,
    key: 'key-1234',
    fingerprint: 'f'.repeat(64),
  };
  const candidate = {
    serviceId: 'service-1',
    externalId: '123',
    min: 1,
    max: 1000,
    providerCost: 10,
    providerCurrency: 'MXN',
    sellingPrice: 15000,
    currency: 'MXN',
  };

  it('accepts a matching numeric provider service id', async () => {
    const prisma = {
      masterService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'service-1',
          providerCostAmount: 10,
          providerCostCurrency: 'MXN',
          defaultSellingPriceAmount: 15000,
          defaultSellingPriceCurrency: 'MXN',
          provenanceRef: 'provider-row-1',
          configuracionesTienda: [],
        }),
      },
      providerService: {
        findUnique: jest.fn().mockResolvedValue({
          providerOrigin: 'bulkfollows',
          externalId: '123',
          rawPayload: {
            service: 123,
            type: 'Default',
            min: '1',
            max: '1000',
          },
        }),
      },
    } as unknown as PrismaService;

    await expect(
      new OrderRepository(prisma).findCandidate('tenant-1', 'service-1'),
    ).resolves.toMatchObject({ externalId: '123' });
  });

  it('debits atomically and records exact previous/posterior balances', async () => {
    const tx = {
      orden: { create: jest.fn().mockResolvedValue(dbOrder) },
      billetera: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'wallet-1', saldoDisponible: 85000 }),
      },
      movimientoSaldo: { create: jest.fn() },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    await new OrderRepository(prisma).createPurchase(input, candidate, 15000);
    const walletCall = (
      tx.billetera.updateMany.mock.calls as unknown[][]
    )[0]?.[0];
    const movementCall = (
      tx.movimientoSaldo.create.mock.calls as unknown[][]
    )[0]?.[0];
    expect(walletCall).toMatchObject({
      where: { saldoDisponible: { gte: 15000 } },
    });
    expect(movementCall).toMatchObject({
      data: { saldoAnterior: 100000, saldoPosterior: 85000 },
    });
  });

  it('runs rejected finalization once and accepted finalization once', async () => {
    const tx = {
      orden: {
        findFirst: jest.fn().mockResolvedValue({
          ...dbOrder,
          estado: 'enviando',
          precioTotal: 15000,
          monedaVenta: 'MXN',
        }),
        updateMany: jest
          .fn()
          .mockReturnValueOnce({ count: 1 })
          .mockReturnValueOnce({ count: 0 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...dbOrder, estado: 'reembolsada' }),
      },
      ordenProveedor: { update: jest.fn() },
      billetera: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'wallet-1', saldoDisponible: 100000 }),
      },
      movimientoSaldo: { create: jest.fn() },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);
    await repository.finalize('order-1', input, { kind: 'rejected' });
    await repository.finalize('order-1', input, { kind: 'rejected' });
    expect(tx.billetera.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.movimientoSaldo.create).toHaveBeenCalledTimes(1);
    expect(tx.historialOrden.create).toHaveBeenCalledTimes(1);

    tx.orden.updateMany
      .mockReset()
      .mockReturnValueOnce({ count: 1 })
      .mockReturnValueOnce({ count: 0 });
    tx.orden.findUniqueOrThrow
      .mockReset()
      .mockResolvedValue({ ...dbOrder, estado: 'enviadaProveedor' });
    tx.ordenProveedor.update.mockClear();
    await repository.finalize('order-1', input, {
      kind: 'accepted',
      providerId: 'provider-1',
    });
    await repository.finalize('order-1', input, {
      kind: 'accepted',
      providerId: 'provider-2',
    });
    expect(tx.ordenProveedor.update).toHaveBeenCalledTimes(1);
  });

  it('claims only when the pending transition affects one row', async () => {
    const tx = {
      orden: {
        updateMany: jest
          .fn()
          .mockReturnValueOnce({ count: 1 })
          .mockReturnValueOnce({ count: 0 }),
      },
      ordenProveedor: { create: jest.fn() },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);
    expect(
      await repository.claim(
        'order-1',
        input,
        '123',
        input.target,
        input.quantity,
      ),
    ).toBe(true);
    expect(
      await repository.claim(
        'order-1',
        input,
        '123',
        input.target,
        input.quantity,
      ),
    ).toBe(false);
    expect(tx.ordenProveedor.create).toHaveBeenCalledTimes(1);
    expect(tx.historialOrden.create).toHaveBeenCalledTimes(1);
  });

  it('scopes findMany by tenant/user, applies the status filter, sort, and pagination', async () => {
    const findMany = jest.fn().mockResolvedValue([dbOrder]);
    const prisma = { orden: { findMany } } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);
    const rows = await repository.findMany(
      'tenant-1',
      'user-1',
      { status: 'enviadaProveedor' },
      20,
      10,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: {
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
        estado: 'enviadaProveedor',
      },
      select: {
        id: true,
        servicioId: true,
        enlace: true,
        cantidad: true,
        precioTotal: true,
        monedaVenta: true,
        estado: true,
        creadaEn: true,
      },
      orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 10,
    });
    expect(rows).toEqual([
      {
        id: dbOrder.id,
        serviceId: dbOrder.servicioId,
        target: dbOrder.enlace,
        quantity: dbOrder.cantidad,
        totalPrice: {
          amount: dbOrder.precioTotal,
          currency: dbOrder.monedaVenta,
        },
        status: dbOrder.estado,
        createdAt: dbOrder.creadaEn,
      },
    ]);
  });

  it('omits the status predicate from findMany/count when no filter is given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      orden: { findMany, count },
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);
    await repository.findMany('tenant-1', 'user-1', {}, 0, 20);
    await repository.count('tenant-1', 'user-1', {});
    const findManyCall = (findMany.mock.calls as unknown[][])[0]?.[0];
    const countCall = (count.mock.calls as unknown[][])[0]?.[0];
    expect(findManyCall).toMatchObject({
      where: {
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
      },
    });
    expect(countCall).toMatchObject({
      where: {
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
      },
    });
  });

  it('scopes findById by tenant and user and returns null for a foreign or missing order', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { orden: { findFirst } } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);
    const result = await repository.findById('tenant-1', 'user-1', 'order-1');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'order-1', tiendaId: 'tenant-1', usuarioId: 'user-1' },
      select: {
        id: true,
        servicioId: true,
        enlace: true,
        cantidad: true,
        precioTotal: true,
        monedaVenta: true,
        estado: true,
        creadaEn: true,
      },
    });
    expect(result).toBeNull();
  });

  it('applies a refresh atomically with scoped state, counters, provider metadata, and one history row', async () => {
    const current = { ...dbOrder, estado: EstadoOrden.enviadaProveedor };
    const tx = {
      orden: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...current, estado: EstadoOrden.enProgreso }),
      },
      ordenProveedor: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);

    await repository.applyRefresh('tenant-1', 'user-1', 'order-1', {
      providerStatus: 'In progress',
      localStatus: EstadoOrden.enProgreso,
      startCount: 3572,
      remains: 157,
    });

    const findCalls = tx.orden.findFirst.mock.calls as unknown[][];
    expect(findCalls[0]?.[0]).toMatchObject({
      where: { id: 'order-1', tiendaId: 'tenant-1', usuarioId: 'user-1' },
      select: { completadaEn: true, canceladaEn: true },
    });
    const updateCalls = tx.orden.updateMany.mock.calls as unknown[][];
    expect(updateCalls[0]?.[0]).toMatchObject({
      where: {
        id: 'order-1',
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
        estado: EstadoOrden.enviadaProveedor,
      },
      data: {
        estado: EstadoOrden.enProgreso,
        conteoInicial: 3572,
        restante: 157,
      },
    });
    const providerCalls = tx.ordenProveedor.updateMany.mock
      .calls as unknown[][];
    const providerCall = providerCalls[0]?.[0] as {
      where?: unknown;
      data?: { estadoExterno?: unknown; ultimaConsultaEn?: unknown };
    };
    expect(providerCall).toMatchObject({
      where: { ordenId: 'order-1' },
      data: {
        estadoExterno: 'In progress',
      },
    });
    expect(providerCall.data?.ultimaConsultaEn).toBeInstanceOf(Date);
    expect(tx.historialOrden.create).toHaveBeenCalledWith({
      data: {
        ordenId: 'order-1',
        estadoAnterior: EstadoOrden.enviadaProveedor,
        estadoNuevo: EstadoOrden.enProgreso,
        origen: 'bulkfollows-status',
      },
    });
  });

  it('short-circuits terminal state and does not duplicate same-state history', async () => {
    const terminal = { ...dbOrder, estado: EstadoOrden.completada };
    const sameState = { ...dbOrder, estado: EstadoOrden.enProgreso };
    const tx = {
      orden: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(terminal)
          .mockResolvedValueOnce(sameState),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(sameState),
      },
      ordenProveedor: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);

    await repository.applyRefresh('tenant-1', 'user-1', 'order-1', {
      providerStatus: 'In progress',
      localStatus: EstadoOrden.enProgreso,
      startCount: 1,
      remains: 1,
    });
    await repository.applyRefresh('tenant-1', 'user-1', 'order-1', {
      providerStatus: 'Processing',
      localStatus: EstadoOrden.enProgreso,
      startCount: 2,
      remains: 0,
    });

    expect(tx.orden.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.historialOrden.create).not.toHaveBeenCalled();
  });

  it('does not apply a backward provider status', async () => {
    const current = { ...dbOrder, estado: EstadoOrden.enProgreso };
    const tx = {
      orden: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      ordenProveedor: { updateMany: jest.fn() },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);

    await expect(
      repository.applyRefresh('tenant-1', 'user-1', 'order-1', {
        providerStatus: 'Pending',
        localStatus: EstadoOrden.enviadaProveedor,
        startCount: 1,
        remains: 10,
      }),
    ).resolves.toMatchObject({ status: EstadoOrden.enProgreso });

    expect(tx.orden.updateMany).not.toHaveBeenCalled();
    expect(tx.ordenProveedor.updateMany).not.toHaveBeenCalled();
    expect(tx.historialOrden.create).not.toHaveBeenCalled();
  });

  it('returns the concurrent winner without overwriting metadata or history', async () => {
    const current = { ...dbOrder, estado: EstadoOrden.enProgreso };
    const winner = { ...dbOrder, estado: EstadoOrden.parcial };
    const tx = {
      orden: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(winner),
      },
      ordenProveedor: { updateMany: jest.fn() },
      historialOrden: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new OrderRepository(prisma);

    await expect(
      repository.applyRefresh('tenant-1', 'user-1', 'order-1', {
        providerStatus: 'Completed',
        localStatus: EstadoOrden.completada,
        startCount: 1,
        remains: 0,
      }),
    ).resolves.toMatchObject({ status: EstadoOrden.parcial });

    expect(tx.ordenProveedor.updateMany).not.toHaveBeenCalled();
    expect(tx.historialOrden.create).not.toHaveBeenCalled();
  });
});
