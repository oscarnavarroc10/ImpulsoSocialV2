import {
  SmmgenOrderAdapter,
  SmmgenOrderTransport,
} from '../../../src/modules/orders/infrastructure/smmgen-order.adapter';

const offering = {
  offeringId: 'offering-1',
  providerServiceId: 'provider-1',
  providerOrigin: 'smmgen',
  providerServiceExternalId: 'fixture-1',
  capability: 'STANDARD' as const,
  contractVersion: 'smmgen-default-v1',
};

describe('SMMGEN order boundary', () => {
  afterEach(() => {
    delete process.env.SMMGEN_API_URL;
    delete process.env.SMMGEN_API_KEY;
  });

  it('does not call a transport without backend configuration', async () => {
    const transport = jest.fn() as unknown as SmmgenOrderTransport;
    const adapter = new SmmgenOrderAdapter(transport);

    await expect(
      adapter.createOrder({
        offering,
        target: 'https://fixture.invalid',
        quantity: 10,
        idempotencyContext: 'fixture-key',
      }),
    ).resolves.toEqual({ kind: 'uncertain', message: 'Provider unavailable' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('normalizes blocked network and malformed responses without provider details', async () => {
    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
    const transport: SmmgenOrderTransport = () =>
      Promise.reject(new Error('authorization=secret body=private-rate'));
    const adapter = new SmmgenOrderAdapter(transport);

    await expect(
      adapter.createOrder({
        offering,
        target: 'https://fixture.invalid',
        quantity: 10,
        idempotencyContext: 'fixture-key',
      }),
    ).resolves.toEqual({
      kind: 'uncertain',
      message: 'Provider result unavailable',
    });
  });

  it('does not treat unknown statuses as successful', async () => {
    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
    const transport: SmmgenOrderTransport = (_url, init) => {
      expect(JSON.parse(init.body)).toEqual({
        action: 'status',
        order: 'fixture-order-1',
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              status: 'future-state',
              start_count: '10',
              remains: '990',
              error: 'private provider body',
            }),
          ),
      });
    };
    const adapter = new SmmgenOrderAdapter(transport);

    await expect(adapter.getStatus('fixture-order-1')).resolves.toEqual({
      kind: 'ok',
      externalStatus: 'future-state',
      startCount: 10,
      remains: 990,
    });
  });

  it('rejects Custom Comments before making an outbound request', async () => {
    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
    const transport = jest.fn() as unknown as SmmgenOrderTransport;
    const adapter = new SmmgenOrderAdapter(transport);

    await expect(
      adapter.createOrder({
        offering: { ...offering, capability: 'CUSTOM_COMMENTS' },
        target: 'fixture',
        comments: ['private comment'],
        idempotencyContext: 'fixture-key',
      }),
    ).resolves.toEqual({
      kind: 'rejected',
      message: 'Unsupported provider capability',
    });
    expect(transport).not.toHaveBeenCalled();
  });
});
