import { EstadoDeposito, TipoMovimientoSaldo } from '@prisma/client';
import { DepositRepository } from '../../../src/modules/deposits/infrastructure/deposit.repository';
import { DepositMethod } from '../../../src/modules/deposits/application/dto/deposit.dto';

const customer = {
  id: 'user-1',
  nombre: 'Customer',
  email: 'customer@example.com',
};
const row = {
  id: 'deposit-1',
  tiendaId: 'tenant-1',
  billeteraId: 'wallet-1',
  monto: 500,
  moneda: 'MXN',
  metodo: DepositMethod.transferencia,
  estado: EstadoDeposito.pendiente,
  proveedorPago: 'manual-transfer',
  referenciaExterna: 'REF-1',
  comprobanteUrl: null,
  datosProveedor: { kind: 'manual-deposit-request', requestFingerprint: 'fp' },
  aprobadoPorId: null,
  aprobadoEn: null,
  rechazadoEn: null,
  motivoRechazo: null,
  creadoEn: new Date('2026-09-17T12:00:00.000Z'),
  actualizadoEn: new Date('2026-09-17T12:00:00.000Z'),
  billetera: { usuarioId: 'user-1', tiendaId: 'tenant-1', usuario: customer },
};

type DbArgs = Record<string, unknown>;
type DbCall = jest.MockedFunction<(args: DbArgs) => Promise<unknown>>;
type TransactionCall = jest.MockedFunction<
  (callback: (tx: unknown) => unknown) => Promise<unknown>
>;
type PrismaDouble = {
  tienda: { findFirst: DbCall };
  billetera: { findFirst: DbCall; updateMany: DbCall };
  deposito: {
    findFirst: DbCall;
    findMany: DbCall;
    count: DbCall;
    updateMany: DbCall;
    create: DbCall;
    findUniqueOrThrow: DbCall;
  };
  movimientoSaldo: { findUnique: DbCall; create: DbCall };
  $transaction: TransactionCall;
};

function dbCall(value: unknown): DbCall {
  return jest.fn<(args: DbArgs) => Promise<unknown>>().mockResolvedValue(value);
}

function transactionFor(tx: unknown): TransactionCall {
  const implementation = (run: (value: unknown) => unknown): Promise<unknown> =>
    Promise.resolve(run(tx));
  return jest.fn(implementation);
}

function firstArgs(call: DbCall): DbArgs {
  return call.mock.calls[0]?.[0] ?? {};
}

function prismaMock(): PrismaDouble {
  const prisma: PrismaDouble = {
    tienda: {
      findFirst: dbCall({ moneda: 'MXN', id: 'tenant-1' }),
    },
    billetera: {
      findFirst: dbCall({ id: 'wallet-1', saldoDisponible: 100 }),
      updateMany: dbCall({ count: 1 }),
    },
    deposito: {
      findFirst: dbCall(row),
      findMany: dbCall([row]),
      count: dbCall(1),
      updateMany: dbCall({ count: 1 }),
      create: dbCall(row),
      findUniqueOrThrow: dbCall(row),
    },
    movimientoSaldo: {
      findUnique: dbCall({
        id: 'deposit-credit:deposit-1',
        billeteraId: 'wallet-1',
        tipo: TipoMovimientoSaldo.deposito,
        monto: 500,
        referencia: 'deposit-1',
        saldoPosterior: 600,
      }),
      create: dbCall({}),
    },
    $transaction: transactionFor({}),
  };
  return prisma;
}

