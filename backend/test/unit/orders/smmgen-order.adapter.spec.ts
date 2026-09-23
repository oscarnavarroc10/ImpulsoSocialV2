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

function transport(response: unknown, calls: string[]): SmmgenOrderTransport {
  return (_url, init) => {
    calls.push(init.body);
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  };
}

describe('SmmgenOrderAdapter', () => {
  beforeEach(() => {
    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
  });

  afterEach(() => {
    delete process.env.SMMGEN_API_URL;
    delete process.env.SMMGEN_API_KEY;
  });

  it('maps Standard target and quantity exactly once', async () => {
    const calls: string[] = [];
    const adapter = new SmmgenOrderAdapter(
      transport({ order: 'fixture-order-1' }, calls),
    );
    await expect(
      adapter.createOrder({
        offering,
        target: 'https://fixture.invalid',
        quantity: 25,
        idempotencyContext: 'fp',
      }),
    ).resolves.toEqual({
      kind: 'accepted',
      externalOrderId: 'fixture-order-1',
    });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0])).toMatchObject({
      action: 'add',
      service: 'fixture-1',
      link: 'https://fixture.invalid',
      quantity: 25,
    });
  });

  it('does not build a request for unsupported capabilities', async () => {
    const calls: string[] = [];
    const adapter = new SmmgenOrderAdapter(
      transport({ order: 'fixture-order-1' }, calls),
    );
    await expect(
      adapter.createOrder({
        offering: { ...offering, capability: 'CUSTOM_COMMENTS' },
        target: 'fixture',
        idempotencyContext: 'fp',
      }),
    ).resolves.toEqual({
      kind: 'rejected',
      message: 'Unsupported provider capability',
    });
    expect(calls).toHaveLength(0);
  });

  it('preserves recorded status values as sanitized provider-neutral results', async () => {
    const adapter = new SmmgenOrderAdapter(
      transport({ status: 'processing', start_count: 1, remains: 2 }, []),
    );
    await expect(adapter.getStatus('fixture-order-1')).resolves.toEqual({
      kind: 'ok',
      externalStatus: 'processing',
      startCount: 1,
      remains: 2,
    });
  });

  it.each([
    { response: { error: 'provider-private-error' }, expected: 'rejected' },
    { response: {}, expected: 'uncertain' },
    { response: { order: { nested: true } }, expected: 'uncertain' },
  ])(
    'normalizes non-accepted outcomes without retrying: %p',
    async ({ response, expected }) => {
      const calls: string[] = [];
      const adapter = new SmmgenOrderAdapter(transport(response, calls));

      await expect(
        adapter.createOrder({
          offering,
          target: 'https://fixture.invalid',
          quantity: 25,
          idempotencyContext: 'fp',
        }),
      ).resolves.toMatchObject({ kind: expected });
      expect(calls).toHaveLength(1);
    },
  );

  it('fails closed for malformed and unknown status responses', async () => {
    const calls: string[] = [];
    const adapter = new SmmgenOrderAdapter(
      transport(
        { status: 'future-status', start_count: 'bad', remains: 1 },
        calls,
      ),
    );

    await expect(adapter.getStatus('fixture-order-1')).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(calls).toHaveLength(1);
  });
});
