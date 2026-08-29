import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
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
});