describe('DepositRepository scoped reads', () => {
  it('resolves only active tenant currency', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    await expect(repository.findTenantCurrency('tenant-1')).resolves.toBe(
      'MXN',
    );
    expect(prisma.tienda.findFirst).toHaveBeenCalledWith({
      where: { id: 'tenant-1', activa: true },
      select: { moneda: true },
    });
  });

  it('resolves an active canonical wallet with tenant and owner scope', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    await repository.findCanonicalWallet('tenant-1', 'user-1', 'MXN');
    expect(firstArgs(prisma.billetera.findFirst)).toMatchObject({
      where: {
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
        moneda: 'MXN',
        usuario: { estado: 'activo', tiendaId: 'tenant-1' },
      },
    });
  });

  it('puts tenant, owner, currency, every filter, and stable ordering in own list queries', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    await repository.listOwn(
      { tenantId: 'tenant-1', userId: 'user-1', currency: 'MXN' },
      { status: EstadoDeposito.pendiente, method: DepositMethod.transferencia },
      20,
      10,
    );
    const args = firstArgs(prisma.deposito.findMany);
    expect(args).toMatchObject({
      where: {
        tiendaId: 'tenant-1',
        estado: EstadoDeposito.pendiente,
        metodo: DepositMethod.transferencia,
        billetera: {
          is: { tiendaId: 'tenant-1', usuarioId: 'user-1', moneda: 'MXN' },
        },
      },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 10,
    });
  });

  it('puts tenant, currency, and user filter in admin count/list queries', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    const filters = {
      status: EstadoDeposito.rechazado,
      method: DepositMethod.criptomoneda,
      userId: 'user-1',
    };
    await repository.countAdmin('tenant-1', 'MXN', filters);
    await repository.listAdmin('tenant-1', 'MXN', filters, 0, 20);
    expect(
      firstArgs(prisma.deposito.count).where as Record<string, unknown>,
    ).toMatchObject({
      tiendaId: 'tenant-1',
      estado: EstadoDeposito.rechazado,
      metodo: DepositMethod.criptomoneda,
      billetera: {
        is: { tiendaId: 'tenant-1', moneda: 'MXN', usuarioId: 'user-1' },
      },
    });
    expect(firstArgs(prisma.deposito.findMany).orderBy).toEqual([
      { creadoEn: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('scopes own detail and cancellation to tenant owner currency pending state', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    const scope = { tenantId: 'tenant-1', userId: 'user-1', currency: 'MXN' };
    await repository.findOwnById(scope, 'deposit-1');
    await repository.cancelOwnPending(scope, 'deposit-1');
    expect(
      firstArgs(prisma.deposito.findFirst).where as Record<string, unknown>,
    ).toMatchObject({
      id: 'deposit-1',
      tiendaId: 'tenant-1',
      billetera: {
        is: { tiendaId: 'tenant-1', usuarioId: 'user-1', moneda: 'MXN' },
      },
    });
    expect(prisma.deposito.updateMany.mock.calls[0][0].where).toMatchObject({
      estado: EstadoDeposito.pendiente,
    });
  });
});

describe('DepositRepository writes and approval transaction', () => {
  it('creates exact pending provider/reference/fingerprint fields after active revalidation', async () => {
    const tx = prismaMock();
    tx.tienda.findFirst.mockResolvedValue({ id: 'tenant-1' });
    tx.billetera.findFirst.mockResolvedValue({ id: 'wallet-1' });
    tx.deposito.create.mockResolvedValue(row);
    const prisma = {
      $transaction: transactionFor(tx),
    };
    await new DepositRepository(prisma as never).createPending({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      amount: 500,
      currency: 'MXN',
      method: DepositMethod.transferencia,
      provider: 'manual-transfer',
      reference: 'REF-1',
      receiptUrl: null,
      fingerprint: 'f'.repeat(64),
    });
    const args = firstArgs(tx.deposito.create);
    expect(args.data).toMatchObject({
      id: 'deposit-1',
      billeteraId: 'wallet-1',
      metodo: DepositMethod.transferencia,
      proveedorPago: 'manual-transfer',
      referenciaExterna: 'REF-1',
      datosProveedor: {
        kind: 'manual-deposit-request',
        requestFingerprint: 'f'.repeat(64),
      },
    });
  });

  function approvalPrisma(
    overrides: {
      deposit?: unknown;
      wallet?: unknown;
      claim?: { count: number };
      walletUpdate?: { count: number };
      movementError?: Error;
    } = {},
  ) {
    const tx = prismaMock();
    tx.tienda.findFirst.mockResolvedValue({ id: 'tenant-1', moneda: 'MXN' });
    tx.deposito.findFirst.mockResolvedValue(
      overrides.deposit ?? {
        id: 'deposit-1',
        tiendaId: 'tenant-1',
        billeteraId: 'wallet-1',
        monto: 500,
        estado: EstadoDeposito.pendiente,
        billetera: {
          usuarioId: 'user-1',
          moneda: 'MXN',
          saldoDisponible: 100,
        },
      },
    );
    tx.deposito.updateMany.mockResolvedValue(overrides.claim ?? { count: 1 });
    tx.billetera.findFirst.mockResolvedValue(
      overrides.wallet ?? { id: 'wallet-1', saldoDisponible: 100 },
    );
    tx.billetera.updateMany.mockResolvedValue(
      overrides.walletUpdate ?? { count: 1 },
    );
    tx.movimientoSaldo.create.mockImplementation(() => {
      if (overrides.movementError) throw overrides.movementError;
      return Promise.resolve({});
    });
    return {
      tx,
      prisma: {
        $transaction: transactionFor(tx),
      },
    };
  }

  it('revalidates active tenant and owner wallet before approval', async () => {
    const { tx, prisma } = approvalPrisma();
    await new DepositRepository(prisma as never).approve({
      tenantId: 'tenant-1',
      depositId: 'deposit-1',
      adminId: 'admin-1',
      currency: 'MXN',
    });
    expect(tx.tienda.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1', activa: true, moneda: 'MXN' },
      }),
    );
    const approvalArgs = firstArgs(tx.deposito.findFirst);
    const approvalWhere = approvalArgs.where as {
      billetera: { is: { usuario: { is: unknown } } };
    };
    expect(approvalWhere.billetera.is.usuario.is).toEqual({
      tiendaId: 'tenant-1',
      estado: 'activo',
    });
  });

  it('checks BigInt overflow before any update or movement create', async () => {
    const { tx, prisma } = approvalPrisma({
      wallet: { id: 'wallet-1', saldoDisponible: 2147483647 },
    });
    await expect(
      new DepositRepository(prisma as never).approve({
        tenantId: 'tenant-1',
        depositId: 'deposit-1',
        adminId: 'admin-1',
        currency: 'MXN',
      }),
    ).rejects.toThrow();
    expect(tx.deposito.updateMany).not.toHaveBeenCalled();
    expect(tx.billetera.updateMany).not.toHaveBeenCalled();
    expect(tx.movimientoSaldo.create).not.toHaveBeenCalled();
  });

  it('claims the exact deposit predicate and clears rejection fields', async () => {
    const { tx, prisma } = approvalPrisma();
    await new DepositRepository(prisma as never).approve({
      tenantId: 'tenant-1',
      depositId: 'deposit-1',
      adminId: 'admin-1',
      currency: 'MXN',
    });
    const claimArgs = firstArgs(tx.deposito.updateMany);
    expect(claimArgs.where).toEqual({
      id: 'deposit-1',
      tiendaId: 'tenant-1',
      billeteraId: 'wallet-1',
      estado: EstadoDeposito.pendiente,
    });
    expect(claimArgs.data).toMatchObject({
      estado: EstadoDeposito.aprobado,
      aprobadoPorId: 'admin-1',
      motivoRechazo: null,
    });
  });

  it('increments the exact wallet predicate using the previous balance', async () => {
    const { tx, prisma } = approvalPrisma();
    await new DepositRepository(prisma as never).approve({
      tenantId: 'tenant-1',
      depositId: 'deposit-1',
      adminId: 'admin-1',
      currency: 'MXN',
    });
    expect(tx.billetera.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wallet-1',
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
        moneda: 'MXN',
        saldoDisponible: 100,
      },
      data: { saldoDisponible: { increment: 500 } },
    });
  });

  it('creates the deterministic deposit movement with exact audit balances', async () => {
    const { tx, prisma } = approvalPrisma();
    await new DepositRepository(prisma as never).approve({
      tenantId: 'tenant-1',
      depositId: 'deposit-1',
      adminId: 'admin-1',
      currency: 'MXN',
    });
    expect(tx.movimientoSaldo.create).toHaveBeenCalledWith({
      data: {
        id: 'deposit-credit:deposit-1',
        billeteraId: 'wallet-1',
        tipo: TipoMovimientoSaldo.deposito,
        monto: 500,
        saldoAnterior: 100,
        saldoPosterior: 600,
        referencia: 'deposit-1',
        descripcion: 'Depósito aprobado',
        creadoPorId: 'admin-1',
      },
    });
  });

  it.each([
    [{ claim: { count: 0 } }, 'deposit race'],
    [{ walletUpdate: { count: 0 } }, 'wallet race'],
    [{ movementError: new Error('movement failure') }, 'movement failure'],
  ])('rolls back when the approval %s occurs', async (overrides) => {
    const { prisma } = approvalPrisma(overrides);
    await expect(
      new DepositRepository(prisma as never).approve({
        tenantId: 'tenant-1',
        depositId: 'deposit-1',
        adminId: 'admin-1',
        currency: 'MXN',
      }),
    ).rejects.toThrow();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('checks all deterministic movement invariant fields', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    const result = await repository.findApprovalInvariant(
      'tenant-1',
      'deposit-1',
    );
    expect(result?.deposit).toEqual({
      id: 'deposit-1',
      walletId: 'wallet-1',
      amount: 500,
      status: EstadoDeposito.pendiente,
      tenantId: 'tenant-1',
    });
    expect(result?.movement).toEqual({
      id: 'deposit-credit:deposit-1',
      walletId: 'wallet-1',
      type: TipoMovimientoSaldo.deposito,
      amount: 500,
      reference: 'deposit-1',
      balanceAfter: 600,
    });
  });

  it('rejects and cancels with only deposit writes and no wallet or movement calls', async () => {
    const prisma = prismaMock();
    const repository = new DepositRepository(prisma as never);
    await repository.reject('tenant-1', 'MXN', 'deposit-1', 'bad proof');
    await repository.cancelOwnPending(
      { tenantId: 'tenant-1', userId: 'user-1', currency: 'MXN' },
      'deposit-1',
    );
    expect(prisma.billetera.findFirst).not.toHaveBeenCalled();
    expect(prisma.movimientoSaldo.create).not.toHaveBeenCalled();
  });
});
